import type { DbItem, DbParty } from '../types/db';
import type { Item, Party, PartyType } from '../types';

export const mapDbItemToAppItem = (dbItem: DbItem): Item => {
    return {
        ...dbItem,
        imageUrl: dbItem.image ?? undefined,
        userId: dbItem.organizationId, // Mapping Org ID to User ID for compatibility

        // Handle nullable numbers vs undefined/0
        purchasePrice: dbItem.purchasePrice === null ? undefined : dbItem.purchasePrice,
        mrp: dbItem.mrp === null ? undefined : dbItem.mrp,
        hsn: dbItem.hsn === null ? undefined : dbItem.hsn,
        gstPercentage: dbItem.gstPercentage === null ? undefined : dbItem.gstPercentage,
        minimumStock: dbItem.minimumStock === null ? undefined : dbItem.minimumStock,
        category: dbItem.category === null ? undefined : dbItem.category,
        barcode: dbItem.barcode === null ? undefined : dbItem.barcode,

        // Handle unit (string | null -> string | undefined)
        unit: dbItem.unit === null ? undefined : dbItem.unit,

        stock: dbItem.stock ?? 0,
        price: dbItem.price,
        name: dbItem.name,
        nameLowercase: dbItem.nameLowercase,
        updatedAt: dbItem.updatedAt || new Date().toISOString(),
        isActive: dbItem.isActive ?? true,
        createdAt: dbItem.createdAt || undefined,
    };
};

export const mapDbPartyToAppParty = (dbParty: DbParty): Party => {
    return {
        ...dbParty,
        userId: dbParty.organizationId ?? '', // Mapping Org ID
        email: dbParty.email ?? undefined,
        phone: dbParty.phone ?? undefined,
        address: dbParty.address ?? undefined,
        gstNumber: dbParty.gstNumber ?? undefined,
        isActive: dbParty.isActive ?? true,
        type: dbParty.type as PartyType,
        createdAt: dbParty.createdAt || undefined,
        updatedAt: dbParty.updatedAt || undefined,
    };
};
