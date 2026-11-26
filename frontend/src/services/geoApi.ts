import { apiRequest } from "./apiClient";
import type {
  AppMode,
  BoundaryPayload,
  IndiaDataset,
  SearchResponse,
  StreetViewStatusResponse,
} from "../types/terrascope";

export function searchPlaces(
  query: string,
  mode: AppMode,
  signal?: AbortSignal,
): Promise<SearchResponse> {
  const params = new URLSearchParams({ q: query, mode });
  return apiRequest<SearchResponse>(`/api/geo/search?${params.toString()}`, {
    mode,
    signal,
  });
}

export function fetchCountryBoundaries(
  mode: AppMode,
  signal?: AbortSignal,
): Promise<BoundaryPayload> {
  return apiRequest<BoundaryPayload>("/api/geo/boundaries/countries", { mode, signal });
}

export function fetchIndiaStateBoundaries(
  mode: AppMode,
  signal?: AbortSignal,
): Promise<BoundaryPayload> {
  return apiRequest<BoundaryPayload>("/api/geo/boundaries/india-states", { mode, signal });
}

export function fetchIndiaDatasets(
  mode: AppMode,
  signal?: AbortSignal,
): Promise<{ scope: string; analytics_enabled: boolean; datasets: IndiaDataset[] }> {
  return apiRequest("/api/geo/india-datasets", { mode, signal });
}

export function checkStreetViewStatus(
  lat: number,
  lon: number,
  mode: AppMode,
  signal?: AbortSignal,
): Promise<StreetViewStatusResponse> {
  const params = new URLSearchParams({ lat: String(lat), lon: String(lon) });
  return apiRequest<StreetViewStatusResponse>(`/api/geo/streetview/status?${params.toString()}`, {
    mode,
    signal,
  });
}
