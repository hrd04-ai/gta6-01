// Save / load through localStorage. Autosaves after each mission and on exit
// to the pause menu; the title screen offers Continue when a save exists.
const KEY = 'palmera-bay-save-v1';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.mission !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function writeSave(state) {
  try {
    const data = {
      mission: state.missionIndex,
      cash: Math.round(state.cash),
      px: +state.player.pos.x.toFixed(1),
      pz: +state.player.pos.z.toFixed(1),
      wanted: state.wanted,
      fares: state.faresDone,
      savedAt: Date.now(),
    };
    window.localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
