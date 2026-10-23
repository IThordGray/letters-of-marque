# Design sheet — prompt template

A **design sheet** explains one mechanic on one illustrated page, so it can be understood at a
glance. Example: `design-sheet-towns-land.png`.

Two levels:

- **Sketch** — while the mechanic is still being decided. Cheap, loose, easy to redo.
- **Rendered** — once it is decided. Same content, full illustration.

## Filling it in

- **One mechanic per sheet.** A big area becomes several sheets.
- **Title** (2–4 words) · **area** (Towns, Naval, Land, Officers…) · **one-line idea**, the rule
  the whole sheet hangs on.
- **3–5 sections**, each with a heading, 2–4 bullets of at most ~10 words, and one picture.
- **A "Never in this game" box** for what the mechanic deliberately refuses.
- **A footer line** that restates the idea.
- Use real examples from the spec (a town name, a quoted line), not placeholders.
- Image models garble long text: if words come out wrong, cut every section to two bullets.

## Prompt — sketch

```
Make a one-page game design sheet, not concept art. A quick designer's sketch on a single sheet of plain parchment: loose ink pen lines, light watercolour washes in a few warm colours, simple diagrams and small hand-drawn icons instead of rendered scenes, hand-lettered headings. Clean layout in sections. Keep every piece of text short and readable.

TITLE: "[title]"
SUBTITLE: "Letters of Marque · Design sheet · [area]"
ONE-LINE IDEA (under the title, in italics): "[the rule]"

SECTION 1, "[heading]" (with a simple sketch of [what]):
- [bullet]
- [bullet]

SECTION 2 … (repeat for 3–5 sections)

"Never in this game" (a small box with crossed-out items): [item] · [item] · [item]

FOOTER: "[closing line]"
```

## Prompt — rendered

Same content as the sketch. Replace its first paragraph with:

```
Make a one-page game design document, not concept art. It should look like a real design page a game studio would pin on the wall: a single sheet of aged parchment, hand-inked headings in period lettering, rich watercolour illustrations in the game's world style (sunlit Caribbean, saturated sea and greens, Spanish colonial towns, terracotta roofs), small hand-drawn icons, warm afternoon colours. Clean layout in numbered sections. Keep every piece of text short and readable.
```
