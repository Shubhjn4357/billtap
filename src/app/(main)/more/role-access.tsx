import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    useColorScheme,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toUserMessage } from '../../../api/client';
import { settingsApi } from '../../../api/endpoints';
import { getColors, Radius, Spacing, type ColorPalette } from '../../../constants/theme';
import { useAuthStore } from '../../../store/authStore';
import {
    APP_ACTIONS,
    APP_MODULES,
    canPerformAction,
    getDefaultActionPermission,
    getDefaultModulePermission,
    ORGANIZATION_ROLES,
    parseRoleActionOverrides,
    parseRoleModuleOverrides,
    ROLE_ACTION_OVERRIDES_KEY,
    ROLE_MODULE_OVERRIDES_KEY,
    setRoleAccessOverrides,
    stringifyRoleActionOverrides,
    stringifyRoleModuleOverrides,
    type AppAction,
    type AppModule,
    type OrganizationRole,
    type RoleActionOverrides,
    type RoleModuleOverrides,
} from '../../../utils/accessControl';

const ROLE_LABELS: Record<OrganizationRole, string> = {
    owner: 'Owner',
    manager: 'Manager',
    salesman: 'Salesman',
    staff: 'Staff',
};

const ACTION_LABELS: Record<AppAction, string> = {
    'billing.create': 'Billing Create',
    'billing.update': 'Billing Update',
    'billing.delete': 'Billing Delete',
    'inventory.create': 'Inventory Create',
    'inventory.update': 'Inventory Update',
    'inventory.delete': 'Inventory Delete',
    'party.create': 'Party Create',
    'party.update': 'Party Update',
    'party.delete': 'Party Delete',
    'staff.invite': 'Staff Invite',
    'staff.remove': 'Staff Remove',
    'settings.update': 'Settings Update',
    'subscription.checkout': 'Subscription Checkout',
};

const MODULE_LABELS: Record<AppModule, string> = {
    home: 'Home',
    billing: 'Billing',
    inventory: 'Inventory',
    accounts: 'Accounts',
    reports: 'Reports',
    parties: 'Parties',
    settings: 'Settings',
    operations: 'Operations',
    staff: 'Staff',
};

const setRoleAction = (
    current: RoleActionOverrides,
    role: OrganizationRole,
    action: AppAction,
    next: boolean
): RoleActionOverrides => {
    const defaultValue = getDefaultActionPermission(role, action);
    const roleMap = { ...(current[role] ?? {}) };

    if (next === defaultValue) {
        delete roleMap[action];
    } else {
        roleMap[action] = next;
    }

    const nextMap: RoleActionOverrides = { ...current };
    if (Object.keys(roleMap).length === 0) {
        delete nextMap[role];
    } else {
        nextMap[role] = roleMap;
    }
    return nextMap;
};

const setRoleModule = (
    current: RoleModuleOverrides,
    role: OrganizationRole,
    module: AppModule,
    next: boolean
): RoleModuleOverrides => {
    const defaultValue = getDefaultModulePermission(role, module);
    const roleMap = { ...(current[role] ?? {}) };

    if (next === defaultValue) {
        delete roleMap[module];
    } else {
        roleMap[module] = next;
    }

    const nextMap: RoleModuleOverrides = { ...current };
    if (Object.keys(roleMap).length === 0) {
        delete nextMap[role];
    } else {
        nextMap[role] = roleMap;
    }
    return nextMap;
};

const isOverrideActive = (value: boolean, defaultValue: boolean) => value !== defaultValue;

export default function RoleAccessScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme ?? 'light');
    const s = styles(colors);
    const queryClient = useQueryClient();
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);
    const canEditSettings = canPerformAction(role, 'settings.update', subscription) && role === 'owner';

    const [actionOverrides, setActionOverrides] = useState<RoleActionOverrides>({});
    const [moduleOverrides, setModuleOverrides] = useState<RoleModuleOverrides>({});

    const { data, isLoading } = useQuery({
        queryKey: ['settings-section', 'SECURITY'],
        queryFn: () => settingsApi.get('SECURITY'),
    });

    const securitySettings = useMemo(
        () => ((data?.data ?? {}) as Record<string, unknown>),
        [data?.data]
    );

    useEffect(() => {
        setActionOverrides(parseRoleActionOverrides(securitySettings[ROLE_ACTION_OVERRIDES_KEY]));
        setModuleOverrides(parseRoleModuleOverrides(securitySettings[ROLE_MODULE_OVERRIDES_KEY]));
    }, [securitySettings]);

    const { mutate: saveOverrides, isPending: saving } = useMutation({
        mutationFn: async () => {
            if (!canEditSettings) {
                throw new Error('Only owner can update role access controls.');
            }
            const payload = {
                ...securitySettings,
                [ROLE_ACTION_OVERRIDES_KEY]: stringifyRoleActionOverrides(actionOverrides),
                [ROLE_MODULE_OVERRIDES_KEY]: stringifyRoleModuleOverrides(moduleOverrides),
            };
            return settingsApi.update('SECURITY', { data: payload });
        },
        onSuccess: async () => {
            setRoleAccessOverrides({ actionOverrides, moduleOverrides });
            await queryClient.invalidateQueries({ queryKey: ['settings-section', 'SECURITY'] });
            Alert.alert('Saved', 'Role access controls updated.');
        },
        onError: (error) => {
            Alert.alert('Save failed', toUserMessage(error, 'Unable to save role access controls.'));
        },
    });

    const resetToDefault = () => {
        Alert.alert(
            'Reset overrides',
            'Remove all custom overrides and use built-in default role access?',
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Reset',
                    style: 'destructive',
                    onPress: () => {
                        setActionOverrides({});
                        setModuleOverrides({});
                    },
                },
            ]
        );
    };

    if (isLoading) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <View style={s.header}>
                <Pressable onPress={() => router.back()}>
                    <Text style={[s.back, { color: colors.primary }]}>Back</Text>
                </Pressable>
                <Text style={s.title}>Role Access</Text>
                <Pressable onPress={() => saveOverrides()} disabled={saving || !canEditSettings}>
                    {saving ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.save, { color: canEditSettings ? colors.primary : colors.textSecondary }]}>Save</Text>}
                </Pressable>
            </View>

            {!canEditSettings ? (
                <View style={s.readOnlyBanner}>
                    <Text style={[s.readOnlyText, { color: colors.textSecondary }]}>
                        Only owner can edit role access. This view is read-only.
                    </Text>
                </View>
            ) : null}

            <ScrollView contentContainerStyle={s.content}>
                <View style={s.toolsRow}>
                    <Pressable
                        style={[s.toolBtn, { borderColor: colors.border }]}
                        onPress={resetToDefault}
                        disabled={!canEditSettings}
                    >
                        <Text style={[s.toolBtnText, { color: canEditSettings ? colors.text : colors.textSecondary }]}>Reset to Default</Text>
                    </Pressable>
                </View>

                {ORGANIZATION_ROLES.map((targetRole) => (
                    <View key={targetRole} style={[s.roleCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.roleTitle, { color: colors.text }]}>{ROLE_LABELS[targetRole]}</Text>

                        <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>Module Access</Text>
                        {APP_MODULES.map((module) => {
                            const defaultValue = getDefaultModulePermission(targetRole, module);
                            const overrideValue = moduleOverrides[targetRole]?.[module];
                            const value = typeof overrideValue === 'boolean' ? overrideValue : defaultValue;
                            const overridden = isOverrideActive(value, defaultValue);

                            return (
                                <View key={`${targetRole}-${module}`} style={s.row}>
                                    <View style={s.rowTextWrap}>
                                        <Text style={[s.rowLabel, { color: colors.text }]}>{MODULE_LABELS[module]}</Text>
                                        <Text style={[s.rowMeta, { color: overridden ? colors.primary : colors.textSecondary }]}>
                                            {overridden ? 'Override' : 'Default'}: {defaultValue ? 'On' : 'Off'}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={value}
                                        onValueChange={(next) => setModuleOverrides((current) => setRoleModule(current, targetRole, module, next))}
                                        trackColor={{ true: colors.primary }}
                                        disabled={!canEditSettings}
                                    />
                                </View>
                            );
                        })}

                        <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>Action Access</Text>
                        {APP_ACTIONS.map((action) => {
                            const defaultValue = getDefaultActionPermission(targetRole, action);
                            const overrideValue = actionOverrides[targetRole]?.[action];
                            const value = typeof overrideValue === 'boolean' ? overrideValue : defaultValue;
                            const overridden = isOverrideActive(value, defaultValue);

                            return (
                                <View key={`${targetRole}-${action}`} style={s.row}>
                                    <View style={s.rowTextWrap}>
                                        <Text style={[s.rowLabel, { color: colors.text }]}>{ACTION_LABELS[action]}</Text>
                                        <Text style={[s.rowMeta, { color: overridden ? colors.primary : colors.textSecondary }]}>
                                            {overridden ? 'Override' : 'Default'}: {defaultValue ? 'On' : 'Off'}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={value}
                                        onValueChange={(next) => setActionOverrides((current) => setRoleAction(current, targetRole, action, next))}
                                        trackColor={{ true: colors.primary }}
                                        disabled={!canEditSettings}
                                    />
                                </View>
                            );
                        })}
                    </View>
                ))}

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        header: {
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.md,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
        },
        back: { fontSize: 14, fontWeight: '600' },
        title: { fontSize: 17, fontWeight: '700', color: colors.text },
        save: { fontSize: 14, fontWeight: '700' },
        readOnlyBanner: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
        readOnlyText: { fontSize: 12 },
        content: { paddingHorizontal: Spacing.lg, gap: Spacing.md },
        toolsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
        toolBtn: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
        },
        toolBtnText: { fontSize: 12, fontWeight: '700' },
        roleCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            gap: Spacing.sm,
        },
        roleTitle: { fontSize: 15, fontWeight: '700' },
        sectionTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, marginTop: Spacing.sm },
        row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.sm },
        rowTextWrap: { flex: 1 },
        rowLabel: { fontSize: 13, fontWeight: '600' },
        rowMeta: { fontSize: 11, marginTop: 2 },
    });
