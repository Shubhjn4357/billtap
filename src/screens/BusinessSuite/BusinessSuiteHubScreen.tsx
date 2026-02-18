import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, Text, useTheme } from 'react-native-paper';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { DesignSystem } from '../../constants/DesignSystem';
import { useOrganizationStore } from '../../store';

type SuiteCard = {
    key: string;
    title: string;
    subtitle: string;
    route: string;
    cta: string;
};

const BASE_CARDS: SuiteCard[] = [
    {
        key: 'template',
        title: 'Template Studio',
        subtitle: 'Live GST/Estimate preview with print controls.',
        route: '/business-suite-template',
        cta: 'Open Template',
    },
    {
        key: 'card',
        title: 'Business Card Studio',
        subtitle: 'Design, preview and share your business card instantly.',
        route: '/business-suite-business-card',
        cta: 'Open Card Studio',
    },
    {
        key: 'operations',
        title: 'Operations Controls',
        subtitle: 'Approvals, period lock and audit level controls.',
        route: '/operations',
        cta: 'Open Operations',
    },
    {
        key: 'subscription',
        title: 'Subscription',
        subtitle: 'Manage current plan, limits and upgrades.',
        route: '/subscription',
        cta: 'Open Subscription',
    },
];

export const BusinessSuiteHubScreen = () => {
    const theme = useTheme();
    const router = useRouter();
    const { width } = useWindowDimensions();
    const { user } = useAuth();
    const {
        canManageTemplates,
        canManageSubscription,
        canManageStaff,
        canAccessSettings,
        canAccessOperations,
        canAccessBusinessSuite,
        isOwnerOrAdmin,
    } = useOrganizationAccess();
    const { selectedOrganizationId, context } = useOrganizationStore();
    const isWide = width >= 900;

    const cards = React.useMemo(() => {
        const output = BASE_CARDS.filter((card) => {
            if (card.key === 'template' || card.key === 'card') {
                return isOwnerOrAdmin || canManageTemplates;
            }
            if (card.key === 'operations') {
                return canAccessOperations || isOwnerOrAdmin || canManageStaff || canAccessSettings;
            }
            if (card.key === 'subscription') {
                return isOwnerOrAdmin || canManageSubscription;
            }
            return true;
        });
        output.push({
            key: 'profile',
            title: 'Profile Setup',
            subtitle: 'Business details, UPI and owner profile settings.',
            route: '/profile',
            cta: 'Open Profile',
        });
        return output;
    }, [canAccessOperations, canAccessSettings, canManageStaff, canManageSubscription, canManageTemplates, isOwnerOrAdmin]);

    if (!canAccessBusinessSuite) {
        return (
            <ScreenWrapper>
                <AppCard>
                    <Text variant="titleSmall" style={{ fontWeight: '700' }}>
                        Business Suite is disabled
                    </Text>
                    <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 6 }}>
                        Ask owner/admin to enable Business Suite for this store.
                    </Text>
                </AppCard>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                <PageHeaderCard
                    title="Business Suite"
                    subtitle="Split modules for faster load and cleaner workflow."
                />

                <AppCard animationDelay={30}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Workspace
                    </Text>
                    <View style={styles.chipRow}>
                        <Chip compact icon="office-building-outline">
                            {selectedOrganizationId ? `Org: ${selectedOrganizationId.slice(0, 8)}` : 'Org: auto'}
                        </Chip>
                        <Chip compact icon="account-badge-outline">
                            Role: {(context.role ?? 'owner').toUpperCase()}
                        </Chip>
                        <Chip compact icon="account-outline">
                            {user?.displayName || user?.phoneNumber || 'User'}
                        </Chip>
                    </View>
                </AppCard>

                <View style={[styles.grid, isWide && styles.gridWide]}>
                    {cards.map((card, index) => (
                        <AppCard
                            key={card.key}
                            animationDelay={60 + index * 25}
                            style={[styles.gridCard, isWide && styles.gridCardWide]}
                        >
                            <Text variant="titleMedium" style={styles.cardTitle}>
                                {card.title}
                            </Text>
                            <Text variant="bodySmall" style={{ color: theme.colors.onSurfaceVariant, marginTop: 4 }}>
                                {card.subtitle}
                            </Text>
                            <AppButton
                                mode="contained-tonal"
                                style={styles.cardButton}
                                onPress={() => router.push(card.route as never)}
                            >
                                {card.cta}
                            </AppButton>
                        </AppCard>
                    ))}
                </View>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        paddingBottom: DesignSystem.layout.pageBottom,
        gap: 12,
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.pageMaxWidth,
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: 8,
    },
    chipRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    grid: {
        gap: 10,
    },
    gridWide: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    gridCard: {
        marginBottom: 0,
    },
    gridCardWide: {
        width: '48%',
    },
    cardTitle: {
        fontWeight: '700',
    },
    cardButton: {
        marginTop: 10,
        alignSelf: 'flex-start',
    },
});
