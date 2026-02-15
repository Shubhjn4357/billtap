
import React, { useState } from 'react';
import { View, Alert } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppInput } from '../../components/common/AppInput';
import { AppButton } from '../../components/common/AppButton';
import { COMMON_TEXT } from '../../constants/staticText';
import { staffService } from '../../api/staffService';

export const AddStaffScreen = () => {
    const router = useRouter();
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);

    const handleInvite = async () => {
        if (!phone || phone.length < 10) {
            return Alert.alert(COMMON_TEXT.alerts.error, 'Please enter a valid phone number.');
        }

        setLoading(true);
        try {
            const result = await staffService.inviteStaff(phone);
            Alert.alert(COMMON_TEXT.alerts.success, `Invite sent. Code: ${result.code}`);
            router.back();
        } catch (error: unknown) {
            Alert.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to send invite.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper>
            <View style={{ padding: 16 }}>
                <Text variant="headlineSmall" style={{ marginBottom: 20 }}>Invite Staff Member</Text>
                
                <Text style={{ marginBottom: 20 }}>
                    Enter the phone number of the staff member you want to invite. 
                    They will receive a code to join your business.
                </Text>

                <AppInput
                    label="Phone Number"
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                />

                <AppButton
                    mode="contained"
                    onPress={handleInvite}
                    loading={loading}
                    style={{ marginTop: 20 }}
                >
                    Send Invite
                </AppButton>
            </View>
        </ScreenWrapper>
    );
};
