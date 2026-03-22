import { useMemo, useState } from 'react';
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { SCREEN_DIRECTORY_SECTIONS, type UtilityScreenSection } from '../../../constants/utilityNavigation';
import { useAppColors } from '../../../hooks/useAppColors';
import { DESIGN_SPACING } from '../../../constants/designSystem';
import { Spacing, Typography, type ColorPalette } from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { UtilityEmptyState, UtilityHero, UtilityPanel, UtilityRow, UtilitySection } from '../../../components/ui/UtilityBlocks';
import { canAccessModule, canUsePos, hasFeatureAccess, type AppModule } from '../../../utils/accessControl';
import { useItemCatalog } from '../../../hooks/useInventory';
import { useLoans } from '../../../hooks/useLoans';
import { useInvoices } from '../../../hooks/useInvoices';
import { useParties } from '../../../hooks/useParties';
import { useCashBankAccounts } from '../../../hooks/useCashBankAccounts';
import { useAccountingLedgers } from '../../../hooks/useAccountingLedgers';

type SmartDeepLink = {
    label: string;
    subtitle: string;
    route: string;
    module: AppModule;
};

export default function ScreenDirectoryScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');

    const [search, setSearch] = useState('');
    const business = useAuthStore((state) => state.business);
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);
    const normalizedSearch = search.trim().toLowerCase();

    const { invoices: latestInvoices, isRefetching: invoiceRefetching, refetch: refetchInvoice } = useInvoices({
        type: 'ALL',
        limit: 1,
        staleTime: 60_000,
    });

    const { parties: latestParties, isRefetching: partyRefetching, refetch: refetchParty } = useParties({
        limit: 1,
        staleTime: 60_000,
    });

    const { items: latestItems, isRefetching: itemRefetching, refetch: refetchItem } = useItemCatalog({ limit: 1, staleTime: 60_000 });
    const { loans: latestLoans, isRefetching: loanRefetching, refetch: refetchLoan } = useLoans({ limit: 1, staleTime: 60_000 });
    const { accounts: latestAccounts, isRefetching: accountRefetching, refetch: refetchAccount } = useCashBankAccounts({ staleTime: 60_000 });
    const { rows: latestLedgers, isRefetching: ledgerRefetching, refetch: refetchLedger } = useAccountingLedgers({ limit: 1, staleTime: 60_000 });
    const isRefreshing = invoiceRefetching || partyRefetching || itemRefetching || loanRefetching || accountRefetching || ledgerRefetching;

    const smartLinks = useMemo(() => {
        const latestInvoice = latestInvoices[0];
        const latestParty = latestParties[0];
        const latestItem = latestItems[0];
        const latestLoan = latestLoans[0];
        const latestAccount = latestAccounts[0];
        const latestLedger = latestLedgers[0];

        const links: SmartDeepLink[] = [
            {
                label: 'Latest Invoice Detail',
                subtitle: latestInvoice?.invoiceNumber
                    ? `Open ${latestInvoice.invoiceNumber}`
                    : 'No invoice found. Open create invoice.',
                route: latestInvoice
                    ? `/(main)/billing/${latestInvoice.id}`
                    : '/(main)/billing/create?type=TAX_INVOICE',
                module: 'billing',
            },
            {
                label: 'Latest Party Detail',
                subtitle: latestParty?.name
                    ? `Open ${latestParty.name}`
                    : 'No party found. Open add party.',
                route: latestParty
                    ? `/(main)/parties/${latestParty.id}`
                    : '/(main)/parties/add',
                module: 'parties',
            },
            {
                label: 'Latest Item Detail',
                subtitle: latestItem?.name
                    ? `Open ${latestItem.name}`
                    : 'No item found. Open add item.',
                route: latestItem
                    ? `/(main)/inventory/${latestItem.id}`
                    : '/(main)/inventory/add-item',
                module: 'inventory',
            },
            {
                label: 'Latest Loan Detail',
                subtitle: latestLoan?.lenderBorrowerName
                    ? `Open ${latestLoan.lenderBorrowerName}`
                    : 'No loan found. Open add loan.',
                route: latestLoan
                    ? `/(main)/accounts/loans/${latestLoan.id}`
                    : '/(main)/accounts/loans/add',
                module: 'accounts',
            },
            {
                label: 'Latest Cash/Bank Account',
                subtitle: latestAccount?.name
                    ? `Open ${latestAccount.name}`
                    : 'No account found. Open add cash/bank account.',
                route: latestAccount
                    ? `/(main)/accounts/cash-bank/${latestAccount.id}`
                    : '/(main)/accounts/cash-bank/add',
                module: 'accounts',
            },
            {
                label: 'Latest Ledger Detail',
                subtitle: latestLedger?.name
                    ? `Open ${latestLedger.name}`
                    : 'No ledger found. Open ledger list.',
                route: latestLedger
                    ? `/(main)/reports/ledgers/${latestLedger.id}`
                    : '/(main)/reports/ledgers',
                module: 'reports',
            },
        ];

        return links.filter((link) => {
            if (!canAccessModule(role, link.module, subscription, business)) return false;
            if (!normalizedSearch) return true;
            return `${link.label} ${link.subtitle}`.toLowerCase().includes(normalizedSearch);
        });
    }, [
        latestAccounts,
        latestInvoices,
        latestItems,
        latestLedgers,
        latestLoans,
        normalizedSearch,
        latestParties,
        business,
        role,
        subscription,
    ]);

    const sections = useMemo(() => {
        return SCREEN_DIRECTORY_SECTIONS.map((section: UtilityScreenSection) => {
            const visibleItems = section.items.filter((item) => {
                if (item.ownerOnly && role !== 'owner') return false;
                if (item.module && !canAccessModule(role, item.module, subscription, business)) return false;
                if (item.requiresPos && !canUsePos(subscription)) return false;
                if (item.requiresFeature && !hasFeatureAccess(subscription, item.requiresFeature)) return false;
                if (!normalizedSearch) return true;

                const haystack = `${item.label} ${item.description}`.toLowerCase();
                return haystack.includes(normalizedSearch);
            });

            return { title: section.title, items: visibleItems };
        }).filter((section) => section.items.length > 0);
    }, [business, normalizedSearch, role, subscription]);

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Screen Directory"
                subtitle="Quick navigation across modules"
                onBackPress={smartBack}
            />

            <View style={s.searchWrap}>
                <AppSearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search screens..."
                    showScanAction={false}
                />
            </View>

            <View style={s.heroWrap}>
                <UtilityHero
                    title="Navigation Directory"
                    subtitle="Jump directly into the latest records and module entry points across the app."
                    icon="compass-outline"
                    tone="info"
                />
            </View>

            <ScrollView
                contentContainerStyle={s.content}
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefreshing}
                        onRefresh={() => {
                            void Promise.all([
                                refetchInvoice(),
                                refetchParty(),
                                refetchItem(),
                                refetchLoan(),
                                refetchAccount(),
                                refetchLedger(),
                            ]);
                        }}
                    />
                )}
            >
                <View style={s.section}>
                    <UtilitySection title="Smart Deep Links">
                        <UtilityPanel>
                        {smartLinks.map((link, index) => (
                            <View
                                key={link.label}
                                style={index < smartLinks.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined}
                            >
                                <UtilityRow
                                    label={link.label}
                                    description={link.subtitle}
                                    onPress={() => router.push(link.route as Parameters<typeof router.push>[0])}
                                />
                            </View>
                            ))}
                        {smartLinks.length === 0 ? (
                            <UtilityEmptyState
                                icon="radar"
                                title="No deep links"
                                description="No deep links are available for the current search or plan."
                            />
                        ) : null}
                        </UtilityPanel>
                    </UtilitySection>
                </View>

                {sections.map((section) => (
                    <UtilitySection key={section.title} title={section.title}>
                        <UtilityPanel>
                            {section.items.map((item, index) => (
                                <View
                                    key={`${section.title}-${item.label}`}
                                    style={index < section.items.length - 1 ? { borderBottomWidth: 1, borderBottomColor: colors.border } : undefined}
                                >
                                    <UtilityRow
                                        label={item.label}
                                        description={item.description}
                                        onPress={() => router.push(item.route as Parameters<typeof router.push>[0])}
                                    />
                                </View>
                            ))}
                        </UtilityPanel>
                    </UtilitySection>
                ))}

                {sections.length === 0 ? (
                    <UtilityEmptyState
                        icon="file-search-outline"
                        title="No screens found"
                        description="No screens match the current search."
                    />
                ) : null}

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    searchWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.cardGap },
    heroWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: DESIGN_SPACING.cardGap },
    content: { paddingHorizontal: DESIGN_SPACING.screenX, paddingBottom: Spacing.lg, gap: DESIGN_SPACING.sectionGap },
    section: { gap: Spacing.sm },
    sectionTitle: {
        color: colors.textSecondary,
        fontSize: Typography.caption.size,
        fontWeight: '700',
        letterSpacing: 0.7,
    },
});
