import { AE, AU, BR, CA, DE, FR, GB, IN, JP, NG, PH, SG, US, ZA } from 'country-flag-icons/react/3x2';

export const PHONE_COUNTRIES = [
  { iso2: 'IN', name: 'India', dialCode: '+91', Flag: IN },
  { iso2: 'US', name: 'United States', dialCode: '+1', Flag: US },
  { iso2: 'GB', name: 'United Kingdom', dialCode: '+44', Flag: GB },
  { iso2: 'CA', name: 'Canada', dialCode: '+1', Flag: CA },
  { iso2: 'AU', name: 'Australia', dialCode: '+61', Flag: AU },
  { iso2: 'AE', name: 'United Arab Emirates', dialCode: '+971', Flag: AE },
  { iso2: 'DE', name: 'Germany', dialCode: '+49', Flag: DE },
  { iso2: 'FR', name: 'France', dialCode: '+33', Flag: FR },
  { iso2: 'SG', name: 'Singapore', dialCode: '+65', Flag: SG },
  { iso2: 'JP', name: 'Japan', dialCode: '+81', Flag: JP },
  { iso2: 'BR', name: 'Brazil', dialCode: '+55', Flag: BR },
  { iso2: 'ZA', name: 'South Africa', dialCode: '+27', Flag: ZA },
  { iso2: 'NG', name: 'Nigeria', dialCode: '+234', Flag: NG },
  { iso2: 'PH', name: 'Philippines', dialCode: '+63', Flag: PH },
];

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0];

export function getPhoneCountryByDialCode(dialCode) {
  return PHONE_COUNTRIES.find((country) => country.dialCode === dialCode) || DEFAULT_PHONE_COUNTRY;
}

export function composePhoneNumber(countryCode, localNumber) {
  const normalizedCode = String(countryCode || DEFAULT_PHONE_COUNTRY.dialCode).trim();
  const normalizedLocal = String(localNumber || '').replace(/\D/g, '');

  if (!normalizedLocal) {
    return '';
  }

  return `${normalizedCode}${normalizedLocal}`;
}

export function splitPhoneNumber(phoneNumber) {
  const normalized = String(phoneNumber || '').replace(/\s+/g, '');
  if (!normalized.startsWith('+')) {
    return {
      countryCode: DEFAULT_PHONE_COUNTRY.dialCode,
      localNumber: normalized.replace(/\D/g, ''),
    };
  }

  const sortedByLongestDialCode = [...PHONE_COUNTRIES].sort((a, b) => b.dialCode.length - a.dialCode.length);
  const match = sortedByLongestDialCode.find((country) => normalized.startsWith(country.dialCode));

  if (!match) {
    return {
      countryCode: DEFAULT_PHONE_COUNTRY.dialCode,
      localNumber: normalized.replace(/\D/g, ''),
    };
  }

  return {
    countryCode: match.dialCode,
    localNumber: normalized.slice(match.dialCode.length).replace(/\D/g, ''),
  };
}
