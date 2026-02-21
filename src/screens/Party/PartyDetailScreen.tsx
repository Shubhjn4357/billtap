
import React, { useState, useEffect } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, useTheme, SegmentedButtons, Avatar, IconButton, TextInput, List } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { DesignSystem } from '../../constants/DesignSystem';
import { usePartyStore } from '../../store';
import { COMMON_TEXT } from '../../constants/staticText';
import type { Party, PartyType } from '../../types';

import { useAuth } from '../../hooks/useAuth';
import { useOrganizationAccess } from '../../hooks/useOrganizationAccess';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { partySchema } from '../../validation/forms';

import type { NewDbParty } from '../../types/db';
import { partyRepository } from '../../repositories/partyRepository';
import { randomUUID } from 'expo-crypto';

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
                const newId = randomUUID();
                const now = new Date().toISOString();

                const newParty: NewDbParty = {
                    id: newId,
                    organizationId: user.uid,
                    isActive: true,
                    createdAt: now,
                    updatedAt: now,
                    type: form.type,
                    name: values.name.trim(),
                    nameLowercase: values.name.trim().toLowerCase(),
                    phone: values.phone,
                    email: values.email?.trim() || null,
                    address: values.address?.trim() || null,
                    gstNumber: values.gstNumber?.trim().toUpperCase() || null,
                };

                await partyRepository.create(newParty);

                // Add to local store
                addParty({
                    id: newParty.id,
                    name: newParty.name,
                    type: newParty.type as PartyType,
                    phone: newParty.phone ?? undefined,
                    email: newParty.email ?? undefined,
                    address: newParty.address ?? undefined,
                    gstNumber: newParty.gstNumber ?? undefined,
                    organizationId: newParty.organizationId,
                    userId: newParty.organizationId,
                    isActive: newParty.isActive ?? true,
                    createdAt: newParty.createdAt,
                    updatedAt: newParty.updatedAt,
                } as Party);

                dialog.alert(COMMON_TEXT.alerts.success, 'Party added successfully.');
                router.back();
            } else {
                if (!partyId) return;

                const updates: Partial<NewDbParty> = {
                    name: values.name.trim(),
                    type: form.type,
                    phone: values.phone,
                    email: values.email?.trim() || null,
                    address: values.address?.trim() || null,
                    gstNumber: values.gstNumber?.trim().toUpperCase() || null,
                    updatedAt: new Date().toISOString()
                };

                await partyRepository.update(partyId, updates);

                // For local update, we merge changes
                updateParty(partyId, {
                    name: updates.name,
                    type: updates.type as PartyType,
                    phone: updates.phone ?? undefined,
                    email: updates.email ?? undefined,
                    address: updates.address ?? undefined,
                    gstNumber: updates.gstNumber ?? undefined,
                });

                dialog.alert(COMMON_TEXT.alerts.success, 'Party updated successfully.');
                router.back();
            }
        } catch (error: unknown) {
            dialog.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to save party.');
        }
    };

    const handleDelete = () => {
        if (isNew || !partyId || !user) return;
        dialog.confirm(
            'Delete Party',
            'Are you sure you want to delete this party?',
            async () => {
                try {
                    await partyRepository.delete(partyId, user.uid);
                } catch {
                    // keep local cleanup even if remote call fails logic is handled in repo/sync
                }
                deleteParty(partyId);
                router.back();
            }
        );
    };

    if (!canManageParties) {
        return (
            <ScreenWrapper>
                <View style={styles.blockedContainer}>
                     <View style={{ alignItems: 'center', padding: 20 }}>
                         <IconButton icon="lock-outline" size={48} iconColor={theme.colors.outline} />
                         <Text variant="titleMedium" style={{ marginTop: 16, fontWeight: 'bold' }}>
                             Access Restricted
                         </Text>
                         <Text variant="bodyMedium" style={{ color: theme.colors.outline, textAlign: 'center', marginTop: 8 }}>
                             You do not have permission to manage parties.
                         </Text>
                     </View>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
                <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                    <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                        <PageHeaderCard
                            title={isNew ? 'New Party' : 'Edit Party'}
                            subtitle={isNew ? "Add a new customer or supplier" : `Update details for ${form.name}`}
                        />

                        <View style={styles.avatarContainer}>
                            <Avatar.Text
                                size={80}
                                label={form.name ? form.name.substring(0, 2).toUpperCase() : '??'}
                                style={{ backgroundColor: form.type === 'customer' ? theme.colors.primaryContainer : theme.colors.secondaryContainer }}
                                color={form.type === 'customer' ? theme.colors.primary : theme.colors.secondary}
                            />
                        </View>

                        <List.AccordionGroup>
                            <AppCard style={styles.sectionCard}>
                                <List.Accordion title="Party Type" id="1" left={props => <List.Icon {...props} icon="account-group" />} titleStyle={{ fontWeight: '700' }} style={styles.accordionHeader}>
                                    <View style={styles.accordionContent}>
                                        <SegmentedButtons
                                            value={form.type}
                                            onValueChange={(val) => setForm({ ...form, type: val as PartyType })}
                                            buttons={[
                                                { value: 'customer', label: 'Customer', icon: 'account' },
                                                { value: 'supplier', label: 'Supplier', icon: 'truck-delivery' },
                                            ]}
                                            style={styles.segmented}
                                            density="medium"
                                        />
                                    </View>
                                </List.Accordion>
                            </AppCard>

                            <AppCard style={styles.sectionCard}>
                                <List.Accordion title="Contact Details" id="2" left={props => <List.Icon {...props} icon="card-account-phone-outline" />} titleStyle={{ fontWeight: '700' }} style={styles.accordionHeader}>
                                    <View style={styles.accordionContent}>
                                        <AppInput
                                            label="Name"
                                            value={form.name}
                                            onChangeText={(t) => setForm({ ...form, name: t })}
                                            inputType="name"
                                            left={<TextInput.Icon icon="account" />}
                                        />
                                        <AppInput
                                            label="Phone Number"
                                            value={form.phone}
                                            onChangeText={(t) => setForm({ ...form, phone: t.replace(/\D/g, '') })}
                                            inputType="phone"
                                            left={<TextInput.Icon icon="phone" />}
                                        />
                                        <AppInput
                                            label="Email (Optional)"
                                            value={form.email}
                                            onChangeText={(t) => setForm({ ...form, email: t })}
                                            inputType="email"
                                            autoCapitalize="none"
                                            left={<TextInput.Icon icon="email" />}
                                        />
                                    </View>
                                </List.Accordion>
                            </AppCard>

                            <AppCard style={styles.sectionCard}>
                                <List.Accordion title="Tax & Billing" id="3" left={props => <List.Icon {...props} icon="receipt" />} titleStyle={{ fontWeight: '700' }} style={styles.accordionHeader}>
                                    <View style={styles.accordionContent}>
                                        <AppInput
                                            label="GST Number (Optional)"
                                            value={form.gstNumber}
                                            onChangeText={(t) => setForm({ ...form, gstNumber: t.toUpperCase().replace(/[^0-9A-Z]/g, '') })}
                                            autoCapitalize="characters"
                                            left={<TextInput.Icon icon="file-document-outline" />}
                                        />
                                        <AppInput
                                            label="Address"
                                            value={form.address}
                                            onChangeText={(t) => setForm({ ...form, address: t })}
                                            multiline
                                            numberOfLines={3}
                                            inputType="text"
                                            left={<TextInput.Icon icon="map-marker" />}
                                        />
                                    </View>
                                </List.Accordion>
                            </AppCard>
                        </List.AccordionGroup>

                        <View style={styles.actions}>
                            <AppButton
                                mode="contained"
                                onPress={handleSubmit}
                                loading={loading}
                                style={styles.primaryButton}
                                icon="check"
                            >
                                {isNew ? 'Save Party' : 'Update Details'}
                            </AppButton>

                            {!isNew && (
                                <AppButton
                                    mode="outlined"
                                    onPress={handleDelete}
                                    loading={loading}
                                    style={[styles.secondaryButton, { borderColor: theme.colors.error }]}
                                    textColor={theme.colors.error}
                                    icon="delete"
                                >
                                    Delete Party
                                </AppButton>
                            )}
                        </View>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    blockedContainer: {
        flex: 1,
        paddingTop: DesignSystem.layout.pageTop,
        alignItems: 'center',
        justifyContent: 'center',
    },
    content: {
        paddingTop: DesignSystem.layout.pageTop,
        paddingBottom: DesignSystem.layout.pageBottom,
        alignItems: 'center',
    },
    contentInner: {
        width: '100%',
        paddingHorizontal: DesignSystem.spacing.xs, 
    },
    contentInnerWide: {
        maxWidth: DesignSystem.layout.formMaxWidth,
        paddingHorizontal: 0,
    },
    avatarContainer: {
        alignItems: 'center',
        marginBottom: DesignSystem.spacing.md,
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: DesignSystem.spacing.sm,
    },
    sectionCard: {
        marginBottom: DesignSystem.spacing.xs,
        padding: 0,
        overflow: 'hidden',
    },
    accordionHeader: {
        backgroundColor: 'transparent',
    },
    accordionContent: {
        paddingHorizontal: DesignSystem.spacing.md,
        paddingBottom: DesignSystem.spacing.md,
    },
    segmented: {
        marginBottom: DesignSystem.spacing.xs,
    },
    actions: {
        marginTop: DesignSystem.spacing.md,
        marginBottom: DesignSystem.spacing.xl,
    },
    primaryButton: {
        marginBottom: DesignSystem.spacing.sm,
    },
    secondaryButton: {
        borderWidth: 1,
    },
});
