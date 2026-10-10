/**
 * Intent-to-Commerce AI Agent — Design Tokens
 * Visual Style: Premium, calm, editorial, modern SaaS.
 * High-contrast serif headlines, warm beige canvas, peach/lavender glows, and deep green verified accents.
 */

export const DESIGN_TOKENS = {
  colors: {
    // Canvas & backgrounds
    bgBeige: "#EEE9E4",
    bgBeigeLight: "#F7F4F1",
    bgWhite: "#FFFFFF",

    // Typography & Ink
    ink: "#111111",
    inkMuted: "#8B857F",
    inkLight: "#B8B2AC",

    // Borders & dividers
    borderWarm: "#E4DED8",
    borderWarmSubtle: "rgba(228, 222, 216, 0.6)",

    // Accents & Gradients
    accentCoral: "#F4A28C",
    accentGradientStart: "#F9D5CB",
    accentGradientEnd: "#E9D8FF",

    // Success & Verification (Secondary accent)
    accentGreen: "#1F4D45",
    accentGreenLight: "#E8F0EE",
    accentGreenBorder: "rgba(31, 77, 69, 0.25)",
  },

  typography: {
    fontSerif: '"Instrument Serif", "Newsreader", "Playfair Display", Georgia, serif',
    fontSans: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    fontMono: '"JetBrains Mono", ui-monospace, Menlo, Monaco, monospace',
  },

  radii: {
    cardSm: "20px",
    card: "28px",
    cardLg: "32px",
    pill: "9999px",
  },

  shadows: {
    subtle: "0 2px 8px rgba(17, 17, 17, 0.04), 0 1px 2px rgba(17, 17, 17, 0.02)",
    card: "0 12px 32px -4px rgba(27, 24, 21, 0.06), 0 4px 12px -2px rgba(27, 24, 21, 0.03)",
    elevated: "0 24px 48px -12px rgba(27, 24, 21, 0.12), 0 8px 24px -4px rgba(27, 24, 21, 0.06)",
    glow: "0 0 40px rgba(244, 162, 140, 0.35)",
  },
} as const;
