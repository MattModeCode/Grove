import fs from 'node:fs/promises';
import path from 'node:path';
import { GRID_PRESETS, type GridPreset, type GroveState, type PaneKind, type PaneState, type TabState } from '../shared/types';

export const emptyState = (): GroveState => ({ tabs: [], activeTabId: null });

const isPaneKind = (value: unknown): value is PaneKind => value === 'claude' || value === 'shell';

const isGridPreset = (value: unknown): value is GridPreset =>
  typeof value === 'number' && (GRID_PRESETS as readonly number[]).includes(value);

const isNumberArray = (value: unknown): value is number[] =>
  Array.isArray(value) && value.every((entry) => typeof entry === 'number');

const isPaneState = (value: unknown): value is PaneState => {
  if (typeof value !== 'object' || value === null) return false;
  const pane = value as Record<string, unknown>;
  return (
    typeof pane.id === 'string' &&
    typeof pane.tmuxName === 'string' &&
    typeof pane.name === 'string' &&
    typeof pane.cwd === 'string' &&
    isPaneKind(pane.kind) &&
    typeof pane.slot === 'number'
  );
};

const isTabState = (value: unknown): value is TabState => {
  if (typeof value !== 'object' || value === null) return false;
  const tab = value as Record<string, unknown>;
  return (
    typeof tab.id === 'string' &&
    typeof tab.name === 'string' &&
    isGridPreset(tab.gridPreset) &&
    isNumberArray(tab.columnRatios) &&
    isNumberArray(tab.rowRatios) &&
    Array.isArray(tab.panes) &&
    tab.panes.every(isPaneState)
  );
};

export const isGroveState = (value: unknown): value is GroveState => {
  if (typeof value !== 'object' || value === null) return false;
  const state = value as Record<string, unknown>;
  return (
    Array.isArray(state.tabs) &&
    state.tabs.every(isTabState) &&
    (state.activeTabId === null || typeof state.activeTabId === 'string')
  );
};

export const parseState = (raw: string): GroveState => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return emptyState();
  }
  return isGroveState(parsed) ? parsed : emptyState();
};

export const serializeState = (state: GroveState): string => JSON.stringify(state, null, 2);

export const loadState = async (filePath: string): Promise<GroveState> => {
  try {
    const raw = await fs.readFile(filePath, 'utf-8');
    return parseState(raw);
  } catch {
    return emptyState();
  }
};

export const saveState = async (filePath: string, state: GroveState): Promise<void> => {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, serializeState(state), 'utf-8');
};
