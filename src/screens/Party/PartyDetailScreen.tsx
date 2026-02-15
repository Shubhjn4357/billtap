
import React, { useState, useEffect } from 'react';
import { ScrollView, Alert } from 'react-native';
import { Text, useTheme, SegmentedButtons } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { usePartyStore } from '../../store';
import { COMMON_TEXT } from '../../constants/staticText';
import type { PartyType } from '../../types';
import { partyService } from '../../api/partyService';
import { useAuth } from '../../hooks/useAuth';

export const PartyDetailScreen = () => {
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const partyId = Array.isArray(params.id) ? params.id[0] : params.id;
    const isNew = partyId === 'new';
    const { parties, addParty, updateParty, deleteParty, loading } = usePartyStore();
    const { user } = useAuth();
    const router = useRouter();
    const theme = useTheme();

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
        if (!form.name || !form.phone) {
            return Alert.alert(COMMON_TEXT.alerts.error, 'Name and Phone are required.');
        }
        if (!user) {
            return Alert.alert(COMMON_TEXT.alerts.error, 'You must be logged in.');
        }

        try {
            if (isNew) {
                const id = await partyService.createParty({
                    name: form.name,
                    type: form.type,
                    phone: form.phone,
                    email: form.email,
                    address: form.address,
                    gstNumber: form.gstNumber,
                    isActive: true,
                });

                addParty({
                    id,
                    userId: user.uid,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString(),
                    ...form
                });
                Alert.alert(COMMON_TEXT.alerts.success, 'Party added successfully.');
                router.back();
            } else {
                if (!partyId) return;
                await partyService.updateParty(partyId, {
                    name: form.name,
                    type: form.type,
                    phone: form.phone,
                    email: form.email,
                    address: form.address,
                    gstNumber: form.gstNumber,
                });
                updateParty(partyId, {
                    ...form,
                    updatedAt: new Date().toISOString()
                });
                Alert.alert(COMMON_TEXT.alerts.success, 'Party updated successfully.');
                router.back();
            }
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to save party.');
        }
    };

    const handleDelete = () => {
        if (isNew || !partyId) return;
        Alert.alert(
            'Delete Party',
            'Are you sure you want to delete this party?',
            [
                { text: 'Cancel', style: 'cancel' },
                { 
                    text: 'Delete', 
                    style: 'destructive', 
                    onPress: async () => {
                        try {
                            await partyService.archiveParty(partyId);
                        } catch {
                            // keep local cleanup even if remote call fails
                        }
                        deleteParty(partyId);
                        router.back();
                    }
                }
            ]
        );
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={{ paddingTop: 20 }}>
                <PageHeaderCard
                    title={isNew ? 'Add Party' : 'Edit Party'}
                    subtitle="Manage customer/supplier details, tax info and contact fields."
                />

                <AppCard>
                    <Text variant="titleSmall" style={{ fontWeight: '700', marginBottom: 10 }}>
                        Party Type
                    </Text>
                    <SegmentedButtons
                        value={form.type}
                        onValueChange={(val) => setForm({ ...form, type: val as PartyType })}
                        buttons={[
                            { value: 'customer', label: 'Customer' },
                            { value: 'supplier', label: 'Supplier' },
                        ]}
                        style={{ marginBottom: 8 }}
                    />
                </AppCard>

                <AppCard>
                    <Text variant="titleSmall" style={{ fontWeight: '700', marginBottom: 10 }}>
                        Contact Information
                    </Text>
                    <AppInput
                        label="Name"
                        value={form.name}
                        onChangeText={(t) => setForm({ ...form, name: t })}
                    />
                    <AppInput
                        label="Phone Number"
                        value={form.phone}
                        onChangeText={(t) => setForm({ ...form, phone: t })}
                        keyboardType="phone-pad"
                    />
                    <AppInput
                        label="Email (Optional)"
                        value={form.email}
                        onChangeText={(t) => setForm({ ...form, email: t })}
                        keyboardType="email-address"
                        autoCapitalize="none"
                    />
                    <AppInput
                        label="GST Number (Optional)"
                        value={form.gstNumber}
                        onChangeText={(t) => setForm({ ...form, gstNumber: t })}
                        autoCapitalize="characters"
                    />
                    <AppInput
                        label="Address"
                        value={form.address}
                        onChangeText={(t) => setForm({ ...form, address: t })}
                        multiline
                        numberOfLines={3}
                    />
                </AppCard>

                <AppButton 
                    mode="contained" 
                    onPress={handleSubmit} 
                    loading={loading}
                    style={{ marginTop: 20 }}
                >
                    {isNew ? 'Save Party' : 'Update Party'}
                </AppButton>

                {!isNew && (
                    <AppButton
                        mode="outlined"
                        onPress={handleDelete}
                        loading={loading}
                        style={{ marginTop: 10 }}
                        textColor={theme.colors.error}
                        icon="delete"
                    >
                        Delete Party
                    </AppButton>
                )}
            </ScrollView>
        </ScreenWrapper>
    );
};
