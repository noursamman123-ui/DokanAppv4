import apiClient from './client';
import { Endpoints } from './endpoints';
import { PrivacyPolicyContent } from '../types';
import { decodeHtmlEntities, stripHtml } from '../utils/formatters';

type PagePayload = {
  source_url?: string;
  title?: string;
  body?: string;
  html?: string;
};

type PageResponse = {
  success?: boolean;
  data?: PagePayload;
};

const normalizeText = (value: string) =>
  decodeHtmlEntities(stripHtml(value))
    .replace(/\s+/g, ' ')
    .trim();

const unwrapPagePayload = (payload: PageResponse | PagePayload): PagePayload => {
  if ('data' in payload && payload.data) {
    return payload.data;
  }

  return payload as PagePayload;
};

export const TermsService = {
  getTerms: async (): Promise<PrivacyPolicyContent> => {
    const response = await apiClient.get<PageResponse | PagePayload>(Endpoints.pages.terms);
    const payload = unwrapPagePayload(response.data);
    const body = normalizeText(payload.body || payload.html || '');

    return {
      source_url: payload.source_url || '',
      title: normalizeText(payload.title || '') || 'الشروط والأحكام',
      body,
    };
  },
};
