# Workflow — Tickets & Commits

**Scope:** cross-cutting · **Authority:** human edits win.

Every unit of work is tracked as a Jira ticket and lands as a matching commit.

## The board
- A Jira board is the team's work tracker; assume it is for the team's use.
- **Site:** `ivorthordgray.atlassian.net` · **Cloud ID:** `4c2cc6e4-6d5a-4367-b794-0624acb98c99`
- **Project:** `KAN` — "My Software Team" (id `10001`, team-managed / next-gen software).
- **Issue types available:** Epic · Story · Task · Feature · Bug · Subtask. Use
  **Epic → Story** for breakdown, **Bug** for defects, **Task** for chore/infra.
  (Team-managed project: link a story to its epic via the issue's **parent** field.)
- **`ai` label:** apply by passing `labels: ["ai"]` (via `additional_fields`) on create.
- Atlassian connector is authorized (read + write Jira). The Slack connector is
  not authorized and is not needed.

## Ticketing rules
- **Every feature and every bug is a ticket.** No work without a ticket.
- **Too big → break it down.** A large feature becomes an **epic** split into
  **stories**.
- **Cross-cutting chore / infra → an unparented Task.** Work that serves the whole
  project rather than one feature (tooling, test setup, build config) is a **Task with
  no parent** — don't hang it off an epic it merely happened to surface during. It
  still carries the `ai` label and a description. If the work was already done before
  the ticket existed, say so in the description rather than pretending otherwise.
- **One ticket = one commit.** If the work needs separate commits (e.g. a refactor,
  then the feature on top), each commit gets its own smaller ticket.
- **Knowledge-base commits are EXEMPT and need no ticket** (added 2026-09-10, after the
  gap was spotted on the board). A commit touching only `docs/` — ratifying a decision,
  amending a spec, recording a standard — is neither a feature nor a bug, and inventing
  a Task for each one adds noise without adding tracking. **The moment a commit touches
  code, it needs a ticket.** A mixed docs-and-code commit is a smell: split it.
- **Every ticket carries a description** — what and why (see the template below).
- **AI-created tickets are tagged.** Every ticket created by an agent or the manager
  gets an `ai` label (working name — change here if you prefer another) so
  human-created tickets, on this board or another, stay distinguishable.

## Ticket template
The fields a ticket must fill in — deliberately small; extend as needs arise.

```markdown
# <Issue type>: <concise summary>

**Type:**    Epic | Story | Task | Bug
**Project:** KAN
**Labels:**  ai              ← always, for AI-created tickets
**Parent:**  KAN-<n>         ← stories only; links the story to its epic

## Description
**What:** <what this ticket delivers, in a line or two>
**Why:**  <the behaviour / fix / goal it serves>
```

## Writing ticket bodies — one silent trap

**Do not nest a heading inside a blockquote.** Jira converts ticket bodies to ADF, and a heading
inside a blockquote is **dropped silently** — no error, no warning; the section simply is not there.
Discovered 2026-09-10 when a correction notice vanished from a ticket and was only caught by reading
the ticket back after posting.

- Keep headings at the top level; use **bold** for emphasis inside a quote.
- **Read a ticket back after posting anything structurally unusual.** The write succeeding is not
  evidence the content survived.
- A milder second quirk, found 2026-09-10: **bold that wraps or abuts an inline-code span at the
  start of a list item gets re-flowed** and loses its emphasis. Cosmetic only — nothing is dropped,
  unlike the heading-in-blockquote case — but don't spend time wondering whether you imagined it.
- **The `ai` label and `parent` both go through `additional_fields` on create**
  (`{"labels": ["ai"], "parent": {"key": "KAN-96"}}`), and **the create response echoes back
  neither.** Re-read the issue to confirm they landed — the same lesson as above.

## Delegated work commits as it goes

**Added 2026-09-15, after an interrupted session nearly cost ~700 lines of finished work.** An agent
had completed KAN-107 in its worktree — the refactor, the tests, a new module, a clean typecheck —
and had **committed none of it** when the session ended. It survived only because an uncommitted
worktree happens to persist on disk, which is luck, not a process.

- **Every delegated brief tells the agent to commit incrementally**: a first WIP commit as soon as
  anything compiles, and again at each checkpoint. History can be tidied at the end with a soft
  reset; work that was never written down cannot be recovered.
- **One ticket = one commit still holds** — it is a rule about the *final* history, not a reason to
  leave hours of work uncommitted in a working tree.
- **When a run is interrupted, check the worktree before assuming the work is lost.** `git -C
  <worktree> status --short` and a `tsc`/test run will tell you in a minute whether you are
  recovering or restarting. In this case the work was complete and only needed committing.

## Commit ↔ ticket link
- **A merged branch closes its tickets in the SAME pass.** Added 2026-09-10, after KAN-98 sat at
  `To Do` for several merges while being a declared blocker on two other stories — so the board
  misreported the queue the whole time. The merge and the closing note are one unit of work.
- **Do not close a ticket you cannot record the outcome of.** If the findings are missing, get them
  first; a ticket closed with no account of what it found is worse than one left open, because it
  looks finished. *(This is the rule that caught the KAN-98 gap — an agent correctly refused.)*
- **Name the DEPENDENCY, never the queue position.** A ticket that says "nothing in the current front
  of the queue waits on this" dates itself the moment the queue moves, and then the two halves of the
  ticket disagree. Write *"KAN-99 sits on top of this"*, which stays true.

- Reference the ticket key in the commit message so the board and git history stay
  linked (one ticket ⇄ one commit).
- Commit only when asked; branch off `main` first if on the default branch.
