import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, Image } from 'react-native';
import { TextInput, Button, Text, useTheme } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../../../lib/firebase'; // Ensure this exports auth
import { useUserStore } from '../../../store';


export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const theme = useTheme();
  const { setUser } = useUserStore();

  const handleLogin = async () => {
    if (!email || !password) return;
    setLoading(true);
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      // Fetched user profile logic usually handled by useAuth listener but we can manually triggering if needed
      // For now, let the listener handle it or just redirect
      // router.replace('/'); // handled by layout usually
    } catch (error: any) {
      alert(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.form}>
        <View style={styles.logoContainer}>
            <Image 
                source={require('../../../../assets/icon.png')} 
                style={{ width: 100, height: 100, borderRadius: 20 }} 
            />
            <Text variant="headlineLarge" style={{ fontWeight: 'bold', marginTop: 20, color: theme.colors.primary }}>BillTap</Text>
        </View>

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          autoCapitalize="none"
          keyboardType="email-address"
          style={styles.input}
        />
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          secureTextEntry
          style={styles.input}
        />
        <Button 
            mode="contained" 
            onPress={handleLogin} 
            loading={loading} 
            style={styles.button}
            contentStyle={{ paddingVertical: 8 }}
        >
          Login
        </Button>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 20 },
  form: { flex: 1, justifyContent: 'center' },
  logoContainer: { alignItems: 'center', marginBottom: 40 },
  input: { marginBottom: 16 },
  button: { marginTop: 10 },
});
