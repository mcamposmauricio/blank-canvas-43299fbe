import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

const FALLBACK_MESSAGE = "Encontramos um erro. Contato o suporte.";

type SystemLockState = {
  isLocked: boolean;
  loading: boolean;
  message: string;
};

const SystemLockContext = createContext<SystemLockState>({
  isLocked: true,
  loading: true,
  message: FALLBACK_MESSAGE,
});

export function SystemLockProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SystemLockState>({
    isLocked: true,
    loading: true,
    message: FALLBACK_MESSAGE,
  });

  useEffect(() => {
    let active = true;

    const checkAvailability = async () => {
      const { data, error } = await supabase
        .from("system_settings")
        .select("is_locked, lock_message")
        .eq("id", "global")
        .maybeSingle();

      if (!active) return;

      if (error || !data) {
        setState({ isLocked: true, loading: false, message: FALLBACK_MESSAGE });
        return;
      }

      setState({
        isLocked: data.is_locked,
        loading: false,
        message: data.lock_message || FALLBACK_MESSAGE,
      });

      if (data.is_locked) {
        await supabase.auth.signOut();
      }
    };

    void checkAvailability();
    const interval = window.setInterval(checkAvailability, 10_000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  return <SystemLockContext.Provider value={state}>{children}</SystemLockContext.Provider>;
}

export function useSystemLock() {
  return useContext(SystemLockContext);
}