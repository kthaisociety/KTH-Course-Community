import { neon } from "@neondatabase/serverless";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../db/schema";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is not set");

const db = drizzle({ client: neon(url) });

export const auth = betterAuth({
database: drizzleAdapter(db, {
    provider: "pg",
    schema,
    usePlural: true, // for schema generation, e.g. names table "users" instead of "user"
    transaction: false, // neon-http has no interactive transactions.
}),
emailAndPassword: { enabled: false }, // no email + password combo currently 
socialProviders: {
    google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? "",
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
},
});
