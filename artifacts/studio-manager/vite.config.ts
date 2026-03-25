import { defineConfig, loadEnv } from "vite";
import path from "path";

const rawPort = process.env.PORT;

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

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
      hmr: false,
    },
    preview: {
      port,
      host: "0.0.0.0",
      allowedHosts: true,
    },
  };
});
