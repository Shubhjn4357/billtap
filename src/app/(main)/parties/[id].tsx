import { View, Text, ScrollView, Pressable, StyleSheet, useColorScheme, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { partyApi, invoiceApi } from '../../../api/endpoints';
import { getColors, Spacing, Radius, type ColorPalette, withAlpha } from '../../../constants/theme';
import { format, parseISO } from 'date-fns';
import type { Invoice } from '../../../types/domain';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { useAppDialog } from '@/components/providers/DialogProvider';

export default function PartyDetailScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme();
    const colors = getColors(scheme);
    const { id } = useLocalSearchParams<{ id: string }>();
    const qc = useQueryClient();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/parties');

    const { data: partyData, isLoading } = useQuery({
        queryKey: ['party', id],
        queryFn: () => partyApi.get(id!),
        enabled: !!id,
    });

    const { data: invoicesData } = useQuery({
        queryKey: ['party-invoices', id],
        queryFn: () => invoiceApi.list({ limit: 20 }),
        enabled: !!id,
    });

    const { mutate: deleteParty, isPending: deleting } = useMutation({
        mutationFn: () => partyApi.delete(id!),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['parties'] });
            router.back();
        },
        onError: (error) => dialog.alert('Error', error instanceof Error ? error.message : 'Delete failed'),
    });

    const party = partyData?.data;
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

            <ScrollView showsVerticalScrollIndicator={false}>
                <View style={[s.summaryCard, { backgroundColor: colors.primary }]}>
                    <View style={s.avatarLg}>
                        <Text style={s.avatarText}>{party.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={s.partyName}>{party.name}</Text>
                    <Text style={s.partyType}>{party.type}{party.gstin ? ` - GSTIN: ${party.gstin}` : ''}</Text>
                    <View style={s.balanceChip}>
                        <Text style={[s.balanceAmt, { color: colors.onPrimary }]}>Balance: Rs {Math.abs(party.openingBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                    </View>
                </View>

                <View style={[s.infoCard, { backgroundColor: colors.card }]}>
                    {party.phone ? <InfoRow icon="phone-outline" label="Phone" value={party.phone} colors={colors} /> : null}
                    {party.email ? <InfoRow icon="email-outline" label="Email" value={party.email} colors={colors} /> : null}
                    {party.billingAddress ? <InfoRow icon="map-marker-outline" label="Address" value={party.billingAddress} colors={colors} /> : null}
                    {party.creditLimit > 0 ? <InfoRow icon="credit-card-outline" label="Credit Limit" value={`Rs ${party.creditLimit.toLocaleString('en-IN')}`} colors={colors} /> : null}
                    {party.loyaltyPoints > 0 ? <InfoRow icon="star-outline" label="Loyalty Points" value={String(party.loyaltyPoints)} colors={colors} /> : null}
                </View>

                <View style={s.quickRow}>
                    <Pressable style={[s.quickBtn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/(main)/billing/create?type=TAX_INVOICE&partyId=${id}` as Parameters<typeof router.push>[0])}>
                        <Text style={s.quickBtnText}>New Sale Invoice</Text>
                    </Pressable>
                    <Pressable style={[s.quickBtn, { backgroundColor: colors.primaryVariant }]} onPress={() => router.push(`/(main)/billing/create?type=PAYMENT_IN&partyId=${id}` as Parameters<typeof router.push>[0])}>
                        <Text style={s.quickBtnText}>Receive Payment</Text>
                    </Pressable>
                </View>

                <View style={s.section}>
                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>RECENT TRANSACTIONS</Text>
                    {(invoicesData?.data ?? []).slice(0, 8).map((inv: Invoice) => (
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
                    ))}
                </View>

                <View style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.xxl }}>
                    <Pressable
                        style={[s.deleteBtn, { borderColor: colors.error }]}
                        onPress={() => dialog.alert('Delete Party', `Delete ${party.name}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => deleteParty() },
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
        summaryCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.card, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
        avatarLg: { width: 60, height: 60, borderRadius: 30, backgroundColor: withAlpha(colors.onPrimary, '33'), alignItems: 'center', justifyContent: 'center' },
        avatarText: { color: colors.onPrimary, fontWeight: '800', fontSize: 28 },
        partyName: { color: colors.onPrimary, fontWeight: '700', fontSize: 20 },
        partyType: { color: withAlpha(colors.onPrimary, 'bb'), fontSize: 12 },
        balanceChip: { backgroundColor: withAlpha(colors.onPrimary, '22'), borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 4 },
        balanceAmt: { fontWeight: '700', fontSize: 14 },
        infoCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.md },
        quickRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
        quickBtn: { flex: 1, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center' },
        quickBtnText: { color: colors.onPrimary, fontWeight: '600', fontSize: 13 },
        section: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
        sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginBottom: Spacing.sm },
        txnRow: { flexDirection: 'row', padding: Spacing.md, borderRadius: Radius.card, marginBottom: Spacing.sm },
        txnNum: { fontWeight: '600', fontSize: 13 },
        txnDate: { fontSize: 11 },
        txnAmt: { fontWeight: '700', fontSize: 14 },
        txnStatus: { fontSize: 11, fontWeight: '600' },
        deleteBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingVertical: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
        deleteBtnText: { fontWeight: '700', fontSize: 14 },
        centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    });
