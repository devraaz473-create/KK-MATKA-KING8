import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const defaultDBPath = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, 'server-db.json')
  : path.join(__dirname, '.local-data', 'server-db.json');
const DB_PATH = path.resolve(process.env.DB_PATH || defaultDBPath);
const SESSION_COOKIE = 'kk_session';
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_LOGIN_FAILURES = 5;
const PASSWORD_MIN_LENGTH = 12;

type Account = {
  pass: string;
  points: number;
  failedAttempts?: number;
  isLocked?: boolean;
  isDeactivated?: boolean;
  passwordResetRequired?: boolean;
  [key: string]: unknown;
};

type Actor = { userId: string; isAdmin: boolean; sessionKey: string; passwordResetRequired: boolean };
type AppRequest = express.Request & { actor?: Actor };
type ServerDB = {
  schemaVersion: number;
  users: Record<string, Account>;
  userBets: Record<string, any>;
  pointHistory: Record<string, any[]>;
  results: Record<string, string>;
  resultDeclaredTimes: Record<string, number>;
  chartRecords: any[];
  adminCreds: { username: string; pass: string };
  adminPasswordResetRequired: boolean;
  adminFailedAttempts: number;
  adminTransfers: Record<string, any[]>;
  adminLogs: any[];
  userToAdminReqs: any[];
  cardRooms: any[];
  activeSessions: Record<string, { userId: string; isAdmin: boolean; createdAt: number; expiresAt: number }>;
  paymentRequests: any[];
  paymentQr: string;
  lastUpdated: number;
  [key: string]: any;
};

const DEFAULT_RESULTS = {
  Faridabad: '--', Gaziyabad: '--', Gali: '--', Dishawar: '--',
  'Faridabad Old': '--', 'Dishawar Old': '--'
};
const emptyDB = (): ServerDB => ({
  schemaVersion: 2,
  users: {},
  userBets: {},
  pointHistory: {},
  results: { ...DEFAULT_RESULTS },
  resultDeclaredTimes: {},
  chartRecords: [],
  adminCreds: { username: '', pass: '' },
  adminPasswordResetRequired: false,
  adminFailedAttempts: 0,
  adminTransfers: {},
  adminLogs: [],
  userToAdminReqs: [],
  cardRooms: [],
  activeSessions: {},
  paymentRequests: [],
  paymentQr: '',
  lastUpdated: Date.now()
});

function isRecord(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString('hex')}$${key.toString('hex')}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const match = /^scrypt\$(\d+)\$(\d+)\$(\d+)\$([a-f0-9]{32})\$([a-f0-9]{128})$/i.exec(stored);
  if (!match) return false;
  const [, n, r, p, saltHex, hashHex] = match;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length, {
    N: Number(n), r: Number(r), p: Number(p), maxmem: 64 * 1024 * 1024
  });
  return crypto.timingSafeEqual(actual, expected);
}

function isPasswordHash(value: unknown): value is string {
  return typeof value === 'string' && /^scrypt\$16384\$8\$1\$[a-f0-9]{32}\$[a-f0-9]{128}$/i.test(value);
}

function saveServerDB(db: ServerDB): void {
  db.lastUpdated = Date.now();
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const tempPath = `${DB_PATH}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(db, null, 2), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
  try {
    fs.renameSync(tempPath, DB_PATH);
    if (process.platform !== 'win32') fs.chmodSync(DB_PATH, 0o600);
  } catch (error) {
    try { fs.unlinkSync(tempPath); } catch { /* The original persistence error is more useful. */ }
    throw error;
  }
}

function initializeDB(): ServerDB {
  const username = (process.env.ADMIN_USERNAME || '').trim();
  const password = process.env.ADMIN_PASSWORD || '';
  if (process.env.DB_INITIALIZE !== 'true') {
    throw new Error('Database does not exist. Set DB_INITIALIZE=true and strong ADMIN_USERNAME/ADMIN_PASSWORD only for first-time setup.');
  }
  if (!username || password.length < PASSWORD_MIN_LENGTH) {
    throw new Error(`Initial admin credentials are invalid. ADMIN_PASSWORD must be at least ${PASSWORD_MIN_LENGTH} characters.`);
  }
  const db = emptyDB();
  db.adminCreds = { username, pass: hashPassword(password) };
  saveServerDB(db);
  return db;
}

function migrateDB(input: unknown): ServerDB {
  if (!isRecord(input) || !isRecord(input.users) || !isRecord(input.adminCreds) ||
      typeof input.adminCreds.username !== 'string' || typeof input.adminCreds.pass !== 'string') {
    throw new Error('Database has an unsupported structure; refusing to replace or initialize it.');
  }
  const db = { ...emptyDB(), ...input } as ServerDB;
  db.schemaVersion = 2;
  db.users = input.users as Record<string, Account>;
  for (const [userId, account] of Object.entries(db.users)) {
    if (!isRecord(account) || typeof account.pass !== 'string') {
      throw new Error(`Invalid account record for ${userId}; refusing to continue.`);
    }
    if (!isPasswordHash(account.pass)) {
      account.pass = hashPassword(account.pass);
      account.passwordResetRequired = true;
    } else if (account.passwordResetRequired !== true && input.schemaVersion !== 2) {
      account.passwordResetRequired = true;
    }
    account.failedAttempts = Number.isSafeInteger(account.failedAttempts) ? account.failedAttempts : 0;
    account.isLocked = Boolean(account.isLocked);
    account.isDeactivated = Boolean(account.isDeactivated);
  }
  if (!isPasswordHash(db.adminCreds.pass)) {
    db.adminCreds.pass = hashPassword(db.adminCreds.pass);
    db.adminPasswordResetRequired = true;
  } else if (db.adminPasswordResetRequired !== true && input.schemaVersion !== 2) {
    db.adminPasswordResetRequired = true;
  }
  db.adminFailedAttempts = Number.isSafeInteger(input.adminFailedAttempts) ? input.adminFailedAttempts : 0;
  db.activeSessions = input.schemaVersion === 2 && isRecord(input.activeSessions) ? input.activeSessions : {};
  db.userBets = isRecord(input.userBets) ? input.userBets : {};
  db.pointHistory = isRecord(input.pointHistory) ? input.pointHistory : {};
  db.results = isRecord(input.results) ? { ...DEFAULT_RESULTS, ...input.results } : { ...DEFAULT_RESULTS };
  db.resultDeclaredTimes = isRecord(input.resultDeclaredTimes) ? input.resultDeclaredTimes : {};
  db.chartRecords = Array.isArray(input.chartRecords) ? input.chartRecords : [];
  db.adminTransfers = isRecord(input.adminTransfers) ? input.adminTransfers : {};
  db.adminLogs = Array.isArray(input.adminLogs) ? input.adminLogs : [];
  db.userToAdminReqs = Array.isArray(input.userToAdminReqs) ? input.userToAdminReqs : [];
  db.cardRooms = Array.isArray(input.cardRooms) ? input.cardRooms : [];
  db.paymentRequests = Array.isArray(input.paymentRequests) ? input.paymentRequests : [];
  db.paymentQr = typeof input.paymentQr === 'string' ? input.paymentQr : '';
  return db;
}

function loadServerDB(): ServerDB {
  if (!fs.existsSync(DB_PATH)) return initializeDB();
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('Database JSON is malformed; refusing to overwrite it.');
  }
  const db = migrateDB(parsed);
  if ((parsed as any).schemaVersion !== 2) {
    db.activeSessions = {};
    saveServerDB(db);
  }
  return db;
}

const serverDBState = loadServerDB();
const sseClients = new Map<express.Response, Actor>();
const loginAttempts = new Map<string, { count: number; startedAt: number }>();

function safeUserSnapshot(db: ServerDB, actor: Actor): ServerDB {
  const snapshot = structuredClone(db) as ServerDB;
  for (const user of Object.values(snapshot.users)) user.pass = '';
  snapshot.adminCreds = { username: snapshot.adminCreds.username, pass: '' };
  snapshot.adminPaymentQrCode = snapshot.paymentQr;
  snapshot.activeSessions = {};
  if (!actor.isAdmin) {
    const userId = actor.userId;
    snapshot.users = Object.hasOwn(snapshot.users, userId) ? { [userId]: snapshot.users[userId] } : {};
    for (const key of ['userBets', 'pointHistory', 'adminTransfers']) {
      snapshot[key] = Object.hasOwn(snapshot[key], userId) ? { [userId]: snapshot[key][userId] } : {};
    }
    snapshot.userToAdminReqs = snapshot.userToAdminReqs.filter((item: any) => item?.user === userId || item?.userId === userId);
    snapshot.paymentRequests = snapshot.paymentRequests.filter((item: any) => item?.userId === userId);
    snapshot.adminLogs = [];
    snapshot.cardRooms = snapshot.cardRooms
      .filter((room: any) => Array.isArray(room?.players) && room.players.includes(userId))
      .map((room: any) => ({
        ...room,
        cardsDealt: room.cardsDealt && Object.hasOwn(room.cardsDealt, userId)
          ? { [userId]: room.cardsDealt[userId] }
          : undefined
      }));
  }
  return snapshot;
}

function actorNeedsReset(actor: Actor): boolean {
  return actor.isAdmin ? serverDBState.adminPasswordResetRequired : Boolean(serverDBState.users[actor.userId]?.passwordResetRequired);
}

function cookieToken(req: express.Request): string {
  const cookie = req.headers.cookie || '';
  const pair = cookie.split(';').map(part => part.trim()).find(part => part.startsWith(`${SESSION_COOKIE}=`));
  return pair ? decodeURIComponent(pair.slice(SESSION_COOKIE.length + 1)) : '';
}

function clearSessionCookie(res: express.Response): void {
  const production = process.env.NODE_ENV === 'production';
  const secure = production ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=${production ? 'None' : 'Lax'}; Max-Age=0${secure}`);
}

function setSessionCookie(res: express.Response, token: string): void {
  const production = process.env.NODE_ENV === 'production';
  const secure = production ? '; Secure' : '';
  res.setHeader('Set-Cookie', `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=${production ? 'None' : 'Lax'}; Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}${secure}`);
}

function authenticate(req: express.Request): Actor | null {
  const token = cookieToken(req);
  if (!token) return null;
  const key = crypto.createHash('sha256').update(token).digest('hex');
  const session = serverDBState.activeSessions[key];
  if (!session) return null;
  if (session.expiresAt <= Date.now()) {
    delete serverDBState.activeSessions[key];
    saveServerDB(serverDBState);
    return null;
  }
  if (!session.isAdmin && (!serverDBState.users[session.userId] ||
      serverDBState.users[session.userId].isLocked || serverDBState.users[session.userId].isDeactivated)) return null;
  return {
    userId: session.userId,
    isAdmin: session.isAdmin,
    sessionKey: key,
    passwordResetRequired: actorNeedsReset({
      userId: session.userId, isAdmin: session.isAdmin, sessionKey: key, passwordResetRequired: false
    })
  };
}

function error(res: express.Response, status: number, message: string): void {
  res.status(status).json({ success: false, message });
}

function sendSnapshot(res: express.Response, actor: Actor): void {
  res.json({ success: true, db: safeUserSnapshot(serverDBState, actor), lastUpdated: serverDBState.lastUpdated });
}

function broadcast(reason: string, details: Record<string, unknown> = {}, privateUserId?: string): void {
  for (const [client, actor] of sseClients) {
    const data: Record<string, unknown> = { reason, db: safeUserSnapshot(serverDBState, actor) };
    if (actor.isAdmin || !privateUserId || actor.userId === privateUserId) Object.assign(data, details);
    try {
      client.write(`event: db_update\ndata: ${JSON.stringify(data)}\n\n`);
    } catch {
      sseClients.delete(client);
    }
  }
}

function isStrongPassword(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length >= PASSWORD_MIN_LENGTH && value.length <= 256 && !/[\u0000-\u001f]/.test(value);
}

function requireAdmin(req: AppRequest, res: express.Response): boolean {
  if (!req.actor?.isAdmin) {
    error(res, 403, 'Administrator access is required.');
    return false;
  }
  return true;
}

function validPatch(patch: unknown): patch is Record<string, any> {
  if (!isRecord(patch) || Object.keys(patch).length === 0) return false;
  const allowed = new Set([
    'users', 'userBets', 'results', 'resultDeclaredTimes', 'pointHistory',
    'userToAdminReqs', 'adminTransfers', 'adminLogs', 'chartRecords',
    'paymentRequests', 'adminPaymentQrCode', 'cardRooms'
  ]);
  if (Object.keys(patch).some(key => !allowed.has(key))) return false;
  if (patch.users !== undefined) {
    if (!isRecord(patch.users)) return false;
    for (const [id, user] of Object.entries(patch.users)) {
      if (!/^[A-Z0-9_-]{1,40}$/i.test(id) || !isRecord(user) || 'pass' in user) return false;
      if (user.points !== undefined && (!Number.isFinite(user.points) || user.points < 0)) return false;
    }
  }
  if (patch.userBets !== undefined) {
    if (!isRecord(patch.userBets)) return false;
    for (const bets of Object.values(patch.userBets)) {
      const entries = Array.isArray(bets) ? bets : isRecord(bets) ? Object.values(bets) : null;
      if (!entries || entries.some((bet: any) => !isRecord(bet) ||
          ((bet.points !== undefined || bet.pts !== undefined) &&
            (!Number.isFinite(Number(bet.points ?? bet.pts)) || Number(bet.points ?? bet.pts) < 0)))) return false;
    }
  }
  if (patch.results !== undefined && !isRecord(patch.results)) return false;
  if (patch.resultDeclaredTimes !== undefined && !isRecord(patch.resultDeclaredTimes)) return false;
  if (patch.pointHistory !== undefined && !isRecord(patch.pointHistory)) return false;
  if (patch.userToAdminReqs !== undefined && !Array.isArray(patch.userToAdminReqs)) return false;
  if (patch.adminTransfers !== undefined && !isRecord(patch.adminTransfers)) return false;
  if (patch.adminLogs !== undefined && !Array.isArray(patch.adminLogs)) return false;
  if (patch.chartRecords !== undefined && !Array.isArray(patch.chartRecords)) return false;
  if (patch.paymentRequests !== undefined && !Array.isArray(patch.paymentRequests)) return false;
  if (patch.cardRooms !== undefined && !Array.isArray(patch.cardRooms)) return false;
  if (patch.adminPaymentQrCode !== undefined && typeof patch.adminPaymentQrCode !== 'string') return false;
  return true;
}

function mergePatch(patch: Record<string, any>): void {
  if (patch.users) {
    for (const [id, values] of Object.entries(patch.users)) {
      if (!serverDBState.users[id] || !isRecord(values)) continue;
      const { pass: _ignored, passwordResetRequired: _resetIgnored, ...safeValues } = values;
      serverDBState.users[id] = { ...serverDBState.users[id], ...safeValues };
    }
  }
  for (const key of ['userBets', 'results', 'resultDeclaredTimes', 'pointHistory', 'adminTransfers'] as const) {
    if (patch[key]) serverDBState[key] = { ...serverDBState[key], ...patch[key] };
  }
  for (const key of ['userToAdminReqs', 'adminLogs', 'chartRecords', 'paymentRequests', 'cardRooms'] as const) {
    if (patch[key]) serverDBState[key] = patch[key];
  }
  if (patch.adminPaymentQrCode !== undefined) serverDBState.paymentQr = patch.adminPaymentQrCode;
}

async function startServer(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    const publicUrl = process.env.APP_URL || '';
    let url: URL;
    try { url = new URL(publicUrl); } catch { throw new Error('Production requires APP_URL to be a valid HTTPS origin.'); }
    if (url.protocol !== 'https:' || url.pathname !== '/' || url.search || url.hash) {
      throw new Error('Production APP_URL must be an HTTPS origin without a path, query, or fragment.');
    }
  }

  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '10mb', strict: true }));

  const allowedOrigins = new Set<string>();
  const configuredOrigins = [process.env.APP_URL || '', ...(process.env.CORS_ORIGINS || '').split(',')];
  for (const value of configuredOrigins) {
    if (!value.trim()) continue;
    let origin: URL;
    try { origin = new URL(value.trim()); } catch { throw new Error(`Invalid CORS origin: ${value}`); }
    if ((process.env.NODE_ENV === 'production' && origin.protocol !== 'https:') ||
        origin.pathname !== '/' || origin.search || origin.hash || origin.username || origin.password) {
      throw new Error(`CORS origins must be HTTPS origins without a path: ${value}`);
    }
    allowedOrigins.add(origin.origin);
  }
  allowedOrigins.add('capacitor://localhost');
  allowedOrigins.add('https://localhost');
  if (process.env.NODE_ENV !== 'production') allowedOrigins.add('http://localhost');

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Cache-Control', 'no-store');
    const origin = req.headers.origin;
    if (origin && !allowedOrigins.has(origin)) {
      error(res, 403, 'Origin is not allowed.');
      return;
    }
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Vary', 'Origin');
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');
    if (req.method === 'OPTIONS') {
      res.sendStatus(204);
      return;
    }
    next();
  });

  app.use('/api', (req: AppRequest, res, next) => {
    if (req.path === '/db/login' || req.path === '/login') {
      next();
      return;
    }
    const actor = authenticate(req);
    if (!actor) {
      error(res, 401, 'Please sign in again.');
      return;
    }
    req.actor = actor;
    const isPasswordChange = req.path === '/admin/change-creds' || req.path === '/users/change-password';
    if (actor.passwordResetRequired && !isPasswordChange && req.path !== '/auth/logout') {
      error(res, 403, 'Set a new password before continuing.');
      return;
    }
    next();
  });

  const handleLogin = (req: express.Request, res: express.Response) => {
    const body = isRecord(req.body) ? req.body : {};
    const username = String(body.username || body.userId || '').trim();
    const password = typeof body.password === 'string' ? body.password : typeof body.pass === 'string' ? body.pass : '';
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const attempts = loginAttempts.get(ip);
    if (attempts && now - attempts.startedAt < 15 * 60 * 1000 && attempts.count >= 20) {
      error(res, 429, 'Too many sign-in attempts. Try again later.');
      return;
    }
    if (!username || !password || password.length > 256) {
      error(res, 401, 'Invalid user ID or password.');
      return;
    }

    const isAdmin = username.toUpperCase() === serverDBState.adminCreds.username.toUpperCase();
    const userId = isAdmin ? serverDBState.adminCreds.username : username.toUpperCase();
    const account = isAdmin ? null : serverDBState.users[userId];
    const locked = isAdmin
      ? serverDBState.adminFailedAttempts >= MAX_LOGIN_FAILURES
      : (!account || account.isLocked || account.isDeactivated);
    const storedHash = isAdmin ? serverDBState.adminCreds.pass : account?.pass || '';
    const valid = !locked && verifyPassword(password, storedHash);
    loginAttempts.set(ip, attempts && now - attempts.startedAt < 15 * 60 * 1000
      ? { count: attempts.count + 1, startedAt: attempts.startedAt }
      : { count: 1, startedAt: now });
    if (!valid) {
      if (account) {
        account.failedAttempts = (account.failedAttempts || 0) + 1;
        if (account.failedAttempts >= MAX_LOGIN_FAILURES) account.isLocked = true;
      }
      if (isAdmin) serverDBState.adminFailedAttempts++;
      if (account || isAdmin) saveServerDB(serverDBState);
      error(res, 401, 'Invalid user ID or password.');
      return;
    }
    loginAttempts.delete(ip);
    if (account) account.failedAttempts = 0;
    if (isAdmin) serverDBState.adminFailedAttempts = 0;
    const token = crypto.randomBytes(32).toString('base64url');
    const key = crypto.createHash('sha256').update(token).digest('hex');
    const session = { userId, isAdmin, createdAt: now, expiresAt: now + SESSION_TTL_MS };
    serverDBState.activeSessions[key] = session;
    saveServerDB(serverDBState);
    const actor: Actor = {
      userId, isAdmin, sessionKey: key,
      passwordResetRequired: isAdmin ? serverDBState.adminPasswordResetRequired : Boolean(account?.passwordResetRequired)
    };
    setSessionCookie(res, token);
    res.json({
      success: true,
      isAdmin,
      username: userId,
      userId,
      displayName: account?.displayName || userId,
      points: account?.points || (isAdmin ? 2500000 : 0),
      role: isAdmin ? 'admin' : account?.role || 'player',
      passwordResetRequired: actor.passwordResetRequired,
      db: safeUserSnapshot(serverDBState, actor)
    });
    broadcast('SESSION_CHANGED');
  };
  app.post('/api/db/login', handleLogin);
  app.post('/api/login', handleLogin);

  app.post('/api/auth/logout', (req: AppRequest, res) => {
    if (req.actor) delete serverDBState.activeSessions[req.actor.sessionKey];
    saveServerDB(serverDBState);
    clearSessionCookie(res);
    res.json({ success: true });
  });

  app.get('/api/realtime/stream', (req: AppRequest, res) => {
    const actor = req.actor!;
    res.status(200).set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-store',
      Connection: 'keep-alive'
    });
    res.flushHeaders();
    res.write(`event: init\ndata: ${JSON.stringify({ db: safeUserSnapshot(serverDBState, actor) })}\n\n`);
    sseClients.set(res, actor);
    req.on('close', () => sseClients.delete(res));
  });

  const handleSaveUser = (req: AppRequest, res: express.Response) => {
    if (!requireAdmin(req, res)) return;
    const body = req.body || {};
    const userId = String(body.username || body.userId || '').trim().toUpperCase();
    const password = typeof body.pass === 'string' ? body.pass : '';
    if (!/^KK00\d{4,28}$/.test(userId) || !isStrongPassword(password)) {
      error(res, 400, `New user IDs must be KK00 followed by digits; temporary passwords must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      return;
    }
    if (serverDBState.users[userId]) {
      error(res, 409, 'That user ID already exists.');
      return;
    }
    serverDBState.users[userId] = {
      pass: hashPassword(password),
      points: Number.isFinite(Number(body.points)) ? Math.max(0, Number(body.points)) : 0,
      failedAttempts: 0,
      isLocked: false,
      isDeactivated: false,
      passwordResetRequired: true,
      displayName: String(body.displayName || userId).slice(0, 80),
      role: 'player',
      createdAt: new Date().toISOString()
    };
    saveServerDB(serverDBState);
    broadcast('USER_CREATED', { userId }, userId);
    res.json({ success: true, username: userId, user: { id: userId, points: serverDBState.users[userId].points }, db: safeUserSnapshot(serverDBState, req.actor!) });
  };
  app.post('/api/users/save', handleSaveUser);
  app.post('/api/admin/create-user', handleSaveUser);

  const handleCredit = (req: AppRequest, res: express.Response) => {
    if (!requireAdmin(req, res)) return;
    const body = req.body || {};
    const userId = String(body.targetUser || body.targetUserId || '').trim().toUpperCase();
    const points = Number(body.points);
    const account = serverDBState.users[userId];
    if (!account || !Number.isFinite(points) || points === 0 || !Number.isSafeInteger(points) || account.points + points < 0) {
      error(res, 400, 'Invalid account or points amount.');
      return;
    }
    account.points += points;
    const time = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
    serverDBState.adminLogs.unshift({ id: crypto.randomUUID(), user: 'ADMIN', type: `Points adjustment for ${userId}`, points, time, timestamp: Date.now() });
    serverDBState.pointHistory[userId] ||= [];
    serverDBState.pointHistory[userId].unshift({ type: 'Admin adjustment', points, time });
    saveServerDB(serverDBState);
    broadcast('POINTS_UPDATED', { targetUser: userId, points }, userId);
    res.json({ success: true, targetUserId: userId, targetUser: userId, newBalance: account.points, points: account.points, db: safeUserSnapshot(serverDBState, req.actor!) });
  };
  app.post('/api/points/admin-credit', handleCredit);
  app.post('/api/admin/transfer-points', handleCredit);

  app.post('/api/bets/place', (req: AppRequest, res) => {
    const actor = req.actor!;
    if (actor.isAdmin) return error(res, 403, 'Player access is required.');
    const account = serverDBState.users[actor.userId];
    const staged = req.body?.stagedBets;
    if (!Array.isArray(staged) || staged.length === 0 || staged.length > 100) return error(res, 400, 'Invalid bet list.');
    const total = staged.reduce((sum: number, bet: any) => sum + Number(bet?.points), 0);
    if (!Number.isSafeInteger(total) || total <= 0 || total > account.points ||
        staged.some((bet: any) => !isRecord(bet) || !Number.isSafeInteger(Number(bet.points)) || Number(bet.points) <= 0)) {
      return error(res, 400, 'Invalid bet amount or insufficient points.');
    }
    account.points -= total;
    serverDBState.userBets[actor.userId] ||= [];
    const time = new Date();
    for (const bet of staged) {
      serverDBState.userBets[actor.userId].unshift({
        id: crypto.randomUUID(), game: String(bet.game || req.body?.game || ''),
        type: String(bet.type || ''), number: String(bet.number || ''),
        points: Number(bet.points), timestamp: Date.now(),
        timeStr: time.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
        dateStr: time.toISOString().slice(0, 10), settled: false
      });
    }
    saveServerDB(serverDBState);
    broadcast('BETS_PLACED', { userId: actor.userId, newPoints: account.points }, actor.userId);
    res.json({ success: true, points: account.points, db: safeUserSnapshot(serverDBState, actor) });
  });

  app.post('/api/results/declare', (req: AppRequest, res) => {
    if (!requireAdmin(req, res)) return;
    const { game, number } = req.body || {};
    const num = String(number ?? '');
    if (!(game in DEFAULT_RESULTS) || !/^\d{2}$/.test(num)) return error(res, 400, 'Invalid game or result.');
    serverDBState.results[game] = num;
    serverDBState.resultDeclaredTimes[game] = Date.now();
    saveServerDB(serverDBState);
    broadcast('RESULT_DECLARED', { game, number: num });
    res.json({ success: true, game, number: num, db: safeUserSnapshot(serverDBState, req.actor!) });
  });
  app.post('/api/results/reset', (req: AppRequest, res) => {
    if (!requireAdmin(req, res)) return;
    const game = req.body?.game;
    if (game && game in DEFAULT_RESULTS) {
      serverDBState.results[game] = '--';
      delete serverDBState.resultDeclaredTimes[game];
      saveServerDB(serverDBState);
      broadcast('RESULT_RESET', { game });
    }
    res.json({ success: true, db: safeUserSnapshot(serverDBState, req.actor!) });
  });

  app.post('/api/users/toggle-block', (req: AppRequest, res) => {
    if (!requireAdmin(req, res)) return;
    const userId = String(req.body?.targetUser || '').trim().toUpperCase();
    const account = serverDBState.users[userId];
    if (!account) return error(res, 404, 'User account not found.');
    account.isDeactivated = Boolean(req.body?.deactivate);
    account.isLocked = account.isDeactivated;
    saveServerDB(serverDBState);
    broadcast('USER_STATUS_CHANGE', { targetUser: userId }, userId);
    res.json({ success: true, db: safeUserSnapshot(serverDBState, req.actor!) });
  });

  app.post('/api/users/unlock', (req: AppRequest, res) => {
    if (!requireAdmin(req, res)) return;
    const userId = String(req.body?.targetUser || '').trim().toUpperCase();
    const account = serverDBState.users[userId];
    if (!account) return error(res, 404, 'User account not found.');
    account.isLocked = false;
    account.isDeactivated = false;
    account.failedAttempts = 0;
    if (req.body?.newPass !== undefined) {
      if (!isStrongPassword(req.body.newPass)) return error(res, 400, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
      account.pass = hashPassword(req.body.newPass);
      account.passwordResetRequired = true;
    }
    saveServerDB(serverDBState);
    broadcast('USER_STATUS_CHANGE', { targetUser: userId }, userId);
    res.json({ success: true, db: safeUserSnapshot(serverDBState, req.actor!) });
  });

  app.post('/api/admin/change-creds', (req: AppRequest, res) => {
    const actor = req.actor!;
    if (!actor.isAdmin) return error(res, 403, 'Administrator access is required.');
    const { currentPass, pass } = req.body || {};
    if (typeof currentPass !== 'string' || !verifyPassword(currentPass, serverDBState.adminCreds.pass)) return error(res, 400, 'Current password is incorrect.');
    if (!isStrongPassword(pass)) return error(res, 400, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    const requestedUsername = String(req.body?.username || serverDBState.adminCreds.username).trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,32}$/.test(requestedUsername)) return error(res, 400, 'Admin username must be 3 to 32 letters, digits, underscores, or hyphens.');
    serverDBState.adminCreds.username = requestedUsername;
    serverDBState.adminCreds.pass = hashPassword(pass);
    serverDBState.adminPasswordResetRequired = false;
    serverDBState.adminFailedAttempts = 0;
    serverDBState.activeSessions = {};
    saveServerDB(serverDBState);
    clearSessionCookie(res);
    res.json({ success: true });
  });

  app.post('/api/users/change-password', (req: AppRequest, res) => {
    const actor = req.actor!;
    if (actor.isAdmin) return error(res, 403, 'Player access is required.');
    const { userId, currentPass } = req.body || {};
    const newPass = req.body?.newPass ?? req.body?.pass;
    if (String(userId || '').trim().toUpperCase() !== actor.userId) return error(res, 403, 'You can only change your own password.');
    const account = serverDBState.users[actor.userId];
    if (typeof currentPass !== 'string' || !verifyPassword(currentPass, account.pass)) return error(res, 400, 'Current password is incorrect.');
    if (!isStrongPassword(newPass)) return error(res, 400, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`);
    account.pass = hashPassword(newPass);
    account.passwordResetRequired = false;
    account.failedAttempts = 0;
    serverDBState.activeSessions = Object.fromEntries(
      Object.entries(serverDBState.activeSessions).filter(([, session]) => session.userId !== actor.userId)
    );
    saveServerDB(serverDBState);
    clearSessionCookie(res);
    res.json({ success: true });
  });

  app.post('/api/points/user-to-admin', (req: AppRequest, res) => {
    const actor = req.actor!;
    if (actor.isAdmin || (req.body?.userId && String(req.body.userId).toUpperCase() !== actor.userId)) return error(res, 403, 'You can only act on your own account.');
    const points = Number(req.body?.points);
    if (!Number.isSafeInteger(points) || points <= 0) return error(res, 400, 'Invalid points amount.');
    serverDBState.userToAdminReqs.push({ id: crypto.randomUUID(), user: actor.userId, points, time: new Date().toISOString() });
    saveServerDB(serverDBState);
    res.json({ success: true, message: 'Request submitted.' });
  });

  app.post('/api/points/admin-approve-req', (req: AppRequest, res) => {
    if (!requireAdmin(req, res)) return;
    res.json({ success: true, db: safeUserSnapshot(serverDBState, req.actor!) });
  });

  app.post('/api/payment-requests/create', (req: AppRequest, res) => {
    if (!requireAdmin(req, res)) return;
    const userId = String(req.body?.userId || '').trim().toUpperCase();
    if (!serverDBState.users[userId]) return error(res, 404, 'User account not found.');
    const now = Date.now();
    serverDBState.paymentRequests = serverDBState.paymentRequests.filter(item => item.expiresAt > now);
    serverDBState.paymentRequests.push({
      id: crypto.randomUUID(), userId,
      ...(typeof req.body?.mobileNumber === 'string' ? { mobileNumber: req.body.mobileNumber.slice(0, 30) } : {}),
      ...(typeof req.body?.accountNumber === 'string' ? { accountNumber: req.body.accountNumber.slice(0, 50) } : {}),
      ...(typeof req.body?.qrCodeDataUrl === 'string' ? { qrCodeDataUrl: req.body.qrCodeDataUrl.slice(0, 2_000_000) } : {}),
      createdAt: now, expiresAt: now + 15 * 60 * 1000
    });
    saveServerDB(serverDBState);
    broadcast('PAYMENT_REQUEST_CREATED', { targetUser: userId }, userId);
    res.json({ success: true, db: safeUserSnapshot(serverDBState, req.actor!) });
  });
  app.post('/api/payment-requests/accept', (req: AppRequest, res) => {
    const actor = req.actor!;
    if (actor.isAdmin) return error(res, 403, 'Player access is required.');
    const now = Date.now();
    const request = serverDBState.paymentRequests.find(item => item.id === req.body?.id);
    if (!request || request.expiresAt <= now || request.userId !== actor.userId) return error(res, 404, 'Payment request not found.');
    serverDBState.paymentRequests = serverDBState.paymentRequests.filter(item => item.id !== request.id && item.expiresAt > now);
    saveServerDB(serverDBState);
    broadcast('PAYMENT_REQUEST_ACCEPTED', {}, actor.userId);
    res.json({ success: true, db: safeUserSnapshot(serverDBState, actor) });
  });

  app.post('/api/admin/payment-qr', (req: AppRequest, res) => {
    if (!requireAdmin(req, res)) return;
    const value = req.body?.qrCodeDataUrl;
    if (typeof value !== 'string' || value.length > 2_000_000 ||
        !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)) {
      return error(res, 400, 'QR image must be a valid PNG, JPEG, or WebP data URL.');
    }
    serverDBState.paymentQr = value;
    saveServerDB(serverDBState);
    broadcast('PAYMENT_QR_UPDATED');
    res.json({ success: true, db: safeUserSnapshot(serverDBState, req.actor!) });
  });

  app.get(['/api/db', '/api/db/sync'], (req: AppRequest, res) => sendSnapshot(res, req.actor!));
  app.post('/api/db/sync', (req: AppRequest, res) => {
    if (!requireAdmin(req, res)) return;
    const patch = req.body?.patch;
    if (!validPatch(patch)) return error(res, 400, 'Database patch contains invalid or unsupported data.');
    mergePatch(patch);
    saveServerDB(serverDBState);
    broadcast('BATCH_SYNC');
    sendSnapshot(res, req.actor!);
  });

  app.post('/api/satta-king-live-sync', (req: AppRequest, res) => {
    res.json({
      success: true, source: 'server', fetchedAt: new Date().toISOString(),
      todayDate: new Date().toISOString().slice(0, 10), games: serverDBState.results,
      simulationOverrides: {}, newDeclarations: [], db: safeUserSnapshot(serverDBState, req.actor!)
    });
  });
  app.post('/api/satta-king-simulate', (req: AppRequest, res) => {
    if (!requireAdmin(req, res)) return;
    const { game, number, reset, clear } = req.body || {};
    if (reset || clear) return res.json({ success: true, simulationOverrides: {}, results: serverDBState.results });
    const result = String(number ?? '');
    if (!(game in DEFAULT_RESULTS) || !/^\d{2}$/.test(result)) return error(res, 400, 'Invalid game or result.');
    serverDBState.results[game] = result;
    saveServerDB(serverDBState);
    broadcast('RESULT_DECLARED', { game, number: result });
    res.json({ success: true, simulationOverrides: { [game]: result }, results: serverDBState.results, db: safeUserSnapshot(serverDBState, req.actor!) });
  });

  app.post('/api/admin/revoke-sessions', (req: AppRequest, res) => {
    if (!requireAdmin(req, res)) return;
    const target = String(req.body?.targetUser || '').trim().toUpperCase();
    if (!target || (target !== 'ADMIN' && !serverDBState.users[target])) return error(res, 404, 'Account not found.');
    let revokedCount = 0;
    for (const [key, session] of Object.entries(serverDBState.activeSessions)) {
      const matches = target === 'ADMIN' ? session.isAdmin : !session.isAdmin && session.userId === target;
      if (!matches) continue;
      delete serverDBState.activeSessions[key];
      revokedCount++;
    }
    saveServerDB(serverDBState);
    for (const [client, actor] of sseClients) {
      if ((target === 'ADMIN' && actor.isAdmin) || (!actor.isAdmin && actor.userId === target)) {
        client.write(`event: force_logout\ndata: ${JSON.stringify({ targetUser: target, reason: 'Your session was revoked by an administrator.' })}\n\n`);
        client.end();
        sseClients.delete(client);
      }
    }
    res.json({ success: true, revokedCount });
  });

  app.all('/api/*', (_req, res) => error(res, 404, 'API route not found.'));

  const port = Number(process.env.PORT) || 3000;
  const distPath = path.resolve(__dirname, 'dist');
  if (fs.existsSync(path.join(distPath, 'index.html'))) {
    app.use(express.static(distPath, { etag: true, maxAge: '1h' }));
    app.get('*', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  } else if (process.env.NODE_ENV !== 'production') {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }

  app.listen(port, '0.0.0.0', () => console.log(`KK GAMING Server running on port ${port}`));
}

startServer().catch(error => {
  console.error('Server startup failed:', error);
  process.exitCode = 1;
});
