type IconName = string;

export const BILLING_TAB_OPTIONS = [
    { key: 'sales', label: 'Sales', queryType: 'TAX_INVOICE', icon: 'file-document-outline' },
    { key: 'purchases', label: 'Purchases', queryType: 'PURCHASE_BILL', icon: 'cart-outline' },
    { key: 'orders', label: 'Orders', queryType: 'ESTIMATE', icon: 'clipboard-outline' },
] as const;

export const BILLING_CREATE_OPTIONS = [
    { label: 'Sale Invoice', route: '/(main)/billing/create?type=TAX_INVOICE', icon: 'file-document-plus-outline' as IconName },
    { label: 'Quick Sale (POS)', route: '/(main)/billing/pos', icon: 'point-of-sale' as IconName },
    { label: 'Purchase Bill', route: '/(main)/billing/purchase-bill', icon: 'cart-plus' as IconName },
    { label: 'Sale Return', route: '/(main)/billing/sale-return', icon: 'undo-variant' as IconName },
    { label: 'Purchase Return', route: '/(main)/billing/purchase-return', icon: 'redo-variant' as IconName },
    { label: 'Estimate', route: '/(main)/billing/estimate', icon: 'file-document-edit-outline' as IconName },
    { label: 'Sale Order', route: '/(main)/billing/sale-order', icon: 'clipboard-text-outline' as IconName },
    { label: 'Purchase Order', route: '/(main)/billing/purchase-order', icon: 'clipboard-list-outline' as IconName },
    { label: 'Delivery Challan', route: '/(main)/billing/delivery-challan', icon: 'truck-delivery-outline' as IconName },
    { label: 'Payment In', route: '/(main)/billing/payment-in', icon: 'cash-plus' as IconName },
    { label: 'Payment Out', route: '/(main)/billing/payment-out', icon: 'cash-minus' as IconName },
] as const;

export const BILLING_DATE_FILTER_OPTIONS = [
    { key: 'all', label: 'All Time' },
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This Week' },
    { key: 'month', label: 'This Month' },
] as const;

export const BILLING_STATUS_FILTER_OPTIONS = [
    { key: 'all', label: 'All' },
    { key: 'paid', label: 'Paid' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'credit', label: 'Credit' },
] as const;
