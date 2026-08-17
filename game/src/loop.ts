// Fixed-timestep loop. update() runs in fixed `dt` steps (deterministic sim);
// frame() runs once per animation frame with the real elapsed time (view work like
// camera panning — keeps running while paused); render() draws. speed() scales
// sim-time flow (0 = paused, 2 = double), so pause/time-controls live in the caller
// while the loop stays a generic primitive.

export interface LoopHandle {
  stop(): void;
}

export function startLoop(opts: {
  hz: number;
  update: (dt: number) => void;
  frame?: (realDt: number) => void;
  render: () => void;
  speed?: () => number;
}): LoopHandle {
  const step = 1 / opts.hz;
  const speed = opts.speed ?? (() => 1);
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  let running = true;

  function tick(now: number) {
    if (!running) return;
    const realDt = Math.min((now - last) / 1000, 0.1); // clamp long stalls (tab hidden, breakpoint)
    last = now;
    acc += realDt * speed();
    let steps = 0;
    while (acc >= step && steps < 600) {
      opts.update(step);
      acc -= step;
      steps++;
    }
    opts.frame?.(realDt);
    opts.render();
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
