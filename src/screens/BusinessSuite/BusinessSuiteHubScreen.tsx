import React from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { List, Divider } from 'react-native-paper';
import { AppCard } from '../../components/common/AppCard';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
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
        key: 'staff',
        title: 'Staff Management',
        subtitle: 'Invite staff, review access, and manage team members.',
        route: '/staff',
        cta: 'Manage Staff',
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
    const router = useRouter();
    const { width } = useWindowDimensions();
    const {
        canManageTemplates,
        canManageSubscription,
        canManageStaff,
        canAccessSettings,
        canAccessOperations,
        isOwner,
    } = useOrganizationAccess();
    const { selectedOrganizationId, context } = useOrganizationStore();
    const isWide = width >= 900;

    const cards = React.useMemo(() => {
        const output = BASE_CARDS.filter((card) => {
            if (card.key === 'template' || card.key === 'card') {
                return isOwner || canManageTemplates;
            }
            if (card.key === 'operations') {
                return canAccessOperations || isOwner || canManageStaff || canAccessSettings;
            }
            if (card.key === 'staff') {
                return isOwner || canManageStaff;
            }
            if (card.key === 'subscription') {
                return isOwner || canManageSubscription;
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
    }, [canAccessOperations, canAccessSettings, canManageStaff, canManageSubscription, canManageTemplates, isOwner]);

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                <PageHeaderCard
                    title="Business Suite"
                        subtitle="Advanced controls and operations"
                />

                    <AppCard animationDelay={30} style={{ padding: 0, overflow: 'hidden' }}>
                        <List.Section style={{ margin: 0 }}>
                            <List.Subheader>Workspace</List.Subheader>
                            <List.Item
                                title={selectedOrganizationId ? `Org: ${selectedOrganizationId.slice(0, 8)}` : 'Org: auto'}
                                description={`Role: ${(context.role ?? 'owner').toUpperCase()}`}
                                left={props => <List.Icon {...props} icon="office-building-outline" />}
                            />
                            <Divider />
                            {cards.map((card, index) => (
                                <React.Fragment key={card.key}>
                                    <List.Item
                                        title={card.title}
                                        description={card.subtitle}
                                        left={props => <List.Icon {...props} icon={card.key === 'profile' ? 'account-outline' : card.key === 'template' ? 'palette-outline' : card.key === 'subscription' ? 'star-outline' : card.key === 'staff' ? 'account-group-outline' : 'briefcase-outline'} />}
                                        right={props => <List.Icon {...props} icon="chevron-right" />}
                                        onPress={() => router.push(card.route as never)}
                                        titleStyle={{ fontWeight: '600' }}
                                    />
                                    {index < cards.length - 1 && <Divider />}
                                </React.Fragment>
                            ))}
                        </List.Section>
                    </AppCard>

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
});
