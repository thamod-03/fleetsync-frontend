
import path from "path"
import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig(({ command }) => ({
  define: {
    __FLEETSYNC_LOCAL_DEV__: JSON.stringify(command === 'serve' && process.env.VERCEL !== '1'),
    // Check platform-owned build variables, never their public VITE_* aliases.
    // Missing or contradictory deployment metadata fails closed.
    __FLEETSYNC_STAGING__: JSON.stringify(
      command === 'build'
      && process.env.VERCEL === '1'
      && process.env.VERCEL_ENV === 'preview'
      && process.env.VERCEL_TARGET_ENV === 'preview'
      && process.env.VITE_FLEETSYNC_STAGING === 'true',
    ),
  },
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}))
