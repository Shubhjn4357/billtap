import { useEffect, useMemo, useState } from 'react';
import {
    ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { toUserMessage } from '../../../api/client';
import { SettingsSection } from '../../../constants/enums';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Spacing, Typography, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { useAuthStore } from '../../../store/authStore';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { AppSearchBar } from '../../../components/ui/AppSearchBar';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import { UtilityHero } from '../../../components/ui/UtilityBlocks';
import { useSettingsSelector } from '../../../hooks/useSettingsSelector';
import { selectSecuritySettings } from '../../../selectors/settingsSelectors';
import {
    APP_ACTIONS,
    APP_MODULES,
    canPerformAction,
    getDefaultActionPermission,
    getDefaultModulePermission,
    ORGANIZATION_ROLES,
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
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useHaptics } from '../../../hooks/useHaptics';
import { useAppDialog } from '@/components/providers/DialogProvider';
import { settingsSectionQueryKey } from '../../../state/settingsQueryKeys';
import { useSettingsSectionMutation } from '../../../hooks/useSettingsSectionMutation';

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
    const dialog = useAppDialog();
    const colors = useAppColors();
    const s = styles(colors);
    const queryClient = useQueryClient();
    const smartBack = useSmartBack('/(main)/settings/privacy');
    const { selection } = useHaptics();
    const business = useAuthStore((state) => state.business);
    const role = useAuthStore((state) => state.organizationRole);
    const subscription = useAuthStore((state) => state.subscription);
    const canEditSettings = canPerformAction(role, 'settings.update', subscription, business) && role === 'owner';

    const [actionOverrides, setActionOverrides] = useState<RoleActionOverrides>({});
    const [moduleOverrides, setModuleOverrides] = useState<RoleModuleOverrides>({});
    const [selectedRole, setSelectedRole] = useState<OrganizationRole>('owner');
    const [search, setSearch] = useState('');

    const {
        sectionData: securitySettings,
        selected: securitySelection,
        isLoading,
        isRefetching,
        refetch,
    } = useSettingsSelector(SettingsSection.SECURITY, selectSecuritySettings);

    useEffect(() => {
        setActionOverrides(securitySelection.actionOverrides);
        setModuleOverrides(securitySelection.moduleOverrides);
    }, [securitySelection.actionOverrides, securitySelection.moduleOverrides]);
    const visibleModules = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return APP_MODULES;
        return APP_MODULES.filter((module) => MODULE_LABELS[module].toLowerCase().includes(needle));
    }, [search]);
    const visibleActions = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return APP_ACTIONS;
        return APP_ACTIONS.filter((action) => ACTION_LABELS[action].toLowerCase().includes(needle) || action.toLowerCase().includes(needle));
    }, [search]);
    const overrideCount = useMemo(() => {
        const moduleCount = Object.keys(moduleOverrides[selectedRole] ?? {}).length;
        const actionCount = Object.keys(actionOverrides[selectedRole] ?? {}).length;
        return { moduleCount, actionCount, total: moduleCount + actionCount };
    }, [actionOverrides, moduleOverrides, selectedRole]);

    const { mutate: saveOverrides, isPending: saving } = useSettingsSectionMutation('SECURITY', {
        onSuccess: async () => {
            setRoleAccessOverrides({ actionOverrides, moduleOverrides });
            await queryClient.invalidateQueries({ queryKey: settingsSectionQueryKey('SECURITY') });
            dialog.alert('Saved', 'Role access controls updated.');
        },
        onError: (error) => {
            dialog.alert('Save failed', toUserMessage(error, 'Unable to save role access controls.'));
        },
    });

    const saveRoleAccess = () => {
        if (!canEditSettings) {
            dialog.alert('Save failed', 'Only owner can update role access controls.');
            return;
        }
        const payload = {
            ...securitySettings,
            [ROLE_ACTION_OVERRIDES_KEY]: stringifyRoleActionOverrides(actionOverrides),
            [ROLE_MODULE_OVERRIDES_KEY]: stringifyRoleModuleOverrides(moduleOverrides),
        };
        saveOverrides(payload);
    };

    const resetToDefault = () => {
        dialog.alert(
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
                <AppTopBar title="Role Access" onBackPress={smartBack} />
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Role Access"
                subtitle="Module and action permissions"
                onBackPress={smartBack}
                rightAction={(
                    <Pressable
                        style={[s.saveBtn, { backgroundColor: canEditSettings ? colors.primary : colors.border }]}
                        onPress={saveRoleAccess}
                        disabled={saving || !canEditSettings}
                    >
                        {saving ? (
                            <ActivityIndicator color={colors.onPrimary} size="small" />
                        ) : (
                            <MaterialCommunityIcons name="content-save-outline" size={16} color={colors.onPrimary} />
                        )}
                    </Pressable>
                )}
            />

            {!canEditSettings ? (
                <View style={s.readOnlyBanner}>
                    <Text style={[s.readOnlyText, { color: colors.textSecondary }]}>
                        Only owner can edit role access. This view is read-only.
                    </Text>
                </View>
            ) : null}

            <ScrollView
                contentContainerStyle={s.content}
                refreshControl={(
                    <RefreshControl
                        tintColor={colors.primary}
                        refreshing={isRefetching}
                        onRefresh={() => {
                            refetch();
                        }}
                    />
                )}
            >
                <UtilityHero
                    title="Role Access Controls"
                    subtitle="Define module visibility and action overrides for each organization role."
                    icon="shield-account-outline"
                    tone="info"
                />
                <AppSearchBar
                    value={search}
                    onChangeText={setSearch}
                    placeholder="Search modules or actions..."
                />

                <View style={[s.summaryCard, getSurfaceStyle(colors, { elevated: true })]}>
                    <Text style={[s.summaryLabel, { color: colors.textSecondary }]}>ROLE ACCESS SUMMARY</Text>
                    <Text style={s.summaryValue}>{ROLE_LABELS[selectedRole]}</Text>
                    <Text style={[s.summaryMeta, { color: colors.textSecondary }]}>
                        {overrideCount.total} overrides ({overrideCount.moduleCount} modules, {overrideCount.actionCount} actions)
                    </Text>
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.roleChipsRow}>
                    {ORGANIZATION_ROLES.map((targetRole) => {
                        const active = selectedRole === targetRole;
                        return (
                            <ChipButton
                                key={targetRole}
                                label={ROLE_LABELS[targetRole]}
                                selected={active}
                                tone="info"
                                onPress={() => {
                                    void selection();
                                    setSelectedRole(targetRole);
                                }}
                            />
                        );
                    })}
                </ScrollView>

                <View style={s.toolsRow}>
                    <Pressable
                        style={[s.toolBtn, getPillStyle(colors)]}
                        onPress={resetToDefault}
                        disabled={!canEditSettings}
                    >
                        <Text style={[s.toolBtnText, { color: canEditSettings ? colors.text : colors.textSecondary }]}>Reset to Default</Text>
                    </Pressable>
                </View>

                <View key={selectedRole} style={[s.roleCard, getSurfaceStyle(colors, { elevated: true })]}>
                    <Text style={[s.roleTitle, { color: colors.text }]}>{ROLE_LABELS[selectedRole]}</Text>

                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>Module Access</Text>
                    {visibleModules.map((module) => {
                            const defaultValue = getDefaultModulePermission(selectedRole, module);
                            const overrideValue = moduleOverrides[selectedRole]?.[module];
                            const value = typeof overrideValue === 'boolean' ? overrideValue : defaultValue;
                            const overridden = isOverrideActive(value, defaultValue);

                            return (
                                <View key={`${selectedRole}-${module}`} style={s.row}>
                                    <View style={s.rowTextWrap}>
                                        <Text style={[s.rowLabel, { color: colors.text }]}>{MODULE_LABELS[module]}</Text>
                                        <Text style={[s.rowMeta, { color: overridden ? colors.primary : colors.textSecondary }]}>
                                            {overridden ? 'Override' : 'Default'}: {defaultValue ? 'On' : 'Off'}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={value}
                                        onValueChange={(next) => setModuleOverrides((current) => setRoleModule(current, selectedRole, module, next))}
                                        trackColor={{ true: colors.primary }}
                                        disabled={!canEditSettings}
                                    />
                                </View>
                            );
                        })}

                    <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>Action Access</Text>
                    {visibleActions.map((action) => {
                            const defaultValue = getDefaultActionPermission(selectedRole, action);
                            const overrideValue = actionOverrides[selectedRole]?.[action];
                            const value = typeof overrideValue === 'boolean' ? overrideValue : defaultValue;
                            const overridden = isOverrideActive(value, defaultValue);

                            return (
                                <View key={`${selectedRole}-${action}`} style={s.row}>
                                    <View style={s.rowTextWrap}>
                                        <Text style={[s.rowLabel, { color: colors.text }]}>{ACTION_LABELS[action]}</Text>
                                        <Text style={[s.rowMeta, { color: overridden ? colors.primary : colors.textSecondary }]}>
                                            {overridden ? 'Override' : 'Default'}: {defaultValue ? 'On' : 'Off'}
                                        </Text>
                                    </View>
                                    <Switch
                                        value={value}
                                        onValueChange={(next) => setActionOverrides((current) => setRoleAction(current, selectedRole, action, next))}
                                        trackColor={{ true: colors.primary }}
                                        disabled={!canEditSettings}
                                    />
                                </View>
                            );
                        })}
                    {visibleModules.length === 0 && visibleActions.length === 0 ? (
                        <View style={[s.emptyState, getSurfaceStyle(colors, { muted: true })]}>
                            <Text style={[s.emptyTitle, { color: colors.text }]}>No matching access controls</Text>
                            <Text style={[s.emptySubtitle, { color: colors.textSecondary }]}>Try a different search term.</Text>
                        </View>
                    ) : null}
                </View>

                <View style={{ height: 80 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        saveBtn: {
            ...getPillStyle(colors),
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 7,
            alignItems: 'center',
            minWidth: 44,
            justifyContent: 'center',
        },
        readOnlyBanner: { paddingHorizontal: DESIGN_SPACING.screenX, paddingBottom: Spacing.sm },
        readOnlyText: { fontSize: 12 },
        content: { paddingHorizontal: DESIGN_SPACING.screenX, gap: DESIGN_SPACING.sectionGap },
        summaryCard: {
            borderRadius: Radius.card,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
        },
        summaryLabel: { fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8 },
        summaryValue: { marginTop: 4, color: colors.text, fontSize: Typography.headline.size, fontWeight: '800' },
        summaryMeta: { marginTop: 2, fontSize: Typography.caption.size },
        roleChipsRow: { gap: Spacing.sm },
        toolsRow: { flexDirection: 'row', justifyContent: 'flex-end' },
        toolBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
        },
        toolBtnText: { fontSize: 12, fontWeight: '700' },
        roleCard: {
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
        emptyState: {
            borderRadius: Radius.card,
            paddingVertical: Spacing.md,
            alignItems: 'center',
            marginTop: Spacing.sm,
        },
        emptyTitle: { fontSize: Typography.body.size, fontWeight: '700' },
        emptySubtitle: { fontSize: Typography.caption.size },
    });
