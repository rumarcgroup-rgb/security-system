/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50: "#EFF4FF",
          100: "#DDE8FF",
          500: "#1E5EFF",
          600: "#1B54E5",
          700: "#1543B7",
        },
      },
      boxShadow: {
        card: "0 10px 24px rgba(15, 23, 42, 0.08)",
      },
    },
  },
  plugins: [],
};
