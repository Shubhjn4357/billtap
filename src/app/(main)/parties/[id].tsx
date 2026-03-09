import { View, Text, ScrollView, Pressable, RefreshControl, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Spacing, Radius, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { format, parseISO } from 'date-fns';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { HubMetricCard } from '../../../components/ui/HubBlocks';
import { UtilityEmptyState, UtilityHero, UtilitySection } from '../../../components/ui/UtilityBlocks';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { usePartyDetails } from '../../../hooks/usePartyDetails';
import { usePartyMutations } from '../../../hooks/usePartyMutations';

export default function PartyDetailScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const { id } = useLocalSearchParams<{ id: string }>();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/parties');

    const { party, invoices, isLoading, isRefetching, refetch } = usePartyDetails(id);
    const { archiveParty, isArchivingParty: deleting } = usePartyMutations();

    if (isLoading) return <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>;
    if (!party) return <View style={s.centered}><Text style={{ color: colors.textSecondary }}>Party not found.</Text></View>;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title={party.name}
                subtitle="Party ledger and details"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable
                        style={s.iconBtn}
                        onPress={() => router.push(`/(main)/parties/add?id=${id}` as Parameters<typeof router.push>[0])}
                    >
                        <MaterialCommunityIcons name="pencil-outline" size={18} color={colors.primary} />
                    </Pressable>
                )}
            />

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefetching}
                        onRefresh={() => {
                            void refetch();
                        }}
                    />
                )}
            >
                <View style={s.heroWrap}>
                    <UtilityHero
                        title={party.name}
                        subtitle={`${party.type}${party.gstin ? ` - GSTIN ${party.gstin}` : ''}`}
                        icon={party.type === 'CUSTOMER' ? 'account-outline' : 'truck-delivery-outline'}
                        tone={party.type === 'CUSTOMER' ? 'success' : 'warning'}
                    />
                </View>

                <View style={s.statsRow}>
                    <HubMetricCard
                        label="Balance"
                        value={`Rs ${Math.abs(Number(party.openingBalance ?? 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`}
                        meta={Number(party.openingBalance ?? 0) >= 0 ? 'Receivable side' : 'Payable side'}
                        tone={Number(party.openingBalance ?? 0) >= 0 ? 'success' : 'danger'}
                    />
                    <HubMetricCard label="Credit Limit" value={`Rs ${Number(party.creditLimit ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`} meta="Configured limit" tone="info" />
                    <HubMetricCard label="Transactions" value={String(invoices.length)} meta="Visible invoices" tone="warning" />
                </View>

                <View style={s.quickRow}>
                    <Pressable style={[s.quickBtn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/(main)/billing/create?type=TAX_INVOICE&partyId=${id}` as Parameters<typeof router.push>[0])}>
                        <Text style={s.quickBtnText}>New Sale Invoice</Text>
                    </Pressable>
                    <Pressable style={[s.quickBtn, { backgroundColor: colors.primaryVariant }]} onPress={() => router.push(`/(main)/billing/create?type=PAYMENT_IN&partyId=${id}` as Parameters<typeof router.push>[0])}>
                        <Text style={s.quickBtnText}>Receive Payment</Text>
                    </Pressable>
                </View>

                <UtilitySection title="Profile Details" count={null}>
                    <View style={[s.infoCard, { backgroundColor: colors.card }]}>
                        {party.phone ? <InfoRow icon="phone-outline" label="Phone" value={party.phone} colors={colors} /> : null}
                        {party.email ? <InfoRow icon="email-outline" label="Email" value={party.email} colors={colors} /> : null}
                        {party.billingAddress ? <InfoRow icon="map-marker-outline" label="Address" value={party.billingAddress} colors={colors} /> : null}
                        {party.creditLimit > 0 ? <InfoRow icon="credit-card-outline" label="Credit Limit" value={`Rs ${party.creditLimit.toLocaleString('en-IN')}`} colors={colors} /> : null}
                        {party.loyaltyPoints > 0 ? <InfoRow icon="star-outline" label="Loyalty Points" value={String(party.loyaltyPoints)} colors={colors} /> : null}
                    </View>
                </UtilitySection>

                <UtilitySection title="Recent Transactions" count={Math.min(invoices.length, 8)}>
                    <View style={s.section}>
                        {invoices.length === 0 ? (
                            <UtilityEmptyState icon="file-document-outline" title="No invoices yet" description="Transactions linked to this party will appear here." />
                        ) : (
                            invoices.slice(0, 8).map((inv) => (
                                <Pressable
                                    key={inv.id}
                                    style={[s.txnRow, { backgroundColor: colors.card }]}
                                    onPress={() => router.push(`/(main)/billing/${inv.id}` as Parameters<typeof router.push>[0])}
                                >
                                    <View style={{ flex: 1 }}>
                                        <Text style={[s.txnNum, { color: colors.text }]}>{inv.invoiceNumber}</Text>
                                        <Text style={[s.txnDate, { color: colors.textSecondary }]}>{format(parseISO(inv.invoiceDate), 'dd MMM yyyy')}</Text>
                                    </View>
                                    <View style={{ alignItems: 'flex-end' }}>
                                        <Text style={[s.txnAmt, { color: colors.text }]}>Rs {inv.totalInvoiceValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                                        <Text style={[s.txnStatus, { color: inv.paymentStatus === 'PAID' ? colors.success : colors.warning }]}>{inv.paymentStatus}</Text>
                                    </View>
                                </Pressable>
                            ))
                        )}
                    </View>
                </UtilitySection>

                <View style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.xxl }}>
                    <Pressable
                        style={[s.deleteBtn, { borderColor: colors.error }]}
                        onPress={() => dialog.alert('Delete Party', `Delete ${party.name}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            {
                                text: 'Delete',
                                style: 'destructive',
                                onPress: () => {
                                    void archiveParty(id!)
                                        .then(() => router.back())
                                        .catch((error) => dialog.alert('Error', error instanceof Error ? error.message : 'Delete failed'));
                                },
                            },
                        ])}
                        disabled={deleting}
                    >
                        <Text style={[s.deleteBtnText, { color: colors.error }]}>{deleting ? 'Deleting...' : 'Delete Party'}</Text>
                    </Pressable>
                </View>
                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function InfoRow({
    icon,
    label,
    value,
    colors,
}: {
    icon: keyof typeof MaterialCommunityIcons.glyphMap;
    label: string;
    value: string;
    colors: ColorPalette;
}) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <MaterialCommunityIcons name={icon} size={16} color={colors.textSecondary} style={{ marginTop: 2 }} />
            <Text style={{ color: colors.textSecondary, width: 88, fontSize: 13 }}>{label}</Text>
            <Text style={{ color: colors.text, flex: 1, fontSize: 13 }}>{value}</Text>
        </View>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        iconBtn: {
            width: 34,
            height: 34,
            borderRadius: Radius.pill,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.surfaceVariant,
        },
        heroWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
        statsRow: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: Spacing.lg, gap: Spacing.sm, marginBottom: Spacing.md },
        infoCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.md },
        quickRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
        quickBtn: { flex: 1, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center' },
        quickBtnText: { color: colors.onPrimary, fontWeight: '600', fontSize: 13 },
        section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
        txnRow: { flexDirection: 'row', padding: Spacing.md, borderRadius: Radius.card, marginBottom: Spacing.sm },
        txnNum: { fontWeight: '600', fontSize: 13 },
        txnDate: { fontSize: 11 },
        txnAmt: { fontWeight: '700', fontSize: 14 },
        txnStatus: { fontSize: 11, fontWeight: '600' },
        deleteBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
        deleteBtnText: { fontWeight: '700', fontSize: 14 },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    });
