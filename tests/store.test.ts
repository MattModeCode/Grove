import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { emptyState, isGroveState, loadState, parseState, saveState, serializeState } from '../src/main/store';
import type { GroveState, PaneState, TabState } from '../src/shared/types';

const pane: PaneState = {
  id: 'p1',
  tmuxName: 'grove-p1',
  name: 'agent-1',
  cwd: '/Users/mc/chin',
  kind: 'claude',
  slot: 0,
};

const tab: TabState = {
  id: 't1',
  name: 'Main',
  gridPreset: 4,
  columnRatios: [0.5, 0.5],
  rowRatios: [0.5, 0.5],
  panes: [pane],
};

const validState: GroveState = { tabs: [tab], activeTabId: 't1' };

describe('isGroveState', () => {
  it('accepts a well-formed state', () => {
    expect(isGroveState(validState)).toBe(true);
  });

  it('rejects a pane with an invalid kind', () => {
    const bad = { ...validState, tabs: [{ ...tab, panes: [{ ...pane, kind: 'bogus' }] }] };
    expect(isGroveState(bad)).toBe(false);
  });

  it('rejects a tab with a grid preset outside the allowed set', () => {
    const bad = { ...validState, tabs: [{ ...tab, gridPreset: 3 }] };
    expect(isGroveState(bad)).toBe(false);
  });

  it('rejects non-object input', () => {
    expect(isGroveState(null)).toBe(false);
    expect(isGroveState('nope')).toBe(false);
    expect(isGroveState(42)).toBe(false);
  });

  it('accepts a null activeTabId', () => {
    expect(isGroveState({ tabs: [], activeTabId: null })).toBe(true);
  });
});

describe('parseState', () => {
  it('round-trips a valid state through serialize/parse', () => {
    expect(parseState(serializeState(validState))).toEqual(validState);
  });

  it('falls back to empty state on malformed JSON', () => {
    expect(parseState('{not json')).toEqual(emptyState());
  });

  it('falls back to empty state on well-formed JSON that fails the schema', () => {
    expect(parseState(JSON.stringify({ tabs: 'nope' }))).toEqual(emptyState());
  });
});

describe('loadState / saveState', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'grove-store-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it('returns empty state when the file does not exist', async () => {
    expect(await loadState(path.join(dir, 'missing.json'))).toEqual(emptyState());
  });

  it('writes and reads back the same state, creating parent dirs as needed', async () => {
    const filePath = path.join(dir, 'nested', 'state.json');
    await saveState(filePath, validState);
    const raw = await readFile(filePath, 'utf-8');
    expect(JSON.parse(raw)).toEqual(validState);
    expect(await loadState(filePath)).toEqual(validState);
  });
});
