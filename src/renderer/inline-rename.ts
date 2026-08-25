// Electron's renderer does not implement `window.prompt` (only alert/confirm
// are patched onto Chromium) — it returns null immediately, so dblclick
// rename handlers must edit inline instead of shelling out to a native dialog.
export const startInlineRename = (
  labelEl: HTMLElement,
  currentValue: string,
  onCommit: (value: string) => void,
): void => {
  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'inline-rename-input';
  input.value = currentValue;
  input.addEventListener('click', (event) => event.stopPropagation());
  input.addEventListener('mousedown', (event) => event.stopPropagation());
  input.addEventListener('dblclick', (event) => event.stopPropagation());

  labelEl.textContent = '';
  labelEl.appendChild(input);
  input.focus();
  input.select();

  let settled = false;
  const commit = (): void => {
    if (settled) return;
    settled = true;
    const value = input.value.trim();
    labelEl.textContent = value === '' ? currentValue : value;
    if (value !== '' && value !== currentValue) onCommit(value);
  };
  const cancel = (): void => {
    if (settled) return;
    settled = true;
    labelEl.textContent = currentValue;
  };

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      commit();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      cancel();
    }
  });
  input.addEventListener('blur', commit);
};
