// 알림(토스트): 한 번에 최대 2개, 넘치면 오래된 것부터 접어요. 전부 강호소식에 남아요.
import { el, esc } from './util.js';
const box = () => document.getElementById('toasts');
export function toast(text, kind = 'info', ms = 3200) {
  const b = box(); if (!b) return;
  while (b.children.length >= 2) b.firstElementChild.remove();
  const n = el(`<div class="toast ${kind}">${esc(text)}</div>`);
  n.addEventListener('click', () => n.remove());
  b.appendChild(n);
  setTimeout(() => { n.classList.add('out'); setTimeout(() => n.remove(), 320); }, ms);
}
