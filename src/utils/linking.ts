
import { Linking, Platform } from 'react-native';

export const openWhatsApp = (phone: string, text: string) => {
    let phoneNumber = phone;
    if (Platform.OS !== 'android') {
        phoneNumber = `+${phoneNumber.replace(/[^\d]/g, '')}`;
    }
    const encodedText = encodeURIComponent(text);
    const url = `whatsapp://send?text=${encodedText}&phone=${phoneNumber}`;
    
    Linking.openURL(url).catch(() => {
        // Fallback to web
        Linking.openURL(`https://wa.me/${phoneNumber}?text=${encodedText}`);
    });
};

export const callPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
};
