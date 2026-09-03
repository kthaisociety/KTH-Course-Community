import path from "node:path";
import { defineConfig } from "vitest/config";

const alias = { "@": path.resolve(__dirname, ".") };

export default defineConfig({
  test: {
    // Split by what each suite actually needs. Only the component tests pay for
    // a DOM; server code must never see one, and the hero's geometry is pure
    // maths that would otherwise spend ~40s a run booting jsdom for nothing.
    projects: [
      {
        resolve: { alias },
        test: {
          name: "server",
          environment: "node",
          include: ["server/**/*.spec.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "logic",
          environment: "node",
          include: ["features/**/lib/**/*.spec.ts", "lib/**/*.spec.ts"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "ui",
          environment: "jsdom",
          include: ["features/**/*.spec.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
