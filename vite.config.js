import { defineConfig } from "vite";
import fs from "fs";
import path from "path";

export default defineConfig({
  base: "./",
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
  plugins: [
    {
      name: "copy-assets-folder",
      closeBundle() {
        const srcDir = path.resolve(__dirname, "assets");
        const destDir = path.resolve(__dirname, "dist/assets");
        if (fs.existsSync(srcDir)) {
          fs.cpSync(srcDir, destDir, { recursive: true, force: true });
          console.log("[vite-plugin] Copied assets folder to dist/assets");
        }
      },
    },
  ],
});
