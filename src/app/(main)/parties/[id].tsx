// @ts-nocheck
import { View, Text, ScrollView, Pressable, StyleSheet, useColorScheme, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { partyApi, invoiceApi } from '../../../api/endpoints';
import { Colors, Spacing, Radius, Typography } from '../../../constants/theme';
import { PaymentStatus } from '../../../constants/enums';
import format from 'date-fns/format';
import parseISO from 'date-fns/parseISO';
import type { Invoice } from '../../../types/domain';

export default function PartyDetailScreen() {
    const scheme = useColorScheme() ?? 'light';
    const colors = Colors[scheme as 'light' | 'dark'] ?? Colors.light;
    const { id } = useLocalSearchParams<{ id: string }>();
    const qc = useQueryClient();
    const s = styles(colors);

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
        onSuccess: () => { qc.invalidateQueries({ queryKey: ['parties'] }); router.back(); },
        onError: (e) => Alert.alert('Error', e instanceof Error ? e.message : 'Delete failed'),
    });

    const party = partyData?.data;
    if (isLoading) return <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>;
    if (!party) return <View style={s.centered}><Text style={{ color: colors.textSecondary }}>Party not found.</Text></View>;

    const balanceColor = party.openingBalance > 0 ? colors.success : party.openingBalance < 0 ? colors.error : colors.textSecondary;

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}><Text style={[s.back, { color: colors.primary }]}>← Back</Text></Pressable>
                <Text style={[s.title, { color: colors.text }]}>{party.name}</Text>
                <Pressable onPress={() => router.push(`/(main)/parties/add?id=${id}` as Parameters<typeof router.push>[0])}>
                    <Text style={[s.editBtn, { color: colors.primary }]}>Edit</Text>
                </Pressable>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
                {/* Summary card */}
                <View style={[s.summaryCard, { backgroundColor: colors.primary }]}>
                    <View style={s.avatarLg}>
                        <Text style={s.avatarText}>{party.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={s.partyName}>{party.name}</Text>
                    <Text style={s.partyType}>{party.type} {party.gstin ? `· GSTIN: ${party.gstin}` : ''}</Text>
                    <View style={s.balanceChip}>
                        <Text style={[s.balanceAmt, { color: '#fff' }]}>
                            Balance: ₹{Math.abs(party.openingBalance).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
                        </Text>
                    </View>
                </View>

                {/* Contact info */}
                <View style={[s.infoCard, { backgroundColor: colors.card }]}>
                    {party.phone && <InfoRow icon="📞" label="Phone" value={party.phone} colors={colors} />}
                    {party.email && <InfoRow icon="✉️" label="Email" value={party.email} colors={colors} />}
                    {party.billingAddress && <InfoRow icon="📍" label="Address" value={party.billingAddress} colors={colors} />}
                    {party.creditLimit > 0 && <InfoRow icon="💳" label="Credit Limit" value={`₹${party.creditLimit.toLocaleString('en-IN')}`} colors={colors} />}
                    {party.loyaltyPoints > 0 && <InfoRow icon="⭐" label="Loyalty Pts" value={String(party.loyaltyPoints)} colors={colors} />}
                </View>

                {/* Quick actions */}
                <View style={s.quickRow}>
                    <Pressable style={[s.quickBtn, { backgroundColor: colors.primary }]} onPress={() => router.push(`/(main)/billing/create?type=TAX_INVOICE&partyId=${id}` as Parameters<typeof router.push>[0])}>
                        <Text style={s.quickBtnText}>+ Sale Invoice</Text>
                    </Pressable>
                    <Pressable style={[s.quickBtn, { backgroundColor: colors.primaryVariant }]} onPress={() => router.push(`/(main)/billing/create?type=PAYMENT_IN&partyId=${id}` as Parameters<typeof router.push>[0])}>
                        <Text style={s.quickBtnText}>Receive Payment</Text>
                    </Pressable>
                </View>

                {/* Recent transactions */}
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
                                <Text style={[s.txnAmt, { color: colors.text }]}>₹{inv.totalInvoiceValue.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</Text>
                                <Text style={[s.txnStatus, { color: inv.paymentStatus === 'PAID' ? colors.success : colors.warning }]}>{inv.paymentStatus}</Text>
                            </View>
                        </Pressable>
                    ))}
                </View>

                {/* Delete */}
                <View style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.xxl }}>
                    <Pressable
                        style={[s.deleteBtn, { borderColor: colors.error }]}
                        onPress={() => Alert.alert('Delete Party', `Delete ${party.name}?`, [
                            { text: 'Cancel', style: 'cancel' },
                            { text: 'Delete', style: 'destructive', onPress: () => deleteParty() },
                        ])}
                        disabled={deleting}
                    >
                        <Text style={[s.deleteBtnText, { color: colors.error }]}>{deleting ? 'Deleting…' : '🗑 Delete Party'}</Text>
                    </Pressable>
                </View>
                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

function InfoRow({ icon, label, value, colors }: { icon: string; label: string; value: string; colors: typeof Colors.light }) {
    return (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm, paddingVertical: Spacing.sm, borderBottomWidth: 0.5, borderBottomColor: colors.border }}>
            <Text style={{ fontSize: 16 }}>{icon}</Text>
            <Text style={{ color: colors.textSecondary, width: 88, fontSize: 13 }}>{label}</Text>
            <Text style={{ color: colors.text, flex: 1, fontSize: 13 }}>{value}</Text>
        </View>
    );
}

const styles = (colors: typeof Colors.light) => StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
    back: { fontWeight: '600', fontSize: 14 },
    title: { flex: 1, textAlign: 'center', fontWeight: '700', fontSize: 17 },
    editBtn: { fontWeight: '600', fontSize: 14 },
    summaryCard: { marginHorizontal: Spacing.lg, marginBottom: Spacing.md, borderRadius: Radius.card, padding: Spacing.xl, alignItems: 'center', gap: Spacing.sm },
    avatarLg: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#ffffff33', alignItems: 'center', justifyContent: 'center' },
    avatarText: { color: '#fff', fontWeight: '800', fontSize: 28 },
    partyName: { color: '#fff', fontWeight: '700', fontSize: 20 },
    partyType: { color: '#ffffffbb', fontSize: 12 },
    balanceChip: { backgroundColor: '#ffffff22', borderRadius: Radius.pill, paddingHorizontal: Spacing.md, paddingVertical: 4 },
    balanceAmt: { fontWeight: '700', fontSize: 14 },
    infoCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.md },
    quickRow: { flexDirection: 'row', gap: Spacing.sm, paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
    quickBtn: { flex: 1, borderRadius: Radius.pill, paddingVertical: Spacing.sm, alignItems: 'center' },
    quickBtnText: { color: '#fff', fontWeight: '600', fontSize: 13 },
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


