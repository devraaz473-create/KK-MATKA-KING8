/**
 * Real-time SSE (Server-Sent Events) synchronization service
 * Keeps all devices (PC, Android, iOS, tablets) 100% synchronized in real time (< 50ms)
 * Handles single-device active session enforcement and auto sign-out
 */

import { UsersDB, UserBetsDB, ResultsDB, PointHistoryDB, UserToAdminReq, AdminTransfersDB, AdminTxLog, ChartRecord, AdminCredentials, GameName, PaymentRequest } from '../types';
import { apiFetch, getApiEndpoint } from './api';

export interface ServerDB {
  users: UsersDB;
  userBets: UserBetsDB;
  results: ResultsDB;
  resultDeclaredTimes: Record<string, number>;
  pointHistory: PointHistoryDB;
  userToAdminReqs: UserToAdminReq[];
  adminTransfers: AdminTransfersDB;
  adminLogs: AdminTxLog[];
  chartRecords: ChartRecord[];
  paymentRequests?: PaymentRequest[];
  adminPaymentQrCode?: string;
  adminCreds: AdminCredentials;
  cardRooms: any[];
  activeSessions?: Record<string, { device: string; loginTime: number; expiresAt?: number }>;
  lastUpdated: number;
}

type DBUpdateCallback = (db: ServerDB, reason?: string, extra?: any) => void;
type ForceLogoutCallback = (reason: string) => void;

class RealtimeService {
  private eventSource: EventSource | null = null;
  private dbUpdateListeners: Set<DBUpdateCallback> = new Set();
  private forceLogoutListeners: Set<ForceLogoutCallback> = new Set();
  private currentUserId: string = '';
  private hasAuthenticatedSession = false;
  private isAdmin: boolean = false;
  private reconnectTimeout: any = null;
  private pollInterval: any = null;
  private isConnected: boolean = false;

  constructor() {
    // Start background backup poll (every 4 seconds) in case SSE is blocked by certain mobile networks
    this.pollInterval = setInterval(() => {
      this.pollBackupSync();
    }, 4000);
  }

  public init(userId: string, hasAuthenticatedSession: boolean, isAdmin: boolean) {
    this.currentUserId = userId;
    this.hasAuthenticatedSession = hasAuthenticatedSession;
    this.isAdmin = isAdmin;

    if (userId && hasAuthenticatedSession) this.connectSSE();
    else this.disconnect();
  }

  public updateSession(userId: string, hasAuthenticatedSession: boolean, isAdmin: boolean) {
    this.currentUserId = userId;
    this.hasAuthenticatedSession = hasAuthenticatedSession;
    this.isAdmin = isAdmin;
    this.connectSSE();
  }

  public disconnect() {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    this.isConnected = false;
  }

  public onDBUpdate(callback: DBUpdateCallback) {
    this.dbUpdateListeners.add(callback);
    return () => {
      this.dbUpdateListeners.delete(callback);
    };
  }

  public onForceLogout(callback: ForceLogoutCallback) {
    this.forceLogoutListeners.add(callback);
    return () => {
      this.forceLogoutListeners.delete(callback);
    };
  }

  private connectSSE() {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }

    try {
      const params = new URLSearchParams({
        userId: this.currentUserId || '',
        isAdmin: this.isAdmin ? 'true' : 'false',
        device: navigator.userAgent.includes('Mobile') ? 'mobile' : 'desktop'
      });

      const url = `${getApiEndpoint('/api/realtime/stream')}?${params.toString()}`;
      const es = new EventSource(url, { withCredentials: true });
      this.eventSource = es;

      es.onopen = () => {
        this.isConnected = true;
      };

      es.addEventListener('init', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.db) {
            this.notifyDBUpdate(data.db, 'INIT');
          }
        } catch (err) {
          console.error('SSE init parse error:', err);
        }
      });

      es.addEventListener('db_update', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          if (data && data.db) {
            this.notifyDBUpdate(data.db, data.reason, data);
          }
        } catch (err) {
          console.error('SSE db_update parse error:', err);
        }
      });

      es.addEventListener('force_logout', (e: MessageEvent) => {
        try {
          const data = JSON.parse(e.data);
          const target = String(data.targetUser || '').toUpperCase();
          const myUser = this.isAdmin ? 'ADMIN' : String(this.currentUserId || '').toUpperCase();

          // Session revocation events identify only the targeted account.
          if (target === myUser) {
            this.notifyForceLogout(data.reason || 'Aapki ID dusre phone ya browser par login ho chuki hai.');
          }
        } catch (err) {
          console.error('SSE force_logout parse error:', err);
        }
      });

      es.onerror = () => {
        this.isConnected = false;
        es.close();
        this.eventSource = null;
        // Reconnect after 2 seconds
        this.reconnectTimeout = setTimeout(() => {
          this.connectSSE();
        }, 2000);
      };
    } catch (err) {
      console.error('SSE connection failed:', err);
      this.reconnectTimeout = setTimeout(() => {
        this.connectSSE();
      }, 3000);
    }
  }

  private notifyDBUpdate(db: ServerDB, reason?: string, extra?: any) {
    for (const listener of this.dbUpdateListeners) {
      try {
        listener(db, reason, extra);
      } catch (err) {
        console.error('DB listener error:', err);
      }
    }
  }

  private notifyForceLogout(reason: string) {
    for (const listener of this.forceLogoutListeners) {
      try {
        listener(reason);
      } catch (err) {
        console.error('Force logout listener error:', err);
      }
    }
  }

  private async pollBackupSync() {
    try {
      if (!this.currentUserId || !this.hasAuthenticatedSession) return;
      const res = await apiFetch('/api/db/sync', { signal: AbortSignal.timeout(3500) });
      if (res.status === 401) {
        this.notifyForceLogout('Aapka login session expire ho gaya hai. Dobara login karein.');
        return;
      }
      if (!res.ok) return;
      const json = await res.json();
      if (json && json.success && json.db) {
        this.notifyDBUpdate(json.db, 'POLL_SYNC');
      }
    } catch {}
  }

  // --- API CALLS THAT WRITE DIRECTLY TO CENTRAL SERVER ---

  public async placeBets(game: GameName, stagedBets: Record<string, number>): Promise<{ success: boolean; message?: string; db?: ServerDB }> {
    try {
      const res = await apiFetch('/api/bets/place', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUserId,
          game,
          stagedBets
        })
      });
      const data = await res.json();
      if (data.sessionExpired) {
        this.notifyForceLogout(data.message || 'Session Expired');
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async createPaymentRequest(
    userId: string,
    details: Pick<PaymentRequest, 'mobileNumber' | 'accountNumber' | 'qrCodeDataUrl'>
  ): Promise<{ success: boolean; message?: string; db?: ServerDB }> {
    try {
      const res = await apiFetch('/api/payment-requests/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, ...details })
      });
      const data = await res.json();
      return res.ok ? data : { success: false, message: data.message || 'Payment request send nahi hui.' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Network error' };
    }
  }

  public async updateAdminPaymentQr(qrCodeDataUrl: string): Promise<{ success: boolean; message?: string; db?: ServerDB }> {
    try {
      const res = await apiFetch('/api/admin/payment-qr', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCodeDataUrl })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async acceptPaymentRequest(id: string): Promise<{ success: boolean; message?: string; db?: ServerDB }> {
    try {
      const res = await apiFetch('/api/payment-requests/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      });
      const data = await res.json();
      return res.ok ? data : { success: false, message: data.message || 'Payment request accept nahi hui.' };
    } catch (err) {
      return { success: false, message: err instanceof Error ? err.message : 'Network error' };
    }
  }

  public async declareResult(game: GameName, number: string): Promise<{ success: boolean; message?: string; db?: ServerDB; outcome?: any }> {
    try {
      const res = await apiFetch('/api/results/declare', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          game,
          number
        })
      });
      const data = await res.json();
      if (data.sessionExpired) {
        this.notifyForceLogout(data.message || 'Session Expired');
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async resetGameResult(game: GameName | 'ALL', date?: string): Promise<{ success: boolean; message?: string; db?: ServerDB }> {
    try {
      const res = await apiFetch('/api/results/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ game, ...(date ? { date } : {}) })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async transferToAdmin(points: number): Promise<{ success: boolean; message?: string; db?: ServerDB }> {
    try {
      const res = await apiFetch('/api/points/user-to-admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUserId,
          points
        })
      });
      const data = await res.json();
      if (data.sessionExpired) {
        this.notifyForceLogout(data.message || 'Session Expired');
      }
      return data;
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async adminApproveRequest(index: number, action: 'accept' | 'reject'): Promise<{ success: boolean; message?: string; db?: ServerDB }> {
    try {
      const res = await apiFetch('/api/points/admin-approve-req', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          index,
          action
        })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async adminTransferPoints(targetUser: string, points: number, directCredit: boolean): Promise<{ success: boolean; message?: string; db?: ServerDB }> {
    try {
      const res = await apiFetch('/api/points/admin-credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUser,
          points,
          directCredit
        })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async adminSaveUser(username: string, pass: string, points?: number): Promise<{ success: boolean; message?: string; db?: ServerDB }> {
    try {
      const res = await apiFetch('/api/users/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          pass,
          points
        })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async adminUnlockUser(targetUser: string, newPass?: string): Promise<{ success: boolean; message?: string; db?: ServerDB }> {
    try {
      const res = await apiFetch('/api/users/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUser,
          newPass
        })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async adminToggleBlock(targetUser: string, deactivate?: boolean): Promise<{ success: boolean; message?: string; db?: ServerDB }> {
    try {
      const res = await apiFetch('/api/users/toggle-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUser,
          deactivate
        })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async changeOwnPassword(currentPass: string, newPass: string): Promise<{ success: boolean; message?: string; db?: ServerDB }> {
    try {
      const res = await apiFetch('/api/users/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUserId,
          currentPass,
          newPass
        })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async adminChangeCreds(username: string, currentPass: string, pass: string): Promise<{ success: boolean; message?: string; db?: ServerDB }> {
    try {
      const res = await apiFetch('/api/admin/change-creds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username,
          currentPass,
          pass
        })
      });
      return await res.json();
    } catch (err: any) {
      return { success: false, message: err.message || 'Network error' };
    }
  }

  public async logout(): Promise<void> {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: this.currentUserId,
        })
      });
    } catch {}
    this.currentUserId = '';
    this.hasAuthenticatedSession = false;
    this.disconnect();
  }
}

export const realtimeService = new RealtimeService();
