/**
 * @file subscriptionService.test.ts
 * @description Strict unit tests for subscriptionService — getPlans and createCheckoutSession.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SubscriptionPlan } from '../../types';

import { subscriptionService } from '../subscriptionService';

// ─── Hoisted mock references ────────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
    apiGet: vi.fn(),
    apiPost: vi.fn(),
}));

vi.mock('../httpClient', () => ({
    apiClient: {
        get: mocks.apiGet,
        post: mocks.apiPost,
    },
    ApiError: class ApiError extends Error {
        status: number;
        constructor(message: string, status: number) {
            super(message);
            this.name = 'ApiError';
            this.status = status;
        }
    },
}));

// ─── Test Data ──────────────────────────────────────────────────────────────────

const makePlan = (overrides: Partial<SubscriptionPlan> = {}): SubscriptionPlan => ({
    id: 'plan_001',
    name: 'Starter',
    description: 'Great for small businesses',
    monthlyPrice: 299,
    currency: 'INR',
    isActive: true,
    displayOrder: 1,
    features: ['Unlimited bills', 'GST invoicing'],
    ...overrides,
});

// ─── Tests ──────────────────────────────────────────────────────────────────────

describe('subscriptionService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // ── GET PLANS ───────────────────────────────────────────────────────────────

    describe('getPlans', () => {
        it('returns plans array from API response', async () => {
            mocks.apiGet.mockResolvedValueOnce({
                ok: true,
                plans: [makePlan(), makePlan({ id: 'plan_002', name: 'Pro', monthlyPrice: 999 })],
            });

            const { plans } = await subscriptionService.getPlans();
            expect(plans).toHaveLength(2);
            expect(plans[0].name).toBe('Starter');
            expect(plans[1].name).toBe('Pro');
        });

        it('calls GET /subscription/plans?includeInactive=false', async () => {
            mocks.apiGet.mockResolvedValueOnce({ ok: true, plans: [] });
            await subscriptionService.getPlans();
            expect(mocks.apiGet).toHaveBeenCalledWith('/subscription/plans?includeInactive=false');
        });

        it('returns empty array when server returns no plans field', async () => {
            mocks.apiGet.mockResolvedValueOnce({ ok: true });
            const { plans } = await subscriptionService.getPlans();
            expect(plans).toEqual([]);
        });

        it('throws when server returns ok: false', async () => {
            mocks.apiGet.mockResolvedValueOnce({ ok: false, message: 'Service unavailable' });
            await expect(subscriptionService.getPlans()).rejects.toThrow('Service unavailable');
        });

        it('propagates network errors', async () => {
            mocks.apiGet.mockRejectedValueOnce(new Error('ETIMEDOUT'));
            await expect(subscriptionService.getPlans()).rejects.toThrow('ETIMEDOUT');
        });

        it('plan objects contain all required fields', async () => {
            mocks.apiGet.mockResolvedValueOnce({ ok: true, plans: [makePlan()] });
            const { plans } = await subscriptionService.getPlans();
            const plan = plans[0];

            expect(plan).toHaveProperty('id');
            expect(plan).toHaveProperty('name');
            expect(plan).toHaveProperty('monthlyPrice');
            expect(plan).toHaveProperty('currency');
            expect(plan).toHaveProperty('features');
            expect(Array.isArray(plan.features)).toBe(true);
        });
    });

    // ── CREATE CHECKOUT SESSION ─────────────────────────────────────────────────

    describe('createCheckoutSession', () => {
        it('sends POST /subscription/checkout with correct body', async () => {
            const plan = makePlan();
            mocks.apiPost.mockResolvedValueOnce({
                ok: true,
                intentId: 'intent_abc',
                checkoutUrl: 'https://pay.example.com/checkout/abc',
                provider: 'razorpay',
            });

            await subscriptionService.createCheckoutSession(plan);

            const [url, body] = mocks.apiPost.mock.calls[0] as [string, Record<string, unknown>];
            expect(url).toBe('/subscription/checkout');
            expect(body.planId).toBe('plan_001');
            expect(body.planName).toBe('Starter');
            expect(body.amount).toBe(299);
            expect(body.currency).toBe('INR');
        });

        it('returns checkout URL and provider', async () => {
            mocks.apiPost.mockResolvedValueOnce({
                ok: true,
                checkoutUrl: 'https://pay.razorpay.com/xyz',
                provider: 'razorpay',
                razorpayKeyId: 'rzp_live_abc',
            });

            const result = await subscriptionService.createCheckoutSession(makePlan());
            expect(result.checkoutUrl).toBe('https://pay.razorpay.com/xyz');
            expect(result.provider).toBe('razorpay');
            expect(result.razorpayKeyId).toBe('rzp_live_abc');
        });

        it('returns providerOrderId when present', async () => {
            mocks.apiPost.mockResolvedValueOnce({
                ok: true,
                providerOrderId: 'order_razorpay_123',
                provider: 'razorpay',
            });

            const result = await subscriptionService.createCheckoutSession(makePlan());
            expect(result.providerOrderId).toBe('order_razorpay_123');
        });

        it('throws when server returns ok: false with message', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: false, message: 'Payment gateway unavailable' });
            await expect(subscriptionService.createCheckoutSession(makePlan())).rejects.toThrow(
                'Payment gateway unavailable'
            );
        });

        it('throws default message when ok: false with no message', async () => {
            mocks.apiPost.mockResolvedValueOnce({ ok: false });
            await expect(subscriptionService.createCheckoutSession(makePlan())).rejects.toThrow(
                'Failed to create checkout session.'
            );
        });

        it('propagates network errors', async () => {
            mocks.apiPost.mockRejectedValueOnce(new Error('Connection refused'));
            await expect(subscriptionService.createCheckoutSession(makePlan())).rejects.toThrow('Connection refused');
        });

        it('handles free plan with zero price correctly', async () => {
            const freePlan = makePlan({ id: 'free', monthlyPrice: 0, name: 'Free' });
            mocks.apiPost.mockResolvedValueOnce({ ok: true, intentId: 'free_intent' });

            const result = await subscriptionService.createCheckoutSession(freePlan);

            const [, body] = mocks.apiPost.mock.calls[0] as [string, Record<string, unknown>];
            expect(body.amount).toBe(0);
            expect(result.intentId).toBe('free_intent');
        });
    });
});
