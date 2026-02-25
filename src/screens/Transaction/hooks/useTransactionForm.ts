import { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuth } from '../../../hooks/useAuth';
import { useAppDialog } from '../../../components/providers/DialogProvider';
import { useOrganizationStore, usePartyStore, useSettingsStore } from '../../../store';
import { COMMON_TEXT } from '../../../constants/staticText';
import { billRepository } from '../../../repositories/billRepository';
import { taskNotificationService } from '../../../services/taskNotificationService';
import { shareViaWhatsApp, shareViaSMS } from '../../../utils/shareIntent';
import { formatCurrency, normalizeCurrencyCode } from '../../../utils/formatters';
import { randomUUID } from 'expo-crypto';
import type { Party, TransactionItem, Item } from '../../../types';
import type { NewDbTransaction } from '../../../types/db';

export function useTransactionForm(transactionId?: string) {
    const router = useRouter();
    const { user } = useAuth();
    const selectedOrganizationId = useOrganizationStore((state) => state.selectedOrganizationId);
    const organizationId = selectedOrganizationId ?? user?.uid ?? null;
    const { currencySymbol } = useSettingsStore();
    const { parties } = usePartyStore();
    const activeCurrency = normalizeCurrencyCode(user?.currency ?? currencySymbol ?? 'INR');
    const dialog = useAppDialog();

    const isEditMode = !!transactionId;

    // Delivery Address State
    const [sameAsBilling, setSameAsBilling] = useState(true);
    const [deliveryAddress, setDeliveryAddress] = useState('');
    const [deliveryContactName, setDeliveryContactName] = useState('');
    const [deliveryContactPhone, setDeliveryContactPhone] = useState('');

    // Primary State
    const [type, setType] = useState<'SALE' | 'PURCHASE'>('SALE');
    const [billNo, setBillNo] = useState('');
    const [billDate, setBillDate] = useState(new Date());
    const [remarks, setRemarks] = useState('');
    const [paymentMode, setPaymentMode] = useState<'CASH' | 'CREDIT'>('CASH');
    const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
    const [items, setItems] = useState<TransactionItem[]>([]);
    const [selectedParty, setSelectedParty] = useState<Party | null>(null);
    const [paidAmountInput, setPaidAmountInput] = useState('');
    const [reminderEnabled, setReminderEnabled] = useState(false);
    const [reminderFrequencyDays, setReminderFrequencyDays] = useState('3');

    // Computed
    const totals = useMemo(() => {
        const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
        const taxAmount = items.reduce((sum, item) => sum + (item.price * item.quantity * (item.tax || 0)) / 100, 0);
        return {
            subtotal,
            taxAmount,
            total: subtotal + taxAmount,
        };
    }, [items]);

    const totalAmountForSaveAndShare = totals.subtotal + totals.taxAmount;

    // Load Existing
    useEffect(() => {
        if (!transactionId) return;

        let isMounted = true;
        const loadTransaction = async () => {
            try {
                const transaction = await billRepository.getById(transactionId);
                if (!transaction) {
                    dialog.alert(COMMON_TEXT.alerts.error, 'Transaction not found');
                    router.back();
                    return;
                }

                if (!isMounted) return;

                setType(transaction.type as 'SALE' | 'PURCHASE');
                setBillNo(transaction.billNumber || '');
                setBillDate(new Date(transaction.billDate));
                setRemarks(transaction.remark || '');
                setPaymentMode(transaction.paymentMode as 'CASH' | 'CREDIT');

                if (transaction.deliveryAddress) {
                    setSameAsBilling(false);
                    setDeliveryAddress(transaction.deliveryAddress);
                    setDeliveryContactName(transaction.deliveryContactName || '');
                    setDeliveryContactPhone(transaction.deliveryContactPhone || '');
                } else {
                    setSameAsBilling(true);
                    setDeliveryContactName('');
                    setDeliveryContactPhone('');
                }

                if (transaction.dueDate) {
                    setDueDate(new Date(transaction.dueDate));
                }

                // Parse items
                try {
                    const parsedItems = transaction.itemsSnapshot ? JSON.parse(transaction.itemsSnapshot) : [];
                    setItems(parsedItems);
                } catch (e) {
                    console.error('Failed to parse items', e);
                }

                // Set party
                if (transaction.partyId) {
                    const party = parties.find(p => p.id === transaction.partyId);
                    if (party) setSelectedParty(party);
                    else setSelectedParty({ id: transaction.partyId, name: transaction.partyName } as Party);
                }

                if (transaction.paymentMode === 'CREDIT') {
                    setPaidAmountInput((transaction.paidAmount || 0).toString());
                }
            } catch (error) {
                console.error('Failed to load transaction', error);
                if (isMounted) dialog.alert(COMMON_TEXT.alerts.error, 'Failed to load transaction details');
            }
        };

        loadTransaction();
        return () => { isMounted = false; };
    }, [transactionId, parties, dialog, router]);

    // Actions
    const handleSave = async () => {
        if (!selectedParty) {
            dialog.alert(COMMON_TEXT.alerts.error, 'Please select a party.');
            return;
        }
        if (items.length === 0) {
            dialog.alert(COMMON_TEXT.alerts.error, 'Please add at least one item.');
            return;
        }
        if (!user || !organizationId) {
            dialog.alert(COMMON_TEXT.alerts.error, 'You must be logged in.');
            return;
        }

        const normalizedBillNo = billNo.trim().toUpperCase();
        if (!normalizedBillNo) {
            dialog.alert(COMMON_TEXT.alerts.validation, 'Bill number is required.');
            return;
        }

        if (!isEditMode) {
            const isAvailable = await billRepository.checkBillNumberAvailability(normalizedBillNo, organizationId);
            if (!isAvailable) {
                dialog.alert(COMMON_TEXT.alerts.validation, `Bill number "${normalizedBillNo}" already exists.`);
                return;
            }
        }

        const paidAmount = paymentMode === 'CREDIT'
            ? Number(paidAmountInput || 0)
            : totalAmountForSaveAndShare;

        const dbPayload: NewDbTransaction = {
            id: transactionId || randomUUID(),
            organizationId,
            type,
            partyId: selectedParty.id,
            partyName: selectedParty.name,
            partyPhone: selectedParty.phone || null,
            billNumber: normalizedBillNo,
            billDate: billDate.toISOString(),
            businessName: user?.businessName?.trim() || user?.displayName?.trim() || null,
            businessAddress: user?.address?.trim() || null,
            gstNumber: user?.gstNumber?.trim() || null,
            itemsSnapshot: JSON.stringify(items),
            totalAmount: totalAmountForSaveAndShare,
            discountAmount: 0,
            taxAmount: totals.taxAmount,
            paidAmount,
            paymentMode,
            paymentStatus: paidAmount >= totalAmountForSaveAndShare ? 'PAID' : (paidAmount > 0 ? 'PARTIAL' : 'PENDING'),
            dueDate: dueDate ? dueDate.toISOString() : null,
            remark: remarks || null,
            deliveryAddress: sameAsBilling ? null : deliveryAddress,
            deliveryContactName: sameAsBilling ? null : deliveryContactName,
            deliveryContactPhone: sameAsBilling ? null : deliveryContactPhone,
            currency: activeCurrency,
            createdAt: isEditMode ? (await billRepository.getById(transactionId!))?.createdAt || new Date().toISOString() : new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        try {
            if (isEditMode) {
                await billRepository.update(transactionId!, dbPayload);
            } else {
                await billRepository.create(dbPayload);
            }

            await taskNotificationService.notify('Transaction Saved', `${type} transaction ${normalizedBillNo} saved successfully.`);

            if (!isEditMode) {
                router.replace({ pathname: '/bill-success', params: { id: dbPayload.id } });
            } else {
                dialog.alert(COMMON_TEXT.alerts.success, 'Transaction saved successfully.');
                router.back();
            }
        } catch (error: unknown) {
            dialog.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to save transaction.');
        }
    };

    const handleDelete = () => {
        if (!transactionId) return;
        dialog.confirm('Delete Transaction', 'Are you sure you want to delete this transaction? This action cannot be undone.', async () => {
            try {
                await billRepository.delete(transactionId);
                router.back();
            } catch (e: unknown) {
                dialog.alert('Error', e instanceof Error ? e.message : 'Failed to delete transaction');
            }
        });
    };

    const handleShareReminder = async (platform: 'whatsapp' | 'sms') => {
        const phoneToUse = deliveryContactPhone || (selectedParty?.phone ?? null);

        if (!phoneToUse) {
            dialog.alert('No Phone Number', 'Please select a party with a phone number or enter a delivery contact phone first.');
            return;
        }

        const dueAmount = Math.max(totalAmountForSaveAndShare - Number(paidAmountInput || 0), 0);
        if (dueAmount <= 0) {
            dialog.alert('No Due Amount', 'This transaction is fully paid.');
            return;
        }

        const billName = user?.businessName || 'Us';
        const message = `Hello${selectedParty?.name ? ` ${selectedParty.name}` : ''},\n\nThis is a friendly reminder from ${billName} regarding your bill (${billNo}).\n\nTotal Amount: ${formatCurrency(totalAmountForSaveAndShare, activeCurrency)}\nDue Amount: ${formatCurrency(dueAmount, activeCurrency)}\n\nPlease pay at your earliest convenience.\nThank you!`;

        try {
            if (platform === 'whatsapp') {
                await shareViaWhatsApp(phoneToUse, message);
            } else {
                await shareViaSMS(phoneToUse, message);
            }
        } catch (error: unknown) {
            dialog.alert('Error', error instanceof Error ? error.message : `Failed to open ${platform}`);
        }
    };

    // Item Helpers
    const handleAddItem = (item: Item) => {
        const existingItemIndex = items.findIndex((i) => i.id === item.id);
        if (existingItemIndex >= 0) {
            const newItems = [...items];
            newItems[existingItemIndex].quantity += 1;
            setItems(newItems);
        } else {
            setItems([...items, {
                id: item.id,
                name: item.name,
                quantity: 1,
                price: item.price,
                tax: item.gstPercentage || 0,
                total: item.price
            }]);
        }
    };

    const updateItemQuantity = (index: number, quantityStr: string) => {
        const newItems = [...items];
        const quantity = parseInt(quantityStr) || 0;
        if (quantity <= 0) {
            newItems.splice(index, 1);
        } else {
            newItems[index].quantity = quantity;
        }
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    return {
        state: {
            isEditMode,
            sameAsBilling,
            deliveryAddress,
            deliveryContactName,
            deliveryContactPhone,
            type,
            billNo,
            billDate,
            remarks,
            paymentMode,
            dueDate,
            items,
            selectedParty,
            paidAmountInput,
            reminderEnabled,
            reminderFrequencyDays,
            totals: { ...totals, total: totalAmountForSaveAndShare },
            activeCurrency,
        },
        setters: {
            setSameAsBilling,
            setDeliveryAddress,
            setDeliveryContactName,
            setDeliveryContactPhone,
            setType,
            setBillNo,
            setBillDate,
            setRemarks,
            setPaymentMode,
            setDueDate,
            setSelectedParty,
            setPaidAmountInput,
            setReminderEnabled,
            setReminderFrequencyDays,
            setItems,
        },
        actions: {
            handleSave,
            handleDelete,
            handleShareReminder,
            handleAddItem,
            updateItemQuantity,
            removeItem,
        }
    };
}
