import { createClient } from "@supabase/supabase-js";
import { logger } from "./logger";
import * as fs from "fs";
import * as path from "path";

// All tables exposed via PostgREST — each should be RLS-protected
const ALL_TABLES = [
  "ha3d_user_data",
  "ha3d_queue", "ha3d_sales", "ha3d_maint", "ha3d_prints",
  "ha3d_tmf", "ha3d_waste", "ha3d_usage_hist", "ha3d_shiny",
  "ha3d_catalog", "ha3d_orders", "forge_exports", "ha3d_printers", "ha3d_spools",
];

/**
 * Reads the migration SQL from disk for display in the check-rls endpoint.
 */
export function getMigrationSql(): string {
  try {
    const migFile = path.resolve(
      process.cwd(),
      "../../supabase/migrations/20260415000000_enable_rls_all_tables.sql"
    );
    if (fs.existsSync(migFile)) return fs.readFileSync(migFile, "utf-8");
  } catch {}
  return "(migration file not found — check supabase/migrations/ in the project root)";
}

/**
 * Probes each table with the anon key to verify RLS is blocking unauthorized access.
 * Called at server startup and on demand via GET /api/admin/check-rls.
 */
export async function checkRlsOnStartup(): Promise<void> {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) return;

  const anonClient = createClient(url, anonKey);
  const exposed: string[] = [];

  await Promise.all(ALL_TABLES.map(async (table) => {
    try {
      const { count, error } = await anonClient
        .from(table)
        .select("*", { count: "exact", head: true });
      if (!error && (count ?? 0) > 0) exposed.push(table);
    } catch {}
  }));

  if (exposed.length === 0) {
    logger.info("✅ [RLS] All tables are protected — anon role has no access");
  } else {
    logger.warn(
      {
        exposedTables: exposed,
        migrationFile: "supabase/migrations/20260415000000_enable_rls_all_tables.sql",
        sqlEditorUrl: "https://supabase.com/dashboard/project/rwbnivevzdazkfuxteng/sql/new",
        action: "Paste the contents of the migration file into the Supabase SQL Editor and run it",
      },
      `⚠️  [RLS] SECURITY: ${exposed.length} tables have NO Row Level Security — ` +
      `anon users can read data from: ${exposed.join(", ")}. ` +
      "Apply supabase/migrations/20260415000000_enable_rls_all_tables.sql immediately."
    );
  }
}
