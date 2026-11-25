import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./AppShell";
import { apiRequest, ModeViolationError } from "../services/apiClient";
import { useAppStore } from "../store/useAppStore";

function renderAppShell() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <AppShell />
    </QueryClientProvider>,
  );
}

describe("TerraScope Mode State Machine & Command-Centre Shell", () => {
  beforeEach(() => {
    useAppStore.getState().setMode("GLOBAL");
    useAppStore.getState().setSelectedState(null);
    useAppStore.getState().setSelectedPlace(null);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          status: "ok",
          service: "TerraScope",
          version: "2.0.0",
          environment: "test",
          region_focus: "Telangana, India",
          capabilities: {
            google_server_key_configured: false,
            firms_key_configured: false,
            cesium_ion_configured: false,
          },
          supported_modes: [],
          datasets: [],
        }),
      }),
    );
  });

  it("switches GLOBAL -> INDIA -> TELANGANA and updates panels and layers", () => {
    renderAppShell();

    expect(screen.getByText("Global Place Inspector")).toBeInTheDocument();
    expect(screen.getByText("3D Buildings & Photorealistic Tiles")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mode-btn-india"));
    expect(screen.getByText("India Geographic Inspector")).toBeInTheDocument();
    expect(screen.getByText("India State Boundaries")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("mode-btn-telangana"));
    expect(screen.getByText("Telangana District Intelligence")).toBeInTheDocument();
    expect(screen.getByText("33 Telangana Districts")).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Flood" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Risk" })).toBeInTheDocument();
  });

  it("selecting Telangana in INDIA mode offers explicit switch button without auto-activating", async () => {
    renderAppShell();
    fireEvent.click(screen.getByTestId("mode-btn-india"));
    act(() => {
      useAppStore.getState().setSelectedState("Telangana");
    });

    expect(useAppStore.getState().mode).toBe("INDIA");
    const openBtn = await screen.findByRole("button", { name: /Open in Telangana mode/i });
    expect(openBtn).toBeInTheDocument();

    fireEvent.click(openBtn);
    expect(useAppStore.getState().mode).toBe("TELANGANA");
  });

  it("blocks Telangana-only API calls when app mode is GLOBAL or INDIA", async () => {
    await expect(
      apiRequest("/api/telangana/point-check", { mode: "GLOBAL", requireTelangana: true }),
    ).rejects.toBeInstanceOf(ModeViolationError);

    await expect(
      apiRequest("/api/telangana/point-check", { mode: "INDIA", requireTelangana: true }),
    ).rejects.toBeInstanceOf(ModeViolationError);
  });

  it("exposes live flights toggle across all modes with honest ADS-B notice", () => {
    renderAppShell();
    const flightsBtn = screen.getByTestId("toggle-flights-btn");
    expect(flightsBtn).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(/Community ADS-B data, coverage varies/i)).toBeInTheDocument();

    fireEvent.click(flightsBtn);
    expect(flightsBtn).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(screen.getByTestId("mode-btn-india"));
    fireEvent.click(flightsBtn);
    expect(flightsBtn).toHaveAttribute("aria-pressed", "true");
  });
});
