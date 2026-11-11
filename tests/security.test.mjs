import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const serverFile = path.join(repositoryRoot, 'server.ts');
const fakeAdminPassword = 'LegacyAdminPass!2026';
const fakePlayerPassword = 'LegacyPlayerPass!2026';
const replacementAdminPassword = 'NewAdminPass!2026';
const replacementPlayerPassword = 'NewPlayerPass!2026';
const replacementSecondPlayerPassword = 'SecondNewPlayer!2026';

function createLegacyDatabase() {
  return {
    users: {
      KK001001: {
        pass: fakePlayerPassword,
        points: 400,
        failedAttempts: 0,
        isLocked: false,
        isDeactivated: false
      },
      KK002002: {
        pass: 'SecondFakePlayer!2026',
        points: 250,
        failedAttempts: 0,
        isLocked: false,
        isDeactivated: false
      }
    },
    userBets: {
      KK001001: {
        fakeBet1: { time: '10:00:00', game: 'Gali', num: 'A-1', pts: 10, status: 'pending' }
      }
    },
    results: {
      Faridabad: '--',
      Gaziyabad: '--',
      Gali: '--',
      Dishawar: '--',
      'Faridabad Old': '--',
      'Dishawar Old': '--'
    },
    resultDeclaredTimes: {},
    pointHistory: { KK001001: [{ type: 'Fake test entry', points: 10, time: '10:00:00' }] },
    userToAdminReqs: [],
    adminTransfers: {},
    adminLogs: [],
    chartRecords: [],
    adminCreds: { username: 'ADMIN', pass: fakeAdminPassword },
    cardRooms: [],
    activeSessions: {
      KK001001: {
        sessionToken: 'fake-invalidated-session-only',
        device: 'test-fixture',
        loginTime: 1,
        expiresAt: 2
      }
    },
    lastUpdated: 1
  };
}

async function unusedPort() {
  const server = net.createServer();
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  server.close();
  await once(server, 'close');
  return address.port;
}

function launchServer(databasePath, port) {
  const environment = {
    ...process.env,
    NODE_ENV: 'production',
    APP_TEST_MODE: 'true',
    APP_URL: 'https://app.example.test',
    CORS_ORIGINS: 'https://trusted.example.test',
    DB_PATH: databasePath,
    DB_INITIALIZE: 'false',
    ADMIN_USERNAME: 'ADMIN',
    ADMIN_PASSWORD: 'TestOnlyStrongPass!2026',
    PORT: String(port)
  };
  const child = spawn(process.execPath, ['--import', 'tsx', serverFile, '--port', String(port)], {
    cwd: repositoryRoot,
    env: environment,
    stdio: ['ignore', 'pipe', 'pipe']
  });
  child.startupOutput = '';
  child.stdout.on('data', chunk => { child.startupOutput += chunk.toString(); });
  child.stderr.on('data', chunk => { child.startupOutput += chunk.toString(); });
  return child;
}

async function waitForServer(child, port) {
  const started = Date.now();
  const baseUrl = `http://127.0.0.1:${port}`;
  while (Date.now() - started < 60_000) {
    if (child.exitCode !== null) throw new Error('Isolated test server exited before readiness.');
    try {
      const response = await fetch(`${baseUrl}/api/db/sync`, { signal: AbortSignal.timeout(500) });
      if (response.status === 401) return baseUrl;
    } catch {}
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  child.kill();
  throw new Error(`Isolated test server did not become ready. ${child.startupOutput.slice(-500)}`);
}

async function stopServer(child) {
  if (child.exitCode !== null) return;
  const exited = once(child, 'exit');
  child.kill();
  await exited;
}

function applySetCookie(previousCookie, response) {
  const header = response.headers.get('set-cookie');
  if (!header) return previousCookie;
  const cookiePair = header.split(';', 1)[0];
  if (!cookiePair || /Max-Age=0/i.test(header)) return '';
  return cookiePair;
}

async function apiRequest(baseUrl, endpoint, { method = 'GET', cookie = '', body } = {}) {
  const headers = new Headers();
  if (cookie) headers.set('Cookie', cookie);
  if (body !== undefined) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method,
    headers,
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  const data = await response.json();
  return {
    status: response.status,
    data,
    cookie: applySetCookie(cookie, response),
    setCookieHeader: response.headers.get('set-cookie') || '',
    serialized: JSON.stringify(data)
  };
}

async function openSse(baseUrl, cookie) {
  const controller = new AbortController();
  const response = await fetch(`${baseUrl}/api/realtime/stream`, {
    headers: { Cookie: cookie },
    signal: controller.signal
  });
  assert.equal(response.status, 200);
  const reader = response.body.getReader();
  const state = { buffer: '', events: [] };
  const nextEvent = async () => {
    while (state.events.length === 0) {
      const { value, done } = await reader.read();
      if (done) throw new Error('SSE stream closed before the expected event.');
      state.buffer += new TextDecoder().decode(value, { stream: true });
      const blocks = state.buffer.split('\n\n');
      state.buffer = blocks.pop() || '';
      for (const block of blocks) {
        const event = block.split('\n').find(line => line.startsWith('event: '));
        const data = block.split('\n').filter(line => line.startsWith('data: '))
          .map(line => line.slice(6)).join('\n');
        if (event) state.events.push({ event: event.slice(7), data: JSON.parse(data) });
      }
    }
    return state.events.shift();
  };
  return {
    nextEvent,
    close: async () => {
      controller.abort();
      await reader.cancel().catch(() => {});
    }
  };
}

async function startupExitCode(databasePath) {
  const child = launchServer(databasePath, await unusedPort());
  const exitEvent = once(child, 'exit').then(([code]) => ({ code }));
  let timeoutId;
  const timeoutEvent = new Promise(resolve => {
    timeoutId = setTimeout(() => resolve({ timedOut: true }), 60_000);
  });
  const result = await Promise.race([exitEvent, timeoutEvent]);
  clearTimeout(timeoutId);
  if (result.timedOut) {
    child.kill();
    throw new Error('Expected database startup failure did not occur.');
  }
  return result.code ?? 1;
}

test('isolated security and migration integration tests', async t => {
  const testDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'kk-security-test-'));
  const databasePath = path.join(testDirectory, 'fake-database.json');
  fs.writeFileSync(databasePath, JSON.stringify(createLegacyDatabase(), null, 2), { mode: 0o600 });

  const port = await unusedPort();
  const child = launchServer(databasePath, port);
  const baseUrl = await waitForServer(child, port);
  t.after(() => stopServer(child));

  await t.test('legacy startup without a marker migrates safely and retains fake account data', () => {
    const migrated = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
    assert.equal(migrated.schemaVersion, 2);
    assert.equal(Object.keys(migrated.users).length, 2);
    assert.equal(migrated.users.KK001001.points, 400);
    assert.equal(Object.keys(migrated.userBets.KK001001).length, 1);
    assert.equal(migrated.pointHistory.KK001001.length, 1);
    assert.ok(migrated.users.KK001001.pass.startsWith('scrypt$'));
    assert.equal(migrated.users.KK001001.passwordResetRequired, true);
    assert.ok(migrated.adminCreds.pass.startsWith('scrypt$'));
    assert.equal(migrated.adminPasswordResetRequired, true);
    assert.deepEqual(migrated.activeSessions, {});
    assert.equal('playerAccountsCleared' in migrated, false);
  });

  await t.test('anonymous reads fail and login responses do not disclose credentials', async () => {
    const anonymous = await apiRequest(baseUrl, '/api/db/sync');
    assert.equal(anonymous.status, 401);

    const trustedOrigin = await fetch(`${baseUrl}/api/db/sync`, {
      headers: { Origin: 'https://trusted.example.test' }
    });
    assert.equal(trustedOrigin.status, 401);
    assert.equal(trustedOrigin.headers.get('access-control-allow-origin'), 'https://trusted.example.test');
    const untrustedOrigin = await fetch(`${baseUrl}/api/db/sync`, {
      headers: { Origin: 'https://untrusted.example.test' }
    });
    assert.equal(untrustedOrigin.status, 403);

    const failedPlayerLogin = await apiRequest(baseUrl, '/api/db/login', {
      method: 'POST',
      body: { username: 'KK001001', password: 'WrongFakePassword!2026' }
    });
    const unknownPlayerLogin = await apiRequest(baseUrl, '/api/db/login', {
      method: 'POST',
      body: { username: 'KK009999', password: 'WrongFakePassword!2026' }
    });
    assert.equal(failedPlayerLogin.status, 401);
    assert.equal(unknownPlayerLogin.status, failedPlayerLogin.status);
    assert.equal(unknownPlayerLogin.data.message, failedPlayerLogin.data.message);
    assert.equal(failedPlayerLogin.data.db, undefined);
    assert.equal(failedPlayerLogin.data.failedAttempts, undefined);
    assert.equal(failedPlayerLogin.data.isLocked, undefined);
    for (const privateValue of ['KK001001', '400', 'fakeBet1', 'Fake test entry']) {
      assert.equal(failedPlayerLogin.serialized.includes(privateValue), false);
    }
    const failedAdminLogin = await apiRequest(baseUrl, '/api/db/login', {
      method: 'POST',
      body: { username: 'ADMIN', password: 'WrongFakePassword!2026' }
    });
    assert.equal(failedAdminLogin.status, 401);
    assert.equal(failedAdminLogin.data.message, failedPlayerLogin.data.message);
    assert.equal(failedAdminLogin.data.db, undefined);

    const login = await apiRequest(baseUrl, '/api/db/login', {
      method: 'POST',
      body: { username: 'ADMIN', password: fakeAdminPassword }
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.passwordResetRequired, true);
    assert.equal(login.data.sessionToken, undefined);
    assert.match(login.cookie, /^kk_session=/);
    assert.match(login.setCookieHeader, /;\s*HttpOnly/i);
    assert.match(login.setCookieHeader, /;\s*Secure/i);
    assert.match(login.setCookieHeader, /;\s*SameSite=None/i);
    assert.ok(login.serialized.includes('pass":""'));
    assert.equal(login.serialized.includes(fakeAdminPassword), false);
    assert.equal(login.serialized.includes('fake-invalidated-session-only'), false);
    assert.equal((await apiRequest(baseUrl, '/api/db/sync', { cookie: login.cookie })).status, 403);
  });

  let adminCookie = '';
  await t.test('admin reset is mandatory, hashes the new password, and invalidates the session', async () => {
    const login = await apiRequest(baseUrl, '/api/db/login', {
      method: 'POST',
      body: { username: 'ADMIN', password: fakeAdminPassword }
    });
    adminCookie = login.cookie;
    const reset = await apiRequest(baseUrl, '/api/admin/change-creds', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        username: 'ADMIN',
        currentPass: fakeAdminPassword,
        pass: replacementAdminPassword
      }
    });
    assert.equal(reset.status, 200);
    assert.equal(reset.cookie, '');
    assert.equal(reset.data.sessionToken, undefined);
    const db = JSON.parse(fs.readFileSync(databasePath, 'utf8'));
    assert.ok(db.adminCreds.pass.startsWith('scrypt$'));
    assert.equal(db.adminPasswordResetRequired, false);
    assert.deepEqual(db.activeSessions, {});

    const oldPasswordLogin = await apiRequest(baseUrl, '/api/db/login', {
      method: 'POST',
      body: { username: 'ADMIN', password: fakeAdminPassword }
    });
    assert.equal(oldPasswordLogin.status, 401);
    const newPasswordLogin = await apiRequest(baseUrl, '/api/db/login', {
      method: 'POST',
      body: { username: 'ADMIN', password: replacementAdminPassword }
    });
    assert.equal(newPasswordLogin.status, 200);
    assert.equal(newPasswordLogin.data.passwordResetRequired, false);
    assert.equal(newPasswordLogin.data.sessionToken, undefined);
    adminCookie = newPasswordLogin.cookie;
  });

  let playerCookie = '';
  await t.test('player reset, role checks, and per-account data isolation work', async () => {
    const login = await apiRequest(baseUrl, '/api/db/login', {
      method: 'POST',
      body: { username: 'KK001001', password: fakePlayerPassword }
    });
    assert.equal(login.status, 200);
    assert.equal(login.data.passwordResetRequired, true);
    playerCookie = login.cookie;

    const reset = await apiRequest(baseUrl, '/api/users/change-password', {
      method: 'POST',
      cookie: playerCookie,
      body: {
        userId: 'KK001001',
        currentPass: fakePlayerPassword,
        newPass: replacementPlayerPassword
      }
    });
    assert.equal(reset.status, 200);
    assert.equal(reset.cookie, '');

    const normalLogin = await apiRequest(baseUrl, '/api/db/login', {
      method: 'POST',
      body: { username: 'KK001001', password: replacementPlayerPassword }
    });
    assert.equal(normalLogin.status, 200);
    assert.equal(normalLogin.data.passwordResetRequired, false);
    playerCookie = normalLogin.cookie;

    const playerSnapshot = await apiRequest(baseUrl, '/api/db/sync', { cookie: playerCookie });
    assert.equal(playerSnapshot.status, 200);
    assert.deepEqual(Object.keys(playerSnapshot.data.db.users), ['KK001001']);
    assert.equal(playerSnapshot.data.db.users.KK001001.pass, '');
    assert.deepEqual(playerSnapshot.data.db.activeSessions, {});
    assert.equal(playerSnapshot.serialized.includes('sessionToken'), false);

    const crossAccountRequest = await apiRequest(baseUrl, '/api/points/user-to-admin', {
      method: 'POST',
      cookie: playerCookie,
      body: { userId: 'KK002002', points: 1 }
    });
    assert.equal(crossAccountRequest.status, 403);
    const adminOnlyRequest = await apiRequest(baseUrl, '/api/results/declare', {
      method: 'POST',
      cookie: playerCookie,
      body: { game: 'Gali', number: '22' }
    });
    assert.equal(adminOnlyRequest.status, 403);
  });

  await t.test('payment requests are user-scoped, expire after 15 minutes, and can be accepted', async () => {
    const created = await apiRequest(baseUrl, '/api/payment-requests/create', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        userId: 'KK001001',
        mobileNumber: '9876543210',
        qrCodeDataUrl: 'data:image/png;base64,aGVsbG8='
      }
    });
    assert.equal(created.status, 200);

    const target = await apiRequest(baseUrl, '/api/db/sync', { cookie: playerCookie });
    assert.equal(target.data.db.paymentRequests.length, 1);
    assert.equal(target.data.db.paymentRequests[0].mobileNumber, '9876543210');
    assert.equal(target.data.db.paymentRequests[0].expiresAt - target.data.db.paymentRequests[0].createdAt, 15 * 60 * 1000);

    const wrongRole = await apiRequest(baseUrl, '/api/payment-requests/create', {
      method: 'POST',
      cookie: playerCookie,
      body: { userId: 'KK001001', mobileNumber: '9876543210' }
    });
    assert.equal(wrongRole.status, 403);

    const requestId = target.data.db.paymentRequests[0].id;
    const accepted = await apiRequest(baseUrl, '/api/payment-requests/accept', {
      method: 'POST',
      cookie: playerCookie,
      body: { id: requestId }
    });
    assert.equal(accepted.status, 200);
    assert.deepEqual(accepted.data.db.paymentRequests, []);
  });

  await t.test('credit event details are visible only to admins and the credited account', async () => {
    const secondLogin = await apiRequest(baseUrl, '/api/db/login', {
      method: 'POST',
      body: { username: 'KK002002', password: 'SecondFakePlayer!2026' }
    });
    const secondReset = await apiRequest(baseUrl, '/api/users/change-password', {
      method: 'POST',
      cookie: secondLogin.cookie,
      body: {
        userId: 'KK002002',
        currentPass: 'SecondFakePlayer!2026',
        newPass: replacementSecondPlayerPassword
      }
    });
    assert.equal(secondReset.status, 200);
    const secondNormalLogin = await apiRequest(baseUrl, '/api/db/login', {
      method: 'POST',
      body: { username: 'KK002002', password: replacementSecondPlayerPassword }
    });
    assert.equal(secondNormalLogin.status, 200);

    const adminStream = await openSse(baseUrl, adminCookie);
    const targetStream = await openSse(baseUrl, playerCookie);
    const otherStream = await openSse(baseUrl, secondNormalLogin.cookie);
    try {
      assert.equal((await adminStream.nextEvent()).event, 'init');
      assert.equal((await targetStream.nextEvent()).event, 'init');
      assert.equal((await otherStream.nextEvent()).event, 'init');

      const credit = await apiRequest(baseUrl, '/api/points/admin-credit', {
        method: 'POST',
        cookie: adminCookie,
        body: { targetUser: 'KK001001', points: 37, directCredit: true }
      });
      assert.equal(credit.status, 200);

      const [adminEvent, targetEvent, otherEvent] = await Promise.all([
        adminStream.nextEvent(),
        targetStream.nextEvent(),
        otherStream.nextEvent()
      ]);
      assert.equal(adminEvent.event, 'db_update');
      assert.equal(targetEvent.event, 'db_update');
      assert.equal(otherEvent.event, 'db_update');
      assert.equal(adminEvent.data.targetUser, 'KK001001');
      assert.equal(adminEvent.data.points, 37);
      assert.equal(targetEvent.data.targetUser, 'KK001001');
      assert.equal(targetEvent.data.points, 37);
      assert.equal('targetUser' in otherEvent.data, false);
      assert.equal('points' in otherEvent.data, false);
      assert.equal('directCredit' in otherEvent.data, false);
      assert.equal(JSON.stringify(otherEvent.data).includes('KK001001'), false);
    } finally {
      await Promise.all([adminStream.close(), targetStream.close(), otherStream.close()]);
    }
  });

  await t.test('patch validation rejects mixed invalid data without partial writes', async () => {
    const before = JSON.parse(fs.readFileSync(databasePath, 'utf8')).users.KK001001.points;
    const invalid = await apiRequest(baseUrl, '/api/db/sync', {
      method: 'POST',
      cookie: adminCookie,
      body: {
        patch: {
          users: { KK001001: { points: 99 } },
          userBets: {
            KK001001: {
              invalidBet: { time: '10:00', game: 'Gali', num: 'A-1', pts: -1, status: 'pending' }
            }
          }
        }
      }
    });
    assert.equal(invalid.status, 400);
    assert.equal(JSON.parse(fs.readFileSync(databasePath, 'utf8')).users.KK001001.points, before);

    const unknownKey = await apiRequest(baseUrl, '/api/db/sync', {
      method: 'POST',
      cookie: adminCookie,
      body: { patch: { unexpected: true } }
    });
    assert.equal(unknownKey.status, 400);
    const playerWrite = await apiRequest(baseUrl, '/api/db/sync', {
      method: 'POST',
      cookie: playerCookie,
      body: { patch: { users: { KK001001: { points: 10 } } } }
    });
    assert.equal(playerWrite.status, 403);
  });

  await t.test('admin session revocation invalidates the target session', async () => {
    const revoked = await apiRequest(baseUrl, '/api/admin/revoke-sessions', {
      method: 'POST',
      cookie: adminCookie,
      body: { targetUser: 'KK001001' }
    });
    assert.equal(revoked.status, 200);
    assert.equal(revoked.data.revokedCount, 1);
    assert.equal(revoked.data.sessionToken, undefined);
    const rejected = await apiRequest(baseUrl, '/api/db/sync', { cookie: playerCookie });
    assert.equal(rejected.status, 401);

    const adminStream = await openSse(baseUrl, adminCookie);
    try {
      assert.equal((await adminStream.nextEvent()).event, 'init');
      const revokedAdmin = await apiRequest(baseUrl, '/api/admin/revoke-sessions', {
        method: 'POST',
        cookie: adminCookie,
        body: { targetUser: 'ADMIN' }
      });
      assert.equal(revokedAdmin.status, 200);
      assert.equal((await adminStream.nextEvent()).event, 'force_logout');
      await assert.rejects(adminStream.nextEvent(), /SSE stream closed/);
    } finally {
      await adminStream.close();
    }
  });

  await t.test('explicit logout invalidates the cookie session on the server', async () => {
    const login = await apiRequest(baseUrl, '/api/db/login', {
      method: 'POST',
      body: { username: 'ADMIN', password: replacementAdminPassword }
    });
    assert.equal(login.status, 200);
    const logout = await apiRequest(baseUrl, '/api/auth/logout', {
      method: 'POST',
      cookie: login.cookie
    });
    assert.equal(logout.status, 200);
    assert.match(logout.setCookieHeader, /Max-Age=0/i);
    assert.equal((await apiRequest(baseUrl, '/api/db/sync', { cookie: login.cookie })).status, 401);
  });

  await t.test('malformed and missing databases fail closed without replacing files', async () => {
    const malformedPath = path.join(testDirectory, 'malformed-fake-database.json');
    const malformedContents = '{"users": []';
    fs.writeFileSync(malformedPath, malformedContents, { mode: 0o600 });
    const malformedExit = await startupExitCode(malformedPath);
    assert.notEqual(malformedExit, 0);
    assert.equal(fs.readFileSync(malformedPath, 'utf8'), malformedContents);

    const missingPath = path.join(testDirectory, 'missing', 'fake-database.json');
    const missingExit = await startupExitCode(missingPath);
    assert.notEqual(missingExit, 0);
    assert.equal(fs.existsSync(missingPath), false);
  });
});
