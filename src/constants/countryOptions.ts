import countryData from './countryData';

type RawCurrency = {
    code?: string;
    name?: string;
    symbol?: string;
};

type RawCountry = {
    name?: string;
    alpha2Code?: string;
    capital?: string;
    region?: string;
    currencies?: RawCurrency[];
    callingCodes?: string[];
};

export type CountryOption = {
    name: string;
    iso2: string;
    region: string;
    capital: string;
    callingCode: string;
};

export type CurrencyOption = {
    code: string;
    label: string;
    symbol: string;
};

const rows = countryData as RawCountry[];

const countryMap = new Map<string, CountryOption>();
const currencyMap = new Map<string, CurrencyOption>();

for (const row of rows) {
    const iso2 = row.alpha2Code?.trim().toUpperCase();
    const name = row.name?.trim();
    if (!iso2 || !name) continue;

    const callingDigits = row.callingCodes?.find((entry) => entry && entry.trim())?.replace(/\D/g, '') ?? '';
    const callingCode = callingDigits ? `+${callingDigits}` : '';

    if (!countryMap.has(iso2)) {
        countryMap.set(iso2, {
            iso2,
            name,
            region: row.region?.trim() ?? '',
            capital: row.capital?.trim() ?? '',
            callingCode,
        });
    }

    for (const currency of row.currencies ?? []) {
        const code = currency.code?.trim().toUpperCase();
        if (!code || currencyMap.has(code)) continue;
        const currencyName = currency.name?.trim() ?? code;
        const symbol = currency.symbol?.trim() ?? '';
        currencyMap.set(code, {
            code,
            symbol,
            label: symbol ? `${code} - ${currencyName} (${symbol})` : `${code} - ${currencyName}`,
        });
    }
}

export const COUNTRY_OPTIONS: CountryOption[] = Array.from(countryMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
);

export const CURRENCY_OPTIONS: CurrencyOption[] = Array.from(currencyMap.values()).sort((a, b) =>
    a.code.localeCompare(b.code)
);

export const DEFAULT_COUNTRY_ISO2 = 'IN';
export const DEFAULT_CURRENCY_CODE = 'INR';

export const findCountryOption = (iso2: string) => {
    const needle = iso2.trim().toUpperCase();
    return countryMap.get(needle) ?? null;
};

export const findCurrencyOption = (code: string) => {
    const needle = code.trim().toUpperCase();
    return currencyMap.get(needle) ?? null;
};

