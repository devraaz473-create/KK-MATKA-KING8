/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { 
  GameName, 
  UsersDB, 
  UserBetsDB, 
  ResultsDB, 
  PointHistoryDB, 
  UserToAdminReq, 
  AdminTransfersDB, 
  AdminTxLog,
  ChartRecord,
  AdminCredentials,
  PaymentRequest
} from './types';
import { 
  getUsersDB, 
  getUserBetsDB, 
  getResultsDB, 
  getPointHistoryDB, 
  getUserToAdminReqs, 
  getAdminTransfersDB, 
  getAdminTxLogs, 
  getChartHistoryDB,
  getPaymentRequestsDB,
  getAdminPaymentQrCode,
  getAdminCredentials,
  saveAdminTransfersDB,
  addPointHistory,
  checkBetWin,
  applyServerStateToLocalStorage,
  migrateStoredSession,
  clearCachedServerData
} from './utils/storage';
import { soundManager } from './utils/audio';
import { 
  processLiveSyncCheck, 
  simulateLiveGameResult, 
  resetLiveGameSimulation, 
  LiveApiResponse
} from './utils/sattaKingLiveService';
import { realtimeService } from './utils/realtimeService';
import { getApiEndpoint } from './utils/api';
import { LoginScreen } from './components/LoginScreen';
import { UserDashboard } from './components/UserDashboard';
import { GamePlayScreen } from './components/GamePlayScreen';
import { AdminDashboard } from './components/AdminDashboard';
import { BetHistoryModal } from './components/BetHistoryModal';
import { UserManagementModal } from './components/UserManagementModal';
import { RulesModal } from './components/RulesModal';
import { ChartHistoryModal } from './components/ChartHistoryModal';
import { WinningCelebrationModal, WinCelebrationData } from './components/WinningCelebrationModal';
import { LogOut } from 'lucide-react';

type AppScreen = 'login' | 'user-dashboard' | 'game-play' | 'admin-dashboard';

interface ActiveSession {
  userId: string;
  isAdmin: boolean;
  screen: AppScreen;
  activeGame?: GameName;
  isAuthenticated?: boolean;
}

const TAB_SESSION_MARKER = 'kk_authenticated_tab';

function getStoredSession(): ActiveSession | null {
  try {
    const logoutPending = localStorage.getItem('kk_tab_logout_pending') === 'true';
    const raw = localStorage.getItem('app_active_session');
    if (!raw && !logoutPending) return null;
    if (logoutPending) {
      localStorage.removeItem('kk_tab_logout_pending');
      localStorage.removeItem('app_active_session');
      void fetch(getApiEndpoint('/api/auth/logout'), {
        method: 'POST',
        credentials: 'include',
        keepalive: true
      }).catch(err => console.error('Unable to invalidate the previous tab session:', err));
      return null;
    }
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (data && data.userId && sessionStorage.getItem(TAB_SESSION_MARKER) === data.userId) return data;
    localStorage.removeItem('app_active_session');
    void fetch(getApiEndpoint('/api/auth/logout'), {
      method: 'POST',
      credentials: 'include',
      keepalive: true
    }).catch(err => console.error('Unable to invalidate the previous tab session:', err));
  } catch {}
  return null;
}

export default function App() {
  const [initialSession] = useState(() => {
    migrateStoredSession();
    return getStoredSession();
  });
  const [currentScreen, setCurrentScreen] = useState<AppScreen>(initialSession ? initialSession.screen : 'login');
  const [currentUser, setCurrentUser] = useState<string>(initialSession ? initialSession.userId : '');
  const [isAdmin, setIsAdmin] = useState<boolean>(initialSession ? initialSession.isAdmin : false);
  const [hasAuthenticatedSession, setHasAuthenticatedSession] = useState<boolean>(!!initialSession?.isAuthenticated);
  const [activeGame, setActiveGame] = useState<GameName>(initialSession?.activeGame || 'Faridabad');

  // Single Device Auto-Logout Warning Modal
  const [forceLogoutReason, setForceLogoutReason] = useState<string | null>(null);

  const saveSession = useCallback((userId: string, adminRole: boolean, screen: AppScreen, game: GameName = 'Faridabad') => {
    if (userId) {
      localStorage.removeItem('kk_tab_logout_pending');
      sessionStorage.setItem(TAB_SESSION_MARKER, userId);
      localStorage.setItem('app_active_session', JSON.stringify({
        userId,
        isAdmin: adminRole,
        screen,
        activeGame: game,
        isAuthenticated: true
      }));
    } else {
      sessionStorage.removeItem(TAB_SESSION_MARKER);
      localStorage.removeItem('kk_tab_logout_pending');
      localStorage.removeItem('app_active_session');
      clearCachedServerData();
    }
  }, []);

  // Core Databases
  const [usersDB, setUsersDB] = useState<UsersDB>(() => getUsersDB());
  const [userBetsDB, setUserBetsDB] = useState<UserBetsDB>(() => getUserBetsDB());
  const [resultsDB, setResultsDB] = useState<ResultsDB>(() => getResultsDB());
  const [pointHistoryDB, setPointHistoryDB] = useState<PointHistoryDB>(() => getPointHistoryDB());
  const [userToAdminReqs, setUserToAdminReqs] = useState<UserToAdminReq[]>(() => getUserToAdminReqs());
  const [adminTransfers, setAdminTransfers] = useState<AdminTransfersDB>(() => getAdminTransfersDB());
  const [adminLogs, setAdminLogs] = useState<AdminTxLog[]>(() => getAdminTxLogs());
  const [chartRecords, setChartRecords] = useState<ChartRecord[]>(() => getChartHistoryDB());
  const [paymentRequests, setPaymentRequests] = useState<PaymentRequest[]>(() => getPaymentRequestsDB());
  const [adminPaymentQrCode, setAdminPaymentQrCode] = useState(() => getAdminPaymentQrCode());
  const [adminCreds, setAdminCreds] = useState<AdminCredentials>(() => getAdminCredentials());

  // Live Sync State
  const [liveSyncData, setLiveSyncData] = useState<LiveApiResponse | null>(null);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);

  // Modals
  const [isBetHistoryOpen, setIsBetHistoryOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [isRulesOpen, setIsRulesOpen] = useState(false);
  const [isChartOpen, setIsChartOpen] = useState(false);
  const [winCelebration, setWinCelebration] = useState<WinCelebrationData | null>(null);

  // Toast
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(prev => (prev === msg ? null : prev));
    }, 3200);
  }, []);

  // Reload state from local storage cache
  const refreshState = useCallback(() => {
    setUsersDB(getUsersDB());
    setUserBetsDB(getUserBetsDB());
    setResultsDB(getResultsDB());
    setPointHistoryDB(getPointHistoryDB());
    setUserToAdminReqs(getUserToAdminReqs());
    setAdminTransfers(getAdminTransfersDB());
    setAdminLogs(getAdminTxLogs());
    setChartRecords(getChartHistoryDB());
    setPaymentRequests(getPaymentRequestsDB());
    setAdminPaymentQrCode(getAdminPaymentQrCode());
    setAdminCreds(getAdminCredentials());
  }, []);

  // Check and trigger celebration if current user won on a declared game
  const checkAndTriggerCelebration = useCallback((targetUid: string, game: GameName, winningNum: string) => {
    if (!targetUid) return;
    const allBets = getUserBetsDB();
    const uBets = allBets[targetUid];
    if (!uBets) return;

    let wonTotal = 0;
    const winningBetsList: string[] = [];
    for (const k in uBets) {
      const b = uBets[k];
      if (b.game === game && b.status === 'pending') {
        const { isWin, multiplier } = checkBetWin(b.num, winningNum);
        if (isWin) {
          wonTotal += b.pts * multiplier;
          winningBetsList.push(b.num);
        }
      }
    }

    if (wonTotal > 0) {
      try {
        window.history.pushState({ type: 'celebration' }, '');
      } catch {}
      setWinCelebration({
        game,
        winningNumber: winningNum,
        totalWonPoints: wonTotal,
        betNumbers: winningBetsList
      });
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 }
      });
      soundManager.playWinCelebration();
    }
  }, []);

  // -------------------------------------------------------------
  // REAL-TIME SSE CONNECTION & SINGLE ACTIVE DEVICE LISTENERS
  // -------------------------------------------------------------
  useEffect(() => {
    // Initialize realtime service with active credentials
    realtimeService.init(currentUser, hasAuthenticatedSession, isAdmin);

    // Subscribe to DB updates
    const unsubscribeUpdate = realtimeService.onDBUpdate((db, reason, extra) => {
      applyServerStateToLocalStorage(db);
      refreshState();
      if (reason === 'PAYMENT_REQUEST_CREATED' && extra?.targetUser === currentUser) {
        showToast('Nayi payment request aayi hai. Details 15 minute valid hain.');
      }

      if (reason === 'RESULT_DECLARED' && extra?.game && extra?.number) {
        if (currentUser) {
          checkAndTriggerCelebration(currentUser, extra.game, extra.number);
        }
        showToast(`LIVE RESULT: ${extra.game} = ${extra.number}!`);
      } else if (reason === 'BET_PLACED' && extra?.userId) {
        if (isAdmin) {
          showToast(`Nayi Bet! User: ${extra.userId} (${extra.game}) - ${extra.totalBetPts} P`);
        }
      }
    });

    // Subscribe to Single Device Auto-Logout event
    const unsubscribeForceLogout = realtimeService.onForceLogout((reason) => {
      soundManager.playCancelSound();
      setForceLogoutReason(reason);
      setCurrentUser('');
      setIsAdmin(false);
      setHasAuthenticatedSession(false);
      setCurrentScreen('login');
      saveSession('', false, 'login', 'Faridabad');
    });

    return () => {
      unsubscribeUpdate();
      unsubscribeForceLogout();
    };
  }, [currentUser, hasAuthenticatedSession, isAdmin, refreshState, checkAndTriggerCelebration, showToast, saveSession]);

  // -------------------------------------------------------------
  // MOBILE HARDWARE BACK BUTTON & NAVIGATION (POPSTATE)
  // -------------------------------------------------------------
  useEffect(() => {
    const handlePopState = () => {
      if (winCelebration) {
        setWinCelebration(null);
        return;
      }
      if (isBetHistoryOpen) {
        setIsBetHistoryOpen(false);
        return;
      }
      if (isUserModalOpen) {
        setIsUserModalOpen(false);
        return;
      }
      if (isRulesOpen) {
        setIsRulesOpen(false);
        return;
      }
      if (isChartOpen) {
        setIsChartOpen(false);
        return;
      }
      if (currentScreen === 'game-play') {
        setCurrentScreen('user-dashboard');
        saveSession(currentUser, isAdmin, 'user-dashboard', activeGame);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [winCelebration, isBetHistoryOpen, isUserModalOpen, isRulesOpen, isChartOpen, currentScreen, currentUser, isAdmin, activeGame, saveSession]);

  const openModalWithHistory = (setter: (val: boolean) => void) => {
    try {
      window.history.pushState({ type: 'modal' }, '');
    } catch {}
    setter(true);
  };

  // Live Auto-Sync Check function
  const handlePerformLiveSync = useCallback(async (isManual = false) => {
    if (!currentUser || !hasAuthenticatedSession) return;
    setIsSyncing(true);
    try {
      const { data, newDeclarations } = await processLiveSyncCheck();
      setLiveSyncData(data);
      if (newDeclarations.length > 0) {
        for (const decl of newDeclarations) {
          if (currentUser) {
            checkAndTriggerCelebration(currentUser, decl.game, decl.number);
          }
          showToast(`LIVE RESULT: ${decl.game} = ${decl.number} (satta-king-fast.com)!`);
        }
        refreshState();
      } else if (isManual) {
        showToast('Live Sync: Satta-king-fast.com se live data check ho gaya!');
      }
    } catch {
      if (isManual) {
        showToast('Live site connection issue, retrying in background.');
      }
    } finally {
      setIsSyncing(false);
    }
  }, [currentUser, hasAuthenticatedSession, checkAndTriggerCelebration, refreshState, showToast]);

  // Background Live Sync polling effect
  useEffect(() => {
    handlePerformLiveSync(false);
    const timer = setInterval(() => {
      handlePerformLiveSync(false);
    }, 20_000);
    return () => clearInterval(timer);
  }, [handlePerformLiveSync]);

  const handleSimulateLiveResult = async (game: GameName, num: string) => {
    await simulateLiveGameResult(game, num);
    showToast(`Simulated Live ${game} -> ${num}! Syncing...`);
    await handlePerformLiveSync(true);
  };

  const handleResetLiveSimulation = async () => {
    await resetLiveGameSimulation();
    showToast('Real site data restored from satta-king-fast.com');
    await handlePerformLiveSync(true);
  };

  // Reset game results for next draw / remove number completely
  const handleResetGameResult = async (game: GameName, date?: string) => {
    await realtimeService.resetGameResult(game, date);
    refreshState();
    showToast(`${game} result hata diya gaya! (Ab empty / '--' hai)`);
  };

  const handleResetAllResults = async () => {
    await realtimeService.resetGameResult('ALL');
    await resetLiveGameSimulation();
    refreshState();
    await handlePerformLiveSync(true);
    showToast('Sabhi games ke result hata diye gaye!');
  };

  const handleCreatePaymentRequest = async (
    userId: string,
    details: Pick<PaymentRequest, 'mobileNumber' | 'accountNumber' | 'qrCodeDataUrl'>
  ) => {
    const result = await realtimeService.createPaymentRequest(userId, details);
    if (result.success && result.db) {
      applyServerStateToLocalStorage(result.db);
      refreshState();
      soundManager.playBetOkSound();
      showToast(`Payment request ${userId} ko bhej di. 15 minute valid.`);
    } else {
      showToast(result.message || 'Payment request bhejne mein error.');
      soundManager.playCancelSound();
    }
    return result;
  };

  const handleAcceptPaymentRequest = async (requestId: string) => {
    const result = await realtimeService.acceptPaymentRequest(requestId);
    if (result.success && result.db) {
      applyServerStateToLocalStorage(result.db);
      refreshState();
      soundManager.playBetOkSound();
      showToast('Payment request accept ho gayi.');
    } else {
      showToast(result.message || 'Payment request accept nahi hui.');
    }
  };

  const handleUpdateAdminPaymentQr = async (qrCodeDataUrl: string) => {
    const result = await realtimeService.updateAdminPaymentQr(qrCodeDataUrl);
    if (result.success && result.db) {
      applyServerStateToLocalStorage(result.db);
      refreshState();
      showToast(qrCodeDataUrl ? 'Payment QR save ho gaya.' : 'Payment QR hata diya gaya.');
    } else {
      showToast(result.message || 'Payment QR save nahi ho saka.');
    }
    return result;
  };

  // Handle Login
  const handleLoginSuccess = (userId: string, adminRole: boolean) => {
    setCurrentUser(userId);
    setIsAdmin(adminRole);
    setHasAuthenticatedSession(true);
    refreshState();
    const nextScreen: AppScreen = adminRole ? 'admin-dashboard' : 'user-dashboard';
    setCurrentScreen(nextScreen);
    saveSession(userId, adminRole, nextScreen, activeGame);
    realtimeService.updateSession(userId, true, adminRole);

    if (adminRole) {
      showToast('Welcome, Administrator! (Single Device Active)');
    } else {
      showToast(`Welcome back, ${userId}! (Single Device Active)`);
    }
  };

  // Sign out
  const handleSignOut = async () => {
    await realtimeService.logout();
    setCurrentUser('');
    setIsAdmin(false);
    setHasAuthenticatedSession(false);
    setCurrentScreen('login');
    saveSession('', false, 'login', 'Faridabad');
    showToast('Signed out successfully.');
  };

  // Open Game
  const handleOpenGame = (game: GameName) => {
    try {
      window.history.pushState({ type: 'game', game }, '');
    } catch {}
    setActiveGame(game);
    setCurrentScreen('game-play');
    saveSession(currentUser, isAdmin, 'game-play', game);
  };

  const handleBackFromGame = () => {
    setCurrentScreen('user-dashboard');
    saveSession(currentUser, isAdmin, 'user-dashboard', activeGame);
  };

  const handleManualRefresh = () => {
    refreshState();
    handlePerformLiveSync(true);
    showToast('Data Refreshed & Synced!');
  };

  // Place & Confirm Bets in Real-Time to Central Server
  const handleConfirmBets = async (game: GameName, stagedBets: Record<string, number>) => {
    const totalBetPts = Object.values(stagedBets).reduce((a, b) => a + b, 0);
    const currentPts = usersDB[currentUser]?.points || 0;
    if (totalBetPts > currentPts) {
      showToast('Insufficient Points balance!');
      return false;
    }

    const res = await realtimeService.placeBets(game, stagedBets);
    if (res.success) {
      if (res.db) {
        applyServerStateToLocalStorage(res.db);
        refreshState();
      }
      soundManager.playBetOkSound();
      showToast(`Bet Confirmed & Saved! (${totalBetPts} P)`);
      return true;
    } else {
      showToast(res.message || 'Bet confirm karne me error!');
      soundManager.playCancelSound();
      return false;
    }
  };

  // User transfers points to admin
  const handleTransferToAdmin = async (pts: number) => {
    const currentPts = usersDB[currentUser]?.points || 0;
    if (pts > currentPts) {
      showToast('Insufficient points!');
      return;
    }

    const res = await realtimeService.transferToAdmin(pts);
    if (res.success) {
      if (res.db) {
        applyServerStateToLocalStorage(res.db);
        refreshState();
      }
      soundManager.playBetOkSound();
      showToast(`${pts} Points Sent to Admin! Approval Pending.`);
    } else {
      showToast(res.message || 'Transfer error!');
      soundManager.playCancelSound();
    }
  };

  // User accepts transfer from admin
  const handleAcceptTransfer = (index: number) => {
    const transfer = adminTransfers[currentUser]?.[index];
    if (!transfer) return;

    const nextTransfers = { ...adminTransfers };
    nextTransfers[currentUser].splice(index, 1);
    saveAdminTransfersDB(nextTransfers);
    setAdminTransfers(nextTransfers);

    const pts = transfer.points;
    const nextUsers = { ...usersDB };
    if (nextUsers[currentUser]) {
      nextUsers[currentUser].points = (nextUsers[currentUser].points || 0) + pts;
      setUsersDB(nextUsers);
    }

    addPointHistory(currentUser, 'Received from Admin', pts);
    setPointHistoryDB(getPointHistoryDB());
    soundManager.playBetOkSound();

    showToast(`${pts} Points Added To Balance!`);
  };

  // Admin approves transfer request from user
  const handleApproveRequest = async (index: number) => {
    const res = await realtimeService.adminApproveRequest(index, 'accept');
    if (res.success) {
      if (res.db) {
        applyServerStateToLocalStorage(res.db);
        refreshState();
      }
      soundManager.playBetOkSound();
      showToast('Approved User Transfer Request!');
    }
  };

  // Admin rejects transfer request from user
  const handleRejectRequest = async (index: number) => {
    const res = await realtimeService.adminApproveRequest(index, 'reject');
    if (res.success) {
      if (res.db) {
        applyServerStateToLocalStorage(res.db);
        refreshState();
      }
      soundManager.playCancelSound();
      showToast('Rejected & Refunded Points to User!');
    }
  };

  // Admin creates or updates user
  const handleCreateUser = async (newUid: string, pass: string) => {
    const res = await realtimeService.adminSaveUser(newUid, pass, 0);
    if (res.success) {
      if (res.db) {
        applyServerStateToLocalStorage(res.db);
        refreshState();
      }
      soundManager.playBetOkSound();
      showToast(`User account ${newUid} saved live on all devices!`);
    } else {
      showToast(res.message || 'Error saving user');
    }
  };

  // Admin updates user password & unlocks
  const handleUpdateUserPassword = async (targetUser: string, newPass: string) => {
    const res = await realtimeService.adminUnlockUser(targetUser, newPass);
    if (res.success) {
      if (res.db) {
        applyServerStateToLocalStorage(res.db);
        refreshState();
      }
      soundManager.playBetOkSound();
      showToast(`Password updated & unlocked for ${targetUser}!`);
    } else {
      showToast(res.message || 'Error updating password');
    }
  };

  // Admin toggles user active / de-active status
  const handleToggleUserDeactivation = async (targetUser: string, deactivate?: boolean) => {
    const res = await realtimeService.adminToggleBlock(targetUser, deactivate);
    if (res.success) {
      if (res.db) {
        applyServerStateToLocalStorage(res.db);
        refreshState();
      }
      soundManager.playSelectSound();
      showToast(`Account status updated for ${targetUser}!`);
    } else {
      showToast(res.message || 'Error changing status');
    }
  };

  // Admin updates Admin credentials
  const handleUpdateAdminCreds = async (newCreds: AdminCredentials, currentPass: string) => {
    const res = await realtimeService.adminChangeCreds(newCreds.username, currentPass, newCreds.pass);
    if (res.success) {
      if (res.db) {
        applyServerStateToLocalStorage(res.db);
        refreshState();
      }
      setAdminCreds({ username: newCreds.username, pass: '' });
      await handleSignOut();
      showToast('Admin credentials updated. Sign in again.');
    }
    return res;
  };

  const handleUserChangePassword = async (currentPass: string, newPass: string) => {
    const res = await realtimeService.changeOwnPassword(currentPass, newPass);
    if (res.success && res.db) {
      applyServerStateToLocalStorage(res.db);
      refreshState();
    }
    if (res.success) await handleSignOut();
    return res;
  };

  // Admin transfers points to user
  const handleAdminTransferPoints = async (targetUser: string, points: number, directCredit: boolean) => {
    const res = await realtimeService.adminTransferPoints(targetUser, points, directCredit);
    if (res.success) {
      if (res.db) {
        applyServerStateToLocalStorage(res.db);
        refreshState();
      }
      soundManager.playBetOkSound();
      showToast(`${points} Points sent to ${targetUser}!`);
    } else {
      showToast(res.message || 'Error transferring points');
    }
  };

  // Admin declares result & settles bets in Real-Time
  const handleDeclareResult = async (game: GameName, num: string) => {
    if (currentUser) {
      checkAndTriggerCelebration(currentUser, game, num);
    }
    const res = await realtimeService.declareResult(game, num);
    if (res.success) {
      if (res.db) {
        applyServerStateToLocalStorage(res.db);
        refreshState();
      }
      await simulateLiveGameResult(game, num);
      await handlePerformLiveSync(true);

      const outcome = res.outcome;
      if (outcome && outcome.winnersCount > 0) {
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
        soundManager.playWinCelebration();
        showToast(`Declared ${game}: ${num} - ${outcome.winnersCount} Winner(s) Won ${outcome.totalPayout} P!`);
      } else {
        soundManager.playBetOkSound();
        showToast(`Declared ${game}: ${num} - Result sabhi phone par live update ho gaya!`);
      }
    } else {
      showToast(res.message || 'Result declare error');
      soundManager.playCancelSound();
    }
  };

  const userPoints = usersDB[currentUser]?.points || 0;
  const userPendingTransfers = adminTransfers[currentUser] || [];
  const userPointHistory = pointHistoryDB[currentUser] || [];

  return (
    <div className="relative min-h-screen bg-[#0a0205] text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white border-2 border-emerald-300 font-bold text-xs sm:text-sm px-5 py-2.5 rounded-xl shadow-[0_0_25px_rgba(16,185,129,0.7)] flex items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-200">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Single Device Auto-Logout Notice Modal */}
      {forceLogoutReason && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#140509] border-2 border-red-500/70 rounded-2xl p-6 max-w-sm w-full text-center shadow-2xl shadow-red-950/80">
            <div className="w-16 h-16 rounded-full bg-red-500/20 text-red-500 flex items-center justify-center mx-auto mb-4 border border-red-500/40">
              <LogOut className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold font-display text-white mb-2">Single Device Auto-Logout</h3>
            <p className="text-sm text-gray-300 mb-6 leading-relaxed">
              {forceLogoutReason}
            </p>
            <button
              onClick={() => setForceLogoutReason(null)}
              className="w-full py-3 bg-gradient-to-r from-red-600 to-amber-600 hover:brightness-110 active:scale-95 text-white font-bold rounded-xl shadow-lg transition-all"
            >
              Theek Hai (Login Page Par Jayein)
            </button>
          </div>
        </div>
      )}

      {/* Screen Router */}
      {currentScreen === 'login' && (
        <LoginScreen 
          onLoginSuccess={handleLoginSuccess}
          usersDB={usersDB}
        />
      )}

      {currentScreen === 'user-dashboard' && (
        <UserDashboard
          currentUser={currentUser}
          userPoints={userPoints}
          usersDB={usersDB}
          resultsDB={resultsDB}
          chartRecords={chartRecords}
          paymentRequests={paymentRequests}
          adminPaymentQrCode={adminPaymentQrCode}
          pendingTransfers={userPendingTransfers}
          pointHistory={userPointHistory}
          userBetsDB={userBetsDB}
          liveSyncData={liveSyncData}
          isSyncing={isSyncing}
          onTriggerLiveSync={() => handlePerformLiveSync(true)}
          onOpenGame={handleOpenGame}
          onOpenBetHistory={() => openModalWithHistory(setIsBetHistoryOpen)}
          onOpenChart={() => openModalWithHistory(setIsChartOpen)}
          onOpenRules={() => openModalWithHistory(setIsRulesOpen)}
          onTransferToAdmin={handleTransferToAdmin}
          onChangePassword={handleUserChangePassword}
          onAcceptTransfer={handleAcceptTransfer}
          onAcceptPaymentRequest={handleAcceptPaymentRequest}
          onRefresh={handleManualRefresh}
          onSignOut={handleSignOut}
          showToast={showToast}
        />
      )}

      {currentScreen === 'game-play' && (
        <GamePlayScreen
          gameName={activeGame}
          userPoints={userPoints}
          currentUser={currentUser}
          onBack={handleBackFromGame}
          onConfirmBets={handleConfirmBets}
        />
      )}

      {currentScreen === 'admin-dashboard' && (
        <AdminDashboard
          resultsDB={resultsDB}
          chartRecords={chartRecords}
          usersDB={usersDB}
          userBetsDB={userBetsDB}
          pendingRequests={userToAdminReqs}
          paymentRequests={paymentRequests}
          adminPaymentQrCode={adminPaymentQrCode}
          adminLogs={adminLogs}
          liveSyncData={liveSyncData}
          isSyncing={isSyncing}
          adminCreds={adminCreds}
          onUpdateAdminCreds={handleUpdateAdminCreds}
          onUpdateUserPassword={handleUpdateUserPassword}
          onTriggerLiveSync={() => handlePerformLiveSync(true)}
          onSimulateLiveResult={handleSimulateLiveResult}
          onResetLiveSimulation={handleResetLiveSimulation}
          onResetGameResult={handleResetGameResult}
          onResetAllResults={handleResetAllResults}
          onDeclareResult={handleDeclareResult}
          onApproveRequest={handleApproveRequest}
          onRejectRequest={handleRejectRequest}
          onOpenUserModal={() => openModalWithHistory(setIsUserModalOpen)}
          onOpenChart={() => openModalWithHistory(setIsChartOpen)}
          onCreatePaymentRequest={handleCreatePaymentRequest}
          onUpdateAdminPaymentQr={handleUpdateAdminPaymentQr}
          onRefresh={handleManualRefresh}
          onSignOut={handleSignOut}
          onToggleUserDeactivation={handleToggleUserDeactivation}
        />
      )}

      {/* Modals */}
      <WinningCelebrationModal
        isOpen={!!winCelebration}
        onClose={() => setWinCelebration(null)}
        winData={winCelebration}
        username={currentUser}
      />

      <BetHistoryModal
        isOpen={isBetHistoryOpen}
        onClose={() => setIsBetHistoryOpen(false)}
        currentUser={currentUser}
        userBetsDB={userBetsDB}
      />

      <UserManagementModal
        isOpen={isUserModalOpen}
        onClose={() => setIsUserModalOpen(false)}
        usersDB={usersDB}
        adminCreds={adminCreds}
        onCreateUser={handleCreateUser}
        onTransferPoints={handleAdminTransferPoints}
        onUpdateUserPassword={handleUpdateUserPassword}
        onUpdateAdminCreds={handleUpdateAdminCreds}
        onToggleUserDeactivation={handleToggleUserDeactivation}
      />

      <RulesModal
        isOpen={isRulesOpen}
        onClose={() => setIsRulesOpen(false)}
      />

      <ChartHistoryModal
        isOpen={isChartOpen}
        onClose={() => setIsChartOpen(false)}
        chartRecords={chartRecords}
      />

    </div>
  );
}
