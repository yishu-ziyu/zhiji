import * as React from "react";
import { cn } from "@/lib/utils";
function Textarea({ className, ...props }: React.ComponentProps<"textarea">) { return <textarea data-slot="textarea" className={cn("field-sizing-content flex min-h-[80px] w-full rounded-md border px-3 py-2 text-base transition-colors outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] focus-visible:outline-1 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 resize-none bg-card border-border text-foreground placeholder:text-muted-foreground", className)} {...props} />; }
export { Textarea };
