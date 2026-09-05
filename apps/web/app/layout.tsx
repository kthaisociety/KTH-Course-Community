// Other imports
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
// For authentication
import { Toaster } from "@/components/ui/sonner";
import { TRPCReactProvider } from "@/trpc/client";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Course Community",
  description: "Navigates KTH courses",
  icons: {
    icon: "/compass.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background`}
      >
        <TRPCReactProvider>
          {/*
            Three deliberate deviations from what the artboards do, each for a
            reason the artboards have no way to express.

            `attribute="class"`. The design drives the theme with a
            `data-cc-theme` attribute on the root element. This repo drives it
            with a `.dark` class, because Tailwind's
            `@custom-variant dark (&:is(.dark *))` in `globals.css` is defined
            against that class and every `dark:` utility in `components/ui/**`
            depends on it. Switching the mechanism would be a large blast radius
            for nothing a reader could see, so the class stays and only the
            storage and the wording follow the design.

            `defaultTheme="system"` with `enableSystem`, where the design
            defaults to light. `cc-store.js` reads `localStorage` with a `false`
            fallback because a static HTML mock has no way to ask the operating
            system anything — "default light" is that limitation, not a
            decision. Honouring `prefers-color-scheme` is a real accessibility
            win for a reader who has already told their OS they want dark, and
            for everyone else the OS default *is* light, so the artboard's first
            paint is what they get anyway. An explicit choice always wins over
            both.

            `storageKey="cc:theme"`. The design persists under that key and
            `next-themes` defaults to `"theme"`; matching costs nothing and
            keeps one name for one thing across the two. It does not cost a
            reader their existing choice either — `ThemeProvider` carries a
            one-time migration of the old key, which has to run before
            `next-themes`' own pre-paint script and so lives there rather than
            in an effect.

            `disableTransitionOnChange` is deliberately *not* set. It suppresses
            every transition for a frame while the class flips, which would kill
            the cross-fade the `cc-theme` utility exists to provide —
            `cc-theme.css` transitions `background-color`, `color` and
            `border-color` on the whole subtree for exactly this moment, and
            `AppShell` opts every route into it.
          */}
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            storageKey="cc:theme"
          >
            <Toaster />
            {children}
          </ThemeProvider>
        </TRPCReactProvider>
      </body>
    </html>
  );
}
