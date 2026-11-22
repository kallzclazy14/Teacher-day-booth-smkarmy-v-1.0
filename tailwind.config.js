/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#000000',
        paper: '#FBF8EF',
        cream: '#EFE6D0',
      },
      fontFamily: {
        display: ['var(--font-marker)', 'cursive'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'ui-monospace', 'monospace'],
      },
      boxShadow: {
        hard: '5px 5px 0 0 #000',
        'hard-sm': '3px 3px 0 0 #000',
      },
    },
  },
  plugins: [],
};
