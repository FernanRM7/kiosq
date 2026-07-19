"use client";

import NumberFlow from "@number-flow/react";
import { useMotionValueEvent, useSpring } from "motion/react";
import * as React from "react";
import {
  Bar,
  BarChart,
  Rectangle,
  ReferenceLine,
  Tooltip,
  XAxis,
} from "recharts";
import type { BarShapeProps, CartesianViewBox } from "recharts";

import type { ChartConfig } from "@/components/evilcharts/ui/chart";
import { ChartContainer } from "@/components/evilcharts/ui/chart";

const CHART_MARGIN = 38;

const chartData = [
  { desktop: 342, month: "January" },
  { desktop: 676, month: "February" },
  { desktop: 512, month: "March" },
  { desktop: 629, month: "April" },
  { desktop: 458, month: "May" },
  { desktop: 781, month: "June" },
  { desktop: 394, month: "July" },
  { desktop: 924, month: "August" },
  { desktop: 647, month: "September" },
  { desktop: 532, month: "October" },
  { desktop: 803, month: "November" },
  { desktop: 271, month: "December" },
  { desktop: 342, month: "January" },
  { desktop: 876, month: "February" },
  { desktop: 512, month: "March" },
  { desktop: 629, month: "April" },
];

const chartConfig = {
  desktop: {
    colors: {
      dark: ["#fafafa"],
      light: ["#18181b"],
    },
    label: "Desktop",
  },
} satisfies ChartConfig;

interface HoverTraceLabelProps {
  viewBox?: CartesianViewBox;
  value: number;
}

const HoverTraceLabel = ({ viewBox, value }: HoverTraceLabelProps) => {
  const x = viewBox?.x ?? 0;
  const y = viewBox?.y ?? 0;
  const formattedValue = value.toLocaleString();
  const width = formattedValue.length * 8 + 12;

  return (
    <>
      <rect
        x={x - CHART_MARGIN}
        y={y - 9}
        width={width}
        height={18}
        fill="var(--foreground)"
        rx={4}
      />
      <text
        className="font-mono text-[11px]"
        fontWeight={600}
        x={x - CHART_MARGIN + 7}
        y={y + 4}
        fill="var(--background)"
      >
        {formattedValue}
      </text>
      <ellipse cx="99.5%" cy={y} rx={3} ry={3} fill="var(--foreground)" />
    </>
  );
};

const HighlightedIndexContext = React.createContext<number>(0);

type HoverTraceBarShapeProps = BarShapeProps;

const HoverTraceBarShape = (props: HoverTraceBarShapeProps) => {
  const highlightedIndex = React.useContext(HighlightedIndexContext);
  const { x, y, width, height, fill, index, isActive } = props;

  const fillOpacity = isActive || index === highlightedIndex ? 1 : 0.2;

  return (
    <g>
      <Rectangle {...props} fill="transparent" pointerEvents="all" />
      <Rectangle
        x={x}
        y={y}
        width={width}
        height={height}
        radius={4}
        fill={fill}
        fillOpacity={fillOpacity}
        stroke={isActive ? "var(--foreground)" : undefined}
        strokeOpacity={isActive ? 0.35 : undefined}
        strokeWidth={isActive ? 1 : undefined}
        className="transition-opacity duration-200"
      />
    </g>
  );
};

export function EvilHoverTraceBarChart() {
  const [activeIndex, setActiveIndex] = React.useState<number | null>(null);

  const maxData = React.useMemo(() => {
    let maxValue = chartData[0].desktop;
    let maxIndex = 0;
    let maxMonth = chartData[0].month;

    for (let i = 1; i < chartData.length; i += 1) {
      if (chartData[i].desktop > maxValue) {
        maxValue = chartData[i].desktop;
        maxIndex = i;
        maxMonth = chartData[i].month;
      }
    }

    return { index: maxIndex, month: maxMonth, value: maxValue };
  }, []);

  const selectedData =
    activeIndex !== null && chartData[activeIndex]
      ? {
          index: activeIndex,
          month: chartData[activeIndex].month,
          value: chartData[activeIndex].desktop,
        }
      : maxData;

  const valueSpring = useSpring(selectedData.value, {
    damping: 20,
    stiffness: 110,
  });
  const [springValue, setSpringValue] = React.useState(selectedData.value);

  const handleBarHover = React.useCallback(
    (index: number) => {
      setActiveIndex(index);
      valueSpring.set(chartData[index]?.desktop ?? maxData.value);
    },
    [maxData.value, valueSpring]
  );

  useMotionValueEvent(valueSpring, "change", (latest) => {
    setSpringValue(Math.round(latest));
  });

  return (
    <div className="flex h-full flex-col p-4">
      <div className="mb-4 flex items-end justify-between">
        <div className="space-y-1">
          <p className="text-muted-foreground font-mono text-xs">
            [desktop] Value
          </p>
          <p className="text-primary font-mono text-3xl tracking-tighter">
            <NumberFlow
              value={selectedData.value}
              format={{
                currency: "USD",
                currencyDisplay: "narrowSymbol",
                style: "currency",
              }}
            />
          </p>
        </div>

        <div className="space-y-1 text-right">
          <p className="text-muted-foreground font-mono text-[10px]">
            [month]
          </p>
          <p className="text-primary font-mono text-xs">{selectedData.month}</p>
        </div>
      </div>

      <HighlightedIndexContext value={selectedData.index}>
        <ChartContainer config={chartConfig}>
          <BarChart
            accessibilityLayer
            data={chartData}
            margin={{ left: CHART_MARGIN }}
            onMouseMove={(state) => {
              if (state?.activeTooltipIndex !== undefined) {
                handleBarHover(Number(state.activeTooltipIndex));
              }
            }}
            onMouseLeave={() => {
              setActiveIndex(null);
              valueSpring.set(maxData.value);
            }}
          >
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
              tickFormatter={(value: string) => value.slice(0, 3)}
            />

            <Tooltip cursor={false} content={() => null} />

            <Bar
              dataKey="desktop"
              fill="var(--color-desktop-0)"
              radius={4}
              shape={HoverTraceBarShape}
              activeBar={HoverTraceBarShape}
            />

            <ReferenceLine
              y={springValue}
              stroke="var(--foreground)"
              strokeDasharray="3 3"
              label={<HoverTraceLabel value={selectedData.value} />}
            />
          </BarChart>
        </ChartContainer>
      </HighlightedIndexContext>
    </div>
  );
}
