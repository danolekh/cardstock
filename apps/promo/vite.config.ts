import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The stage the recorder films: the docs' own components on the site's paper.
export default defineConfig({
  root: "stage",
  // The card artwork (/backgrounds/…), served locally so it works before the docs deploy.
  publicDir: "../../docs/public",
  server: { port: 4173, strictPort: true },
  plugins: [tailwindcss(), react()],
  // The registry files live in apps/docs and resolve their imports from there; keep one React.
  resolve: { dedupe: ["react", "react-dom", "@base-ui/react", "@danolekh/cardstock"] },
});
