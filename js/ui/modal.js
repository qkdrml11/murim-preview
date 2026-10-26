// 창(모달) 줄 세우기: 한 번에 하나, 뜬 뒤 250ms는 눌러도 무시(잘못 누름 방지 §5-8).
import { el, esc, haptic } from './util.js';
const queue = []; let current = null;
const layer = () => document.getElementById('modalLayer');
export function modal(spec) { return new Promise(res => { queue.push({ spec, res }); pump(); }); }
export const modalOpen = () => !!current || queue.length > 0;
function pump() {
  if (current || !queue.length) return;
  current = queue.shift();
  const { spec } = current;
  const node = el(`<div class="modal-bg" role="dialog" aria-modal="true"><div class="modal ${spec.cls || ''}">
    ${spec.title ? `<h3>${esc(spec.title)}</h3>` : ''}<div class="body">${spec.html ?? esc(spec.body || '')}</div>
    <div class="btns ${spec.horizontal ? 'h' : ''}">${(spec.choices || [{ id: 'ok', label: '확인', primary: true }]).map(c =>
      `<button class="btn ${c.primary ? 'pri' : ''} ${c.danger ? 'red' : ''} ${c.focus ? 'focus' : ''}" data-id="${esc(c.id)}" ${c.disabled ? 'disabled' : ''}>${esc(c.label)}</button>`).join('')}</div></div></div>`);
  const opened = performance.now();
  node.addEventListener('click', e => {
    const b = e.target.closest('button[data-id]'); if (!b || b.disabled) return;
    if (performance.now() - opened < 250) return;
    haptic(10); close(b.dataset.id);
  });
  if (spec.mount) spec.mount(node, close);
  layer().appendChild(node);
  function close(id) {
    if (!current) return;
    node.remove(); const c = current; current = null; c.res(id); setTimeout(pump, 40);
  }
}
