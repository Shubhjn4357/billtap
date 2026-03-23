import { api } from "@/lib/api";

export type BusinessSettingsFieldType = "boolean" | "string" | "integer" | "number" | "enum" | "array_of_VoucherType";

export interface BusinessSettingsFieldDefinition {
    key: string;
    label: string;
    type: BusinessSettingsFieldType;
    default?: boolean | number | string | string[] | null;
    min?: number;
    max?: number;
    allowed?: string[];
    enumValues?: string[];
    nullable?: boolean;
}

export interface BusinessSettingsSchemaPayload {
    businessId: string;
    sections: string[];
    schema: Record<string, BusinessSettingsFieldDefinition[]>;
}

export interface BusinessSettingsStatePayload {
    businessId: string;
    sections: string[];
    data: Record<string, Record<string, unknown>>;
}

export const businessSettingsAdminService = {
    getSchema: async (businessId: string) => {
        const { data } = await api.get<{ ok: boolean } & BusinessSettingsSchemaPayload>(`/admin/businesses/${businessId}/settings/schema`);
        return data;
    },
    getAll: async (businessId: string) => {
        const { data } = await api.get<{ ok: boolean } & BusinessSettingsStatePayload>(`/admin/businesses/${businessId}/settings`);
        return data;
    },
    getSection: async (businessId: string, section: string) => {
        const { data } = await api.get<{ ok: boolean; businessId: string; section: string; data: Record<string, unknown> }>(
            `/admin/businesses/${businessId}/settings/${section}`
        );
        return data;
    },
    updateSection: async (businessId: string, section: string, payload: Record<string, unknown>) => {
        const { data } = await api.put<{ ok: boolean; businessId: string; section: string; data: Record<string, unknown> }>(
            `/admin/businesses/${businessId}/settings/${section}`,
            { data: payload }
        );
        return data;
    },
    resetSection: async (businessId: string, section: string) => {
        const { data } = await api.delete<{ ok: boolean; businessId: string; section: string; data: Record<string, unknown> }>(
            `/admin/businesses/${businessId}/settings/${section}`
        );
        return data;
    },
};
