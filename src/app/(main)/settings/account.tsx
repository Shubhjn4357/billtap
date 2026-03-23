import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppInput } from '../../../components/ui/AppInput';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import { SelectField } from '../../../components/ui/SelectField';
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
import { DESIGN_SPACING } from '../../../constants/designSystem';
import { type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { useSettingsSelector } from '../../../hooks/useSettingsSelector';
import { useSettingsSectionMutation } from '../../../hooks/useSettingsSectionMutation';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useAuthStore } from '../../../store/authStore';
import { toUserMessage } from '../../../api/client';
import { useAppDialog } from '@/components/providers/DialogProvider';

const CURRENCY_OPTIONS = [
    { label: 'INR', value: 'INR', description: 'Indian Rupee' },
    { label: 'USD', value: 'USD', description: 'US Dollar' },
    { label: 'AED', value: 'AED', description: 'UAE Dirham' },
    { label: 'EUR', value: 'EUR', description: 'Euro' },
];

const DATE_FORMAT_OPTIONS = ['DD_MM_YYYY', 'DD_MMM_YYYY'] as const;
const DECIMAL_OPTIONS = [0, 1, 2, 3, 4] as const;
const BACKUP_FREQUENCY_OPTIONS = [1, 3, 7, 15, 30] as const;

export default function AccountSettingsScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const dialog = useAppDialog();
    const smartBack = useSmartBack('/(main)/settings');
    const subscription = useAuthStore((state) => state.subscription);
    const business = useAuthStore((state) => state.business);

    const { sectionData: general } = useSettingsSelector(SettingsSection.GENERAL, (value) => value);
    const { sectionData: multiFirm } = useSettingsSelector(SettingsSection.MULTI_FIRM, (value) => value);
    const { sectionData: backup } = useSettingsSelector(SettingsSection.BACKUP_SETTINGS, (value) => value);

    const [receiverName, setReceiverName] = useState('');
    const [upiId, setUpiId] = useState('');
    const [signatureUrl, setSignatureUrl] = useState('');

    useEffect(() => {
        setReceiverName(typeof general.payment_receiver_name === 'string' ? general.payment_receiver_name : '');
        setUpiId(typeof general.payment_upi_id === 'string' ? general.payment_upi_id : '');
        setSignatureUrl(typeof general.signature_url === 'string' ? general.signature_url : '');
    }, [general.payment_receiver_name, general.payment_upi_id, general.signature_url]);

    const generalMutation = useSettingsSectionMutation(SettingsSection.GENERAL, {
        onError: (error) => {
            dialog.alert('Save failed', toUserMessage(error, 'Unable to save account defaults.'));
        },
    });
    const multiFirmMutation = useSettingsSectionMutation(SettingsSection.MULTI_FIRM, {
        onError: (error) => {
            dialog.alert('Save failed', toUserMessage(error, 'Unable to save multi-firm settings.'));
        },
    });
    const backupMutation = useSettingsSectionMutation(SettingsSection.BACKUP_SETTINGS, {
        onError: (error) => {
            dialog.alert('Save failed', toUserMessage(error, 'Unable to save backup settings.'));
        },
    });

    const saveGeneral = (patch: Record<string, unknown>) => {
        generalMutation.mutate({
            ...general,
            ...patch,
        });
    };

    const saveMultiFirm = (patch: Record<string, unknown>) => {
        multiFirmMutation.mutate({
            ...multiFirm,
            ...patch,
        });
    };

    const saveBackup = (patch: Record<string, unknown>) => {
        backupMutation.mutate({
            ...backup,
            ...patch,
        });
    };

    const profileSaved = useMemo(() => {
        return Boolean(upiId.trim() || receiverName.trim() || signatureUrl.trim());
    }, [receiverName, signatureUrl, upiId]);

    return (
        <SettingsPageShell
            title="Account"
            subtitle="Business defaults, firm behavior, backups, and renewal-sensitive controls"
            onBackPress={smartBack}
            contextChip={{ label: subscription?.tier ?? 'FREE' }}
        >
            <SettingsHeroCard
                title={business?.name ?? 'Business account'}
                subtitle="Clear, direct controls for business identity, payment collection, multi-firm behavior, and backup policy."
                primaryLabel={subscription?.status ?? 'active'}
                secondaryLabel={business?.code ?? 'primary firm'}
            />

            <SettingsSectionGroup
                title="Business defaults"
                subtitle="Use sensible defaults so every screen inherits the same money and date behavior."
                action={<SettingsStatusPill label={String(general.business_currency ?? 'INR')} tone="info" />}
            >
                <SettingsFieldCard
                    icon="cash-multiple"
                    title="Currency and decimals"
                    subtitle="Choose the working currency and how many decimals should show in totals."
                >
                    <SelectField
                        title="Business currency"
                        placeholder="Select currency"
                        value={typeof general.business_currency === 'string' ? general.business_currency : 'INR'}
                        options={CURRENCY_OPTIONS}
                        searchable={false}
                        onChange={(value) => saveGeneral({ business_currency: value })}
                    />
                    <View style={s.choiceWrap}>
                        {DECIMAL_OPTIONS.map((value) => (
                            <ChipButton
                                key={`decimal-${value}`}
                                label={`${value} decimals`}
                                selected={Number(general.decimal_places ?? 2) === value}
                                tone="info"
                                onPress={() => saveGeneral({ decimal_places: value })}
                            />
                        ))}
                    </View>
                </SettingsFieldCard>

                <SettingsFieldCard
                    icon="calendar-range"
                    title="Date format"
                    subtitle="Keep invoice, report, and activity dates easy to scan."
                >
                    <View style={s.choiceWrap}>
                        {DATE_FORMAT_OPTIONS.map((value) => (
                            <ChipButton
                                key={value}
                                label={value === 'DD_MM_YYYY' ? 'DD/MM/YYYY' : 'DD MMM YYYY'}
                                selected={String(general.date_format ?? 'DD_MM_YYYY') === value}
                                tone="info"
                                onPress={() => saveGeneral({ date_format: value })}
                            />
                        ))}
                    </View>
                </SettingsFieldCard>
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Payments and identity"
                subtitle="Collect UPI faster and keep your signature and receiver details in one place."
            >
                <SettingsFieldCard
                    icon="qrcode-scan"
                    title="UPI collection"
                    subtitle="Receiver name and UPI ID are used in invoices, payment prompts, and QR-based collection."
                    accent={colors.success}
                >
                    <AppInput
                        inputType="text"
                        value={receiverName}
                        onChangeText={setReceiverName}
                        placeholder="Receiver name"
                    />
                    <AppInput
                        inputType="text"
                        value={upiId}
                        onChangeText={setUpiId}
                        placeholder="UPI ID"
                        autoCapitalize="none"
                    />
                    <View style={s.actionRow}>
                        <ChipButton
                            label={profileSaved ? 'Save payment details' : 'Save details'}
                            variant="action"
                            tone="success"
                            onPress={() => saveGeneral({
                                payment_receiver_name: receiverName.trim() || null,
                                payment_upi_id: upiId.trim() || null,
                            })}
                        />
                    </View>
                </SettingsFieldCard>

                <SettingsFieldCard
                    icon="draw"
                    title="Signature"
                    subtitle="Use an image URL when you want signature support in printed or shared documents."
                    accent={colors.info}
                >
                    <AppInput
                        inputType="url"
                        value={signatureUrl}
                        onChangeText={setSignatureUrl}
                        placeholder="Signature image URL"
                        autoCapitalize="none"
                    />
                    <View style={s.actionRow}>
                        <ChipButton
                            label="Save signature"
                            variant="action"
                            tone="info"
                            onPress={() => saveGeneral({ signature_url: signatureUrl.trim() || null })}
                        />
                    </View>
                </SettingsFieldCard>
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Firm behavior"
                subtitle="Choose whether multiple firms are enabled and whether switching should feel instant."
            >
                <SettingsToggleRow
                    icon="domain"
                    title="Multi-firm mode"
                    subtitle="Enable more than one firm inside the same account workspace."
                    value={Boolean(multiFirm.multi_firm_enabled)}
                    onValueChange={(value) => saveMultiFirm({ multi_firm_enabled: value })}
                />
                <SettingsToggleRow
                    icon="domain-switch"
                    title="Switch without restart"
                    subtitle="Allow fast business switching directly from the app shell."
                    value={Boolean(multiFirm.allow_firm_switching_without_restart ?? true)}
                    onValueChange={(value) => saveMultiFirm({ allow_firm_switching_without_restart: value })}
                />
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Backups"
                subtitle="Control how often the app should prepare backups and where they should go."
                action={<SettingsStatusPill label={Boolean(backup.auto_backup_enabled) ? 'Enabled' : 'Disabled'} tone="warning" />}
            >
                <SettingsToggleRow
                    icon="backup-restore"
                    title="Automatic backup"
                    subtitle="Prepare scheduled backups from the business settings layer."
                    value={Boolean(backup.auto_backup_enabled)}
                    onValueChange={(value) => saveBackup({ auto_backup_enabled: value })}
                />
                <SettingsFieldCard
                    icon="calendar-clock"
                    title="Backup frequency"
                    subtitle="Pick the backup cycle in days."
                    accent={colors.warning}
                >
                    <View style={s.choiceWrap}>
                        {BACKUP_FREQUENCY_OPTIONS.map((value) => (
                            <ChipButton
                                key={`backup-${value}`}
                                label={`${value}d`}
                                selected={Number(backup.backup_frequency_days ?? 1) === value}
                                tone="warning"
                                onPress={() => saveBackup({ backup_frequency_days: value })}
                            />
                        ))}
                    </View>
                </SettingsFieldCard>
                <SettingsFieldCard
                    icon="cloud-upload-outline"
                    title="Backup destination"
                    subtitle="Pick whether backups stay local or move to the cloud."
                    accent={colors.warning}
                >
                    <View style={s.choiceWrap}>
                        {['LOCAL', 'CLOUD'].map((value) => (
                            <ChipButton
                                key={value}
                                label={value === 'LOCAL' ? 'Local only' : 'Cloud backup'}
                                selected={String(backup.backup_destination ?? 'LOCAL') === value}
                                tone="warning"
                                onPress={() => saveBackup({ backup_destination: value })}
                            />
                        ))}
                    </View>
                </SettingsFieldCard>
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Shortcuts"
                subtitle="Fast links for plan review and firm switching."
            >
                <SettingsLinkRow
                    icon="crown-outline"
                    title="Subscription"
                    subtitle="Review plan status, limits, and renewal-sensitive cloud controls."
                    value={subscription?.status ?? 'active'}
                    onPress={() => router.push('/(main)/settings/subscription' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="domain-switch"
                    title="Switch business"
                    subtitle="Change the active firm without opening the drawer."
                    onPress={() => router.push('/(auth)/business-select' as Parameters<typeof router.push>[0])}
                />
            </SettingsSectionGroup>
        </SettingsPageShell>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        choiceWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: DESIGN_SPACING.cardGap,
        },
        actionRow: {
            flexDirection: 'row',
            justifyContent: 'flex-start',
        },
    });
