import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
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
import { selectItemSettings } from '../../../selectors/settingsSelectors';
import { useSettingsSectionMutation } from '../../../hooks/useSettingsSectionMutation';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { toUserMessage } from '../../../api/client';
import { useAppDialog } from '@/components/providers/DialogProvider';

const QUANTITY_DECIMAL_OPTIONS = [0, 1, 2, 3] as const;
const SCANNER_OPTIONS = [
    { label: 'USB scanner', value: 'USB_SCANNER', description: 'Use an attached barcode scanner' },
    { label: 'Phone camera', value: 'PHONE_CAMERA', description: 'Use the device camera for barcode capture' },
];

export default function InventorySettingsScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const dialog = useAppDialog();
    const smartBack = useSmartBack('/(main)/settings');

    const { sectionData: partySettings } = useSettingsSelector(SettingsSection.PARTY_SETTINGS, (value) => value);
    const { sectionData: godownSettings } = useSettingsSelector(SettingsSection.GODOWN_AND_STOCK_TRANSFER, (value) => value);
    const { sectionData: itemRaw, selected: itemSettings } = useSettingsSelector(SettingsSection.ITEM_SETTINGS, selectItemSettings);

    const itemMutation = useSettingsSectionMutation(SettingsSection.ITEM_SETTINGS, {
        onError: (error) => dialog.alert('Save failed', toUserMessage(error, 'Unable to save item settings.')),
    });
    const partyMutation = useSettingsSectionMutation(SettingsSection.PARTY_SETTINGS, {
        onError: (error) => dialog.alert('Save failed', toUserMessage(error, 'Unable to save party settings.')),
    });
    const godownMutation = useSettingsSectionMutation(SettingsSection.GODOWN_AND_STOCK_TRANSFER, {
        onError: (error) => dialog.alert('Save failed', toUserMessage(error, 'Unable to save godown settings.')),
    });

    const saveItem = (patch: Record<string, unknown>) => itemMutation.mutate({ ...itemRaw, ...patch });
    const saveParty = (patch: Record<string, unknown>) => partyMutation.mutate({ ...partySettings, ...patch });
    const saveGodown = (patch: Record<string, unknown>) => godownMutation.mutate({ ...godownSettings, ...patch });

    return (
        <SettingsPageShell
            title="Inventory"
            subtitle="Item defaults, party-linked stock behavior, and warehouse rules"
            onBackPress={smartBack}
            contextChip={{ label: Boolean(itemRaw.stock_maintenance_enabled) ? 'Stock on' : 'Stock off' }}
        >
            <SettingsHeroCard
                title="Inventory defaults"
                subtitle="Control how items behave, how parties influence stock context, and whether multi-godown flows stay available."
                primaryLabel={Boolean(godownSettings.godown_management_enabled) ? 'Godowns on' : 'Single location'}
                secondaryLabel={Boolean(itemRaw.barcode_scanning_enabled) ? 'Barcode ready' : 'Manual mode'}
            />

            <SettingsSectionGroup
                title="Item records"
                subtitle="Keep item creation simple by deciding which data should matter on every new item."
                action={<SettingsStatusPill label={itemSettings.defaultUnit || 'No default unit'} tone="info" />}
            >
                <SettingsToggleRow
                    icon="package-variant-closed"
                    title="Stock maintenance"
                    subtitle="Track item stock and quantity-ledger behavior."
                    value={Boolean(itemRaw.stock_maintenance_enabled)}
                    onValueChange={(value) => saveItem({ stock_maintenance_enabled: value })}
                />
                <SettingsToggleRow
                    icon="barcode-scan"
                    title="Barcode scanning"
                    subtitle="Enable barcode support for item creation and lookup."
                    value={Boolean(itemRaw.barcode_scanning_enabled)}
                    onValueChange={(value) => saveItem({ barcode_scanning_enabled: value })}
                />
                <SettingsToggleRow
                    icon="shape-outline"
                    title="Units and categories"
                    subtitle="Keep item units and category organization available in the product catalog."
                    value={Boolean(itemRaw.item_units_enabled || itemRaw.item_category_enabled)}
                    onValueChange={(value) => saveItem({
                        item_units_enabled: value,
                        item_category_enabled: value,
                    })}
                />
                <SettingsToggleRow
                    icon="tag-multiple-outline"
                    title="Item-wise tax and discount"
                    subtitle="Let each item carry its own tax and discount behavior."
                    value={Boolean(itemRaw.item_wise_tax_enabled || itemRaw.item_wise_discount_enabled)}
                    onValueChange={(value) => saveItem({
                        item_wise_tax_enabled: value,
                        item_wise_discount_enabled: value,
                    })}
                />
                <SettingsToggleRow
                    icon="factory"
                    title="Manufacturing and advanced fields"
                    subtitle="Expose manufacturing and extra item metadata only when you really use it."
                    value={Boolean(itemRaw.manufacturing_enabled || itemRaw.additional_item_fields_enabled || itemRaw.item_custom_fields_enabled)}
                    onValueChange={(value) => saveItem({
                        manufacturing_enabled: value,
                        additional_item_fields_enabled: value,
                        item_custom_fields_enabled: value,
                    })}
                />

                <SettingsFieldCard
                    icon="ruler-square-compass"
                    title="Default unit"
                    subtitle="Use one default unit so new item creation starts closer to the right shape."
                >
                    <SelectField
                        value={itemSettings.defaultUnit || null}
                        title="Default unit"
                        placeholder="Choose default unit"
                        options={itemSettings.unitOptions.map((option) => ({
                            label: option,
                            value: option,
                        }))}
                        allowClear
                        onChange={(value) => saveItem({ default_unit: value })}
                        onClear={() => saveItem({ default_unit: null })}
                    />
                </SettingsFieldCard>

                <SettingsFieldCard
                    icon="barcode"
                    title="Scanner mode"
                    subtitle="Pick the barcode input method that matches the device you actually use."
                >
                    <SelectField
                        value={String(itemRaw.barcode_scanner_type ?? 'USB_SCANNER')}
                        title="Scanner mode"
                        placeholder="Choose scanner mode"
                        options={SCANNER_OPTIONS}
                        searchable={false}
                        onChange={(value) => saveItem({ barcode_scanner_type: value })}
                    />
                </SettingsFieldCard>

                <SettingsFieldCard
                    icon="decimal"
                    title="Quantity decimals"
                    subtitle="Choose how precise inventory quantities should be."
                >
                    <View style={s.choiceWrap}>
                        {QUANTITY_DECIMAL_OPTIONS.map((value) => (
                            <ChipButton
                                key={`qty-decimal-${value}`}
                                label={`${value} decimals`}
                                selected={Number(itemRaw.quantity_decimal_places ?? 2) === value}
                                tone="info"
                                onPress={() => saveItem({ quantity_decimal_places: value })}
                            />
                        ))}
                    </View>
                </SettingsFieldCard>
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Party-linked behavior"
                subtitle="Control what customer and supplier data should feed into billing and stock handling."
            >
                <SettingsToggleRow
                    icon="card-account-details-outline"
                    title="Show GSTIN field"
                    subtitle="Keep GST identity available on party records."
                    value={Boolean(partySettings.show_gstin_field)}
                    onValueChange={(value) => saveParty({ show_gstin_field: value })}
                />
                <SettingsToggleRow
                    icon="map-marker-outline"
                    title="Shipping address"
                    subtitle="Allow separate shipping details on party records."
                    value={Boolean(partySettings.party_shipping_address_enabled)}
                    onValueChange={(value) => saveParty({ party_shipping_address_enabled: value })}
                />
                <SettingsToggleRow
                    icon="account-group-outline"
                    title="Grouping and extra fields"
                    subtitle="Expose grouping and additional fields for richer party segmentation."
                    value={Boolean(partySettings.party_grouping_enabled || partySettings.party_additional_fields_enabled)}
                    onValueChange={(value) => saveParty({
                        party_grouping_enabled: value,
                        party_additional_fields_enabled: value,
                    })}
                />
                <SettingsToggleRow
                    icon="gift-outline"
                    title="Loyalty and self-add"
                    subtitle="Use party loyalty and self-add invitations only when the business model needs it."
                    value={Boolean(partySettings.loyalty_points_enabled || partySettings.invite_parties_to_add_themselves)}
                    onValueChange={(value) => saveParty({
                        loyalty_points_enabled: value,
                        invite_parties_to_add_themselves: value,
                    })}
                />
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Godowns and transfer flow"
                subtitle="Turn warehouse features on only when the business actually needs location-wise stock."
                action={<SettingsStatusPill label={Boolean(godownSettings.stock_transfer_enabled) ? 'Transfers on' : 'Transfers off'} tone="warning" />}
            >
                <SettingsToggleRow
                    icon="warehouse"
                    title="Godown management"
                    subtitle="Use multiple stock locations and location-specific inventory visibility."
                    value={Boolean(godownSettings.godown_management_enabled)}
                    onValueChange={(value) => saveGodown({ godown_management_enabled: value })}
                />
                <SettingsToggleRow
                    icon="swap-horizontal-bold"
                    title="Stock transfer"
                    subtitle="Allow item movement between godowns."
                    value={Boolean(godownSettings.stock_transfer_enabled)}
                    onValueChange={(value) => saveGodown({ stock_transfer_enabled: value })}
                />
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Connected pages"
                subtitle="Use direct utility links instead of buried master-data pages."
            >
                <SettingsLinkRow
                    icon="format-list-group"
                    title="Item masters"
                    subtitle="Categories, units, and supporting master data for the item catalog."
                    onPress={() => router.push('/(main)/settings/item-masters' as Parameters<typeof router.push>[0])}
                />
                <SettingsLinkRow
                    icon="warehouse"
                    title="Godowns"
                    subtitle="Warehouse list, transfers, and stock movement tools."
                    onPress={() => router.push('/(main)/settings/godowns' as Parameters<typeof router.push>[0])}
                />
            </SettingsSectionGroup>
        </SettingsPageShell>
    );
}

const styles = (_colors: ColorPalette) =>
    StyleSheet.create({
        choiceWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: DESIGN_SPACING.cardGap,
        },
    });
