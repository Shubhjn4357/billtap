import { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { List, Text, useTheme } from 'react-native-paper';
import { useRouter, Href } from 'expo-router';
import { userService } from '../../api/userService';
import { Config } from '../../constants/Config';
import { BUSINESS_SETUP_TEXT, COMMON_TEXT } from '../../constants/staticText';
import { normalizeCurrencyCode } from '../../utils/formatters';
import { useSettingsStore, useUserStore } from '../../store';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';

export default function BusinessSetupScreen() {
    const { user, setUser } = useUserStore();
    const { setCurrency } = useSettingsStore();
    const router = useRouter();
    const theme = useTheme();

    const [businessName, setBusinessName] = useState(user?.businessName ?? '');
    const [address, setAddress] = useState(user?.address ?? '');
    const [gst, setGst] = useState(user?.gstNumber ?? '');

    const [currency, setSelectedCurrency] = useState(
        normalizeCurrencyCode(user?.currency ?? Config.defaultCurrency)
    );
    const [category, setCategory] = useState(user?.category || '');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!user) return;
        setBusinessName(user.businessName ?? '');
        setAddress(user.address ?? '');
        setGst(user.gstNumber ?? '');
        setSelectedCurrency(normalizeCurrencyCode(user.currency ?? Config.defaultCurrency));
    }, [user]);

    const handleSave = async () => {
        if (!businessName.trim()) {
            Alert.alert(COMMON_TEXT.alerts.validation, BUSINESS_SETUP_TEXT.requiredBusinessName);
            return;
        }

        setLoading(true);
        try {
            const updatedUser = await userService.updateCurrentUser({
                businessName: businessName.trim(),
                address: address.trim(),
                gstNumber: gst.trim(),
                gstEnabled: !!gst.trim(),
                currency,
                category,
            });

            setUser(updatedUser);
            setCurrency(currency);

            // ...

            router.replace('/(main)/(tabs)/home' as Href);
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : BUSINESS_SETUP_TEXT.saveFailed);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.container}>
                <PageHeaderCard
                    title={BUSINESS_SETUP_TEXT.title}
                    subtitle={BUSINESS_SETUP_TEXT.subtitle}
                />

                <AppCard>
                    <Text variant="titleSmall" style={styles.sectionTitle}>
                        Business Profile
                    </Text>
                    <AppInput
                        label={BUSINESS_SETUP_TEXT.fields.businessName}
                        value={businessName}
                        onChangeText={setBusinessName}
                        style={styles.input}
                    />

                    <AppInput
                        label={BUSINESS_SETUP_TEXT.fields.businessAddress}
                        value={address}
                        onChangeText={setAddress}
                        multiline
                        numberOfLines={3}
                        style={styles.input}
                    />

                    <AppInput
                        label={BUSINESS_SETUP_TEXT.fields.gstNumber}
                        value={gst}
                        onChangeText={setGst}
                        style={styles.input}
                        autoCapitalize="characters"
                    />
                </AppCard>

                <AppCard>
                    <List.Section>
                        <List.Subheader>Business Category</List.Subheader>
                        <List.Accordion
                            title={category || 'Select Category'}
                            left={(props) => <List.Icon {...props} icon="shape" />}
                        >
                            {['Retail', 'Wholesale', 'Services', 'Manufacturing', 'Other'].map((cat) => (
                                <List.Item
                                    key={cat}
                                    title={cat}
                                    onPress={() => setCategory(cat)}
                                    right={(props) => (cat === category ? <List.Icon {...props} icon="check" /> : null)}
                                />
                            ))}
                        </List.Accordion>
                    </List.Section>

                    <List.Section>
                        <List.Subheader>{BUSINESS_SETUP_TEXT.fields.defaultCurrency}</List.Subheader>
                        <List.Accordion
                            title={`${currency} - ${Config.supportedCurrencies.find((entry) => entry.code === currency)?.label ?? ''}`}
                            left={(props) => <List.Icon {...props} icon="cash-multiple" />}
                        >
                            {Config.supportedCurrencies.map((entry) => (
                                <List.Item
                                    key={entry.code}
                                    title={`${entry.code} - ${entry.label}`}
                                    onPress={() => setSelectedCurrency(entry.code)}
                                    right={(props) => (
                                        entry.code === currency ? <List.Icon {...props} icon="check" /> : null
                                    )}
                                />
                            ))}
                        </List.Accordion>
                    </List.Section>
                </AppCard>

                <AppButton
                    mode="contained"
                    onPress={handleSave}
                    loading={loading}
                    style={styles.button}
                >
                    {BUSINESS_SETUP_TEXT.actions.startBilling}
                </AppButton>
                <Text variant="bodySmall" style={{ color: theme.colors.outline, textAlign: 'center' }}>
                    You can edit these details any time in Settings.
                </Text>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flexGrow: 1, paddingTop: 16, paddingBottom: 120 },
    sectionTitle: { fontWeight: '700', marginBottom: 10 },
    input: { marginBottom: 10 },
    button: { marginTop: 8, marginBottom: 10 },
});
