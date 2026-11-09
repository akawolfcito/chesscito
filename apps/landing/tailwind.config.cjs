/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        action: ["var(--font-rowdies)", "Rowdies", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};

module.exports = config;
