import React, { useMemo } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';
import { AppButton } from '../common/AppButton';

interface SignatureCaptureModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (dataUrl: string) => void;
}

const buildSignatureHtml = (strokeColor: string, gridColor: string) => `
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
      background: #ffffff;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }
    .wrap {
      display: flex;
      flex-direction: column;
      width: 100%;
      height: 100%;
    }
    .canvas-wrap {
      flex: 1;
      border: 1px solid ${gridColor};
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
      color: ${gridColor};
      font-size: 12px;
      pointer-events: none;
      user-select: none;
    }
    canvas {
      width: 100%;
      height: 100%;
      display: block;
      touch-action: none;
      background: #fff;
    }
    .actions {
      display: flex;
      gap: 8px;
      padding: 8px;
      border-top: 1px solid ${gridColor};
      background: #fff;
    }
    button {
      flex: 1;
      border: 1px solid ${gridColor};
      border-radius: 8px;
      padding: 10px 8px;
      font-size: 14px;
      background: #fff;
      color: #111;
    }
    button.primary {
      background: ${strokeColor};
      border-color: ${strokeColor};
      color: #fff;
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

      const resize = () => {
        const rect = canvas.getBoundingClientRect();
        const ratio = window.devicePixelRatio || 1;
        const image = hasStroke ? canvas.toDataURL('image/png') : null;
        canvas.width = Math.max(1, Math.floor(rect.width * ratio));
        canvas.height = Math.max(1, Math.floor(rect.height * ratio));
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
        ctx.lineWidth = 2.4;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = '${strokeColor}';
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

export const SignatureCaptureModal = ({ visible, onClose, onSave }: SignatureCaptureModalProps) => {
    const theme = useTheme();

    const signatureHtml = useMemo(() => {
        return buildSignatureHtml(theme.colors.primary, theme.colors.outline);
    }, [theme.colors.outline, theme.colors.primary]);

    const handleMessage = (event: WebViewMessageEvent) => {
        const raw = event.nativeEvent.data;
        try {
            const parsed = JSON.parse(raw) as {
                type?: string;
                payload?: string;
            };
            if (parsed.type === 'save' && parsed.payload) {
                onSave(parsed.payload);
            }
        } catch {
            // Ignore malformed messages from webview.
        }
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.overlay}>
                <View style={[styles.sheet, { backgroundColor: theme.colors.background }]}>
                    <Text variant="titleMedium" style={styles.title}>
                        Draw Signature
                    </Text>
                    <View style={styles.canvasContainer}>
                        <WebView
                            source={{ html: signatureHtml }}
                            onMessage={handleMessage}
                            originWhitelist={['*']}
                            javaScriptEnabled
                            domStorageEnabled
                            style={styles.webview}
                        />
                    </View>
                    <View style={styles.footer}>
                        <AppButton mode="outlined" onPress={onClose}>
                            Close
                        </AppButton>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.35)',
        justifyContent: 'flex-end',
    },
    sheet: {
        borderTopLeftRadius: 18,
        borderTopRightRadius: 18,
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 18,
        minHeight: 460,
    },
    title: {
        fontWeight: '700',
        marginBottom: 8,
    },
    canvasContainer: {
        flex: 1,
        minHeight: 360,
        borderRadius: 12,
        overflow: 'hidden',
    },
    webview: {
        flex: 1,
        backgroundColor: '#fff',
    },
    footer: {
        marginTop: 10,
        flexDirection: 'row',
        justifyContent: 'flex-end',
    },
});
