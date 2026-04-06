import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // D3.js library
          'd3': ['d3'],
          // PDF export libraries
          'pdf-libs': ['jspdf', 'svg2pdf.js'],
          // Canvas/image libraries
          'canvas-libs': ['html2canvas'],
          // React and React DOM
          'react-vendor': ['react', 'react-dom'],
          // UI component libraries
          'ui-vendor': [
            '@radix-ui/react-label',
            '@radix-ui/react-popover',
            '@radix-ui/react-progress',
            '@radix-ui/react-select',
            '@radix-ui/react-separator',
            '@radix-ui/react-slot',
            '@radix-ui/react-tabs',
          ],
          // Utility libraries
          'utils': ['clsx', 'class-variance-authority', 'tailwind-merge']
        }
      }
    }
  }
});
