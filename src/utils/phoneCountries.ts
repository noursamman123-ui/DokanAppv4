/**
 * Countries the WhatsApp OTP backend currently supports (must match
 * SUPPORTED_PHONE_COUNTRIES in dokan-mobile-api's Checkout_OTP class).
 */
export type PhoneCountryOption = {
  iso: 'SY' | 'AE' | 'SA' | 'LB';
  name: string;
  dialCode: string;
};

export const PHONE_COUNTRIES: PhoneCountryOption[] = [
  { iso: 'SY', name: 'سوريا', dialCode: '+963' },
  { iso: 'AE', name: 'الإمارات', dialCode: '+971' },
  { iso: 'SA', name: 'السعودية', dialCode: '+966' },
  { iso: 'LB', name: 'لبنان', dialCode: '+961' },
];

export const normalizePhoneDigits = (value: string) => value.replace(/\D+/g, '');
