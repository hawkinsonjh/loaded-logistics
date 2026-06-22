import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Railway sets PORT at runtime; preview binds to it and allows the Railway domain.
export default defineConfig({
  plugins: [react()],
  server: { host: true, port: 5173 },
  preview: {
    host: true,
    port: Number(process.env.PORT) || 4173,
    allowedHosts: true,
  },
});
