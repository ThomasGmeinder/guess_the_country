import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/guess_the_country/',
  plugins: [react()],
})
