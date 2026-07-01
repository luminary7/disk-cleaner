import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 5173,
    strictPort: true,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes('node_modules/antd') || id.includes('node_modules/@ant-design')) return 'vendor-antd';
          if (id.includes('node_modules/echarts')) return 'vendor-echarts';
          if (id.includes('node_modules/three')) return 'vendor-three';
        },
      },
    },
  },
})
