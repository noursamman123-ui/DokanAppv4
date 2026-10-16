import apiClient from './client';
import { Endpoints } from './endpoints';
import {
  CheckoutOtpSendPayload,
  OtpSendResponse,
  OtpVerifyResponse,
  OtpLoginVerifyResponse,
  OtpLinkPhoneVerifyResponse,
} from '../types';

const unwrapPayload = <T>(payload: unknown): T => {
  const data = payload as { success?: boolean; data?: T };
  if (typeof data === 'object' && data && data.success === true && data.data) {
    return data.data;
  }
  return payload as T;
};

// The backend's /checkout/otp/send chains two sequential WhatsApp API calls
// (check-exists + send-message), each allowed up to 20s server-side — worst
// case ~40s before the backend even responds. The client's default 30s
// timeout was shorter than that, so a slow-but-successful WAWP round trip
// could deliver a real code over WhatsApp while the app had already given up
// and never showed the OTP entry screen at all. This overrides just this one
// request with enough headroom for that worst case plus network overhead.
const OTP_SEND_TIMEOUT_MS = 45000;

export const CheckoutOtpService = {
  sendOtp: async (payload: CheckoutOtpSendPayload): Promise<OtpSendResponse> => {
    const response = await apiClient.post(Endpoints.checkoutOtp.send, payload, {
      timeout: OTP_SEND_TIMEOUT_MS,
    });
    return unwrapPayload<OtpSendResponse>(response.data);
  },

  /**
   * Send an OTP for the sole purpose of recovering a guest's order history
   * on a new device (no cart/address context needed — just the phone).
   */
  sendOrdersLookupOtp: async (phone: string, phoneCountry: string): Promise<OtpSendResponse> => {
    const response = await apiClient.post(
      Endpoints.checkoutOtp.send,
      {
        purpose: 'orders_lookup',
        phone,
        phone_country: phoneCountry,
      },
      { timeout: OTP_SEND_TIMEOUT_MS }
    );
    return unwrapPayload<OtpSendResponse>(response.data);
  },

  verifyOtp: async (payload: {
    otp_session_id: string;
    code: string;
    cart_token?: string;
  }): Promise<OtpVerifyResponse> => {
    const response = await apiClient.post(Endpoints.checkoutOtp.verify, payload);
    return unwrapPayload<OtpVerifyResponse>(response.data);
  },

  /**
   * Log in (or create a new passwordless account) via a phone number
   * verified over WhatsApp — no account/email needed up front.
   */
  sendLoginOtp: async (phone: string, phoneCountry: string): Promise<OtpSendResponse> => {
    const response = await apiClient.post(
      Endpoints.checkoutOtp.send,
      { purpose: 'login', phone, phone_country: phoneCountry },
      { timeout: OTP_SEND_TIMEOUT_MS }
    );
    return unwrapPayload<OtpSendResponse>(response.data);
  },

  verifyLoginOtp: async (payload: { otp_session_id: string; code: string }): Promise<OtpLoginVerifyResponse> => {
    const response = await apiClient.post(Endpoints.checkoutOtp.verify, payload);
    return unwrapPayload<OtpLoginVerifyResponse>(response.data);
  },

  /**
   * Verify and attach a phone number to the *currently logged-in* account,
   * so it becomes usable with sendLoginOtp/verifyLoginOtp afterward.
   */
  sendLinkPhoneOtp: async (phone: string, phoneCountry: string): Promise<OtpSendResponse> => {
    const response = await apiClient.post(
      Endpoints.checkoutOtp.send,
      { purpose: 'link_phone', phone, phone_country: phoneCountry },
      { timeout: OTP_SEND_TIMEOUT_MS }
    );
    return unwrapPayload<OtpSendResponse>(response.data);
  },

  verifyLinkPhoneOtp: async (payload: { otp_session_id: string; code: string }): Promise<OtpLinkPhoneVerifyResponse> => {
    const response = await apiClient.post(Endpoints.checkoutOtp.verify, payload);
    return unwrapPayload<OtpLinkPhoneVerifyResponse>(response.data);
  },
};

