/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  theme: {
    extend: {
      colors: {
        'brand': '#1E64C8',
      },
      fontFamily: {
        'sans': ['Source Sans 3', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
