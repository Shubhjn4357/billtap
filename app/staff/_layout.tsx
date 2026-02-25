import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useOrganizationAccess } from '../../src/hooks/useOrganizationAccess';
import { useUiFeedbackStore } from '../../src/store';

export default function StaffRoutesLayout() {
    const router = useRouter();
    const { canManageStaff } = useOrganizationAccess();

    useEffect(() => {
        if (canManageStaff) return;
        useUiFeedbackStore.getState().showToast('This module is disabled in organization settings.');
        router.replace('/(main)/(tabs)/home');
    }, [canManageStaff, router]);

    if (!canManageStaff) {
        return null;
    }

    return <Slot />;
}
