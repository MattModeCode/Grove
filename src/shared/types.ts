export type PaneKind = 'claude' | 'shell';

export interface PaneState {
  id: string;
  tmuxName: string;
  name: string;
  cwd: string;
  kind: PaneKind;
  slot: number;
}

export interface TabState {
  id: string;
  name: string;
  gridPreset: GridPreset;
  columnRatios: number[];
  rowRatios: number[];
  panes: PaneState[];
}

export type GridPreset = 1 | 2 | 4 | 6 | 8;

export interface GroveState {
  tabs: TabState[];
  activeTabId: string | null;
}

export const GRID_PRESETS: readonly GridPreset[] = [1, 2, 4, 6, 8];

export const gridDimensions = (preset: GridPreset): { columns: number; rows: number } => {
  switch (preset) {
    case 1:
      return { columns: 1, rows: 1 };
    case 2:
      return { columns: 2, rows: 1 };
    case 4:
      return { columns: 2, rows: 2 };
    case 6:
      return { columns: 3, rows: 2 };
    case 8:
      return { columns: 4, rows: 2 };
  }
};
