
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define: {
    // 确保即使环境变量缺失，也不会导致编译进程抛出 JSON.stringify(undefined) 错误
    'process.env.API_KEY': JSON.stringify(process.env.API_KEY || "")
  },
  server: {
    host: '0.0.0.0',
    port: 3000
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});