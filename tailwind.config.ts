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
        dark: {
          50: "#f4f4f5",
          100: "#e4e4e7",
          200: "#d1d1d4",
          300: "#b1b1b8",
          400: "#9b9bae",
          500: "#71717a",
          600: "#52525b",
          700: "#3f3f46",
          800: "#27272a",
          900: "#111111",
          950: "#0a0a0a",
        },
        brand: {
          PRIMARY: "#00C2FF",
          accent: "#E8A020",
          green: "#00FF9D",
          red: "#FF3B3B",
          blue: "#0066FF",
        },
        glass: {
          light: "rgba(255, 255, 255, 0.08)",
          dark: "rgba(0, 0, 0, 0.3)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        display: ['"Space Grotesk"', "Inter", "sans-serif"],
        mono: ['"JetBrains Mono"', "monospace"],
      },
      fontSize: {
        "hero": ["3.5rem", { lineHeight: "1.1", fontWeight: "700" }],
        "hero-sm": ["2.25rem", { lineHeight: "1.15", fontWeight: "700" }],
        "headline": ["1.75rem", { lineHeight: "1.2", fontWeight: "600" }],
        "headline-sm": ["1.25rem", { lineHeight: "1.3", fontWeight: "600" }],
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-in-out",
        "slide-up": "slideUp 0.4s ease-out",
        "pulse-slow": "pulse 3s ease-in-out infinite",
        "spin-slow": "spin 3s linear infinite",
        "shimmer": "shimmer 2s infinite",
        "float": "float 6s ease-in-out infinite",
        "pulse-glow": "pulseGlow 2s ease-in-out infinite",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "200% 0" },
          "100%": { backgroundPosition: "-200% 0" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        pulseGlow: {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.6" },
        },
      },
      backdropBlur: {
        xs: "2px",
      },
      boxShadow: {
        card: "0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)",
        "card-hover": "0 10px 15px -3px rgba(0, 0, 0, 0.2), 0 4px 6px -2px rgba(0, 0, 0, 0.1)",
        "neon": "0 0 20px rgba(0, 194, 255, 0.3), 0 0 40px rgba(0, 194, 255, 0.15)",
        "neon-inner": "inset 0 0 10px rgba(0, 194, 255, 0.2)",
      },
      backgroundImage: {
        "gradient-radial": "radial-gradient(var(--tw-gradient-stops))",
        "glass-gradient": "linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)",
        "dark-gradient": "linear-gradient(135deg, rgba(0,194,255,0.03) 0%, rgba(0,194,255,0.01) 100%)",
      },
    },
  },
  plugins: [],
};

export default config;
