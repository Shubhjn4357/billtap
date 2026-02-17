import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Chip, Text } from 'react-native-paper';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { AppInput } from '../../components/common/AppInput';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useAppDialog } from '../../components/providers/DialogProvider';
import { userService } from '../../api/userService';
import { useAuth } from '../../hooks/useAuth';
import { useNetworkStore, useUserStore } from '../../store';
import { isNetworkLikeError } from '../../utils/errorGuards';

const normalizePhoneNumber = (raw: string): string => {
    const digits = raw.replace(/\D/g, '');
    if (!digits) return '';
    return `+${digits}`;
};

export const ProfileSetupScreen = () => {
    const dialog = useAppDialog();
    const { user, sendPhoneVerification } = useAuth();
    const { setUser } = useUserStore();
    const { isConnected, isInternetReachable } = useNetworkStore();
    const isOffline = isConnected === false || isInternetReachable === false;

    const [displayName, setDisplayName] = useState('');
    const [email, setEmail] = useState('');
    const [businessName, setBusinessName] = useState('');
    const [address, setAddress] = useState('');

    const [phoneInput, setPhoneInput] = useState('');
    const [verificationId, setVerificationId] = useState('');
    const [verificationCode, setVerificationCode] = useState('');

    const [savingProfile, setSavingProfile] = useState(false);
    const [sendingOtp, setSendingOtp] = useState(false);
    const [linkingPhone, setLinkingPhone] = useState(false);

    useEffect(() => {
        setDisplayName(user?.displayName ?? '');
        setEmail(user?.email ?? '');
        setBusinessName(user?.businessName ?? '');
        setAddress(user?.address ?? '');
        setPhoneInput(user?.phoneNumber ?? '');
    }, [user?.address, user?.businessName, user?.displayName, user?.email, user?.phoneNumber]);

    const profileSubtitle = useMemo(() => {
        return user?.email || user?.phoneNumber || 'Complete your profile and contact details';
    }, [user?.email, user?.phoneNumber]);

    const handleSaveProfile = async () => {
        if (!user) {
            dialog.alert('Profile', 'You must be logged in.');
            return;
        }
        setSavingProfile(true);
        try {
            const updatedUser = await userService.updateCurrentUser({
                displayName: displayName.trim() || null,
                email: email.trim() || null,
                businessName: businessName.trim() || undefined,
                address: address.trim() || undefined,
            });
            setUser(updatedUser);
            dialog.alert('Profile', 'Profile updated successfully.');
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Profile', error instanceof Error ? error.message : 'Failed to update profile.');
            }
        } finally {
            setSavingProfile(false);
        }
    };

    const handleSendOtp = async () => {
        const normalizedPhone = normalizePhoneNumber(phoneInput);
        if (!normalizedPhone || normalizedPhone.length < 8) {
            dialog.alert('Phone Link', 'Enter a valid phone number with country code.');
            return;
        }
        setSendingOtp(true);
        try {
            const session = await sendPhoneVerification(normalizedPhone);
            setVerificationId(session.verificationId);
            const message = session.testCode
                ? `OTP sent.\n\nTest OTP: ${session.testCode}`
                : 'OTP sent successfully.';
            dialog.alert('Phone Link', message);
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Phone Link', error instanceof Error ? error.message : 'Failed to send OTP.');
            }
        } finally {
            setSendingOtp(false);
        }
    };

    const handleVerifyAndLink = async () => {
        if (!verificationId) {
            dialog.alert('Phone Link', 'Send OTP first.');
            return;
        }
        const normalizedCode = verificationCode.replace(/\D/g, '');
        if (normalizedCode.length !== 6) {
            dialog.alert('Phone Link', 'Enter the 6-digit OTP.');
            return;
        }

        setLinkingPhone(true);
        try {
            const updatedUser = await userService.linkPhoneNumber(verificationId, normalizedCode);
            setUser(updatedUser);
            setVerificationId('');
            setVerificationCode('');
            setPhoneInput(updatedUser.phoneNumber ?? phoneInput);
            dialog.alert('Phone Link', 'Phone number linked successfully.');
        } catch (error: unknown) {
            if (!isNetworkLikeError(error)) {
                dialog.alert('Phone Link', error instanceof Error ? error.message : 'Failed to link phone number.');
            }
        } finally {
            setLinkingPhone(false);
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.content}>
                <PageHeaderCard
                    title="Profile Setup"
                    subtitle={profileSubtitle}
                />

                <View style={styles.statusRow}>
                    <Chip compact>{isOffline ? 'Offline mode' : 'Online'}</Chip>
                    <Chip compact>{user?.role ? `Role: ${user.role}` : 'Role: owner'}</Chip>
                </View>

                <AppCard animationDelay={40}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Account Profile
                    </Text>
                    <AppInput
                        label="Display Name"
                        value={displayName}
                        onChangeText={setDisplayName}
                        placeholder="Your name"
                    />
                    <AppInput
                        label="Email"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        placeholder="name@example.com"
                    />
                    <AppInput
                        label="Business Name"
                        value={businessName}
                        onChangeText={setBusinessName}
                        placeholder="Business name"
                    />
                    <AppInput
                        label="Address"
                        value={address}
                        onChangeText={setAddress}
                        placeholder="Business address"
                    />
                    <AppButton
                        mode="contained"
                        onPress={() => { void handleSaveProfile(); }}
                        loading={savingProfile}
                    >
                        Save Profile
                    </AppButton>
                </AppCard>

                <AppCard animationDelay={80}>
                    <Text variant="titleMedium" style={styles.sectionTitle}>
                        Mobile Number Linking
                    </Text>
                    <Text variant="bodySmall" style={styles.helperText}>
                        Current linked phone: {user?.phoneNumber || 'Not linked'}
                    </Text>
                    <AppInput
                        label="Mobile Number"
                        value={phoneInput}
                        onChangeText={setPhoneInput}
                        keyboardType="phone-pad"
                        placeholder="+91..."
                    />
                    <AppButton
                        mode="outlined"
                        onPress={() => { void handleSendOtp(); }}
                        loading={sendingOtp}
                    >
                        Send OTP
                    </AppButton>

                    {verificationId ? (
                        <View style={styles.verifySection}>
                            <AppInput
                                label="Verification Code"
                                value={verificationCode}
                                onChangeText={setVerificationCode}
                                keyboardType="number-pad"
                                placeholder="6-digit OTP"
                            />
                            <AppButton
                                mode="contained-tonal"
                                onPress={() => { void handleVerifyAndLink(); }}
                                loading={linkingPhone}
                            >
                                Verify And Link
                            </AppButton>
                        </View>
                    ) : null}
                </AppCard>
            </ScrollView>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    content: {
        paddingBottom: 30,
        gap: 12,
    },
    sectionTitle: {
        fontWeight: '700',
        marginBottom: 8,
    },
    helperText: {
        marginBottom: 10,
        opacity: 0.8,
    },
    verifySection: {
        marginTop: 10,
    },
    statusRow: {
        flexDirection: 'row',
        gap: 8,
        marginBottom: 2,
    },
});
