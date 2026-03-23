import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { AppInput } from '../../../components/ui/AppInput';
import { ChipButton } from '../../../components/ui/ChipBlocks';
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
import { DESIGN_SPACING, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, type ColorPalette } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { useSettingsSelector } from '../../../hooks/useSettingsSelector';
import { useSettingsSectionMutation } from '../../../hooks/useSettingsSectionMutation';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { toUserMessage } from '../../../api/client';
import { useAppDialog } from '@/components/providers/DialogProvider';

const SHARE_MODE_OPTIONS = ['ASK_EVERY_TIME', 'PDF', 'IMAGE', 'EMAIL'] as const;
const ROUND_OFF_MODES = ['NEAREST', 'UP', 'DOWN'] as const;
const ROUND_OFF_VALUES = [1, 5, 10, 50] as const;
const PRINT_ROW_OPTIONS = [0, 2, 4, 6, 8] as const;

export default function BillingSettingsScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const dialog = useAppDialog();
    const smartBack = useSmartBack('/(main)/settings');

    const { sectionData: gst } = useSettingsSelector(SettingsSection.TAXES_AND_GST, (value) => value);
    const { sectionData: header } = useSettingsSelector(SettingsSection.TRANSACTION_HEADER, (value) => value);
    const { sectionData: table } = useSettingsSelector(SettingsSection.ITEM_TABLE, (value) => value);
    const { sectionData: totals } = useSettingsSelector(SettingsSection.TAX_DISCOUNT_TOTAL, (value) => value);
    const { sectionData: more } = useSettingsSelector(SettingsSection.MORE_TRANSACTION_FEATURES, (value) => value);

    const [compositeUserType, setCompositeUserType] = useState('');

    useEffect(() => {
        setCompositeUserType(typeof gst.composite_user_type === 'string' ? gst.composite_user_type : '');
    }, [gst.composite_user_type]);

    const gstMutation = useSettingsSectionMutation(SettingsSection.TAXES_AND_GST, {
        onError: (error) => dialog.alert('Save failed', toUserMessage(error, 'Unable to save GST settings.')),
    });
    const headerMutation = useSettingsSectionMutation(SettingsSection.TRANSACTION_HEADER, {
        onError: (error) => dialog.alert('Save failed', toUserMessage(error, 'Unable to save invoice header settings.')),
    });
    const tableMutation = useSettingsSectionMutation(SettingsSection.ITEM_TABLE, {
        onError: (error) => dialog.alert('Save failed', toUserMessage(error, 'Unable to save item table settings.')),
    });
    const totalsMutation = useSettingsSectionMutation(SettingsSection.TAX_DISCOUNT_TOTAL, {
        onError: (error) => dialog.alert('Save failed', toUserMessage(error, 'Unable to save tax and total settings.')),
    });
    const moreMutation = useSettingsSectionMutation(SettingsSection.MORE_TRANSACTION_FEATURES, {
        onError: (error) => dialog.alert('Save failed', toUserMessage(error, 'Unable to save billing workflow settings.')),
    });

    const saveGst = (patch: Record<string, unknown>) => gstMutation.mutate({ ...gst, ...patch });
    const saveHeader = (patch: Record<string, unknown>) => headerMutation.mutate({ ...header, ...patch });
    const saveTable = (patch: Record<string, unknown>) => tableMutation.mutate({ ...table, ...patch });
    const saveTotals = (patch: Record<string, unknown>) => totalsMutation.mutate({ ...totals, ...patch });
    const saveMore = (patch: Record<string, unknown>) => moreMutation.mutate({ ...more, ...patch });

    return (
        <SettingsPageShell
            title="Billing"
            subtitle="GST behavior, invoice structure, line-item rules, totals, and document extras"
            onBackPress={smartBack}
            contextChip={{ label: Boolean(gst.gst_enabled) ? 'GST on' : 'GST off' }}
        >
            <SettingsHeroCard
                title="Invoice behavior"
                subtitle="Control what appears in bills, how taxes behave, how totals round, and how documents are shared."
                primaryLabel={Boolean(gst.gst_enabled) ? 'Tax invoices' : 'Non-GST mode'}
                secondaryLabel={Boolean(more.invoice_preview_enabled ?? true) ? 'Preview enabled' : 'Preview off'}
            />

            <SettingsSectionGroup
                title="GST and taxation"
                subtitle="Keep tax defaults explicit so line items and invoice totals stay predictable."
                action={<SettingsStatusPill label={Boolean(gst.gst_enabled) ? 'GST enabled' : 'GST disabled'} tone="info" />}
            >
                <SettingsToggleRow
                    icon="file-percent-outline"
                    title="Enable GST"
                    subtitle="Turn GST-specific invoice behavior on or off for the business."
                    value={Boolean(gst.gst_enabled)}
                    onValueChange={(value) => saveGst({ gst_enabled: value })}
                />
                <SettingsToggleRow
                    icon="barcode"
                    title="HSN / SAC"
                    subtitle="Show HSN or SAC support in items and invoices."
                    value={Boolean(gst.hsn_sac_enabled)}
                    onValueChange={(value) => saveGst({ hsn_sac_enabled: value })}
                />
                <SettingsToggleRow
                    icon="map-marker-radius-outline"
                    title="State of supply"
                    subtitle="Use supply state logic for interstate and intrastate GST treatment."
                    value={Boolean(gst.state_of_supply_enabled)}
                    onValueChange={(value) => saveGst({ state_of_supply_enabled: value })}
                />
                <SettingsToggleRow
                    icon="truck-delivery-outline"
                    title="E-Way bill field"
                    subtitle="Allow E-Way bill details in invoice and dispatch workflows."
                    value={Boolean(gst.eway_bill_no_enabled)}
                    onValueChange={(value) => saveGst({ eway_bill_no_enabled: value })}
                />
                <SettingsToggleRow
                    icon="calculator-variant-outline"
                    title="TCS and TDS"
                    subtitle="Keep tax collection and deduction controls visible when required."
                    value={Boolean(gst.tcs_enabled || gst.tds_enabled)}
                    onValueChange={(value) => saveGst({ tcs_enabled: value, tds_enabled: value })}
                />
                <SettingsFieldCard
                    icon="receipt-text-check-outline"
                    title="Composite and special cases"
                    subtitle="Use this only when composite scheme, reverse charge, or additional cess must be visible in billing."
                >
                    <View style={s.choiceWrap}>
                        <ChipButton
                            label="Composite scheme"
                            selected={Boolean(gst.composite_scheme_enabled)}
                            tone="info"
                            onPress={() => saveGst({ composite_scheme_enabled: !Boolean(gst.composite_scheme_enabled) })}
                        />
                        <ChipButton
                            label="Reverse charge"
                            selected={Boolean(gst.reverse_charge_enabled)}
                            tone="warning"
                            onPress={() => saveGst({ reverse_charge_enabled: !Boolean(gst.reverse_charge_enabled) })}
                        />
                        <ChipButton
                            label="Additional cess"
                            selected={Boolean(gst.additional_cess_enabled)}
                            tone="warning"
                            onPress={() => saveGst({ additional_cess_enabled: !Boolean(gst.additional_cess_enabled) })}
                        />
                    </View>
                    {Boolean(gst.composite_scheme_enabled) ? (
                        <View style={s.inlineField}>
                            <AppInput
                                inputType="text"
                                value={compositeUserType}
                                onChangeText={setCompositeUserType}
                                placeholder="Composite user type"
                            />
                            <ChipButton
                                label="Save type"
                                variant="action"
                                tone="info"
                                onPress={() => saveGst({ composite_user_type: compositeUserType.trim() || null })}
                            />
                        </View>
                    ) : null}
                </SettingsFieldCard>
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Header and invoice identity"
                subtitle="Decide what should appear before the first line item."
            >
                <SettingsToggleRow
                    icon="identifier"
                    title="Custom invoice number"
                    subtitle="Allow invoice numbering and naming rules to be customized."
                    value={Boolean(header.invoice_number_customizable)}
                    onValueChange={(value) => saveHeader({ invoice_number_customizable: value })}
                />
                <SettingsToggleRow
                    icon="cash-fast"
                    title="Cash sale by default"
                    subtitle="Start invoice creation in cash-sale mode."
                    value={Boolean(header.cash_sale_by_default)}
                    onValueChange={(value) => saveHeader({ cash_sale_by_default: value })}
                />
                <SettingsToggleRow
                    icon="account-box-outline"
                    title="Billing name of parties"
                    subtitle="Show billing name details before the table."
                    value={Boolean(header.billing_name_of_parties_enabled)}
                    onValueChange={(value) => saveHeader({ billing_name_of_parties_enabled: value })}
                />
                <SettingsToggleRow
                    icon="clipboard-text-clock-outline"
                    title="PO details and time stamps"
                    subtitle="Let invoice headers carry PO information and transaction time."
                    value={Boolean(header.po_details_enabled || header.add_time_on_transactions || header.print_time_on_invoices)}
                    onValueChange={(value) => saveHeader({
                        po_details_enabled: value,
                        add_time_on_transactions: value,
                        print_time_on_invoices: value,
                    })}
                />
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Item table"
                subtitle="Keep the billing table clean while still exposing the right stock and pricing tools."
            >
                <SettingsToggleRow
                    icon="swap-horizontal"
                    title="Inclusive / exclusive switch"
                    subtitle="Let billing choose tax-inclusive or tax-exclusive row pricing."
                    value={Boolean(table.inclusive_exclusive_tax_switch_enabled)}
                    onValueChange={(value) => saveTable({ inclusive_exclusive_tax_switch_enabled: value })}
                />
                <SettingsToggleRow
                    icon="tag-text-outline"
                    title="Show purchase price"
                    subtitle="Expose purchase cost during billing when margin visibility matters."
                    value={Boolean(table.display_purchase_price)}
                    onValueChange={(value) => saveTable({ display_purchase_price: value })}
                />
                <SettingsToggleRow
                    icon="gift-outline"
                    title="Free quantity and scan tools"
                    subtitle="Enable free quantity and barcode scan behavior inside transaction rows."
                    value={Boolean(table.free_item_quantity_enabled || table.barcode_scanning_in_transactions_enabled)}
                    onValueChange={(value) => saveTable({
                        free_item_quantity_enabled: value,
                        barcode_scanning_in_transactions_enabled: value,
                    })}
                />
                <SettingsFieldCard
                    icon="table-row-height"
                    title="Minimum printed rows"
                    subtitle="Pad small invoices with fixed blank lines so printed slips feel balanced."
                >
                    <View style={s.choiceWrap}>
                        {PRINT_ROW_OPTIONS.map((value) => (
                            <ChipButton
                                key={`rows-${value}`}
                                label={value === 0 ? 'Auto' : `${value} rows`}
                                selected={Number(table.item_table_min_rows_print ?? 0) === value}
                                tone="info"
                                onPress={() => saveTable({ item_table_min_rows_print: value })}
                            />
                        ))}
                    </View>
                </SettingsFieldCard>
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Totals and workflow"
                subtitle="Choose how totals round, how invoices are shared, and how much workflow guidance billing should provide."
            >
                <SettingsToggleRow
                    icon="percent-outline"
                    title="Transaction tax and discount"
                    subtitle="Apply tax and discount controls at the document level."
                    value={Boolean(totals.transaction_wise_tax_enabled || totals.transaction_wise_discount_enabled)}
                    onValueChange={(value) => saveTotals({
                        transaction_wise_tax_enabled: value,
                        transaction_wise_discount_enabled: value,
                    })}
                />
                <SettingsToggleRow
                    icon="link-variant"
                    title="Link payments to invoices"
                    subtitle="Tie payment entries and due-date workflows directly to the bill."
                    value={Boolean(more.link_payments_to_invoices_enabled)}
                    onValueChange={(value) => saveMore({ link_payments_to_invoices_enabled: value })}
                />
                <SettingsToggleRow
                    icon="file-eye-outline"
                    title="Preview before share"
                    subtitle="Show invoice preview and due-date prompts before final output."
                    value={Boolean(more.invoice_preview_enabled)}
                    onValueChange={(value) => saveMore({ invoice_preview_enabled: value })}
                />
                <SettingsToggleRow
                    icon="truck-outline"
                    title="Transport and extra charges"
                    subtitle="Keep transport and additional charge rows available in billing."
                    value={Boolean(more.transportation_details_enabled || more.additional_charges_enabled)}
                    onValueChange={(value) => saveMore({
                        transportation_details_enabled: value,
                        additional_charges_enabled: value,
                    })}
                />
                <SettingsFieldCard
                    icon="share-variant-outline"
                    title="Share mode"
                    subtitle="Use a default share output so the app does not ask the same question every time."
                >
                    <View style={s.choiceWrap}>
                        {SHARE_MODE_OPTIONS.map((value) => (
                            <ChipButton
                                key={value}
                                label={value.replaceAll('_', ' ')}
                                selected={String(more.share_transaction_mode ?? 'ASK_EVERY_TIME') === value}
                                tone="info"
                                onPress={() => saveMore({ share_transaction_mode: value })}
                            />
                        ))}
                    </View>
                </SettingsFieldCard>
                <SettingsFieldCard
                    icon="calculator"
                    title="Rounding"
                    subtitle="Choose how totals should round and by how much."
                >
                    <View style={s.choiceWrap}>
                        <ChipButton
                            label="Round off"
                            selected={Boolean(totals.round_off_transaction_amount_enabled)}
                            tone="warning"
                            onPress={() => saveTotals({ round_off_transaction_amount_enabled: !Boolean(totals.round_off_transaction_amount_enabled) })}
                        />
                        {ROUND_OFF_MODES.map((value) => (
                            <ChipButton
                                key={value}
                                label={value}
                                selected={String(totals.round_off_mode ?? 'NEAREST') === value}
                                tone="warning"
                                onPress={() => saveTotals({ round_off_mode: value })}
                            />
                        ))}
                    </View>
                    <View style={s.choiceWrap}>
                        {ROUND_OFF_VALUES.map((value) => (
                            <ChipButton
                                key={`round-${value}`}
                                label={`to ${value}`}
                                selected={Number(totals.round_off_to_value ?? 1) === value}
                                tone="warning"
                                onPress={() => saveTotals({ round_off_to_value: value })}
                            />
                        ))}
                    </View>
                </SettingsFieldCard>
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Connected pages"
                subtitle="Open printing and GST reporting without leaving the billing settings flow."
            >
                <SettingsLinkRow
                    icon="printer-outline"
                    title="Printing & templates"
                    subtitle="Thermal, PDF, invoice sheet, and business card presentation."
                    onPress={() => router.push('/(main)/settings/printing' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="file-percent-outline"
                    title="GST reports"
                    subtitle="Open GST-facing reports from the reports workspace."
                    onPress={() => router.push('/(main)/reports/gst-summary' as Parameters<typeof router.push>[0])}
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
        inlineField: {
            gap: DESIGN_SPACING.cardGap,
        },
        inlinePreview: {
            borderRadius: Radius.md,
            padding: DESIGN_SPACING.cardGap,
            ...getSurfaceStyle(colors, { muted: true }),
        },
    });
