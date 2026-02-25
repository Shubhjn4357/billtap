import { z } from 'zod';
import { isValidUpiId } from '../utils/upi';

export const billNumberSchema = z.string()
    .trim()
    .min(3, 'Bill number must have at least 3 characters.')
    .max(32, 'Bill number must be 32 characters or less.')
    .regex(/^[A-Z0-9][A-Z0-9/_-]*$/i, 'Bill number may only contain letters, numbers, "-", "_" or "/".');

export const customerPhoneSchema = z.string()
    .trim()
    .refine((value) => value.length === 0 || /^[0-9]{7,15}$/.test(value), 'Phone must be 7 to 15 digits.');

export const billingCheckoutSchema = z.object({
    billNumber: billNumberSchema,
    customerName: z.string().trim().max(80, 'Customer name is too long.'),
    customerPhone: customerPhoneSchema,
});

export const profileSchema = z.object({
    displayName: z.string().trim().min(2, 'Display name must have at least 2 characters.').max(80, 'Display name is too long.'),
    email: z.string().trim().max(120, 'Email is too long.').optional().or(z.literal('')).refine(
        (value) => !value || z.string().email().safeParse(value).success,
        'Enter a valid email address.'
    ),
    businessName: z.string().trim().max(120, 'Business name is too long.').optional().or(z.literal('')),
    address: z.string().trim().max(240, 'Address is too long.').optional().or(z.literal('')),
});

export const upiSettingsSchema = z.object({
    upiId: z.string()
        .trim()
        .min(3, 'UPI ID is required.')
        .max(128, 'UPI ID is too long.')
        .refine((value) => isValidUpiId(value), 'Enter a valid UPI ID like `merchant@bank`.'),
    receiverName: z.string().trim().max(80, 'Receiver name is too long.').optional().or(z.literal('')),
});

export const transactionCreditSchema = z.object({
    paidAmount: z.number().min(0, 'Paid amount cannot be negative.'),
    totalAmount: z.number().min(0, 'Total amount must be valid.'),
    reminderFrequencyDays: z.number().int('Reminder frequency must be a whole number.').min(1, 'Reminder frequency must be at least 1 day.').max(90, 'Reminder frequency cannot exceed 90 days.'),
    dueDate: z.date().optional(),
}).refine((value) => value.paidAmount <= value.totalAmount, {
    message: 'Paid amount cannot be greater than bill total.',
    path: ['paidAmount'],
});

const optionalEmail = z.string().trim().optional().or(z.literal('')).refine(
    (value) => !value || z.string().email().safeParse(value).success,
    'Enter a valid email address.'
);

const optionalIndianGst = z.string().trim().optional().or(z.literal('')).refine(
    (value) => !value || /^[0-9A-Z]{15}$/.test(value.toUpperCase()),
    'GSTIN must be 15 alphanumeric characters.'
);

export const businessSetupSchema = z.object({
    businessName: z.string().trim().min(2, 'Business name must have at least 2 characters.').max(120, 'Business name is too long.'),
    address: z.string().trim().max(240, 'Address is too long.').optional().or(z.literal('')),
    gst: optionalIndianGst,
    category: z.string().trim().max(60, 'Category is too long.').optional().or(z.literal('')),
    currency: z.string().trim().length(3, 'Currency must be a 3-letter code.'),
});

const optionalPhoneNumber = z.string().trim().optional().or(z.literal('')).refine(
    (value) => !value || /^\+?[0-9][0-9\s()-]{6,19}$/.test(value),
    'Enter a valid phone number.'
);

export const organizationCreateSchema = z.object({
    name: z.string().trim().min(2, 'Organization name must have at least 2 characters.').max(120, 'Organization name is too long.'),
    code: z.string().trim().min(2, 'Organization code is required.').max(32, 'Organization code is too long.').regex(/^[A-Z0-9_-]+$/i, 'Organization code can only contain letters, numbers, "_" and "-".'),
    currency: z.string().trim().length(3, 'Currency must be a 3-letter code.'),
    phoneNumber: optionalPhoneNumber,
    email: optionalEmail,
    gstNumber: optionalIndianGst,
    address: z.string().trim().max(240, 'Address is too long.').optional().or(z.literal('')),
});

export const staffInviteSchema = z.object({
    phone: z.string().trim().regex(/^\+[0-9]{7,15}$/, 'Enter a valid phone with country code.'),
});

export const partySchema = z.object({
    name: z.string().trim().min(2, 'Name must have at least 2 characters.').max(120, 'Name is too long.'),
    phone: z.string().trim().regex(/^[0-9]{7,15}$/, 'Phone must be 7 to 15 digits.'),
    email: optionalEmail,
    address: z.string().trim().max(240, 'Address is too long.').optional().or(z.literal('')),
    gstNumber: optionalIndianGst,
});

export const itemSchema = z.object({
    name: z.string().trim().min(2, 'Item name must have at least 2 characters.').max(120, 'Item name is too long.'),
    price: z.number().min(0, 'Price cannot be negative.'),
    stock: z.number().int('Stock must be a whole number.').min(0, 'Stock cannot be negative.'),
    purchasePrice: z.number().min(0, 'Purchase price cannot be negative.').optional(),
    mrp: z.number().min(0, 'MRP cannot be negative.').optional(),
    gstPercentage: z.number().min(0, 'GST cannot be negative.').max(100, 'GST cannot exceed 100%.'),
    minimumStock: z.number().int('Minimum stock must be whole number.').min(0, 'Minimum stock cannot be negative.').optional(),
    category: z.string().trim().max(80, 'Category is too long.').optional().or(z.literal('')),
    subcategory: z.string().trim().max(80, 'Subcategory is too long.').optional().or(z.literal('')),
    description: z.string().trim().max(500, 'Description is too long.').optional().or(z.literal('')),
    unit: z.string().trim().max(20, 'Unit is too long.').optional().or(z.literal('')),
    location: z.string().trim().max(120, 'Location is too long.').optional().or(z.literal('')),
    hsn: z.string().trim().max(16, 'HSN code is too long.').optional().or(z.literal('')),
    barcode: z.string().trim().max(64, 'Barcode is too long.').optional().or(z.literal('')),
    imageUrl: z.string().trim().optional().or(z.literal('')).refine(
        (value) => !value || z.string().url().safeParse(value).success,
        'Image URL must be a valid URL.'
    ),
}).refine(
    (value) => value.purchasePrice === undefined || value.mrp === undefined || value.purchasePrice <= value.mrp,
    { message: 'Purchase price should not exceed MRP.', path: ['purchasePrice'] }
);
