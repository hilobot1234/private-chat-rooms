import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  // "./" works well on GitHub Pages without knowing the repo name
  base: "./"
});

