import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  root: 'frontend',
  plugins: [react(), tailwindcss()],
  test: { environment: 'jsdom' },
});
