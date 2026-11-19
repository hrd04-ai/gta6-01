// Save and load for Palmera Bay: Sunset Heat.
// Progress lives in localStorage as one small JSON document: cash,
// completed missions, best stats and settings. Nothing else is kept,
// and a corrupt document falls back to a fresh start instead of
// crashing the game.

import { SAVE_KEY, ECONOMY } from './config.js';

export function defaultSave() {
  return {
    version: 1,
    cash: ECONOMY.startCash,
    completedMissions: [],
    totalEarned: 0,
    missionsDone: 0,
    carsStolen: 0,
    bestWanted: 0,
    playSeconds: 0,
    muted: false,
    musicOn: true,
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return defaultSave();
    const save = defaultSave();
    for (const key of Object.keys(save)) {
      if (key in parsed) save[key] = parsed[key];
    }
    if (!Array.isArray(save.completedMissions)) save.completedMissions = [];
    return save;
  } catch {
    return defaultSave();
  }
}

export function writeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
    return true;
  } catch {
    return false;
  }
}

export function eraseSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage may be unavailable in a sandboxed frame; ignore.
  }
  return defaultSave();
}

export function missionCompleted(save, missionId) {
  if (!save.completedMissions.includes(missionId)) save.completedMissions.push(missionId);
  save.missionsDone = save.completedMissions.length;
}
