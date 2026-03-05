import { useMemo, useState } from 'react';
import {
    ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { staffApi } from '../../../api/endpoints';
import { toApiError, toUserMessage } from '../../../api/client';
import { getColors, Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';
import type { StaffInvite, StaffMember } from '../../../types/domain';
import { canPerformAction } from '../../../utils/accessControl';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppInput } from '../../../components/ui/AppInput';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useHaptics } from '../../../hooks/useHaptics';
import { useAppDialog } from '@/components/providers/DialogProvider';

const getStaffInviteMessage = (error: unknown) => {
    const normalized = toApiError(error);
    const code = (normalized.code ?? '').toUpperCase();
    if (code === 'STAFF_INVITE_NOT_ALLOWED') {
        return 'Staff user limit reached for current plan. Upgrade to invite more staff.';
    }
    if (code === 'SUBSCRIPTION_WRITE_BLOCKED') {
        return 'Your current plan is read-only for cloud writes. Upgrade to invite staff.';
    }
    if (code === 'ACTION_ACCESS_DENIED' || code === 'CAPABILITY_ACCESS_DENIED') {
        return 'Your role cannot invite staff members.';
    }
    return toUserMessage(error, 'Unable to create invite.');
};

export default function StaffScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const qc = useQueryClient();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [search, setSearch] = useState('');
    const smartBack = useSmartBack('/(main)/more');
    const { selection } = useHaptics();
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);
    const canInviteStaff = canPerformAction(role, 'staff.invite', subscription);
    const canRemoveStaffMember = canPerformAction(role, 'staff.remove', subscription);

    const { data, isLoading, isRefetching, refetch } = useQuery({
        queryKey: ['staff'],
        queryFn: () => staffApi.list(),
        staleTime: 30_000,
    });

    const { mutateAsync: inviteStaff, isPending: inviting } = useMutation({
        mutationFn: (phone: string) => staffApi.invite({ phoneNumber: phone, role: 'staff' }),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
    });

    const { mutateAsync: removeStaff, isPending: removing } = useMutation({
        mutationFn: (uid: string) => staffApi.delete(uid),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
    });

    const { mutateAsync: removeInvite, isPending: removingInvite } = useMutation({
        mutationFn: (id: string) => staffApi.deleteInvite(id),
        onSuccess: () => qc.invalidateQueries({ queryKey: ['staff'] }),
    });

    const members = useMemo<StaffMember[]>(() => (data?.data?.staff ?? []) as StaffMember[], [data?.data?.staff]);
    const invites = useMemo<StaffInvite[]>(() => (data?.data?.invites ?? []) as StaffInvite[], [data?.data?.invites]);
    const filteredMembers = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return members;
        return members.filter((member) =>
            `${member.displayName ?? ''} ${member.phoneNumber ?? ''} ${member.email ?? ''} ${member.role}`.toLowerCase().includes(needle)
        );
    }, [members, search]);
    const filteredInvites = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return invites;
        return invites.filter((invite) =>
            `${invite.phoneNumber} ${invite.code} ${invite.status}`.toLowerCase().includes(needle)
        );
    }, [invites, search]);

    const onInvite = async () => {
        if (!canInviteStaff) {
            dialog.alert('Access denied', 'Your role cannot invite staff members.');
            return;
        }
        const trimmed = phoneNumber.trim();
        if (!trimmed) return;

        try {
            const response = await inviteStaff(trimmed);
            dialog.alert('Invite created', `Code: ${response.data?.code ?? ''}`);
            setPhoneNumber('');
        } catch (error) {
            dialog.alert('Invite failed', getStaffInviteMessage(error));
        }
    };

    const confirmRemoveStaff = (uid: string, name: string | null) => {
        if (!canRemoveStaffMember) {
            dialog.alert('Access denied', 'Your role cannot remove staff members.');
            return;
        }
        dialog.alert('Remove staff', `Remove ${name ?? 'this member'} from staff list?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await removeStaff(uid);
                    } catch (error) {
                        dialog.alert('Remove failed', toUserMessage(error, 'Unable to remove staff.'));
                    }
                },
            },
        ]);
    };

    const confirmDeleteInvite = (id: string) => {
        if (!canRemoveStaffMember) {
            dialog.alert('Access denied', 'Your role cannot delete staff invites.');
            return;
        }
        dialog.alert('Delete invite', 'Delete this pending invite?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await removeInvite(id);
                    } catch (error) {
                        dialog.alert('Delete failed', toUserMessage(error, 'Unable to delete invite.'));
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Staff and Roles"
                subtitle="Invite and manage access"
                onBackPress={smartBack}
            />

            <KeyboardAvoidingView style={s.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
                <View style={s.searchWrap}>
                <AppSearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search staff, phone, invite code..."
                />
                </View>

                <View style={[s.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>TEAM OVERVIEW</Text>
                <View style={s.summaryGrid}>
                    <View style={[s.summaryCell, { backgroundColor: colors.surfaceVariant }]}>
                        <Text style={[s.summaryCaption, { color: colors.textSecondary }]}>Active Staff</Text>
                        <Text style={s.summaryValue}>{filteredMembers.length}</Text>
                    </View>
                    <View style={[s.summaryCell, { backgroundColor: colors.surfaceVariant }]}>
                        <Text style={[s.summaryCaption, { color: colors.textSecondary }]}>Pending Invites</Text>
                        <Text style={s.summaryValue}>{filteredInvites.length}</Text>
                    </View>
                </View>
            </View>

                <View style={[s.inviteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Text style={[s.sectionTitle, { color: colors.text }]}>Invite Staff</Text>
                {!canInviteStaff ? (
                    <Text style={[s.accessHint, { color: colors.textSecondary }]}>
                        Your role does not have permission to invite staff.
                    </Text>
                ) : null}
                <View style={s.inviteRow}>
                    <AppInput
                        inputType="phone"
                        leadingIcon="phone-outline"
                        containerStyle={{ flex: 1 }}
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        placeholder="Phone number"
                    />
                    <Pressable
                        style={[s.inviteBtn, { backgroundColor: canInviteStaff ? colors.primary : colors.border }]}
                        onPress={onInvite}
                        disabled={inviting || phoneNumber.trim().length === 0 || !canInviteStaff}
                    >
                        {inviting ? <ActivityIndicator size="small" color={colors.onPrimary} /> : <MaterialCommunityIcons name="account-plus-outline" size={18} color={colors.onPrimary} />}
                    </Pressable>
                </View>
                </View>

                {isLoading ? (
                    <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
                ) : (
                    <FlatList
                    data={[{ key: 'members' }, { key: 'invites' }]}
                    keyExtractor={(i) => i.key}
                    refreshControl={(
                        <RefreshControl
                            tintColor={colors.primary}
                            refreshing={isRefetching}
                            onRefresh={() => {
                                refetch();
                            }}
                        />
                    )}
                    renderItem={({ item }) => {
                        if (item.key === 'members') {
                            return (
                                <View style={s.block}>
                                    <Text style={[s.blockTitle, { color: colors.textSecondary }]}>Active Staff</Text>
                                    {filteredMembers.length === 0 ? (
                                        <Text style={[s.emptyText, { color: colors.textSecondary }]}>No staff members yet.</Text>
                                    ) : (
                                        filteredMembers.map((member) => (
                                            <View key={member.uid} style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                                <View style={{ flex: 1 }}>
                                                    <View style={s.nameRow}>
                                                        <Text style={[s.name, { color: colors.text }]}>{member.displayName ?? member.phoneNumber ?? member.uid}</Text>
                                                        <View style={[s.roleBadge, { backgroundColor: withAlpha(colors.primary, '16') }]}>
                                                            <Text style={[s.roleBadgeText, { color: colors.primary }]}>{member.role.toUpperCase()}</Text>
                                                        </View>
                                                    </View>
                                                    <Text style={[s.meta, { color: colors.textSecondary }]}>{member.phoneNumber ?? member.email ?? '-'}</Text>
                                                </View>
                                                <Pressable
                                                    style={[s.inlineBtn, { borderColor: colors.error }]}
                                                    onPress={() => {
                                                        void selection();
                                                        confirmRemoveStaff(member.uid, member.displayName);
                                                    }}
                                                    disabled={removing || !canRemoveStaffMember}
                                                >
                                                    <Text style={{ color: colors.error, fontWeight: '700', fontSize: 12 }}>Remove</Text>
                                                </Pressable>
                                            </View>
                                        ))
                                    )}
                                </View>
                            );
                        }

                        return (
                            <View style={s.block}>
                                <Text style={[s.blockTitle, { color: colors.textSecondary }]}>Pending Invites</Text>
                                {filteredInvites.length === 0 ? (
                                    <Text style={[s.emptyText, { color: colors.textSecondary }]}>No pending invites.</Text>
                                ) : (
                                    filteredInvites.map((invite) => (
                                        <View key={invite.id} style={[s.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                                            <View style={{ flex: 1 }}>
                                                <View style={s.nameRow}>
                                                    <Text style={[s.name, { color: colors.text }]}>{invite.phoneNumber}</Text>
                                                    <View style={[s.roleBadge, { backgroundColor: withAlpha(colors.warning, '16') }]}>
                                                        <Text style={[s.roleBadgeText, { color: colors.warning }]}>{invite.status.toUpperCase()}</Text>
                                                    </View>
                                                </View>
                                                <Text style={[s.meta, { color: colors.textSecondary }]}>Code: {invite.code}</Text>
                                            </View>
                                            <Pressable
                                                style={[s.inlineBtn, { borderColor: colors.error }]}
                                                onPress={() => {
                                                    void selection();
                                                    confirmDeleteInvite(invite.id);
                                                }}
                                                disabled={removingInvite || !canRemoveStaffMember}
                                            >
                                                <Text style={{ color: colors.error, fontWeight: '700', fontSize: 12 }}>Delete</Text>
                                            </Pressable>
                                        </View>
                                    ))
                                )}
                            </View>
                        );
                    }}
                    contentContainerStyle={{ paddingBottom: 100 }}
                />
                )}
            </KeyboardAvoidingView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        flex: { flex: 1 },
        searchWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
        summaryCard: {
            marginHorizontal: Spacing.lg,
            borderRadius: Radius.card,
            borderWidth: 1,
            padding: Spacing.md,
            marginBottom: Spacing.sm,
        },
        summaryLabel: { fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8 },
        summaryGrid: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
        summaryCell: { flex: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.sm, paddingVertical: Spacing.sm },
        summaryCaption: { fontSize: Typography.caption.size, fontWeight: '600' },
        summaryValue: { marginTop: 2, color: colors.text, fontSize: Typography.title.size, fontWeight: '800' },
        inviteCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, borderWidth: 1, padding: Spacing.md, marginBottom: Spacing.md },
        sectionTitle: { fontWeight: '700', fontSize: 14, marginBottom: Spacing.sm },
        accessHint: { fontSize: 12, marginBottom: Spacing.xs },
        inviteRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
        inviteBtn: {
            borderRadius: Radius.pill,
            width: 44,
            height: 44,
            alignItems: 'center',
            justifyContent: 'center',
        },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        block: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
        blockTitle: { fontWeight: '700', fontSize: 12, marginBottom: Spacing.sm, textTransform: 'uppercase' },
        row: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            marginBottom: Spacing.sm,
        },
        nameRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.xs },
        name: { fontWeight: '700', fontSize: 14 },
        roleBadge: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 2,
            overflow: 'hidden',
        },
        roleBadgeText: { fontSize: Typography.caption.size, fontWeight: '700' },
        meta: { fontSize: 12, marginTop: 2 },
        inlineBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
        emptyText: { fontSize: 13 },
    });
