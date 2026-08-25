import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { PaneKind, PaneState } from '../shared/types';

const execFileAsync = promisify(execFile);

export interface TmuxRunner {
  run(args: string[]): Promise<{ stdout: string; exitCode: number }>;
}

export const sessionName = (paneId: string): string => `grove-${paneId}`;

// tmux runs this as a non-interactive, non-login shell command, which on
// macOS skips .zprofile/.zshrc — so a `claude` installed via nvm/homebrew's
// user-local bin can be absent from PATH. `-lic` forces the login+interactive
// shell startup that sources those files before exec'ing claude.
export const claudeCommand = (env: NodeJS.ProcessEnv = process.env): string =>
  `${shellCommand(env)} -lic 'claude --dangerously-skip-permissions'`;

export const shellCommand = (env: NodeJS.ProcessEnv = process.env): string => env.SHELL ?? '/bin/zsh';

export const commandFor = (kind: PaneKind, env: NodeJS.ProcessEnv = process.env): string =>
  kind === 'claude' ? claudeCommand(env) : shellCommand(env);

// tmux's own status line is chrome Grove doesn't want — the tab bar and pane
// grid already show what a status line would. `-f` is read once, when a
// brand-new tmux server starts, so it can't race a session's creation the
// way a separate follow-up `set-option` call would (the server may not have
// registered the session yet by the time that runs).
export const tmuxConfigContents = 'set-option -g status off\n';

// `-A` attaches to an existing session by that name, or creates it fresh —
// one call covers both first-launch and reattach-after-restart. `-f` is a
// global tmux flag and must precede the `new-session` subcommand.
export const buildAttachOrCreateArgs = (
  name: string,
  cwd: string,
  command: string,
  configPath: string,
): string[] => ['-f', configPath, 'new-session', '-A', '-s', name, '-c', cwd, command];

export const buildKillArgs = (name: string): string[] => ['kill-session', '-t', name];

export const buildRenameArgs = (oldName: string, newName: string): string[] => [
  'rename-session',
  '-t',
  oldName,
  newName,
];

export const buildResizeArgs = (name: string, cols: number, rows: number): string[] => [
  'resize-window',
  '-t',
  name,
  '-x',
  String(cols),
  '-y',
  String(rows),
];

export const parseSessionList = (stdout: string): string[] =>
  stdout
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

export const listSessions = async (runner: TmuxRunner): Promise<string[]> => {
  const { stdout, exitCode } = await runner.run(['list-sessions', '-F', '#{session_name}']);
  if (exitCode !== 0) return [];
  return parseSessionList(stdout);
};

// The only impure export in this module — everything above is unit tested
// through the TmuxRunner interface; this is the real implementation of it.
export const createTmuxRunner = (): TmuxRunner => ({
  run: async (args: string[]) => {
    try {
      const { stdout } = await execFileAsync('tmux', args);
      return { stdout, exitCode: 0 };
    } catch (error: unknown) {
      const stdout = typeof (error as { stdout?: unknown }).stdout === 'string' ? (error as { stdout: string }).stdout : '';
      return { stdout, exitCode: 1 };
    }
  },
});

export interface ReconcileResult {
  alive: PaneState[];
  dead: PaneState[];
}

export const reconcileSessions = (panes: readonly PaneState[], liveNames: readonly string[]): ReconcileResult => {
  const liveSet = new Set(liveNames);
  const alive: PaneState[] = [];
  const dead: PaneState[] = [];
  for (const pane of panes) {
    (liveSet.has(pane.tmuxName) ? alive : dead).push(pane);
  }
  return { alive, dead };
};
