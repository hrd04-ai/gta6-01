// Saving in Palmera Bay: cash, story progress, health and position go to
// localStorage, so a run survives a closed tab. Nothing leaves the browser.

const KEY = 'palmera-bay-save-v1';

export function saveGame(state) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      cash: Math.floor(state.cash),
      missionIndex: state.missionIndex,
      storyDone: state.storyDone,
      health: state.health,
      armed: state.armed,
      x: state.x,
      z: state.z,
      heading: state.heading,
      clockMinutes: state.clockMinutes,
    };
    localStorage.setItem(KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

export function hasSave() {
  return loadGame() !== null;
}
