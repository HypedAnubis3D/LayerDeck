import { defineConfig, loadEnv } from "vite";
import path from "path";

const rawPort = process.env.PORT || "5173";
const port = Number(rawPort);

const basePath = process.env.BASE_PATH || "/";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = env.SUPABASE_URL || process.env.SUPABASE_URL || "";
  const supabaseAnonKey = env.SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";

  const htmlEnvPlugin = {
    name: "html-env-inject",
    transformIndexHtml(html: string) {
      return html
        .replace(/__SUPABASE_URL__/g, JSON.stringify(supabaseUrl))
        .replace(/__SUPABASE_ANON_KEY__/g, JSON.stringify(supabaseAnonKey));
    },
  };

  return {
    base: basePath,
    plugins: [htmlEnvPlugin],
    root: path.resolve(import.meta.dirname),
    build: {
      outDir: path.resolve(import.meta.dirname, "dist/public"),
      emptyOutDir: true,
    },
    server: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
      fs: { strict: false },
      // no-store headers block bfcache — the browser can't save the page in memory
      // when the tab is backgrounded, causing a full reload on return.
      // Vite's own ETag-based caching is sufficient to prevent stale assets.
      hmr: {
        overlay: false,
      },
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
