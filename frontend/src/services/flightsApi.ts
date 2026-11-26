import { apiRequest } from "./apiClient";
import type { AppMode, DataEnvelope, FlightFilters, FlightsPayload } from "../types/terrascope";

export interface FlightBbox {
  west: number;
  south: number;
  east: number;
  north: number;
}

export function fetchLiveFlights(
  mode: AppMode,
  bbox: FlightBbox,
  filters: FlightFilters,
  signal?: AbortSignal,
): Promise<DataEnvelope<FlightsPayload>> {
  const sp = new URLSearchParams({
    west: bbox.west.toFixed(3),
    south: bbox.south.toFixed(3),
    east: bbox.east.toFixed(3),
    north: bbox.north.toFixed(3),
  });
  if (filters.callsign.trim()) {
    sp.set("callsign", filters.callsign.trim());
  }
  if (filters.minAltM !== null) {
    sp.set("min_alt_m", String(filters.minAltM));
  }
  if (filters.onGroundOnly !== null) {
    sp.set("on_ground", String(filters.onGroundOnly));
  }

  // Flights are an exploration tool valid across all modes (no requireTelangana guard)
  return apiRequest<DataEnvelope<FlightsPayload>>(`/api/flights?${sp.toString()}`, {
    mode,
    signal,
  });
}
