/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Matches Unique SPM's real site (uniquespm.com): deep navy + orange accent.
        brand: {
          50: "#eef0f8",
          100: "#dbdfef",
          200: "#b0b8de",
          300: "#8590cb",
          400: "#5561ac",
          500: "#374290",
          600: "#28316f",
          700: "#1e2559",
          800: "#181d3e",
          900: "#131a4a",
          950: "#0d1230",
        },
        accent: {
          50: "#fff4ea",
          100: "#ffe6cc",
          200: "#ffc999",
          300: "#ffa85c",
          400: "#ff8f30",
          500: "#ff8214",
          600: "#e6690a",
          700: "#bf5309",
          800: "#99420f",
        },
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
