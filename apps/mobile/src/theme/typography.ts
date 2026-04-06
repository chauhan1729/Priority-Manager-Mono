// Font families mirror tailwind.config.ts: Patrick Hand for headings, Inter for body

export const fontFamily = {
  handwriting: 'PatrickHand',  // headings / accent labels
  sans: 'Inter',               // body / forms / data
} as const;

// Size scale in px (matching web rem scale at 16px base)
export const fontSize = {
  xs: 11,
  sm: 13,
  base: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;

export type FontFamily = typeof fontFamily;
export type FontSize = typeof fontSize;
export type FontWeight = typeof fontWeight;
