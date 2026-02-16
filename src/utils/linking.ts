import { Linking, Platform } from 'react-native';

export const normalizeWhatsAppNumber = (phone: string, defaultCountryCode = '91'): string => {
    const digits = phone.replace(/\D/g, '');
    if (!digits) return '';

    if (digits.length <= 10 && defaultCountryCode) {
        return `${defaultCountryCode}${digits}`;
    }
    return digits;
};

export const openWhatsApp = async (phone: string, text: string): Promise<void> => {
    const phoneNumber = normalizeWhatsAppNumber(phone);
    if (!phoneNumber) {
        throw new Error('Invalid phone number.');
    }

    const encodedText = encodeURIComponent(text);
    const nativeUrl = `whatsapp://send?phone=${phoneNumber}&text=${encodedText}`;
    const webUrl = `https://wa.me/${phoneNumber}?text=${encodedText}`;

    if (Platform.OS !== 'web') {
        try {
            const canOpenNative = await Linking.canOpenURL('whatsapp://send');
            if (canOpenNative) {
                await Linking.openURL(nativeUrl);
                return;
            }
        } catch {
            // fall through to web URL
        }
    }

    await Linking.openURL(webUrl);
};

export const callPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
};
