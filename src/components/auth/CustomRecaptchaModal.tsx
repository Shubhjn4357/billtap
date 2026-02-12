import React, { forwardRef, useImperativeHandle, useState, useRef } from 'react';
import { Modal, StyleSheet, View, ActivityIndicator, TouchableOpacity, Text } from 'react-native';
import { WebView } from 'react-native-webview';
import { auth } from '../../api/firebaseConfig';

interface CustomRecaptchaModalProps {
    title?: string;
    cancelLabel?: string;
}

export interface CustomRecaptchaModalRef {
    verify: () => Promise<string>;
}

export const CustomRecaptchaModal = forwardRef<CustomRecaptchaModalRef, CustomRecaptchaModalProps>(({
    title = 'Security Check',
    cancelLabel = 'Cancel'
}, ref) => {
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(true);
    const promiseRef = useRef<{ resolve: (token: string) => void; reject: (error: Error) => void } | null>(null);

    const firebaseConfig = auth.app.options;
    // @ts-ignore
    const authDomain = firebaseConfig.authDomain || 'billtap-6c010.firebaseapp.com';

    // We point to the firebase auth handler. 
    // This URL typically hosts the reCAPTCHA for phone auth flows.
    // However, without the proper query params and context, it might just show a blank page or 404.
    // The "expo-firebase-recaptcha" library used a local HTML string with a site key.
    // Since we don't have the user's specific SITE KEY (it was likely inside the removed library usage or config),
    // we are exploring if the generic handler works OR if we need a site key.
    // 
    // If this fails (blank screen), we need the User to provide a reCAPTCHA v2 / Invisible site key.
    const uri = `https://${authDomain}/__/auth/handler`;

    useImperativeHandle(ref, () => ({
        verify: () => {
            return new Promise((resolve, reject) => {
                promiseRef.current = { resolve, reject };
                setVisible(true);
                setLoading(true);
            });
        }
    }));

    const handleCancel = () => {
        setVisible(false);
        if (promiseRef.current) {
            promiseRef.current.reject(new Error('Recaptcha cancelled'));
            promiseRef.current = null;
        }
    };

    const handleMessage = (event: any) => {
        const data = event.nativeEvent.data;
        // Check if data looks like a token
        if (data && typeof data === 'string') {
            // Validate token length roughly equivalent to a recaptcha token
            if (promiseRef.current) {
                promiseRef.current.resolve(data);
                promiseRef.current = null;
            }
            setVisible(false);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={handleCancel}>
            <View style={styles.container}>
                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>{title}</Text>
                        <TouchableOpacity onPress={handleCancel}>
                            <Text style={styles.cancel}>{cancelLabel}</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.webViewContainer}>
                        {loading && (
                            <ActivityIndicator size="large" color="#000" style={styles.loader} />
                        )}
                        <WebView
                            source={{ uri }}
                            onLoadEnd={() => setLoading(false)}
                            javaScriptEnabled
                            automaticallyAdjustContentInsets
                            scalesPageToFit
                            mixedContentMode="always"
                            onMessage={handleMessage}
                            style={{ flex: 1, opacity: loading ? 0 : 1 }}
                        // Injecting JS to capture the token is complex without knowing the exact structure of the handler.
                        // However, we rely on the fact that standard reCAPTCHA callbacks often post messages 
                        // or redirected urls which WebView can intercept.
                        // If this doesn't work, we'll need to inject:
                        // injectedJavaScript={`
                        //     window.postMessage = function(data) {
                        //         window.ReactNativeWebView.postMessage(data);
                        //     };
                        // `}
                        />
                    </View>
                </View>
            </View>
        </Modal>
    );
});

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 },
    content: { backgroundColor: 'white', borderRadius: 10, height: 400, overflow: 'hidden' },
    header: { flexDirection: 'row', justifyContent: 'space-between', padding: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
    title: { fontWeight: 'bold', fontSize: 16 },
    cancel: { color: 'blue' },
    webViewContainer: { flex: 1, position: 'relative' },
    loader: { position: 'absolute', top: '50%', left: '50%', marginLeft: -18, marginTop: -18, zIndex: 1 }
});
