import { useState, useEffect } from 'react';
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useRouter } from 'expo-router';
import { useStock } from '../../../hooks/useStock';
import { useOrganizationStore } from '../../../store';
import { mediaService } from '../../../api/mediaService';
import { itemSchema } from '../../../validation/forms';
import { COMMON_TEXT, STOCK_TEXT } from '../../../constants/staticText';
import { useAppDialog } from '../../../components/providers/DialogProvider';
import { Config } from '../../../constants/Config';

export function useItemForm(itemId: string | undefined, isNew: boolean, scannedBarcode?: string) {
    const { addItem, updateItem, deleteItem, allItems, loading } = useStock();
    const { selectedOrganizationId } = useOrganizationStore();
    const { alert, show } = useAppDialog();
    const router = useRouter();
    const imageUploadsEnabled = Config.features.imageUploadsEnabled;

    const [uploadingImage, setUploadingImage] = useState(false);

    const [form, setForm] = useState({
        name: '',
        category: '',
        subcategory: '',
        price: '',
        purchasePrice: '',
        mrp: '',
        hsn: '',
        gstPercentage: 0,
        stock: '',
        minimumStock: '',
        unit: 'pcs',
        location: '',
        barcode: '',
        imageUrl: '',
    });

    useEffect(() => {
        if (!isNew && itemId) {
            const item = allItems.find(i => i.id === itemId);
            if (item) {
                setForm({
                    name: item.name,
                    category: item.category || '',
                    subcategory: item.subcategory || '',
                    price: item.price.toString(),
                    purchasePrice: item.purchasePrice?.toString() || '',
                    mrp: item.mrp?.toString() || '',
                    hsn: item.hsn || '',
                    gstPercentage: item.gstPercentage || 0,
                    stock: item.stock.toString(),
                    minimumStock: item.minimumStock?.toString() || '',
                    unit: item.unit || 'pcs',
                    location: item.location || '',
                    barcode: item.barcode || '',
                    imageUrl: item.imageUrl || '',
                });
            }
        }
    }, [itemId, isNew, allItems]);

    useEffect(() => {
        if (scannedBarcode) {
            setForm(prev => ({ ...prev, barcode: scannedBarcode }));
        }
    }, [scannedBarcode]);

    const handlePickAndUploadImage = async () => {
        if (!imageUploadsEnabled) {
            alert(COMMON_TEXT.alerts.error, 'Image upload is temporarily disabled.');
            return;
        }

        try {
            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                alert(COMMON_TEXT.alerts.error, 'Media library permission is required.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                quality: 1,
            });
            if (result.canceled || result.assets.length === 0) return;

            const source = result.assets[0];
            const optimized = await ImageManipulator.manipulateAsync(
                source.uri,
                [{ resize: { width: 800 } }],
                { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
            );

            setUploadingImage(true);
            const uploaded = await mediaService.uploadFromUri({
                uri: optimized.uri,
                fileName: source.fileName || `item-${Date.now()}.jpg`,
                fileType: 'image/jpeg',
                assetType: 'PRODUCT_IMAGE',
                entityType: 'item',
                entityId: isNew ? undefined : itemId,
                organizationId: selectedOrganizationId ?? undefined,
            });

            setForm((prev) => ({ ...prev, imageUrl: uploaded.fileUrl }));
        } catch (error: unknown) {
            alert(
                COMMON_TEXT.alerts.error,
                error instanceof Error ? error.message : 'Failed to upload product image.'
            );
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSubmit = async () => {
        if (!form.name || !form.price || !form.stock) {
            return alert(COMMON_TEXT.alerts.error, STOCK_TEXT.itemDetail.alerts.fillRequired);
        }

        const parsedPrice = Number(form.price);
        const parsedStock = Number(form.stock);

        if (Number.isNaN(parsedPrice) || parsedPrice < 0) {
            return alert(COMMON_TEXT.alerts.error, STOCK_TEXT.itemDetail.alerts.invalidPrice);
        }
        if (!Number.isInteger(parsedStock) || parsedStock < 0) {
            return alert(COMMON_TEXT.alerts.error, STOCK_TEXT.itemDetail.alerts.invalidStock);
        }

        const parsedPurchasePrice = form.purchasePrice ? Number(form.purchasePrice) : undefined;
        const parsedMrp = form.mrp ? Number(form.mrp) : undefined;
        const parsedMinimumStock = form.minimumStock ? Number(form.minimumStock) : undefined;
        const validation = itemSchema.safeParse({
            name: form.name,
            price: parsedPrice,
            stock: parsedStock,
            purchasePrice: parsedPurchasePrice,
            mrp: parsedMrp,
            gstPercentage: form.gstPercentage,
            minimumStock: parsedMinimumStock,
            category: form.category,
            subcategory: form.subcategory,
            unit: form.unit,
            location: form.location,
            hsn: form.hsn,
            barcode: form.barcode,
            imageUrl: form.imageUrl,
        });
        if (!validation.success) {
            return alert(COMMON_TEXT.alerts.error, validation.error.issues[0]?.message || STOCK_TEXT.itemDetail.alerts.saveFailed);
        }
        const values = validation.data;

        const payload = {
            name: values.name.trim(),
            category: values.category?.trim() || undefined,
            subcategory: values.subcategory?.trim() || undefined,
            price: values.price,
            purchasePrice: values.purchasePrice,
            mrp: values.mrp,
            hsn: values.hsn?.trim() || undefined,
            gstPercentage: values.gstPercentage,
            stock: values.stock,
            minimumStock: values.minimumStock,
            unit: values.unit?.trim() || 'pcs',
            location: values.location?.trim() || undefined,
            barcode: values.barcode?.trim() || undefined,
            imageUrl: values.imageUrl?.trim() || undefined,
        };

        try {
            if (isNew) {
                await addItem({ ...payload, openingStock: parsedStock });
                alert(COMMON_TEXT.alerts.success, STOCK_TEXT.itemDetail.alerts.itemAdded);
                router.back();
            } else {
                if (!itemId) throw new Error(STOCK_TEXT.itemDetail.alerts.invalidItemId);
                await updateItem(itemId, payload);
                alert(COMMON_TEXT.alerts.success, STOCK_TEXT.itemDetail.alerts.itemUpdated);
                router.back();
            }
        } catch (error: unknown) {
            alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : STOCK_TEXT.itemDetail.alerts.saveFailed);
        }
    };

    const handleDelete = () => {
        if (isNew || !itemId) return;

        show({
            title: STOCK_TEXT.itemDetail.alerts.deleteTitle,
            message: STOCK_TEXT.itemDetail.alerts.deleteBody,
            actions: [
                { text: COMMON_TEXT.actions.cancel, style: 'cancel' },
                {
                    text: COMMON_TEXT.actions.delete,
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            await deleteItem(itemId);
                            alert(STOCK_TEXT.itemDetail.alerts.deletedTitle, STOCK_TEXT.itemDetail.alerts.deletedBody);
                            router.back();
                        } catch (error: unknown) {
                            alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : STOCK_TEXT.itemDetail.alerts.deleteFailed);
                        }
                    },
                },
            ],
            dismissable: true,
        });
    };

    return {
        form,
        setForm,
        loading,
        uploadingImage,
        handlePickAndUploadImage,
        handleSubmit,
        handleDelete
    };
}
