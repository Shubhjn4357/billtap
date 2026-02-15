import { useEffect, useState } from 'react';
import { StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, List, useTheme } from 'react-native-paper';
import { useRouter, Href } from 'expo-router';
import { userService } from '../../api/userService';
import { Config } from '../../constants/Config';
import { BUSINESS_SETUP_TEXT, COMMON_TEXT } from '../../constants/staticText';
import { normalizeCurrencyCode } from '../../utils/formatters';
import { useSettingsStore, useUserStore } from '../../store';
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
                <Text variant="headlineMedium" style={{ marginBottom: 20, fontWeight: 'bold' }}>{BUSINESS_SETUP_TEXT.title}</Text>
                <Text variant="bodyLarge" style={{ marginBottom: 30, color: theme.colors.secondary }}>
                    {BUSINESS_SETUP_TEXT.subtitle}
                </Text>

                <TextInput
                    label={BUSINESS_SETUP_TEXT.fields.businessName}
                    value={businessName}
                    onChangeText={setBusinessName}
                    mode="outlined"
                    style={styles.input}
                />

                <TextInput
                    label={BUSINESS_SETUP_TEXT.fields.businessAddress}
                    value={address}
                    onChangeText={setAddress}
                    mode="outlined"
                    multiline
                    numberOfLines={3}
                    style={styles.input}
                />

                <TextInput
                    label={BUSINESS_SETUP_TEXT.fields.gstNumber}
                    value={gst}
                    onChangeText={setGst}
                    mode="outlined"
                    style={styles.input}
                    autoCapitalize="characters"
                />

                <List.Section>
                    <List.Subheader>Business Category</List.Subheader>
                    <List.Accordion
                        title={category || 'Select Category'}
                        left={props => <List.Icon {...props} icon="shape" />}
                    >
                        {['Retail', 'Wholesale', 'Services', 'Manufacturing', 'Other'].map((cat) => (
                            <List.Item
                                key={cat}
                                title={cat}
                                onPress={() => setCategory(cat)}
                                right={props => cat === category ? <List.Icon {...props} icon="check" /> : null}
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

                <Button
                    mode="contained"
                    onPress={handleSave}
                    loading={loading}
                    style={styles.button}
                >
                    {BUSINESS_SETUP_TEXT.actions.startBilling}
                </Button>
            </ScrollView>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, padding: 20 },
    input: { marginBottom: 20 },
    button: { marginTop: 20, paddingVertical: 6 }
});
