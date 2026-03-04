import { useMemo, useRef, useState } from 'react';
import {
    Alert,
    Modal,
    PanResponder,
    Pressable,
    StyleSheet,
    Text,
    View,
    useColorScheme,
} from 'react-native';
import { getColors, Radius, Spacing, Typography } from '../../constants/theme';

type SignatureCaptureSheetProps = {
    visible: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
};

const DRAWING_WIDTH = 900;
const DRAWING_HEIGHT = 360;

const normalizePoint = (value: number, max: number) => Math.max(0, Math.min(value, max));
type Point = { x: number; y: number };

export function SignatureCaptureSheet({ visible, onClose, onSave }: SignatureCaptureSheetProps) {
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);
    const [strokes, setStrokes] = useState<Point[][]>([]);
    const [activeStroke, setActiveStroke] = useState<Point[]>([]);
    const activeStrokeRef = useRef<Point[]>([]);

    const clear = () => {
        setStrokes([]);
        setActiveStroke([]);
        activeStrokeRef.current = [];
    };

    const save = () => {
        const allStrokes = [...strokes, activeStrokeRef.current].filter((entry) => entry.length > 1);
        if (allStrokes.length === 0) {
            Alert.alert('Signature', 'Draw signature before saving.');
            return;
        }

        const allPaths = allStrokes.map((stroke) => {
            const [first, ...rest] = stroke;
            const seed = `M ${Math.round(first.x * 3)} ${Math.round(first.y * 3)}`;
            return rest.reduce(
                (acc, point) => `${acc} L ${Math.round(point.x * 3)} ${Math.round(point.y * 3)}`,
                seed
            );
        });

        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${DRAWING_WIDTH}" height="${DRAWING_HEIGHT}" viewBox="0 0 ${DRAWING_WIDTH} ${DRAWING_HEIGHT}" fill="none"><rect width="100%" height="100%" fill="white"/><g stroke="#111827" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">${allPaths
            .map((path) => `<path d="${path}" />`)
            .join('')}</g></svg>`;
        const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
        onSave(dataUrl);
        clear();
    };

    const panResponder = useMemo(
        () =>
            PanResponder.create({
                onStartShouldSetPanResponder: () => true,
                onMoveShouldSetPanResponder: () => true,
                onPanResponderGrant: (evt) => {
                    const startX = normalizePoint(evt.nativeEvent.locationX, DRAWING_WIDTH / 3);
                    const startY = normalizePoint(evt.nativeEvent.locationY, DRAWING_HEIGHT / 3);
                    const next = [{ x: startX, y: startY }];
                    activeStrokeRef.current = next;
                    setActiveStroke(next);
                },
                onPanResponderMove: (evt) => {
                    const pointX = normalizePoint(evt.nativeEvent.locationX, DRAWING_WIDTH / 3);
                    const pointY = normalizePoint(evt.nativeEvent.locationY, DRAWING_HEIGHT / 3);
                    const next = [...activeStrokeRef.current, { x: pointX, y: pointY }];
                    activeStrokeRef.current = next;
                    setActiveStroke(next);
                },
                onPanResponderRelease: () => {
                    if (activeStrokeRef.current.length <= 1) return;
                    setStrokes((prev) => [...prev, activeStrokeRef.current]);
                    activeStrokeRef.current = [];
                    setActiveStroke([]);
                },
                onPanResponderTerminate: () => {
                    if (activeStrokeRef.current.length <= 1) return;
                    setStrokes((prev) => [...prev, activeStrokeRef.current]);
                    activeStrokeRef.current = [];
                    setActiveStroke([]);
                },
            }),
        []
    );

    const renderPoints = [...strokes.flat(), ...activeStroke];

    return (
        <Modal
            visible={visible}
            transparent
            animationType="slide"
            onRequestClose={onClose}
        >
            <View style={s.overlay}>
                <View style={s.sheet}>
                    <Text style={s.title}>Draw Signature</Text>
                    <Text style={s.subtitle}>Use finger or stylus. This will be saved in business settings.</Text>
                    <View style={s.canvasWrap} {...panResponder.panHandlers}>
                        {renderPoints.map((point, index) => (
                            <View
                                key={`${point.x}_${point.y}_${index}`}
                                style={[
                                    s.dot,
                                    {
                                        left: point.x - 2,
                                        top: point.y - 2,
                                    },
                                ]}
                            />
                        ))}
                    </View>

                    <View style={s.actions}>
                        <Pressable style={[s.button, s.secondaryBtn]} onPress={clear}>
                            <Text style={s.secondaryText}>Clear</Text>
                        </Pressable>
                        <Pressable style={[s.button, s.secondaryBtn]} onPress={onClose}>
                            <Text style={s.secondaryText}>Close</Text>
                        </Pressable>
                        <Pressable style={[s.button, s.primaryBtn]} onPress={save}>
                            <Text style={s.primaryText}>Use Signature</Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = (colors: ReturnType<typeof getColors>) =>
    StyleSheet.create({
        overlay: {
            flex: 1,
            justifyContent: 'flex-end',
            backgroundColor: '#00000088',
        },
        sheet: {
            borderTopLeftRadius: Radius.lg,
            borderTopRightRadius: Radius.lg,
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.md,
            paddingBottom: Spacing.lg,
            backgroundColor: colors.background,
            gap: Spacing.sm,
        },
        title: {
            color: colors.text,
            fontSize: Typography.title.size,
            fontWeight: '700',
        },
        subtitle: {
            color: colors.textSecondary,
            fontSize: Typography.caption.size,
        },
        canvasWrap: {
            height: 220,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            backgroundColor: '#fff',
        },
        dot: {
            position: 'absolute',
            width: 4,
            height: 4,
            borderRadius: 2,
            backgroundColor: '#111827',
        },
        actions: {
            flexDirection: 'row',
            gap: Spacing.xs,
        },
        button: {
            flex: 1,
            minHeight: 42,
            borderRadius: Radius.pill,
            justifyContent: 'center',
            alignItems: 'center',
        },
        primaryBtn: {
            backgroundColor: colors.primary,
        },
        secondaryBtn: {
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        primaryText: {
            color: colors.onPrimary,
            fontWeight: '700',
            fontSize: Typography.body.size,
        },
        secondaryText: {
            color: colors.text,
            fontWeight: '600',
            fontSize: Typography.body.size,
        },
    });
