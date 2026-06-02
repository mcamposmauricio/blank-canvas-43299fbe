import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-restore-token",
};

const RESTORE_TOKEN = Deno.env.get("RESTORE_TOKEN") ?? "";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const provided = req.headers.get("x-restore-token") ?? "";
    if (!RESTORE_TOKEN || provided !== RESTORE_TOKEN) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const op = body.op as string;

    if (op === "init") {
      // Create buckets (idempotent)
      const buckets = [
        { name: "logos", public: true },
        { name: "reports", public: false },
        { name: "platform-exports", public: false },
      ];
      const results: any[] = [];
      for (const b of buckets) {
        const { error } = await supabase.storage.createBucket(b.name, { public: b.public });
        results.push({ name: b.name, error: error?.message ?? null });
      }
      // Disable trigger to avoid duplicate profile/tenant inserts during user seed
      const { error: trErr } = await supabase.rpc("_restore_toggle_trigger", { enable: false }).catch(() => ({ error: null }));
      return json({ buckets: results, trigger_disabled: !trErr });
    }

    if (op === "trigger") {
      const enable = !!body.enable;
      const { error } = await supabase.rpc("_restore_toggle_trigger", { enable });
      return json({ ok: !error, error: error?.message });
    }

    if (op === "users") {
      const users = body.users as any[];
      const out: any[] = [];
      for (const u of users) {
        const { error } = await supabase.auth.admin.createUser({
          id: u.id,
          email: u.email,
          email_confirm: true,
          user_metadata: u.raw_user_meta_data ?? {},
          app_metadata: u.raw_app_meta_data ?? {},
        } as any);
        out.push({ id: u.id, email: u.email, error: error?.message ?? null });
      }
      return json({ users: out });
    }

    if (op === "rows") {
      const table = body.table as string;
      const rows = body.rows as any[];
      if (!rows?.length) return json({ table, inserted: 0 });
      const { error, count } = await supabase.from(table).upsert(rows, { onConflict: "id", count: "exact" });
      return json({ table, attempted: rows.length, inserted: count ?? rows.length, error: error?.message ?? null });
    }

    if (op === "counts") {
      const tables = body.tables as string[];
      const out: Record<string, number> = {};
      for (const t of tables) {
        const { count } = await supabase.from(t).select("*", { count: "exact", head: true });
        out[t] = count ?? 0;
      }
      return json({ counts: out });
    }

    return json({ error: "unknown op" }, 400);
  } catch (e) {
    return json({ error: String(e?.message ?? e) }, 500);
  }

  function json(obj: any, status = 200) {
    return new Response(JSON.stringify(obj), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
