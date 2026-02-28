import { COUNTRY_DIAL_CODES, DEFAULT_COUNTRY_DIAL_CODE } from '../constants/countryDialCodes';

const digitsOnly = (value: string): string => value.replace(/\D/g, '');

const sortedDialCodes = [...new Set(COUNTRY_DIAL_CODES.map((entry) => entry.dialCode))]
    .sort((a, b) => b.length - a.length);

export const sanitizePhoneLocal = (value: string): string => value.replace(/[^\d\s()-]/g, '');

export const buildE164PhoneNumber = (dialCode: string, localNumber: string): string => {
    const cleanedDial = dialCode.startsWith('+') ? dialCode : `+${digitsOnly(dialCode)}`;
    const cleanedLocal = digitsOnly(localNumber);

    if (!cleanedLocal) return '';
    return `${cleanedDial}${cleanedLocal}`;
};

export const splitPhoneNumber = (value: string): { dialCode: string; localNumber: string } => {
    const trimmed = value.trim();
    if (!trimmed) {
        return {
            dialCode: DEFAULT_COUNTRY_DIAL_CODE,
            localNumber: '',
        };
    }

    const normalized = trimmed.startsWith('+') ? trimmed : `+${digitsOnly(trimmed)}`;
    const matchedDial = sortedDialCodes.find((code) => normalized.startsWith(code));
    if (!matchedDial) {
        return {
            dialCode: DEFAULT_COUNTRY_DIAL_CODE,
            localNumber: digitsOnly(normalized),
        };
    }

    return {
        dialCode: matchedDial,
        localNumber: digitsOnly(normalized.slice(matchedDial.length)),
    };
};
