
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text, useTheme, SegmentedButtons } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { DesignSystem } from '../../constants/DesignSystem';
import { usePartyStore } from '../../store';
import { COMMON_TEXT } from '../../constants/staticText';
import type { PartyType } from '../../types';
import { partyService } from '../../api/partyService';
import { useAuth } from '../../hooks/useAuth';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { partySchema } from '../../validation/forms';

export const PartyDetailScreen = () => {
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const partyId = Array.isArray(params.id) ? params.id[0] : params.id;
    const isNew = partyId === 'new';
    const { parties, addParty, updateParty, deleteParty, loading } = usePartyStore();
    const { user } = useAuth();
    const { canManageParties } = useOrganizationAccess();
    const router = useRouter();
    const theme = useTheme();
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
    const dialog = useAppDialog();

    const [form, setForm] = useState({
        name: '',
        type: 'customer' as PartyType,
        phone: '',
        email: '',
        address: '',
        gstNumber: '',
    });

    useEffect(() => {
        if (!isNew && partyId) {
            const party = parties.find(p => p.id === partyId);
            if (party) {
                setForm({
                    name: party.name,
                    type: party.type,
                    phone: party.phone || '',
                    email: party.email || '',
                    address: party.address || '',
                    gstNumber: party.gstNumber || '',
                });
            }
        }
    }, [partyId, isNew, parties]);

    const handleSubmit = async () => {
        if (!user) {
            dialog.alert(COMMON_TEXT.alerts.error, 'You must be logged in.');
            return;
        }
        const validation = partySchema.safeParse({
            name: form.name,
            phone: form.phone.replace(/\D/g, ''),
            email: form.email,
            address: form.address,
            gstNumber: form.gstNumber ? form.gstNumber.toUpperCase() : '',
        });
        if (!validation.success) {
            dialog.alert(COMMON_TEXT.alerts.error, validation.error.issues[0]?.message || 'Please check party details.');
            return;
        }

        const values = validation.data;

        try {
            if (isNew) {
                const id = await partyService.createParty({
                    userId: user.uid,
                    name: values.name.trim(),
                    type: form.type,
                    phone: values.phone,
                    email: values.email?.trim() || undefined,
                    address: values.address?.trim() || undefined,
                    gstNumber: values.gstNumber?.trim().toUpperCase() || undefined,
                    isActive: true,
                });

                addParty({
                    id,
                    userId: user.uid,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ...form,
                    name: values.name.trim(),
                    phone: values.phone,
                    email: values.email?.trim() || undefined,
                    address: values.address?.trim() || undefined,
                    gstNumber: values.gstNumber?.trim().toUpperCase() || undefined,
                });
                dialog.alert(COMMON_TEXT.alerts.success, 'Party added successfully.');
                router.back();
            } else {
                if (!partyId) return;
                await partyService.updateParty(partyId, {
                    name: values.name.trim(),
                    type: form.type,
                    phone: values.phone,
                    email: values.email?.trim() || undefined,
                    address: values.address?.trim() || undefined,
                    gstNumber: values.gstNumber?.trim().toUpperCase() || undefined,
                });
                updateParty(partyId, {
                    ...form,
                    name: values.name.trim(),
                    phone: values.phone,
                    email: values.email?.trim() || undefined,
                    address: values.address?.trim() || undefined,
                    gstNumber: values.gstNumber?.trim().toUpperCase() || undefined,
                    updatedAt: new Date().toISOString()
                });
                dialog.alert(COMMON_TEXT.alerts.success, 'Party updated successfully.');
                router.back();
            }
        } catch (error: unknown) {
            dialog.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to save party.');
        }
    };

    const handleDelete = () => {
        if (isNew || !partyId) return;
        dialog.confirm(
            'Delete Party',
            'Are you sure you want to delete this party?',
            async () => {
                try {
                    await partyService.archiveParty(partyId);
                } catch {
                    // keep local cleanup even if remote call fails
                }
                deleteParty(partyId);
                router.back();
            }
        );
    };

    return (
        <ScreenWrapper>
            {!canManageParties ? (
                <View style={styles.blockedContainer}>
                    <PageHeaderCard
                        title="Party access disabled"
                        subtitle="Ask owner/admin to enable party management."
                    />
                </View>
            ) : (
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                        <PageHeaderCard
                            title={isNew ? 'Add Party' : 'Edit Party'}
                            subtitle="Manage customer/supplier details, tax info and contact fields."
                        />

                        <AppCard>
                            <Text variant="titleSmall" style={styles.sectionTitle}>
                                Party Type
                            </Text>
                            <SegmentedButtons
                                value={form.type}
                                onValueChange={(val) => setForm({ ...form, type: val as PartyType })}
                                buttons={[
                                    { value: 'customer', label: 'Customer' },
                                    { value: 'supplier', label: 'Supplier' },
                                ]}
                                style={styles.segmented}
                            />
                        </AppCard>

                        <AppCard>
                            <Text variant="titleSmall" style={styles.sectionTitle}>
                                Contact Information
                            </Text>
                            <AppInput
                                label="Name"
                                value={form.name}
                                onChangeText={(t) => setForm({ ...form, name: t })}
                                inputType="name"
                            />
                            <AppInput
                                label="Phone Number"
                                value={form.phone}
                                onChangeText={(t) => setForm({ ...form, phone: t.replace(/\D/g, '') })}
                                inputType="phone"
                            />
                            <AppInput
                                label="Email (Optional)"
                                value={form.email}
                                onChangeText={(t) => setForm({ ...form, email: t })}
                                inputType="email"
                                autoCapitalize="none"
                            />
                            <AppInput
                                label="GST Number (Optional)"
                                value={form.gstNumber}
                                onChangeText={(t) => setForm({ ...form, gstNumber: t.toUpperCase().replace(/[^0-9A-Z]/g, '') })}
                                autoCapitalize="characters"
                            />
                            <AppInput
                                label="Address"
                                value={form.address}
                                onChangeText={(t) => setForm({ ...form, address: t })}
                                multiline
                                numberOfLines={3}
                                inputType="text"
                            />
                        </AppCard>

                        <AppButton
                            mode="contained"
                            onPress={handleSubmit}
                            loading={loading}
                            style={styles.primaryButton}
                        >
                            {isNew ? 'Save Party' : 'Update Party'}
                        </AppButton>

                        {!isNew && (
                            <AppButton
                                mode="outlined"
                                onPress={handleDelete}
                                loading={loading}
                                style={styles.secondaryButton}
                                textColor={theme.colors.error}
                                icon="delete"
                            >
                                Delete Party
                            </AppButton>
                        )}
                    </View>
                </ScrollView>
            )}
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    blockedContainer: {
        paddingTop: DesignSystem.layout.pageTop,
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
    sectionTitle: {
        fontWeight: '700',
        marginBottom: DesignSystem.spacing.sm,
    },
    segmented: {
        marginBottom: DesignSystem.spacing.xs + 2,
    },
    primaryButton: {
        marginTop: DesignSystem.spacing.md + 2,
    },
    secondaryButton: {
        marginTop: DesignSystem.spacing.sm,
    },
});
