import { kevinschaichMap } from '@kevinschaich/components/map/vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Relative asset paths, so the build works at its own vercel.app URL and under kevinschaich.com/project/<slug>/.
export default defineConfig({
    base: './',
    plugins: [react(), tailwindcss(), kevinschaichMap()],
})
