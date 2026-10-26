// §11 화면 이름: 별호 우선(기본) / 도호 / 속명
export function displayName(p, mode = 'byeolho') {
  if (!p) return '';
  if (mode === 'byeolho') return p.byeolho || p.name || p.doho;
  if (mode === 'doho') return p.doho || p.name;
  return p.name || p.doho;
}
export function fullLabel(p) { // 인물 카드용: 속명(도호) · 별호/별명
  const parts = [p.name + (p.doho ? `(${p.doho})` : '')];
  if (p.byeolho) parts.push(`'${p.byeolho}'`); else if (p.nick) parts.push(`별명 '${p.nick}'`);
  return parts.join(' · ');
}
export const BYEOLHO_POOL = ['청송검', '운하검', '비연', '청류검', '송풍검', '낙하검', '월하검', '청람검'];
