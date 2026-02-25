import { Slot, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { useOrganizationAccess } from '../../src/hooks/useOrganizationAccess';
import { useUiFeedbackStore } from '../../src/store';

export default function TransactionRoutesLayout() {
    const router = useRouter();
    const segments = useSegments() as string[];
    const route = segments[1];
    const { canOpenBilling, canCreatePurchase, canCreateSale, canManagePayments } = useOrganizationAccess();
    const canUseBillingModule = canOpenBilling && (canCreateSale || canCreatePurchase);
    const blocked = route === 'settlements' ? !canManagePayments : !canUseBillingModule;

    useEffect(() => {
        if (!blocked) return;
        useUiFeedbackStore.getState().showToast('This module is disabled in organization settings.');
        router.replace('/(main)/(tabs)/home');
    }, [blocked, router]);

    if (blocked) {
        return null;
    }

    return <Slot />;
}
