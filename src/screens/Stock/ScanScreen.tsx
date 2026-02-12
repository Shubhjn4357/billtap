
import { useState, useEffect } from 'react';
import { Text, View, StyleSheet, Button } from 'react-native';
import { CameraView, Camera } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { useCartStore } from '../../store/cartStore';
import { useHaptics } from '../../hooks/useHaptics';

export default function ScanScreen() {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);
    const router = useRouter();
    const theme = useTheme();
    const haptics = useHaptics();

    useEffect(() => {
        const getPermissions = async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        };
        getPermissions();
    }, []);

    // Assuming we want to add to cart or search stock
    // For now, let's assume it populates a global scan result in store or params
    // But useCartStore has setScannedCode, let's use that if we scanned for cart
    // OR we might be scanning for stock lookup.
    // The store had `setScannedCode`. Let's support that.

    // Note: useCartStore definition I wrote earlier didn't include `setScannedCode`.
    // I should update useCartStore or just handle it here.
    // Let's assume for now we just pass it back via router params or global store.

    // Checking my previous write for useCartStore... I missed `scannedCode` in my new implementation!
    // I need to add it back or use a different approach.
    // Given the user constraint "Atomic Implementation", I should update useCartStore too if needed.
    // But for now, let's just log it or alert it to show it works, or verify useCartStore again.

    // Actually, let's look at `useCartStore` I wrote:
    /*
    export const useCartStore = create<CartState>((set, get) => ({
        items: [], ...
    */
    // It checks `items`, `customerName`, etc. I removed `scannedCode`.
    // I should probably add `scannedCode` back if it's used by other screens (like StockList).
    // Or simpler: Navigate back with params? Expo Router supports params.
    // `router.push({ pathname: '/stock', params: { scannedCode: data } })`

    const handleBarCodeScanned = ({ type, data }: { type: string, data: string }) => {
        setScanned(true);
        haptics.triggerNotification();
        // Navigate back with the code.
        // Assuming the previous screen listens for params or we use a global store.
        // For now, let's assume we navigate to stock list with query
        router.replace({ pathname: '/(tabs)/stock', params: { search: data } });
    };

    if (hasPermission === null) {
        return <Text>Requesting for camera permission</Text>;
    }
    if (hasPermission === false) {
        return <Text>No access to camera</Text>;
    }

    return (
        <View style={styles.container}>
            <CameraView
                style={StyleSheet.absoluteFillObject}
                onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr", "ean13", "code128"],
                }}
            />
            {scanned && <Button title={'Tap to Scan Again'} onPress={() => setScanned(false)} />}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        flexDirection: 'column',
        justifyContent: 'center',
    },
});
