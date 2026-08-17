import type { App } from "./app";
import { LOG } from "./constants";

// A thin DOM overlay for UI that doesn't belong on the canvas — starting with the
// signal log. This layer is also where combat panels and the context menu will live
// later, so it's built as a real overlay rather than canvas text.
export function installUI(app: App): { refresh: () => void } {
  const root = document.createElement("div");
  root.className = "ui-root";
  const log = document.createElement("div");
  log.className = "log";
  root.appendChild(log);
  document.body.appendChild(root);

  let lastLen = -1;
  return {
    refresh() {
      const lines = app.world.log;
      if (lines.length === lastLen) return; // only rebuild when the log changed
      lastLen = lines.length;
      log.replaceChildren();
      for (const l of lines.slice(-LOG.display)) {
        const line = document.createElement("div");
        line.className = "log-line";
        const t = document.createElement("span");
        t.className = "log-t";
        t.textContent = `${l.t.toFixed(1)}s`;
        line.append(t, ` ${l.msg}`);
        log.appendChild(line);
      }
      log.scrollTop = log.scrollHeight;
    },
  };
}
