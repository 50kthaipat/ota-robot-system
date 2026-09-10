import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        canvas: "#010102",
        surface: {
          1: "#0f1011",
          2: "#141516",
          3: "#18191a",
          4: "#191a1b",
          // Fallback legacy mappings
          50: "#010102",
          100: "#0f1011",
          200: "#141516",
          300: "#18191a",
        },
        hairline: {
          DEFAULT: "#23252a",
          strong: "#34343a",
          tertiary: "#3e3e44",
        },
        primary: {
          DEFAULT: "#5e6ad2",
          hover: "#828fff",
          focus: "#5e69d1",
          secure: "#7a7fad",
        },
        ink: {
          DEFAULT: "#f7f8f8",
          muted: "#d0d6e0",
          subtle: "#8a8f98",
          tertiary: "#62666d",
        },
        semantic: {
          success: "#27a644",
          error: "#eb5757",
          warning: "#f2994a",
          secure: "#7a7fad",
        },
        brand: {
          cyan: "#5e6ad2", // Map legacy brand accents to Linear lavender
          blue: "#5e69d1",
          emerald: "#27a644",
          amber: "#f2994a",
          rose: "#eb5757",
        },
      },
      letterSpacing: {
        "display-xl": "-3px",
        "display-lg": "-1.8px",
        "display-md": "-1.0px",
        "headline": "-0.6px",
        "card-title": "-0.4px",
        "subhead": "-0.2px",
        "eyebrow": "0.4px",
      },
    },
  },
  plugins: [],
};
export default config;
