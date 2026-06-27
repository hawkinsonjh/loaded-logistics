# Loaded Logistics — Agent System

A small hierarchy of role agents that work for Joe Hawkinson the way a real ops team would:
each agent owns one function, studies its craft, reports on what it found, and keeps a
written record so it gets sharper over time instead of repeating the same analysis from
scratch every day. **Jarvis** is the lead coordinator who runs the team.

## Structure

```
Joe (owner)
  └── Jarvis — Lead Dispatch Coordinator  (.claude/agents/jarvis.md + agents/jarvis/)
        ├── Dispatcher / Load Planner agent
        └── Accounting / P&L agent
```

- **Jarvis (lead coordinator)** — Joe's AI counterpart for dispatch and the "main agent" that
  runs the daily cycle (scheduled task "daily-ops-digest"). He reads the operating-system
  doc, his own playbook, the live board, and the broker inbox; oversees the role agents and
  cross-checks their numbers against real files/the live board before anything reaches Joe;
  and is the single front door whenever Joe wants the board worked. Authority is **advise +
  prepare; Joe approves** — Jarvis never writes to the board or replies to brokers on his own.
  His identity/instructions live in `.claude/agents/jarvis.md` (so he's invokable as the
  `jarvis` subagent) and his evolving knowledge lives in `agents/jarvis/playbook.md` +
  `agents/jarvis/log.md`. He also reads the live board via `agents/jarvis/board.mjs`.
- **Role agents** — each has a `playbook.md` (accumulated domain knowledge + best practices,
  edited over time — this is the "studying and improving" record) and a `log.md` (dated
  history of what that agent did/found each day, append-only, this is the audit trail).

## Roles live today

| Role | Definition / Playbook | Log |
|---|---|---|
| **Jarvis — Lead Coordinator** | `.claude/agents/jarvis.md` · `agents/jarvis/playbook.md` | `agents/jarvis/log.md` |
| Dispatcher / Load Planner | `agents/dispatcher/playbook.md` | `agents/dispatcher/log.md` |
| Accounting / P&L | `agents/accounting/playbook.md` | `agents/accounting/log.md` |

## How a daily run works

1. **Jarvis** reads `agents/jarvis/playbook.md`, then `LOADED-LOGISTICS-OPERATING-SYSTEM.md`
   (full project context), pulls the live board via `agents/jarvis/board.mjs` (or falls back
   to the seed and labels it), sweeps the broker inbox, and reads both role playbooks.
2. Jarvis spawns each role agent with its playbook + the latest data it can reach. Each role
   agent: reviews its own playbook, does one piece of research to learn something current
   in its field (or confirms nothing material changed), reviews available data for
   anomalies/insights, appends a dated entry to its own playbook's "Lessons learned" section
   and to its `log.md`, then returns a short status report. (If Jarvis is itself running as a
   subagent and can't spawn others, he performs the role reviews directly using their
   playbooks as his checklist, then updates their records.)
3. Jarvis cross-checks both reports against the underlying files / live board (no inventing
   numbers that aren't in the data), appends a dated entry to `agents/jarvis/log.md`, then
   sends Joe one digest: what happened, what the team learned, what needs his attention.

## Live data — wired through `agents/jarvis/board.mjs`

Jarvis reads the live board through a small read-only helper, `agents/jarvis/board.mjs`
(`node agents/jarvis/board.mjs loads | messages | health`). It logs into the deployed backend
and GETs current loads/messages — it never wri