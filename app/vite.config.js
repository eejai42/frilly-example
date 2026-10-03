import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// The app talks straight to the rulebook API (CORS is open there). VITE_API_URL
// overrides the default for a deployed API.
export default defineConfig({ plugins: [react()], server: { port: 5173 } });
