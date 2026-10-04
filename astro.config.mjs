// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';

export default defineConfig({
  // GitHub Pages project site: https://ayushyadav1783-cmd.github.io/Portfolio-AyushYadav/
  site: 'https://ayushyadav1783-cmd.github.io',
  base: '/Portfolio-AyushYadav',
  integrations: [react()],
  devToolbar: { enabled: false },
});
