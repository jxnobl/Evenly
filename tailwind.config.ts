import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        background: {
          deep: "#020203",
          base: "#050506",
          elevated: "#0a0a0c",
        },
        surface: {
          DEFAULT: "rgba(255, 255, 255, 0.04)",
          hover: "rgba(255, 255, 255, 0.07)",
          active: "rgba(255, 255, 255, 0.09)",
        },
        foreground: {
          DEFAULT: "#EDEDEF",
          muted: "#8A8F98",
          subtle: "rgba(255, 255, 255, 0.50)",
        },
        accent: {
          DEFAULT: "#5E6AD2",
          bright: "#6872D9",
          glow: "rgba(94, 106, 210, 0.28)",
          subtle: "rgba(94, 106, 210, 0.12)",
        },
        border: {
          subtle: "rgba(255, 255, 255, 0.06)",
          hover: "rgba(255, 255, 255, 0.12)",
          accent: "rgba(94, 106, 210, 0.35)",
        },
      },
      boxShadow: {
        "linear-card":
          "0 0 0 1px rgba(255, 255, 255, 0.06), 0 2px 20px rgba(0, 0, 0, 0.5), 0 0 40px rgba(0, 0, 0, 0.25)",
        "linear-card-hover":
          "0 0 0 1px rgba(255, 255, 255, 0.12), 0 8px 40px rgba(0, 0, 0, 0.6), 0 0 80px rgba(94, 106, 210, 0.15)",
        "linear-cta":
          "0 0 0 1px rgba(94, 106, 210, 0.5), 0 4px 14px rgba(94, 106, 210, 0.35), inset 0 1px 0 0 rgba(255, 255, 255, 0.25)",
        "inner-glow": "inset 0 1px 0 0 rgba(255, 255, 255, 0.08)",
      },
      animation: {
        "blob-slow": "blobFloat 12s ease-in-out infinite alternate",
        "blob-slow-reverse": "blobFloatReverse 14s ease-in-out infinite alternate",
      },
      keyframes: {
        blobFloat: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "50%": { transform: "translate(30px, -20px) scale(1.04)" },
          "100%": { transform: "translate(-20px, 15px) scale(0.98)" },
        },
        blobFloatReverse: {
          "0%": { transform: "translate(0px, 0px) scale(1)" },
          "50%": { transform: "translate(-25px, 20px) scale(1.05)" },
          "100%": { transform: "translate(20px, -15px) scale(0.96)" },
        },
      },
      transitionTimingFunction: {
        expo: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;