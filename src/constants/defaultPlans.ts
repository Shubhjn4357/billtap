export interface PlanConfig {
    id: string;
    name: string;
    description: string;
    monthlyPrice: number;
    currency: string;
    features: string[];
    isActive: boolean;
    displayOrder: number;
}

export interface PlanLimitConfig {
    billsPerMonth: number;
    stores: number;
    staff: number;
    premiumTemplates: boolean;
    maxUploadMb: number;
}

export const DEFAULT_PLAN_LIMITS: Record<'free' | 'pro' | 'enterprise', PlanLimitConfig> = {
    free: {
        billsPerMonth: 50,
        stores: 1,
        staff: 1,
        premiumTemplates: false,
        maxUploadMb: 2,
    },
    pro: {
        billsPerMonth: 2000,
        stores: 3,
        staff: 5,
        premiumTemplates: true,
        maxUploadMb: 8,
    },
    enterprise: {
        billsPerMonth: 1000000,
        stores: 25,
        staff: 100,
        premiumTemplates: true,
        maxUploadMb: 25,
    },
};

export const DEFAULT_PLANS: PlanConfig[] = [
    {
        id: 'plan_free',
        name: 'Free',
        description: 'Starter plan for single-store billing and inventory.',
        monthlyPrice: 0,
        currency: 'INR',
        features: [
            '50 bills/month',
            '1 store and 1 staff',
            'Basic inventory and ledger',
            'Standard templates',
            '2 MB max media upload'
        ],
        isActive: true,
        displayOrder: 1,
    },
    {
        id: 'plan_pro',
        name: 'Pro',
        description: 'For growing businesses with staff and multi-store workflows.',
        monthlyPrice: 499,
        currency: 'INR',
        features: [
            '2,000 bills/month',
            'Up to 3 stores and 5 staff',
            'Advanced reports and reminders',
            'Premium templates and signatures',
            '8 MB max media upload',
            'Priority support'
        ],
        isActive: true,
        displayOrder: 2,
    },
    {
        id: 'plan_enterprise',
        name: 'Enterprise',
        description: 'Scale plan for large teams, branches, and high-volume operations.',
        monthlyPrice: 999,
        currency: 'INR',
        features: [
            'Everything in Pro',
            '25 stores and 100 staff',
            'High-volume billing limits',
            'Custom templates and controls',
            '25 MB max media upload'
        ],
        isActive: true,
        displayOrder: 3,
    }
];
