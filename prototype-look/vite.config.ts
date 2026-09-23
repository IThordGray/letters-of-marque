import { defineConfig } from "vite";

// The spike reads the REAL world generator out of `game/src/overworld/`, so the
// dev server has to be allowed to serve a file from outside this directory.
// Nothing is ever written back that way — `game/` is read-only to this spike.
export default defineConfig({
  server: { fs: { allow: [".."] } },
});
