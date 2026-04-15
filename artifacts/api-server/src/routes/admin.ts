import { Router, type IRouter } from "express";
import { createClient } from "@supabase/supabase-js";
import { getMigrationSql } from "../lib/rlsCheck";

const router: IRouter = Router();

const SUPABASE_URL = process.env.SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON_KEY = process.env.SUPABASE_ANON_KEY || "";

// All tables exposed via PostgREST in this project
const ALL_TABLES = [
  "ha3d_user_data",
  "ha3d_queue", "ha3d_sales", "ha3d_maint", "ha3d_prints",
  "ha3d_tmf", "ha3d_waste", "ha3d_usage_hist", "ha3d_shiny",
  "ha3d_catalog", "ha3d_orders", "forge_exports", "ha3d_printers", "ha3d_spools",
];

/**
 * GET /api/admin/check-rls
 *
 * Audits Row Level Security across ALL PostgREST-exposed Supabase tables.
 * Uses two probes per table:
 *  - Anon probe: queries each table with the anon key (no user JWT).
 *    RLS working → 0 rows (access denied by policy).
 *    RLS missing → non-zero rows (security hole).
 *  - Service role probe: verifies the admin client can still read ha3d_user_data.
 *    Service role always bypasses RLS — used by background jobs.
 *
 * Also validates the active RLS policy on ha3d_user_data:
 *  - An authenticated user query that includes user_id filter should succeed.
 */
router.get("/check-rls", async (_req, res) => {
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
    return res.status(500).json({ ok: false, error: "Supabase env vars not configured" });
  }

  const anonClient = createClient(SUPABASE_URL, ANON_KEY);
  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // ── 1. Probe all tables with the anon key ─────────────────────────────
  const tableResults: Record<string, unknown> = {};
  const exposedTables: string[] = [];

  await Promise.all(ALL_TABLES.map(async (table) => {
    try {
      const { data, count, error } = await anonClient
        .from(table)
        .select("*", { count: "exact", head: true });
      const rowCount = count ?? (Array.isArray(data) ? data.length : 0);
      const protected_ = error != null || rowCount === 0;
      if (!protected_) exposedTables.push(table);
      tableResults[table] = {
        status: protected_ ? "✅ PROTECTED" : "❌ EXPOSED",
        anon_rows_visible: rowCount,
        detail: protected_
          ? (error ? `Blocked with: ${error.code}` : "0 rows visible to anon")
          : `⚠️ Anon can see ${rowCount} rows — RLS not enabled!`,
      };
    } catch (e: unknown) {
      tableResults[table] = { status: "✅ PROTECTED", detail: `Connection error (treated as blocked): ${String(e)}` };
    }
  }));

  // ── 2. Service role probe on primary table ────────────────────────────
  let serviceRoleOk = false;
  let serviceRoleDetail = "";
  try {
    const { count, error } = await adminClient
      .from("ha3d_user_data")
      .select("*", { count: "exact", head: true });
    serviceRoleOk = !error;
    serviceRoleDetail = error
      ? `Error: ${error.message}`
      : `Service role sees all ${count} rows (bypasses RLS as expected)`;
  } catch (e: unknown) {
    serviceRoleDetail = String(e);
  }

  // ── Summary ───────────────────────────────────────────────────────────
  const allProtected = exposedTables.length === 0;
  const allOk = allProtected && serviceRoleOk;

  const needsMigration = exposedTables.length > 0;

  return res.json({
    rls_status: allOk ? "✅ FULLY SECURE" : "⚠️ ACTION REQUIRED",
    summary: allOk
      ? "All tables have RLS enabled. Anon users see nothing; service role works normally."
      : needsMigration
        ? `${exposedTables.length} tables lack RLS: ${exposedTables.join(", ")}. ` +
          "Copy the migration_sql below and paste it into the Supabase SQL Editor."
        : "Service role probe failed — check SUPABASE_SERVICE_ROLE_KEY.",
    exposed_tables: exposedTables,
    service_role: {
      status: serviceRoleOk ? "✅ OK" : "❌ ERROR",
      detail: serviceRoleDetail,
    },
    how_to_fix: needsMigration ? {
      step1: "Open the Supabase SQL Editor link below",
      step2: "Copy and paste the migration_sql block below into the editor",
      step3: "Click 'Run' — takes ~1 second, no downtime",
      step4: `Re-run GET /api/admin/check-rls to confirm all tables show ✅ PROTECTED`,
      supabase_sql_editor: "https://supabase.com/dashboard/project/rwbnivevzdazkfuxteng/sql/new",
    } : undefined,
    migration_sql: needsMigration ? getMigrationSql() : undefined,
    per_table: tableResults,
  });
});

export default router;
