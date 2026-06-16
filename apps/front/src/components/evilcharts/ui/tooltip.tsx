import * as React from "react";
import * as RechartsPrimitive from "recharts";
import type {
  NameType,
  ValueType,
} from "recharts/types/component/DefaultTooltipContent";

import {
  getPayloadConfigFromPayload,
  getColorsCount,
  useChart,
} from "@/components/evilcharts/ui/chart";
import type { ChartConfig } from "@/components/evilcharts/ui/chart";
import { cn } from "@/lib/utils";

type TooltipRoundness = "sm" | "md" | "lg" | "xl";
type TooltipVariant = "default" | "frosted-glass";

interface TooltipItemProps {
  item: {
    value?: ValueType;
    name?: NameType;
    dataKey?: string;
    type?: string;
    payload?: Record<string, unknown>;
  };
  index: number;
  nameKey?: string;
  indicator: "line" | "dot" | "dashed";
  hideIndicator: boolean;
  nestLabel: boolean;
  tooltipLabel: React.ReactNode;
  formatter?: (
    value: ValueType,
    name: NameType,
    item: unknown,
    index: number,
    payload: unknown
  ) => React.ReactNode;
  selected?: string | null;
  config: ChartConfig;
}

function TooltipIndicator({
  itemConfig,
  indicator,
  hideIndicator,
  nestLabel,
  key,
  colorsCount,
}: {
  itemConfig: ReturnType<typeof getPayloadConfigFromPayload>;
  indicator: "line" | "dot" | "dashed";
  hideIndicator: boolean;
  nestLabel: boolean;
  key: string;
  colorsCount: number;
}) {
  if (itemConfig?.icon) {
    return <itemConfig.icon />;
  }
  if (hideIndicator) {
    return null;
  }
  return (
    <div
      className={cn("shrink-0 rounded-[2px]", {
        "h-2.5 w-2.5": indicator === "dot",
        "my-0.5": nestLabel && indicator === "dashed",
        "w-0 border-[1.5px] border-dashed bg-transparent!":
          indicator === "dashed",
        "w-1": indicator === "line",
      })}
      style={getIndicatorColorStyle(key, colorsCount)}
    />
  );
}

function resolveTooltipItemKey(
  item: TooltipItemProps["item"],
  nameKey?: string
) {
  const payloadName =
    nameKey && item.payload
      ? (item.payload as Record<string, unknown>)[nameKey]
      : undefined;
  return `${payloadName ?? item.name ?? item.dataKey ?? "value"}`;
}

function TooltipItem({
  item,
  index,
  nameKey,
  indicator,
  hideIndicator,
  nestLabel,
  tooltipLabel,
  formatter,
  selected,
  config,
}: TooltipItemProps) {
  const key = resolveTooltipItemKey(item, nameKey);
  const itemConfig = getPayloadConfigFromPayload(config, item, key);
  const colorsCount = itemConfig ? getColorsCount(itemConfig) : 1;

  if (formatter && item?.value !== undefined && item.name) {
    return (
      <div
        className={cn(
          "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
          indicator === "dot" && "items-center",
          selected !== null && selected !== item.dataKey && "opacity-30"
        )}
      >
        {formatter(item.value, item.name, item, index, item.payload)}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:h-2.5 [&>svg]:w-2.5",
        indicator === "dot" && "items-center",
        selected !== null && selected !== item.dataKey && "opacity-30"
      )}
    >
      <TooltipIndicator
        itemConfig={itemConfig}
        indicator={indicator}
        hideIndicator={hideIndicator}
        nestLabel={nestLabel}
        key={key}
        colorsCount={colorsCount}
      />
      <div
        className={cn(
          "flex flex-1 justify-between gap-4 leading-none",
          nestLabel ? "items-end" : "items-center"
        )}
      >
        <div className="grid gap-1.5">
          {nestLabel ? tooltipLabel : null}
          <span className="text-muted-foreground">
            {itemConfig?.label ?? item.name}
          </span>
        </div>
        {item.value !== null && item.value !== undefined && (
          <span className="text-foreground font-mono font-medium tabular-nums">
            {typeof item.value === "number"
              ? item.value.toLocaleString()
              : String(item.value)}
          </span>
        )}
      </div>
    </div>
  );
}

function ChartTooltipContent({
  active,
  payload,
  className,
  indicator = "dot",
  hideLabel = false,
  hideIndicator = false,
  label,
  labelFormatter,
  labelClassName,
  formatter,
  nameKey,
  labelKey,
  selected,
  roundness = "lg",
  variant = "default",
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip> &
  React.ComponentProps<"div"> & {
    hideLabel?: boolean;
    hideIndicator?: boolean;
    indicator?: "line" | "dot" | "dashed";
    nameKey?: string;
    labelKey?: string;
    selected?: string | null;
    roundness?: TooltipRoundness;
    variant?: TooltipVariant;
  } & Omit<
    RechartsPrimitive.DefaultTooltipContentProps<ValueType, NameType>,
    "accessibilityLayer"
  >) {
  const { config } = useChart();

  const tooltipLabel = React.useMemo(() => {
    if (hideLabel || !payload?.length) {
      return null;
    }

    const [item] = payload;
    const key = `${labelKey ?? item?.dataKey ?? item?.name ?? "value"}`;
    const itemConfig = getPayloadConfigFromPayload(config, item, key);
    const value =
      !labelKey && typeof label === "string"
        ? (config[label]?.label ?? label)
        : itemConfig?.label;

    if (labelFormatter) {
      return (
        <div className={cn("font-medium", labelClassName)}>
          {labelFormatter(value, payload)}
        </div>
      );
    }

    if (!value) {
      return null;
    }

    return <div className={cn("font-medium", labelClassName)}>{value}</div>;
  }, [
    label,
    labelFormatter,
    payload,
    hideLabel,
    labelClassName,
    config,
    labelKey,
  ]);

  if (!active || !payload?.length) {
    return <span className="p-4" />;
  }

  const nestLabel = payload.length === 1 && indicator !== "dot";

  return (
    <div
      className={cn(
        "border-border/50 grid min-w-32 items-start gap-1.5 border px-2.5 py-1.5 text-xs shadow-xl",
        roundnessMap[roundness],
        variantMap[variant],
        className
      )}
    >
      {nestLabel ? null : tooltipLabel}
      <div className="grid gap-1.5">
        {payload
          .filter((item) => item.type !== "none")
          .map((item, index) => (
            <TooltipItem
              key={index}
              item={item}
              index={index}
              nameKey={nameKey}
              indicator={indicator}
              hideIndicator={hideIndicator}
              nestLabel={nestLabel}
              tooltipLabel={tooltipLabel}
              formatter={formatter}
              selected={selected}
              config={config}
            />
          ))}
      </div>
    </div>
  );
}

const ChartTooltip = ({
  animationDuration = 200,
  ...props
}: React.ComponentProps<typeof RechartsPrimitive.Tooltip>) => (
  <RechartsPrimitive.Tooltip animationDuration={animationDuration} {...props} />
);

export { ChartTooltip, ChartTooltipContent };
export type { TooltipRoundness, TooltipVariant };
