import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useRouter } from 'expo-router';
import { Chip, Text, useTheme } from 'react-native-paper';

import { businessSuiteService } from '../../api/businessSuiteService';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { Config } from '../../constants/Config';
import { DesignSystem } from '../../constants/DesignSystem';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { normalizeCurrencyCode } from '../../utils/formatters';
import { organizationCreateSchema } from '../../validation/forms';

const toOrgCode = (value: string): string => (
    value
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '_')
        .replace(/[^A-Z0-9_-]/g, '')
        .slice(0, 32)
);

const toOrgCodeFromName = (value: string): string => (
    value
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .slice(0, 32)
);

export const OrganizationCreateScreen: React.FC = () => {
    const router = useRouter();
    const theme = useTheme();
    const dialog = useAppDialog();
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
    const { isOwnerOrAdmin, refreshOrganizationContext } = useOrganizationAccess();

    const [name, setName] = useState('');
    const [code, setCode] = useState('');
    const [currency, setCurrency] = useState('INR');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [email, setEmail] = useState('');
    const [gstNumber, setGstNumber] = useState('');
    const [address, setAddress] = useState('');
    const [saving, setSaving] = useState(false);

    const canSave = useMemo(
        () => !saving && name.trim().length >= 2 && code.trim().length >= 2,
        [code, name, saving]
    );

    const handleNameChange = (next: string) => {
        setName(next);
        if (!code.trim()) {
            setCode(toOrgCodeFromName(next));
        }
    };

    const handleCreate = async () => {
        const validation = organizationCreateSchema.safeParse({
            name,
            code,
            currency,
            phoneNumber,
            email,
            gstNumber,
            address,
        });

        if (!validation.success) {
            dialog.alert('Create Organization', validation.error.issues[0]?.message || 'Please check all fields.');
            return;
        }

        setSaving(true);
        try {
            const values = validation.data;
            const organizationId = await businessSuiteService.createOrganization({
                name: values.name.trim(),
                code: values.code.trim().toUpperCase(),
                currency: normalizeCurrencyCode(values.currency),
                phoneNumber: values.phoneNumber?.trim() || undefined,
                email: values.email?.trim().toLowerCase() || undefined,
                gstNumber: values.gstNumber?.trim().toUpperCase() || undefined,
                address: values.address?.trim() || undefined,
            });

            await refreshOrganizationContext(organizationId);
            router.replace('/(main)/(tabs)/home');
        } catch (error: unknown) {
            dialog.alert('Create Organization', error instanceof Error ? error.message : 'Failed to create organization.');
        } finally {
            setSaving(false);
        }
    };

    if (!isOwnerOrAdmin) {
        return (
            <ScreenWrapper>
                <View style={styles.blockedContainer}>
                    <AppCard style={styles.blockedCard}>
                        <Text variant="titleMedium" style={{ fontWeight: '700', marginBottom: 6 }}>
                            Access Restricted
                        </Text>
                        <Text style={{ color: theme.colors.outline }}>
                            Only owner/admin can create organizations.
                        </Text>
                    </AppCard>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title="Create Organization"
                        subtitle="Create a new business workspace and switch to it instantly."
                    />

                    <AppCard>
                        <AppInput
                            label="Organization Name"
                            value={name}
                            onChangeText={handleNameChange}
                            inputType="name"
                            placeholder="Acme Traders"
                        />

                        <AppInput
                            label="Organization Code"
                            value={code}
                            onChangeText={(value) => setCode(toOrgCode(value))}
                            inputType="text"
                            autoCapitalize="characters"
                            placeholder="ACME_TRADERS"
                        />

                        <Text variant="labelMedium" style={styles.currencyLabel}>
                            Currency
                        </Text>
                        <View style={styles.currencyWrap}>
                            {Config.supportedCurrencies.slice(0, 10).map((entry) => (
                                <Chip
                                    key={entry.code}
                                    compact
                                    mode={entry.code === currency ? 'flat' : 'outlined'}
                                    selected={entry.code === currency}
                                    onPress={() => setCurrency(entry.code)}
                                >
                                    {entry.code}
                                </Chip>
                            ))}
                        </View>

                        <AppInput
                            label="Phone Number (Optional)"
                            value={phoneNumber}
                            onChangeText={setPhoneNumber}
                            inputType="phone"
                            placeholder="+91 9876543210"
                        />

                        <AppInput
                            label="Email (Optional)"
                            value={email}
                            onChangeText={setEmail}
                            inputType="email"
                            autoCapitalize="none"
                            placeholder="billing@acme.com"
                        />

                        <AppInput
                            label="GST Number (Optional)"
                            value={gstNumber}
                            onChangeText={(value) => setGstNumber(value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
                            inputType="text"
                            autoCapitalize="characters"
                            placeholder="27ABCDE1234F1Z5"
                        />

                        <AppInput
                            label="Address (Optional)"
                            value={address}
                            onChangeText={setAddress}
                            inputType="text"
                            multiline
                            numberOfLines={3}
                            placeholder="Business address"
                        />

                        <AppButton
                            mode="contained"
                            onPress={() => { void handleCreate(); }}
                            loading={saving}
                            disabled={!canSave}
                            style={styles.submitButton}
                        >
                            Create Organization
                        </AppButton>
                    </AppCard>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    blockedContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    blockedCard: {
        width: '100%',
        maxWidth: DesignSystem.layout.compactMaxWidth,
    },
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        paddingBottom: DesignSystem.layout.pageBottom,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.formMaxWidth,
    },
    currencyLabel: {
        marginTop: DesignSystem.spacing.xs,
        marginBottom: DesignSystem.spacing.xs,
    },
    currencyWrap: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: DesignSystem.spacing.xs,
        marginBottom: DesignSystem.spacing.sm,
    },
    submitButton: {
        marginTop: DesignSystem.spacing.sm,
    },
});
