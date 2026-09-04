import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Public portfolio build: intentionally frontend-only. Live collection and
// model credentials remain in the private working prototype.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
});
