import { Linking, Platform } from 'react-native';

export const shareViaWhatsApp = async (phone: string, message: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const url = `whatsapp://send?phone=${cleanPhone}&text=${encodeURIComponent(message)}`;
    const canOpen = await Linking.canOpenURL(url);
    if (canOpen) {
        await Linking.openURL(url);
    } else {
        throw new Error('WhatsApp is not installed on this device.');
    }
};

export const shareViaSMS = async (phone: string, message: string) => {
    const cleanPhone = phone.replace(/[^0-9+]/g, '');
    const divider = Platform.OS === 'ios' ? '&' : '?';
    const url = `sms:${cleanPhone}${divider}body=${encodeURIComponent(message)}`;
    
    // Some devices don't properly respond to canOpenURL for sms, 
    // but we can try opening it directly in a try/catch.
    try {
        await Linking.openURL(url);
    } catch {
        throw new Error('SMS app is not available on this device.');
    }
};
