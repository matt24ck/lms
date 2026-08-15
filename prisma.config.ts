import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Migrations must not go through Supabase's connection pooler (pgbouncer
    // cannot run them), so prefer the direct connection when one is set.
    // The app itself uses the pooled DATABASE_URL — see src/lib/prisma.ts.
    url: process.env["DIRECT_URL"] ?? process.env["DATABASE_URL"],
  },
});
