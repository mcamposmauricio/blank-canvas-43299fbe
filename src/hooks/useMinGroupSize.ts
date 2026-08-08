import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

/**
 * Critério de anonimato configurado pela empresa (tenants.min_group_size).
 * Nunca use um número fixo na UI: enquanto `isLoaded` for false o valor real
 * ainda não chegou e o critério não deve ser exibido.
 */
export function useMinGroupSize() {
  const { tenantId } = useTenant();

  const { data, isLoading } = useQuery({
    queryKey: ["tenant_min_group_size", tenantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenants")
        .select("min_group_size")
        .eq("id", tenantId!)
        .single();
      if (error) throw error;
      return (data as any)?.min_group_size as number | null;
    },
    enabled: !!tenantId,
  });

  const minGroupSize = data ?? undefined;

  return {
    minGroupSize,
    isLoaded: minGroupSize !== undefined,
    isLoading,
  };
}
