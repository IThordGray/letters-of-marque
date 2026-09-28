# Workflow — Briefs & Commits

**Scope:** cross-cutting · **Authority:** human edits win.

There are no tickets. When the manager hands a coding task to the builder, it starts the builder
with a message. That message is the **brief**: it says what to build and how to know it's done.
It isn't saved anywhere else. The work ends as **one commit**, and the commit message is the
lasting record of what changed and why. Anything that matters beyond that commit goes in
`decisions.md`.

## The brief

Every piece of code work starts from one. The manager writes it; the builder builds exactly it;
the reviewer checks against it and nothing else.

```markdown
**What:**   <what this delivers, one or two lines>
**Why:**    <the behaviour / fix / goal it serves>
**Serves:** <pillar → milestone, one line — the intent this answers to>

## Done when
- <2–4 checkable statements about the game, not the code>

## Proof
<the test name(s) or command whose output shows every "Done when" holds>

## Read
<the spec sections this needs — nothing more>
```

- **No Done when, no builder.** A bug's *Done when* is the repro no longer reproducing.
- **More than four items means it is too big:** split it into briefs that each land as a commit.
- **Before writing a brief, the three questions in `CLAUDE.md` ("Do less") apply.** Most things
  that surface mid-work never become a brief.

## Commits

- **One brief = one commit** in the final history. Docs-only commits need no brief.
- **Message:** `type(area): what changed` — the subject says what the game does differently, the
  body says why in a few lines. No ticket keys.
- **A mixed docs-and-code commit is a smell:** split it.
- **Delegated work commits as it goes** — a WIP commit as soon as anything compiles, again at each
  checkpoint, squashed at the end. An uncommitted worktree surviving an interrupted session is luck.
  When a run is interrupted, check the worktree (`git -C <worktree> status --short`, then tests)
  before assuming the work is lost.
- Commit only when asked; branch off `main`/`master` first if on the default branch.

## Code flow

**manager writes the brief → `builder` (own worktree) → `reviewer` → manager merges.** On a
reviewer FAIL, the builder gets the reasons and goes again. Briefs touching different modules may
run in parallel builders; merge one at a time.
