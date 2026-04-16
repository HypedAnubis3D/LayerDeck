-- ============================================================
-- Persist server-side Tapo printer monitor config
-- So auto-off survives API server restarts
-- Applied: 2026-04-16
-- ============================================================

CREATE TABLE IF NOT EXISTS public.tapo_monitor_configs (
  hub_url          text        NOT NULL,
  printer_name     text        NOT NULL,
  device_id        text        NOT NULL,
  auto_off_enabled boolean     NOT NULL DEFAULT true,
  updated_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (hub_url, printer_name)
);

-- Only service_role (api-server) accesses this table — lock down all others.
ALTER TABLE public.tapo_monitor_configs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.tapo_monitor_configs FROM anon, authenticated;
