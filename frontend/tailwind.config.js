/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: "#0a0f1a",
        card: "#111827",
        "card-border": "#1e293b",
        primary: "#f1f5f9",
        secondary: "#94a3b8",
        accent: {
          green: "#10b981",
          red: "#ef4444",
          blue: "#3b82f6",
          amber: "#f59e0b",
        },
      },
    },
  },
  plugins: [],
}
