export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  businessName?: string;
  gstEnabled?: boolean;
  gstNumber?: string;
  address?: string;
  phone?: string;
  currency?: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  description?: string;
  sku?: string;
  barcode?: string;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number;
  stockQuantity: number;
  lowStockThreshold: number;
  category?: string;
  imageUrl?: string;
  createdAt: number; // Timestamp
  updatedAt: number;
  lastSoldAt?: number;
}

export interface CartItem extends InventoryItem {
  quantity: number;
  discount?: number;
  taxRate?: number;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'SALE' | 'PURCHASE' | 'RETURN';
  items: CartItem[];
  totalAmount: number;
  taxAmount: number;
  discountAmount: number;
  paymentMethod: 'CASH' | 'ONLINE' | 'UPI' | 'CREDIT';
  customerName?: string;
  customerPhone?: string;
  createdAt: number;
  invoiceUrl?: string;
}

export interface AppTheme {
  dark: boolean;
  colors: {
    primary: string;
    background: string;
    card: string;
    text: string;
    border: string;
    notification: string;
    glass: string; // Special glass effect color
    surface: string;
    success: string;
    error: string;
    warning: string;
  };
}
