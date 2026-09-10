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

## Commit ↔ ticket link
- Reference the ticket key in the commit message so the board and git history stay
  linked (one ticket ⇄ one commit).
- Commit only when asked; branch off `main` first if on the default branch.
