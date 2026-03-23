import { StyleSheet, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ChipButton } from '../../../components/ui/ChipBlocks';
import {
    SettingsHeroCard,
    SettingsPageShell,
    SettingsSectionGroup,
    SettingsToggleRow,
} from '../../../components/settings/SettingsBlocks';
import { APP_LANGUAGE_OPTIONS, INVOICE_TEMPLATE_OPTIONS, THEME_MODE_OPTIONS } from '../../../constants/appPreferences';
import { DESIGN_SPACING, getInsetPanelStyle, getSurfaceStyle } from '../../../constants/designSystem';
import { Radius, Typography, type ColorPalette, withAlpha } from '../../../constants/theme';
import { useAppColors } from '../../../hooks/useAppColors';
import { useAppRuntime } from '../../../components/providers/AppRuntimeProvider';
import { useSmartBack } from '../../../hooks/useSmartBack';

export default function AppearanceSettingsScreen() {
    const colors = useAppColors();
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/settings');
    const { localPreferences, updateLocalPreferences } = useAppRuntime();

    return (
        <SettingsPageShell
            title="Appearance"
            subtitle="Theme, language, motion, haptics, and document style"
            onBackPress={smartBack}
            contextChip={{ label: localPreferences.themeMode }}
        >
            <SettingsHeroCard
                title="Make the app feel like your workspace"
                subtitle="Fast switches for visual preferences and document presentation without opening generic forms."
                primaryLabel={localPreferences.appLanguage === 'hi' ? 'Hindi' : 'English'}
                secondaryLabel={localPreferences.invoiceTemplateMode === 'BUSINESS' ? 'Business invoice' : 'Branded invoice'}
            />

            <SettingsSectionGroup
                title="Theme"
                subtitle="Use a clear default and keep the choice visible."
            >
                <View style={[s.preferenceCard, getSurfaceStyle(colors, { elevated: true })]}>
                    <Text style={s.preferenceTitle}>Color mode</Text>
                    <View style={s.chipWrap}>
                        {THEME_MODE_OPTIONS.map((option) => (
                            <ChipButton
                                key={option.key}
                                icon={option.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                                label={option.label}
                                selected={localPreferences.themeMode === option.key}
                                tone="info"
                                onPress={() => {
                                    void updateLocalPreferences({ themeMode: option.key });
                                }}
                            />
                        ))}
                    </View>
                </View>
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Language"
                subtitle="Keep switching simple and direct."
            >
                <View style={[s.preferenceCard, getSurfaceStyle(colors, { elevated: true })]}>
                    <Text style={s.preferenceTitle}>App language</Text>
                    <View style={s.chipWrap}>
                        {APP_LANGUAGE_OPTIONS.map((option) => (
                            <ChipButton
                                key={option.key}
                                label={option.label}
                                selected={localPreferences.appLanguage === option.key}
                                tone="info"
                                onPress={() => {
                                    void updateLocalPreferences({ appLanguage: option.key });
                                }}
                            />
                        ))}
                    </View>
                </View>
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Document style"
                subtitle="Use one default invoice personality across the app."
            >
                <View style={s.templateStack}>
                    {INVOICE_TEMPLATE_OPTIONS.map((option) => {
                        const selected = localPreferences.invoiceTemplateMode === option.key;
                        return (
                            <View
                                key={option.key}
                                style={[
                                    s.templateCard,
                                    getInsetPanelStyle(colors, selected ? colors.primary : undefined),
                                    {
                                        borderColor: selected ? withAlpha(colors.primary, '42') : withAlpha(colors.border, 'BA'),
                                        backgroundColor: selected ? withAlpha(colors.primary, '0E') : colors.surfaceRaised,
                                    },
                                ]}
                            >
                                <View style={s.templateHeader}>
                                    <View style={s.templateCopy}>
                                        <Text style={[s.templateTitle, selected ? { color: colors.primary } : null]}>{option.label}</Text>
                                        <Text style={s.templateDescription}>{option.description}</Text>
                                    </View>
                                    <ChipButton
                                        label={selected ? 'Selected' : 'Choose'}
                                        selected={selected}
                                        tone="info"
                                        onPress={() => {
                                            void updateLocalPreferences({ invoiceTemplateMode: option.key });
                                        }}
                                    />
                                </View>
                            </View>
                        );
                    })}
                </View>
            </SettingsSectionGroup>

            <SettingsSectionGroup
                title="Interaction"
                subtitle="Turn device behaviors on or off without leaving this page."
            >
                <SettingsToggleRow
                    icon="animation-outline"
                    title="Rich motion"
                    subtitle="Use smoother transitions and animated emphasis."
                    value={localPreferences.richMotionEnabled}
                    onValueChange={(next) => {
                        void updateLocalPreferences({ richMotionEnabled: next });
                    }}
                />
                <SettingsToggleRow
                    icon="vibrate"
                    title="Haptics"
                    subtitle="Confirm actions with subtle touch feedback."
                    value={localPreferences.hapticsEnabled}
                    onValueChange={(next) => {
                        void updateLocalPreferences({ hapticsEnabled: next });
                    }}
                />
                <SettingsToggleRow
                    icon="gesture-swipe"
                    title="Gesture navigation"
                    subtitle="Keep route transitions and back gestures comfortable on mobile."
                    value={localPreferences.gestureNavigationEnabled}
                    onValueChange={(next) => {
                        void updateLocalPreferences({ gestureNavigationEnabled: next });
                    }}
                />
            </SettingsSectionGroup>
        </SettingsPageShell>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        preferenceCard: {
            padding: DESIGN_SPACING.sectionGap,
            gap: DESIGN_SPACING.cardGap,
        },
        preferenceTitle: {
            color: colors.text,
            fontSize: Typography.body.size,
            fontWeight: '700',
        },
        chipWrap: {
            flexDirection: 'row',
            flexWrap: 'wrap',
            gap: DESIGN_SPACING.cardGap,
        },
        templateStack: {
            gap: DESIGN_SPACING.cardGap,
        },
        templateCard: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: DESIGN_SPACING.sectionGap,
        },
        templateHeader: {
            flexDirection: 'row',
            alignItems: 'flex-start',
            gap: DESIGN_SPACING.cardGap,
        },
        templateCopy: {
            flex: 1,
            gap: 4,
        },
        templateTitle: {
            color: colors.text,
            fontSize: Typography.body.size,
            fontWeight: '800',
        },
        templateDescription: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            lineHeight: Typography.caption.lineHeight,
            fontWeight: '500',
        },
    });
