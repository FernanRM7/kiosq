"use client";

import {
  EvilPieChart,
  Pie,
  Tooltip,
  Legend,
} from "@/components/evilcharts/charts/pie-chart";
import type { ChartConfig } from "@/components/evilcharts/ui/chart";

const data = [
  { browser: "chrome", visitors: 275 },
  { browser: "safari", visitors: 200 },
  { browser: "firefox", visitors: 187 },
  { browser: "edge", visitors: 173 },
  { browser: "other", visitors: 90 },
];

const chartConfig = {
  chrome: {
    colors: {
      dark: ["#bfdbfe", "#60a5fa", "#3b82f6", "#2563eb", "#1d4ed8"],
      light: ["#93c5fd", "#3b82f6", "#2563eb", "#1d4ed8", "#1e40af"],
    },
    label: "Chrome",
  },
  edge: {
    colors: {
      dark: ["#ddd6fe", "#a78bfa", "#8b5cf6", "#7c3aed", "#6d28d9"],
      light: ["#c4b5fd", "#8b5cf6", "#7c3aed", "#6d28d9", "#5b21b6"],
    },
    label: "Edge",
  },
  firefox: {
    colors: {
      dark: ["#fde68a", "#fbbf24", "#f59e0b", "#d97706", "#b45309"],
      light: ["#fcd34d", "#f59e0b", "#d97706", "#b45309", "#92400e"],
    },
    label: "Firefox",
  },
  other: {
    colors: {
      dark: ["#e5e7eb", "#d1d5db", "#9ca3af", "#6b7280", "#4b5563"],
      light: ["#d1d5db", "#9ca3af", "#6b7280", "#4b5563", "#374151"],
    },
    label: "Other",
  },
  safari: {
    colors: {
      dark: ["#a7f3d0", "#34d399", "#10b981", "#059669", "#047857"],
      light: ["#6ee7b7", "#10b981", "#059669", "#047857", "#065f46"],
    },
    label: "Safari",
  },
} satisfies ChartConfig;

export function EvilExamplePieChart() {
  return (
    <EvilPieChart
      className="h-full w-full p-4"
      data={data}
      dataKey="visitors"
      nameKey="browser"
      config={chartConfig}
    >
      <Legend isClickable />
      <Tooltip />
      <Pie isClickable />
    </EvilPieChart>
  );
}
