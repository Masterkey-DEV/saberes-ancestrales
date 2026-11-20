// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  adapter: node({
    mode: 'standalone',
    // Limita el tamaño total del envío (formulario + archivos).
    bodySizeLimit: 45 * 1024 * 1024,
  }),
});
