import { createClient } from "npm:@supabase/supabase-js@2";
import { BlobWriter, TextReader, Uint8ArrayReader, ZipWriter } from "https://deno.land/x/zipjs@v2.7.45/index.js";

const SUPER_ADMINS = [
  { email: "mauricio@marqponto.com.br", user_id: "302dc367-1b53-4a47-af5e-d54a6b877e59" },
  { email: "mcampos.mauricio@gmail.com", user_id: "58b6321c-018b-4aa6-bf92-2aa373ed39a4" },
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // --- AUTH gate (defesa em profundidade) ---
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });
  }
  const isAdmin = SUPER_ADMINS.some(
    (a) =>
      a.user_id === userData.user.id &&
      a.email === userData.user.email?.toLowerCase()
  );
  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });
  }

  const admin = createClient(SUPABASE_URL, SERVICE);

  // registrar export
  const { data: exp } = await admin
    .from("platform_exports")
    .insert({ created_by: userData.user.id, status: "running" })
    .select()
    .single();
  const exportId = exp?.id as string;

  // --- Streaming response ---
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder();
      const logs: any[] = [];
      const emit = (stage: string, pct: number, message: string) => {
        const evt = { stage, pct, message };
        logs.push(evt);
        controller.enqueue(enc.encode(JSON.stringify(evt) + "\n"));
      };
      const fail = async (err: string) => {
        controller.enqueue(enc.encode(JSON.stringify({ error: err }) + "\n"));
        await admin.from("platform_exports").update({ status: "failed", error: err, logs }).eq("id", exportId);
        controller.close();
      };

      try {
        const blobWriter = new BlobWriter("application/zip");
        const zip = new ZipWriter(blobWriter, { level: 6 });
        const addText = (path: string, content: string) =>
          zip.add(path, new TextReader(content));
        const addBytes = (path: string, bytes: Uint8Array) =>
          zip.add(path, new Uint8ArrayReader(bytes));

        emit("init", 2, "Iniciando exportação");

        // ---------- SCHEMA ----------
        emit("schema", 5, "Coletando schema");
        let knownTables: string[] = [];
        try {
          const { data: tblList, error: tblErr } = await admin.rpc("export_list_public_tables");
          if (tblErr) throw tblErr;
          knownTables = (tblList ?? []).map((r: any) => r.table_name);
          emit("schema", 6, `${knownTables.length} tabelas detectadas`);
        } catch (e: any) {
          emit("schema", 6, `Aviso: não foi possível listar tabelas dinamicamente (${e.message})`);
        }

        try {
          const { data: schemaDump, error: schemaErr } = await admin.rpc("export_dump_schema");
          if (schemaErr) throw schemaErr;
          await addText("schema/introspection.json", JSON.stringify(schemaDump, null, 2));
          emit("schema", 8, "Schema introspeccionado (enums, tabelas, policies, functions, triggers)");
        } catch (e: any) {
          emit("schema", 8, `Aviso: introspecção de schema falhou (${e.message})`);
        }

        await addText(
          "schema/README.md",
          "# Schema\n\n- `introspection.json` — dump completo via pg_catalog (enums, tabelas, RLS policies, functions, triggers).\n- `../migrations/` — histórico fiel de SQL para aplicar em ordem em um Supabase novo.\n",
        );

        // ---------- MIGRATIONS (lidas do bundle de deploy) ----------
        emit("migrations", 10, "Empacotando migrations");
        try {
          const migDir = new URL("../../migrations/", import.meta.url);
          for await (const f of Deno.readDir(migDir)) {
            if (f.isFile && f.name.endsWith(".sql")) {
              const txt = await Deno.readTextFile(new URL(f.name, migDir));
              await addText(`migrations/${f.name}`, txt);
            }
          }
        } catch (e) {
          emit("migrations", 10, `Aviso: migrations não acessíveis no runtime (${e})`);
        }

        // ---------- DADOS ----------
        emit("data", 15, "Exportando dados das tabelas");
        const counts: Record<string, number> = {};
        let i = 0;
        for (const t of knownTables) {
          i++;
          const pct = 15 + Math.round((i / knownTables.length) * 35);
          try {
            const { data, error } = await admin.from(t).select("*");
            if (error) {
              emit("data", pct, `${t}: erro ${error.message}`);
              await addText(`data/${t}.ndjson`, `# error: ${error.message}\n`);
              continue;
            }
            const ndjson = (data ?? []).map((r) => JSON.stringify(r)).join("\n");
            await addText(`data/${t}.ndjson`, ndjson);
            counts[t] = data?.length ?? 0;
            emit("data", pct, `${t}: ${counts[t]} linhas`);
          } catch (e: any) {
            emit("data", pct, `${t}: falha ${e.message}`);
          }
        }

        // ---------- STORAGE ----------
        emit("storage", 55, "Exportando storage");
        const { data: buckets } = await admin.storage.listBuckets();
        const bucketList = buckets ?? [];
        for (const b of bucketList) {
          if (b.id === "platform-exports") continue; // não incluir os próprios zips
          await addText(`storage/${b.id}/_bucket.json`, JSON.stringify(b, null, 2));
          // listar recursivamente
          const walk = async (prefix: string) => {
            const { data: items } = await admin.storage.from(b.id).list(prefix, { limit: 1000 });
            for (const item of items ?? []) {
              const full = prefix ? `${prefix}/${item.name}` : item.name;
              if (item.id === null) {
                await walk(full);
              } else {
                const { data: file } = await admin.storage.from(b.id).download(full);
                if (file) {
                  const buf = new Uint8Array(await file.arrayBuffer());
                  await addBytes(`storage/${b.id}/${full}`, buf);
                }
              }
            }
          };
          await walk("");
          emit("storage", 60, `bucket ${b.id} ok`);
        }

        // ---------- EDGE FUNCTIONS (snapshot do código do bundle) ----------
        emit("functions", 70, "Empacotando edge functions");
        try {
          const fnDir = new URL("../", import.meta.url);
          for await (const dir of Deno.readDir(fnDir)) {
            if (!dir.isDirectory) continue;
            try {
              const idx = new URL(`${dir.name}/index.ts`, fnDir);
              const code = await Deno.readTextFile(idx);
              await addText(`edge-functions/${dir.name}/index.ts`, code);
            } catch { /* skip */ }
          }
        } catch (e) {
          emit("functions", 70, `Aviso: edge functions não acessíveis (${e})`);
        }

        // ---------- AUTH ----------
        emit("auth", 80, "Exportando usuários do auth");
        try {
          const { data: users } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
          const safe = (users?.users ?? []).map((u) => ({
            id: u.id, email: u.email, phone: u.phone,
            email_confirmed_at: u.email_confirmed_at,
            created_at: u.created_at, last_sign_in_at: u.last_sign_in_at,
            user_metadata: u.user_metadata, app_metadata: u.app_metadata,
          }));
          await addText("auth/users.json", JSON.stringify(safe, null, 2));
          await addText("auth/README.md",
            "Senhas não podem ser exportadas. Após restaurar, cada usuário precisará redefinir a senha via fluxo de reset por email.\n");
        } catch (e: any) {
          emit("auth", 80, `Aviso auth: ${e.message}`);
        }

        // ---------- CONFIG ----------
        emit("config", 88, "Empacotando config");
        const secretNames = [
          "RESEND_API_KEY","LOVABLE_API_KEY","SUPABASE_URL","SUPABASE_ANON_KEY",
          "SUPABASE_SERVICE_ROLE_KEY","SUPABASE_DB_URL","SUPABASE_JWKS","SUPABASE_SECRET_KEYS",
          "SUPABASE_PUBLISHABLE_KEY","SUPABASE_PUBLISHABLE_KEYS",
        ];
        await addText("config/secret-names.json", JSON.stringify(secretNames, null, 2));
        await addText("config/notes.md",
          "Os valores dos secrets NÃO são exportados. Reconfigure cada nome listado em `secret-names.json` no novo ambiente.\n");

        // ---------- MANIFEST ----------
        const manifest = {
          generated_at: new Date().toISOString(),
          source_project_ref: SUPABASE_URL.match(/https:\/\/([^.]+)\./)?.[1],
          tables: counts,
          buckets: bucketList.map((b) => b.id),
          export_id: exportId,
        };
        await addText("manifest.json", JSON.stringify(manifest, null, 2));

        // ---------- README com prompt para IA ----------
        await addText("README.md", buildReadme(manifest));

        emit("zip", 92, "Compactando arquivo final");
        const blob = await zip.close();
        const bytes = new Uint8Array(await blob.arrayBuffer());

        // Upload
        emit("upload", 95, `Subindo .zip (${(bytes.length / 1024 / 1024).toFixed(2)} MB)`);
        const filePath = `exports/export-${new Date().toISOString().replace(/[:.]/g, "-")}.zip`;
        const { error: upErr } = await admin.storage
          .from("platform-exports")
          .upload(filePath, bytes, { contentType: "application/zip", upsert: false });
        if (upErr) {
          await fail(`Upload falhou: ${upErr.message}`);
          return;
        }

        const { data: signed } = await admin.storage
          .from("platform-exports")
          .createSignedUrl(filePath, 3600);

        await admin
          .from("platform_exports")
          .update({
            status: "completed",
            file_path: filePath,
            file_size_bytes: bytes.length,
            logs,
          })
          .eq("id", exportId);

        emit("done", 100, "Exportação concluída");
        controller.enqueue(
          enc.encode(JSON.stringify({ download_url: signed?.signedUrl, file_path: filePath }) + "\n"),
        );
        controller.close();
      } catch (e: any) {
        await fail(e.message || String(e));
      }
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "application/x-ndjson" },
  });
});

function buildReadme(manifest: any) {
  return `# Snapshot completo do sistema

Gerado em: ${manifest.generated_at}
Projeto fonte: ${manifest.source_project_ref}

Este pacote contém um snapshot completo do aplicativo (banco, storage, edge functions, auth e configuração).

## Conteúdo

- \`manifest.json\` — inventário do export.
- \`migrations/\` — todas as migrations SQL (DDL + RLS + functions + triggers + enums + grants).
- \`data/<tabela>.ndjson\` — dados de todas as tabelas \`public\`, uma linha JSON por registro.
- \`storage/<bucket>/\` — arquivos de todos os buckets (exceto o próprio bucket de exports).
- \`edge-functions/<nome>/index.ts\` — código-fonte das Edge Functions.
- \`auth/users.json\` — usuários do auth (sem senhas — Supabase não as expõe).
- \`config/secret-names.json\` — lista de nomes dos secrets que precisam ser reconfigurados.

## Prompt para IA reconstruir o sistema

Você está recebendo um snapshot completo de um aplicativo construído com Lovable + Supabase
(multi-tenant, RLS-based, com Edge Functions e Storage). Sua missão é recriar o sistema de
forma idêntica em um novo ambiente Supabase + Lovable. Siga rigorosamente os passos abaixo:

1. **Criar projeto novo** no Supabase e conectá-lo a um projeto Lovable novo (Lovable Cloud).
2. **Aplicar migrations**: execute todos os arquivos em \`migrations/\` em ordem alfabética
   (eles já estão nomeados com timestamps). Isso recria schemas, tabelas, enums, functions,
   triggers, RLS policies e GRANTs. Não pule nenhum.
3. **Importar dados**: para cada arquivo \`data/<tabela>.ndjson\`, faça insert em lote
   respeitando a ordem que evita violar foreign keys (carregue \`tenants\` antes de
   \`profiles\`, \`org_units\` antes de \`departments\`, etc.). Use \`service_role\` para
   contornar RLS durante o seed.
4. **Recriar buckets** listados em \`storage/<bucket>/_bucket.json\` com as mesmas flags
   \`public\`/privado, e faça upload de todos os arquivos sob \`storage/<bucket>/\`.
5. **Redeployar edge functions** em \`edge-functions/\`. Cada subpasta vira uma função com
   o mesmo nome. Mantenha \`verify_jwt = false\` para as funções que validam JWT internamente
   (ver \`supabase/config.toml\` original — replicar). Reconfigure todos os secrets listados
   em \`config/secret-names.json\` (valores devem ser obtidos do dono do sistema).
6. **Recriar usuários auth** a partir de \`auth/users.json\` usando \`auth.admin.createUser\`
   com \`email_confirm: true\`. Como senhas não são exportáveis, dispare um fluxo de reset
   por email para todos eles após a importação.
7. **Validar RLS** rodando smoke tests: login como admin_rh, gestor, diretoria e auditoria,
   conferindo que cada role enxerga apenas o que deve (ver código em \`edge-functions/\` e
   policies nas migrations).
8. **Preservar multi-tenant**: o sistema isola dados por \`tenant_id\`. Não modifique nenhum
   \`tenant_id\` nos dados importados — IDs são chaves estáveis.
9. **Preservar branding por tenant**: \`tenants.primary_color\`, \`secondary_color\`,
   \`logo_url\` devem ser mantidos.
10. **Frontend**: clone o repositório Lovable conectado no GitHub original e ajuste
    \`.env\` para apontar para o novo Supabase URL e ANON KEY. O arquivo
    \`src/integrations/supabase/types.ts\` será regenerado automaticamente pelo Lovable.
11. **Validar** \`manifest.json\` — confirme que a contagem de linhas em cada tabela bate
    com \`tables\` no manifest. Diferenças indicam falha de import.

O sistema é uma plataforma SaaS de avaliações psicossociais (NR-1/LGPD). Preserve todas as
regras de negócio, especialmente: anonimato com N>=7, scoring FPI v1.0, fluxo estrito de
plano de ação (Created → Started → Completed), e isolamento por tenant. Após restaurar,
o ambiente deve estar imediatamente funcional para os usuários originais (após reset de
senha).
`;
}