import { Upload } from "lucide-react";

import { cn } from "@/lib/utils";

function Empty({
  className,
  icon: Icon = Upload,
  title = "Upload file",
  description = "Drag & drop or click to upload",
  ...props
}: React.ComponentProps<"div"> & {
  icon?: React.ComponentType<{ className?: string }>;
  title?: string;
  description?: string;
}) {
  return (
    <div
      data-slot="empty"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-muted-foreground/25 bg-muted/30 p-8 text-center transition-colors hover:border-muted-foreground/40",
        className
      )}
      {...props}
    >
      <div className="rounded-full bg-muted p-3">
        <Icon className="size-6 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-medium text-sm">{title}</p>
        <p className="text-muted-foreground text-xs">{description}</p>
      </div>
    </div>
  );
}

export { Empty };
