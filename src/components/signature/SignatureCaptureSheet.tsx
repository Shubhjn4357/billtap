import { useMemo, type ComponentType } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View, useColorScheme } from 'react-native';
import { getColors, Radius, Spacing, Typography, withAlpha } from '../../constants/theme';
import { useAppDialog } from '@/components/providers/DialogProvider';

type SignatureCaptureSheetProps = {
    visible: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
};

const buildSignatureHtml = (
    strokeColor: string,
    borderColor: string,
    pageBackground: string,
    surfaceBackground: string,
    textColor: string,
    onPrimaryColor: string
) => `
<!doctype html>
<html>
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <style>
    html, body {
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: ${pageBackground};
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      color: ${textColor};
    }
    .wrap {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }
    .canvas-wrap {
      flex: 1;
      border: 1px solid ${borderColor};
      border-radius: 10px;
      margin: 8px;
      position: relative;
      overflow: hidden;
      touch-action: none;
    }
    .hint {
      position: absolute;
      top: 8px;
      left: 12px;
      color: ${borderColor};
      font-size: 12px;
      pointer-events: none;
      user-select: none;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
      touch-action: none;
      background: ${surfaceBackground};
    }
    .actions {
      display: flex;
      gap: 8px;
      padding: 8px;
      border-top: 1px solid ${borderColor};
      background: ${surfaceBackground};
    }
    button {
      flex: 1;
      border: 1px solid ${borderColor};
      border-radius: 8px;
      padding: 10px 8px;
      font-size: 14px;
      background: ${surfaceBackground};
      color: ${textColor};
    }
    button.primary {
      background: ${strokeColor};
      border-color: ${strokeColor};
      color: ${onPrimaryColor};
    }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="canvas-wrap">
      <div class="hint">Draw signature here</div>
      <canvas id="signature"></canvas>
    </div>
    <div class="actions">
      <button id="clearBtn" type="button">Clear</button>
      <button id="saveBtn" type="button" class="primary">Use Signature</button>
    </div>
  </div>

  <script>
    (function () {
      const canvas = document.getElementById('signature');
      const ctx = canvas.getContext('2d');
      const clearBtn = document.getElementById('clearBtn');
      const saveBtn = document.getElementById('saveBtn');
      let drawing = false;
      let hasStroke = false;

      const setupContext = () => {
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '${strokeColor}';
      };

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const image = hasStroke ? canvas.toDataURL('image/png') : null;
        canvas.width = Math.max(1, Math.floor(rect.width * ratio));
        canvas.height = Math.max(1, Math.floor(rect.height * ratio));
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        setupContext();
        if (image) {
          const img = new Image();
          img.onload = function () {
            ctx.drawImage(img, 0, 0, rect.width, rect.height);
          };
          img.src = image;
        }
      };

      const pointFromEvent = (event) => {
        const rect = canvas.getBoundingClientRect();
        const touch = event.touches && event.touches[0]
          ? event.touches[0]
          : event.changedTouches && event.changedTouches[0]
            ? event.changedTouches[0]
            : event;
        return {
          x: touch.clientX - rect.left,
          y: touch.clientY - rect.top,
        };
      };

      const start = (event) => {
        event.preventDefault();
        const p = pointFromEvent(event);
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
        drawing = true;
      };

      const move = (event) => {
        if (!drawing) return;
        event.preventDefault();
        const p = pointFromEvent(event);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        hasStroke = true;
      };

      const end = (event) => {
        if (!drawing) return;
        event.preventDefault();
        drawing = false;
      };

      clearBtn.addEventListener('click', function () {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        hasStroke = false;
      });

      saveBtn.addEventListener('click', function () {
        if (!hasStroke) {
          window.ReactNativeWebView?.postMessage(JSON.stringify({
            type: 'error',
            message: 'Draw signature before saving.'
          }));
          return;
        }
        const dataUrl = canvas.toDataURL('image/png');
        window.ReactNativeWebView?.postMessage(JSON.stringify({
          type: 'save',
          payload: dataUrl
        }));
      });

      window.addEventListener('resize', resize);
      resize();

      canvas.addEventListener('mousedown', start);
      canvas.addEventListener('mousemove', move);
      window.addEventListener('mouseup', end);

      canvas.addEventListener('touchstart', start, { passive: false });
      canvas.addEventListener('touchmove', move, { passive: false });
      canvas.addEventListener('touchend', end, { passive: false });
      canvas.addEventListener('touchcancel', end, { passive: false });
    })();
  </script>
</body>
</html>
`;

export function SignatureCaptureSheet({ visible, onClose, onSave }: SignatureCaptureSheetProps) {
    const dialog = useAppDialog();
    const scheme = useColorScheme() ?? 'light';
    const colors = getColors(scheme);
    const s = styles(colors);

    const signatureHtml = useMemo(
        () =>
            buildSignatureHtml(
                colors.primary,
                colors.border,
                colors.background,
                colors.surface,
                colors.text,
                colors.onPrimary
            ),
        [colors.background, colors.border, colors.onPrimary, colors.primary, colors.surface, colors.text]
    );

    const WebViewComponent = useMemo(() => {
        if (Platform.OS === 'web') return null;
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            return require('react-native-webview').WebView as ComponentType<{
                source: { html: string };
                onMessage: (event: { nativeEvent: { data: string } }) => void;
                originWhitelist: string[];
                javaScriptEnabled: boolean;
                domStorageEnabled: boolean;
                style: object;
            }>;
        } catch {
            return null;
        }
    }, []);

    const handleMessage = (event: { nativeEvent: { data: string } }) => {
        const raw = event.nativeEvent.data;
        try {
            const parsed = JSON.parse(raw) as {
                type?: string;
                payload?: string;
                message?: string;
            };
            if (parsed.type === 'save' && parsed.payload) {
                onSave(parsed.payload);
                return;
            }
            if (parsed.type === 'error' && parsed.message) {
                dialog.alert('Signature', parsed.message);
            }
        } catch {
            // Ignore malformed WebView messages.
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={s.overlay}>
                <View style={s.sheet}>
                    <Text style={s.title}>Draw Signature</Text>
                    <Text style={s.subtitle}>Use finger or stylus. This will be saved in business settings.</Text>
                    <View style={s.canvasWrap}>
                        {WebViewComponent ? (
                            <WebViewComponent
                                source={{ html: signatureHtml }}
                                onMessage={handleMessage}
                                originWhitelist={['*']}
                                javaScriptEnabled
                                domStorageEnabled
                                style={s.webview}
                            />
                        ) : (
                            <View style={s.fallback}>
                                <Text style={s.fallbackText}>
                                    Signature capture requires `react-native-webview` on Android/iOS builds.
                                </Text>
                            </View>
                        )}
                    </View>
                    <View style={s.actions}>
                        <Pressable style={[s.button, s.secondaryBtn]} onPress={onClose}>
                            <Text style={s.secondaryText}>Close</Text>
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
            backgroundColor: withAlpha(colors.text, '66'),
        },
        sheet: {
            borderTopLeftRadius: Radius.lg,
            borderTopRightRadius: Radius.lg,
            paddingHorizontal: Spacing.lg,
            paddingTop: Spacing.md,
            paddingBottom: Spacing.lg,
            backgroundColor: colors.background,
            gap: Spacing.sm,
            minHeight: '96%',
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
            minHeight: 320,
            borderRadius: Radius.md,
            borderWidth: 1,
            borderColor: colors.border,
            overflow: 'hidden',
            backgroundColor: colors.surface,
        },
        webview: {
            flex: 1,
            backgroundColor: colors.surface,
        },
        fallback: {
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            paddingHorizontal: Spacing.md,
        },
        fallbackText: {
            color: colors.textSecondary,
            fontSize: Typography.body.size,
            textAlign: 'center',
        },
        actions: {
            flexDirection: 'row',
            justifyContent: 'flex-end',
        },
        button: {
            minHeight: 42,
            borderRadius: Radius.pill,
            justifyContent: 'center',
            alignItems: 'center',
            paddingHorizontal: Spacing.lg,
        },
        secondaryBtn: {
            borderWidth: 1,
            borderColor: colors.border,
            backgroundColor: colors.surface,
        },
        secondaryText: {
            color: colors.text,
            fontWeight: '600',
            fontSize: Typography.body.size,
        },
    });
