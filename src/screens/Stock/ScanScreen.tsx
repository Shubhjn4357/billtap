
import { useState, useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { CameraView, Camera, type BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button } from 'react-native-paper';
import { useHaptics } from '../../hooks/useHaptics';

export default function ScanScreen() {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);
    const [lastCode, setLastCode] = useState('');
    const router = useRouter();
    const params = useLocalSearchParams<{ target?: string | string[]; returnPath?: string | string[] }>();
    const haptics = useHaptics();

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
            <View style={styles.centered}>
                <Text>Requesting camera permission...</Text>
            </View>
        );
    }
    if (hasPermission === false) {
        return (
            <View style={styles.centered}>
                <Text>No access to camera.</Text>
                <Button mode="contained" style={styles.actionButton} onPress={() => router.back()}>
                    Go Back
                </Button>
            </View>
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
                <View style={styles.overlay}>
                    <Text style={styles.overlayText}>Scanned: {lastCode}</Text>
                    <Button mode="contained" onPress={() => setScanned(false)}>
                        Scan Again
                    </Button>
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
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        gap: 12,
    },
    overlayText: {
        color: '#fff',
        textAlign: 'center',
    },
});
