import { useState, useEffect } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { CameraView, Camera, type BarcodeScanningResult } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from 'react-native-paper';
import { AppButton } from '../../components/common/AppButton';
import { AppCard } from '../../components/common/AppCard';
import { LoadingScreen } from '../../components/common/LoadingScreen';
import { PageHeaderCard } from '../../components/common/PageHeaderCard';
import { ScreenWrapper } from '../../components/layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
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
        void getPermissions();
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

        if (targetParam === 'upi' || targetParam === 'upi_profile') {
            const destination = returnPathParam || '/profile';
            router.replace({ pathname: destination as never, params: { upiPayload: data } });
            return;
        }

        const target = targetParam === 'billing' ? '/(main)/(tabs)/billing' : '/(main)/(tabs)/stock';
        router.replace({ pathname: target, params: { search: data } });
    };

    if (hasPermission === null) {
        return <LoadingScreen message="Requesting camera permission..." />;
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
        <ScreenWrapper disableTabPadding>
            <View style={styles.container}>
                <PageHeaderCard
                    title="Scan Barcode"
                    subtitle="Align barcode or QR within the frame"
                    right={(
                        <AppButton mode="text" compact onPress={() => router.back()}>
                            Close
                        </AppButton>
                    )}
                />

                <View style={styles.cameraWrap}>
                    <CameraView
                        style={StyleSheet.absoluteFillObject}
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{
                            barcodeTypes: ['qr', 'ean13', 'code128'],
                        }}
                    />
                </View>

                {scanned ? (
                    <AppCard
                        style={[
                            styles.overlay,
                            {
                                backgroundColor: theme.colors.surface,
                                borderColor: theme.colors.outlineVariant,
                            },
                        ]}
                    >
                        <Text style={[styles.overlayText, { color: theme.colors.onSurface }]}>Scanned: {lastCode}</Text>
                        <AppButton mode="contained" onPress={() => setScanned(false)}>
                            Scan Again
                        </AppButton>
                    </AppCard>
                ) : (
                    <View style={styles.helper}>
                        <Text style={{ color: theme.colors.onSurfaceVariant }}>
                            Tip: keep a steady distance for faster detection.
                        </Text>
                    </View>
                )}
            </View>
        </ScreenWrapper>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        paddingTop: DesignSystem.layout.pageTop,
    },
    cameraWrap: {
        flex: 1,
        borderRadius: DesignSystem.radius.lg,
        overflow: 'hidden',
        marginBottom: DesignSystem.spacing.sm,
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
        left: 0,
        right: 0,
        bottom: DesignSystem.spacing.md,
        borderWidth: 1,
    },
    overlayText: {
        textAlign: 'center',
        marginBottom: DesignSystem.spacing.xs,
    },
    helper: {
        paddingHorizontal: DesignSystem.spacing.xs,
        paddingBottom: DesignSystem.spacing.sm,
    },
});
