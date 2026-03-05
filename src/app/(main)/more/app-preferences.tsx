import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { AppTopBar } from '../../../components/ui/AppTopBar';
import { getColors, Radius, Spacing, Typography, type ColorPalette, type ThemePreference } from '../../../constants/theme';
import {
    DEFAULT_LOCAL_PREFERENCES,
    getLocalPreferences,
    patchLocalPreferences,
    type LocalPreferences,
} from '../../../services/localPreferences';
import { useSmartBack } from '../../../hooks/useSmartBack';
import { useAppDialog } from '@/components/providers/DialogProvider';

const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

export default function AppPreferencesScreen() {
    const dialog = useAppDialog();
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more');

    const [prefs, setPrefs] = useState<LocalPreferences>(DEFAULT_LOCAL_PREFERENCES);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let active = true;
        (async () => {
            const local = await getLocalPreferences();
            if (!active) return;
            setPrefs(local);
            setLoading(false);
        })();
        return () => {
            active = false;
        };
    }, []);

    const updatePrefs = async (patch: Partial<LocalPreferences>) => {
        const next = await patchLocalPreferences(patch);
        setPrefs(next);
    };

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="App Preferences"
                subtitle="Local device settings"
                onBackPress={smartBack}
                leftMode="auto"
                showSearch={false}
            />

            {loading ? (
                <View style={s.centered}>
                    <Text style={{ color: colors.textSecondary }}>Loading preferences...</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={s.content}>
                    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>Theme Mode</Text>
                        <View style={s.optionRow}>
                            {THEME_OPTIONS.map((entry) => {
                                const selected = prefs.themeMode === entry;
                                return (
                                    <Pressable
                                        key={entry}
                                        style={[
                                            s.chip,
                                            {
                                                borderColor: selected ? colors.primary : colors.border,
                                                backgroundColor: selected ? colors.surfaceVariant : 'transparent',
                                            },
                                        ]}
                                        onPress={() => {
                                            void updatePrefs({ themeMode: entry });
                                        }}
                                    >
                                        <Text style={{ color: selected ? colors.primary : colors.textSecondary, fontWeight: '700', fontSize: 12 }}>
                                            {entry.toUpperCase()}
                                        </Text>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>

                    <View style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                        <Text style={[s.sectionTitle, { color: colors.textSecondary }]}>Interaction</Text>
                        <View style={s.toggleRow}>
                            <View style={s.toggleMeta}>
                                <Text style={[s.toggleLabel, { color: colors.text }]}>Rich Motion</Text>
                                <Text style={[s.toggleSub, { color: colors.textSecondary }]}>Enable richer transitions and visual animations.</Text>
                            </View>
                            <Switch
                                value={prefs.richMotionEnabled}
                                onValueChange={(value) => {
                                    void updatePrefs({ richMotionEnabled: value });
                                }}
                            />
                        </View>
                        <View style={s.toggleRow}>
                            <View style={s.toggleMeta}>
                                <Text style={[s.toggleLabel, { color: colors.text }]}>Haptics</Text>
                                <Text style={[s.toggleSub, { color: colors.textSecondary }]}>Enable tactile feedback on taps and actions.</Text>
                            </View>
                            <Switch
                                value={prefs.hapticsEnabled}
                                onValueChange={(value) => {
                                    void updatePrefs({ hapticsEnabled: value });
                                }}
                            />
                        </View>
                    </View>

                    <Pressable
                        style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}
                        onPress={() => dialog.alert('Scope', 'These preferences are stored locally on this device and are not synced to server.')}
                    >
                        <View style={s.infoRow}>
                            <MaterialCommunityIcons name="information-outline" size={18} color={colors.primary} />
                            <Text style={[s.infoText, { color: colors.textSecondary }]}>
                                Local only: theme and app behavior preferences are device-specific.
                            </Text>
                        </View>
                    </Pressable>
                </ScrollView>
            )}
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        centered: { flex: 1, alignItems: 'center', justifyContent: 'center' },
        content: { paddingHorizontal: Spacing.lg, gap: Spacing.md, paddingBottom: 80 },
        card: {
            borderWidth: 1,
            borderRadius: Radius.card,
            padding: Spacing.md,
            gap: Spacing.sm,
        },
        sectionTitle: { fontSize: Typography.caption.size, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
        optionRow: { flexDirection: 'row', gap: Spacing.sm, flexWrap: 'wrap' },
        chip: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.sm,
            paddingVertical: 6,
        },
        toggleRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: Spacing.sm,
        },
        toggleMeta: { flex: 1 },
        toggleLabel: { fontSize: 14, fontWeight: '700' },
        toggleSub: { fontSize: 12, marginTop: 2 },
        infoRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'center' },
        infoText: { flex: 1, fontSize: 12, fontWeight: '600' },
    });
