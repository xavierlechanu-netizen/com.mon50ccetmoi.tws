import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  base: '/com.mon50ccetmoi.tws/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        app: resolve(__dirname, 'app.html'),
        login: resolve(__dirname, 'login.html'),
        marketplace: resolve(__dirname, 'marketplace.html'),
        insurance: resolve(__dirname, 'insurance.html'),
        watch: resolve(__dirname, 'watch.html'),
        admin: resolve(__dirname, 'admin.html'),
        privacy: resolve(__dirname, 'privacy.html'),
        terms: resolve(__dirname, 'terms.html'),
        offline: resolve(__dirname, 'offline.html'),
        beta: resolve(__dirname, 'beta.html'),
        banned: resolve(__dirname, 'banned.html')
      }
    }
  }
});
