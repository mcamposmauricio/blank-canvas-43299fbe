import { createClient } from "npm:@supabase/supabase-js@2";

const ADMIN_TOKEN = "e64bf506d462ee17aef20b4f59dc47d4725266697b98ed3a";
const NEW_PASSWORD = "123456";

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

  const users: any[] = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    users.push(...data.users);
    if (data.users.length < 1000) break;
    page++;
  }

  const results = { total: users.length, updated: 0, errors: [] as any[] };
  for (const u of users) {
    const { error } = await supabase.auth.admin.updateUserById(u.id, { password: NEW_PASSWORD });
    if (error) results.errors.push({ id: u.id, email: u.email, error: error.message });
    else results.updated++;
  }

  const { error: profErr } = await supabase
    .from("profiles")
    .update({ must_change_password: true })
    .not("user_id", "is", null);
  if (profErr) results.errors.push({ profiles_update: profErr.message });

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
