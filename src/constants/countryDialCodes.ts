export type CountryDialCode = {
    iso2: string;
    name: string;
    dialCode: string;
};

export const COUNTRY_DIAL_CODES: CountryDialCode[] = [
    { iso2: 'IN', name: 'India', dialCode: '+91' },
    { iso2: 'US', name: 'United States', dialCode: '+1' },
    { iso2: 'CA', name: 'Canada', dialCode: '+1' },
    { iso2: 'GB', name: 'United Kingdom', dialCode: '+44' },
    { iso2: 'AE', name: 'United Arab Emirates', dialCode: '+971' },
    { iso2: 'SA', name: 'Saudi Arabia', dialCode: '+966' },
    { iso2: 'AU', name: 'Australia', dialCode: '+61' },
    { iso2: 'NZ', name: 'New Zealand', dialCode: '+64' },
    { iso2: 'SG', name: 'Singapore', dialCode: '+65' },
    { iso2: 'MY', name: 'Malaysia', dialCode: '+60' },
    { iso2: 'TH', name: 'Thailand', dialCode: '+66' },
    { iso2: 'ID', name: 'Indonesia', dialCode: '+62' },
    { iso2: 'PH', name: 'Philippines', dialCode: '+63' },
    { iso2: 'VN', name: 'Vietnam', dialCode: '+84' },
    { iso2: 'BD', name: 'Bangladesh', dialCode: '+880' },
    { iso2: 'NP', name: 'Nepal', dialCode: '+977' },
    { iso2: 'LK', name: 'Sri Lanka', dialCode: '+94' },
    { iso2: 'PK', name: 'Pakistan', dialCode: '+92' },
    { iso2: 'ZA', name: 'South Africa', dialCode: '+27' },
    { iso2: 'NG', name: 'Nigeria', dialCode: '+234' },
    { iso2: 'DE', name: 'Germany', dialCode: '+49' },
    { iso2: 'FR', name: 'France', dialCode: '+33' },
    { iso2: 'ES', name: 'Spain', dialCode: '+34' },
    { iso2: 'IT', name: 'Italy', dialCode: '+39' },
    { iso2: 'BR', name: 'Brazil', dialCode: '+55' },
];

export const DEFAULT_COUNTRY_DIAL_CODE = '+91';

