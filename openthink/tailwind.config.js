/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      /* Semantic theme colors backed by CSS variables (see src/index.css). */
      colors: {
        base: 'rgb(var(--c-bg) / <alpha-value>)',
        panel: 'rgb(var(--c-panel) / <alpha-value>)',
        inset: 'rgb(var(--c-inset) / <alpha-value>)',
        raised: 'rgb(var(--c-raised) / <alpha-value>)',
        edge: 'rgb(var(--c-edge) / <alpha-value>)',
        strong: 'rgb(var(--c-text) / <alpha-value>)',
        muted: 'rgb(var(--c-muted) / <alpha-value>)',
        faint: 'rgb(var(--c-faint) / <alpha-value>)',
      },
    },
  },
  plugins: [],
}
