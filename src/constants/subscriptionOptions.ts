export type MockCheckoutOutcome = 'succeeded' | 'pending' | 'failed';
export type BillingCycleTab = 'MONTHLY' | 'YEARLY' | 'THREE_YEAR';

export const SUBSCRIPTION_MOCK_OUTCOME_OPTIONS: { key: MockCheckoutOutcome; label: string }[] = [
    { key: 'succeeded', label: 'SUCCEEDED' },
    { key: 'pending', label: 'PENDING' },
    { key: 'failed', label: 'FAILED' },
];

export const SUBSCRIPTION_BILLING_CYCLE_OPTIONS: { key: BillingCycleTab; label: string }[] = [
    { key: 'MONTHLY', label: 'MONTHLY' },
    { key: 'YEARLY', label: 'YEARLY' },
    { key: 'THREE_YEAR', label: '3 YEAR' },
];
