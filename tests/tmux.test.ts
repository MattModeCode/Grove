import { describe, expect, it } from 'vitest';
import {
  buildAttachOrCreateArgs,
  buildKillArgs,
  buildRenameArgs,
  claudeCommand,
  commandFor,
  listSessions,
  parseSessionList,
  reconcileSessions,
  sessionName,
  shellCommand,
  tmuxConfigContents,
  type TmuxRunner,
} from '../src/main/tmux';
import type { PaneState } from '../src/shared/types';

describe('sessionName', () => {
  it('prefixes the pane id with grove-', () => {
    expect(sessionName('abc123')).toBe('grove-abc123');
  });
});

describe('commandFor', () => {
  it('returns the claude launch command for kind claude', () => {
    expect(commandFor('claude')).toBe(claudeCommand());
    expect(claudeCommand()).toContain('--dangerously-skip-permissions');
  });

  it('returns $SHELL for kind shell when set', () => {
    expect(commandFor('shell', { SHELL: '/bin/fish' })).toBe('/bin/fish');
  });

  it('falls back to /bin/zsh for kind shell when $SHELL is unset', () => {
    expect(shellCommand({})).toBe('/bin/zsh');
  });
});

describe('buildAttachOrCreateArgs', () => {
  it('builds a tmux new-session -A command with -f pointed at the config file', () => {
    expect(buildAttachOrCreateArgs('grove-1', '/Users/mc/chin', 'claude', '/tmp/grove-tmux.conf')).toEqual([
      '-f',
      '/tmp/grove-tmux.conf',
      'new-session',
      '-A',
      '-s',
      'grove-1',
      '-c',
      '/Users/mc/chin',
      'claude',
    ]);
  });
});

describe('buildKillArgs / buildRenameArgs', () => {
  it('builds kill-session args', () => {
    expect(buildKillArgs('grove-1')).toEqual(['kill-session', '-t', 'grove-1']);
  });

  it('builds rename-session args', () => {
    expect(buildRenameArgs('grove-1', 'grove-2')).toEqual(['rename-session', '-t', 'grove-1', 'grove-2']);
  });
});

describe('tmuxConfigContents', () => {
  it('disables the status line server-wide', () => {
    expect(tmuxConfigContents).toBe('set-option -g status off\n');
  });
});

describe('parseSessionList', () => {
  it('splits, trims, and drops blank lines', () => {
    expect(parseSessionList('grove-1\ngrove-2\n\n  \n')).toEqual(['grove-1', 'grove-2']);
  });

  it('returns an empty array for empty stdout', () => {
    expect(parseSessionList('')).toEqual([]);
  });
});

describe('listSessions', () => {
  it('parses stdout on success', async () => {
    const runner: TmuxRunner = {
      run: async () => ({ stdout: 'grove-1\ngrove-2\n', exitCode: 0 }),
    };
    expect(await listSessions(runner)).toEqual(['grove-1', 'grove-2']);
  });

  it('returns an empty array when tmux exits non-zero (no server running)', async () => {
    const runner: TmuxRunner = {
      run: async () => ({ stdout: '', exitCode: 1 }),
    };
    expect(await listSessions(runner)).toEqual([]);
  });
});

describe('reconcileSessions', () => {
  const pane = (id: string, tmuxName: string): PaneState => ({
    id,
    tmuxName,
    name: id,
    cwd: '/tmp',
    kind: 'claude',
    slot: 0,
  });

  it('splits panes into alive and dead based on live tmux session names', () => {
    const panes = [pane('a', 'grove-a'), pane('b', 'grove-b')];
    const result = reconcileSessions(panes, ['grove-a']);
    expect(result.alive).toEqual([panes[0]]);
    expect(result.dead).toEqual([panes[1]]);
  });

  it('treats all panes as dead when nothing is live', () => {
    const panes = [pane('a', 'grove-a')];
    expect(reconcileSessions(panes, []).dead).toEqual(panes);
  });
});
