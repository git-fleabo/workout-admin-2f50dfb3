import * as React from "react";

import { cn } from "@/lib/utils";
import { useFieldControl } from "./field-context";

const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, ...props }, ref) => {
    const fieldControl = useFieldControl(props);
    return (
      <textarea
        className={cn(
          "flex min-h-[60px] w-full rounded-lg border border-input bg-background/40 px-3 py-2 text-base shadow-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        {...props}
        {...fieldControl}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
