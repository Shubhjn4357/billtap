import { Linking, Platform } from 'react-native';

export const openWhatsApp = (phone: string, text: string) => {
    let phoneNumber = phone;
    if (Platform.OS !== 'android') {
        phoneNumber = `+${phoneNumber.replace(/[^\d]/g, '')}`;
    }
    const url = `whatsapp://send?text=${text}&phone=${phoneNumber}`;
    
    Linking.openURL(url).catch(() => {
        // Fallback to web
        Linking.openURL(`https://wa.me/${phoneNumber}?text=${text}`);
    });
};

export const callPhone = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
};
