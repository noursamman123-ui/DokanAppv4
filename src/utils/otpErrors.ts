/**
 * Shared Arabic error messages for the WhatsApp OTP flows (phone login,
 * link-phone, plus the pre-existing checkout/order-recovery OTP screens
 * which keep their own local copies — this covers the same codes for the
 * newer phone-login/link-phone screens without a three-way duplication).
 */
export const mapOtpError = (error: unknown, fallbackMessage: string): string => {
  const apiError = error as { code?: string; message?: string };

  switch (apiError?.code) {
    case 'phone_not_whatsapp':
      return 'رقم الهاتف غير مرتبط بواتساب. يرجى إدخال رقم واتساب صالح.';
    case 'unsupported_phone_country':
      return 'دولة رقم الهاتف غير مدعومة حالياً.';
    case 'otp_rate_limited':
      return 'تم إرسال رمز مؤخرًا. يرجى الانتظار قليلًا ثم إعادة المحاولة.';
    case 'otp_invalid':
      return 'رمز التحقق غير صحيح.';
    case 'otp_expired':
    case 'otp_invalid_proof':
      return 'انتهت صلاحية الرمز. يرجى طلب رمز جديد.';
    case 'otp_max_attempts':
      return 'تم تجاوز عدد محاولات التحقق المسموح. يرجى طلب رمز جديد.';
    case 'dokan_unauthorized':
      return 'يرجى تسجيل الدخول أولاً.';
    case 'phone_already_linked':
      return 'رقم الجوال هذا مرتبط بحساب آخر بالفعل.';
    case 'NETWORK_ERROR':
      return 'تعذر الاتصال بالخادم. تحقق من الإنترنت وحاول مجددًا.';
    default:
      return apiError?.message ?? fallbackMessage;
  }
};
