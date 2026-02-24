import { API_CONFIG } from '../constants/Api';
import { Config } from '../constants/Config';
import { apiClient } from './httpClient';

export type MediaAssetType =
    | 'PRODUCT_IMAGE'
    | 'PROFILE_IMAGE'
    | 'BILL_ATTACHMENT'
    | 'SIGNATURE'
    | 'OTHER';

export interface CreateUploadUrlPayload {
    fileName: string;
    fileType: string;
    assetType: MediaAssetType;
    entityType?: string;
    entityId?: string;
}

export interface CreateUploadUrlResponse {
    uploadUrl: string;
    fileUrl: string;
    key: string;
    expiresAt: number;
    maxUploadBytes: number;
}

interface UploadBinaryResponse {
    ok: boolean;
    id?: string;
    key?: string;
    fileUrl?: string;
    sizeBytes?: number;
    mimeType?: string;
    message?: string;
}

const withOrgQuery = (path: string, organizationId?: string): string => {
    if (!organizationId) return path;
    const separator = path.includes('?') ? '&' : '?';
    return `${path}${separator}organizationId=${encodeURIComponent(organizationId)}`;
};

const toAbsoluteUploadUrl = (uploadUrl: string): string => {
    if (/^https?:\/\//i.test(uploadUrl)) return uploadUrl;
    return new URL(uploadUrl, `${API_CONFIG.baseUrl}/`).toString();
};

const toBlobFromUri = async (uri: string): Promise<Blob> => {
    const response = await fetch(uri);
    if (!response.ok) {
        throw new Error('Unable to read file for upload.');
    }
    return await response.blob();
};

export const mediaService = {
    async createUploadUrl(payload: CreateUploadUrlPayload, organizationId?: string): Promise<CreateUploadUrlResponse> {
        if (!Config.features.imageUploadsEnabled) {
            throw new Error('Image upload is temporarily disabled.');
        }

        const response = await apiClient.post<{
            ok: boolean;
            uploadUrl?: string;
            fileUrl?: string;
            key?: string;
            expiresAt?: number;
            maxUploadBytes?: number;
            message?: string;
        }>(withOrgQuery('/media/upload-url', organizationId), payload);

        if (!response.ok || !response.uploadUrl || !response.fileUrl || !response.key || !response.expiresAt) {
            throw new Error(response.message || 'Failed to prepare upload URL.');
        }

        return {
            uploadUrl: response.uploadUrl,
            fileUrl: response.fileUrl,
            key: response.key,
            expiresAt: response.expiresAt,
            maxUploadBytes: response.maxUploadBytes ?? 10 * 1024 * 1024,
        };
    },

    async uploadBinary(uploadUrl: string, fileType: string, body: Blob | ArrayBuffer): Promise<UploadBinaryResponse> {
        const response = await fetch(toAbsoluteUploadUrl(uploadUrl), {
            method: 'PUT',
            headers: {
                'Content-Type': fileType,
            },
            body,
        });

        const text = await response.text();
        let parsed: UploadBinaryResponse | null = null;
        try {
            parsed = JSON.parse(text) as UploadBinaryResponse;
        } catch {
            parsed = null;
        }

        if (!response.ok || !parsed?.ok) {
            throw new Error(parsed?.message || `Upload failed (${response.status}).`);
        }

        return parsed;
    },

    async uploadFromUri(params: {
        uri: string;
        fileName: string;
        fileType: string;
        assetType: MediaAssetType;
        entityType?: string;
        entityId?: string;
        organizationId?: string;
    }): Promise<{ id?: string; fileUrl: string; key: string }> {
        const upload = await this.createUploadUrl({
            fileName: params.fileName,
            fileType: params.fileType,
            assetType: params.assetType,
            entityType: params.entityType,
            entityId: params.entityId,
        }, params.organizationId);

        const blob = await toBlobFromUri(params.uri);
        const result = await this.uploadBinary(upload.uploadUrl, params.fileType, blob);
        return {
            id: result.id,
            fileUrl: result.fileUrl || upload.fileUrl,
            key: result.key || upload.key,
        };
    },

    async uploadFromDataUrl(params: {
        dataUrl: string;
        fileName: string;
        fileType: string;
        assetType: MediaAssetType;
        entityType?: string;
        entityId?: string;
        organizationId?: string;
    }): Promise<{ id?: string; fileUrl: string; key: string }> {
        const upload = await this.createUploadUrl({
            fileName: params.fileName,
            fileType: params.fileType,
            assetType: params.assetType,
            entityType: params.entityType,
            entityId: params.entityId,
        }, params.organizationId);

        const blob = await toBlobFromUri(params.dataUrl);
        const result = await this.uploadBinary(upload.uploadUrl, params.fileType, blob);
        return {
            id: result.id,
            fileUrl: result.fileUrl || upload.fileUrl,
            key: result.key || upload.key,
        };
    },
};
