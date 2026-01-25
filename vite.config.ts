import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
    server: {
        port: 3000,
        host: '0.0.0.0',
        // Proxy API calls to Vercel functions in development
        proxy: {
            '/api': {
                target: 'http://localhost:3000',
                changeOrigin: true,
            },
        },
    },
    plugins: [react()],
    // No longer exposing API keys to the client
    // All API calls go through serverless functions
    resolve: {
        alias: {
            '@': path.resolve(__dirname, '.'),
        },
    },
});
