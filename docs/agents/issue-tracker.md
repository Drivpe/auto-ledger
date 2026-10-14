# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01` — never a single combined tickets file
- Triage state is recorded as a `Status:` line near the top of each issue file
- Comments and conversation history append to the bottom of the file under a `## Comments` heading

## Exception: tickets that a worktree-based flow must read

`.scratch/` is git-ignored, so its contents **do not exist in a git worktree**. Any flow that
implements tickets inside worktrees (`/implement-spec`) therefore cannot see tickets published
only under `.scratch/`.

For such features the tickets are **also** kept in a version-controlled mirror, one file per
ticket, numbered identically:

- Tickets: `docs/specs/<NNNN>-<slug>/issues/<NN>-<ticket-slug>.md`
- `docs/specs/<NNNN>-<slug>.md` stays the spec

The mirror is a **copy, not a second tracker**: blocking edges keep the same numbers, and a
ticket's `Status:` line is updated in both places when it closes. `.scratch/` remains the home of
the raw evidence (unredacted platform captures) and is never a subagent's input; redacted
fixtures for tests live under `test/fixtures/`.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/` (creating the directory if needed), and — when
the feature will be implemented through a worktree-based flow — mirror it into
`docs/specs/<NNNN>-<slug>/issues/` as described above.

## When a skill says "fetch the relevant ticket"

Read the file at the referenced path. The user will normally pass the path or the issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The **map** is a file with one **child** file per ticket.

- **Map**: `.scratch/<effort>/map.md` — the Destination / Notes / Decisions-so-far / Fog body.
- **Child ticket**: `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records the ticket type (`research`/`prototype`/`grilling`/`task`); a `Status:` line records `open`/`claimed`/`resolved`.
- **Blocking**: a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every file it lists is `resolved`.
- **Frontier**: scan `.scratch/<effort>/issues/` for files that are open, unblocked, and unclaimed; first by number wins.
- **Claim**: set `Status: claimed` and save before any work.
- **Resolve**: append the answer under an `## Answer` heading, set `Status: resolved`, then append a context pointer (gist + link) to the map's Decisions-so-far in `map.md`.

## PRs as a request surface

Off — external PRs are not part of the triage queue for this repo.
