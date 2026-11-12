# .track/ Agent Conventions

## How It Works

Your session is **automatically tracked** via hooks. No registration, heartbeats, or deregistration needed.

## Quick Start

```bash
track board --last 10                          # Check what's happening
track list                                     # See available tickets
track create --title "Fix auth bug"            # Create + auto-claim
track create --title "Refactor utils" --no-claim  # Create for others
```

## While Working

- **Reference ticket IDs in commits:** `T-0001: fix token refresh`
- **Check the board:** `track board --last 10`
- **Post to the board:** `track board -m "message" --ticket T-NNNN`

Everything else is automatic — file changes, conflicts, heartbeats.

## When Done

```bash
track update T-NNNN --status review
```

## Rules

1. **One ticket at a time.** Finish or release before claiming another.
2. **Check the board first.** Another agent may be working on related code.
3. **Reference ticket IDs in commits** so progress is trackable.
4. **Never modify `.track/` files directly.** Use the `track` CLI.

## Dashboard

```bash
track serve              # Start at http://localhost:7777
track serve -d           # Background mode
track stop               # Stop
```

## Ticket Lifecycle

```
backlog → claimed → in-progress → review → done
```
