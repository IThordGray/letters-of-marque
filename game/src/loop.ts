// Fixed-timestep loop. update() runs in fixed `dt` steps (deterministic sim);
// frame() runs once per animation frame with the real elapsed time (view work
// like camera panning that should be framerate-smooth, not sim-locked); render()
// draws. A reusable primitive — naval/strategic will want the same shape.

export interface LoopHandle {
  stop(): void;
}

export function startLoop(opts: {
  hz: number;
  update: (dt: number) => void;
  frame?: (realDt: number) => void;
  render: () => void;
}): LoopHandle {
  const step = 1 / opts.hz;
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  let running = true;

  function tick(now: number) {
    if (!running) return;
    const realDt = Math.min((now - last) / 1000, 0.1); // clamp long stalls (tab hidden, breakpoint)
    last = now;
    acc += realDt;
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
