/**
 * Dokan App – Formatting Utilities
 */

/**
 * Decode basic HTML entities (including numeric entities like &#x644;).
 */
export const decodeHtmlEntities = (value: string): string => {
  if (!value) return value;

  return value
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#([0-9]+);/g, (_, dec: string) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
};

/**
 * Group the integer part of a number with thousand separators, without
 * relying on Intl at all — used as a fallback when toLocaleString throws
 * (seen on some low-end Android/Hermes builds without full ICU data for
 * non-default locales), so a formatting quirk degrades to plain-but-correct
 * digits instead of crashing the screen.
 */
const groupThousandsManually = (num: number): string => {
  const rounded = Math.round(num * 100) / 100;
  const parts = rounded.toString().split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return parts.join('.');
};

/**
 * Locale-aware grouped number formatting with a non-Intl fallback.
 */
export const formatNumber = (num: number): string => {
  try {
    return num.toLocaleString('ar-SY');
  } catch {
    return groupThousandsManually(num);
  }
};

/**
 * Format a price value with currency symbol (Syrian Pound).
 */
export const formatPrice = (price: string | number, currencySymbol = 'ل.س'): string => {
  const decodedCurrencySymbol = decodeHtmlEntities(currencySymbol).trim() || 'ل.س';
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return `0 ${decodedCurrencySymbol}`;
  return `${formatNumber(num)} ${decodedCurrencySymbol}`;
};

/**
 * Format a date string to locale date.
 */
export const formatDate = (dateString: string): string => {
  try {
    return new Date(dateString).toLocaleDateString('ar-SY', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
};

/**
 * Format a discount percentage.
 */
export const formatDiscount = (regularPrice: string, salePrice: string): string | null => {
  const regular = parseFloat(regularPrice);
  const sale = parseFloat(salePrice);
  if (isNaN(regular) || isNaN(sale) || regular <= 0) return null;
  return `${Math.round(((regular - sale) / regular) * 100)}%`;
};

/**
 * Strip HTML tags from a string.
 */
export const stripHtml = (html: string): string => {
  return html.replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
};

/**
 * Convert product description HTML to plain text while keeping paragraph
 * breaks and list bullets, instead of flattening everything onto one line.
 */
export const stripHtmlPreserveStructure = (html: string): string => {
  if (!html) return '';

  return html
    .replace(/<li[^>]*>/gi, '• ')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/(p|div|h[1-6])>/gi, '\n\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&nbsp;/g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
};

/**
 * Truncate text to a max length.
 */
export const truncate = (text: string, maxLength: number): string => {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength).trimEnd() + '...';
};
