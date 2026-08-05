// People Pulse Index (PPI) v1.1 — utilitários compartilhados

export const PPI_INSTRUMENT_NAME = "People Pulse Index (PPI)";
export const PPI_INSTRUMENT_VERSION = "1.1";
export const PPI_INDEX_LABEL = "IGP — Índice Geral Psicossocial";

// 8 dimensões oficiais do instrumento v1.1 (nome e ordem exatos)
export const PPI_DIMENSIONS = [
  "Demandas de Trabalho",
  "Autonomia e Controle",
  "Clareza e Organização do Trabalho",
  "Liderança e Justiça Organizacional",
  "Relações Sociais no Trabalho",
  "Reconhecimento, Sentido e Satisfação",
  "Trabalho e Vida Pessoal",
  "Sinais de Desgaste Relacionados ao Trabalho",
] as const;

export const PPI_DISCLAIMER =
  "Este instrumento avalia fatores organizacionais de risco psicossocial. Não constitui diagnóstico clínico individual.";

export type PpiRiskLevel = "low" | "attention" | "high";

export function classifyRisk(score: number): { level: PpiRiskLevel; label: string; description: string } {
  if (score <= 33) return { level: "low", label: "Baixo risco", description: "Condições adequadas" };
  if (score <= 66) return { level: "attention", label: "Atenção", description: "Necessita monitoramento" };
  return { level: "high", label: "Risco elevado", description: "Requer ação prioritária" };
}

export function getRiskColor(level: PpiRiskLevel): string {
  switch (level) {
    case "low": return "bg-success";
    case "attention": return "bg-warning";
    case "high": return "bg-destructive";
  }
}

export function getRiskBadgeClass(level: PpiRiskLevel): string {
  switch (level) {
    case "low": return "bg-success/10 text-success border-success/20";
    case "attention": return "bg-warning/10 text-warning border-warning/20";
    case "high": return "bg-destructive/10 text-destructive border-destructive/20";
  }
}

export function getScoreColorClass(score: number): string {
  const { level } = classifyRisk(score);
  return getRiskBadgeClass(level);
}

export function getBarColorClass(score: number): string {
  const { level } = classifyRisk(score);
  return getRiskColor(level);
}
