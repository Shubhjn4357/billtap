import { useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraView, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../hooks/useSmartBack';
import { getColors, Radius, Spacing } from '../constants/theme';
import { AppTopBar } from '../components/ui/AppTopBar';

type ScanTarget = 'stock' | 'billing' | 'item_detail' | 'upi' | 'upi_profile';

const DEFAULT_TYPES: NonNullable<ComponentProps<typeof CameraView>['barcodeScannerSettings']>['barcodeTypes'] = [
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

const getSingleParam = (value?: string | string[]) => (Array.isArray(value) ? value[0] : value);

const pushWithReturnPath = (destination: string, params: Record<string, string>) => {
    const [pathnameRaw, queryRaw] = destination.split('?');
    const basePath = pathnameRaw || '/(main)/inventory';
    const seededParams = queryRaw
        ? Object.fromEntries(new URLSearchParams(queryRaw).entries())
        : {};
    router.replace({
        pathname: basePath as never,
        params: { ...seededParams, ...params },
    });
};

export default function ScanScreen() {
    const scheme = useColorScheme() as 'light' | 'dark' | null;
    const colors = getColors(scheme ?? 'light');
    const s = styles(colors);
    const smartBack = useSmartBack('/(main)/more/settings/GENERAL');
    const params = useLocalSearchParams<{ target?: string | string[]; returnPath?: string | string[]; scanField?: string | string[] }>();
    const [hasPermission, setHasPermission] = useState<boolean | null>(null);
    const [scanned, setScanned] = useState(false);

    useEffect(() => {
        let mounted = true;
        (async () => {
            const { status } = await Camera.requestCameraPermissionsAsync();
            if (mounted) {
                setHasPermission(status === 'granted');
            }
        })();
        return () => {
            mounted = false;
        };
    }, []);

    const handleScan = (event: BarcodeScanningResult) => {
        if (scanned) return;
        setScanned(true);

        const data = event.data?.trim();
        if (!data) {
            setScanned(false);
            return;
        }

        const targetParam = getSingleParam(params.target) as ScanTarget | undefined;
        const returnPathParam = getSingleParam(params.returnPath);
        const scanFieldParam = getSingleParam(params.scanField) || 'barcode';
        const scanAt = Date.now().toString();

        if (targetParam === 'item_detail') {
            const destination = returnPathParam || '/(main)/inventory/add-item';
            pushWithReturnPath(destination, { barcode: data, scanned: 'true', scanAt, scanField: scanFieldParam });
            return;
        }

        if (targetParam === 'upi' || targetParam === 'upi_profile') {
            const destination = returnPathParam || '/(main)/more/settings/GENERAL';
            pushWithReturnPath(destination, { upiPayload: data, scanAt });
            return;
        }

        const destination = targetParam === 'billing' ? '/(main)/billing/pos' : '/(main)/inventory';
        pushWithReturnPath(destination, { search: data, scanAt });
    };

    const subtitle = useMemo(() => {
        const target = (getSingleParam(params.target) || 'stock').toString().toLowerCase();
        if (target === 'upi' || target === 'upi_profile') return 'Scan UPI QR code';
        return 'Align barcode or QR inside the frame';
    }, [params.target]);

    if (hasPermission === null) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <View style={s.centered}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={[s.helpText, { color: colors.textSecondary }]}>Requesting camera permission...</Text>
                </View>
            </SafeAreaView>
        );
    }

    if (hasPermission === false) {
        return (
            <SafeAreaView style={s.safe} edges={['top']}>
                <View style={s.centered}>
                    <Text style={[s.title, { color: colors.text }]}>Camera permission denied</Text>
                    <Text style={[s.helpText, { color: colors.textSecondary }]}>Enable camera access to scan barcode or QR.</Text>
                    <Pressable style={[s.actionBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
                        <Text style={s.actionText}>Go Back</Text>
                    </Pressable>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={s.safe} edges={['top']}>
            <AppTopBar
                title="Scan"
                subtitle={subtitle}
                onBackPress={smartBack}
            />

            <View style={s.cameraWrap}>
                <CameraView
                    style={StyleSheet.absoluteFillObject}
                    onBarcodeScanned={scanned ? undefined : handleScan}
                    barcodeScannerSettings={{ barcodeTypes: DEFAULT_TYPES }}
                />
            </View>

            <View style={s.footer}>
                <Pressable
                    style={[s.secondaryBtn, { borderColor: colors.border }]}
                    onPress={() => setScanned(false)}
                >
                    <Text style={[s.secondaryText, { color: colors.textSecondary }]}>Scan Again</Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

const styles = (colors: ReturnType<typeof getColors>) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        title: { fontWeight: '700', fontSize: 18 },
        cameraWrap: {
            flex: 1,
            borderRadius: Radius.card,
            overflow: 'hidden',
            marginHorizontal: Spacing.lg,
            marginBottom: Spacing.md,
        },
        footer: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg },
        secondaryBtn: {
            borderWidth: 1,
            borderRadius: Radius.pill,
            paddingVertical: Spacing.sm,
            alignItems: 'center',
        },
        secondaryText: { fontWeight: '600', fontSize: 13 },
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: Spacing.lg,
            gap: Spacing.sm,
        },
        helpText: { textAlign: 'center', fontSize: 13 },
        actionBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.lg,
            paddingVertical: Spacing.sm,
            marginTop: Spacing.sm,
        },
        actionText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
    });
