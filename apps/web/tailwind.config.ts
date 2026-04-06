import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/**/*.{ts,tsx}",
    "../../packages/ui/src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        // Spec §7.2: handwriting-style for headings/labels
        handwriting: ["Patrick Hand", "cursive"],
        // Readable sans-serif for body/forms/data
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        // Spec §7.1: white paper background, blue color scheme
        paper: "#FAFAF8",
        ink: {
          DEFAULT: "#1A1A2E",
          light: "#4A4A6A",
        },
        blue: {
          50: "#EFF6FF",
          100: "#DBEAFE",
          200: "#BFDBFE",
          300: "#93C5FD",
          400: "#60A5FA",
          500: "#3B82F6",
          600: "#2563EB",
          700: "#1D4ED8",
          800: "#1E40AF",
          900: "#1E3A8A",
        },
      },
    },
  },
  plugins: [],
};

export default config;
