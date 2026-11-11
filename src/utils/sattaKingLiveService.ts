import { GameName } from '../types';
import { applyServerStateToLocalStorage, SettlementResult } from './storage';
import { apiFetch } from './api';

export interface LiveGameInfo {
  code: 'FB' | 'GB' | 'GL' | 'DS';
  name: 'Faridabad' | 'Gaziyabad' | 'Gali' | 'Dishawar';
  openTime: string;
  todayNumber: string;
  yesterdayNumber: string;
  isDeclaredToday: boolean;
  status: 'declared' | 'waiting';
}

export interface LiveApiResponse {
  success: boolean;
  source: string;
  fetchedAt: string;
  todayDate: string;
  games: Record<string, LiveGameInfo>;
  simulationOverrides?: Record<string, string>;
}

export interface LiveSyncSettings {
  autoSyncEnabled: boolean;
  pollIntervalSeconds: number;
  lastSyncTimestamp?: number;
  lastSyncStatus?: 'success' | 'error' | 'idle';
  lastSyncError?: string;
}

const SETTINGS_KEY = 'app_satta_live_sync_settings';

const DEFAULT_SETTINGS: LiveSyncSettings = {
  autoSyncEnabled: true,
  pollIntervalSeconds: 20,
  lastSyncStatus: 'idle'
};

export function getLiveSyncSettings(): LiveSyncSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY);
    if (raw) return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {}
  return DEFAULT_SETTINGS;
}

export function saveLiveSyncSettings(partial: Partial<LiveSyncSettings>) {
  const current = getLiveSyncSettings();
  const next = { ...current, ...partial };
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  return next;
}

/**
 * Fetch live data from server proxy
 */
export async function fetchLiveSattaKingResults(): Promise<LiveApiResponse> {
  try {
    const res = await apiFetch('/api/satta-king-live', {
      headers: { 'Accept': 'application/json' }
    });
    if (!res.ok) {
      throw new Error(`Server returned HTTP ${res.status}`);
    }
    const data: LiveApiResponse = await res.json();
    return data;
  } catch (err: any) {
    console.error('fetchLiveSattaKingResults failed:', err);
    throw err;
  }
}

/**
 * Trigger simulated override on server (for testing outside draw hours)
 */
export async function simulateLiveGameResult(game: GameName, number: string): Promise<boolean> {
  try {
    const res = await apiFetch('/api/satta-king-simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, number })
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Reset server simulation back to live site data
 */
export async function resetLiveGameSimulation(): Promise<boolean> {
  try {
    const res = await apiFetch('/api/satta-king-simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true })
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Remove / Clear declared live result for a specific game
 */
export async function clearLiveGameResult(game: GameName): Promise<boolean> {
  try {
    const res = await apiFetch('/api/satta-king-simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ game, clear: true })
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface SyncOutcomeItem {
  game: GameName;
  number: string;
  isNewDeclaration: boolean;
  settlement?: SettlementResult;
}

/**
 * Perform a live check and automatically declare any newly published result
 */
export async function processLiveSyncCheck(): Promise<{
  data: LiveApiResponse;
  newDeclarations: SyncOutcomeItem[];
}> {
  const response = await apiFetch('/api/satta-king-live-sync', {
    method: 'POST',
    headers: { 'Accept': 'application/json' }
  });
  if (!response.ok) {
    throw new Error(`Live result sync failed with HTTP ${response.status}`);
  }

  const payload: LiveApiResponse & {
    success: boolean;
    newDeclarations: SyncOutcomeItem[];
    db?: unknown;
  } = await response.json();
  if (!payload.success || !payload.db || !Array.isArray(payload.newDeclarations)) {
    throw new Error('Live result sync returned an invalid server response');
  }
  applyServerStateToLocalStorage(payload.db);

  saveLiveSyncSettings({
    lastSyncTimestamp: Date.now(),
    lastSyncStatus: 'success',
    lastSyncError: undefined
  });

  return { data: payload, newDeclarations: payload.newDeclarations };
}
