/**
 * Checkout Screen – Shipping/billing address, payment method, OTP verification, and order summary.
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  StatusBar,
  ActivityIndicator,
  Alert,
  Modal,
  FlatList,
  Linking,
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { CartStackParamList } from '../../../navigation/types';
import { useCart, CART_QUERY_KEY } from '../../../hooks/useCart';
import { useAuthStore } from '../../../store/authStore';
import { OrdersService } from '../../../api/orders.service';
import { CheckoutOtpService } from '../../../api/checkout-otp.service';
import { BootstrapService } from '../../../api/bootstrap.service';
import { CartService } from '../../../api/cart.service';
import { GuestOrdersStorage, TokenStorage, CheckoutOtpSessionStorage } from '../../../utils/storage';
import { Colors } from '../../../theme/colors';
import { Typography, FontFamily, FontSize } from '../../../theme/typography';
import { Spacing, BorderRadius } from '../../../theme/spacing';
import { Shadows } from '../../../theme/shadows';
import { decodeHtmlEntities, formatPrice, stripHtml } from '../../../utils/formatters';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type NavProp = NativeStackNavigationProp<CartStackParamList, 'Checkout'>;
const SHAM_CASH_QR_STATIC_URL = 'https://dokan.com.sy/wp-content/plugins//woocommerce-gateway-shamcash/shamcash.jpg';

const SYRIAN_GOVERNORATES = [
  'دمشق',
  'ريف دمشق',
  'حلب',
  'حمص',
  'حماة',
  'اللاذقية',
  'طرطوس',
  'إدلب',
  'درعا',
  'السويداء',
  'القنيطرة',
  'دير الزور',
  'الحسكة',
  'الرقة',
];

type PhoneCountryOption = {
  iso: 'SY' | 'AE' | 'SA' | 'LB';
  name: string;
  dialCode: string;
};

const PHONE_COUNTRIES: PhoneCountryOption[] = [
  { iso: 'SY', name: 'سوريا', dialCode: '+963' },
  { iso: 'AE', name: 'الإمارات', dialCode: '+971' },
  { iso: 'SA', name: 'السعودية', dialCode: '+966' },
  { iso: 'LB', name: 'لبنان', dialCode: '+961' },
];

const normalizeDigits = (value: string) => value.replace(/\D+/g, '');

const splitPhoneByCountry = (rawPhone?: string) => {
  const digits = normalizeDigits(rawPhone ?? '');
  if (!digits) {
    return { phone_country: 'SY' as const, phone_local: '' };
  }

  const withoutLeadingZeros = digits.startsWith('00') ? digits.slice(2) : digits;

  const match = PHONE_COUNTRIES.find((country) =>
    withoutLeadingZeros.startsWith(country.dialCode.replace('+', ''))
  );

  if (match) {
    const local = withoutLeadingZeros.slice(match.dialCode.replace('+', '').length).replace(/^0+/, '');
    return {
      phone_country: match.iso,
      phone_local: local,
    };
  }

  return {
    phone_country: 'SY' as const,
    phone_local: withoutLeadingZeros.replace(/^0+/, ''),
  };
};

const extractOrderIdentifiers = (payload: unknown) => {
  const data = (payload ?? {}) as Record<string, unknown>;
  const nestedOrder = (data.order ?? null) as Record<string, unknown> | null;

  const idCandidates = [data.id, data.order_id, nestedOrder?.id];
  const parsedId = idCandidates
    .map((candidate) => Number(candidate))
    .find((candidate) => Number.isFinite(candidate) && candidate > 0);

  const numberCandidates = [
    data.number,
    data.order_number,
    nestedOrder?.number,
    data.order_key,
  ];

  const parsedNumber = numberCandidates
    .map((candidate) => (typeof candidate === 'string' ? candidate.trim() : ''))
    .find((candidate) => candidate.length > 0 && candidate !== 'undefined');

  const orderId = parsedId ? Math.trunc(parsedId) : null;
  const orderNumber = parsedNumber ?? (orderId ? String(orderId) : '');

  return { orderId, orderNumber };
};

const extractOrderKey = (payload: unknown): string => {
  const data = (payload ?? {}) as Record<string, unknown>;
  const nestedOrder = (data.order ?? null) as Record<string, unknown> | null;

  const candidates = [
    data.order_key,
    data.key,
    nestedOrder?.order_key,
    nestedOrder?.key,
  ];

  return candidates
    .map((candidate) => (typeof candidate === 'string' ? candidate.trim() : ''))
    .find((candidate) => candidate.length > 0 && candidate !== 'undefined') ?? '';
};

const extractUrlLikeValue = (value: unknown, depth = 0): string => {
  if (depth > 5 || value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    return /^https?:\/\//i.test(trimmed) ? trimmed : '';
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const found = extractUrlLikeValue(item, depth + 1);
      if (found) {
        return found;
      }
    }
    return '';
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const priorityKeys = Object.keys(record).sort((a, b) => {
      const aScore = /(redirect|payment|url|pay|checkout)/i.test(a) ? 0 : 1;
      const bScore = /(redirect|payment|url|pay|checkout)/i.test(b) ? 0 : 1;
      return aScore - bScore;
    });

    for (const key of priorityKeys) {
      const found = extractUrlLikeValue(record[key], depth + 1);
      if (found) {
        return found;
      }
    }
  }

  return '';
};

const extractPaymentRedirectUrl = (payload: unknown): string => {
  const data = (payload ?? {}) as Record<string, unknown>;
  const paymentResult = (data.payment_result ?? null) as Record<string, unknown> | null;
  const paymentDetails = Array.isArray(paymentResult?.payment_details)
    ? paymentResult?.payment_details
    : [];

  const candidates = [
    paymentResult?.redirect_url,
    paymentResult?.redirectUrl,
    paymentResult?.payment_url,
    paymentResult?.paymentUrl,
    data.redirect_url,
    data.redirectUrl,
    data.payment_url,
    data.paymentUrl,
  ];

  const direct = candidates
    .map((candidate) => (typeof candidate === 'string' ? candidate.trim() : ''))
    .find((candidate) => candidate.length > 0 && candidate !== 'undefined');

  if (direct) {
    return direct;
  }

  for (const detail of paymentDetails) {
    const found = extractUrlLikeValue(detail);
    if (found) {
      return found;
    }
  }

  const fromPaymentResult = extractUrlLikeValue(paymentResult);
  if (fromPaymentResult) {
    return fromPaymentResult;
  }

  return extractUrlLikeValue(data);
};

const isShamCashGateway = (gateway?: { id?: string; title?: string; description?: string } | null): boolean => {
  const id = (gateway?.id ?? '').toLowerCase();
  const title = (gateway?.title ?? '').toLowerCase();
  const description = decodeHtmlEntities(gateway?.description ?? '').toLowerCase();

  return id.includes('shamcash') || title.includes('شام كاش') || description.includes('شام كاش');
};

const isCashOnDeliveryGateway = (gateway?: { id?: string; title?: string; description?: string } | null): boolean => {
  const id = (gateway?.id ?? '').toLowerCase();
  const title = decodeHtmlEntities(gateway?.title ?? '').toLowerCase();
  const description = decodeHtmlEntities(gateway?.description ?? '').toLowerCase();

  return id === 'cod' || title.includes('الدفع عند الاستلام') || description.includes('الدفع عند الاستلام');
};

const buildOrderPayUrl = (siteUrl: string | undefined, orderId: number, orderKey: string): string => {
  const base = (siteUrl ?? '').trim().replace(/\/+$/, '');
  const key = orderKey.trim();

  if (!base || !key || !Number.isFinite(orderId) || orderId <= 0) {
    return '';
  }

  return `${base}/checkout/order-pay/${orderId}/?pay_for_order=true&key=${encodeURIComponent(key)}`;
};

const buildPhoneLinkedEmail = (fullPhone: string): string => {
  const digits = fullPhone.replace(/\D+/g, '');
  if (!digits) {
    return 'guest@dokanapp.local';
  }
  return `guest-${digits}@dokanapp.local`;
};

const extractFirstImageUrlFromHtml = (value?: string): string => {
  if (!value) {
    return '';
  }

  const decoded = decodeHtmlEntities(value);
  const srcMatch = decoded.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (srcMatch?.[1]?.trim()) {
    return srcMatch[1].trim();
  }

  // Support plain-text URLs pasted in gateway description fields.
  const directUrlMatch = decoded.match(
    /(https?:\/\/[^\s"'<>]+\.(?:png|jpe?g|webp|gif|svg)(?:\?[^\s"'<>]*)?)/i
  );
  return directUrlMatch?.[1]?.trim() ?? '';
};

const stripHtmlToText = (value?: string): string => {
  if (!value) {
    return '';
  }

  return decodeHtmlEntities(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
};

const resolveGatewayAssetUrl = (assetUrl: string, siteUrl?: string): string => {
  const normalizedAsset = assetUrl.trim();
  if (!normalizedAsset) {
    return '';
  }

  if (/^https?:\/\//i.test(normalizedAsset)) {
    return normalizedAsset;
  }

  if (normalizedAsset.startsWith('//')) {
    return `https:${normalizedAsset}`;
  }

  const base = (siteUrl ?? '').trim();
  const originMatch = base.match(/^https?:\/\/[^/]+/i);
  const origin = originMatch?.[0] ?? '';

  if (!origin) {
    return normalizedAsset;
  }

  if (normalizedAsset.startsWith('/')) {
    return `${origin}${normalizedAsset}`;
  }

  return `${origin}/${normalizedAsset.replace(/^\.?\//, '')}`;
};

const mapOtpErrorMessage = (
  error: unknown,
  fallbackMessage: string
) => {
  const apiError = error as { code?: string; message?: string };

  if (apiError?.code === 'phone_not_whatsapp') {
    return 'رقم الهاتف غير مرتبط بواتساب. يرجى إدخال رقم واتساب صالح.';
  }

  if (apiError?.code === 'unsupported_phone_country') {
    return 'دولة رقم الهاتف غير مدعومة حالياً.';
  }

  if (apiError?.code === 'otp_rate_limited') {
    return 'تم إرسال رمز مؤخرًا. يرجى الانتظار قليلًا ثم إعادة المحاولة.';
  }

  if (apiError?.code === 'otp_invalid') {
    return 'رمز التحقق غير صحيح.';
  }

  if (apiError?.code === 'otp_expired') {
    return 'انتهت صلاحية الرمز. يرجى طلب رمز جديد.';
  }

  if (apiError?.code === 'otp_max_attempts') {
    return 'تم تجاوز عدد محاولات التحقق المسموح. يرجى طلب رمز جديد.';
  }

  if (apiError?.code === 'otp_cart_mismatch') {
    return 'جلسة السلة تغيّرت. يرجى إعادة إرسال رمز التحقق.';
  }

  if (apiError?.code === 'NETWORK_ERROR') {
    return 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجددًا.';
  }

  return apiError?.message ?? fallbackMessage;
};

export default function CheckoutScreen() {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NavProp>();
  const queryClient = useQueryClient();
  const { data: checkoutCart } = useCart();
  const items = checkoutCart?.items ?? [];
  const couponCode = checkoutCart?.coupons?.[0]?.code ?? null;
  const user = useAuthStore((s) => s.user);

  const parseMoney = (value: string | number | undefined, fallback = 0) => {
    if (value === undefined || value === null) {
      return fallback;
    }

    const numeric = typeof value === 'number'
      ? value
      : parseFloat(String(value).replace(/[^\d.-]/g, ''));

    return Number.isFinite(numeric) ? numeric : fallback;
  };

  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  const [notes, setNotes] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('');
  const [isCityModalVisible, setIsCityModalVisible] = useState(false);
  const [isPhoneCountryModalVisible, setIsPhoneCountryModalVisible] = useState(false);

  const [isOtpModalVisible, setIsOtpModalVisible] = useState(false);
  const [otpSessionId, setOtpSessionId] = useState('');
  const [otpMaskedPhone, setOtpMaskedPhone] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState(0);
  const [otpResendAt, setOtpResendAt] = useState(0);
  const [otpSecondsLeft, setOtpSecondsLeft] = useState(0);
  const [resendSecondsLeft, setResendSecondsLeft] = useState(0);

  // Restore a still-valid OTP session on mount — covers the case where
  // Android reclaimed the JS context while the app was backgrounded (e.g.
  // the user switched to WhatsApp to read the code) and this screen just
  // remounted from scratch. Without this, a perfectly valid code has no
  // entry screen to go back to.
  useEffect(() => {
    const pending = CheckoutOtpSessionStorage.get();
    if (!pending) {
      return;
    }
    setOtpSessionId(pending.otpSessionId);
    setOtpMaskedPhone(pending.otpMaskedPhone);
    setOtpExpiresAt(pending.otpExpiresAt);
    setOtpResendAt(pending.otpResendAt);
    setIsOtpModalVisible(true);
  }, []);

  const { data: bootstrapData, isLoading: isPaymentMethodsLoading } = useQuery({
    queryKey: ['bootstrap'],
    queryFn: BootstrapService.getBootstrapData,
    staleTime: 5 * 60 * 1000,
  });

  const initialPhone = splitPhoneByCountry(user?.shipping?.phone ?? user?.billing?.phone ?? user?.phone ?? '');

  const [shippingForm, setShippingForm] = useState({
    first_name: user?.shipping?.first_name ?? user?.first_name ?? '',
    last_name: user?.shipping?.last_name ?? user?.last_name ?? '',
    address_1: user?.shipping?.address_1 ?? '',
    address_2: user?.shipping?.address_2 ?? '',
    city: user?.shipping?.city ?? user?.shipping?.state ?? '',
    state: user?.shipping?.state ?? user?.shipping?.city ?? '',
    postcode: user?.shipping?.postcode ?? '',
    country: 'SY',
    phone_country: initialPhone.phone_country,
    phone_local: initialPhone.phone_local,
    email: '',
  });

  useEffect(() => {
    // Shipping totals only update once WooCommerce knows the destination and a
    // rate is selected — neither happens just by editing local form state, so
    // without this the preview total silently stays pre-shipping until the
    // order is actually placed (updateCustomer + selectShippingRate normally
    // only run inside OrdersService.placeOrder, i.e. too late for a live preview).
    if (items.length === 0 || !shippingForm.city.trim()) {
      return;
    }

    let cancelled = false;

    const syncShippingPreview = async () => {
      try {
        const updatedCart = await CartService.updateCustomer({
          shipping_address: {
            first_name: shippingForm.first_name,
            last_name: shippingForm.last_name,
            company: '',
            address_1: shippingForm.address_1,
            address_2: shippingForm.address_2,
            city: shippingForm.city.trim(),
            state: shippingForm.state.trim(),
            postcode: shippingForm.postcode.trim() || '00000',
            country: 'SY',
          },
        });

        if (cancelled || !updatedCart.needs_shipping) {
          return;
        }

        for (const shippingPackage of updatedCart.shipping_rates ?? []) {
          const rate =
            shippingPackage.shipping_rates.find((r) => r.selected) ??
            shippingPackage.shipping_rates[0];
          if (rate) {
            await CartService.selectShippingRate(shippingPackage.package_id, rate.rate_id);
          }
        }
      } catch {
        // Silent — placeOrder() redoes this and surfaces real errors there.
      } finally {
        if (!cancelled) {
          queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });
        }
      }
    };

    const timer = setTimeout(syncShippingPreview, 400);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    items.length,
    shippingForm.city,
    shippingForm.state,
    shippingForm.postcode,
    shippingForm.address_1,
    queryClient,
  ]);

  useEffect(() => {
    if (!isOtpModalVisible) {
      setOtpSecondsLeft(0);
      setResendSecondsLeft(0);
      return;
    }

    const tick = () => {
      const now = Date.now();
      setOtpSecondsLeft(Math.max(0, Math.ceil((otpExpiresAt - now) / 1000)));
      setResendSecondsLeft(Math.max(0, Math.ceil((otpResendAt - now) / 1000)));
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isOtpModalVisible, otpExpiresAt, otpResendAt]);

  const paymentMethods = useMemo(
    () => (bootstrapData?.payment_gateways ?? []).filter((gateway) => gateway.enabled),
    [bootstrapData?.payment_gateways]
  );

  const selectedPaymentGateway = useMemo(
    () => paymentMethods.find((gateway) => gateway.id === paymentMethod) ?? null,
    [paymentMethods, paymentMethod]
  );

  const isShamCashSelected = useMemo(
    () => isShamCashGateway(selectedPaymentGateway),
    [selectedPaymentGateway]
  );

  const isCashOnDeliverySelected = useMemo(
    () => isCashOnDeliveryGateway(selectedPaymentGateway),
    [selectedPaymentGateway]
  );

  const shamCashQrUrl = useMemo(() => {
    if (!isShamCashSelected || !selectedPaymentGateway) {
      return '';
    }

    const fromStaticLink = resolveGatewayAssetUrl(SHAM_CASH_QR_STATIC_URL, bootstrapData?.store?.url);
    const fromDescription = extractFirstImageUrlFromHtml(selectedPaymentGateway.description);
    const fromIcon = extractFirstImageUrlFromHtml(selectedPaymentGateway.icon);
    const rawUrl = fromStaticLink || fromDescription || fromIcon;

    return resolveGatewayAssetUrl(rawUrl, bootstrapData?.store?.url);
  }, [
    isShamCashSelected,
    selectedPaymentGateway,
    bootstrapData?.store?.url,
  ]);

  const shamCashDescription = useMemo(() => {
    if (!isShamCashSelected || !selectedPaymentGateway) {
      return '';
    }

    return stripHtmlToText(selectedPaymentGateway.description);
  }, [isShamCashSelected, selectedPaymentGateway]);

  const selectedPhoneCountry = useMemo(
    () => PHONE_COUNTRIES.find((country) => country.iso === shippingForm.phone_country) ?? PHONE_COUNTRIES[0],
    [shippingForm.phone_country]
  );

  const buildFullPhoneNumber = () => {
    const local = normalizeDigits(shippingForm.phone_local).replace(/^0+/, '');
    if (!local) {
      return '';
    }
    return `${selectedPhoneCountry.dialCode}${local}`;
  };

  const currencySymbol = checkoutCart?.totals?.currency_symbol || 'ل.س';
  const subtotalAmount = parseMoney(checkoutCart?.totals?.total_items, 0);
  const shippingAmount = parseMoney(checkoutCart?.totals?.total_shipping, 0);
  const discountAmount = parseMoney(checkoutCart?.totals?.total_discount, 0);

  const selectedShippingRate = useMemo(() => {
    const packages = checkoutCart?.shipping_rates ?? [];

    for (const shippingPackage of packages) {
      const selected = shippingPackage.shipping_rates.find((rate) => rate.selected);
      if (selected) {
        return selected;
      }
    }

    return packages[0]?.shipping_rates?.[0] ?? null;
  }, [checkoutCart?.shipping_rates]);

  const shippingDuration = useMemo(() => {
    const normalizeText = (value?: string) =>
      decodeHtmlEntities(stripHtml(value ?? ''))
        .replace(/\s+/g, ' ')
        .trim();

    const looksLikeDuration = (value: string) =>
      /(?:خلال|within|مدة|deliver|delivery|shipping)/i.test(value) &&
      /(?:يوم|أيام|day|days|ساعة|ساعات|hour|hours|أسبوع|أسابيع|week|weeks)/i.test(value);

    if (!selectedShippingRate) {
      return 'غير محددة';
    }

    const directDuration = normalizeText(selectedShippingRate.delivery_time);
    if (directDuration) {
      return directDuration;
    }

    const fromTitle = normalizeText(selectedShippingRate.name);
    if (fromTitle && looksLikeDuration(fromTitle)) {
      return fromTitle;
    }

    const fromDescription = normalizeText(selectedShippingRate.description);
    if (fromDescription && looksLikeDuration(fromDescription)) {
      return fromDescription;
    }

    for (const rawMeta of selectedShippingRate.meta_data ?? []) {
      const meta = rawMeta as {
        key?: string;
        value?: string;
        display_key?: string;
        display_value?: string;
      };

      const key = (meta.key ?? meta.display_key ?? '').toLowerCase().trim();
      const candidates = [
        normalizeText(meta.value),
        normalizeText(meta.display_value),
      ].filter(Boolean);

      for (const candidate of candidates) {
        if (
          candidate &&
          (
            ['delivery_time', '_delivery_time', 'shipping_duration', '_shipping_duration', 'estimated_delivery', '_estimated_delivery'].includes(key) ||
            looksLikeDuration(candidate)
          )
        ) {
          return candidate;
        }
      }
    }

    return 'غير محددة';
  }, [selectedShippingRate]);
  const finalAmount = parseMoney(
    checkoutCart?.totals?.total_price,
    Math.max(0, subtotalAmount + shippingAmount - discountAmount)
  );

  useEffect(() => {
    if (!paymentMethod && paymentMethods.length > 0) {
      setPaymentMethod(paymentMethods[0].id);
    }
  }, [paymentMethod, paymentMethods]);

  const updateField = (field: string, value: string) => {
    setShippingForm((prev) => ({ ...prev, [field]: value }));
  };

  const setGovernorate = (city: string) => {
    setShippingForm((prev) => ({
      ...prev,
      city,
      state: city,
    }));
    setIsCityModalVisible(false);
  };

  const validateBeforeOtp = () => {
    const requiredFields = [
      shippingForm.first_name.trim(),
      shippingForm.last_name.trim(),
      shippingForm.city.trim(),
      shippingForm.address_1.trim(),
      normalizeDigits(shippingForm.phone_local).trim(),
    ];

    if (requiredFields.some((value) => value.length === 0)) {
      Alert.alert('خطأ', 'يرجى تعبئة الحقول المطلوبة: الاسم الأول، اسم العائلة، المدينة، العنوان، ورقم الهاتف.');
      return false;
    }

    if (!paymentMethod) {
      Alert.alert('خطأ', 'لا توجد وسيلة دفع متاحة حالياً لهذا الطلب.');
      return false;
    }

    return true;
  };

  const buildOtpPayload = () => ({
    first_name: shippingForm.first_name.trim(),
    last_name: shippingForm.last_name.trim(),
    city: shippingForm.city.trim(),
    address_1: shippingForm.address_1.trim(),
    phone: normalizeDigits(shippingForm.phone_local),
    phone_country: shippingForm.phone_country,
    cart_token: TokenStorage.getCartToken(),
  });

  const requestOtp = async () => {
    setIsSendingOtp(true);
    try {
      const otpResponse = await CheckoutOtpService.sendOtp(buildOtpPayload());
      const now = Date.now();
      const maskedPhone = otpResponse.masked_phone || buildFullPhoneNumber();
      const expiresAt = now + (otpResponse.expires_in ?? 300) * 1000;
      const resendAt = now + (otpResponse.resend_after ?? 60) * 1000;

      setOtpSessionId(otpResponse.otp_session_id);
      setOtpMaskedPhone(maskedPhone);
      setOtpExpiresAt(expiresAt);
      setOtpResendAt(resendAt);
      setOtpCode('');
      setIsOtpModalVisible(true);

      CheckoutOtpSessionStorage.save({
        otpSessionId: otpResponse.otp_session_id,
        otpMaskedPhone: maskedPhone,
        otpExpiresAt: expiresAt,
        otpResendAt: resendAt,
      });
    } catch (error) {
      Alert.alert(
        'تعذر إرسال رمز التحقق',
        mapOtpErrorMessage(error, 'حدث خطأ أثناء إرسال رمز واتساب. حاول مرة أخرى.')
      );
    } finally {
      setIsSendingOtp(false);
    }
  };

  const createOrderAfterOtp = async (otpProofToken: string) => {
    setIsPlacingOrder(true);

    try {
      const selectedCity = shippingForm.city.trim();
      const fullPhone = buildFullPhoneNumber();
      const normalizedPostcode = shippingForm.postcode.trim() || '00000';
      const phoneLinkedEmail = buildPhoneLinkedEmail(fullPhone);

      const order = await OrdersService.placeOrder(
        {
          billing_address: {
            first_name: shippingForm.first_name.trim(),
            last_name: shippingForm.last_name.trim(),
            address_1: shippingForm.address_1.trim(),
            address_2: shippingForm.address_2.trim(),
            city: selectedCity,
            state: selectedCity,
            postcode: normalizedPostcode,
            country: 'SY',
            email: phoneLinkedEmail,
            phone: fullPhone,
            company: '',
          },
          shipping_address: {
            first_name: shippingForm.first_name.trim(),
            last_name: shippingForm.last_name.trim(),
            address_1: shippingForm.address_1.trim(),
            address_2: shippingForm.address_2.trim(),
            city: selectedCity,
            state: selectedCity,
            postcode: normalizedPostcode,
            country: 'SY',
            phone: fullPhone,
            company: '',
          },
          customer_note: notes,
          create_account: false,
          payment_method: paymentMethod,
          payment_data: [],
          coupon_code: couponCode ?? undefined,
        },
        otpProofToken
      );

      const { orderId, orderNumber } = extractOrderIdentifiers(order);
      const orderKey = extractOrderKey(order);
      const paymentRedirectUrl = extractPaymentRedirectUrl(order);

      if (!orderId) {
        throw new Error('تم إرسال الطلب لكن تعذر قراءة رقم الطلب من الخادم. يرجى فتح صفحة طلباتي للتأكد من إنشائه.');
      }

      // Save locally so "طلباتي" can show this order immediately without login —
      // orderKey doubles as the guest's access token for viewing it later.
      GuestOrdersStorage.add({
        orderId,
        orderNumber,
        orderKey,
        phone: fullPhone,
        createdAt: new Date().toISOString(),
      });

      const canUseOrderPayFallback = !isCashOnDeliverySelected && !isShamCashSelected;
      const fallbackOrderPayUrl = canUseOrderPayFallback
        ? buildOrderPayUrl(bootstrapData?.store?.url, orderId, orderKey)
        : '';
      const finalRedirectUrl = paymentRedirectUrl || fallbackOrderPayUrl;

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      // WooCommerce empties the server cart once the order is placed.
      queryClient.invalidateQueries({ queryKey: CART_QUERY_KEY });

      setIsOtpModalVisible(false);
      setOtpSessionId('');
      setOtpCode('');
      CheckoutOtpSessionStorage.clear();
      navigation.replace('OrderSuccess', { orderId, orderNumber });

      // canUseOrderPayFallback already covers every online gateway (Albaraka,
      // Paymera, and any future one) — this used to only alert for Albaraka
      // by name, so any other online gateway with a missing redirect URL
      // failed completely silently: the order existed, payment was still
      // required, and the customer got no indication of either.
      const gatewayLabel = selectedPaymentGateway?.title || 'بوابة الدفع';

      if (canUseOrderPayFallback && !finalRedirectUrl) {
        Alert.alert(
          'متابعة الدفع',
          `تم إنشاء الطلب، لكن لم يصل رابط الدفع من ${gatewayLabel}. يرجى فتح "طلباتي" وإكمال الدفع من تفاصيل الطلب.`
        );
        return;
      }

      if (!canUseOrderPayFallback || !finalRedirectUrl) {
        return;
      }

      try {
        await Linking.openURL(finalRedirectUrl);
      } catch {
        Alert.alert(
          'متابعة الدفع',
          `تم إنشاء الطلب، لكن تعذر فتح رابط ${gatewayLabel} تلقائيًا. يمكنك إكمال الدفع من تفاصيل الطلب.`
        );
      }
    } catch (error) {
      // placeOrder() runs address/shipping/coupon steps sequentially against the
      // server cart — a failure partway through (e.g. coupon step) still leaves
      // earlier steps (address, shipping rate) applied server-side. Without this,
      // the on-screen total stays whatever it was before the attempt, which can
      // now be wrong relative to what a retry will actually charge.
      queryClient.invalidateQueries({ queryKey: ['checkout-cart-preview'] });
      const apiError = error as { message?: string };
      Alert.alert('خطأ في الطلب', apiError?.message ?? 'حدث خطأ أثناء إتمام الطلب.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handlePlaceOrder = async () => {
    if (!validateBeforeOtp()) {
      return;
    }

    await requestOtp();
  };

  const handleVerifyOtp = async () => {
    if (!otpSessionId) {
      Alert.alert('رمز التحقق', 'انتهت جلسة التحقق. يرجى إعادة إرسال الرمز.');
      return;
    }

    const code = otpCode.replace(/\D+/g, '').trim();
    if (code.length !== 6) {
      Alert.alert('رمز التحقق', 'يرجى إدخال رمز مكوّن من 6 أرقام.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const verification = await CheckoutOtpService.verifyOtp({
        otp_session_id: otpSessionId,
        code,
        cart_token: TokenStorage.getCartToken(),
      });

      await createOrderAfterOtp(verification.otp_proof_token);
    } catch (error) {
      Alert.alert(
        'فشل التحقق',
        mapOtpErrorMessage(error, 'تعذر التحقق من الرمز. يرجى المحاولة مرة أخرى.')
      );
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendOtp = async () => {
    if (resendSecondsLeft > 0) {
      return;
    }

    await requestOtp();
  };

  const isActionLoading = isSendingOtp || isVerifyingOtp || isPlacingOrder;

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.secondary} />
      <View style={[styles.header, { paddingTop: insets.top + Spacing[2] }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn} accessibilityRole="button" accessibilityLabel="رجوع" hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <MaterialCommunityIcons name="arrow-right" style={styles.backIcon} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إتمام الطلب</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>عنوان الفاتورة والشحن</Text>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>الاسم الأول *</Text>
            <TextInput
              style={styles.input}
              placeholder="أدخل الاسم الأول"
              placeholderTextColor={Colors.placeholder}
              value={shippingForm.first_name}
              onChangeText={(value) => updateField('first_name', value)}
              textAlign="right"
            />
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>اسم العائلة *</Text>
            <TextInput
              style={styles.input}
              placeholder="أدخل اسم العائلة"
              placeholderTextColor={Colors.placeholder}
              value={shippingForm.last_name}
              onChangeText={(value) => updateField('last_name', value)}
              textAlign="right"
            />
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>الدولة</Text>
            <View style={styles.lockedInput}>
              <Text style={styles.lockedInputText}>سوريا</Text>
            </View>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>المدينة / المحافظة *</Text>
            <TouchableOpacity
              style={styles.dropdownInput}
              onPress={() => setIsCityModalVisible(true)}
              activeOpacity={0.8}
            >
              <Text style={shippingForm.city ? styles.dropdownValue : styles.dropdownPlaceholder}>
                {shippingForm.city || 'اختر المحافظة'}
              </Text>
            </TouchableOpacity>
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>عنوان الشارع / الحي *</Text>
            <TextInput
              style={styles.input}
              placeholder="أدخل عنوان الشارع / الحي"
              placeholderTextColor={Colors.placeholder}
              value={shippingForm.address_1}
              onChangeText={(value) => updateField('address_1', value)}
              textAlign="right"
            />
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>الحي (اختياري)</Text>
            <TextInput
              style={styles.input}
              placeholder="أدخل الحي"
              placeholderTextColor={Colors.placeholder}
              value={shippingForm.address_2}
              onChangeText={(value) => updateField('address_2', value)}
              textAlign="right"
            />
          </View>

          <View style={styles.fieldWrapper}>
            <Text style={styles.label}>رقم واتساب *</Text>
            <View style={styles.phoneRow}>
              <TouchableOpacity
                style={styles.phoneCountryBtn}
                onPress={() => setIsPhoneCountryModalVisible(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.phoneCountryBtnText}>{selectedPhoneCountry.name}</Text>
                <Text style={styles.phoneDialCode}>{selectedPhoneCountry.dialCode}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.phoneInput}
                placeholder="أدخل الرقم"
                placeholderTextColor={Colors.placeholder}
                value={shippingForm.phone_local}
                onChangeText={(value) => updateField('phone_local', normalizeDigits(value))}
                keyboardType="phone-pad"
                textAlign="left"
              />
            </View>
          </View>

          <View style={styles.infoNote}>
            <MaterialCommunityIcons name="information-outline" style={styles.infoNoteIcon} />
            <Text style={styles.infoNoteText}>
              سيتم ربط الطلب برقم الجوال والتحقق عبر واتساب، ولا يلزم تسجيل الدخول لإتمام الشراء.
            </Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>طريقة الدفع</Text>
          {isPaymentMethodsLoading ? (
            <ActivityIndicator color={Colors.primary} />
          ) : paymentMethods.length > 0 ? (
            paymentMethods.map((pm) => (
              <TouchableOpacity
                key={pm.id}
                style={[styles.paymentOption, paymentMethod === pm.id && styles.paymentActive]}
                onPress={() => setPaymentMethod(pm.id)}
              >
                <View style={styles.radioOuter}>
                  {paymentMethod === pm.id && <View style={styles.radioInner} />}
                </View>
                <MaterialCommunityIcons
                  name={pm.id === 'cod' ? 'cash-multiple' : 'bank-outline'}
                  style={styles.paymentIcon}
                />
                <View style={styles.paymentCopy}>
                  <Text style={styles.paymentLabel}>{pm.title}</Text>
                  {pm.description ? (
                    <Text style={styles.paymentDescription}>{pm.description.replace(/<[^>]*>/g, '')}</Text>
                  ) : null}
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <Text style={styles.emptyPaymentText}>لا توجد وسائل دفع متاحة حالياً</Text>
          )}

          {isShamCashSelected ? (
            <View style={styles.shamCashCard}>
              <Text style={styles.shamCashHint}>
                {shamCashDescription || 'ادفع باستخدام شام كاش عبر مسح رمز QR.'}
              </Text>
              {shamCashQrUrl ? (
                <Image source={{ uri: shamCashQrUrl }} style={styles.shamCashQrImage} resizeMode="contain" />
              ) : (
                <Text style={styles.shamCashMissingQr}>
                  لم يتم العثور على QR في إعدادات بوابة شام كاش بالموقع.
                </Text>
              )}
            </View>
          ) : null}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ملاحظات الطلب (اختياري)</Text>
          <TextInput
            style={[styles.input, styles.notesInput]}
            placeholder="أضف ملاحظات للطلب..."
            placeholderTextColor={Colors.placeholder}
            value={notes}
            onChangeText={setNotes}
            multiline
            textAlign="right"
            textAlignVertical="top"
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>ملخص الطلب</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>عدد المنتجات</Text>
            <Text style={styles.summaryValue}>{items.length}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>المجموع الفرعي</Text>
            <Text style={styles.summaryValue}>{formatPrice(subtotalAmount, currencySymbol)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>تكلفة الشحن</Text>
            <Text style={styles.summaryValue}>{formatPrice(shippingAmount, currencySymbol)}</Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>مدة الشحن</Text>
            <Text style={styles.summaryValue}>{shippingDuration}</Text>
          </View>
          {discountAmount > 0 && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>الخصم</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>
                - {formatPrice(discountAmount, currencySymbol)}
              </Text>
            </View>
          )}
          {couponCode && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>كود الخصم</Text>
              <Text style={[styles.summaryValue, { color: Colors.success }]}>{couponCode}</Text>
            </View>
          )}
          <View style={[styles.summaryRow, styles.summaryTotal]}>
            <Text style={styles.totalLabel}>الإجمالي</Text>
            <Text style={styles.totalValue}>{formatPrice(finalAmount, currencySymbol)}</Text>
          </View>
        </View>

        <View style={styles.bottomSpacer} />
      </ScrollView>

      <View style={styles.bottomBar}>
        <TouchableOpacity
          style={[styles.placeOrderBtn, isActionLoading && styles.btnDisabled]}
          onPress={handlePlaceOrder}
          disabled={isActionLoading}
        >
          {isSendingOtp ? (
            <ActivityIndicator color={Colors.textInverse} />
          ) : (
            <Text style={styles.placeOrderText}>تأكيد الطلب – {formatPrice(finalAmount, currencySymbol)}</Text>
          )}
        </TouchableOpacity>
      </View>

      <Modal
        visible={isCityModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsCityModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.cityModalCard}>
            <View style={styles.cityModalHeader}>
              <Text style={styles.cityModalTitle}>اختر المحافظة</Text>
              <TouchableOpacity onPress={() => setIsCityModalVisible(false)} accessibilityRole="button" accessibilityLabel="إغلاق">
                <MaterialCommunityIcons name="close" style={styles.closeText} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={SYRIAN_GOVERNORATES}
              keyExtractor={(item) => item}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.cityOption} onPress={() => setGovernorate(item)}>
                  <Text style={styles.cityOptionText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      <Modal
        visible={isOtpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => !isActionLoading && setIsOtpModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.otpModalCard}>
            <View style={styles.otpHeader}>
              <Text style={styles.otpTitle}>تأكيد الطلب عبر واتساب</Text>
              <TouchableOpacity
                onPress={() => !isActionLoading && setIsOtpModalVisible(false)}
                disabled={isActionLoading}
                accessibilityRole="button"
                accessibilityLabel="إغلاق"
              >
                <MaterialCommunityIcons name="close" style={styles.closeText} />
              </TouchableOpacity>
            </View>

            <Text style={styles.otpHint}>
              أدخل رمز التحقق المكوّن من 6 أرقام المرسل إلى:
            </Text>
            <Text style={styles.otpPhone}>{otpMaskedPhone || buildFullPhoneNumber()}</Text>

            <TextInput
              style={styles.otpInput}
              value={otpCode}
              onChangeText={(value) => setOtpCode(value.replace(/\D+/g, '').slice(0, 6))}
              keyboardType="number-pad"
              placeholder="أدخل رمز OTP"
              placeholderTextColor={Colors.placeholder}
              textAlign="center"
              maxLength={6}
            />

            <Text style={styles.timerText}>ينتهي الرمز خلال: {otpSecondsLeft} ثانية</Text>

            <TouchableOpacity
              style={[styles.verifyBtn, isActionLoading && styles.btnDisabled]}
              onPress={handleVerifyOtp}
              disabled={isActionLoading}
            >
              {isVerifyingOtp || isPlacingOrder ? (
                <ActivityIndicator color={Colors.textInverse} />
              ) : (
                <Text style={styles.verifyBtnText}>تأكيد الطلب</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.resendBtn, resendSecondsLeft > 0 && styles.btnDisabled]}
              onPress={handleResendOtp}
              disabled={resendSecondsLeft > 0 || isActionLoading}
            >
              {isSendingOtp ? (
                <ActivityIndicator color={Colors.textPrimary} />
              ) : (
                <Text style={styles.resendBtnText}>
                  {resendSecondsLeft > 0 ? `إعادة إرسال الرمز (${resendSecondsLeft})` : 'إعادة إرسال الرمز'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal
        visible={isPhoneCountryModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsPhoneCountryModalVisible(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.cityModalCard}>
            <View style={styles.cityModalHeader}>
              <Text style={styles.cityModalTitle}>اختر دولة الرقم</Text>
              <TouchableOpacity onPress={() => setIsPhoneCountryModalVisible(false)} accessibilityRole="button" accessibilityLabel="إغلاق">
                <MaterialCommunityIcons name="close" style={styles.closeText} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={PHONE_COUNTRIES}
              keyExtractor={(item) => item.iso}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.countryOption}
                  onPress={() => {
                    updateField('phone_country', item.iso);
                    setIsPhoneCountryModalVisible(false);
                  }}
                >
                  <Text style={styles.countryOptionCode}>{item.dialCode}</Text>
                  <Text style={styles.countryOptionText}>{item.name}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    backgroundColor: Colors.secondary,
    paddingTop: Spacing[10],
    paddingBottom: Spacing[4],
    paddingHorizontal: Spacing[4],
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomLeftRadius: BorderRadius['2xl'],
    borderBottomRightRadius: BorderRadius['2xl'],
  },
  backBtn: { width: 40, alignItems: 'center' },
  backIcon: { fontSize: 22, color: Colors.textInverse },
  headerTitle: { ...Typography.h4, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },
  scrollContent: { padding: Spacing[4], gap: Spacing[3] },
  section: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: Spacing[4],
    ...Shadows.xs,
  },
  sectionHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  sectionTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicBold,
    textAlign: 'right',
    marginBottom: Spacing[3],
  },
  fieldWrapper: { marginBottom: Spacing[3], gap: Spacing[1] },
  label: {
    ...Typography.label,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicMedium,
    textAlign: 'right',
  },
  input: {
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2.5],
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicRegular,
  },
  phoneRow: {
    flexDirection: 'row-reverse',
    gap: Spacing[2],
    alignItems: 'center',
  },
  phoneCountryBtn: {
    minWidth: 132,
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[2.5],
    paddingVertical: Spacing[2.5],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  phoneCountryBtnText: {
    ...Typography.label,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicMedium,
    textAlign: 'center',
  },
  phoneDialCode: {
    ...Typography.caption,
    color: Colors.textSecondary,
    fontFamily: FontFamily.bold,
    textAlign: 'center',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2.5],
    fontSize: FontSize.base,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
  },
  lockedInput: {
    backgroundColor: Colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2.5],
  },
  lockedInputText: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'right',
    fontFamily: FontFamily.arabicMedium,
  },
  dropdownInput: {
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[3],
  },
  dropdownValue: {
    ...Typography.body,
    color: Colors.textPrimary,
    textAlign: 'right',
    fontFamily: FontFamily.arabicMedium,
  },
  dropdownPlaceholder: {
    ...Typography.body,
    color: Colors.placeholder,
    textAlign: 'right',
    fontFamily: FontFamily.arabicRegular,
  },
  notesInput: { height: 84 },
  infoNote: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingHorizontal: Spacing[3],
    paddingVertical: Spacing[2.5],
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: Spacing[2],
  },
  infoNoteIcon: {
    fontSize: 18,
    color: Colors.secondary,
    marginTop: 1,
  },
  infoNoteText: {
    flex: 1,
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'right',
    lineHeight: 20,
  },
  paymentOption: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: Spacing[3],
    padding: Spacing[3],
    borderRadius: BorderRadius.lg,
    borderWidth: 1.5,
    borderColor: Colors.border,
    marginBottom: Spacing[2],
  },
  paymentActive: { borderColor: Colors.secondary, backgroundColor: '#EEF1F8' },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInner: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.secondary },
  paymentIcon: { fontSize: 20, color: Colors.textSecondary },
  paymentCopy: { flex: 1, gap: Spacing[1] },
  paymentLabel: { ...Typography.bodySmall, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium },
  paymentDescription: { ...Typography.caption, color: Colors.textSecondary, textAlign: 'right' },
  emptyPaymentText: { ...Typography.bodySmall, color: Colors.textSecondary, textAlign: 'right' },
  shamCashCard: {
    marginTop: Spacing[2],
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.lg,
    padding: Spacing[3],
    backgroundColor: Colors.surfaceSecondary,
    alignItems: 'center',
    gap: Spacing[2],
  },
  shamCashHint: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontFamily: FontFamily.arabicMedium,
  },
  shamCashQrImage: {
    width: 220,
    height: 220,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.surface,
  },
  shamCashMissingQr: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontFamily: FontFamily.arabicRegular,
  },
  summaryRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', paddingVertical: Spacing[2] },
  summaryLabel: { ...Typography.body, color: Colors.textSecondary },
  summaryValue: { ...Typography.body, color: Colors.textPrimary, fontFamily: FontFamily.arabicMedium },
  summaryTotal: {
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
    marginTop: Spacing[2],
    paddingTop: Spacing[3],
  },
  totalLabel: { ...Typography.h4, color: Colors.textPrimary, fontFamily: FontFamily.arabicBold },
  totalValue: { ...Typography.priceLarge, color: Colors.sale, fontFamily: FontFamily.arabicBold },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: Colors.surface,
    padding: Spacing[5],
    paddingBottom: Spacing[8],
    ...Shadows.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  placeOrderBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.xl,
    paddingVertical: Spacing[4],
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.7 },
  placeOrderText: { ...Typography.button, color: Colors.textInverse, fontFamily: FontFamily.arabicBold },

  modalBackdrop: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    paddingHorizontal: Spacing[5],
  },
  cityModalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing[4],
    maxHeight: '70%',
  },
  cityModalHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  cityModalTitle: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicBold,
  },
  cityOption: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingVertical: Spacing[3],
  },
  cityOptionText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicMedium,
    textAlign: 'right',
  },
  countryOption: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
    paddingVertical: Spacing[3],
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  countryOptionText: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicMedium,
    textAlign: 'right',
  },
  countryOptionCode: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    fontFamily: FontFamily.bold,
  },

  otpModalCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: Spacing[5],
    ...Shadows.xl,
  },
  otpHeader: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing[3],
  },
  otpTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicBold,
  },
  closeText: {
    fontSize: 22,
    color: Colors.textTertiary,
  },
  otpHint: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'right',
    marginBottom: Spacing[1.5],
  },
  otpPhone: {
    ...Typography.h4,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    textAlign: 'right',
    marginBottom: Spacing[3],
  },
  otpInput: {
    backgroundColor: Colors.inputBackground,
    borderWidth: 1,
    borderColor: Colors.inputBorder,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[3],
    fontSize: 24,
    color: Colors.textPrimary,
    fontFamily: FontFamily.bold,
    letterSpacing: 8,
    marginBottom: Spacing[2.5],
  },
  timerText: {
    ...Typography.caption,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing[3],
  },
  verifyBtn: {
    backgroundColor: Colors.secondary,
    borderRadius: BorderRadius.lg,
    paddingVertical: Spacing[3],
    alignItems: 'center',
    marginBottom: Spacing[2],
  },
  verifyBtnText: {
    ...Typography.button,
    color: Colors.textInverse,
    fontFamily: FontFamily.arabicBold,
  },
  resendBtn: {
    backgroundColor: Colors.surfaceSecondary,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: Spacing[3],
    alignItems: 'center',
  },
  resendBtnText: {
    ...Typography.button,
    color: Colors.textPrimary,
    fontFamily: FontFamily.arabicMedium,
  },
  bottomSpacer: { height: 160 },
});
