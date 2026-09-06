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
          // `app/api/` holds route handlers, which are server code that happens
          // to live under `app/` because that is where Next looks for them.
          // They belong in this project, not in a DOM one.
          include: ["server/**/*.spec.ts", "app/api/**/*.spec.ts"],
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
          // `components/**` is here because `components/ui/confirm-dialog.tsx`
          // is app UI with real behaviour to test, not a vendored shadcn
          // primitive.
          include: ["features/**/*.spec.tsx", "components/**/*.spec.tsx"],
          setupFiles: ["./vitest.setup.ts"],
        },
      },
    ],
  },
});
