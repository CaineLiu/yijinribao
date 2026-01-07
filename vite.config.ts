import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  // 加载当前环境变量，第三个参数 '' 表示加载所有前缀的变量（不限于 VITE_）
  // Fix: Cast process to any to resolve "Property 'cwd' does not exist on type 'Process'" TypeScript error
  const env = loadEnv(mode, (process as any).cwd(), '');
  
  return {
    plugins: [react()],
    define: {
      // 强制将抓取到的 API_KEY 注入到代码中
      // Fix: Removed incorrect '.process' property access on process.env to resolve "Property 'env' does not exist on type 'string'"
      'process.env.API_KEY': JSON.stringify(env.API_KEY || process.env.API_KEY)
    },
    server: {
      host: '0.0.0.0',
      port: 3000
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      emptyOutDir: true
    }
  };
});
