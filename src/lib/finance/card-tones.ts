/**
 * Categorical tones for stat cards (Home indicators, Conti, Casa) and category color-dots.
 * Lifted directly from the reference app's bullet-dot palette (LOOP — Gestione Economica),
 * plus "sage" as the one surviving thread back to the user's logo watercolor green.
 * Separate from the semantic success/warning/destructive tokens in globals.css — these carry
 * no meaning (good/bad), they're purely for visual variety. Never use them for Budget/Rendiconto
 * variance coloring, where color means over/under budget.
 */
export const CARD_TONES = {
  navy: { bg: "#1E2A52", bgSoft: "#EBECF2", text: "#1E2A52" },
  teal: { bg: "#14B8A6", bgSoft: "#E6F7F5", text: "#0F766E" },
  purple: { bg: "#7C5CFC", bgSoft: "#F0ECFE", text: "#5B3FD6" },
  gold: { bg: "#D99A2B", bgSoft: "#FBF1E0", text: "#A06F1A" },
  coral: { bg: "#E0574F", bgSoft: "#FBEAE9", text: "#B83A32" },
  sage: { bg: "#7C9473", bgSoft: "#EEF2EC", text: "#4F6B47" },
} as const;

export type CardTone = keyof typeof CARD_TONES;
