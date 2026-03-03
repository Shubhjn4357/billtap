import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    FlatList,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { staffApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import type { StaffInvite, StaffMember } from '../../../types/domain';

export default function StaffScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme);
    const s = styles(colors);
    const qc = useQueryClient();
    const [phoneNumber, setPhoneNumber] = useState('');

    const { data, isLoading } = useQuery({
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

    const members = (data?.data?.staff ?? []) as StaffMember[];
    const invites = (data?.data?.invites ?? []) as StaffInvite[];

    const onInvite = async () => {
        const trimmed = phoneNumber.trim();
        if (!trimmed) return;

        try {
            const response = await inviteStaff(trimmed);
            Alert.alert('Invite created', `Code: ${response.data?.code ?? ''}`);
            setPhoneNumber('');
        } catch (error) {
            Alert.alert('Invite failed', error instanceof Error ? error.message : 'Unable to create invite.');
        }
    };

    const confirmRemoveStaff = (uid: string, name: string | null) => {
        Alert.alert('Remove staff', `Remove ${name ?? 'this member'} from staff list?`, [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Remove',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await removeStaff(uid);
                    } catch (error) {
                        Alert.alert('Remove failed', error instanceof Error ? error.message : 'Unable to remove staff.');
                    }
                },
            },
        ]);
    };

    const confirmDeleteInvite = (id: string) => {
        Alert.alert('Delete invite', 'Delete this pending invite?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Delete',
                style: 'destructive',
                onPress: async () => {
                    try {
                        await removeInvite(id);
                    } catch (error) {
                        Alert.alert('Delete failed', error instanceof Error ? error.message : 'Unable to delete invite.');
                    }
                },
            },
        ]);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>{'< Back'}</Text>
                </Pressable>
                <Text style={[s.title, { color: colors.text }]}>Staff & Roles</Text>
                <View style={{ width: 58 }} />
            </View>

            <View style={[s.inviteCard, { backgroundColor: colors.card }]}> 
                <Text style={[s.sectionTitle, { color: colors.text }]}>Invite Staff</Text>
                <View style={s.inviteRow}>
                    <TextInput
                        style={[s.input, { borderColor: colors.border, color: colors.text }]}
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        placeholder="Phone number"
                        placeholderTextColor={colors.textSecondary}
                        keyboardType="phone-pad"
                    />
                    <Pressable style={[s.inviteBtn, { backgroundColor: colors.primary }]} onPress={onInvite} disabled={inviting || phoneNumber.trim().length === 0}>
                        {inviting ? <ActivityIndicator size="small" color="#fff" /> : <Text style={s.inviteBtnText}>Invite</Text>}
                    </Pressable>
                </View>
            </View>

            {isLoading ? (
                <View style={s.centered}><ActivityIndicator color={colors.primary} /></View>
            ) : (
                <FlatList
                    data={[{ key: 'members' }, { key: 'invites' }]}
                    keyExtractor={(i) => i.key}
                    renderItem={({ item }) => {
                        if (item.key === 'members') {
                            return (
                                <View style={s.block}>
                                    <Text style={[s.blockTitle, { color: colors.textSecondary }]}>Active Staff</Text>
                                    {members.length === 0 ? (
                                        <Text style={[s.emptyText, { color: colors.textSecondary }]}>No staff members yet.</Text>
                                    ) : (
                                        members.map((member) => (
                                            <View key={member.uid} style={[s.row, { backgroundColor: colors.card }]}> 
                                                <View style={{ flex: 1 }}>
                                                    <Text style={[s.name, { color: colors.text }]}>{member.displayName ?? member.phoneNumber ?? member.uid}</Text>
                                                    <Text style={[s.meta, { color: colors.textSecondary }]}>{member.phoneNumber ?? member.email ?? '-'}</Text>
                                                    <Text style={[s.meta, { color: colors.textSecondary }]}>Role: {member.role}</Text>
                                                </View>
                                                <Pressable
                                                    style={[s.inlineBtn, { borderColor: colors.error }]}
                                                    onPress={() => confirmRemoveStaff(member.uid, member.displayName)}
                                                    disabled={removing}
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
                                {invites.length === 0 ? (
                                    <Text style={[s.emptyText, { color: colors.textSecondary }]}>No pending invites.</Text>
                                ) : (
                                    invites.map((invite) => (
                                        <View key={invite.id} style={[s.row, { backgroundColor: colors.card }]}> 
                                            <View style={{ flex: 1 }}>
                                                <Text style={[s.name, { color: colors.text }]}>{invite.phoneNumber}</Text>
                                                <Text style={[s.meta, { color: colors.textSecondary }]}>Code: {invite.code}</Text>
                                                <Text style={[s.meta, { color: colors.textSecondary }]}>Status: {invite.status}</Text>
                                            </View>
                                            <Pressable
                                                style={[s.inlineBtn, { borderColor: colors.error }]}
                                                onPress={() => confirmDeleteInvite(invite.id)}
                                                disabled={removingInvite}
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
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.lg, paddingVertical: Spacing.md },
        back: { width: 58, fontWeight: '600', fontSize: 14 },
        title: { flex: 1, textAlign: 'center', fontSize: 16, fontWeight: '700' },
        inviteCard: { marginHorizontal: Spacing.lg, borderRadius: Radius.card, padding: Spacing.md, marginBottom: Spacing.md },
        sectionTitle: { fontWeight: '700', fontSize: 14, marginBottom: Spacing.sm },
        inviteRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
        input: { flex: 1, borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm, fontSize: 14 },
        inviteBtn: { borderRadius: Radius.pill, paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, minWidth: 74, alignItems: 'center' },
        inviteBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        block: { marginHorizontal: Spacing.lg, marginBottom: Spacing.lg },
        blockTitle: { fontWeight: '700', fontSize: 12, marginBottom: Spacing.sm, textTransform: 'uppercase' },
        row: {
            borderRadius: Radius.card,
            padding: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            marginBottom: Spacing.sm,
        },
        name: { fontWeight: '700', fontSize: 14 },
        meta: { fontSize: 12, marginTop: 2 },
        inlineBtn: { borderWidth: 1, borderRadius: Radius.pill, paddingHorizontal: Spacing.sm, paddingVertical: 6 },
        emptyText: { fontSize: 13 },
    });
