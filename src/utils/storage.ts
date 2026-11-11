import { 
  UsersDB, 
  UserBetsDB, 
  ResultsDB, 
  PointHistoryDB, 
  UserToAdminReq, 
  AdminTransfersDB, 
  AdminTxLog,
  GameName,
  BetItem,
  ChartRecord,
  ChartHistoryDB,
  AdminCredentials,
  ResultDeclaredTimesDB,
  GAME_TIMINGS,
  TableRoom,
  GameChallengeRequest,
  PaymentRequest
} from '../types';
import { apiFetch } from './api';

export const DEFAULT_USERS: UsersDB = {};

export function migrateStoredSession() {
  const raw = localStorage.getItem('app_active_session');
  if (!raw) return;
  try {
    const session = JSON.parse(raw);
    if (session && typeof session === 'object') {
      if ('sessionToken' in session) delete session.sessionToken;
      if (typeof session.userId === 'string' && session.userId) session.isAuthenticated = true;
      localStorage.setItem('app_active_session', JSON.stringify(session));
    }
  } catch {
    localStorage.removeItem('app_active_session');
  }

  const cachedUsers = localStorage.getItem('app_users_db');
  if (cachedUsers) {
    try {
      const users = JSON.parse(cachedUsers);
      if (users && typeof users === 'object' && !Array.isArray(users)) {
        let changed = false;
        for (const user of Object.values(users)) {
          if (user && typeof user === 'object' && 'pass' in user && user.pass) {
            user.pass = '';
            changed = true;
          }
        }
        if (changed) localStorage.setItem('app_users_db', JSON.stringify(users));
      }
    } catch {
      console.warn('Unable to scrub cached credentials from local storage.');
    }
  }

  const cachedAdmin = localStorage.getItem('app_admin_credentials');
  if (cachedAdmin) {
    try {
      const admin = JSON.parse(cachedAdmin);
      if (admin && typeof admin === 'object' && admin.pass) {
        admin.pass = '';
        localStorage.setItem('app_admin_credentials', JSON.stringify(admin));
      }
    } catch {
      console.warn('Unable to scrub cached administrator credentials from local storage.');
    }
  }
}

export const DEFAULT_ADMIN: AdminCredentials = {
  username: 'ADMIN',
  pass: ''
};

export const DEFAULT_RESULTS: ResultsDB = {
  'Faridabad': '--',
  'Gaziyabad': '--',
  'Gali': '--',
  'Dishawar': '--',
  'Faridabad Old': '--',
  'Dishawar Old': '--'
};

export function clearCachedServerData() {
  for (const key of [
    'app_users_db',
    'app_user_bets_db',
    'app_results_db',
    'app_result_declared_times_db',
    'app_point_history_db',
    'app_user_to_admin_reqs',
    'app_admin_transfers',
    'app_admin_tx_logs',
    'app_chart_history_db',
    'app_payment_requests',
    'app_admin_payment_qr',
    'app_admin_credentials',
    'app_card_rooms_db',
    'app_card_challenges_db'
  ]) {
    localStorage.removeItem(key);
  }
}

// -----------------------------------------------------------------------------
// CENTRALIZED MULTI-DEVICE SERVER SYNCHRONIZATION ENGINE
// -----------------------------------------------------------------------------
export let lastSyncedServerTimestamp = 0;

export function applyServerStateToLocalStorage(db: any) {
  if (!db || typeof db !== 'object') return;
  try {
    if (db.users) localStorage.setItem('app_users_db', JSON.stringify(db.users));
    if (db.userBets) localStorage.setItem('app_user_bets_db', JSON.stringify(db.userBets));
    if (db.results) localStorage.setItem('app_results_db', JSON.stringify(db.results));
    if (db.resultDeclaredTimes) localStorage.setItem('app_result_declared_times_db', JSON.stringify(db.resultDeclaredTimes));
    if (db.pointHistory) localStorage.setItem('app_point_history_db', JSON.stringify(db.pointHistory));
    if (db.userToAdminReqs) localStorage.setItem('app_user_to_admin_reqs', JSON.stringify(db.userToAdminReqs));
    if (db.adminTransfers) localStorage.setItem('app_admin_transfers', JSON.stringify(db.adminTransfers));
    if (db.adminLogs) localStorage.setItem('app_admin_tx_logs', JSON.stringify(db.adminLogs));
    if (db.chartRecords) localStorage.setItem('app_chart_history_db', JSON.stringify(db.chartRecords));
    if (db.paymentRequests) localStorage.setItem('app_payment_requests', JSON.stringify(db.paymentRequests));
    if (typeof db.adminPaymentQrCode === 'string') localStorage.setItem('app_admin_payment_qr', db.adminPaymentQrCode);
    if (db.adminCreds) localStorage.setItem('app_admin_credentials', JSON.stringify(db.adminCreds));
    if (db.cardRooms) localStorage.setItem('app_card_rooms_db', JSON.stringify(db.cardRooms));
  } catch {}
}

export async function fetchServerState(): Promise<boolean> {
  try {
    const res = await apiFetch('/api/db/sync', { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.success && json.db) {
      applyServerStateToLocalStorage(json.db);
      lastSyncedServerTimestamp = json.lastUpdated || Date.now();
      return true;
    }
  } catch {}
  return false;
}

export async function pushServerPatch(patch: Record<string, any>): Promise<boolean> {
  try {
    const res = await apiFetch('/api/db/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ patch }),
      signal: AbortSignal.timeout(6000)
    });
    if (!res.ok) return false;
    const json = await res.json();
    if (json.success && json.db) {
      applyServerStateToLocalStorage(json.db);
      lastSyncedServerTimestamp = json.lastUpdated || Date.now();
      return true;
    }
  } catch {}
  return false;
}

export async function performServerLogin(username: string, pass: string): Promise<{
  success: boolean;
  isAdmin?: boolean;
  username?: string;
  points?: number;
  passwordResetRequired?: boolean;
  message?: string;
}> {
  try {
    const res = await apiFetch('/api/db/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password: pass }),
      signal: AbortSignal.timeout(6000)
    });
    const json = await res.json();
    if (json.success) {
      if (json.db) {
        applyServerStateToLocalStorage(json.db);
      }
      return {
        success: true,
        isAdmin: !!json.isAdmin,
        username: json.username,
        points: json.points,
        passwordResetRequired: !!json.passwordResetRequired
      };
    } else {
      if (json.db) {
        applyServerStateToLocalStorage(json.db);
      }
      return {
        success: false,
        message: json.message || 'Login asafal raha!'
      };
    }
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error
        ? `Server se sampark nahi hua: ${err.message}`
        : 'Server se sampark nahi hua. Internet ya server check karein.'
    };
  }
}

export async function completePasswordReset(
  username: string,
  isAdmin: boolean,
  currentPass: string,
  newPass: string
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await apiFetch(isAdmin ? '/api/admin/change-creds' : '/api/users/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(isAdmin
        ? { username, currentPass, pass: newPass }
        : { userId: username, currentPass, newPass })
    });
    const json = await response.json();
    return {
      success: response.ok && !!json.success,
      message: json.message || (response.ok ? undefined : 'Password reset was rejected.')
    };
  } catch (err) {
    return {
      success: false,
      message: err instanceof Error ? err.message : 'Password reset failed.'
    };
  }
}

// -------------------------------------------------------------
// USER DATABASE & PASSWORD LOCKOUT (5 ATTEMPTS)
// -------------------------------------------------------------

export function getUsersDB(): UsersDB {
  const data = localStorage.getItem('app_users_db');
  if (!data) {
    saveUsersDB(DEFAULT_USERS);
    return DEFAULT_USERS;
  }
  try {
    const parsed = JSON.parse(data);
    return parsed;
  } catch {
    return DEFAULT_USERS;
  }
}

export function saveUsersDB(db: UsersDB) {
  localStorage.setItem('app_users_db', JSON.stringify(db));
  pushServerPatch({ users: db }).catch(() => {});
}

/**
 * Record a failed password attempt. Locks user after 5 attempts.
 */
export function recordUserFailedLogin(userId: string): { attempts: number; isLocked: boolean } {
  const users = getUsersDB();
  const matchedKey = Object.keys(users).find(k => k.toLowerCase() === userId.toLowerCase());
  if (!matchedKey) {
    return { attempts: 1, isLocked: false };
  }
  const user = users[matchedKey];
  const currentAttempts = (user.failedAttempts || 0) + 1;
  user.failedAttempts = currentAttempts;

  if (currentAttempts >= 5) {
    user.isLocked = true;
    user.lockReason = '5 galat password attempts ke baad ID expire ho gayi hai';
  }

  saveUsersDB(users);
  return { attempts: currentAttempts, isLocked: !!user.isLocked };
}

/**
 * Reset failed attempts on successful login
 */
export function resetUserFailedAttempts(userId: string) {
  const users = getUsersDB();
  const matchedKey = Object.keys(users).find(k => k.toLowerCase() === userId.toLowerCase());
  if (!matchedKey) return;
  users[matchedKey].failedAttempts = 0;
  saveUsersDB(users);
}

/**
 * Update user password (from User Dashboard or Admin Dashboard)
 * Automatically clears lock and resets attempts
 */
export function updateUserPassword(userId: string, newPass: string): boolean {
  const users = getUsersDB();
  const matchedKey = Object.keys(users).find(k => k.toLowerCase() === userId.toLowerCase());
  if (!matchedKey) return false;

  users[matchedKey].pass = newPass;
  users[matchedKey].failedAttempts = 0;
  users[matchedKey].isLocked = false;
  users[matchedKey].lockReason = undefined;

  saveUsersDB(users);
  return true;
}

/**
 * Toggle user active/deactive status directly from Admin Panel
 */
export function toggleUserDeactivation(userId: string, deactivate?: boolean): boolean {
  const users = getUsersDB();
  const matchedKey = Object.keys(users).find(k => k.toLowerCase() === userId.toLowerCase());
  if (!matchedKey) return false;

  const current = !!users[matchedKey].isDeactivated;
  const target = deactivate !== undefined ? deactivate : !current;

  users[matchedKey].isDeactivated = target;
  users[matchedKey].deactivatedReason = target ? 'Admin dwaara account De-Activate kiya gaya hai.' : undefined;

  saveUsersDB(users);
  return true;
}

// -------------------------------------------------------------
// ADMIN CREDENTIALS
// -------------------------------------------------------------

export function getAdminCredentials(): AdminCredentials {
  const data = localStorage.getItem('app_admin_credentials');
  if (!data) return DEFAULT_ADMIN;
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_ADMIN;
  }
}

export function saveAdminCredentials(creds: AdminCredentials) {
  localStorage.setItem('app_admin_credentials', JSON.stringify(creds));
  pushServerPatch({ adminCreds: creds }).catch(() => {});
}

// -------------------------------------------------------------
// BETS & RESULTS & TIMINGS
// -------------------------------------------------------------

export function getUserBetsDB(): UserBetsDB {
  const data = localStorage.getItem('app_user_bets_db');
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function saveUserBetsDB(bets: UserBetsDB) {
  localStorage.setItem('app_user_bets_db', JSON.stringify(bets));
  pushServerPatch({ userBets: bets }).catch(() => {});
}

export function getResultsDB(): ResultsDB {
  const data = localStorage.getItem('app_results_db');
  if (!data) {
    saveResultsDB(DEFAULT_RESULTS);
    return DEFAULT_RESULTS;
  }
  try {
    const parsed = JSON.parse(data);
    if (parsed['Faridabad'] === '34' && parsed['Gaziyabad'] === '78') {
      saveResultsDB(DEFAULT_RESULTS);
      return DEFAULT_RESULTS;
    }
    parsed['Faridabad Old'] = '--';
    parsed['Dishawar Old'] = '--';
    return parsed;
  } catch {
    return DEFAULT_RESULTS;
  }
}

export function saveResultsDB(results: ResultsDB) {
  localStorage.setItem('app_results_db', JSON.stringify(results));
  pushServerPatch({ results }).catch(() => {});
}

export function getResultDeclaredTimesDB(): ResultDeclaredTimesDB {
  const data = localStorage.getItem('app_result_declared_times_db');
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function saveResultDeclaredTimesDB(times: ResultDeclaredTimesDB) {
  localStorage.setItem('app_result_declared_times_db', JSON.stringify(times));
  pushServerPatch({ resultDeclaredTimes: times }).catch(() => {});
}

export function resetGameResult(game: GameName) {
  const results = getResultsDB();
  results[game] = '--';
  saveResultsDB(results);

  // Clear declaration timestamp
  const times = getResultDeclaredTimesDB();
  delete times[game];
  saveResultDeclaredTimesDB(times);
}

export function resetAllActiveResults() {
  const results = getResultsDB();
  results['Faridabad'] = '--';
  results['Gaziyabad'] = '--';
  results['Gali'] = '--';
  results['Dishawar'] = '--';
  saveResultsDB(results);

  const times = getResultDeclaredTimesDB();
  delete times['Faridabad'];
  delete times['Gaziyabad'];
  delete times['Gali'];
  delete times['Dishawar'];
  saveResultDeclaredTimesDB(times);
}

// -------------------------------------------------------------
// GAME BET TIMING & 4-HOUR / 5-MINUTE CLOSURE CHECKS
// -------------------------------------------------------------

/**
 * Parse time string like "5:30 PM", "9:20 PM", "1:00 AM" into minutes from midnight
 */
export function parseTimeToMinutes(timeStr: string): number {
  if (!timeStr) return 0;
  const match = timeStr.trim().match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();

  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

/**
 * Get current Indian Standard Time (IST) in minutes from midnight
 */
export function getCurrentISTMinutes(): { minutesFromMidnight: number; timeString: string } {
  const now = new Date();
  try {
    const istTimeStr = now.toLocaleTimeString('en-US', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit'
    });
    const [h, m] = istTimeStr.split(':');
    const mins = parseInt(h, 10) * 60 + parseInt(m, 10);
    return { minutesFromMidnight: mins, timeString: istTimeStr };
  } catch {
    const mins = now.getHours() * 60 + now.getMinutes();
    return { minutesFromMidnight: mins, timeString: `${now.getHours()}:${now.getMinutes()}` };
  }
}

/**
 * Check if betting is allowed right now on a given game:
 * 1. Coming soon games cannot receive bets.
 * 2. If result was declared within the last 4 hours, betting is locked ("BET TIME OVER").
 * 3. 5 minutes before the game's `lastTime` up to open time, betting is locked ("BET TIME OVER").
 */
export function checkIsGameBettingOpen(game: GameName): { isOpen: boolean; reason?: string } {
  const timing = GAME_TIMINGS[game];
  if (timing?.isComingSoon) {
    return { isOpen: false, reason: 'COMING SOON! Yeh game jald hi live shuru hoga.' };
  }

  const results = getResultsDB();
  const declaredTimes = getResultDeclaredTimesDB();
  const currentResult = results[game];
  const declaredAt = declaredTimes[game];
  const now = Date.now();

  // RULE 1: Result declare hone ke 30 MINUTE baad agle draw ke liye game start ho jaye
  if (currentResult && currentResult !== '--' && declaredAt) {
    const elapsedMs = now - declaredAt;
    const thirtyMinutesMs = 30 * 60 * 1000;
    if (elapsedMs < thirtyMinutesMs) {
      const remainingMs = thirtyMinutesMs - elapsedMs;
      const remMins = Math.ceil(remainingMs / (60 * 1000));
      return {
        isOpen: false,
        reason: `BET TIME OVER! ${game} ka result declare ho chuka hai (${currentResult}). Agle draw ke liye bet 30 minute baad shuru hogi (Shesh: ${remMins} minute).`
      };
    }
  }

  // RULE 2: Last time se 5 minute pehle bet lagna band ho jaye (result aane tak)
  if (timing?.lastTime && timing?.openTime) {
    const lastMinutes = parseTimeToMinutes(timing.lastTime);
    const cutoffMinutes = lastMinutes - 5; // Exactly 5 minutes before lastTime
    const openMinutes = parseTimeToMinutes(timing.openTime);
    const { minutesFromMidnight } = getCurrentISTMinutes();

    if (game === 'Dishawar') {
      // Dishawar: lastTime 1:00 AM (60 min), cutoff 12:55 AM (55 min), openTime 5:00 AM (300 min)
      // Only closed during the draw window: 12:55 AM to 5:00 AM
      if (minutesFromMidnight >= 55 && minutesFromMidnight < 300) {
        return {
          isOpen: false,
          reason: `BET TIME OVER! Dishawar ka last time ${timing.lastTime} hai. 12:55 AM se 5:00 AM result aane tak bet band rehti hai!`
        };
      }
    } else {
      // Standard evening games: Faridabad (5:30 PM), Gaziyabad (9:20 PM), Gali (11:00 PM)
      if (minutesFromMidnight >= cutoffMinutes && minutesFromMidnight < openMinutes) {
        return {
          isOpen: false,
          reason: `BET TIME OVER! ${game} ka last time ${timing.lastTime} hai. Last time se 5 minute pehle bet lagna band ho chuka hai!`
        };
      }
    }
  }

  return { isOpen: true };
}

// -------------------------------------------------------------
// POINT HISTORY & ADMIN TRANSFERS
// -------------------------------------------------------------

export function getPointHistoryDB(): PointHistoryDB {
  const data = localStorage.getItem('app_point_history_db');
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function addPointHistory(uid: string, type: string, pts: number, game?: string) {
  const history = getPointHistoryDB();
  if (!history[uid]) history[uid] = [];
  history[uid].unshift({
    type,
    points: pts,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    game
  });
  if (history[uid].length > 100) {
    history[uid] = history[uid].slice(0, 100);
  }
  localStorage.setItem('app_point_history_db', JSON.stringify(history));
}

export function getUserToAdminReqs(): UserToAdminReq[] {
  const data = localStorage.getItem('app_user_to_admin_reqs');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveUserToAdminReqs(reqs: UserToAdminReq[]) {
  localStorage.setItem('app_user_to_admin_reqs', JSON.stringify(reqs));
  pushServerPatch({ userToAdminReqs: reqs }).catch(() => {});
}

export function getAdminTransfersDB(): AdminTransfersDB {
  const data = localStorage.getItem('app_admin_transfers');
  if (!data) return {};
  try {
    return JSON.parse(data);
  } catch {
    return {};
  }
}

export function saveAdminTransfersDB(transfers: AdminTransfersDB) {
  localStorage.setItem('app_admin_transfers', JSON.stringify(transfers));
  pushServerPatch({ adminTransfers: transfers }).catch(() => {});
}

const TX_LOG_RETENTION_MS = 28 * 60 * 60 * 1000; // 28 hours auto-delete

export function getAdminTxLogs(): AdminTxLog[] {
  const data = localStorage.getItem('app_admin_tx_logs');
  if (!data) return [];
  try {
    const parsed: AdminTxLog[] = JSON.parse(data);
    const now = Date.now();
    const activeLogs = parsed.filter(log => {
      if (!log.timestamp) return true;
      return now - log.timestamp <= TX_LOG_RETENTION_MS;
    });
    if (activeLogs.length !== parsed.length) {
      localStorage.setItem('app_admin_tx_logs', JSON.stringify(activeLogs));
    }
    return activeLogs;
  } catch {
    return [];
  }
}

export function addAdminTxLog(user: string, type: string, pts: number) {
  const logs = getAdminTxLogs();
  logs.unshift({
    user,
    type,
    pts,
    time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
    timestamp: Date.now()
  });
  if (logs.length > 100) {
    logs.splice(100);
  }
  localStorage.setItem('app_admin_tx_logs', JSON.stringify(logs));
}

export interface SettlementResult {
  declaredNumber: string;
  game: GameName;
  winnersCount: number;
  totalPayout: number;
  affectedUsers: string[];
}

/**
 * Calculates win or loss for a bet based on declared 2-digit number
 */
export function checkBetWin(betNum: string, declaredNumber: string): { isWin: boolean; multiplier: number } {
  const cleanDeclared = declaredNumber.padStart(2, '0').slice(-2);
  if (betNum.startsWith('A-')) {
    const targetDigit = betNum.replace('A-', '');
    const firstDigit = cleanDeclared.charAt(0);
    return { isWin: targetDigit === firstDigit, multiplier: 9 };
  } else if (betNum.startsWith('B-')) {
    const targetDigit = betNum.replace('B-', '');
    const secondDigit = cleanDeclared.charAt(1);
    return { isWin: targetDigit === secondDigit, multiplier: 9 };
  } else {
    const cleanBetNum = betNum.padStart(2, '0');
    return { isWin: cleanBetNum === cleanDeclared, multiplier: 90 };
  }
}

/**
 * Declares result for a game, processes all user bets, credits winners, and records timestamp
 */
export function declareGameResult(game: GameName, declaredNumber: string): SettlementResult {
  const formattedNum = declaredNumber.padStart(2, '0').slice(-2);
  
  // 1. Update results DB
  const results = getResultsDB();
  results[game] = formattedNum;
  saveResultsDB(results);

  // 1b. Record timestamp of declaration for 4-hour betting closure
  const declaredTimes = getResultDeclaredTimesDB();
  declaredTimes[game] = Date.now();
  saveResultDeclaredTimesDB(declaredTimes);

  // 2. Evaluate all user bets
  const allBets = getUserBetsDB();
  const usersDB = getUsersDB();
  let winnersCount = 0;
  let totalPayout = 0;
  const affectedUsersSet = new Set<string>();

  for (const uid in allBets) {
    const userBets = allBets[uid];
    let userWinPayout = 0;

    for (const betKey in userBets) {
      const bet: BetItem = userBets[betKey];
      if (bet.game === game && bet.status === 'pending') {
        const { isWin, multiplier } = checkBetWin(bet.num, formattedNum);
        if (isWin) {
          const payout = bet.pts * multiplier;
          bet.status = 'win';
          bet.payout = payout;
          userWinPayout += payout;
          winnersCount++;
          affectedUsersSet.add(uid);
          addPointHistory(uid, `Won ${multiplier}x (${bet.num})`, payout, game);
        } else {
          bet.status = 'loss';
          bet.payout = 0;
          affectedUsersSet.add(uid);
        }
      }
    }

    if (userWinPayout > 0 && usersDB[uid]) {
      usersDB[uid].points = (usersDB[uid].points || 0) + userWinPayout;
      totalPayout += userWinPayout;
    }
  }

  saveUsersDB(usersDB);
  saveUserBetsDB(allBets);

  // 3. Save to Chart History
  recordChartResult(game, formattedNum);

  // Log to Admin Audit
  addAdminTxLog('SYSTEM', `Declared ${game}: ${formattedNum} (Payout: ${totalPayout}P)`, totalPayout);

  return {
    declaredNumber: formattedNum,
    game,
    winnersCount,
    totalPayout,
    affectedUsers: Array.from(affectedUsersSet)
  };
}

const SEEDED_DEMO_RESULTS: Record<string, string[]> = {
  '2026-10-07': ['42', '18', '65', '89'],
  '2026-10-08': ['91', '53', '27', '04'],
  '2026-10-09': ['60', '77', '31', '95'],
  '2026-10-10': ['45', '19', '82', '63'],
  '2026-10-08-server': ['88', '05', '33', '91'],
  '2026-10-09-server': ['12', '77', '49', '28']
};

export function getISTDateParts(date = new Date()) {
  const values = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date).map(part => [part.type, part.value]));
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    date: `${values.year}-${values.month}-${values.day}`
  };
}

export function getRecentISTDateKeys() {
  const today = getISTDateParts().date;
  const yesterday = new Date(`${today}T00:00:00.000Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  return [today, yesterday.toISOString().slice(0, 10)] as const;
}

export function buildCurrentMonthChartRecords(existing: ChartRecord[] = [], now = new Date()): ChartRecord[] {
  const { year, month } = getISTDateParts(now);
  const monthLength = new Date(Date.UTC(Number(year), Number(month), 0)).getUTCDate();
  const records = new Map(existing.map(record => [record.date, { ...record }]));
  for (let day = 1; day <= monthLength; day += 1) {
    const dayNumber = String(day).padStart(2, '0');
    const date = `${year}-${month}-${dayNumber}`;
    const existingRecord = records.get(date);
    if (!existingRecord) records.set(date, {
      date,
      dayNumber: String(day),
      fullDate: `${dayNumber}/${month}/${year}`,
      FBD: '--',
      GALI: '--',
      GZB: '--',
      DISHAWAR: '--'
    });
  }
  return Array.from(records.values()).sort((a, b) => a.date.localeCompare(b.date));
}

function removeSeededDemoChartRecords(records: ChartRecord[]): ChartRecord[] {
  const seedFor = (record: ChartRecord) => {
    if (record.date === '2026-10-08') return SEEDED_DEMO_RESULTS[record.FBD === '88' ? '2026-10-08-server' : record.date];
    if (record.date === '2026-10-09') return SEEDED_DEMO_RESULTS[record.FBD === '12' ? '2026-10-09-server' : record.date];
    return SEEDED_DEMO_RESULTS[record.date];
  };
  return records.filter(record => {
    const seeded = seedFor(record);
    return !seeded || [record.FBD, record.GALI, record.GZB, record.DISHAWAR].some((value, index) => value !== seeded[index]);
  });
}

export const DEFAULT_CHART_HISTORY: ChartRecord[] = buildCurrentMonthChartRecords();

export function getChartHistoryDB(): ChartRecord[] {
  const data = localStorage.getItem('app_chart_history_db');
  if (!data) {
    saveChartHistoryDB(DEFAULT_CHART_HISTORY);
    return DEFAULT_CHART_HISTORY;
  }
  try {
    const records = JSON.parse(data);
    if (!Array.isArray(records)) throw new Error('Chart cache is not an array.');
    const cleaned = buildCurrentMonthChartRecords(removeSeededDemoChartRecords(records));
    return cleaned;
  } catch {
    return DEFAULT_CHART_HISTORY;
  }
}

export function getPaymentRequestsDB(): PaymentRequest[] {
  try {
    const stored = localStorage.getItem('app_payment_requests');
    if (!stored) return [];
    const requests: PaymentRequest[] = JSON.parse(stored);
    return Array.isArray(requests) ? requests.filter(request => request.expiresAt > Date.now()) : [];
  } catch {
    return [];
  }
}

export function getAdminPaymentQrCode(): string {
  return localStorage.getItem('app_admin_payment_qr') || '';
}

export function saveChartHistoryDB(records: ChartRecord[]) {
  localStorage.setItem('app_chart_history_db', JSON.stringify(records));
  pushServerPatch({ chartRecords: records }).catch(() => {});
}

export function recordChartResult(game: GameName, declaredNum: string) {
  const records = getChartHistoryDB();
  const { year, month, day, date: isoDate } = getISTDateParts();
  const dayNumber = String(Number(day));
  const fullDate = `${day}/${month}/${year}`;

  let record = records.find(r => r.date === isoDate);
  if (!record) {
    record = {
      date: isoDate,
      dayNumber,
      fullDate,
      FBD: '--',
      GALI: '--',
      GZB: '--',
      DISHAWAR: '--'
    };
    records.push(record);
  }

  if (game === 'Faridabad') record.FBD = declaredNum;
  else if (game === 'Gali') record.GALI = declaredNum;
  else if (game === 'Gaziyabad') record.GZB = declaredNum;
  else if (game === 'Dishawar') record.DISHAWAR = declaredNum;

  records.sort((a, b) => a.date.localeCompare(b.date));
  saveChartHistoryDB(records);
}

// -------------------------------------------------------------
// TABLE ROOMS & MULTIPLAYER CARD CHALLENGES DB
// -------------------------------------------------------------

export const DEFAULT_ROOMS: TableRoom[] = [
  {
    id: 'room-teenpatti-1',
    name: 'Royal Teen Patti Table #1',
    gameType: 'TEEN_PATTI',
    stake: 20,
    creatorId: 'KK0002',
    creatorName: 'KK0002',
    status: 'WAITING',
    maxPlayers: 3,
    players: ['KK0002'],
    readyPlayers: ['KK0002'],
    activeTurnIndex: 0,
    pot: 20,
    createdAt: Date.now() - 300000,
    logs: ['Table banaya gaya. Stake: 20 Points. Khiladi shamil hone ka intezar hai!']
  },
  {
    id: 'room-maangpatta-1',
    name: 'Maang Patta Table #2',
    gameType: 'MAANG_PATTA',
    stake: 50,
    creatorId: 'KK0003',
    creatorName: 'KK0003',
    status: 'WAITING',
    maxPlayers: 3,
    players: ['KK0003'],
    readyPlayers: ['KK0003'],
    activeTurnIndex: 0,
    pot: 50,
    createdAt: Date.now() - 150000,
    logs: ['Table shuru. Stake: 50 Points. Maang Patta khelne ke liye join karein!']
  }
];

export function getTableRoomsDB(): TableRoom[] {
  const data = localStorage.getItem('app_card_rooms_db');
  if (!data) {
    saveTableRoomsDB(DEFAULT_ROOMS);
    return DEFAULT_ROOMS;
  }
  try {
    return JSON.parse(data);
  } catch {
    return DEFAULT_ROOMS;
  }
}

export function saveTableRoomsDB(rooms: TableRoom[]) {
  localStorage.setItem('app_card_rooms_db', JSON.stringify(rooms));
  pushServerPatch({ cardRooms: rooms }).catch(() => {});
}

export function getChallengeRequestsDB(): GameChallengeRequest[] {
  const data = localStorage.getItem('app_card_challenges_db');
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch {
    return [];
  }
}

export function saveChallengeRequestsDB(reqs: GameChallengeRequest[]) {
  localStorage.setItem('app_card_challenges_db', JSON.stringify(reqs));
}

// -------------------------------------------------------------
// CUSTOM LOGIN BACKGROUND PICTURE
// -------------------------------------------------------------
const LOGIN_BG_KEY = 'app_login_bg_image';

export function getLoginBgImage(): string {
  try {
    return localStorage.getItem(LOGIN_BG_KEY) || '';
  } catch {
    return '';
  }
}

export function saveLoginBgImage(dataUrlOrUrl: string) {
  try {
    if (!dataUrlOrUrl) {
      localStorage.removeItem(LOGIN_BG_KEY);
    } else {
      localStorage.setItem(LOGIN_BG_KEY, dataUrlOrUrl);
    }
  } catch {}
}
