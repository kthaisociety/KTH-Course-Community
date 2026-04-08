import SuperTokens from "supertokens-node";
import Session from "supertokens-node/recipe/session";
import ThirdParty from "supertokens-node/recipe/thirdparty";

let inited = false;

export function ensureSuperTokensInit() {
  if (inited) {
    return;
  }
  inited = true;

  const apiDomain = process.env.NEXT_PUBLIC_BACKEND_DOMAIN;
  const websiteDomain = process.env.NEXT_PUBLIC_WEBSITE_DOMAIN;
  const connectionURI = process.env.ST_CONNECTION_URI;
  const apiKey = process.env.ST_API_KEY;

  if (!apiDomain || !websiteDomain || !connectionURI || !apiKey) {
    throw new Error(
      "Missing SuperTokens env vars: NEXT_PUBLIC_BACKEND_DOMAIN, NEXT_PUBLIC_WEBSITE_DOMAIN, ST_CONNECTION_URI, and ST_API_KEY must all be set",
    );
  }

  SuperTokens.init({
    appInfo: {
      appName: "CourseCompass",
      apiDomain,
      apiBasePath: "/auth",
      websiteDomain,
      websiteBasePath: "/auth",
    },
    supertokens: {
      connectionURI,
      apiKey,
    },
    recipeList: [ThirdParty.init({}), Session.init()],
  });
}
