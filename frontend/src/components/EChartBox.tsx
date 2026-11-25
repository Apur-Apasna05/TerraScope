import { useEffect, useRef } from "react";
import * as echarts from "echarts";

interface EChartBoxProps {
  option: echarts.EChartsOption;
  height?: number;
}

export function EChartBox({ option, height = 180 }: EChartBoxProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const instanceRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // Skip initialization in headless jsdom without canvas width
    if (typeof window === "undefined" || navigator.userAgent.includes("jsdom")) {
      return;
    }
    const chart = echarts.init(el);
    instanceRef.current = chart;
    chart.setOption(option);

    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el);

    return () => {
      ro.disconnect();
      chart.dispose();
      instanceRef.current = null;
    };
  }, [option]);

  return <div ref={ref} style={{ height }} className="w-full" />;
}
