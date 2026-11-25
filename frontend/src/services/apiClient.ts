import type { AppMode, HealthResponse } from "../types/terrascope";

function resolveApiBase(): string {
  const configured = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "";
  if (
    typeof window !== "undefined" &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") &&
    (window.location.port === "5173" || window.location.port === "4173")
  ) {
    // Use Vite's same-origin /api proxy in dev/preview to avoid cross-origin CORS preflight stalls
    return "";
  }
  return configured;
}

const API_BASE = resolveApiBase();

export class ModeViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ModeViolationError";
  }
}

export async function apiRequest<T>(
  path: string,
  options: {
    mode: AppMode;
    signal?: AbortSignal;
    requireTelangana?: boolean;
  },
): Promise<T> {
  if (options.requireTelangana && options.mode !== "TELANGANA") {
    throw new ModeViolationError(
      `Blocked request to ${path}: Telangana analytics are disabled in ${options.mode} mode.`,
    );
  }

  const url = path.startsWith("http") ? path : `${API_BASE}${path}`;
  const response = await fetch(url, {
    method: "GET",
    signal: options.signal,
    headers: {
      Accept: "application/json",
      "X-TerraScope-Mode": options.mode,
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text || response.statusText}`);
  }

  return (await response.json()) as T;
}

export function fetchHealth(mode: AppMode, signal?: AbortSignal): Promise<HealthResponse> {
  return apiRequest<HealthResponse>("/api/health", { mode, signal });
}
