// Fixed-timestep loop: update() runs in fixed `dt` steps (deterministic sim),
// render() runs once per animation frame (decoupled from the sim rate). A small
// reusable primitive — naval/strategic modules will want the same shape, so it
// lives on its own rather than baked into main.

export interface LoopHandle {
  stop(): void;
}

export function startLoop(opts: {
  hz: number;
  update: (dt: number) => void;
  render: () => void;
}): LoopHandle {
  const step = 1 / opts.hz;
  let last = performance.now();
  let acc = 0;
  let raf = 0;
  let running = true;

  function frame(now: number) {
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
    opts.render();
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  return {
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
  };
}
