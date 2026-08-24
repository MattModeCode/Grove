# Grove

A desktop app for running several Claude Code sessions side by side, in one window.

Each tab holds a grid of panes — 1, 2, 4, 6, or 8 at a time. Drag the dividers to resize. Double-click a tab or a pane to rename it. Press `⌘K` to search and jump to any session.

Grove runs each session in `tmux`, so closing the app (or a crash) doesn't kill your work — reopen Grove and everything is still there.

## Requirements

- macOS
- [tmux](https://github.com/tmux/tmux) — `brew install tmux`
- The Claude Code CLI (`claude`) on your `$PATH`

## Running it

```sh
npm install
npm start
```

## Development

```sh
npm test         # run tests
npm run typecheck
npm run lint
```
