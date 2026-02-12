
import { useState } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { doc, setDoc } from 'firebase/firestore';
import { auth, db } from '../../api/firebaseConfig';
import { useUserStore } from '../../store';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';

export default function BusinessSetupScreen() {
    const { user, setUser } = useUserStore();
    const router = useRouter();
    const theme = useTheme();
    
    const [businessName, setBusinessName] = useState('');
    const [address, setAddress] = useState('');
    const [gst, setGst] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSave = async () => {
        if (!businessName) {
            Alert.alert('Required', 'Business Name is required');
            return;
        }

        setLoading(true);
        try {
            const uid = auth.currentUser?.uid;
            if (!uid) return;

            const updateData = {
                businessName,
                address,
                gstNumber: gst,
                gstEnabled: !!gst,
                updatedAt: Date.now()
            };

            await setDoc(doc(db, 'users', uid), updateData, { merge: true });
            
            // Update local store
            if (user) {
                setUser({ ...user, ...updateData });
            }

            router.replace('/(tabs)/home');

        } catch (error: any) {
            Alert.alert('Error', error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <ScreenWrapper>
            <ScrollView contentContainerStyle={styles.container}>
                <Text variant="headlineMedium" style={{ marginBottom: 20, fontWeight: 'bold' }}>Setup Business</Text>
                <Text variant="bodyLarge" style={{ marginBottom: 30, color: theme.colors.secondary }}>
                    Enter your business details to get started with BillTap.
                </Text>

                <TextInput
                    label="Business Name"
                    value={businessName}
                    onChangeText={setBusinessName}
                    mode="outlined"
                    style={styles.input}
                />

                <TextInput
                    label="Business Address"
                    value={address}
                    onChangeText={setAddress}
                    mode="outlined"
                    multiline
                    numberOfLines={3}
                    style={styles.input}
                />

                <TextInput
                    label="GST Number (Optional)"
                    value={gst}
                    onChangeText={setGst}
                    mode="outlined"
                    style={styles.input}
                    autoCapitalize="characters"
                />

                <Button 
                    mode="contained" 
                    onPress={handleSave} 
                    loading={loading} 
                    style={styles.button}
                >
                    Start Billing
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
