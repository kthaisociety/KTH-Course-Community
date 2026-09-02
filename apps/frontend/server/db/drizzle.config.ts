import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

const dir = path.dirname(fileURLToPath(import.meta.url));
const appRoot = path.resolve(dir, "../..");

dotenv.config({ path: path.join(appRoot, ".env.local") });
dotenv.config({ path: path.join(appRoot, ".env") });

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: ["./server/db/schema.ts", "./server/db/auth-schema.ts"],
  out: "./server/db/drizzle",
  dialect: "postgresql",
  migrations: {
    schema: "drizzle",
    table: "__drizzle_migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
