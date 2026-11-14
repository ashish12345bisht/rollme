import { defineConfig } from "vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// `npm run phone` serves over HTTPS on your LAN: phones only expose the tilt sensor to secure pages.
export default defineConfig(({ mode }) => ({
  plugins: mode === "phone" ? [basicSsl()] : [],
  // Lets `tailscale serve` proxy the dev server with a real HTTPS certificate.
  server: { allowedHosts: [".ts.net"] },
}));
