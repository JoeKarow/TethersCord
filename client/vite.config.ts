// client/vite.config.ts

import { defineConfig } from "vite";
import elmPlugin from "vite-plugin-elm";

export default defineConfig({
  plugins: [elmPlugin()],
  build: {
    target: "esnext",
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
