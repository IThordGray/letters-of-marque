import { defineConfig } from "vite";

// Two entry points: the land raid (index.html) and the standalone town module
// (town.html). The town module is deliberately NOT wired into the raid — it is
// its own startup file until the placement pass proves the plan is placeable.
export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: "index.html", town: "town.html" },
    },
  },
});
