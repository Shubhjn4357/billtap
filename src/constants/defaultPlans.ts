import { nanoid } from 'nanoid';

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

export const DEFAULT_PLANS: PlanConfig[] = [
    {
        id: 'plan_free',
        name: 'Free',
        description: 'Perfect for small businesses just starting out.',
        monthlyPrice: 0,
        currency: 'INR',
        features: [
            'Unlimited Bills (Watermarked)',
            'Basic Inventory (Up to 50 items)',
            'Customer Management',
            'Basic Reports'
        ],
        isActive: true,
        displayOrder: 1,
    },
    {
        id: 'plan_pro',
        name: 'Pro',
        description: 'For growing businesses needing more power.',
        monthlyPrice: 299,
        currency: 'INR',
        features: [
            'Unlimited Bills (No Watermark)',
            'Unlimited Inventory',
            'Expense Tracking',
            'Staff Management (Up to 3)',
            'Advanced Reports',
            'Priority Support'
        ],
        isActive: true,
        displayOrder: 2,
    },
    {
        id: 'plan_enterprise',
        name: 'Enterprise',
        description: 'Complete solution for established businesses.',
        monthlyPrice: 999,
        currency: 'INR',
        features: [
            'Everything in Pro',
            'Unlimited Staff',
            'Multi-Device Sync (Real-time)',
            'Dedicated Account Manager',
            'Custom Invoicing Templates'
        ],
        isActive: true,
        displayOrder: 3,
    }
];
