
import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, FAB, List, Chip, useTheme } from 'react-native-paper';
import { useRouter, Href } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppCard } from '../../components/common/AppCard';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { useUserStore } from '../../store';
import { staffService } from '../../api/staffService';
import { DesignSystem } from '../../constants/DesignSystem';
import type { UserProfile, StaffInvite } from '../../types';
import { isNetworkLikeError } from '../../utils/errorGuards';

export const StaffListScreen = () => {
    const theme = useTheme();
    const router = useRouter();
    const { user } = useUserStore();
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
    const canManageStaff = user?.role === 'owner' || user?.role === 'admin';
    const staffQuery = useQuery({
        queryKey: ['staff-list', user?.uid ?? 'guest'] as const,
        queryFn: async (): Promise<{ staff: UserProfile[]; invites: StaffInvite[] }> => {
            return await staffService.getStaff();
        },
        enabled: canManageStaff,
        staleTime: 30_000,
    });

    const staff = staffQuery.data?.staff ?? [];
    const invites = staffQuery.data?.invites ?? [];
    const loading = staffQuery.isFetching && !staffQuery.data;
    const queryError = useMemo(() => {
        if (!staffQuery.error || isNetworkLikeError(staffQuery.error)) {
            return null;
        }
        return staffQuery.error instanceof Error ? staffQuery.error.message : 'Failed to load staff.';
    }, [staffQuery.error]);

    if (!canManageStaff) {
        return (
            <ScreenWrapper>
                <View style={styles.centered}>
                    <AppCard style={styles.centeredCard}>
                        <Text style={{ color: theme.colors.outline }}>Only owner/admin can manage staff.</Text>
                    </AppCard>
                </View>
            </ScreenWrapper>
        );
    }

    if (loading) {
        return <LoadingScreen message="Loading staff..." />;
    }

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title="Staff Management"
                        subtitle={`${staff.length} active staff | ${invites.length} pending invite(s)`}
                    />
                    {queryError ? (
                        <Text variant="bodySmall" style={[styles.errorText, { color: theme.colors.error }]}>
                            {queryError}
                        </Text>
                    ) : null}

                    <Text variant="titleMedium" style={styles.sectionTitle}>Active Staff</Text>
                    {staff.length === 0 ? (
                        <Text style={[styles.emptyText, { color: theme.colors.outline }]}>No active staff.</Text>
                    ) : (
                        staff.map((item) => (
                            <AppCard key={item.uid}>
                                <List.Item
                                    title={item.displayName || item.phoneNumber}
                                    description={item.role?.toUpperCase()}
                                    left={props => <List.Icon {...props} icon="account" />}
                                />
                            </AppCard>
                        ))
                    )}

                    <Text variant="titleMedium" style={styles.sectionTitleSecond}>Pending Invites</Text>
                    {invites.length === 0 ? (
                        <Text style={[styles.emptyText, { color: theme.colors.outline }]}>No pending invites.</Text>
                    ) : (
                        invites.map((item) => (
                            <AppCard key={item.id} style={{ backgroundColor: theme.colors.surfaceVariant }}>
                                <List.Item
                                    title={`Invited: ${item.phoneNumber}`}
                                    description={`Code: ${item.code} - Status: ${item.status}`}
                                    left={props => <List.Icon {...props} icon="email-outline" />}
                                    right={() => <Chip>{item.status}</Chip>}
                                />
                            </AppCard>
                        ))
                    )}
                </View>
            </ScrollView>

            <FAB
                icon="plus"
                label="Invite Staff"
                style={[styles.fab, { backgroundColor: theme.colors.primary }]}
                color={theme.colors.onPrimary}
                onPress={() => router.push('/staff/add' as Href)}
            />
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    centeredCard: {
        width: '100%',
        maxWidth: DesignSystem.layout.compactMaxWidth,
    },
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        paddingBottom: DesignSystem.layout.pageBottom,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.pageMaxWidth,
    },
    errorText: {
        marginBottom: DesignSystem.spacing.sm,
    },
    sectionTitle: {
        marginTop: DesignSystem.spacing.sm,
        marginBottom: DesignSystem.spacing.xxs + 1,
    },
    sectionTitleSecond: {
        marginTop: DesignSystem.spacing.md,
        marginBottom: DesignSystem.spacing.xxs + 1,
    },
    emptyText: {
        fontStyle: 'italic',
    },
    fab: {
        position: 'absolute',
        margin: 16,
        right: 0,
        bottom: 0,
    },
});
