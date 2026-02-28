import countryData from './countryData';

type RawCountryDataEntry = {
    name?: string;
    alpha2Code?: string;
    callingCodes?: string[];
};

export type CountryDialCode = {
    iso2: string;
    name: string;
    dialCode: string;
};

const toDigits = (value: string): string => value.replace(/\D/g, '');

const rawEntries = countryData as RawCountryDataEntry[];
const byIsoAndCode = new Map<string, CountryDialCode>();

for (const entry of rawEntries) {
    const iso2 = entry.alpha2Code?.trim().toUpperCase();
    const name = entry.name?.trim();

    if (!iso2 || !name || !Array.isArray(entry.callingCodes)) {
        continue;
    }

    for (const code of entry.callingCodes) {
        const digits = toDigits(code);
        if (!digits) continue;

        const dialCode = `+${digits}`;
        const key = `${iso2}:${dialCode}`;
        if (!byIsoAndCode.has(key)) {
            byIsoAndCode.set(key, { iso2, name, dialCode });
        }
    }
}

export const COUNTRY_DIAL_CODES: CountryDialCode[] = Array.from(byIsoAndCode.values()).sort((a, b) => {
    if (a.name === b.name) return a.dialCode.localeCompare(b.dialCode);
    return a.name.localeCompare(b.name);
});

export const DEFAULT_COUNTRY_ISO2 = 'IN';
export const DEFAULT_COUNTRY_DIAL_CODE =
    COUNTRY_DIAL_CODES.find((entry) => entry.iso2 === DEFAULT_COUNTRY_ISO2)?.dialCode ?? '+91';

export const findCountryByIso2 = (iso2: string): CountryDialCode | null => {
    const needle = iso2.trim().toUpperCase();
    return COUNTRY_DIAL_CODES.find((entry) => entry.iso2 === needle) ?? null;
};

export const findCountryByDialCode = (dialCode: string): CountryDialCode | null => {
    const needle = dialCode.trim();
    return COUNTRY_DIAL_CODES.find((entry) => entry.dialCode === needle) ?? null;
};
