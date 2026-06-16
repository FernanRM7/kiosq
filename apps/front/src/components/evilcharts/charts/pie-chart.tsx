"use client";

import { motion } from "motion/react";
import {
  Children,
  createContext,
  isValidElement,
  use,
  useCallback,
  useContext,
  useId,
  useMemo,
  useState,
} from "react";
import type { ComponentProps, FC, ReactElement, ReactNode } from "react";
import {
  LabelList as RechartsLabelList,
  Pie as RechartsPie,
  PieChart as RechartsPieChart,
  Sector,
} from "recharts";
import type { PieSectorShapeProps } from "recharts";

import { ChartBackground } from "@/components/evilcharts/ui/background";
import type { BackgroundVariant } from "@/components/evilcharts/ui/background";
import {
  ChartContainer,
  getColorsCount,
  LoadingIndicator,
} from "@/components/evilcharts/ui/chart";
import type { ChartConfig } from "@/components/evilcharts/ui/chart";
import {
  ChartLegend,
  ChartLegendContent,
} from "@/components/evilcharts/ui/legend";
import type { ChartLegendVariant } from "@/components/evilcharts/ui/legend";
import {
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/evilcharts/ui/tooltip";
import type {
  TooltipRoundness,
  TooltipVariant,
} from "@/components/evilcharts/ui/tooltip";

const LOADING_SECTORS = 5;
const LOADING_ANIMATION_DURATION = 2000;
const DEFAULT_INNER_RADIUS = 0;
const DEFAULT_OUTER_RADIUS = "80%";
const DEFAULT_CORNER_RADIUS = 0;
const DEFAULT_PADDING_ANGLE = 0;
const DEFAULT_START_ANGLE = 0;
const DEFAULT_END_ANGLE = 360;
const EMPTY_GLOWING_SECTORS: string[] = [];

type LabelListProps = ComponentProps<typeof RechartsLabelList>;

interface PieChartContextValue {
  config: ChartConfig;
  data: Record<string, unknown>[];
  dataKey: string;
  nameKey: string;
  isLoading: boolean;
  selectedSector: string | null;
  selectSector: (sectorName: string | null) => void;
}

const PieChartContext = createContext<PieChartContextValue | null>(null);

function usePieChart() {
  const context = use(PieChartContext);

  if (!context) {
    throw new Error(
      "Pie chart parts (<Pie />, <Tooltip />, …) must be used within <EvilPieChart />"
    );
  }

  return context;
}

interface LabelProps {
  dataKey?: string;
  labelListProps?: Omit<LabelListProps, "dataKey">;
}

export const Label: FC<LabelProps> = () => null;

interface EvilPieChartProps<TData extends Record<string, unknown>> {
  config: ChartConfig;
  data: TData[];
  dataKey: keyof TData & string;
  nameKey: keyof TData & string;
  children: ReactNode;
  className?: string;
  chartProps?: ComponentProps<typeof RechartsPieChart>;
  defaultSelectedSector?: string | null;
  onSelectionChange?: (
    selection: { dataKey: string; value: number } | null
  ) => void;
  isLoading?: boolean;
}

export function EvilPieChart<TData extends Record<string, unknown>>({
  config,
  data,
  dataKey,
  nameKey,
  children,
  className,
  chartProps,
  defaultSelectedSector = null,
  onSelectionChange,
  isLoading = false,
}: EvilPieChartProps<TData>) {
  const [selectedSector, setSelectedSector] = useState<string | null>(
    defaultSelectedSector
  );

  const selectSector = useCallback(
    (sectorName: string | null) => {
      setSelectedSector(sectorName);

      if (sectorName === null) {
        onSelectionChange?.(null);
        return;
      }

      const selectedItem = data.find(
        (item) => (item[nameKey] as string) === sectorName
      );

      if (selectedItem) {
        onSelectionChange?.({
          dataKey: sectorName,
          value: selectedItem[dataKey] as number,
        });
      }
    },
    [data, dataKey, nameKey, onSelectionChange]
  );

  const contextValue = useMemo<PieChartContextValue>(
    () => ({
      config,
      data,
      dataKey,
      isLoading,
      nameKey,
      selectSector,
      selectedSector,
    }),
    [config, data, dataKey, nameKey, isLoading, selectedSector, selectSector]
  );

  return (
    <PieChartContext value={contextValue}>
      <ChartContainer className={className} config={config}>
        <LoadingIndicator isLoading={isLoading} />
        <RechartsPieChart
          id="evil-charts-pie-chart"
          accessibilityLayer
          {...chartProps}
        >
          {children}
        </RechartsPieChart>
      </ChartContainer>
    </PieChartContext>
  );
}

const resolveLabel = (children: ReactNode, valueKey: string): ReactNode => {
  let label: ReactNode = null;

  Children.forEach(children, (child) => {
    if (!isValidElement(child) || child.type !== Label) {
      return;
    }

    const { dataKey, labelListProps } = (child as ReactElement<LabelProps>)
      .props;

    label = (
      <RechartsLabelList
        dataKey={dataKey ?? valueKey}
        stroke="none"
        fontSize={12}
        fontWeight={500}
        fill="currentColor"
        className="fill-background"
        {...labelListProps}
      />
    );
  });

  return label;
};

const LOADING_PIE_DATA = Array.from({ length: LOADING_SECTORS }, (_, i) => ({
  name: `loading${i}`,
  value: 100 / LOADING_SECTORS,
}));

const AnimatedLoadingSector = (
  props: ComponentProps<typeof Sector> & { index?: number }
) => {
  const { index = 0, ...sectorProps } = props;
  const delay = (index / LOADING_SECTORS) * (LOADING_ANIMATION_DURATION / 1000);

  return (
    <motion.g
      initial={{ opacity: 0.15 }}
      animate={{ opacity: [0.15, 0.5, 0.15] }}
      transition={{
        delay,
        duration: LOADING_ANIMATION_DURATION / 1000,
        ease: "easeInOut",
        repeat: Infinity,
      }}
    >
      <Sector {...sectorProps} fill="currentColor" />
    </motion.g>
  );
};

type PieVariant = "gradient";

interface RadialColorGradientProps {
  id: string;
  config: ChartConfig;
  variant: PieVariant;
}

const RadialColorGradient = ({ id, config }: RadialColorGradientProps) => (
  <>
    {Object.entries(config).map(([sectorKey, sectorConfig]) => {
      const colorsCount = getColorsCount(sectorConfig);

      return (
        <linearGradient
          key={`${id}-colors-${sectorKey}`}
          id={`${id}-colors-${sectorKey}`}
          x1="0"
          y1="0"
          x2="1"
          y2="1"
        >
          {colorsCount === 1 ? (
            <>
              <stop offset="0%" stopColor={`var(--color-${sectorKey}-0)`} />
              <stop offset="100%" stopColor={`var(--color-${sectorKey}-0)`} />
            </>
          ) : (
            Array.from({ length: colorsCount }, (_, index) => {
              const offset = `${(index / (colorsCount - 1)) * 100}%`;
              return (
                <stop
                  key={offset}
                  offset={offset}
                  stopColor={`var(--color-${sectorKey}-${index}, var(--color-${sectorKey}-0))`}
                />
              );
            })
          )}
        </linearGradient>
      );
    })}
  </>
);

interface GlowFilterProps {
  id: string;
  glowingSectors: string[];
}

const GlowFilter = ({ id, glowingSectors }: GlowFilterProps) => (
  <>
    {glowingSectors.map((sectorName) => (
      <filter
        key={`${id}-glow-${sectorName}`}
        id={`${id}-glow-${sectorName}`}
        x="-100%"
        y="-100%"
        width="300%"
        height="300%"
      >
        <feGaussianBlur in="SourceGraphic" stdDeviation="8" result="blur" />
        <feColorMatrix
          in="blur"
          type="matrix"
          values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 0.5 0"
          result="glow"
        />
        <feMerge>
          <feMergeNode in="glow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
      </filter>
    ))}
  </>
);

interface PieShapeContextValue {
  id: string;
  data: Record<string, unknown>[];
  nameKey: string;
  isClickable: boolean;
  selectedSector: string | null;
  glowingSectors: string[];
  paddingAngle: number;
}

const PieShapeContext = createContext<PieShapeContextValue | null>(null);

function PieSectorShape(props: PieSectorShapeProps) {
  const ctx = useContext(PieShapeContext);
  if (!ctx) {
    return <Sector {...props} />;
  }

  const sectorName = ctx.data[props.index ?? 0]?.[ctx.nameKey] as string;
  const isGlowing = ctx.glowingSectors.includes(sectorName);
  const isDimmed =
    ctx.isClickable &&
    ctx.selectedSector !== null &&
    ctx.selectedSector !== sectorName;

  return (
    <Sector
      {...props}
      fill={`url(#${ctx.id}-colors-${sectorName})`}
      filter={isGlowing ? `url(#${ctx.id}-glow-${sectorName})` : undefined}
      stroke={ctx.paddingAngle < 0 ? "var(--background)" : "none"}
      strokeWidth={ctx.paddingAngle < 0 ? 5 : 0}
      opacity={isDimmed ? 0.3 : 1}
      className="transition-opacity duration-200"
    />
  );
}

interface PieProps {
  variant?: PieVariant;
  innerRadius?: number | string;
  outerRadius?: number | string;
  cornerRadius?: number;
  paddingAngle?: number;
  startAngle?: number;
  endAngle?: number;
  isClickable?: boolean;
  glowingSectors?: string[];
  children?: ReactNode;
  pieProps?: Omit<
    ComponentProps<typeof RechartsPie>,
    "data" | "dataKey" | "nameKey"
  >;
}

export function Pie({
  variant = "gradient",
  innerRadius = DEFAULT_INNER_RADIUS,
  outerRadius = DEFAULT_OUTER_RADIUS,
  cornerRadius = DEFAULT_CORNER_RADIUS,
  paddingAngle = DEFAULT_PADDING_ANGLE,
  startAngle = DEFAULT_START_ANGLE,
  endAngle = DEFAULT_END_ANGLE,
  isClickable = false,
  glowingSectors = EMPTY_GLOWING_SECTORS,
  children,
  pieProps,
}: PieProps) {
  const {
    config,
    data,
    dataKey,
    nameKey,
    isLoading,
    selectedSector,
    selectSector,
  } = usePieChart();
  const id = useId().replaceAll(":", "");

  if (isLoading) {
    return (
      <RechartsPie
        data={LOADING_PIE_DATA}
        dataKey="value"
        nameKey="name"
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        cornerRadius={cornerRadius}
        paddingAngle={paddingAngle}
        startAngle={startAngle}
        endAngle={endAngle}
        strokeWidth={0}
        isAnimationActive={false}
        shape={AnimatedLoadingSector}
      />
    );
  }

  const label = resolveLabel(children, dataKey);

  const preparedData = data.map((item) => ({
    ...item,
    fill: `url(#${id}-colors-${item[nameKey] as string})`,
  }));

  const shapeContextValue = useMemo<PieShapeContextValue>(
    () => ({
      data,
      glowingSectors,
      id,
      isClickable,
      nameKey,
      paddingAngle,
      selectedSector,
    }),
    [
      id,
      data,
      nameKey,
      isClickable,
      selectedSector,
      glowingSectors,
      paddingAngle,
    ]
  );

  return (
    <>
      <PieShapeContext value={shapeContextValue}>
        <RechartsPie
          data={preparedData}
          dataKey={dataKey}
          nameKey={nameKey}
          innerRadius={innerRadius}
          outerRadius={outerRadius}
          cornerRadius={cornerRadius}
          paddingAngle={paddingAngle}
          startAngle={startAngle}
          endAngle={endAngle}
          strokeWidth={0}
          isAnimationActive
          style={isClickable ? { cursor: "pointer" } : undefined}
          onClick={(_, index) => {
            if (!isClickable) {
              return;
            }
            const clickedName = data[index]?.[nameKey] as string;
            selectSector(selectedSector === clickedName ? null : clickedName);
          }}
          shape={PieSectorShape}
          {...pieProps}
        >
          {label}
        </RechartsPie>
      </PieShapeContext>
      <defs>
        <RadialColorGradient id={id} config={config} variant={variant} />
        {glowingSectors.length > 0 && (
          <GlowFilter id={id} glowingSectors={glowingSectors} />
        )}
      </defs>
    </>
  );
}

interface TooltipProps {
  variant?: TooltipVariant;
  roundness?: TooltipRoundness;
  defaultIndex?: number;
}

export function Tooltip({ variant, roundness, defaultIndex }: TooltipProps) {
  const { isLoading, nameKey } = usePieChart();

  if (isLoading) {
    return null;
  }

  return (
    <ChartTooltip
      defaultIndex={defaultIndex}
      content={
        <ChartTooltipContent
          nameKey={nameKey}
          hideLabel
          roundness={roundness}
          variant={variant}
        />
      }
    />
  );
}

interface LegendProps {
  variant?: ChartLegendVariant;
  align?: "left" | "center" | "right";
  verticalAlign?: "top" | "middle" | "bottom";
  isClickable?: boolean;
}

export function Legend({
  variant,
  align = "center",
  verticalAlign = "bottom",
  isClickable = false,
}: LegendProps) {
  const { nameKey, selectedSector, selectSector } = usePieChart();

  return (
    <ChartLegend
      verticalAlign={verticalAlign}
      align={align}
      content={
        <ChartLegendContent
          selected={selectedSector}
          onSelectChange={selectSector}
          isClickable={isClickable}
          nameKey={nameKey}
          variant={variant}
        />
      }
    />
  );
}

interface BackgroundProps {
  variant?: BackgroundVariant;
}

export function Background({ variant = "dots" }: BackgroundProps) {
  return <ChartBackground variant={variant} />;
}
