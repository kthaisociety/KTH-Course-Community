import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set");
}

export default defineConfig({
  schema: ["./src/db/schema.ts", "./src/db/auth-schema.ts"], // supports adding multiple schema-files
  out: "./migrations",
  dialect: "postgresql",
  migrations: {
    schema: "drizzle",
    table: "__drizzle_migrations",
  },
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
});
