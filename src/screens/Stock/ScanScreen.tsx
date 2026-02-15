
import { useState, useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { CameraView, Camera, type BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { useHaptics } from '../../hooks/useHaptics';

export default function ScanScreen() {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);
    const [lastCode, setLastCode] = useState('');
    const router = useRouter();
    const params = useLocalSearchParams<{ target?: string | string[]; returnPath?: string | string[] }>();
    const haptics = useHaptics();
    const theme = useTheme();

    useEffect(() => {
        const getPermissions = async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        };
        getPermissions();
    }, []);

    const handleBarCodeScanned = ({ data }: BarcodeScanningResult) => {
        setScanned(true);
        setLastCode(data);
        void haptics.triggerNotification();

        const targetParam = Array.isArray(params.target) ? params.target[0] : params.target;
        const returnPathParam = Array.isArray(params.returnPath) ? params.returnPath[0] : params.returnPath;

        if (targetParam === 'item_detail') {
            if (returnPathParam === '/(main)/(tabs)/billing') {
                router.replace({ pathname: '/(main)/(tabs)/billing', params: { search: data } });
            } else {
                router.replace({ pathname: '/(main)/(tabs)/stock', params: { search: data } });
            }
            return;
        }

        const target = targetParam === 'billing' ? '/(main)/(tabs)/billing' : '/(main)/(tabs)/stock';
        router.replace({ pathname: target, params: { search: data } });
    };

    if (hasPermission === null) {
        return (
            <ScreenWrapper>
                <View style={styles.centered}>
                    <AppCard>
                        <Text style={styles.centerText}>Requesting camera permission...</Text>
                    </AppCard>
                </View>
            </ScreenWrapper>
        );
    }
    if (hasPermission === false) {
        return (
            <ScreenWrapper>
                <View style={styles.centered}>
                    <AppCard>
                        <Text style={styles.centerText}>No access to camera.</Text>
                        <AppButton mode="contained" style={styles.actionButton} onPress={() => router.back()}>
                            Go Back
                        </AppButton>
                    </AppCard>
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ['qr', 'ean13', 'code128'],
                }}
            />
            {scanned && (
                <View style={[styles.overlay, { backgroundColor: theme.colors.surface, borderColor: theme.colors.outline }]}>
                    <Text style={[styles.overlayText, { color: theme.colors.onSurface }]}>Scanned: {lastCode}</Text>
                    <AppButton mode="contained" onPress={() => setScanned(false)}>
                        Scan Again
                    </AppButton>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
    },
    centered: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    centerText: {
        textAlign: 'center',
    },
    actionButton: {
        marginTop: 16,
    },
    overlay: {
        position: 'absolute',
        left: 20,
        right: 20,
        bottom: 40,
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        gap: 12,
    },
    overlayText: {
        textAlign: 'center',
    },
});
