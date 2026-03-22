import { useState } from 'react';
import {
    ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { toApiError, toUserMessage } from '../../../api/client';
import { STAFF_ROLE_OPTIONS, type StaffInviteRole } from '../../../constants/formOptions';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { useAuthStore } from '../../../store/authStore';
import { canPerformAction } from '../../../utils/accessControl';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppInput } from '../../../components/ui/AppInput';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { SelectField } from '../../../components/ui/SelectField';
import { HubMetricCard } from '../../../components/ui/HubBlocks';
import { UtilityEmptyState, UtilityHero, UtilitySection } from '../../../components/ui/UtilityBlocks';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useHaptics } from '../../../hooks/useHaptics';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { useStaffDirectory } from '../../../hooks/useStaffDirectory';
import { useStaffMutations } from '../../../hooks/useStaffMutations';

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
    const colors = useAppColors();
    const s = styles(colors);
    const [phoneNumber, setPhoneNumber] = useState('');
    const [inviteRole, setInviteRole] = useState<StaffInviteRole>('staff');
    const [search, setSearch] = useState('');
    const smartBack = useSmartBack('/(main)/more');
    const { selection } = useHaptics();
    const business = useAuthStore((state) => state.business);
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);
    const canInviteStaff = canPerformAction(role, 'staff.invite', subscription, business);
    const canRemoveStaffMember = canPerformAction(role, 'staff.remove', subscription, business);

    const { filteredMembers, filteredInvites, isLoading, isRefetching, refetch } = useStaffDirectory({
        search,
        staleTime: 30_000,
    });

    const {
        inviteStaff,
        removeStaff,
        removeInvite,
        isInviting: inviting,
        isRemovingStaff: removing,
        isRemovingInvite: removingInvite,
    } = useStaffMutations();

    const onInvite = async () => {
        if (!canInviteStaff) {
            dialog.alert('Access denied', 'Your role cannot invite staff members.');
            return;
        }
        const trimmed = phoneNumber.trim();
        if (!trimmed) return;

        try {
            const response = await inviteStaff({ phoneNumber: trimmed, role: inviteRole });
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
                <View style={s.heroWrap}>
                    <UtilityHero
                        title="Staff Hub"
                        subtitle="Control invites, review pending access, and manage team membership from one screen."
                        icon="account-group-outline"
                        tone="warning"
                    />
                </View>

                <View style={s.searchWrap}>
                    <AppSearchBar
                        value={search}
                        onChangeText={setSearch}
                        placeholder="Search staff, phone, invite code..."
                    />
                </View>

                <View style={s.statsRow}>
                    <HubMetricCard label="Active Staff" value={String(filteredMembers.length)} meta="Members with access" tone="info" />
                    <HubMetricCard label="Pending" value={String(filteredInvites.length)} meta="Open invite codes" tone="warning" />
                    <HubMetricCard label="Invite Access" value={canInviteStaff ? 'Enabled' : 'Blocked'} meta="Role-based permission" tone={canInviteStaff ? 'success' : 'danger'} />
                </View>

                <View style={[s.inviteCard, getSurfaceStyle(colors, { elevated: true })]}>
                    <Text style={[s.sectionTitle, { color: colors.text }]}>Invite Staff</Text>
                    {!canInviteStaff ? (
                        <Text style={[s.accessHint, { color: colors.textSecondary }]}>
                            Your role does not have permission to invite staff members.
                        </Text>
                    ) : (
                        <SelectField
                            value={inviteRole}
                            onChange={(value) => setInviteRole(value as StaffInviteRole)}
                            options={STAFF_ROLE_OPTIONS}
                            title="Select Staff Role"
                            placeholder="Choose role"
                        />
                    )}
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
                                <UtilitySection title="Active Staff" count={filteredMembers.length}>
                                    <View style={s.block}>
                                    {filteredMembers.length === 0 ? (
                                        <Text style={[s.emptyText, { color: colors.textSecondary }]}>No staff members yet.</Text>
                                    ) : (
                                        filteredMembers.map((member) => (
                                            <View key={member.uid} style={[s.row, getSurfaceStyle(colors, { elevated: true })]}>
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
                                                    style={[s.inlineBtn, getPillStyle(colors, colors.error)]}
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
                                </UtilitySection>
                            );
                        }

                        return (
                            <UtilitySection title="Pending Invites" count={filteredInvites.length}>
                                <View style={s.block}>
                                {filteredInvites.length === 0 ? (
                                    <UtilityEmptyState
                                        icon="account-clock-outline"
                                        title="No pending invites"
                                        description="Open invite codes will appear here once you create them."
                                    />
                                ) : (
                                    filteredInvites.map((invite) => (
                                        <View key={invite.id} style={[s.row, getSurfaceStyle(colors, { elevated: true })]}>
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
                                                style={[s.inlineBtn, getPillStyle(colors, colors.error)]}
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
                            </UtilitySection>
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
        heroWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: Spacing.sm },
        searchWrap: { paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: Spacing.sm },
        statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, paddingHorizontal: DESIGN_SPACING.screenX, marginBottom: Spacing.sm },
        inviteCard: { marginHorizontal: DESIGN_SPACING.screenX, borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.md },
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
        block: { marginHorizontal: DESIGN_SPACING.screenX, marginBottom: Spacing.lg },
        row: {
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
        inlineBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
        emptyText: { fontSize: 13 },
    });
