/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        accent: "#FF4D6D",
        dark: "var(--bg-base)",
        white: "var(--text-main)",
        slate: {
          950: "var(--bg-surface-deep)",
          900: "var(--bg-surface-deep)",
          800: "var(--bg-surface)",
          700: "var(--border-subtle)",
          600: "var(--bg-surface-hover)",
          500: "var(--text-muted)",
          400: "var(--text-muted)",
          300: "var(--text-muted)",
          200: "var(--text-muted)",
          100: "var(--text-main)",
          50: "var(--bg-surface-hover)",
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'Avenir', 'Helvetica', 'Arial', 'sans-serif'],
        serif: ['Playfair Display', 'serif'],
      }
    },
  },
  plugins: [],
}
