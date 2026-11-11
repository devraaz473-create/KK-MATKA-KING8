import React, { useState } from 'react';
import { 
  GameName, 
  ALL_GAMES, 
  ResultsDB, 
  UsersDB, 
  UserBetsDB, 
  UserToAdminReq, 
  AdminTxLog,
  GAME_TIMINGS,
  ChartRecord,
  PaymentRequest
} from '../types';
import { getRecentISTDateKeys } from '../utils/storage';
import { soundManager } from '../utils/audio';
import { LiveApiResponse } from '../utils/sattaKingLiveService';
import { 
  sendToWhatsApp, 
  formatAdminAggregatedBetsForWhatsApp, 
  WHATSAPP_DISPLAY_NUMBER 
} from '../utils/whatsapp';
import { 
  Users, 
  LogOut, 
  Trophy, 
  Flame, 
  History, 
  ArrowRightLeft,
  Sparkles,
  Gamepad2,
  RefreshCw,
  Clock,
  Table,
  RotateCcw,
  SlidersHorizontal,
  Smartphone,
  Download,
  Trash2
} from 'lucide-react';
import { PWAInstallButton } from './PWAInstallButton';

interface AdminDashboardProps {
  resultsDB: ResultsDB;
  chartRecords: ChartRecord[];
  usersDB: UsersDB;
  userBetsDB: UserBetsDB;
  pendingRequests: UserToAdminReq[];
  paymentRequests: PaymentRequest[];
  adminPaymentQrCode: string;
  adminLogs: AdminTxLog[];
  liveSyncData?: LiveApiResponse | null;
  isSyncing?: boolean;
  onTriggerLiveSync?: () => void;
  onSimulateLiveResult?: (game: GameName, number: string) => Promise<void>;
  onResetLiveSimulation?: () => Promise<void>;
  onResetGameResult?: (game: GameName, date?: string) => void;
  onResetAllResults?: () => void;
  onDeclareResult: (game: GameName, num: string) => void;
  onApproveRequest: (index: number) => void;
  onRejectRequest: (index: number) => void;
  onOpenUserModal: () => void;
  onOpenChart: () => void;
  onCreatePaymentRequest: (
    userId: string,
    details: Pick<PaymentRequest, 'mobileNumber' | 'accountNumber' | 'qrCodeDataUrl'>
  ) => Promise<{ success: boolean; message?: string }>;
  onUpdateAdminPaymentQr: (qrCodeDataUrl: string) => Promise<{ success: boolean; message?: string }>;
  onRefresh: () => void;
  onSignOut: () => void;
  adminCreds: import('../types').AdminCredentials;
  onUpdateAdminCreds: (creds: import('../types').AdminCredentials, currentPass: string) => Promise<{ success: boolean; message?: string }>;
  onUpdateUserPassword: (userId: string, newPass: string) => void;
  onToggleUserDeactivation: (userId: string, deactivate?: boolean) => void;
}

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  resultsDB,
  chartRecords,
  usersDB,
  userBetsDB,
  pendingRequests,
  paymentRequests,
  adminPaymentQrCode,
  adminLogs,
  liveSyncData,
  isSyncing = false,
  onTriggerLiveSync,
  onSimulateLiveResult,
  onResetLiveSimulation,
  onResetGameResult,
  onResetAllResults,
  onDeclareResult,
  onApproveRequest,
  onRejectRequest,
  onOpenUserModal,
  onOpenChart,
  onCreatePaymentRequest,
  onUpdateAdminPaymentQr,
  onRefresh,
  onSignOut,
  adminCreds,
  onUpdateAdminCreds,
  onUpdateUserPassword,
  onToggleUserDeactivation
}) => {
  const [selectedGame, setSelectedGame] = useState<GameName>('Faridabad');
  const [resultInput, setResultInput] = useState('');
  const [filterGame, setFilterGame] = useState<GameName>('Faridabad');
  const [lastSettlementMsg, setLastSettlementMsg] = useState<string | null>(null);
  const [isPaymentRequestOpen, setIsPaymentRequestOpen] = useState(false);
  const [paymentRequestUser, setPaymentRequestUser] = useState('');
  const [paymentMobile, setPaymentMobile] = useState('');
  const [paymentAccount, setPaymentAccount] = useState('');
  const [paymentQrCode, setPaymentQrCode] = useState('');
  const [paymentRequestError, setPaymentRequestError] = useState('');
  const [isSendingPaymentRequest, setIsSendingPaymentRequest] = useState(false);
  const [paymentClock, setPaymentClock] = useState(Date.now());
  const [selectedBetUser, setSelectedBetUser] = useState('');
  const [paymentQrDraft, setPaymentQrDraft] = useState(adminPaymentQrCode);
  const [paymentQrError, setPaymentQrError] = useState('');
  const [isSavingPaymentQr, setIsSavingPaymentQr] = useState(false);
  const [todayDate, yesterdayDate] = getRecentISTDateKeys();
  const todayRecord = chartRecords.find(record => record.date === todayDate);
  const yesterdayRecord = chartRecords.find(record => record.date === yesterdayDate);

  React.useEffect(() => {
    const timer = window.setInterval(() => setPaymentClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  React.useEffect(() => {
    setPaymentQrDraft(adminPaymentQrCode);
  }, [adminPaymentQrCode]);

  const sendPaymentRequest = async (event: React.FormEvent) => {
    event.preventDefault();
    setPaymentRequestError('');
    if (!paymentRequestUser) {
      setPaymentRequestError('User ID select karein.');
      return;
    }
    if (!paymentMobile && !paymentAccount && !paymentQrCode) {
      setPaymentRequestError('Mobile number, account number ya QR image me se kam se kam ek bharein.');
      return;
    }
    setIsSendingPaymentRequest(true);
    const result = await onCreatePaymentRequest(paymentRequestUser, {
      ...(paymentMobile ? { mobileNumber: paymentMobile } : {}),
      ...(paymentAccount ? { accountNumber: paymentAccount } : {}),
      ...(paymentQrCode ? { qrCodeDataUrl: paymentQrCode } : {})
    });
    setIsSendingPaymentRequest(false);
    if (!result.success) {
      setPaymentRequestError(result.message || 'Payment request bhejne mein error.');
      return;
    }
    setIsPaymentRequestOpen(false);
    setPaymentMobile('');
    setPaymentAccount('');
    setPaymentQrCode('');
  };

  const handleQrFile = (file?: File) => {
    setPaymentRequestError('');
    setPaymentQrCode('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 120_000) {
      setPaymentRequestError('QR image PNG/JPEG/WebP ho aur 120 KB se chhoti ho.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.length <= 180_000) {
        setPaymentQrCode(reader.result);
      } else {
        setPaymentRequestError('QR image ka size bahut bada hai.');
      }
    };
    reader.onerror = () => setPaymentRequestError('QR image read nahi ho payi.');
    reader.readAsDataURL(file);
  };

  const handleAdminPaymentQrFile = (file?: File) => {
    setPaymentQrError('');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 120_000) {
      setPaymentQrError('QR image PNG/JPEG/WebP ho aur 120 KB se chhoti ho.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string' && reader.result.length <= 180_000) {
        setPaymentQrDraft(reader.result);
      } else {
        setPaymentQrError('QR image ka size bahut bada hai.');
      }
    };
    reader.onerror = () => setPaymentQrError('QR image read nahi ho payi.');
    reader.readAsDataURL(file);
  };

  const saveAdminPaymentQr = async () => {
    setIsSavingPaymentQr(true);
    setPaymentQrError('');
    const result = await onUpdateAdminPaymentQr(paymentQrDraft);
    setIsSavingPaymentQr(false);
    if (!result.success) setPaymentQrError(result.message || 'Payment QR save nahi ho saka.');
  };

  const removeAdminPaymentQr = async () => {
    setIsSavingPaymentQr(true);
    setPaymentQrError('');
    const result = await onUpdateAdminPaymentQr('');
    setIsSavingPaymentQr(false);
    if (result.success) {
      setPaymentQrDraft('');
    } else {
      setPaymentQrError(result.message || 'Payment QR remove nahi ho saka.');
    }
  };

  const handleDeclare = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = resultInput.trim().padStart(2, '0');
    if (!clean || clean.length !== 2 || isNaN(Number(clean))) {
      soundManager.playCancelSound();
      return;
    }
    soundManager.playWinCelebration();
    onDeclareResult(selectedGame, clean);
    setLastSettlementMsg(`Declared ${selectedGame}: ${clean} - Winners credited with 90x / 9x payouts!`);
    setResultInput('');
  };

  // Compute aggregated live bets for the filterGame
  const aggregatedBets: Record<string, number> = {};
  let totalGamePool = 0;
  for (const uid in userBetsDB) {
    const userBets = userBetsDB[uid];
    for (const k in userBets) {
      const bet = userBets[k];
      if (bet.game === filterGame && bet.status === 'pending') {
        aggregatedBets[bet.num] = (aggregatedBets[bet.num] || 0) + bet.pts;
        totalGamePool += bet.pts;
      }
    }
  }

  const sortedAggregated = Object.entries(aggregatedBets).sort((a, b) => b[1] - a[1]);
  const highestBet = sortedAggregated[0];

  return (
    <div className="min-h-screen w-full bg-[#0d0206] text-white flex flex-col pb-12 select-none">
      {/* Top Bar */}
      <div className="bg-[#240610] border-b-2 border-amber-500/80 px-3 sm:px-4 py-2.5 sm:py-3 shadow-[0_4px_25px_rgba(245,158,11,0.35)] relative flex items-center justify-between">
        {/* Left: Branding Icon */}
        <div className="flex items-center gap-2 shrink-0 z-10">
          <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-br from-amber-500 via-orange-600 to-red-700 p-0.5 shadow-[0_0_15px_rgba(245,158,11,0.5)] border border-amber-300 shrink-0">
            <div className="w-full h-full bg-[#1e050e] rounded-[9px] flex items-center justify-center overflow-hidden">
              <Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 text-amber-300 drop-shadow-[0_0_8px_#f59e0b]" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
            </span>
          </div>
          <span className="hidden md:inline text-[11px] text-emerald-400 font-mono font-bold tracking-tight">● SYSTEM LIVE</span>
        </div>

        {/* Center: ADMIN PANEL with rich shadow & glowing style */}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <h1 className="text-base sm:text-xl font-black font-display text-transparent bg-clip-text bg-gradient-to-r from-amber-200 via-yellow-400 to-amber-200 uppercase tracking-widest drop-shadow-[0_2px_14px_rgba(245,158,11,0.95)] filter">
            ADMIN PANEL
          </h1>
          <span className="text-[9px] sm:text-[10px] text-amber-300 font-mono tracking-widest uppercase drop-shadow-[0_1px_4px_rgba(0,0,0,0.8)]">
            Control & Results Dashboard
          </span>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0 z-10">
          <button
            onClick={() => {
              soundManager.playSelectSound();
              onRefresh();
            }}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#2a1205] hover:bg-[#3d1a08] text-amber-300 border border-amber-500/60 text-xs font-bold transition-all active:scale-95 shadow"
            title="Refresh All Realtime Data"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 active:rotate-180 transition-transform duration-300" />
            <span className="hidden sm:inline">REFRESH</span>
          </button>
          <button
            onClick={onSignOut}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#37474f] hover:bg-[#455a64] border border-[#80d8ff] text-[#80d8ff] text-xs font-bold transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SIGN OUT</span>
          </button>
        </div>
      </div>

      <div className="max-w-5xl w-full mx-auto p-3 sm:p-5 space-y-4">
        {/* Notice of Last Declared */}
        {lastSettlementMsg && (
          <div className="bg-emerald-950/80 border border-emerald-500 text-emerald-200 px-4 py-2.5 rounded-xl text-xs flex items-center justify-between shadow-md">
            <span className="font-semibold">{lastSettlementMsg}</span>
            <button 
              onClick={() => setLastSettlementMsg(null)}
              className="text-emerald-400 hover:text-white font-bold ml-2"
            >
              ✕
            </button>
          </div>
        )}

        <section className="rounded-xl border border-amber-500/50 bg-[#17050b] p-3 sm:p-4">
          <h2 className="mb-2 text-xs font-black uppercase tracking-wider text-amber-300">USER PAYMENT QR</h2>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={event => handleAdminPaymentQrFile(event.target.files?.[0])}
              className="min-w-0 flex-1 text-xs text-zinc-300 file:mr-3 file:rounded-lg file:border-0 file:bg-amber-700 file:px-3 file:py-2 file:font-bold file:text-white"
            />
            {paymentQrDraft && (
              <img src={paymentQrDraft} alt="Payment QR preview" className="max-h-32 rounded-lg bg-white p-1" />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveAdminPaymentQr()}
                disabled={isSavingPaymentQr || !paymentQrDraft || paymentQrDraft === adminPaymentQrCode}
                className="rounded-lg bg-emerald-700 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                {isSavingPaymentQr ? 'SAVING...' : 'SAVE QR'}
              </button>
              <button
                type="button"
                onClick={() => void removeAdminPaymentQr()}
                disabled={isSavingPaymentQr || !adminPaymentQrCode}
                className="rounded-lg bg-red-800 px-3 py-2 text-xs font-bold text-white disabled:opacity-50"
              >
                REMOVE
              </button>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-zinc-400">Upload aapka payment QR. Logged-in users ise dekh aur download kar sakte hain. PNG/JPEG/WebP, max 120 KB.</p>
          {paymentQrError && <p role="alert" className="mt-2 text-xs text-red-300">{paymentQrError}</p>}
        </section>

        {/* 0. LIVE RESULTS */}
        <div className="bg-gradient-to-b from-[#1c0812] to-[#14040c] border-2 border-emerald-500/70 rounded-xl p-3 sm:p-4 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-emerald-500/40 pb-3 mb-3 gap-2">
            <div>
              <div className="flex items-center gap-2">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
                </span>
                <h2 className="text-xs sm:text-sm font-extrabold text-emerald-300 font-display uppercase tracking-wider flex items-center gap-1.5">
                  <span>LIVE RESULTS</span>
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Instant Sync Button */}
              {onTriggerLiveSync && (
                <button
                  onClick={() => {
                    soundManager.playSelectSound();
                    onTriggerLiveSync();
                  }}
                  disabled={isSyncing}
                  className="px-3 py-1 rounded-full bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-extrabold text-[11px] font-mono border border-emerald-300 shadow flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                  title="Fetch and verify live results from satta-king-fast.com right now"
                >
                  <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                  <span>{isSyncing ? 'FETCHING...' : 'SYNC LIVE NOW'}</span>
                </button>
              )}

              {/* Next Draw Reset Button / Clear All */}
              {onResetAllResults && (
                <button
                  onClick={() => {
                    soundManager.playCancelSound();
                    onResetAllResults();
                  }}
                  className="px-2.5 py-1 rounded-full bg-red-950/90 hover:bg-red-800 text-red-200 border-2 border-red-500 text-[10px] font-black flex items-center gap-1 transition-all active:scale-95 cursor-pointer shadow-[0_0_12px_rgba(239,68,68,0.5)]"
                  title="Sabhi 4 games ke declared results hatayein"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                  <span>REMOVE ALL RESULTS (सभी हटाएं)</span>
                </button>
              )}
            </div>
          </div>

          {/* 4 LIVE GAMES RESULT BOXES WITH THICK BLUE BORDER & INSTANT REMOVE */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
            {[
              { name: 'Faridabad' as GameName, code: 'FB', time: '6:00 PM' },
              { name: 'Gaziyabad' as GameName, code: 'GB', time: '9:55 PM' },
              { name: 'Gali' as GameName, code: 'GL', time: '11:25 PM' },
              { name: 'Dishawar' as GameName, code: 'DS', time: '5:00 AM' }
            ].map(item => {
              const field = ({
                Faridabad: 'FBD',
                Gaziyabad: 'GZB',
                Gali: 'GALI',
                Dishawar: 'DISHAWAR'
              } as Partial<Record<GameName, keyof ChartRecord>>)[item.name]!;
              const todayValue = todayRecord?.[field] || '--';
              const yesterdayValue = yesterdayRecord?.[field] || '--';
              const isDeclared = todayValue !== '--';

              return (
                <div
                  key={item.name}
                  className={`rounded-xl p-2.5 border-3 border-blue-500 shadow-[0_0_20px_rgba(59,130,246,0.45)] flex flex-col justify-between items-center text-center transition-all relative overflow-hidden ${
                    isDeclared 
                      ? 'bg-gradient-to-b from-[#0f172a] via-[#090d16] to-[#04060b]' 
                      : 'bg-black/80'
                  }`}
                >
                  <div className="w-full flex items-center justify-between gap-1 pb-1 border-b border-blue-500/30">
                    <span className="text-[11.5px] font-black font-display text-blue-300 truncate tracking-wide">
                      {item.name}
                    </span>
                    <span className="text-sm font-black font-mono text-blue-100 tracking-wide drop-shadow-[0_0_8px_rgba(96,165,250,0.9)] whitespace-nowrap">
                      {item.time}
                    </span>
                  </div>

                  <div className="my-2 w-full space-y-1">
                    {[
                      { date: todayDate, label: 'TODAY', value: todayValue },
                      { date: yesterdayDate, label: 'YESTERDAY', value: yesterdayValue }
                    ].map(result => (
                      <div key={result.date} className="flex items-center justify-between rounded-md bg-black/40 px-2 py-1">
                        <span className="text-[9px] font-mono text-zinc-400">{result.label}</span>
                        <span className={`text-xl font-black font-display tracking-widest ${
                          result.value !== '--' ? 'text-yellow-300' : 'text-zinc-600'
                        }`}>{result.value}</span>
                        {result.value !== '--' && onResetGameResult && (
                          <button
                            type="button"
                            onClick={() => onResetGameResult(item.name, result.date)}
                            className="rounded bg-red-700 px-1.5 py-0.5 text-[9px] font-bold text-white"
                            title={`Remove ${result.label.toLowerCase()} ${item.name} result and chart entry`}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="w-full flex flex-col gap-1.5 pt-1 border-t border-blue-500/20">
                    <div className="flex items-center justify-between gap-1">
                      <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold ${
                        isDeclared ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {isDeclared ? '● LIVE' : '○ WAITING'}
                      </span>

                      {/* QUICK DECLARE LINK IF EMPTY */}
                      {!isDeclared && (
                        <button
                          onClick={() => {
                            soundManager.playSelectSound();
                            setSelectedGame(item.name);
                            const el = document.getElementById('declare-section');
                            if (el) el.scrollIntoView({ behavior: 'smooth' });
                          }}
                          className="px-2 py-0.5 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 text-[9px] font-bold active:scale-95 transition-all cursor-pointer"
                          title="Naya number declare karein"
                        >
                          + Declare
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 1. LIVE DECLARED RESULTS - OLD GAMES & QUICK ACTIONS */}
        <div className="bg-[#18050c] border border-amber-500/60 rounded-xl p-3 sm:p-4 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-amber-500/30 pb-2 mb-3 gap-2">
            <h2 className="text-xs sm:text-sm font-bold text-emerald-400 font-display tracking-wider flex items-center gap-1.5">
              <Trophy className="w-4 h-4 text-amber-400" />
              <span>LIVE DECLARED RESULTS (OLD GAMES)</span>
            </h2>
            <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
              {/* USER MGMT Button (Relocated beside Chart Record & App Install, compact size) */}
              <button
                onClick={onOpenUserModal}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-orange-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-black font-extrabold text-[11px] uppercase tracking-wider shadow transition-all active:scale-95 border border-white cursor-pointer"
                title="Manage User Accounts & Points"
              >
                <Users className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>USER MGMT</span>
              </button>
              {/* Chart Record Button */}
              <button
                onClick={() => {
                  soundManager.playSelectSound();
                  onOpenChart();
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-black font-extrabold text-[11px] uppercase tracking-wider border border-yellow-300 shadow transition-all active:scale-95 cursor-pointer"
                title="View Results Chart History"
              >
                <Table className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>CHART RECORD</span>
              </button>
              <button
                onClick={() => {
                  soundManager.playSelectSound();
                  setIsPaymentRequestOpen(true);
                }}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-gradient-to-r from-emerald-600 to-teal-500 hover:brightness-110 text-white font-extrabold text-[11px] uppercase tracking-wider border border-emerald-300 shadow transition-all active:scale-95 cursor-pointer"
                title="Send a time-limited payment request to a user"
              >
                <Smartphone className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>PAYMENT REQUEST</span>
                {paymentRequests.length > 0 && (
                  <span className="rounded-full bg-red-600 px-1.5 text-[9px] text-white">
                    {paymentRequests.length}
                  </span>
                )}
              </button>
              {/* App Install Button */}
              <PWAInstallButton />
              <span className="text-[10px] text-amber-300 font-mono hidden md:flex items-center gap-1">
                <Clock className="w-3 h-3 text-amber-400" />
                <span>Timings Active</span>
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:gap-3">
            {(['Faridabad Old', 'Dishawar Old'] as GameName[]).map(game => {
              const timing = GAME_TIMINGS[game];
              const isComingSoon = timing?.isComingSoon;
              return (
                <div
                  key={game}
                  className="bg-[#28080c] border-2 border-amber-500/60 rounded-lg p-2.5 text-center flex flex-col justify-between items-center shadow"
                >
                  <div className="w-full">
                    <div className="text-[12px] font-bold text-emerald-400 uppercase tracking-tight truncate w-full">
                      {game}
                    </div>
                    {isComingSoon ? (
                      <div className="mt-0.5">
                        <span className="text-[8.5px] px-2 py-0.5 rounded-full bg-amber-500/20 text-yellow-300 border border-amber-500/40 font-bold uppercase font-mono">
                          COMING SOON
                        </span>
                      </div>
                    ) : (
                      <div className="text-[8.5px] text-zinc-400 font-mono mt-0.5 leading-tight">
                        <span>Last {timing?.lastTime}</span>
                        <span className="text-zinc-600 mx-0.5">•</span>
                        <span className="text-amber-300">Open {timing?.openTime}</span>
                      </div>
                    )}
                  </div>
                  <div className="text-2xl font-black text-yellow-300 font-display tracking-wider mt-1.5 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)]">
                    {isComingSoon ? '--' : (resultsDB[game] || '--')}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 2. DECLARE RESULT FORM */}
        <div className="bg-[#1c060e] border-2 border-red-500/60 rounded-xl p-3 sm:p-4 shadow-md">
          <h2 className="text-xs sm:text-sm font-bold text-red-400 font-display tracking-wider border-b border-red-500/30 pb-2 mb-3 flex items-center gap-1.5">
            <Flame className="w-4 h-4 text-red-500" />
            <span>DECLARE & SETTLE RESULT (90X PAYOUT)</span>
          </h2>
          <form onSubmit={handleDeclare} className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
            <div className="flex-1">
              <label className="text-[10px] font-bold text-zinc-400 block mb-1 uppercase">Choose Game</label>
              <select
                value={selectedGame}
                onChange={e => {
                  const val = e.target.value as GameName;
                  setSelectedGame(val);
                  setFilterGame(val);
                }}
                className="w-full px-3 py-2 bg-black/60 border border-amber-500/50 rounded-lg text-amber-300 text-xs font-bold focus:outline-none focus:border-amber-400"
              >
                {ALL_GAMES.map(g => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </div>
            <div className="w-full sm:w-32">
              <label className="text-[10px] font-bold text-zinc-400 block mb-1 uppercase">2-Digit No.</label>
              <input
                type="text"
                maxLength={2}
                placeholder="e.g. 47"
                value={resultInput}
                onChange={e => setResultInput(e.target.value.replace(/\D/g, ''))}
                className="w-full px-3 py-2 bg-black/60 border border-amber-500/50 rounded-lg text-yellow-300 text-center text-sm font-black focus:outline-none focus:border-amber-400 font-mono"
              />
            </div>
            <div className="sm:self-end">
              <button
                type="submit"
                className="w-full sm:w-auto px-6 py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-lg border border-red-400 shadow-[0_0_15px_rgba(239,68,68,0.5)] transition-all active:scale-95 h-[38px] flex items-center justify-center gap-1.5"
              >
                <Sparkles className="w-4 h-4" />
                <span>DECLARE NOW</span>
              </button>
            </div>
          </form>
        </div>

        {/* 3. AGGREGATED LIVE BETS & RISK EXPOSURE */}
        <div className="bg-[#17050b] border border-amber-500/50 rounded-xl p-3 sm:p-4 shadow-md">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-amber-500/30 pb-2.5 mb-3 gap-2">
            <div>
              <h2 className="text-xs sm:text-sm font-bold text-amber-400 font-display tracking-wider flex items-center gap-1.5">
                <span>AGGREGATED LIVE BETS ({filterGame.toUpperCase()})</span>
              </h2>
              <div className="text-xs text-zinc-300 mt-1 flex flex-wrap items-center gap-2">
                <span>Active Pool: <strong className="text-emerald-400 font-mono">{totalGamePool} P</strong></span>
                {highestBet && (
                  <span className="text-red-400 font-semibold">
                    Top Risk: <strong>{highestBet[0]}</strong> ({highestBet[1]}P wagered | Max Payout: {highestBet[0].startsWith('A-') || highestBet[0].startsWith('B-') ? highestBet[1] * 9 : highestBet[1] * 90}P)
                  </span>
                )}
              </div>
            </div>

            {/* Send Aggregated List to WhatsApp */}
            <button
              onClick={() => {
                soundManager.playSelectSound();
                const msg = formatAdminAggregatedBetsForWhatsApp(filterGame, aggregatedBets, totalGamePool);
                sendToWhatsApp(msg);
              }}
              className="flex items-center gap-2 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 text-white font-extrabold text-xs uppercase tracking-wider border border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all active:scale-95 shrink-0 self-start sm:self-auto cursor-pointer"
              title={`Send ${filterGame} full aggregated calculation list to WhatsApp ${WHATSAPP_DISPLAY_NUMBER}`}
            >
              <div className="w-5 h-5 rounded-full bg-white flex items-center justify-center text-emerald-600 font-black text-xs shrink-0 shadow-sm">
                💬
              </div>
              <div className="text-left leading-tight">
                <span className="block font-black text-[11px] sm:text-xs">SEND TO WHATSAPP</span>
                <span className="block text-[9px] text-emerald-100 font-mono font-bold">{WHATSAPP_DISPLAY_NUMBER}</span>
              </div>
            </button>
          </div>

          {/* Game filter tabs */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 mb-3">
            {ALL_GAMES.map(g => (
              <button
                key={g}
                onClick={() => setFilterGame(g)}
                className={`py-1.5 px-1 rounded text-[11px] font-bold uppercase transition-all truncate text-center ${
                  filterGame === g
                    ? 'bg-gradient-to-r from-orange-600 to-amber-500 text-white shadow-sm border border-yellow-300'
                    : 'bg-[#290812] hover:bg-[#3d0c1b] text-zinc-300 border border-amber-500/20'
                }`}
              >
                {g}
              </button>
            ))}
          </div>

          {/* Live aggregated boxes */}
          {sortedAggregated.length === 0 ? (
            <div className="text-center py-6 text-zinc-500 text-xs font-semibold">
              No live pending bets placed on {filterGame} currently.
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2 max-h-48 overflow-y-auto p-1">
              {sortedAggregated.map(([num, pts]) => (
                <div
                  key={num}
                  className="bg-[#2a0b12] border border-amber-500/40 rounded-lg p-2 text-center"
                >
                  <div className="text-xs font-black text-emerald-400 font-mono">
                    {num.startsWith('A-') ? `Harup ${num}` : num.startsWith('B-') ? `Harup ${num}` : `No: ${num}`}
                  </div>
                  <div className="text-sm font-black text-yellow-300 font-mono mt-0.5">
                    {pts} P
                  </div>
                  <div className="text-[9px] text-zinc-400 mt-0.5">
                    Risk: {num.startsWith('A-') || num.startsWith('B-') ? pts * 9 : pts * 90}P
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <section className="rounded-xl border border-sky-500/50 bg-[#100b18] p-3 sm:p-4">
          <h2 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-wider text-sky-300">
            <Users className="h-4 w-4" />
            USER BETS
          </h2>
          <label className="mb-3 block text-[10px] font-bold uppercase text-zinc-400" htmlFor="user-bets-select">Select user to view all bets</label>
          <select
            id="user-bets-select"
            value={selectedBetUser}
            onChange={event => setSelectedBetUser(event.target.value)}
            className="mb-3 w-full rounded-lg border border-sky-500/40 bg-black/60 px-3 py-2 text-sm font-bold text-white"
          >
            <option value="">Choose user</option>
            {Object.keys(usersDB).sort().map(userId => (
              <option key={userId} value={userId}>{userId}</option>
            ))}
          </select>
          {selectedBetUser ? (
            <div>
              {(Object.entries(userBetsDB[selectedBetUser] || {}).reverse()).length === 0 ? (
                <p className="py-8 text-center text-xs font-bold text-zinc-500">Is user ki koi bet nahi hai.</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-2.5">
                  {Object.entries(userBetsDB[selectedBetUser] || {}).reverse().map(([betId, bet]) => (
                    <div
                      key={betId}
                      className="relative flex flex-col items-center justify-between aspect-square rounded-xl bg-gradient-to-b from-yellow-300 via-yellow-400 to-amber-500 border-2 border-yellow-300 shadow-md p-2 select-none"
                    >
                      {/* Game Name */}
                      <span className="w-full text-center text-[9px] font-black uppercase tracking-wider text-black/80 truncate">
                        {bet.game}
                      </span>

                      {/* Number (Pure Bold Black) */}
                      <span className="text-3xl font-black text-black leading-none my-auto">
                        {bet.num}
                      </span>

                      {/* Points / Token & Status (Black Pill Badge) */}
                      <div className="w-full flex items-center justify-between bg-black/90 rounded-md px-1.5 py-0.5 mt-0.5">
                        <span className="text-[10px] font-black text-yellow-400">
                          {bet.pts} P
                        </span>
                        <span className={`text-[8px] font-black uppercase ${
                          bet.status === 'win' ? 'text-emerald-400' : bet.status === 'loss' ? 'text-red-400' : 'text-zinc-300'
                        }`}>
                          {bet.status === 'win' ? 'WIN' : bet.status === 'loss' ? 'LOSS' : 'WAIT'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>

        {/* 4. PENDING USER REQUESTS & TRANSACTION LOGS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Pending Requests */}
          <div className="bg-[#17050b] border border-amber-500/50 rounded-xl p-3 sm:p-4 shadow-md flex flex-col">
            <h3 className="text-xs sm:text-sm font-bold text-emerald-400 font-display tracking-wider border-b border-amber-500/30 pb-2 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <ArrowRightLeft className="w-4 h-4 text-emerald-400" />
                <span>PENDING USER REQUESTS</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                {pendingRequests.length} Pending
              </span>
            </h3>
            <div className="flex-1 overflow-y-auto max-h-44 space-y-1.5 text-xs">
              {pendingRequests.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs">No pending user transfer requests.</div>
              ) : (
                pendingRequests.map((req, idx) => (
                  <div
                    key={`${req.user}-${req.time}-${idx}`}
                    className="p-2 rounded-lg bg-[#270912] border border-amber-500/30 flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-bold text-white">
                        User: <span className="text-amber-300 font-mono">{req.user}</span>
                      </div>
                      <div className="text-[11px] text-emerald-400 font-mono font-bold">
                        +{req.points} Points <span className="text-zinc-500 text-[10px]">({req.time})</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          soundManager.playBetOkSound();
                          onApproveRequest(idx);
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white rounded text-[11px] font-bold uppercase transition-all shadow"
                      >
                        ACCEPT
                      </button>
                      <button
                        onClick={() => {
                          soundManager.playCancelSound();
                          onRejectRequest(idx);
                        }}
                        className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white rounded text-[11px] font-bold uppercase transition-all shadow"
                      >
                        REJECT
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* User Transactions Audit Log */}
          <div className="bg-[#17050b] border border-amber-500/50 rounded-xl p-3 sm:p-4 shadow-md flex flex-col">
            <h3 className="text-xs sm:text-sm font-bold text-amber-400 font-display tracking-wider border-b border-amber-500/30 pb-2 mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5">
                <History className="w-4 h-4 text-amber-400" />
                <span>TRANSACTIONS AUDIT TRAIL</span>
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 font-mono">
                Auto-deletes after 28h
              </span>
            </h3>
            <div className="flex-1 overflow-y-auto max-h-44 space-y-1.5 text-xs">
              {adminLogs.length === 0 ? (
                <div className="text-center py-6 text-zinc-500 text-xs">No transaction history yet.</div>
              ) : (
                adminLogs.map((log, idx) => {
                  const isSent = log.type.includes('Sent');
                  return (
                    <div
                      key={idx}
                      className="p-1.5 border-b border-zinc-800 flex items-center justify-between text-[11px]"
                    >
                      <div>
                        <span className={`font-bold ${isSent ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {log.user}
                        </span>
                        <span className="text-zinc-400 ml-1.5">({log.type})</span>
                      </div>
                      <div className="font-mono font-bold text-zinc-300">
                        {log.pts} P <span className="text-zinc-500 text-[10px] ml-1">{log.time}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 5. CREATED USERS & BALANCES TABLE */}
        <div className="bg-[#17050b] border border-amber-500/50 rounded-xl p-3 sm:p-4 shadow-md">
          <div className="border-b border-amber-500/30 pb-2 mb-3">
            <h3 className="text-xs sm:text-sm font-bold text-emerald-400 font-display tracking-wider flex items-center gap-1.5">
              <Users className="w-4 h-4 text-emerald-400" />
              <span>REGISTERED USER ACCOUNTS & BALANCES</span>
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#290812] border-b border-amber-500/30 text-amber-300">
                  <th className="p-2.5 font-bold uppercase">User ID</th>
                  <th className="p-2.5 font-bold uppercase">Password</th>
                  <th className="p-2.5 font-bold uppercase">Points Balance</th>
                  <th className="p-2.5 font-bold uppercase">Account Status</th>
                  <th className="p-2.5 font-bold uppercase text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {Object.entries(usersDB).map(([uid, acc]) => {
                  const isLocked = acc.isLocked;
                  return (
                    <tr key={uid} className="hover:bg-white/5 transition-colors">
                      <td className="p-2.5 font-bold text-white font-mono text-sm flex items-center gap-1.5">
                        <span>{uid}</span>
                        {uid.startsWith('KK00') && (
                          <span className="text-[9px] px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                            
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 text-zinc-500 font-mono font-semibold">Hidden</td>
                      <td className="p-2.5 font-black text-emerald-400 font-mono text-sm">{acc.points || 0} P</td>
                      <td className="p-2.5">
                        <div className="flex flex-col gap-1 items-start">
                          {acc.isDeactivated ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-red-600/30 text-red-200 border border-red-500 font-extrabold text-[10px] tracking-wide">
                              ⛔ DE-ACTIVE
                            </span>
                          ) : isLocked ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/25 text-orange-200 border border-orange-500 font-bold text-[10px]">
                              🔒 LOCKED (5 FAILED)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/25 text-emerald-300 border border-emerald-500/60 font-black text-[10px] tracking-wide">
                              🟢 ACTIVE
                            </span>
                          )}

                          {/* Direct Toggle Button: ACTIVE / DE-ACTIVE */}
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playSelectSound();
                              onToggleUserDeactivation(uid, !acc.isDeactivated);
                            }}
                            className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase transition-all active:scale-95 cursor-pointer border ${
                              acc.isDeactivated
                                ? 'bg-emerald-700/80 hover:bg-emerald-600 text-white border-emerald-400'
                                : 'bg-red-950/80 hover:bg-red-900 text-red-300 border-red-600/70 hover:text-white'
                            }`}
                            title={acc.isDeactivated ? 'Click karein ID Active karne ke liye' : 'Click karein ID De-Active karne ke liye'}
                          >
                            {acc.isDeactivated ? '✓ ACTIVE KAREIN' : '✕ DE-ACTIVE KAREIN'}
                          </button>
                        </div>
                      </td>
                      <td className="p-2.5 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            soundManager.playSelectSound();
                            onOpenUserModal();
                          }}
                          className="px-2.5 py-1 rounded bg-[#2c0915] hover:bg-[#3d0d1e] text-amber-300 border border-amber-500/40 text-[10px] font-bold uppercase transition-all active:scale-95 cursor-pointer shadow"
                        >
                          {isLocked ? 'Unlock / Change Pwd' : 'Change Pwd'}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      {isPaymentRequestOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/80 p-4">
          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl border-2 border-emerald-500/60 bg-[#16050c] p-5 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-emerald-300">PAYMENT REQUEST</h2>
                <p className="text-xs text-zinc-400">User ke liye payment details bhejein; 15 minute baad auto-delete.</p>
              </div>
              <button type="button" onClick={() => setIsPaymentRequestOpen(false)} className="text-xl text-zinc-400">×</button>
            </div>
            <form onSubmit={sendPaymentRequest} className="space-y-3">
              <label className="block text-xs font-bold text-zinc-300">
                USER ID
                <select
                  value={paymentRequestUser}
                  onChange={event => setPaymentRequestUser(event.target.value)}
                  className="mt-1 w-full rounded-lg border border-emerald-500/40 bg-black/60 p-2 text-white"
                  required
                >
                  <option value="">Select user</option>
                  {Object.entries(usersDB).filter(([, user]) => !user.isDeactivated).map(([userId]) => (
                    <option key={userId} value={userId}>{userId}</option>
                  ))}
                </select>
              </label>
              <label className="block text-xs font-bold text-zinc-300">
                MOBILE NUMBER (OPTIONAL)
                <input
                  value={paymentMobile}
                  onChange={event => setPaymentMobile(event.target.value.replace(/[^\d +()-]/g, '').slice(0, 20))}
                  inputMode="tel"
                  className="mt-1 w-full rounded-lg border border-emerald-500/40 bg-black/60 p-2 text-white"
                  placeholder="Mobile / UPI number"
                />
              </label>
              <label className="block text-xs font-bold text-zinc-300">
                ACCOUNT NUMBER (OPTIONAL)
                <input
                  value={paymentAccount}
                  onChange={event => setPaymentAccount(event.target.value.replace(/[^\d -]/g, '').slice(0, 34))}
                  inputMode="numeric"
                  className="mt-1 w-full rounded-lg border border-emerald-500/40 bg-black/60 p-2 text-white"
                  placeholder="Bank account number"
                />
              </label>
              <label className="block text-xs font-bold text-zinc-300">
                QR / BARCODE IMAGE (PNG, JPEG, WEBP; MAX 120 KB)
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={event => handleQrFile(event.target.files?.[0])}
                  className="mt-1 block w-full text-xs text-zinc-300"
                />
              </label>
              {paymentQrCode && <img src={paymentQrCode} alt="Payment QR preview" className="mx-auto max-h-40 rounded-lg bg-white p-2" />}
              {paymentRequestError && <p role="alert" className="rounded bg-red-950 p-2 text-xs text-red-300">{paymentRequestError}</p>}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsPaymentRequestOpen(false)} className="rounded-lg border border-zinc-600 px-4 py-2 text-xs font-bold text-zinc-300">CANCEL</button>
                <button type="submit" disabled={isSendingPaymentRequest} className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white disabled:opacity-50">
                  {isSendingPaymentRequest ? 'SENDING...' : 'SEND REQUEST'}
                </button>
              </div>
            </form>
            {paymentRequests.length > 0 && (
              <div className="mt-5 border-t border-zinc-700 pt-3">
                <h3 className="mb-2 text-xs font-bold uppercase text-amber-300">Active requests</h3>
                <div className="space-y-1">
                  {paymentRequests.map(request => (
                    <div key={request.id} className="flex justify-between text-xs text-zinc-300">
                      <span>{request.userId}</span>
                      <span>{Math.max(0, Math.ceil((request.expiresAt - paymentClock) / 60_000))} min left</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
