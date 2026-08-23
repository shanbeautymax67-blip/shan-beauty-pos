/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        plum: {
          DEFAULT: "rgb(var(--color-plum) / <alpha-value>)",
          light: "rgb(var(--color-plum-light) / <alpha-value>)",
          dark: "rgb(var(--color-plum-dark) / <alpha-value>)",
        },
        berry: {
          DEFAULT: "rgb(var(--color-berry) / <alpha-value>)",
          light: "rgb(var(--color-berry-light) / <alpha-value>)",
          dark: "rgb(var(--color-berry-dark) / <alpha-value>)",
        },
        ivory: "rgb(var(--color-ivory) / <alpha-value>)",
        ink: "rgb(var(--color-ink) / <alpha-value>)",
        gold: "rgb(var(--color-gold) / <alpha-value>)",
        blush: "rgb(var(--color-blush) / <alpha-value>)",
      },
      fontFamily: {
        display: ["Inter", "sans-serif"],
        body: ["Inter", "sans-serif"],
        mono: ["IBM Plex Mono", "monospace"],
      },
    },
  },
  plugins: [],
};
