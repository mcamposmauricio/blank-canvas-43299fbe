import { useCallback, useEffect, useRef } from "react";
import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";

const STORAGE_KEY = "onboarding_tour_completed";

const defaultSteps: DriveStep[] = [
  {
    element: '[data-tour="sidebar"]',
    popover: {
      title: "Menu Principal",
      description: "Este é o menu principal. Aqui você acessa todas as áreas da plataforma.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-estrutura"]',
    popover: {
      title: "Estrutura Organizacional",
      description: "Gerencie seus departamentos e cargos.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-colaboradores"]',
    popover: {
      title: "Colaboradores",
      description: "Visualize e gerencie seus colaboradores.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-campanhas"]',
    popover: {
      title: "Campanhas",
      description: "Crie campanhas de avaliação psicossocial para enviar aos colaboradores.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-analises"]',
    popover: {
      title: "Análises",
      description: "Acompanhe os resultados e indicadores em tempo real.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-relatorios"]',
    popover: {
      title: "Relatórios",
      description: "Gere relatórios e laudos automaticamente.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-configuracoes"]',
    popover: {
      title: "Configurações",
      description: "Personalize a plataforma com a identidade da sua empresa.",
      side: "right",
      align: "start",
    },
  },
];

const emptyTenantSteps: DriveStep[] = [
  {
    element: '[data-tour="sidebar"]',
    popover: {
      title: "Bem-vindo à People Pulse! 🎉",
      description: "Vamos configurar sua empresa passo a passo. Siga este tour para começar.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-estrutura"]',
    popover: {
      title: "1️⃣ Crie sua Estrutura",
      description: "Comece criando sua primeira unidade organizacional e departamentos. Clique aqui quando o tour terminar.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-colaboradores"]',
    popover: {
      title: "2️⃣ Cadastre Colaboradores",
      description: "Depois de criar a estrutura, importe ou cadastre seus colaboradores aqui.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-campanhas"]',
    popover: {
      title: "3️⃣ Lance uma Campanha",
      description: "Com colaboradores cadastrados, crie sua primeira campanha de avaliação psicossocial.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-analises"]',
    popover: {
      title: "4️⃣ Acompanhe Resultados",
      description: "Após as respostas, acompanhe indicadores e identifique riscos em tempo real.",
      side: "right",
      align: "start",
    },
  },
  {
    element: '[data-tour="nav-configuracoes"]',
    popover: {
      title: "⚙️ Personalize",
      description: "Adicione o logo e as cores da sua empresa para personalizar a plataforma.",
      side: "right",
      align: "start",
    },
  },
];

export function useOnboardingTour(ready: boolean, isEmpty?: boolean) {
  const driverRef = useRef<ReturnType<typeof driver> | null>(null);

  const createDriver = useCallback((steps: DriveStep[]) => {
    return driver({
      showProgress: true,
      animate: true,
      overlayColor: "hsl(222 47% 11% / 0.75)",
      stagePadding: 6,
      stageRadius: 8,
      popoverClass: "onboarding-tour-popover",
      nextBtnText: "Próximo",
      prevBtnText: "Anterior",
      doneBtnText: "Concluir",
      progressText: "{{current}} de {{total}}",
      steps,
      onDestroyStarted: () => {
        if (driverRef.current?.isLastStep()) {
          localStorage.setItem(STORAGE_KEY, "true");
        }
        driverRef.current?.destroy();
      },
    });
  }, []);

  const startTour = useCallback(() => {
    const steps = isEmpty ? emptyTenantSteps : defaultSteps;
    const d = createDriver(steps);
    driverRef.current = d;
    d.drive();
  }, [createDriver, isEmpty]);

  useEffect(() => {
    if (!ready) return;
    const completed = localStorage.getItem(STORAGE_KEY);
    if (completed) return;

    const timeout = setTimeout(() => {
      startTour();
    }, 1000);

    return () => clearTimeout(timeout);
  }, [ready, startTour]);

  return { startTour };
}
