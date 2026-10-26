// 화면 공용 도우미: DOM 만들기, 진동, 초상(수묵 SVG).
export const $ = (s, r = document) => r.querySelector(s);
export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; }
let settingsRef = null;
export function bindSettings(getter) { settingsRef = getter; }
export function haptic(pattern = 12) { if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
  try { if (settingsRef && settingsRef().vibrate && navigator.vibrate) navigator.vibrate(pattern); } catch (e) { /* 진동 미지원 */ }
}
const hashStr = s => { let h = 2166136261; for (const c of String(s)) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
// 사람마다 조금씩 다른 수묵 초상. 장문인은 관(冠), 식객·객경은 삿갓.
export function portrait(p, size = 52) {
  const r = hashStr(p.id + p.name);
  const hair = ['#1d1a16', '#2b2520', '#3a3029'][Math.floor(r * 3)];
  const robe = p.role === 'master' ? '#2E6E73' : p.role === 'sikgaek' ? '#6b5a3e' : p.role === 'gaekgyeong' ? '#4a3a5a' : ['#2E6E73', '#3c5f63', '#46706f'][Math.floor(r * 7) % 3];
  const tilt = (r - 0.5) * 6;
  const hat = p.role === 'master' ? `<path d="M19 13 Q26 4 33 13 Z" fill="#1d1a16"/><rect x="24.5" y="3" width="3" height="6" fill="#1d1a16"/>`
    : (p.role === 'sikgaek' || p.role === 'gaekgyeong') ? `<path d="M8 17 Q26 2 44 17 Q26 13 8 17Z" fill="#5a4a30" opacity=".9"/>` : '';
  const longHair = r > 0.55 ? `<path d="M16 20 Q14 34 18 40 L20 26Z M36 20 Q38 34 34 40 L32 26Z" fill="${hair}" opacity=".85"/>` : '';
  return `<svg viewBox="0 0 52 52" width="${size}" height="${size}" aria-hidden="true"><circle cx="26" cy="26" r="25" fill="#f4ecd9" stroke="#1d1a16" stroke-width="1.6"/>
<g transform="rotate(${tilt.toFixed(1)} 26 26)"><path d="M9 50 Q12 36 26 35 Q40 36 43 50Z" fill="${robe}"/><path d="M22 36 L26 44 L30 36" fill="none" stroke="#f4ecd9" stroke-width="1.6"/>
${longHair}<ellipse cx="26" cy="24" rx="9" ry="10.5" fill="#efdcc0" stroke="#1d1a16" stroke-width="1.1"/>
<path d="M16.5 22 Q17 12 26 12 Q35 12 35.5 22 Q31 16 26 17 Q20 16 16.5 22Z" fill="${hair}"/>
<path d="M21 24 h3 M28 24 h3" stroke="#1d1a16" stroke-width="1.4" stroke-linecap="round"/><path d="M24 30 Q26 31 28 30" stroke="#7a3a2a" stroke-width="1" fill="none"/>${hat}</g>
${p.injured > 0 ? '<path d="M38 8 l6 6 M44 8 l-6 6" stroke="#C2402F" stroke-width="2.4"/>' : ''}</svg>`;
}
// 상대 힌트 아이콘(§5-8): 공=칼끝 위, 변=몸 낮춤, 수=손바닥, 숨=운기
export function hintIcon(kind) {
  const s = { atk: '<path d="M8 30 L28 6 L31 9 L11 33Z" fill="#8a2f2a"/><path d="M6 32 l5 -1 -2 4z" fill="#1d1a16"/>',
    evade: '<path d="M6 28 Q18 14 30 24" stroke="#3d6b47" stroke-width="4" fill="none" stroke-linecap="round"/><circle cx="12" cy="12" r="4" fill="#3d6b47"/>',
    def: '<path d="M12 32 V14 a2 2 0 0 1 4 0 V10 a2 2 0 0 1 4 0 V12 a2 2 0 0 1 4 0 V18 a2 2 0 0 1 4 0 V26 Q28 32 22 33Z" fill="#2f4f6e"/>',
    breath: '<path d="M8 20 Q14 12 20 20 T32 20" stroke="#7b7263" stroke-width="3" fill="none"/><path d="M10 28 Q16 22 22 28 T32 28" stroke="#7b7263" stroke-width="2" fill="none" opacity=".6"/>' }[kind] || '';
  return `<svg viewBox="0 0 36 36">${s}</svg>`;
}
export const HINT_TEXT = { atk: '칼끝이 올라간다', evade: '몸을 낮춘다', def: '손바닥을 세운다', breath: '숨을 고른다' };
// 무인 실루엣(일기토 화면)
export function fighterSvg(color = '#1d1a16', flip = false) {
  return `<svg viewBox="0 0 120 120" style="transform:${flip ? 'scaleY(1)' : ''}"><ellipse cx="60" cy="112" rx="36" ry="5" fill="rgba(0,0,0,.18)"/>
<path d="M60 18 a11 11 0 1 1 -0.1 0Z" fill="${color}"/><path d="M48 36 Q60 30 72 36 L80 74 Q70 70 66 108 L58 108 L56 80 L50 108 L42 108 Q46 74 40 74Z" fill="${color}" opacity=".92"/>
<path d="M72 40 L100 18" stroke="${color}" stroke-width="3" stroke-linecap="round"/><path d="M98 20 L112 6" stroke="#9aa3a3" stroke-width="2.4" stroke-linecap="round"/>
<path d="M48 40 Q30 56 36 70" stroke="${color}" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`;
}
export function fmtSilver(n) { return (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('ko-KR'); }
