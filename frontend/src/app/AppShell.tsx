import { useQuery } from "@tanstack/react-query";
import { BottomPanel } from "../components/BottomPanel";
import { LeftPanel } from "../components/LeftPanel";
import { RightPanel } from "../components/RightPanel";
import { TopNav } from "../components/TopNav";
import { GlobeViewportShell } from "../features/globe/GlobeViewportShell";
import { fetchHealth } from "../services/apiClient";
import { useAppStore } from "../store/useAppStore";

export function AppShell() {
  const mode = useAppStore((s) => s.mode);

  const healthQuery = useQuery({
    queryKey: ["health"],
    queryFn: ({ signal }) => fetchHealth(mode, signal),
    retry: 1,
    staleTime: 30_000,
  });

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-ts-bg text-slate-100">
      <TopNav
        health={healthQuery.data}
        healthLoading={healthQuery.isLoading}
        healthError={healthQuery.isError}
      />

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <LeftPanel />
        <GlobeViewportShell />
        <RightPanel />
      </div>

      <BottomPanel health={healthQuery.data} />
    </div>
  );
}
