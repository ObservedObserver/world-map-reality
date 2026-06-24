import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/tool/true-size-map/',
  // Emit native class fields (ES2022) instead of esbuild's __publicField helper.
  // MapLibre runs its GeoJSON source parser in a Worker created from a Blob; when
  // class fields are down-levelled to a hoisted helper, that helper is missing in
  // the worker scope and the source throws "__publicField is not defined".
  build: {
    target: 'es2022',
  },
  esbuild: {
    target: 'es2022',
  },
  optimizeDeps: {
    esbuildOptions: {
      target: 'es2022',
    },
  },
  ssr: {
    noExternal: ['react-helmet-async'],
  },
})
