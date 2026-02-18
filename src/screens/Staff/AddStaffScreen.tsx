
import React, { useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { AppCard } from '../../components/common/AppCard';
import { AppButton } from '../../components/common/AppButton';
import { PhoneNumberInput } from '../../components/forms/PhoneNumberInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { DEFAULT_COUNTRY_DIAL_CODE } from '../../constants/countryDialCodes';
import { DesignSystem } from '../../constants/DesignSystem';
import { COMMON_TEXT } from '../../constants/staticText';
import { staffService } from '../../api/staffService';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { buildE164PhoneNumber, sanitizePhoneLocal } from '../../utils/phone';
import { staffInviteSchema } from '../../validation/forms';

export const AddStaffScreen = () => {
    const router = useRouter();
    const { width } = useWindowDimensions();
    const isWide = width >= 960;
    const dialog = useAppDialog();
    const [dialCode, setDialCode] = useState(DEFAULT_COUNTRY_DIAL_CODE);
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);

    const handleInvite = async () => {
        const normalizedPhone = buildE164PhoneNumber(dialCode, phone);
        const validation = staffInviteSchema.safeParse({
            phone: normalizedPhone,
        });
        if (!validation.success) {
            dialog.alert(COMMON_TEXT.alerts.error, validation.error.issues[0]?.message || 'Please enter a valid phone number.');
            return;
        }

        setLoading(true);
        try {
            const result = await staffService.inviteStaff(validation.data.phone);
            dialog.alert(COMMON_TEXT.alerts.success, `Invite sent. Code: ${result.code}`);
            router.back();
        } catch (error: unknown) {
            dialog.alert(COMMON_TEXT.alerts.error, error instanceof Error ? error.message : 'Failed to send invite.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
                <View style={[styles.contentInner, isWide && styles.contentInnerWide]}>
                    <PageHeaderCard
                        title="Invite Staff Member"
                        subtitle="Enter a staff phone number. They receive a one-time code to join your business."
                    />
                    <AppCard>
                        <PhoneNumberInput
                            label="Phone Number"
                            dialCode={dialCode}
                            onDialCodeChange={setDialCode}
                            phoneNumber={phone}
                            onPhoneNumberChange={(next) => setPhone(sanitizePhoneLocal(next))}
                            placeholder="9876543210"
                        />

                        <AppButton
                            mode="contained"
                            onPress={handleInvite}
                            loading={loading}
                            style={styles.submitButton}
                        >
                            Send Invite
                        </AppButton>
                        <Text variant="bodySmall" style={styles.helperText}>
                            Staff can login directly with OTP on this number.
                        </Text>
                    </AppCard>
                </View>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
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
    submitButton: {
        marginTop: DesignSystem.spacing.xs + 2,
    },
    helperText: {
        marginTop: DesignSystem.spacing.sm,
    },
});
