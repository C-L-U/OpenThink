// Import the plugins explicitly instead of using string names:
// Vite resolves string plugin names from its own module context, which fails
// under pnpm's strict (non-hoisted) node_modules layout.
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

export default {
  plugins: [tailwindcss(), autoprefixer()],
}
