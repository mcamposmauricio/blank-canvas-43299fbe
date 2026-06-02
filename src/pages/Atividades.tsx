import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Download, Package, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

type LogLine = { stage: string; pct: number; message: string; ts: string };

export default function Atividades() {
  const qc = useQueryClient();
  const [running, setRunning] = useState(false);
  const [pct, setPct] = useState(0);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);

  const { data: history } = useQuery({
    queryKey: ["platform_exports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("platform_exports")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  async function startExport() {
    setRunning(true);
    setPct(0);
    setLogs([]);
    setDownloadUrl(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Sessão expirada");

      const url = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.functions.supabase.co/full-system-export`;
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        throw new Error(text || `HTTP ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const evt = JSON.parse(line);
            if (evt.error) throw new Error(evt.error);
            if (evt.download_url) {
              setDownloadUrl(evt.download_url);
            } else {
              setPct(evt.pct ?? 0);
              setLogs((p) => [...p, { ...evt, ts: new Date().toISOString() }]);
            }
          } catch (e: any) {
            if (e.message && !e.message.startsWith("Unexpected")) throw e;
          }
        }
      }

      toast.success("Exportação concluída");
      qc.invalidateQueries({ queryKey: ["platform_exports"] });
    } catch (e: any) {
      toast.error(`Falha na exportação: ${e.message}`);
      setLogs((p) => [...p, { stage: "error", pct: 0, message: e.message, ts: new Date().toISOString() }]);
    } finally {
      setRunning(false);
    }
  }

  async function downloadHistorical(filePath: string) {
    const { data, error } = await supabase.storage
      .from("platform-exports")
      .createSignedUrl(filePath, 3600);
    if (error) {
      toast.error("Falha ao gerar link");
      return;
    }
    window.open(data.signedUrl, "_blank");
  }

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Atividades</h1>
        <p className="text-muted-foreground mt-1">Ferramentas de plataforma</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <CardTitle>Exportação Completa do Sistema</CardTitle>
              <CardDescription>
                Gera um pacote .zip com schema, dados, storage, edge functions, auth e
                instruções de reconstrução para IA.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <Button onClick={startExport} disabled={running} size="lg">
            {running ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Exportando...
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                Gerar pacote de exportação
              </>
            )}
          </Button>

          {(running || logs.length > 0) && (
            <div className="space-y-3">
              <Progress value={pct} />
              <div className="bg-muted rounded-md p-4 font-mono text-xs max-h-80 overflow-auto space-y-1">
                {logs.map((l, i) => (
                  <div key={i} className="flex gap-3">
                    <span className="text-muted-foreground shrink-0">[{l.pct.toString().padStart(3, " ")}%]</span>
                    <span className="text-accent shrink-0">{l.stage}</span>
                    <span className="text-foreground">{l.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {downloadUrl && (
            <Button asChild variant="default" size="lg">
              <a href={downloadUrl} target="_blank" rel="noreferrer">
                <Download className="h-4 w-4 mr-2" />
                Baixar arquivo .zip
              </a>
            </Button>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de exportações</CardTitle>
        </CardHeader>
        <CardContent>
          {!history?.length ? (
            <p className="text-sm text-muted-foreground">Nenhuma exportação ainda.</p>
          ) : (
            <div className="divide-y">
              {history.map((h: any) => (
                <div key={h.id} className="py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {formatDistanceToNow(new Date(h.created_at), { addSuffix: true, locale: ptBR })}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {h.status} · {h.file_size_bytes ? `${(h.file_size_bytes / 1024 / 1024).toFixed(2)} MB` : "—"}
                    </p>
                  </div>
                  {h.file_path && h.status === "completed" && (
                    <Button variant="outline" size="sm" onClick={() => downloadHistorical(h.file_path)}>
                      <Download className="h-4 w-4 mr-2" />
                      Baixar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}