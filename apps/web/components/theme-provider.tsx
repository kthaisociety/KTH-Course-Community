"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type * as React from "react";

/**
 * The one-time move of a saved theme preference onto the design's key.
 *
 * `next-themes` persists under `theme` by default and this app now asks it for
 * `cc:theme`, which is the key the artboards use. `next-themes` only ever reads
 * the key it is configured with, so without this a reader who had already
 * chosen dark would be handed their system theme instead, once, silently, and
 * would have to choose again.
 *
 * It is a string rather than a `useEffect` because of *when* it has to run.
 * `next-themes` writes the theme class from its own blocking script before
 * first paint, and that script has already decided by the time any React effect
 * runs — so migrating in an effect would still flash the wrong theme for a
 * frame. Rendering this before `NextThemesProvider` puts it earlier in the HTML
 * than that script, so the value is in place before anything reads it.
 *
 * It is deliberately conservative: it never overwrites an existing `cc:theme`,
 * it copies only the three values `next-themes` itself writes, and the whole
 * thing is inside a `try` because reading `localStorage` throws outright in
 * some privacy modes rather than returning null.
 */
export const THEME_KEY_MIGRATION = `(function(){try{var s=window.localStorage;if(s.getItem("cc:theme")!==null)return;var v=s.getItem("theme");if(v==="light"||v==="dark"||v==="system")s.setItem("cc:theme",v)}catch(e){}})()`;

export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return (
    <>
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: a fixed literal with no interpolation; it has to be inline to beat next-themes' own pre-paint script. */}
      <script dangerouslySetInnerHTML={{ __html: THEME_KEY_MIGRATION }} />
      <NextThemesProvider {...props}>{children}</NextThemesProvider>
    </>
  );
}
