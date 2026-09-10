import { Platform } from 'react-native';

/**
 * Dokan App – Typography System
 * Inter for Latin, Cairo for Arabic text.
 */

export const FontFamily = {
  // Latin
  regular: Platform.select({ ios: 'Inter-Regular', android: 'Inter-Regular' }) ?? 'System',
  medium: Platform.select({ ios: 'Inter-Medium', android: 'Inter-Medium' }) ?? 'System',
  semiBold: Platform.select({ ios: 'Inter-SemiBold', android: 'Inter-SemiBold' }) ?? 'System',
  bold: Platform.select({ ios: 'Inter-Bold', android: 'Inter-Bold' }) ?? 'System',
  extraBold: Platform.select({ ios: 'Inter-ExtraBold', android: 'Inter-ExtraBold' }) ?? 'System',

  // Arabic
  arabicRegular: Platform.select({ ios: 'Cairo-Regular', android: 'Cairo-Regular' }) ?? 'System',
  arabicMedium: Platform.select({ ios: 'Cairo-Medium', android: 'Cairo-Medium' }) ?? 'System',
  arabicSemiBold: Platform.select({ ios: 'Cairo-SemiBold', android: 'Cairo-SemiBold' }) ?? 'System',
  arabicBold: Platform.select({ ios: 'Cairo-Bold', android: 'Cairo-Bold' }) ?? 'System',
} as const;

export const FontSize = {
  xs: 10,
  sm: 12,
  base: 14,
  md: 16,
  lg: 18,
  xl: 20,
  '2xl': 24,
  '3xl': 28,
  '4xl': 32,
  '5xl': 36,
} as const;

export const LineHeight = {
  xs: 16,
  sm: 18,
  base: 20,
  md: 24,
  lg: 26,
  xl: 28,
  '2xl': 32,
  '3xl': 38,
  '4xl': 44,
} as const;

export const FontWeight = {
  regular: '400' as const,
  medium: '500' as const,
  semiBold: '600' as const,
  bold: '700' as const,
  extraBold: '800' as const,
} as const;

export const Typography = {
  // Display
  displayLarge: {
    fontSize: FontSize['4xl'],
    lineHeight: LineHeight['4xl'],
    fontWeight: FontWeight.bold,
    fontFamily: FontFamily.bold,
  },
  displayMedium: {
    fontSize: FontSize['3xl'],
    lineHeight: LineHeight['3xl'],
    fontWeight: FontWeight.bold,
    fontFamily: FontFamily.bold,
  },

  // Heading
  h1: {
    fontSize: FontSize['2xl'],
    lineHeight: LineHeight['2xl'],
    fontWeight: FontWeight.bold,
    fontFamily: FontFamily.bold,
  },
  h2: {
    fontSize: FontSize.xl,
    lineHeight: LineHeight.xl,
    fontWeight: FontWeight.semiBold,
    fontFamily: FontFamily.semiBold,
  },
  h3: {
    fontSize: FontSize.lg,
    lineHeight: LineHeight.lg,
    fontWeight: FontWeight.semiBold,
    fontFamily: FontFamily.semiBold,
  },
  h4: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.md,
    fontWeight: FontWeight.semiBold,
    fontFamily: FontFamily.semiBold,
  },

  // Body
  bodyLarge: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.md,
    fontWeight: FontWeight.regular,
    fontFamily: FontFamily.regular,
  },
  body: {
    fontSize: FontSize.base,
    lineHeight: LineHeight.base,
    fontWeight: FontWeight.regular,
    fontFamily: FontFamily.regular,
  },
  bodySmall: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.sm,
    fontWeight: FontWeight.regular,
    fontFamily: FontFamily.regular,
  },

  // Label
  labelLarge: {
    fontSize: FontSize.base,
    lineHeight: LineHeight.base,
    fontWeight: FontWeight.medium,
    fontFamily: FontFamily.medium,
  },
  label: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.sm,
    fontWeight: FontWeight.medium,
    fontFamily: FontFamily.medium,
  },
  labelSmall: {
    fontSize: FontSize.xs,
    lineHeight: LineHeight.xs,
    fontWeight: FontWeight.medium,
    fontFamily: FontFamily.medium,
  },

  // Price
  priceLarge: {
    fontSize: FontSize.xl,
    lineHeight: LineHeight.xl,
    fontWeight: FontWeight.bold,
    fontFamily: FontFamily.bold,
  },
  price: {
    fontSize: FontSize.md,
    lineHeight: LineHeight.md,
    fontWeight: FontWeight.bold,
    fontFamily: FontFamily.bold,
  },
  priceSmall: {
    fontSize: FontSize.base,
    lineHeight: LineHeight.base,
    fontWeight: FontWeight.bold,
    fontFamily: FontFamily.bold,
  },

  // Caption
  caption: {
    fontSize: FontSize.xs,
    lineHeight: LineHeight.xs,
    fontWeight: FontWeight.regular,
    fontFamily: FontFamily.regular,
  },

  // Button
  button: {
    fontSize: FontSize.base,
    lineHeight: LineHeight.base,
    fontWeight: FontWeight.semiBold,
    fontFamily: FontFamily.semiBold,
  },
  buttonSmall: {
    fontSize: FontSize.sm,
    lineHeight: LineHeight.sm,
    fontWeight: FontWeight.semiBold,
    fontFamily: FontFamily.semiBold,
  },
} as const;
