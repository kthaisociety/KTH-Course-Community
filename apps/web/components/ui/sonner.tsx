"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          /*
            10px, because `Course Community - My Page.dc.html:415` draws the
            toast at `border-radius:10px`.

            It was `var(--radius)`, which is 0.625rem and therefore also 10px —
            so this changes nothing on screen and is not a fix. It is stated
            because the agreement was a coincidence: `--radius` is the base of
            the shadcn ramp and moves for reasons that have nothing to do with
            this component, and a value that is right by accident is one nobody
            knows to re-check.
          */
          "--border-radius": "10px",
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
