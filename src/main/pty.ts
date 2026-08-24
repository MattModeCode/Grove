import * as pty from 'node-pty';
import type { IPty } from 'node-pty';
import { buildAttachOrCreateArgs } from './tmux';

const TMUX_BIN = 'tmux';

export interface PtySpawnOptions {
  tmuxName: string;
  cwd: string;
  command: string;
  cols: number;
  rows: number;
  configPath: string;
  onData: (data: string) => void;
  onExit: (exitCode: number) => void;
}

// One pty per pane, running `tmux new-session -A` — attaches if the named
// session survived a Grove restart, creates it fresh otherwise.
export const spawnPane = (options: PtySpawnOptions): IPty => {
  const args = buildAttachOrCreateArgs(options.tmuxName, options.cwd, options.command, options.configPath);
  const proc = pty.spawn(TMUX_BIN, args, {
    name: 'xterm-256color',
    cols: options.cols,
    rows: options.rows,
    cwd: options.cwd,
    env: process.env as { [key: string]: string },
  });
  proc.onData(options.onData);
  proc.onExit(({ exitCode }) => options.onExit(exitCode));
  return proc;
};

// Kills the local pty client only — since it is attached to a tmux session
// (not the session's actual process tree), the tmux server keeps the session
// alive. Use tmux.ts's kill-session args to actually end the session.
export const detachPane = (proc: IPty): void => {
  proc.kill();
};

export const resizePane = (proc: IPty, cols: number, rows: number): void => {
  proc.resize(cols, rows);
};

export const writeToPane = (proc: IPty, data: string): void => {
  proc.write(data);
};
