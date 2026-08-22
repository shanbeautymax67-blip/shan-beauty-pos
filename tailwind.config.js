/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        plum: {
          DEFAULT: "#2B1024",
          light: "#3E1836",
          dark: "#1B0A17",
        },
        berry: {
          DEFAULT: "#C6467A",
          light: "#E06B9C",
          dark: "#9E3661",
        },
        ivory: "#FBF6F2",
        ink: "#241B22",
        gold: "#C9A15A",
        blush: "#F3D9E4",
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
