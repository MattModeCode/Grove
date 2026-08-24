# Grove

A terminal harness for running many Claude Code sessions at once.

Click **+ session** to launch a `claude --dangerously-skip-permissions` session
(⌥-click for a plain shell). Sessions are named panes inside tabs; each tab
picks a grid layout — 1, 2, 4, 6, or 8 up — and the dividers between panes
drag to resize. `⌘K` opens a search palette to jump straight to any pane by
name, cwd, or tab.

Every pane is backed by a `tmux` session (`grove-<id>`). Closing Grove, or it
crashing, does not end a running Claude Code session — the tmux server keeps
it alive, and Grove reattaches on next launch. Closing a pane from the UI
does kill its session.

Theme mirrors the macOS Terminal.app "Pro" profile: black background, Monaco
10pt, no font antialiasing.

## Requirements

- macOS
- [tmux](https://github.com/tmux/tmux) (`brew install tmux`)
- Claude Code CLI (`claude`) on `$PATH`

## Development

```sh
npm install
npm start        # electron-forge dev
npm test         # vitest
npm run typecheck
npm run lint
```

## Status

Standalone app — not yet wired into ChinOS. Search indexes pane name, cwd,
and tab name; scrollback search is not implemented.
