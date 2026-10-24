/**
 * Decorative warm tones for stat cards (Home indicators, Casa sections).
 * Separate from the semantic success/warning/destructive tokens in globals.css —
 * these carry no meaning (good/bad), they're purely for visual variety and energy.
 */
export const CARD_TONES = {
  sage: { bg: "#7C9473", bgSoft: "#EEF2EC", text: "#4F6B47" },
  ochre: { bg: "#B8873B", bgSoft: "#FBF1E1", text: "#8F6526" },
  moss: { bg: "#4F7A4A", bgSoft: "#EBF2EA", text: "#35552F" },
  terracotta: { bg: "#C97B5A", bgSoft: "#FBEEE8", text: "#A85A3B" },
  clay: { bg: "#AD6A4E", bgSoft: "#F6ECE7", text: "#824D37" },
  sand: { bg: "#C9B389", bgSoft: "#F8F4EB", text: "#8A7347" },
} as const;

export type CardTone = keyof typeof CARD_TONES;
