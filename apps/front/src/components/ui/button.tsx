"use client";

import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva } from "class-variance-authority";
import type { VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

export const buttonVariants = cva(
  "relative inline-flex shrink-0 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-lg border font-medium text-base outline-none transition-shadow before:pointer-events-none before:absolute before:inset-0 before:rounded-[calc(var(--radius-lg)-1px)] focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-64 [&_svg:not([class*='opacity-'])]:opacity-80 [&_svg:not([class*='size-'])]:size-4.5 [&_svg]:pointer-events-none [&_svg]:-mx-0.5 [&_svg]:shrink-0",
  {
    defaultVariants: {
      size: "default",
      variant: "default",
    },
    variants: {
      size: {
        default: "h-9 px-[calc(--spacing(3)-1px)]",
        icon: "size-9",
        "icon-lg": "size-10",
        "icon-sm": "size-8",
        "icon-xl": "size-11 [&_svg:not([class*='size-'])]:size-5",
        "icon-xs":
          "size-7 rounded-md before:rounded-[calc(var(--radius-md)-1px)] [&_svg:not([class*='size-'])]:size-4",
        lg: "h-10 px-[calc(--spacing(3.5)-1px)]",
        sm: "h-8 gap-1.5 px-[calc(--spacing(2.5)-1px)]",
        xl: "h-11 px-[calc(--spacing(4)-1px)] text-lg [&_svg:not([class*='size-'])]:size-5",
        xs: "h-7 gap-1 rounded-md px-[calc(--spacing(2)-1px)] text-sm before:rounded-[calc(var(--radius-md)-1px)] [&_svg:not([class*='size-'])]:size-4",
      },
      variant: {
        default:
          "not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-primary bg-primary text-primary-foreground shadow-primary/24 shadow-xs hover:bg-primary/90 *:data-[slot=button-loading-indicator]:text-primary-foreground",
        destructive:
          "not-disabled:inset-shadow-[0_1px_--theme(--color-white/16%)] border-destructive bg-destructive text-white shadow-destructive/24 shadow-xs hover:bg-destructive/90 *:data-[slot=button-loading-indicator]:text-white",
        ghost:
          "border-transparent text-foreground hover:bg-accent data-pressed:bg-accent *:data-[slot=button-loading-indicator]:text-foreground",
        link: "border-transparent text-foreground underline-offset-4 hover:underline *:data-[slot=button-loading-indicator]:text-foreground",
        outline:
          "border-input bg-popover text-foreground shadow-xs/5 hover:bg-accent/50 *:data-[slot=button-loading-indicator]:text-foreground",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/90 *:data-[slot=button-loading-indicator]:text-secondary-foreground",
      },
    },
  }
);

export interface ButtonProps extends useRender.ComponentProps<"button"> {
  variant?: VariantProps<typeof buttonVariants>["variant"];
  size?: VariantProps<typeof buttonVariants>["size"];
}

export function Button({
  className,
  variant,
  size,
  render,
  children,
  disabled: disabledProp,
  ...props
}: ButtonProps): React.ReactElement {
  const typeValue: React.ButtonHTMLAttributes<HTMLButtonElement>["type"] =
    render ? undefined : "button";

  const defaultProps = {
    children,
    className: cn(buttonVariants({ className, size, variant })),
    disabled: disabledProp,
    type: typeValue,
  };

  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(defaultProps, props),
    render,
  });
}
