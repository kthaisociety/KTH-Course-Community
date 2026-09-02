import { neon } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/neon-http";
import { getCorsOrigins } from "../cors";
import * as schema from "../db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const db = drizzle({ client: neon(url) });

// The API and the frontend are separate origins in production, so the session
// cookie is cross-site and needs SameSite=None; Secure. In development both
// sit on localhost (same site, differing ports only), where Lax still works
// and Secure would stop the cookie being set over plain http.
const isProduction = process.env.NODE_ENV === "production";

// baseURL comes from BETTER_AUTH_URL, which is deliberately the *site* origin,
// not this API's. Auth traffic reaches us through the Next rewrite, so the OAuth
// callback and its Set-Cookie land on the host the browser actually talks to.
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true, // for schema generation, e.g. names table "users" instead of "user"
    transaction: false, // neon-http has no interactive transactions.
  }),
  // Better Auth validates post-login callbackURL/redirectTo against this list and
  // defaults it to the API's own origin, which would reject every redirect back
  // to the frontend. Shared with the CORS config so origins are declared once.
  trustedOrigins: getCorsOrigins(),
  advanced: {
    defaultCookieAttributes: isProduction
      ? { sameSite: "none", secure: true }
      : {},
  },
  emailAndPassword: { enabled: false }, // no email + password combo currently
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },
});
