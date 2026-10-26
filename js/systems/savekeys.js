// 저장 키(기획 §9 ⑤ Q1, v7.6.3). 본판 murim_save_v7, 미리보기 murim_save_v7_preview.
// murim_save_v5는 예전 v0.5.2 라이브도 쓰므로 예전 형식이면 절대 건드리지 않아요. ls = localStorage 비슷한 것(get/set/removeItem).
export const KEY_LIVE = 'murim_save_v7', KEY_PREVIEW = 'murim_save_v7_preview';
export const KEY_V5 = 'murim_save_v5', KEY_OLD_PREVIEW = 'murim_nd1_preview_save', KEY_BACKUP = 'murim_save_v5_old052';
const parse = s => { try { return JSON.parse(s); } catch (e) { return undefined; } };
export function saveKeyFor(isPreview) { return isPreview ? KEY_PREVIEW : KEY_LIVE; }
// 반환: { raw: 쓸 저장 문자열|null, oldFound: v5에 예전 형식이 있음, moved: 옮겨 온 키 }
export function resolveSave(ls, isPreview, isOurSave) {
  const key = saveKeyFor(isPreview);
  // 한 번 정리: 예전에 만들던 백업(murim_save_v5_old052)
  const bk = ls.getItem(KEY_BACKUP);
  if (bk != null) {
    const v5 = ls.getItem(KEY_V5); const v5s = v5 == null ? null : parse(v5);
    const v5Ours = v5s && isOurSave(v5s);
    if (v5 == null || v5Ours) { if (v5Ours && ls.getItem(key) == null) ls.setItem(key, v5); ls.setItem(KEY_V5, bk); }
    ls.removeItem(KEY_BACKUP);
  }
  let raw = ls.getItem(key), moved = null;
  if (raw == null) {
    for (const k of isPreview ? [KEY_OLD_PREVIEW, KEY_V5] : [KEY_V5]) {
      const r = ls.getItem(k); if (r == null) continue; const s = parse(r);
      if (s && isOurSave(s)) { ls.setItem(key, r); ls.removeItem(k); raw = r; moved = k; break; }
    }
  }
  const v5 = ls.getItem(KEY_V5); const v5s = v5 == null ? null : parse(v5);
  const oldFound = v5 != null && !(v5s && isOurSave(v5s));
  return { key, raw, oldFound, moved };
}
