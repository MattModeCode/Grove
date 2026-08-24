import { gridDimensions, type TabState } from '../shared/types';
import type { PaneView } from './pane';

const MIN_RATIO = 0.08;

export const sumUpTo = (ratios: number[], index: number): number =>
  ratios.slice(0, index + 1).reduce((total, ratio) => total + ratio, 0);

export const shiftAdjacent = (ratios: number[], index: number, deltaFraction: number): number[] => {
  const next = [...ratios];
  const a = next[index] + deltaFraction;
  const b = next[index + 1] - deltaFraction;
  if (a < MIN_RATIO || b < MIN_RATIO) return ratios;
  next[index] = a;
  next[index + 1] = b;
  return next;
};

type Axis = 'column' | 'row';

const attachDividerDrag = (
  divider: HTMLElement,
  axis: Axis,
  index: number,
  getRatios: () => number[],
  onDrag: (nextRatios: number[]) => void,
  getContainerSizePx: () => number,
  onCommit: () => void,
): void => {
  divider.addEventListener('pointerdown', (downEvent: PointerEvent) => {
    downEvent.preventDefault();
    const startPos = axis === 'column' ? downEvent.clientX : downEvent.clientY;
    const startRatios = getRatios();
    const containerSize = getContainerSizePx();
    let pendingFrame: number | null = null;
    let latestPos = startPos;

    const onMove = (moveEvent: PointerEvent): void => {
      latestPos = axis === 'column' ? moveEvent.clientX : moveEvent.clientY;
      if (pendingFrame !== null) return;
      pendingFrame = requestAnimationFrame(() => {
        pendingFrame = null;
        const deltaFraction = (latestPos - startPos) / containerSize;
        onDrag(shiftAdjacent(startRatios, index, deltaFraction));
      });
    };
    const onUp = (): void => {
      if (pendingFrame !== null) cancelAnimationFrame(pendingFrame);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      onCommit();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  });
};

export const renderGrid = (
  container: HTMLElement,
  tab: TabState,
  paneViews: Map<string, PaneView>,
  onRatiosChange: (columnRatios: number[], rowRatios: number[]) => void,
  refitPane: (view: PaneView) => void,
): void => {
  container.innerHTML = '';
  const { columns, rows } = gridDimensions(tab.gridPreset);
  let columnRatios = tab.columnRatios.length === columns ? [...tab.columnRatios] : Array(columns).fill(1 / columns);
  let rowRatios = tab.rowRatios.length === rows ? [...tab.rowRatios] : Array(rows).fill(1 / rows);

  const grid = document.createElement('div');
  grid.className = 'pane-grid';

  const applyTemplate = (): void => {
    grid.style.gridTemplateColumns = columnRatios.map((ratio) => `${ratio}fr`).join(' ');
    grid.style.gridTemplateRows = rowRatios.map((ratio) => `${ratio}fr`).join(' ');
  };
  applyTemplate();

  tab.panes.forEach((pane) => {
    const view = paneViews.get(pane.id);
    if (view !== undefined) grid.appendChild(view.el);
  });

  container.appendChild(grid);

  const refitPanes = (): void => {
    tab.panes.forEach((pane) => {
      const view = paneViews.get(pane.id);
      if (view !== undefined) refitPane(view);
    });
  };

  for (let i = 0; i < columns - 1; i += 1) {
    const divider = document.createElement('div');
    divider.className = 'divider divider-column';
    divider.style.left = `${sumUpTo(columnRatios, i) * 100}%`;
    container.appendChild(divider);
    attachDividerDrag(
      divider,
      'column',
      i,
      () => columnRatios,
      (next) => {
        columnRatios = next;
        applyTemplate();
        divider.style.left = `${sumUpTo(columnRatios, i) * 100}%`;
        refitPanes();
      },
      () => container.clientWidth,
      () => onRatiosChange(columnRatios, rowRatios),
    );
  }

  for (let i = 0; i < rows - 1; i += 1) {
    const divider = document.createElement('div');
    divider.className = 'divider divider-row';
    divider.style.top = `${sumUpTo(rowRatios, i) * 100}%`;
    container.appendChild(divider);
    attachDividerDrag(
      divider,
      'row',
      i,
      () => rowRatios,
      (next) => {
        rowRatios = next;
        applyTemplate();
        divider.style.top = `${sumUpTo(rowRatios, i) * 100}%`;
        refitPanes();
      },
      () => container.clientHeight,
      () => onRatiosChange(columnRatios, rowRatios),
    );
  }
};
