-- ============================================================
-- Enable Row Level Security on all public tables
-- LayerDeck / HypedAnubis3D Studio Manager
-- Applied: 2026-04-15
-- ============================================================

-- ── ha3d_user_data (primary cloud sync table) ──────────────
-- This is the only table actively used by the client apps.
-- Authenticated users may only access their own rows.
-- The service_role (api-server) bypasses RLS automatically.
ALTER TABLE public.ha3d_user_data ENABLE ROW LEVEL SECURITY;

-- Drop any pre-existing policies to avoid conflicts
DROP POLICY IF EXISTS "users_own_rows"       ON public.ha3d_user_data;
DROP POLICY IF EXISTS "authenticated_rw"     ON public.ha3d_user_data;
DROP POLICY IF EXISTS "anon_deny"            ON public.ha3d_user_data;

-- Authenticated users: full CRUD on their own rows only
CREATE POLICY "authenticated_rw"
  ON public.ha3d_user_data
  FOR ALL
  TO authenticated
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- No policy for anon → anon role gets NO access at all (default deny)

-- ── Legacy tables (not used by client code — lock them down) ──
-- Enable RLS with no permissive policies → only service_role can access.
ALTER TABLE public.ha3d_queue       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ha3d_sales       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ha3d_maint       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ha3d_prints      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ha3d_tmf         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ha3d_waste       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ha3d_usage_hist  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ha3d_shiny       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ha3d_catalog     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ha3d_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.forge_exports    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ha3d_printers    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ha3d_spools      ENABLE ROW LEVEL SECURITY;

-- No permissive policies for these tables → service_role bypasses RLS,
-- but authenticated and anon users are denied entirely (default deny).
