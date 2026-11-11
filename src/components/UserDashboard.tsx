import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { 
  GameName, 
  ALL_GAMES, 
  ResultsDB, 
  PointHistoryItem, 
  AdminTransferItem, 
  UserBetsDB,
  GAME_TIMINGS,
  UsersDB,
  ChartRecord,
  PaymentRequest
} from '../types';
import { soundManager } from '../utils/audio';
import { LiveApiResponse } from '../utils/sattaKingLiveService';
import { checkIsGameBettingOpen, getRecentISTDateKeys } from '../utils/storage';
import { PWAInstallButton } from './PWAInstallButton';
import { 
  LogOut, 
  Volume2, 
  VolumeX, 
  HelpCircle, 
  Send, 
  ArrowDownLeft, 
  History, 
  Trophy, 
  Gamepad2, 
  Sparkles, 
  ChevronRight, 
  Wallet,
  RefreshCw,
  Table,
  Download,
  KeyRound,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';

interface UserDashboardProps {
  currentUser: string;
  userPoints: number;
  usersDB: UsersDB;
  resultsDB: ResultsDB;
  chartRecords: ChartRecord[];
  paymentRequests: PaymentRequest[];
  adminPaymentQrCode: string;
  pendingTransfers: AdminTransferItem[];
  pointHistory: PointHistoryItem[];
  userBetsDB: UserBetsDB;
  liveSyncData?: LiveApiResponse | null;
  isSyncing?: boolean;
  onTriggerLiveSync?: () => void;
  onOpenGame: (game: GameName) => void;
  onOpenBetHistory: () => void;
  onOpenChart: () => void;
  onOpenRules: () => void;
  onTransferToAdmin: (points: number) => void;
  onChangePassword: (currentPass: string, newPass: string) => Promise<{ success: boolean; message?: string }>;
  onAcceptTransfer: (index: number, points: number) => void;
  onAcceptPaymentRequest: (requestId: string) => void;
  onRefresh: () => void;
  onSignOut: () => void;
  showToast: (msg: string) => void;
}

export const UserDashboard: React.FC<UserDashboardProps> = ({
  currentUser,
  userPoints,
  usersDB,
  resultsDB,
  chartRecords,
  paymentRequests,
  adminPaymentQrCode,
  pendingTransfers,
  pointHistory,
  userBetsDB,
  liveSyncData,
  isSyncing = false,
  onTriggerLiveSync,
  onOpenGame,
  onOpenBetHistory,
  onOpenChart,
  onOpenRules,
  onTransferToAdmin,
  onChangePassword,
  onAcceptTransfer,
  onAcceptPaymentRequest,
  onRefresh,
  onSignOut,
  showToast
}) => {
  const [transferInput, setTransferInput] = useState('');
  const [soundOn, setSoundOn] = useState<boolean>(soundManager.enabled);
  const [mobileTab, setMobileTab] = useState<'games' | 'results' | 'wallet'>('games');
  const [paymentNoticeId, setPaymentNoticeId] = useState<string | null>(null);
  const [paymentNow, setPaymentNow] = useState(Date.now());
  const knownPaymentRequestIds = useRef(new Set(paymentRequests.map(request => request.id)));
  const [todayDate, yesterdayDate] = getRecentISTDateKeys();

  useEffect(() => {
    const timer = window.setInterval(() => setPaymentNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const newRequest = paymentRequests.find(request => !knownPaymentRequestIds.current.has(request.id));
    for (const request of paymentRequests) knownPaymentRequestIds.current.add(request.id);
    if (newRequest) {
      setPaymentNoticeId(newRequest.id);
      soundManager.playWinCelebration();
    } else if (paymentNoticeId && !paymentRequests.some(request => request.id === paymentNoticeId)) {
      setPaymentNoticeId(null);
    }
  }, [paymentRequests, paymentNoticeId]);

  // Change Password Form State
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdMsg, setPwdMsg] = useState<{ text: string; isError: boolean } | null>(null);

  const toggleAudio = () => {
    const next = soundManager.toggleSound();
    setSoundOn(next);
  };

  const handleSendToAdmin = (e: React.FormEvent) => {
    e.preventDefault();
    const pts = parseInt(transferInput, 10);
    if (!pts || pts <= 0) {
      soundManager.playCancelSound();
      return;
    }
    if (pts > userPoints) {
      soundManager.playCancelSound();
      showToast('Insufficient points balance!');
      return;
    }
    soundManager.playBetOkSound();
    onTransferToAdmin(pts);
    setTransferInput('');
  };

  // Handle User Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwdMsg(null);

    if (!oldPassword || !newPassword || !confirmPassword) {
      soundManager.playCancelSound();
      setPwdMsg({ text: 'Sabhi fields bharna anivarya hai!', isError: true });
      return;
    }

    if (newPassword.trim().length < 12) {
      soundManager.playCancelSound();
      setPwdMsg({ text: 'New password must be at least 12 characters.', isError: true });
      return;
    }

    if (newPassword !== confirmPassword) {
      soundManager.playCancelSound();
      setPwdMsg({ text: 'Naya Password aur Confirm Password match nahi ho rahe!', isError: true });
      return;
    }

    const result = await onChangePassword(oldPassword, newPassword);
    if (!result.success) {
      soundManager.playCancelSound();
      setPwdMsg({ text: result.message || 'Password update nahi ho saka.', isError: true });
      return;
    }

    soundManager.playBetOkSound();
    setOldPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPwdMsg({ text: '✅ Password safaltapoorvak badal gaya!', isError: false });
    showToast('Password badal gaya!');
    onSignOut();
  };

  const userBetsMap = userBetsDB[currentUser] || {};
  const userBetsList = Object.values(userBetsMap);
  const winBets = userBetsList.filter(b => b.status === 'win');
  const pendingBets = userBetsList.filter(b => b.status === 'pending');

  return (
    <div className="min-h-screen w-full bg-[#0d0206] text-white flex flex-col select-none">
      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-[#250811]/95 backdrop-blur-md border-b-2 border-amber-500/80 px-3 sm:px-6 py-2.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-amber-400 bg-gradient-to-br from-orange-600 to-[#3a0d16] flex items-center justify-center text-yellow-300 font-extrabold text-sm font-display shadow-[0_0_15px_rgba(245,158,11,0.5)]">
            KK
          </div>
          <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm font-bold">
            <span className="text-zinc-300">
              ID: <span className="text-amber-300 font-mono text-sm sm:text-base font-extrabold">{currentUser}</span>
            </span>
            <span className="text-zinc-500">|</span>
            <span className="text-zinc-300 flex items-center gap-1">
              POINTS: <span className="text-emerald-400 font-mono text-sm sm:text-base font-extrabold">{userPoints}</span>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <button
            onClick={() => {
              soundManager.playSelectSound();
              onRefresh();
            }}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#2b1005] hover:bg-[#3d1808] text-amber-300 border border-amber-500/60 text-xs font-bold transition-all active:scale-95 shadow"
            title="Refresh Points & Results"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400 active:rotate-180 transition-transform duration-300" />
            <span className="hidden sm:inline">REFRESH</span>
          </button>
          <button
            onClick={onOpenRules}
            className="p-1.5 rounded-lg bg-[#3a0d17] hover:bg-[#4f1120] text-amber-300 border border-amber-500/30 transition-colors"
            title="Rules & Payouts"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            onClick={toggleAudio}
            className="p-1.5 rounded-lg bg-[#3a0d17] hover:bg-[#4f1120] text-zinc-300 hover:text-amber-400 border border-zinc-700 transition-colors"
            title={soundOn ? 'Mute' : 'Unmute'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
          </button>
          <button
            onClick={onSignOut}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#37474f] hover:bg-[#455a64] border border-[#80d8ff] text-[#80d8ff] text-xs font-bold transition-all active:scale-95"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">SIGN OUT</span>
          </button>
        </div>
      </div>

      {/* MOBILE-ONLY TAB SELECTOR */}
      <div className="lg:hidden sticky top-[53px] z-20 bg-[#19040c]/95 border-b border-amber-500/40 p-1.5 grid grid-cols-3 gap-1">
        <button
          onClick={() => {
            soundManager.playSelectSound();
            setMobileTab('games');
          }}
          className={`py-2 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-1 transition-all ${
            mobileTab === 'games'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow border border-yellow-300 scale-[1.02]'
              : 'bg-[#290712] text-zinc-400 hover:text-white'
          }`}
        >
          <Gamepad2 className="w-3.5 h-3.5" />
          <span>GAMES</span>
        </button>
        <button
          onClick={() => {
            soundManager.playSelectSound();
            setMobileTab('results');
          }}
          className={`py-2 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-1 transition-all ${
            mobileTab === 'results'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow border border-yellow-300 scale-[1.02]'
              : 'bg-[#290712] text-zinc-400 hover:text-white'
          }`}
        >
          <Trophy className="w-3.5 h-3.5" />
          <span>RESULTS</span>
        </button>
        <button
          onClick={() => {
            soundManager.playSelectSound();
            setMobileTab('wallet');
          }}
          className={`py-2 rounded-lg font-bold text-xs uppercase flex items-center justify-center gap-1 transition-all ${
            mobileTab === 'wallet'
              ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white shadow border border-yellow-300 scale-[1.02]'
              : 'bg-[#290712] text-zinc-400 hover:text-white'
          }`}
        >
          <Wallet className="w-3.5 h-3.5" />
          <span>POINTS & PWD</span>
          {pendingTransfers.length > 0 && (
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping ml-0.5" />
          )}
        </button>
      </div>

      {/* Main Layout Container */}
      <div className="max-w-6xl w-full mx-auto p-2.5 sm:p-5 flex-1">
        {adminPaymentQrCode && (
          <section className="mb-4 rounded-xl border-2 border-amber-500/70 bg-[#17100a] p-4 shadow-lg">
            <h2 className="mb-3 text-sm font-black uppercase text-amber-300">ADMIN PAYMENT QR</h2>
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:items-start">
              <img
                src={adminPaymentQrCode}
                alt="Admin payment QR code"
                className="max-h-56 rounded-lg bg-white p-2"
              />
              <div className="space-y-2 text-center text-xs text-zinc-300 sm:text-left">
                <p>Payment app se QR scan karein. Payment complete hone ke baad admin ko receipt/confirmation bhejein.</p>
                <a
                  href={adminPaymentQrCode}
                  download={`${currentUser}-payment-qr.${adminPaymentQrCode.startsWith('data:image/png;') ? 'png' : adminPaymentQrCode.startsWith('data:image/webp;') ? 'webp' : 'jpg'}`}
                  className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 font-bold text-white hover:bg-amber-500"
                >
                  <Download className="h-4 w-4" />
                  DOWNLOAD QR
                </a>
              </div>
            </div>
          </section>
        )}

        {paymentRequests.length > 0 && (
          <section className="mb-4 rounded-xl border-2 border-emerald-500/70 bg-[#0b1a14] p-4 shadow-lg" aria-live="polite">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-black uppercase text-emerald-300">
              <span className="animate-pulse">●</span> PAYMENT REQUESTS
            </h2>
            <div className="space-y-3">
              {paymentRequests.map(request => (
                <div key={request.id} className="rounded-lg border border-emerald-500/30 bg-black/30 p-3">
                  <p className="mb-2 text-xs font-bold text-amber-200">
                    Admin payment details — {Math.max(0, Math.ceil((request.expiresAt - paymentNow) / 60_000))} minute(s) valid
                  </p>
                  <div className="space-y-1 text-xs text-zinc-200">
                    {request.mobileNumber && <p>Mobile / UPI: <strong className="text-white">{request.mobileNumber}</strong></p>}
                    {request.accountNumber && <p>Account number: <strong className="text-white">{request.accountNumber}</strong></p>}
                  </div>
                  {request.qrCodeDataUrl && (
                    <img src={request.qrCodeDataUrl} alt="Payment QR code" className="mt-2 max-h-44 rounded-lg bg-white p-2" />
                  )}
                  <p className="mt-2 text-[10px] text-amber-300">Ye details 15 minute valid hain; uske baad request auto-delete ho jayegi.</p>
                  <button
                    type="button"
                    onClick={() => onAcceptPaymentRequest(request.id)}
                    className="mt-3 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-black text-white hover:bg-emerald-500"
                  >
                    ACCEPT REQUEST
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* DESKTOP 3-COLUMN VIEW */}
        <div className="hidden lg:grid lg:grid-cols-12 gap-4">
          {/* LEFT PANEL */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            {/* Logo Card */}
            <div className="bg-[#1b050d] border-2 border-[#8d6e63] rounded-xl p-4 flex flex-col items-center text-center shadow-md">
              <div className="relative my-1">
                <div className="w-18 h-18 rounded-full border-3 border-amber-400 bg-gradient-to-br from-orange-600 via-amber-600 to-[#3e131d] flex items-center justify-center text-yellow-300 font-extrabold text-2xl font-display shadow-[0_0_20px_rgba(245,158,11,0.7)] tracking-wider">
                  KK
                </div>
              </div>
              <div className="text-xs font-black text-emerald-400 font-display tracking-wider mt-1 uppercase">
                WELCOME {currentUser}
              </div>
              <div className="text-[11px] text-zinc-400 mt-0.5 font-mono">
                Balance: <span className="text-emerald-400 font-bold">{userPoints} P</span>
              </div>
            </div>

            {/* Transfer Point to Admin */}
            <div className="bg-[#200508] border border-amber-500/60 rounded-xl p-3 text-center shadow-md">
              <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2 flex items-center justify-center gap-1">
                <Send className="w-3.5 h-3.5" />
                <span>Transfer Point To Admin</span>
              </div>
              <form onSubmit={handleSendToAdmin} className="space-y-2">
                <input
                  type="number"
                  placeholder="Enter Points"
                  value={transferInput}
                  onChange={e => setTransferInput(e.target.value)}
                  className="w-full px-3 py-1.5 bg-black/60 border border-amber-500/50 rounded-lg text-white font-bold text-xs focus:outline-none focus:border-amber-400 text-center"
                />
                <button
                  type="submit"
                  className="w-full py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-lg border border-yellow-300 shadow transition-all active:scale-95"
                >
                  Send To Admin
                </button>
              </form>
            </div>

            {/* USER PASSWORD CHANGE CARD (Directly below Transfer Point To Admin) */}
            <div className="bg-[#19040c] border border-amber-500/60 rounded-xl p-3 shadow-md">
              <div className="text-amber-400 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-amber-500/30 pb-1.5">
                <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                <span>CHANGE PASSWORD</span>
              </div>
              {pwdMsg && (
                <div className={`p-2 rounded-lg text-[11px] mb-2 font-semibold ${
                  pwdMsg.isError ? 'bg-red-950/80 text-red-200 border border-red-500' : 'bg-emerald-950/80 text-emerald-200 border border-emerald-500'
                }`}>
                  {pwdMsg.text}
                </div>
              )}
              <form onSubmit={handleChangePassword} className="space-y-2">
                <div>
                  <label className="text-[10px] text-zinc-400 block font-semibold mb-0.5">Purana Password</label>
                  <input
                    type="password"
                    placeholder="Old Password"
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-black/60 border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 block font-semibold mb-0.5">Naya Password</label>
                  <input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-black/60 border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-400 block font-semibold mb-0.5">Confirm Naya Password</label>
                  <input
                    type="password"
                    placeholder="Confirm Password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-black/60 border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2 bg-[#2d0916] hover:bg-[#3f0d20] border border-amber-500/50 text-amber-300 font-bold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-95 shadow flex items-center justify-center gap-1"
                >
                  <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                  <span>Update Password</span>
                </button>
              </form>
            </div>

            {/* Receive Points Box */}
            <div className="bg-[#102008] border border-emerald-500/70 rounded-xl p-3 shadow-md">
              <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
                <ArrowDownLeft className="w-3.5 h-3.5" />
                <span>Receive Points</span>
              </div>
              <div className="space-y-1.5 max-h-36 overflow-y-auto text-xs">
                {pendingTransfers.length === 0 ? (
                  <div className="text-zinc-500 text-[11px] text-center py-2">No pending points from admin.</div>
                ) : (
                  pendingTransfers.map((item, idx) => (
                    <div
                      key={idx}
                      className="p-2 bg-[#1b3310] border border-emerald-500/40 rounded-lg flex items-center justify-between gap-1"
                    >
                      <div>
                        <span className="font-extrabold text-emerald-300 font-mono">+{item.points} P</span>
                        <span className="text-[10px] text-zinc-400 block">{item.time}</span>
                      </div>
                      <button
                        onClick={() => {
                          soundManager.playBetOkSound();
                          onAcceptTransfer(idx, item.points);
                        }}
                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] uppercase rounded shadow active:scale-95"
                      >
                        RECEIVE
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Point History Box */}
            <div className="bg-[#1a0f08] border border-amber-500/50 rounded-xl p-3 shadow-md flex-1">
              <div className="text-amber-400 font-bold text-xs uppercase tracking-wider pb-1.5 border-b border-amber-500/30 mb-2 flex items-center gap-1">
                <History className="w-3.5 h-3.5" />
                <span>Point History</span>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto text-[11px]">
                {pointHistory.length === 0 ? (
                  <div className="text-zinc-500 text-center py-3 text-xs">No points history.</div>
                ) : (
                  pointHistory.map((item, idx) => {
                    const isPlus = item.type.includes('Received') || item.type.includes('Won');
                    return (
                      <div
                        key={idx}
                        className="border-b border-zinc-800/80 pb-1 flex items-center justify-between"
                      >
                        <div>
                          <span className={`font-bold font-mono ${isPlus ? 'text-emerald-400' : 'text-red-400'}`}>
                            {isPlus ? '+' : '-'}{item.points} P
                          </span>
                          <span className="text-zinc-400 text-[10px] ml-1 truncate">({item.type})</span>
                        </div>
                        <span className="text-[9px] text-zinc-500 font-mono">{item.time}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* CENTER PANEL */}
          <div className="lg:col-span-6 flex flex-col gap-4">
            <div className="bg-[#25080c] border-2 border-amber-500/80 rounded-xl p-3 sm:p-4 shadow-[0_0_20px_rgba(245,158,11,0.15)]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-amber-500/30 pb-2.5 mb-3 gap-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center justify-center">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute"></span>
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs sm:text-sm font-bold text-amber-300 font-display uppercase tracking-wider">
                        LIVE RESULTS (SATTA-KING-FAST.COM)
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-400 font-mono flex items-center gap-1">
                      <span className="text-emerald-400 font-bold">Auto-Sync 4 Games:</span>
                      <span>FBD (6:00PM), GZB (9:55PM), GALI (11:25PM), DS (5:00AM)</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
                  <PWAInstallButton />
                  {onTriggerLiveSync && (
                    <button
                      onClick={() => {
                        soundManager.playSelectSound();
                        onTriggerLiveSync();
                      }}
                      disabled={isSyncing}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-mono text-[10px] font-bold transition-all active:scale-95 cursor-pointer disabled:opacity-50"
                      title="Sync live results from satta-king-fast.com right now"
                    >
                      <RefreshCw className={`w-3 h-3 text-emerald-400 ${isSyncing ? 'animate-spin' : ''}`} />
                      <span>{isSyncing ? 'SYNCING...' : 'SYNC NOW'}</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      soundManager.playSelectSound();
                      onOpenChart();
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold transition-all active:scale-95 cursor-pointer"
                  >
                    <Table className="w-3 h-3 text-amber-400" />
                    <span>CHART RECORD</span>
                  </button>
                </div>
              </div>

              {/* Games Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-2.5">
                {ALL_GAMES.map(g => {
                  const timing = GAME_TIMINGS[g];
                  const isComingSoon = timing?.isComingSoon;
                  const liveInfo = liveSyncData?.games ? liveSyncData.games[g] : undefined;
                  const resultField = ({
                    Faridabad: 'FBD',
                    Gaziyabad: 'GZB',
                    Gali: 'GALI',
                    Dishawar: 'DISHAWAR'
                  } as Partial<Record<GameName, keyof ChartRecord>>)[g];
                  const todayRecord = chartRecords.find(record => record.date === todayDate);
                  const yesterdayRecord = chartRecords.find(record => record.date === yesterdayDate);
                  const declaredVal = isComingSoon ? '--' : (resultField
                    ? (todayRecord?.[resultField] || (liveInfo?.isDeclaredToday ? liveInfo.todayNumber : '--'))
                    : (resultsDB[g] || '--'));
                  const yesterdayVal = resultField ? (yesterdayRecord?.[resultField] || '--') : '--';
                  const isLiveDeclared = liveInfo?.isDeclaredToday;
                  const bettingStatus = checkIsGameBettingOpen(g);

                  const isMainGame = ['Faridabad', 'Gaziyabad', 'Gali', 'Dishawar'].includes(g);

                  return (
                    <div
                      key={g}
                      className={`rounded-xl p-3 text-center shadow flex flex-col justify-between transition-all ${
                        isMainGame 
                          ? 'border-3 border-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.45)] bg-gradient-to-b from-[#0f172a] to-[#04060b]' 
                          : isLiveDeclared
                            ? 'border-2 border-emerald-500/70 shadow-[0_0_15px_rgba(16,185,129,0.2)] bg-[#1e0a13]'
                            : 'border-2 border-amber-500/40 bg-[#28080f]'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[12px] font-bold text-emerald-400 uppercase tracking-tight truncate">
                            {g}
                          </span>
                          {liveInfo && (
                            <span className="text-[8.5px] font-mono px-1.5 py-0.2 rounded bg-black/50 text-amber-300 border border-amber-500/30">
                              {liveInfo.code}
                            </span>
                          )}
                        </div>
                        {isComingSoon ? (
                          <div className="mt-1">
                            <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-500/20 text-yellow-300 border border-amber-500/40 font-bold uppercase font-mono">
                              COMING SOON
                            </span>
                          </div>
                        ) : (
                          <div className="text-[9.5px] text-zinc-400 font-mono mt-0.5 leading-tight">
                            <span>Last {timing?.lastTime}</span>
                            <span className="text-zinc-600 mx-0.5">•</span>
                            <span className="text-amber-300 font-bold">Open {timing?.openTime}</span>
                          </div>
                        )}
                      </div>

                      <div className="my-1.5 space-y-1">
                        <div className="flex items-center justify-center gap-2 text-[9px] font-mono text-zinc-400">
                          <span>TODAY</span>
                          <span className={`text-xl sm:text-2xl font-black font-display tracking-widest ${
                          declaredVal !== '--' && declaredVal !== 'XX' ? 'text-yellow-300' : 'text-zinc-500'
                          }`}>{declaredVal}</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 text-[9px] font-mono text-zinc-400">
                          <span>YESTERDAY</span>
                          <span className={`text-base font-black font-display tracking-widest ${
                            yesterdayVal !== '--' ? 'text-amber-200' : 'text-zinc-600'
                          }`}>{yesterdayVal}</span>
                        </div>
                        {liveInfo && (
                          <div className="flex items-center justify-center gap-1.5 text-[9px] font-mono text-zinc-400 mt-0.5">
                            {isLiveDeclared ? (
                              <span className="text-emerald-400 font-bold">Live Open</span>
                            ) : (
                              <span className="text-amber-400/90">Waiting Draw</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Betting Status tag */}
                      <div className="mt-1">
                        {!bettingStatus.isOpen ? (
                          <span className="inline-block text-[8px] font-bold px-1.5 py-0.2 rounded bg-red-950/80 text-red-300 border border-red-700/60 uppercase">
                            Bet Time Over
                          </span>
                        ) : (
                          <span className="inline-block text-[8px] font-bold px-1.5 py-0.2 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-600/60 uppercase">
                            Betting Open
                          </span>
                        )}
                      </div>
                      {g === 'Faridabad' && paymentNoticeId && paymentRequests.some(request => request.id === paymentNoticeId) && createPortal(
                        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/80 p-4">
                          <div className="w-full max-w-sm rounded-2xl border-2 border-emerald-400 bg-[#0d1a13] p-5 shadow-2xl">
                            <h2 className="text-lg font-black text-emerald-300">PAYMENT REQUEST</h2>
                            <p className="mb-3 text-xs text-amber-200">Nayi request aayi hai — details sirf 15 minute valid hain.</p>
                            {(() => {
                              const request = paymentRequests.find(item => item.id === paymentNoticeId)!;
                              return (
                                <div className="space-y-2 text-sm text-white">
                                  {request.mobileNumber && <p>Mobile / UPI: {request.mobileNumber}</p>}
                                  {request.accountNumber && <p>Account number: {request.accountNumber}</p>}
                                  {request.qrCodeDataUrl && <img src={request.qrCodeDataUrl} alt="Payment QR code" className="mx-auto max-h-44 rounded-lg bg-white p-2" />}
                                  <p className="text-[10px] text-amber-300">
                                    {Math.max(0, Math.ceil((request.expiresAt - paymentNow) / 60_000))} minute(s) left
                                  </p>
                                  <div className="flex gap-2 pt-2">
                                    <button
                                      type="button"
                                      onClick={() => setPaymentNoticeId(null)}
                                      className="flex-1 rounded-lg border border-zinc-600 px-3 py-2 text-xs font-bold text-zinc-300"
                                    >
                                      LATER
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => onAcceptPaymentRequest(request.id)}
                                      className="flex-1 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-black text-white"
                                    >
                                      ACCEPT
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>
                        </div>,
                        document.body
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Announcement Card */}
            <div className="bg-[#1d0709] border-2 border-emerald-500/60 rounded-xl p-4 shadow-md flex flex-col gap-2">
              <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider border-b border-emerald-500/30 pb-2 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-yellow-400" />
                  <span>RESULT ANNOUNCEMENT & STATUS</span>
                </span>
                <span className="text-[11px] text-amber-300 font-mono">90x Payout Rate</span>
              </div>
              <div className="py-2 text-xs text-zinc-300 space-y-2">
                {winBets.length > 0 ? (
                  <div className="p-3 bg-emerald-950/40 border border-emerald-500/50 rounded-lg space-y-1">
                    <div className="font-extrabold text-emerald-300 text-sm">
                      RECENT WINNING TICKETS!
                    </div>
                    <div className="space-y-1 mt-1 text-xs">
                      {winBets.slice(0, 3).map((wb, i) => (
                        <div key={i} className="flex justify-between text-emerald-200">
                          <span>{wb.game} - [{wb.num}]</span>
                          <span className="font-bold">Won +{wb.payout || wb.pts * 90} P</span>
                        </div>
                      ))}
                    </div>
                    <div className="text-[11px] text-emerald-400 pt-1 font-semibold">
                      Winnings automatically credited to your balance!
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-2 text-zinc-400 text-xs">
                    {pendingBets.length > 0 ? (
                      <span className="text-amber-300 font-bold">
                        You have {pendingBets.length} pending bet(s) waiting for admin result declaration!
                      </span>
                    ) : (
                      <span>No active bets. Select a game from the right panel to place bets!</span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* RIGHT PANEL */}
          <div className="lg:col-span-3 flex flex-col gap-3">
            <div className="bg-[#19080c] border-2 border-amber-500/50 rounded-xl p-3.5 shadow-md flex flex-col gap-2.5">
              <div className="text-emerald-400 font-bold text-center text-xs uppercase tracking-wider border-b border-emerald-500/30 pb-2 flex items-center justify-center gap-1.5">
                <Gamepad2 className="w-4 h-4 text-emerald-400" />
                <span>GAMES (SELECT TO PLAY)</span>
              </div>
              <div className="flex flex-col gap-2">
                {ALL_GAMES.map(g => {
                  const timing = GAME_TIMINGS[g];
                  const isComingSoon = timing?.isComingSoon;
                  const bettingStatus = checkIsGameBettingOpen(g);

                  const isMain = ['Faridabad', 'Gaziyabad', 'Gali', 'Dishawar'].includes(g);

                  return (
                    <button
                      key={g}
                      onClick={() => {
                        if (!isComingSoon) {
                          onOpenGame(g);
                        }
                      }}
                      disabled={isComingSoon}
                      className={`w-full py-2.5 px-3 rounded-lg border text-white font-extrabold text-xs uppercase tracking-wider flex items-center justify-between transition-all shadow ${
                        isComingSoon
                          ? 'bg-[#20070d] border-zinc-800 opacity-60 cursor-not-allowed'
                          : isMain
                          ? 'border-2 sm:border-3 border-blue-500 shadow-[0_0_14px_rgba(59,130,246,0.35)] bg-gradient-to-r from-[#0d1627] via-[#09101d] to-[#040810] hover:brightness-110 active:scale-95 cursor-pointer'
                          : !bettingStatus.isOpen
                          ? 'bg-[#2b0811] hover:bg-[#380b16] border-red-500/60 active:scale-95 cursor-pointer'
                          : 'bg-[#3e2723] hover:bg-[#52332e] border-amber-500 active:scale-95 cursor-pointer hover:scale-[1.01]'
                      }`}
                    >
                      <div className="text-left">
                        <div className="font-bold text-white text-xs">{g}</div>
                        {isComingSoon ? (
                          <span className="text-[9px] text-amber-400 font-mono font-semibold">
                            Coming Soon
                          </span>
                        ) : (
                          <div className="text-[9px] text-zinc-400 font-mono font-normal">
                            Last {timing?.lastTime} | Result {timing?.openTime}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {isComingSoon ? (
                          <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono font-bold">
                            SOON
                          </span>
                        ) : !bettingStatus.isOpen ? (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-900/80 text-red-200 border border-red-500/50 font-bold">
                            TIME OVER
                          </span>
                        ) : (
                          <div className="flex items-center gap-1 text-amber-300">
                            <span className="text-[10px] font-mono font-bold">PLAY</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={onOpenBetHistory}
                className="mt-2 w-full py-2.5 bg-gradient-to-r from-[#2a0808] to-[#3a0b12] hover:from-[#3a0b12] hover:to-[#4e0f1a] text-amber-300 border border-amber-500/70 rounded-lg font-bold text-xs uppercase tracking-wider transition-all shadow active:scale-95 flex items-center justify-center gap-1.5"
              >
                <History className="w-4 h-4 text-amber-400" />
                <span>MY BET HISTORY</span>
              </button>
            </div>

            {/* ROYAL CARD GAMES BOX (TEEN PATTI, FLASH, MAANG PATTA, RUMMY) */}
            <div className="bg-gradient-to-br from-[#240612] via-[#1a040d] to-[#0a0104] border-2 border-yellow-400/80 rounded-xl p-3.5 shadow-xl flex flex-col gap-2.5 relative overflow-hidden group">
              <div className="flex items-center justify-between border-b border-yellow-400/30 pb-2">
                <span className="text-xs font-black text-yellow-300 uppercase flex items-center gap-1.5 font-display tracking-wider">
                  <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                  <span>ROYAL CARD GAMES</span>
                </span>
                <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500 font-bold uppercase font-mono">
                  COMING SOON
                </span>
              </div>

              <div className="text-[11px] text-zinc-300 leading-snug">
                <strong>Royal Card Games Arena filhaal band hai.</strong>
                <p className="text-[10px] text-amber-200/80 mt-1">
                  Card games jald hi available honge.
                </p>
              </div>

              <div className="w-full rounded-lg border border-zinc-700 bg-black/30 py-2.5 text-center text-xs font-black uppercase tracking-wider text-amber-300">
                Royal Card Games Arena — Coming Soon
              </div>
            </div>
          </div>
        </div>

        {/* MOBILE DEDICATED TAB VIEWS */}
        <div className="lg:hidden space-y-3">
          {mobileTab === 'games' && (
            <div className="space-y-3">
              <div className="bg-[#1c060f] border-2 border-amber-500/70 rounded-xl p-3 shadow-md">
                <div className="flex items-center justify-between pb-2 border-b border-amber-500/30 mb-2.5">
                  <span className="text-xs font-bold text-emerald-400 font-display uppercase tracking-wider flex items-center gap-1.5">
                    <Gamepad2 className="w-4 h-4" />
                    <span>SELECT GAME TO PLAY</span>
                  </span>
                  <span className="text-[10px] text-amber-300 font-mono">6 Live Games</span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {ALL_GAMES.map(g => {
                    const timing = GAME_TIMINGS[g];
                    const isComingSoon = timing?.isComingSoon;
                    const bettingStatus = checkIsGameBettingOpen(g);

                    return (
                      <button
                        key={g}
                        onClick={() => {
                          if (!isComingSoon) {
                            onOpenGame(g);
                          }
                        }}
                        disabled={isComingSoon}
                        className={`w-full py-2.5 px-3.5 rounded-xl border text-white font-extrabold text-sm uppercase flex items-center justify-between transition-all shadow ${
                          isComingSoon
                            ? 'bg-[#1b060d] border-zinc-800 opacity-60 cursor-not-allowed'
                            : !bettingStatus.isOpen
                            ? 'bg-[#290712] border-red-500/70 active:scale-[0.98]'
                            : 'bg-gradient-to-r from-[#3e2723] to-[#2a130f] hover:from-[#4e312b] hover:to-[#381a15] border-amber-500/80 active:scale-[0.98]'
                        }`}
                      >
                        <div className="text-left flex items-center gap-2">
                          <div className={`w-2.5 h-2.5 rounded-full ${
                            isComingSoon ? 'bg-zinc-600' : !bettingStatus.isOpen ? 'bg-red-500 shadow-[0_0_8px_#ef4444]' : 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                          }`} />
                          <div>
                            <div className="tracking-wide text-xs sm:text-sm">{g}</div>
                            {isComingSoon ? (
                              <span className="text-[9px] text-amber-400 font-mono font-semibold block">
                                Coming Soon
                              </span>
                            ) : (
                              <span className="text-[9.5px] text-zinc-400 font-mono font-normal block">
                                Last {timing?.lastTime} | Result {timing?.openTime}
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {isComingSoon ? (
                            <span className="text-[9px] px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 font-mono font-bold">
                              SOON
                            </span>
                          ) : !bettingStatus.isOpen ? (
                            <span className="text-[10px] px-2 py-0.5 rounded bg-red-950 text-red-300 border border-red-600 font-bold">
                              TIME OVER
                            </span>
                          ) : (
                            <>
                              <span className="text-xs px-2 py-0.5 rounded bg-amber-500/20 text-yellow-300 border border-amber-500/40 font-mono font-bold">
                                {resultsDB[g] || '--'}
                              </span>
                              <div className="px-3 py-1 rounded-lg bg-amber-500 text-black font-black text-xs">
                                PLAY
                              </div>
                            </>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                <button
                  onClick={onOpenBetHistory}
                  className="mt-3 w-full py-2.5 bg-gradient-to-r from-[#2a0808] to-[#3a0b12] text-amber-300 border border-amber-500/70 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow active:scale-95 flex items-center justify-center gap-1.5"
                >
                  <History className="w-4 h-4 text-amber-400" />
                  <span>VIEW MY BET HISTORY</span>
                </button>
              </div>

              {/* MOBILE ROYAL CARD GAMES CARD */}
              <div className="bg-gradient-to-br from-[#240612] via-[#1a040d] to-[#0a0104] border-2 border-yellow-400/90 rounded-2xl p-4 shadow-xl flex flex-col gap-2.5">
                <div className="flex items-center justify-between border-b border-yellow-400/30 pb-2">
                  <span className="text-xs sm:text-sm font-black text-yellow-300 uppercase flex items-center gap-1.5 font-display tracking-wider">
                    <Sparkles className="w-4 h-4 text-amber-400 animate-pulse" />
                    <span>ROYAL CARD GAMES ARENA</span>
                  </span>
                  <span className="text-[9px] px-2 py-0.5 rounded-full bg-amber-950 text-amber-300 border border-amber-500 font-bold uppercase font-mono">
                    COMING SOON
                  </span>
                </div>

                <div className="text-xs text-zinc-300 leading-snug">
                  <strong>Royal Card Games Arena filhaal band hai.</strong>
                  <p className="text-[11px] text-amber-200/90 mt-1">
                    Card games jald hi available honge.
                  </p>
                </div>

                <div className="w-full rounded-xl border border-zinc-700 bg-black/30 py-3 text-center text-xs font-black uppercase tracking-wider text-amber-300">
                  Royal Card Games Arena — Coming Soon
                </div>
              </div>

              <div className="bg-[#1b060d] border border-zinc-800 rounded-xl p-3 text-xs">
                <div className="flex items-center justify-between text-zinc-400">
                  <span>Balance: <strong className="text-emerald-400 font-mono">{userPoints} P</strong></span>
                  <span>Pending Bets: <strong className="text-amber-300 font-mono">{pendingBets.length}</strong></span>
                </div>
              </div>
            </div>
          )}

          {mobileTab === 'results' && (
            <div className="space-y-3">
              <div className="bg-[#25080c] border-2 border-amber-500/80 rounded-xl p-3 shadow-md">
                <div className="flex items-center justify-between border-b border-amber-500/30 pb-2 mb-2.5">
                  <div className="flex items-center gap-1.5">
                    <Trophy className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold text-amber-300 font-display uppercase tracking-wider">
                      LIVE DECLARED RESULTS
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <PWAInstallButton />
                    <button
                      onClick={() => {
                        soundManager.playSelectSound();
                        onOpenChart();
                      }}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-mono text-[10px] font-bold active:scale-95 transition-all"
                    >
                      <Table className="w-3 h-3 text-amber-400" />
                      <span>CHART</span>
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {ALL_GAMES.map(g => {
                    const timing = GAME_TIMINGS[g];
                    const isComingSoon = timing?.isComingSoon;
                    const resultField = ({
                      Faridabad: 'FBD',
                      Gaziyabad: 'GZB',
                      Gali: 'GALI',
                      Dishawar: 'DISHAWAR'
                    } as Partial<Record<GameName, keyof ChartRecord>>)[g];
                    const todayRecord = chartRecords.find(record => record.date === todayDate);
                    const yesterdayRecord = chartRecords.find(record => record.date === yesterdayDate);
                    const declaredVal = isComingSoon ? '--' : (resultField
                      ? (todayRecord?.[resultField] || '--')
                      : (resultsDB[g] || '--'));
                    const yesterdayVal = resultField ? (yesterdayRecord?.[resultField] || '--') : '--';
                    const isMainGame = ['Faridabad', 'Gaziyabad', 'Gali', 'Dishawar'].includes(g);
                    return (
                      <div
                        key={g}
                        className={`rounded-xl p-2.5 text-center shadow flex flex-col justify-between transition-all ${
                          isMainGame 
                            ? 'border-3 border-blue-500 shadow-[0_0_18px_rgba(59,130,246,0.45)] bg-gradient-to-b from-[#0f172a] to-[#04060b]' 
                            : 'bg-[#28080f] border-2 border-amber-500/40'
                        }`}
                      >
                        <div>
                          <div className="text-[11px] font-bold text-emerald-400 uppercase tracking-tight truncate">
                            {g}
                          </div>
                          {isComingSoon ? (
                            <div className="mt-0.5">
                              <span className="text-[8.5px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-yellow-300 border border-amber-500/40 font-bold uppercase font-mono">
                                COMING SOON
                              </span>
                            </div>
                          ) : (
                            <div className="text-[8.5px] text-zinc-400 font-mono mt-0.5 leading-tight">
                              <div>Last: {timing?.lastTime}</div>
                              <div className="text-amber-300">Open: {timing?.openTime}</div>
                            </div>
                          )}
                        </div>
                        <div className="mt-1 space-y-0.5 font-mono">
                          <div className="text-xs text-zinc-400">TODAY <strong className="text-lg text-yellow-300">{declaredVal}</strong></div>
                          <div className="text-[10px] text-zinc-500">YESTERDAY <strong className="text-sm text-amber-200">{yesterdayVal}</strong></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="bg-[#1d0709] border-2 border-emerald-500/60 rounded-xl p-3 shadow-md space-y-2">
                <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider border-b border-emerald-500/30 pb-1.5 flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-yellow-400" />
                    <span>RESULT STATUS</span>
                  </span>
                  <span className="text-[10px] text-amber-300 font-mono">90x Payout</span>
                </div>
                <div className="text-xs text-zinc-300">
                  {winBets.length > 0 ? (
                    <div className="p-2.5 bg-emerald-950/40 border border-emerald-500/50 rounded-lg space-y-1">
                      <div className="font-extrabold text-emerald-300 text-xs">
                        CONGRATULATIONS! WINNING TICKETS
                      </div>
                      {winBets.slice(0, 3).map((wb, i) => (
                        <div key={i} className="flex justify-between text-emerald-200 text-xs">
                          <span>{wb.game} [{wb.num}]</span>
                          <span className="font-bold">+{wb.payout || wb.pts * 90} P</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-2 text-zinc-400 text-xs">
                      {pendingBets.length > 0 ? (
                        <span className="text-amber-300 font-bold">
                          {pendingBets.length} bet(s) waiting for admin result announcement!
                        </span>
                      ) : (
                        <span>No active bets. Tap GAMES tab to play!</span>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {mobileTab === 'wallet' && (
            <div className="space-y-3">
              {/* Balance Badge */}
              <div className="bg-[#1b050d] border-2 border-amber-500/60 rounded-xl p-3 text-center shadow">
                <div className="text-[11px] text-zinc-400 uppercase font-bold">Current Wallet Balance</div>
                <div className="text-3xl font-black text-emerald-400 font-mono mt-0.5">
                  {userPoints} P
                </div>
                <div className="text-[11px] text-amber-300 font-bold mt-0.5">User ID: {currentUser}</div>
              </div>

              {/* Transfer Points to Admin */}
              <div className="bg-[#200508] border border-amber-500/60 rounded-xl p-3 text-center shadow">
                <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2 flex items-center justify-center gap-1">
                  <Send className="w-3.5 h-3.5" />
                  <span>Transfer Point To Admin</span>
                </div>
                <form onSubmit={handleSendToAdmin} className="space-y-2">
                  <input
                    type="number"
                    placeholder="Enter Points"
                    value={transferInput}
                    onChange={e => setTransferInput(e.target.value)}
                    className="w-full px-3 py-2 bg-black/60 border border-amber-500/50 rounded-lg text-white font-bold text-sm focus:outline-none focus:border-amber-400 text-center"
                  />
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-lg border border-yellow-300 shadow active:scale-95"
                  >
                    Send To Admin
                  </button>
                </form>
              </div>

              {/* User Password Change Card (Mobile) */}
              <div className="bg-[#19040c] border border-amber-500/60 rounded-xl p-3 shadow">
                <div className="text-amber-400 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1.5 border-b border-amber-500/30 pb-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-amber-400" />
                  <span>CHANGE PASSWORD (APNA PASSWORD BADLEIN)</span>
                </div>
                {pwdMsg && (
                  <div className={`p-2 rounded-lg text-[11px] mb-2 font-semibold ${
                    pwdMsg.isError ? 'bg-red-950/80 text-red-200 border border-red-500' : 'bg-emerald-950/80 text-emerald-200 border border-emerald-500'
                  }`}>
                    {pwdMsg.text}
                  </div>
                )}
                <form onSubmit={handleChangePassword} className="space-y-2">
                  <input
                    type="password"
                    placeholder="Old Password"
                    value={oldPassword}
                    onChange={e => setOldPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-black/60 border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="password"
                    placeholder="New Password"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-black/60 border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                  <input
                    type="password"
                    placeholder="Confirm New Password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    className="w-full px-3 py-2 bg-black/60 border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-amber-400"
                  />
                  <button
                    type="submit"
                    className="w-full py-2 bg-[#2d0916] hover:bg-[#3f0d20] border border-amber-500/50 text-amber-300 font-bold text-xs uppercase tracking-wider rounded-lg active:scale-95 shadow flex items-center justify-center gap-1"
                  >
                    <ShieldCheck className="w-3.5 h-3.5 text-amber-400" />
                    <span>Update Password</span>
                  </button>
                </form>
              </div>

              {/* Receive Points */}
              <div className="bg-[#102008] border border-emerald-500/70 rounded-xl p-3 shadow">
                <div className="text-emerald-400 font-bold text-xs uppercase tracking-wider mb-2 flex items-center gap-1">
                  <ArrowDownLeft className="w-3.5 h-3.5" />
                  <span>Receive Points ({pendingTransfers.length})</span>
                </div>
                <div className="space-y-1.5 text-xs">
                  {pendingTransfers.length === 0 ? (
                    <div className="text-zinc-500 text-[11px] text-center py-2">No pending points from admin.</div>
                  ) : (
                    pendingTransfers.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-2 bg-[#1b3310] border border-emerald-500/40 rounded-lg flex items-center justify-between gap-1"
                      >
                        <div>
                          <span className="font-extrabold text-emerald-300 font-mono text-sm">+{item.points} P</span>
                          <span className="text-[10px] text-zinc-400 block">{item.time}</span>
                        </div>
                        <button
                          onClick={() => {
                            soundManager.playBetOkSound();
                            onAcceptTransfer(idx, item.points);
                          }}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase rounded-lg shadow active:scale-95"
                        >
                          RECEIVE
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Point History */}
              <div className="bg-[#1a0f08] border border-amber-500/50 rounded-xl p-3 shadow">
                <div className="text-amber-400 font-bold text-xs uppercase tracking-wider pb-1.5 border-b border-amber-500/30 mb-2 flex items-center gap-1">
                  <History className="w-3.5 h-3.5" />
                  <span>Point History</span>
                </div>
                <div className="space-y-1.5 max-h-48 overflow-y-auto text-xs">
                  {pointHistory.length === 0 ? (
                    <div className="text-zinc-500 text-center py-3 text-xs">No points history.</div>
                  ) : (
                    pointHistory.map((item, idx) => {
                      const isPlus = item.type.includes('Received') || item.type.includes('Won');
                      return (
                        <div
                          key={idx}
                          className="border-b border-zinc-800/80 pb-1 flex items-center justify-between"
                        >
                          <div>
                            <span className={`font-bold font-mono ${isPlus ? 'text-emerald-400' : 'text-red-400'}`}>
                              {isPlus ? '+' : '-'}{item.points} P
                            </span>
                            <span className="text-zinc-400 text-[10px] ml-1">({item.type})</span>
                          </div>
                          <span className="text-[10px] text-zinc-500 font-mono">{item.time}</span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
