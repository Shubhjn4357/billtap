# BillTap Cloud Functions

This folder contains server-side scaffolding for:

- secure payment checkout intent creation
- webhook-based subscription activation
- scheduled offer/subscription automation
- daily analytics funnel aggregation

## Deploy

```bash
cd functions
pnpm install
firebase deploy --only functions
```

## Required Runtime Environment (Production)

- `PAYMENT_PROVIDER` (`stripe` or `razorpay`)
- `CHECKOUT_BASE_URL` (provider-hosted checkout/app deep-link endpoint)
- provider-specific API keys/secrets (add in Firebase runtime env/secrets)

## Important TODOs

1. Replace placeholder provider calls in `createSubscriptionCheckout`.
2. Verify webhook signatures in `paymentWebhook`.
3. Lock admin access with custom claims and/or IAM-protected endpoints.
