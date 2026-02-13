const { onRequest } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const USERS_COLLECTION = 'users';
const PLANS_COLLECTION = 'plans';
const OFFERS_COLLECTION = 'offers';
const PAYMENT_INTENTS_COLLECTION = 'payment_intents';
const ANALYTICS_EVENTS_COLLECTION = 'analytics_events';
const ANALYTICS_DAILY_COLLECTION = 'analytics_daily';
const NOTIFICATIONS_COLLECTION = 'notifications';

const ALLOWED_STATUSES = new Set(['pending', 'succeeded', 'failed', 'canceled']);

const withCors = (req, res) => {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Signature');
  res.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
};

const getBearerToken = (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  return header.slice(7);
};

const verifyAuth = async (req) => {
  const token = getBearerToken(req);
  if (!token) return null;
  try {
    return await admin.auth().verifyIdToken(token);
  } catch {
    return null;
  }
};

const toTimestamp = (date) => admin.firestore.Timestamp.fromDate(date);

const addOneMonth = (date) => {
  const next = new Date(date);
  next.setMonth(next.getMonth() + 1);
  return next;
};

const getDateId = (date) => {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const logAnalyticsEvent = async (payload) => {
  await db.collection(ANALYTICS_EVENTS_COLLECTION).add({
    ...payload,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
};

exports.createSubscriptionCheckout = onRequest({ region: 'us-central1' }, async (req, res) => {
  if (withCors(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  const authUser = await verifyAuth(req);
  if (!authUser) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const { planId, planName, amount, currency } = req.body || {};
  if (!planId || !planName || typeof amount !== 'number' || amount <= 0 || !currency) {
    res.status(400).json({ message: 'Invalid payload.' });
    return;
  }

  const provider = ['stripe', 'razorpay'].includes(process.env.PAYMENT_PROVIDER || '')
    ? process.env.PAYMENT_PROVIDER
    : 'mock';

  const intentRef = db.collection(PAYMENT_INTENTS_COLLECTION).doc();
  const now = new Date();

  // TODO(payment-provider): Replace placeholder checkout URL generation with real provider order/payment-intent
  // creation (Razorpay Orders API / Stripe Checkout Session) and persist provider references.
  const checkoutBase = process.env.CHECKOUT_BASE_URL || 'https://example.com/checkout';
  const checkoutUrl = `${checkoutBase}?intentId=${encodeURIComponent(intentRef.id)}&provider=${provider}`;

  await intentRef.set({
    userId: authUser.uid,
    planId,
    planName,
    amount,
    currency: String(currency).toUpperCase(),
    provider,
    status: 'pending',
    checkoutUrl,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await logAnalyticsEvent({
    userId: authUser.uid,
    eventType: 'checkout_started',
    source: 'cloud_function',
    planId,
    value: amount,
    currency: String(currency).toUpperCase(),
    metadata: {
      provider,
      createdAtEpoch: now.getTime(),
    },
  });

  res.status(200).json({
    ok: true,
    provider,
    intentId: intentRef.id,
    checkoutUrl,
    message: 'Checkout scaffold created.',
  });
});

exports.paymentIntentStatus = onRequest({ region: 'us-central1' }, async (req, res) => {
  if (withCors(req, res)) return;
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  const authUser = await verifyAuth(req);
  if (!authUser) {
    res.status(401).json({ message: 'Unauthorized.' });
    return;
  }

  const intentId = String(req.query.intentId || '');
  if (!intentId) {
    res.status(400).json({ message: 'intentId is required.' });
    return;
  }

  const intentSnap = await db.collection(PAYMENT_INTENTS_COLLECTION).doc(intentId).get();
  if (!intentSnap.exists) {
    res.status(404).json({ message: 'Payment intent not found.' });
    return;
  }

  const intent = intentSnap.data();
  const isAdmin = authUser.admin === true;
  if (!isAdmin && intent.userId !== authUser.uid) {
    res.status(403).json({ message: 'Forbidden.' });
    return;
  }

  res.status(200).json({
    ok: true,
    status: intent.status,
    provider: intent.provider,
    updatedAt: intent.updatedAt,
  });
});

exports.paymentWebhook = onRequest({ region: 'us-central1' }, async (req, res) => {
  if (withCors(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  // TODO(payment-webhook): Verify provider signature header before trusting payload.
  // For Razorpay/Stripe, verify signature using webhook secret and raw request body.
  const { intentId, status, providerReference, failureReason } = req.body || {};

  if (!intentId || !ALLOWED_STATUSES.has(status)) {
    res.status(400).json({ message: 'Invalid webhook payload.' });
    return;
  }

  const intentRef = db.collection(PAYMENT_INTENTS_COLLECTION).doc(String(intentId));
  const intentSnap = await intentRef.get();
  if (!intentSnap.exists) {
    res.status(404).json({ message: 'Payment intent not found.' });
    return;
  }

  const intent = intentSnap.data();

  await intentRef.set(
    {
      status,
      providerReference: providerReference || null,
      failureReason: failureReason || null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    },
    { merge: true }
  );

  if (status === 'succeeded') {
    const startsAt = new Date();
    const endsAt = addOneMonth(startsAt);

    await db.collection(USERS_COLLECTION).doc(intent.userId).set(
      {
        subscriptionStatus: 'active',
        subscriptionPlanId: intent.planId,
        subscriptionPlanName: intent.planName,
        subscriptionAmountMonthly: intent.amount,
        subscriptionCurrency: intent.currency,
        subscriptionStartsAt: toTimestamp(startsAt),
        subscriptionEndsAt: toTimestamp(endsAt),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    await logAnalyticsEvent({
      userId: intent.userId,
      eventType: 'payment_success',
      source: 'payment_webhook',
      planId: intent.planId,
      value: intent.amount,
      currency: intent.currency,
      metadata: {
        provider: intent.provider,
      },
    });
  }

  if (status === 'failed') {
    await logAnalyticsEvent({
      userId: intent.userId,
      eventType: 'payment_failed',
      source: 'payment_webhook',
      planId: intent.planId,
      value: intent.amount,
      currency: intent.currency,
      metadata: {
        provider: intent.provider,
        reason: failureReason || 'unknown',
      },
    });
  }

  res.status(200).json({ ok: true });
});

exports.expireSubscriptionsDaily = onSchedule(
  { schedule: 'every day 01:00', timeZone: 'UTC', region: 'us-central1' },
  async () => {
    const now = admin.firestore.Timestamp.now();
    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where('subscriptionStatus', '==', 'active')
      .where('subscriptionEndsAt', '<=', now)
      .limit(1000)
      .get();

    if (snapshot.empty) {
      logger.info('No subscriptions to expire.');
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((entry) => {
      batch.set(
        entry.ref,
        {
          subscriptionStatus: 'expired',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });
    await batch.commit();
    logger.info(`Expired ${snapshot.size} subscription(s).`);
  }
);

exports.syncOffersBySchedule = onSchedule(
  { schedule: 'every 30 minutes', timeZone: 'UTC', region: 'us-central1' },
  async () => {
    const now = admin.firestore.Timestamp.now();

    const activateSnapshot = await db
      .collection(OFFERS_COLLECTION)
      .where('isActive', '==', false)
      .where('startsAt', '<=', now)
      .limit(500)
      .get();

    const deactivateSnapshot = await db
      .collection(OFFERS_COLLECTION)
      .where('isActive', '==', true)
      .where('endsAt', '<=', now)
      .limit(500)
      .get();

    const batch = db.batch();

    activateSnapshot.docs.forEach((entry) => {
      const data = entry.data();
      const endAt = data.endsAt;
      if (endAt && endAt.toDate() <= new Date()) {
        return;
      }
      batch.set(
        entry.ref,
        {
          isActive: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    deactivateSnapshot.docs.forEach((entry) => {
      batch.set(
        entry.ref,
        {
          isActive: false,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    if (!activateSnapshot.empty || !deactivateSnapshot.empty) {
      await batch.commit();
    }

    logger.info(`Offers activated: ${activateSnapshot.size}, deactivated: ${deactivateSnapshot.size}`);
  }
);

exports.createRenewalTasksDaily = onSchedule(
  { schedule: 'every day 08:00', timeZone: 'UTC', region: 'us-central1' },
  async () => {
    const now = new Date();
    const threshold = new Date(now);
    threshold.setDate(threshold.getDate() + 3);

    const snapshot = await db
      .collection(USERS_COLLECTION)
      .where('subscriptionStatus', '==', 'active')
      .where('subscriptionEndsAt', '<=', toTimestamp(threshold))
      .limit(1000)
      .get();

    if (snapshot.empty) {
      logger.info('No renewal reminders required.');
      return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((entry) => {
      const data = entry.data();
      const endAt = data.subscriptionEndsAt;
      if (!endAt) return;
      const dueDateId = getDateId(endAt.toDate());
      const notificationRef = db.collection(NOTIFICATIONS_COLLECTION).doc(`${entry.id}_${dueDateId}`);
      batch.set(
        notificationRef,
        {
          userId: entry.id,
          type: 'subscription_renewal',
          status: 'pending',
          title: 'Subscription Renewal Reminder',
          message: 'Your subscription is nearing expiry. Renew to avoid interruptions.',
          dueAt: endAt,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    });

    await batch.commit();
    logger.info(`Created/updated ${snapshot.size} renewal task(s).`);
  }
);

exports.aggregateFunnelDaily = onSchedule(
  { schedule: 'every day 00:30', timeZone: 'UTC', region: 'us-central1' },
  async () => {
    const now = new Date();
    const dayStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1, 0, 0, 0));
    const dayEnd = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0));
    const dateId = getDateId(dayStart);

    const snapshot = await db
      .collection(ANALYTICS_EVENTS_COLLECTION)
      .where('createdAt', '>=', toTimestamp(dayStart))
      .where('createdAt', '<', toTimestamp(dayEnd))
      .limit(10000)
      .get();

    const counts = {
      subscription_screen_view: 0,
      plan_selected: 0,
      checkout_started: 0,
      checkout_redirected: 0,
      payment_success: 0,
      payment_failed: 0,
      offer_impression: 0,
      offer_click: 0,
    };

    snapshot.docs.forEach((entry) => {
      const eventType = entry.data().eventType;
      if (Object.prototype.hasOwnProperty.call(counts, eventType)) {
        counts[eventType] += 1;
      }
    });

    const safeRate = (num, den) => (den > 0 ? num / den : 0);

    await db.collection(ANALYTICS_DAILY_COLLECTION).doc(dateId).set(
      {
        date: dateId,
        counts,
        rates: {
          viewToPlan: safeRate(counts.plan_selected, counts.subscription_screen_view),
          planToCheckout: safeRate(counts.checkout_started, counts.plan_selected),
          checkoutToSuccess: safeRate(counts.payment_success, counts.checkout_started),
          offerClickThrough: safeRate(counts.offer_click, counts.offer_impression),
        },
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );

    logger.info(`Aggregated daily funnel for ${dateId}. Events: ${snapshot.size}`);
  }
);

exports.seedDefaultPlans = onRequest({ region: 'us-central1' }, async (req, res) => {
  if (withCors(req, res)) return;
  if (req.method !== 'POST') {
    res.status(405).json({ message: 'Method not allowed.' });
    return;
  }

  const authUser = await verifyAuth(req);
  if (!authUser || authUser.admin !== true) {
    res.status(403).json({ message: 'Admin access required.' });
    return;
  }

  const defaults = [
    {
      id: 'starter',
      name: 'Starter',
      description: 'For solo merchants starting digital billing.',
      monthlyPrice: 199,
      currency: 'INR',
      isActive: true,
      displayOrder: 1,
      features: ['Up to 300 bills / month', 'Basic reports', 'Email support'],
    },
    {
      id: 'growth',
      name: 'Growth',
      description: 'For growing stores with regular billing volume.',
      monthlyPrice: 499,
      currency: 'INR',
      isActive: true,
      displayOrder: 2,
      features: ['Up to 2,000 bills / month', 'Advanced reports', 'Priority support'],
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'For high-volume businesses and teams.',
      monthlyPrice: 999,
      currency: 'INR',
      isActive: true,
      displayOrder: 3,
      features: ['Unlimited bills', 'Team access controls', 'Faster export + sharing'],
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'For multi-location operations needing premium support.',
      monthlyPrice: 1999,
      currency: 'INR',
      isActive: true,
      displayOrder: 4,
      features: ['Multi-store support', 'Dedicated support', 'Custom onboarding'],
    },
  ];

  const batch = db.batch();
  defaults.forEach((plan) => {
    const ref = db.collection(PLANS_COLLECTION).doc(plan.id);
    batch.set(
      ref,
      {
        ...plan,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      },
      { merge: true }
    );
  });
  await batch.commit();

  res.status(200).json({ ok: true, count: defaults.length });
});
