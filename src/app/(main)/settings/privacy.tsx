import { router } from 'expo-router';
import { useAppRuntime } from '../../../components/providers/AppRuntimeProvider';
import {
    SettingsFieldCard,
    SettingsHeroCard,
    SettingsLinkRow,
    SettingsPageShell,
    SettingsSectionGroup,
    SettingsStatusPill,
    SettingsToggleRow,
} from '../../../components/settings/SettingsBlocks';
import { SettingsSection } from '../../../constants/enums';
import { useAppColors } from '../../../hooks/useAppColors';
import { useSettingsSelector } from '../../../hooks/useSettingsSelector';
import { selectSecuritySettings } from '../../../selectors/settingsSelectors';
import { useSettingsSectionMutation } from '../../../hooks/useSettingsSectionMutation';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { toUserMessage } from '../../../api/client';
import { useAppDialog } from '@/components/providers/DialogProvider';

export default function PrivacySettingsScreen() {
    const dialog = useAppDialog();
    const colors = useAppColors();
    const smartBack = useSmartBack('/(main)/settings');
    const { biometricSupported, localPreferences, updateLocalPreferences } = useAppRuntime();
    const { sectionData, selected } = useSettingsSelector(SettingsSection.SECURITY, selectSecuritySettings);

    const securityMutation = useSettingsSectionMutation(SettingsSection.SECURITY, {
        onError: (error) => dialog.alert('Save failed', toUserMessage(error, 'Unable to save privacy settings.')),
    });

    const saveSecurity = (patch: Record<string, unknown>) => {
        securityMutation.mutate({
            ...sectionData,
            ...patch,
        });
    };

    const actionOverrideCount = Object.keys(selected.actionOverrides).length;
    const moduleOverrideCount = Object.keys(selected.moduleOverrides).length;

    return (
        <SettingsPageShell
            title="Privacy"
            subtitle="Security, biometrics, staff, and role-based access control"
            onBackPress={smartBack}
            contextChip={{ label: biometricSupported ? 'Biometric ready' : 'Device limited' }}
        >
            <SettingsHeroCard
                title="Protect the workspace"
                subtitle="Use device lock for personal privacy and business security rules for staff-facing restrictions."
                primaryLabel={selected.enablePasscode ? 'Passcode on' : 'Passcode off'}
                secondaryLabel={selected.enableBiometric ? 'Biometric on' : 'Biometric off'}
            />

            <SettingsSectionGroup
                title="Device privacy"
                subtitle="These controls affect how the app behaves on the current device."
            >
                <SettingsToggleRow
                    icon="fingerprint"
                    title="Biometric lock"
                    subtitle={biometricSupported ? 'Lock the app when returning from background.' : 'Biometric lock is not available on this device.'}
                    value={localPreferences.biometricLockEnabled}
                    disabled={!biometricSupported}
                    onValueChange={(value) => {
                        void updateLocalPreferences({ biometricLockEnabled: value });
                    }}
                />
                <SettingsToggleRow
                    icon="gesture-swipe"
                    title="Gesture navigation"
                    subtitle="Keep in-app back and forward gestures responsive on mobile."
                    value={localPreferences.gestureNavigationEnabled}
                    onValueChange={(value) => {
                        void updateLocalPreferences({ gestureNavigationEnabled: value });
                    }}
                />
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Business security"
                subtitle="These settings are stored with the business and affect approval-sensitive workflows."
                action={<SettingsStatusPill label={selected.enablePasscode ? 'Protected' : 'Open'} tone="warning" />}
            >
                <SettingsToggleRow
                    icon="form-textbox-password"
                    title="Business passcode"
                    subtitle="Use a business-level passcode gate for protected actions."
                    value={selected.enablePasscode}
                    onValueChange={(value) => saveSecurity({ enable_passcode: value })}
                />
                <SettingsToggleRow
                    icon="face-recognition"
                    title="Business biometric approval"
                    subtitle="Allow biometric approval where the business policy supports it."
                    value={selected.enableBiometric}
                    disabled={!biometricSupported}
                    onValueChange={(value) => saveSecurity({ enable_biometric: value })}
                />
                <SettingsFieldCard
                    icon="shield-account-outline"
                    title="Role override state"
                    subtitle="Action and module overrides are managed in their dedicated screens, but their current volume stays visible here."
                    accent={colors.warning}
                >
                    <SettingsStatusPill label={`${actionOverrideCount} action overrides`} tone="info" />
                    <SettingsStatusPill label={`${moduleOverrideCount} module overrides`} tone="info" />
                </SettingsFieldCard>
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="People and permissions"
                subtitle="Manage role access from dedicated screens instead of raw JSON editors."
            >
                <SettingsLinkRow
                    icon="account-group-outline"
                    title="Staff & roles"
                    subtitle="Invite team members and manage staff access by person."
                    onPress={() => router.push('/(main)/settings/staff' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="shield-account-outline"
                    title="Role access"
                    subtitle="Control module access and action permission maps."
                    onPress={() => router.push('/(main)/settings/role-access' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="cog-transfer-outline"
                    title="Operations controls"
                    subtitle="Approval flow, period locks, and operational restrictions."
                    onPress={() => router.push('/(main)/settings/operations' as Parameters<typeof router.push>[0])}
                />
            </SettingsSectionGroup>
        </SettingsPageShell>
    );
}
