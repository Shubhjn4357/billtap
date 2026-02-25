import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useOrganizationAccess } from '../../src/hooks/useOrganizationAccess';
import { useUiFeedbackStore } from '../../src/store';

export default function PartyRoutesLayout() {
    const router = useRouter();
    const { canManageParties } = useOrganizationAccess();

    useEffect(() => {
        if (canManageParties) return;
        useUiFeedbackStore.getState().showToast('This module is disabled in organization settings.');
        router.replace('/(main)/(tabs)/home');
    }, [canManageParties, router]);

    if (!canManageParties) {
        return null;
    }

    return <Slot />;
}
