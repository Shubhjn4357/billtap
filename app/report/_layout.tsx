import { Slot, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { useOrganizationAccess } from '../../src/hooks/useOrganizationAccess';
import { useUiFeedbackStore } from '../../src/store';

export default function ReportRoutesLayout() {
    const router = useRouter();
    const { canViewReports } = useOrganizationAccess();

    useEffect(() => {
        if (canViewReports) return;
        useUiFeedbackStore.getState().showToast('This module is disabled in organization settings.');
        router.replace('/(main)/(tabs)/home');
    }, [canViewReports, router]);

    if (!canViewReports) {
        return null;
    }

    return <Slot />;
}
