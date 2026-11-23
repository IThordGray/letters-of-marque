# Workflow — Briefs & Commits

**Scope:** cross-cutting · **Authority:** human edits win.

There are no tickets. When the manager hands a coding task to the builder, it starts the builder
with a message. That message is the **brief**: it says what to build and how to know it's done.
It isn't saved anywhere else. The work ends as **one commit**, and the commit message is the
lasting record of what changed and why. Anything that matters beyond that commit goes in
`decisions.md`.

## Scale the process to the task

| Request | Path |
|---|---|
| Fits in one sentence ("rename X", "fix the typo in Y") | The manager just does it. No brief, no reviewer. |
| Clear, and bigger than one sentence | The manager writes the brief(s) → builder → reviewer. |
| Sizeable or half-formed — the manager can't write *Done when* yet | `scope-analyst` first; questions to the human, then briefs. |
| Changing existing code widely: a refactor, a rebuild, "is it worth redoing X now" | `refactor-impact-analysis` first (knowledge-base skill). Stops for confirmation. |

## The brief

Every piece of code work bigger than one sentence starts from one. The manager writes it; the
builder builds exactly it; the reviewer checks against it and nothing else.

```markdown
**What:**   <what this delivers, one or two lines>
**Why:**    <the behaviour / fix / goal it serves>
**Serves:** <pillar → milestone, one line — the intent this answers to>
**Owns:**   <the files or folders this brief may change — nothing else>

## Done when
- <2–4 checkable statements about the game, not the code>

## Proof
<the test name(s) or command whose output shows every "Done when" holds>

## Read
<the spec sections this needs — nothing more>
```

- **No Done when, no builder.** A bug's *Done when* is the repro no longer reproducing.
- **More than four items means it is too big:** split it into briefs that each land as a commit.
- **Owns** is what lets builders run in parallel: two briefs never own the same file.
- **A brief that changes a ratified rule says so.** The manager edits the spec or `decisions.md`
  when it merges; nothing else keeps them true.
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
- A change that only touches comments or docs needs no test run.

## Code flow

**manager writes the brief → `builder` (own worktree) → `reviewer` (fresh context) → manager merges.**

- On a reviewer FAIL, the builder gets the reasons and goes again. **Two failed rounds on the same
  brief: stop and rewrite the brief** — don't keep retrying.
- Parallel builders only for briefs whose **Owns** don't overlap. Start with 2–3; the limit is how
  fast a human can review and merge.
- Merge one at a time; run `npm test` in `game/` after each merge.
