import React, { useEffect, useState } from 'react';
import { Text, View, StyleSheet } from 'react-native';
import { CameraView, Camera, type BarcodeScanningResult } from 'expo-camera';
import { useTheme } from 'react-native-paper';
import { AppButton } from '../common/AppButton';
import { AppCard } from '../common/AppCard';
import { LoadingScreen } from '../common/LoadingScreen';
import { PageHeaderCard } from '../common/PageHeaderCard';
import { ScreenWrapper } from '../layout/ScreenWrapper';
import { DesignSystem } from '../../constants/DesignSystem';
import { useHaptics } from '../../hooks/useHaptics';

type BarcodeType = NonNullable<
    NonNullable<React.ComponentProps<typeof CameraView>['barcodeScannerSettings']>['barcodeTypes']
>[number];

interface AppScanCaptureScreenProps {
    title?: string;
    subtitle?: string;
    helperText?: string;
    closeLabel?: string;
    barcodeTypes?: BarcodeType[];
    onScan: (data: string, event: BarcodeScanningResult) => void;
    onClose: () => void;
}

const DEFAULT_BARCODE_TYPES: BarcodeType[] = [
    'qr',
    'ean13',
    'ean8',
    'pdf417',
    'aztec',
    'datamatrix',
    'code128',
    'code39',
    'upc_e',
];

export const AppScanCaptureScreen: React.FC<AppScanCaptureScreenProps> = ({
    title = 'Scan Barcode',
    subtitle = 'Align barcode or QR within the frame',
    helperText = 'Tip: keep a steady distance for faster detection.',
    closeLabel = 'Close',
    barcodeTypes = DEFAULT_BARCODE_TYPES,
    onScan,
    onClose,
}) => {
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);
    const [lastCode, setLastCode] = useState('');
    const haptics = useHaptics();
    const theme = useTheme();

    useEffect(() => {
        const getPermissions = async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            setHasPermission(status === 'granted');
        };
        void getPermissions();
    }, []);

    const handleBarCodeScanned = (event: BarcodeScanningResult) => {
        setScanned(true);
        setLastCode(event.data);
        void haptics.triggerNotification();
        onScan(event.data, event);
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
                        <AppButton mode="contained" style={styles.actionButton} onPress={onClose}>
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
                    title={title}
                    subtitle={subtitle}
                    right={(
                        <AppButton mode="text" compact onPress={onClose}>
                            {closeLabel}
                        </AppButton>
                    )}
                />

                <View style={styles.cameraWrap}>
                    <CameraView
                        style={StyleSheet.absoluteFillObject}
                        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
                        barcodeScannerSettings={{ barcodeTypes }}
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
                            {helperText}
                        </Text>
                    </View>
                )}
            </View>
        </ScreenWrapper>
    );
};

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
