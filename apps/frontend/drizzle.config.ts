import dotenv from "dotenv";
import { defineConfig } from "drizzle-kit";

dotenv.config({ path: ".env.local" });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: ["./server/db/schema.ts", "./server/db/auth-schema.ts"],
  out: "./drizzle",
  dialect: "postgresql",
  migrations: {
    schema: "drizzle",
    table: "__drizzle_migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
