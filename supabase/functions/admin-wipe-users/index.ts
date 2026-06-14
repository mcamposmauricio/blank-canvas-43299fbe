import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_TOKEN = "e64bf506d462ee17aef20b4f59dc47d4725266697b98ed3a";
const KEEP_USER_ID = "58b6321c-018b-4aa6-bf92-2aa373ed39a4";
const KEEP_EMAIL = "mcampos.mauricio@gmail.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-admin-token, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.headers.get("x-admin-token") !== ADMIN_TOKEN) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const log: any[] = [];
  const errors: any[] = [];

  // 1) Resolve Mauricio's tenant_id (the one to keep)
  const { data: keepProfile, error: keepErr } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", KEEP_USER_ID)
    .maybeSingle();

  if (keepErr) errors.push({ step: "load_keep_profile", error: keepErr.message });

  const keepTenantId: string | null = keepProfile?.tenant_id ?? null;
  log.push({ keepTenantId });

  // 2) List all auth.users and delete every one except KEEP_USER_ID
  const allUsers: any[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) { errors.push({ step: "list_users", error: error.message }); break; }
    allUsers.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }

  let deletedAuth = 0;
  for (const u of allUsers) {
    if (u.id === KEEP_USER_ID) continue;
    const { error } = await supabase.auth.admin.deleteUser(u.id);
    if (error) errors.push({ step: "delete_user", id: u.id, email: u.email, error: error.message });
    else deletedAuth++;
  }

  // 3) Clean tables that don't depend on tenant scope but reference users/profiles
  const purgeWhereNotKeep: { table: string; col: string }[] = [
    { table: "user_roles", col: "user_id" },
    { table: "profiles", col: "user_id" },
  ];
  for (const { table, col } of purgeWhereNotKeep) {
    const { error } = await supabase.from(table).delete().neq(col, KEEP_USER_ID);
    if (error) errors.push({ step: `purge_${table}`, error: error.message });
  }

  // 4) Tenant-scoped data: delete everything NOT belonging to the keep tenant.
  //    Order matters because of FK chains.
  const tenantScopedTables = [
    "survey_answers",
    "survey_invitations",
    "survey_responses",
    "response_scores",
    "group_scores",
    "campaign_scores",
    "risk_alerts",
    "action_plans",
    "reports",
    "platform_exports",
    "consent_records",
    "audit_logs",
    "survey_items",
    "survey_dimensions",
    "survey_campaigns",
    "survey_templates",
    "employees",
    "departments",
    "org_units",
    "job_roles",
  ];

  for (const table of tenantScopedTables) {
    let q = supabase.from(table).delete();
    if (keepTenantId) {
      q = q.neq("tenant_id", keepTenantId);
    } else {
      // No tenant to keep: wipe all
      q = q.not("tenant_id", "is", null);
    }
    const { error } = await q;
    if (error) errors.push({ step: `purge_${table}`, error: error.message });
  }

  // 5) Delete other tenants
  if (keepTenantId) {
    const { error } = await supabase.from("tenants").delete().neq("id", keepTenantId);
    if (error) errors.push({ step: "purge_tenants", error: error.message });
  }

  // 6) Ensure Mauricio's profile is clean and does NOT require password change
  await supabase
    .from("profiles")
    .update({ must_change_password: false, email: KEEP_EMAIL })
    .eq("user_id", KEEP_USER_ID);

  // 7) Ensure admin_rh role exists for Mauricio in his tenant
  if (keepTenantId) {
    const { data: existingRole } = await supabase
      .from("user_roles")
      .select("id")
      .eq("user_id", KEEP_USER_ID)
      .eq("tenant_id", keepTenantId)
      .eq("role", "admin_rh")
      .maybeSingle();
    if (!existingRole) {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: KEEP_USER_ID, tenant_id: keepTenantId, role: "admin_rh" });
      if (error) errors.push({ step: "ensure_role", error: error.message });
    }
  }

  return new Response(
    JSON.stringify({
      ok: errors.length === 0,
      deletedAuthUsers: deletedAuth,
      totalAuthUsersBefore: allUsers.length,
      keepUserId: KEEP_USER_ID,
      keepTenantId,
      log,
      errors,
    }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
