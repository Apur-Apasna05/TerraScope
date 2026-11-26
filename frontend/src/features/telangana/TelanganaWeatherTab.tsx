import { useQuery } from "@tanstack/react-query";
import { EChartBox } from "../../components/EChartBox";
import { ProvenanceBadge } from "../../components/ProvenanceBadge";
import { fetchTelanganaWeather } from "../../services/telanganaApi";
import { useAppStore } from "../../store/useAppStore";

export function TelanganaWeatherTab() {
  const mode = useAppStore((s) => s.mode);
  const district = useAppStore((s) => s.selectedDistrict);

  const q = useQuery({
    queryKey: ["telangana", "weather", district],
    queryFn: ({ signal }) => fetchTelanganaWeather(mode, district, signal),
    enabled: mode === "TELANGANA",
  });

  if (q.isLoading) {
    return <p className="text-xs text-slate-400">Loading atmospheric observations...</p>;
  }

  const stations = q.data?.data.stations ?? [];
  const topRain = [...stations].sort((a, b) => b.rainfall_7d_mm - a.rainfall_7d_mm).slice(0, 8);

  return (
    <div className="space-y-3 text-xs">
      <div className="rounded-lg border border-ts-border bg-ts-surface/80 p-3">
        <h3 className="font-semibold text-slate-100">Environmental &amp; Weather Monitoring</h3>
        {q.data && (
          <div className="mt-2">
            <ProvenanceBadge
              kind={q.data.meta.kind}
              freshness={q.data.meta.freshness}
              source={q.data.meta.source}
              observedAt={q.data.meta.observed_at}
            />
          </div>
        )}

        {topRain.length > 0 && (
          <div className="mt-3">
            <EChartBox
              height={170}
              option={{
                backgroundColor: "transparent",
                tooltip: { trigger: "axis" },
                grid: { left: 10, right: 10, top: 15, bottom: 25, containLabel: true },
                xAxis: {
                  type: "category",
                  data: topRain.map((s) => s.district.slice(0, 10)),
                  axisLabel: { color: "#94a3b8", fontSize: 9, rotate: 20 },
                },
                yAxis: {
                  type: "value",
                  name: "mm",
                  nameTextStyle: { color: "#94a3b8", fontSize: 9 },
                  axisLabel: { color: "#94a3b8", fontSize: 9 },
                },
                series: [
                  {
                    name: "7-Day Rain (mm)",
                    type: "bar",
                    data: topRain.map((s) => s.rainfall_7d_mm),
                    itemStyle: { color: "#38BDF8" },
                  },
                ],
              }}
            />
          </div>
        )}
      </div>

      <div className="space-y-1.5">
        {stations.slice(0, 10).map((s) => (
          <div
            key={s.district}
            className="flex items-center justify-between rounded-lg border border-ts-border bg-ts-surface/70 px-3 py-2 text-[11px]"
          >
            <div>
              <p className="font-semibold text-slate-100">{s.district}</p>
              <p className="text-[10px] text-slate-400">
                Wind: {s.wind_speed_kmh} km/h @ {s.wind_direction_deg}°
              </p>
            </div>
            <div className="text-right font-mono">
              <p className="text-cyan-300">{s.rainfall_7d_mm} mm</p>
              <p className="text-[10px] text-slate-400">{s.temp_2m_c} °C</p>
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-ts-border bg-ts-surface/70 p-3">
        <h4 className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
          Sensor Specifications
        </h4>
        <ul className="mt-1.5 space-y-1 text-[10px] text-slate-300">
          {(q.data?.data.metadata_layers ?? []).map((m) => (
            <li key={m.name}>
              <strong>{m.name}:</strong> {m.unit} ({m.resolution}) · {m.source}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
