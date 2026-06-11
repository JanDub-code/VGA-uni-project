import { defineConfig } from 'vite'

function normalizeBasePath(basePath) {
  if (!basePath) return '/'
  if (basePath === '/') return '/'

  const withLeadingSlash = basePath.startsWith('/') ? basePath : `/${basePath}`
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`
}

export default defineConfig({
  base: normalizeBasePath(process.env.PAGES_BASE_PATH),
  optimizeDeps: {
    entries: ['index.html'],
  },
})
