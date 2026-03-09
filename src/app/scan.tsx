import { useEffect, useMemo, useState } from 'react';
import type { ComponentProps } from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Camera, CameraView, type BarcodeScanningResult } from 'expo-camera';
import { router, useLocalSearchParams } from 'expo-router';
import { useSmartBack } from '../hooks/useSmartBack';
import { DESIGN_SPACING, getPillStyle, getSurfaceStyle } from '../constants/designSystem';
import { Radius, Spacing, Typography, withAlpha, type ColorPalette } from '../constants/theme';
import { useAppColors } from '../hooks/useAppColors';
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
    const colors = useAppColors();
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
                <View pointerEvents="none" style={s.scanOverlay}>
                    <View style={s.frameWrap}>
                        <View style={[s.frameCorner, s.frameTopLeft]} />
                        <View style={[s.frameCorner, s.frameTopRight]} />
                        <View style={[s.frameCorner, s.frameBottomLeft]} />
                        <View style={[s.frameCorner, s.frameBottomRight]} />
                    </View>
                    <View style={s.guideCard}>
                        <MaterialCommunityIcons name="barcode-scan" size={18} color={colors.primary} />
                        <Text style={s.guideText}>
                            Keep the code inside the frame. Vahi will route the result to the correct workflow automatically.
                        </Text>
                    </View>
                </View>
            </View>

            <View style={s.footer}>
                <View style={s.footerCard}>
                    <View style={s.footerCopy}>
                        <Text style={s.footerTitle}>{scanned ? 'Result captured' : 'Scanner ready'}</Text>
                        <Text style={s.footerSubtitle}>
                            {scanned ? 'Use scan again if you want to capture a different barcode or QR.' : 'Barcode and QR formats are supported in the same frame.'}
                        </Text>
                    </View>
                    <Pressable
                        style={[s.secondaryBtn, { borderColor: colors.border }]}
                        onPress={() => setScanned(false)}
                    >
                        <Text style={[s.secondaryText, { color: colors.textSecondary }]}>Scan Again</Text>
                    </Pressable>
                </View>
            </View>
        </SafeAreaView>
    );
}

const styles = (colors: ColorPalette) =>
    StyleSheet.create({
        safe: { flex: 1, backgroundColor: colors.background },
        title: { fontWeight: '700', fontSize: 18 },
        cameraWrap: {
            flex: 1,
            ...getSurfaceStyle(colors, { accent: colors.primary, elevated: true }),
            borderRadius: Radius.card,
            overflow: 'hidden',
            marginHorizontal: DESIGN_SPACING.screenX,
            marginBottom: Spacing.md,
        },
        scanOverlay: {
            ...StyleSheet.absoluteFillObject,
            justifyContent: 'space-between',
            alignItems: 'center',
            paddingVertical: Spacing.xl,
            paddingHorizontal: DESIGN_SPACING.screenX,
        },
        frameWrap: {
            width: '76%',
            aspectRatio: 1.45,
            maxWidth: 320,
            maxHeight: 220,
            borderRadius: 28,
            borderWidth: 1,
            borderColor: withAlpha('#ffffff', '18'),
            backgroundColor: withAlpha('#000000', '12'),
            position: 'relative',
            marginTop: Spacing.xl,
        },
        frameCorner: {
            position: 'absolute',
            width: 34,
            height: 34,
            borderColor: '#ffffff',
        },
        frameTopLeft: {
            top: 14,
            left: 14,
            borderTopWidth: 4,
            borderLeftWidth: 4,
            borderTopLeftRadius: 18,
        },
        frameTopRight: {
            top: 14,
            right: 14,
            borderTopWidth: 4,
            borderRightWidth: 4,
            borderTopRightRadius: 18,
        },
        frameBottomLeft: {
            bottom: 14,
            left: 14,
            borderBottomWidth: 4,
            borderLeftWidth: 4,
            borderBottomLeftRadius: 18,
        },
        frameBottomRight: {
            bottom: 14,
            right: 14,
            borderBottomWidth: 4,
            borderRightWidth: 4,
            borderBottomRightRadius: 18,
        },
        guideCard: {
            width: '100%',
            ...getSurfaceStyle(colors, { floating: true }),
            borderRadius: Radius.card,
            borderColor: withAlpha('#ffffff', '18'),
            backgroundColor: withAlpha(colors.surface, 'D9'),
            flexDirection: 'row',
            alignItems: 'center',
            gap: Spacing.sm,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.md,
        },
        guideText: {
            flex: 1,
            color: colors.text,
            fontSize: Typography.caption.size,
            lineHeight: 18,
        },
        footer: { paddingHorizontal: DESIGN_SPACING.screenX, paddingBottom: Spacing.lg },
        footerCard: {
            ...getSurfaceStyle(colors, { elevated: true }),
            borderRadius: Radius.card,
            padding: Spacing.md,
            gap: Spacing.sm,
        },
        footerCopy: {
            gap: 2,
        },
        footerTitle: {
            color: colors.text,
            fontSize: Typography.title.size,
            fontWeight: '700',
        },
        footerSubtitle: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
            lineHeight: 18,
        },
        secondaryBtn: {
            ...getPillStyle(colors),
            borderRadius: Radius.pill,
            paddingVertical: Spacing.sm,
            alignItems: 'center',
            backgroundColor: colors.surface,
        },
        secondaryText: { fontWeight: '600', fontSize: 13 },
        centered: {
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: DESIGN_SPACING.screenX,
            gap: Spacing.sm,
        },
        helpText: { textAlign: 'center', fontSize: 13 },
        actionBtn: {
            borderRadius: Radius.pill,
            paddingHorizontal: Spacing.md,
            paddingVertical: Spacing.sm,
            marginTop: Spacing.sm,
        },
        actionText: { color: colors.onPrimary, fontWeight: '700', fontSize: 13 },
    });
