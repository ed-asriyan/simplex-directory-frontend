import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        svelte(),
    ],
    publicDir: './static',
    // https://github.com/supabase-community/sql-to-rest/issues/2#issuecomment-2295227359
    optimizeDeps: {
      exclude: ['@supabase/sql-to-rest'],
    },
    assetsInclude: ['**/*.wasm'],
})
