import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  server: {
    port: 5000,
  },
  base: '/',
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
        banned: resolve(__dirname, 'banned.html'),
        assureur: resolve(__dirname, 'assureur.html'),
        assurance: resolve(__dirname, 'assurance.html'),
        partenaires: resolve(__dirname, 'partenaires.html'),
        cookies: resolve(__dirname, 'cookies.html'),
        cgv: resolve(__dirname, 'cgv.html'),
        mentions: resolve(__dirname, 'mentions-legales.html'),
        profile: resolve(__dirname, 'profile.html'),
        moderation: resolve(__dirname, 'moderation.html'),
        garage: resolve(__dirname, 'garage.html'),
        p404: resolve(__dirname, '404.html'),
        codeRoute: resolve(__dirname, 'code-de-la-route.html'),
        contratRoute: resolve(__dirname, 'contrat-de-route.html'),
        radarDanger: resolve(__dirname, 'radar-danger.html'),
        maProgression: resolve(__dirname, 'ma-progression.html')
      }
    }
  }
});
