import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, Text, useTheme } from 'react-native-paper';

import { businessSuiteService, OrganizationMembership } from '../../api/businessSuiteService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppPullToRefresh } from '../../components/common/AppPullToRefresh';
import { AppSkeleton } from '../../components/common/AppSkeleton';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { DesignSystem } from '../../constants/DesignSystem';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useOrganizationStore } from '../../store';

export const OrganizationSelectScreen: React.FC = () => {
    const theme = useTheme();
    const router = useRouter();
    const dialog = useAppDialog();
    const { refreshOrganizationContext, isOwner } = useOrganizationAccess();
    const selectedOrganizationId = useOrganizationStore((state) => state.selectedOrganizationId);

    const [loading, setLoading] = useState(true);
    const [organizations, setOrganizations] = useState<OrganizationMembership[]>([]);
    const [switchingId, setSwitchingId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const uniqueOrganizations = useMemo(() => {
        const map = new Map<string, OrganizationMembership>();
        organizations.forEach((entry) => {
            if (!map.has(entry.id)) {
                map.set(entry.id, entry);
            }
        });
        return Array.from(map.values());
    }, [organizations]);

    const loadOrganizations = useCallback(async () => {
        try {
            setLoading(true);
            setErrorMessage(null);
            const data = await businessSuiteService.getMyOrganizations();
            setOrganizations(data);
        } catch (error: unknown) {
            setErrorMessage(error instanceof Error ? error.message : 'Failed to load organizations.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadOrganizations();
    }, [loadOrganizations]);

    const handleSelect = async (orgId: string) => {
        if (orgId === selectedOrganizationId) {
            router.back();
            return;
        }

        try {
            setSwitchingId(orgId);
            await refreshOrganizationContext(orgId);
            router.replace('/(main)/(tabs)/home');
        } catch (error: unknown) {
            dialog.alert('Switch Organization', error instanceof Error ? error.message : 'Failed to switch organization.');
        } finally {
            setSwitchingId(null);
        }
    };

    return (
        <ScreenWrapper>
            <AppPullToRefresh refreshing={loading} onRefresh={() => { void loadOrganizations(); }}>
                <ScrollView
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                    showsVerticalScrollIndicator={false}
                >
                    <PageHeaderCard
                        title="Switch Organization"
                        subtitle={selectedOrganizationId ? 'Current organization selected' : 'Select your active organization'}
                        right={isOwner ? (
                            <AppButton mode="contained-tonal" compact onPress={() => router.push('/org-create')}>
                                Create
                            </AppButton>
                        ) : undefined}
                    />

                    {errorMessage ? (
                        <Text variant="bodySmall" style={{ color: theme.colors.error }}>
                            {errorMessage}
                        </Text>
                    ) : null}

                    {loading && uniqueOrganizations.length === 0 ? (
                        <AppCard>
                            <AppSkeleton width="35%" height={14} />
                            <AppSkeleton width="80%" height={12} style={{ marginTop: 10 }} />
                            <AppSkeleton width="52%" height={12} style={{ marginTop: 10 }} />
                        </AppCard>
                    ) : null}

                    {uniqueOrganizations.length === 0 && !loading ? (
                        <AppCard>
                            <Text variant="titleMedium" style={styles.emptyTitle}>No organizations found</Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                Create your first organization to start billing and reports.
                            </Text>
                            {isOwner ? (
                                <AppButton mode="contained" style={{ marginTop: 10 }} onPress={() => router.push('/org-create')}>
                                    Create Organization
                                </AppButton>
                            ) : null}
                        </AppCard>
                    ) : null}

                    {uniqueOrganizations.map((item) => {
                        const isSelected = item.id === selectedOrganizationId;
                        const isSwitching = item.id === switchingId;

                        return (
                            <AppCard
                                key={item.id}
                                style={[
                                    styles.orgCard,
                                    isSelected ? { borderColor: theme.colors.primary, borderWidth: 1 } : null,
                                ]}
                            >
                                <View style={styles.orgHeader}>
                                    <View style={{ flex: 1 }}>
                                        <Text variant="titleMedium" style={styles.orgName}>{item.name}</Text>
                                        <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant }}>
                                            {item.code.toUpperCase()} • {item.currency ?? 'INR'}
                                        </Text>
                                    </View>
                                    <Chip compact>{item.role.toUpperCase()}</Chip>
                                </View>
                                <View style={styles.orgFooter}>
                                    {isSelected ? (
                                        <Chip compact icon="check-circle-outline">Current</Chip>
                                    ) : (
                                        <Chip compact icon="swap-horizontal">Available</Chip>
                                    )}
                                    <AppButton
                                        mode={isSelected ? 'outlined' : 'contained-tonal'}
                                        compact
                                        loading={isSwitching}
                                        disabled={Boolean(switchingId)}
                                        onPress={() => { void handleSelect(item.id); }}
                                    >
                                        {isSelected ? 'Open' : 'Switch'}
                                    </AppButton>
                                </View>
                            </AppCard>
                        );
                    })}
                </ScrollView>
            </AppPullToRefresh>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        paddingBottom: DesignSystem.layout.pageBottom,
        gap: DesignSystem.layout.sectionGap,
    },
    emptyTitle: {
        fontWeight: '700',
        marginBottom: 4,
    },
    orgCard: {
        marginBottom: 0,
    },
    orgHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    orgName: {
        fontWeight: '700',
    },
    orgFooter: {
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 10,
        flexWrap: 'wrap',
    },
});
