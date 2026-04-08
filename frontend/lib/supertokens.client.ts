"use client";

import SuperTokens from "supertokens-auth-react";
import Session from "supertokens-auth-react/recipe/session";
import ThirdParty, { Google } from "supertokens-auth-react/recipe/thirdparty";

let inited = false;

export function initST() {
  // ⛔️ Don't init on the server
  if (typeof window === "undefined") return;

  if (inited) return;
  inited = true;

  const backendDomain = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;
  const websiteDomain = process.env.NEXT_PUBLIC_WEBSITE_DOMAIN;

  if (typeof backendDomain !== "string" || !backendDomain) {
    throw new Error("NEXT_PUBLIC_BACKEND_DOMAIN is not set");
  }
  if (typeof websiteDomain !== "string" || !websiteDomain) {
    throw new Error("NEXT_PUBLIC_WEBSITE_DOMAIN is not set");
  }

  SuperTokens.init({
    appInfo: {
      appName: "CourseCompass",
      apiDomain: backendDomain,
      apiBasePath: "/auth",
      websiteDomain: websiteDomain,
      websiteBasePath: "/auth",
    },
    recipeList: [
      Session.init(),
      ThirdParty.init({
        signInAndUpFeature: {
          providers: [Google.init()],
        },
      }),
    ],
  });
}
