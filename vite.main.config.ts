import { defineConfig } from 'vite';

// https://vitejs.dev/config
// node-pty ships a native .node binding — bundling it breaks the dynamic
// require() it uses to load that binding, so it must stay external and be
// resolved through Node's normal module resolution at runtime instead.
export default defineConfig({
  build: {
    rollupOptions: {
      external: ['node-pty'],
    },
  },
});
