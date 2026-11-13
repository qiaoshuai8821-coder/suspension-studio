import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-24 w-full rounded-lg border border-input bg-card px-3 py-2.5 text-base leading-6 text-foreground shadow-[0_1px_0_rgba(28,36,48,0.03)] transition-colors outline-none placeholder:text-muted-foreground/80 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-accent/35 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
