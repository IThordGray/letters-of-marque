# Rendering

**Status:** not binding until a renderer is chosen (none is — `decisions.md`, *Look*). Read this when
that choice is on the table. A GPU inverts much of [performance.md](performance.md): the cost becomes
draw calls and bandwidth, and byte layout is yours to control.

## Rules

- `[P-62]` No display object per entity. The view owns typed-array columns and uploads them.
- `[P-63]` Reduce the number of tests before making a test faster (hierarchical culling beats moving
  flat culling onto the GPU).
- `[P-64]` One large buffer, many draws; suballocate geometry into it.
- `[P-65]` Page a large buffer into fixed-capacity pages — an allocator's cost scales with its arena.
- `[P-66]` Shrink the vertex: derive normals in the shader, index into lookup tables, bit-pack small
  fields, `float16` positions. Ask what range each field needs.
- `[P-67]` Never emit a face that cannot be seen; merge coplanar faces (greedy meshing).
- `[P-68]` Shrink the coordinate space before the number: chunk-local positions, origin per chunk.
- `[P-69]` Instance the smallest repeating unit (a quad), not the biggest.
- `[P-70]` Partition by the predicate instead of testing it (per-direction meshes instead of
  back-face culling); reuse the freed bits.
- `[P-17c]` still holds: a bake belongs to the reader and is never world state.
- In a vertex buffer, lookup tables and narrow types win (bandwidth); on the CPU they usually don't.

## Facts for the renderer decision

- **WebGL2:** no indirect draw, no compute shaders, no storage buffers. Nearest: `drawElementsInstanced`,
  `WEBGL_multi_draw` (gives `gl_DrawID`). Culling, meshing, packing and instancing all work in plain WebGL2.
- **WebGPU:** `drawIndexedIndirect` and compute shaders — GPU-written draw lists are possible only here.
- Collapsing everything into one draw call is the step that wants WebGPU; the rest does not.

## Sources

- Planetsmith devlog, *I Built a Custom GPU-Driven Rendering Pipeline* — https://youtu.be/LzivS_KzffY
- Vercidium, *I Optimised My Game Engine Up To 12000 FPS* — https://youtu.be/40JzyaOYJeY
