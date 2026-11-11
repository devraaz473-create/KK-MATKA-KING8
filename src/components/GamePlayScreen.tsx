import React, { useState } from 'react';
import { GameName, GAME_TIMINGS } from '../types';
import { soundManager } from '../utils/audio';
import { 
  sendToWhatsApp, 
  formatUserBetsForWhatsApp, 
  WHATSAPP_DISPLAY_NUMBER 
} from '../utils/whatsapp';
import { 
  ArrowLeft, 
  Check, 
  Trash2, 
  Volume2, 
  VolumeX, 
  Layers, 
  ArrowRightLeft, 
  Plus, 
  X, 
  ArrowRight,
  AlertTriangle,
  Clock,
  Sparkles
} from 'lucide-react';

import { checkIsGameBettingOpen } from '../utils/storage';

interface GamePlayScreenProps {
  gameName: GameName;
  userPoints: number;
  currentUser: string;
  onBack: () => void;
  onConfirmBets: (game: GameName, bets: Record<string, number>) => Promise<boolean>;
}

const TOKEN_VALUES = [10, 50, 100, 500, 1000];
const ALL_DIGITS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

export const GamePlayScreen: React.FC<GamePlayScreenProps> = ({
  gameName,
  userPoints,
  currentUser,
  onBack,
  onConfirmBets
}) => {
  const [selectedToken, setSelectedToken] = useState<number>(10);
  const [stagedBets, setStagedBets] = useState<Record<string, number>>({});
  const [soundOn, setSoundOn] = useState<boolean>(soundManager.enabled);
  const [insufficientAlert, setInsufficientAlert] = useState<string | null>(null);
  const [betTimeOverModal, setBetTimeOverModal] = useState<string | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Check betting open status
  const bettingStatus = checkIsGameBettingOpen(gameName);

  // COMBINE BET Modal State
  const [isCombineModalOpen, setIsCombineModalOpen] = useState<boolean>(false);
  const [selectedFrontDigits, setSelectedFrontDigits] = useState<number[]>([3, 6]);
  const [selectedBackDigits, setSelectedBackDigits] = useState<number[]>([8, 9]);

  const triggerInsufficientAlert = (msg = 'Apke paas paryapt points nahi hain!') => {
    soundManager.playCancelSound();
    setInsufficientAlert(msg);
    setTimeout(() => {
      setInsufficientAlert(null);
    }, 2800);
  };

  const toggleAudio = () => {
    const next = soundManager.toggleSound();
    setSoundOn(next);
  };

  const stagedTotal = Object.values(stagedBets).reduce((acc, pts) => acc + pts, 0);
  const remainingPoints = userPoints - stagedTotal;

  const handleSelectToken = (val: number) => {
    soundManager.playSelectSound();
    setSelectedToken(val);
  };

  const handleNumberClick = (boxId: string) => {
    const currentTiming = checkIsGameBettingOpen(gameName);
    if (!currentTiming.isOpen) {
      soundManager.playCancelSound();
      setBetTimeOverModal(currentTiming.reason || 'BET TIME OVER! Is game me abhi bet nahi lag sakti.');
      return;
    }
    if (remainingPoints < selectedToken) {
      triggerInsufficientAlert(`Agla ${selectedToken}P lagane ke liye balance kam hai (Shesh: ${remainingPoints}P)`);
      return;
    }
    soundManager.playChipSound();
    setStagedBets(prev => {
      const current = prev[boxId] || 0;
      return {
        ...prev,
        [boxId]: current + selectedToken
      };
    });
  };

  const handleAllCancel = () => {
    soundManager.playCancelSound();
    setStagedBets({});
  };

  const [lastConfirmedBets, setLastConfirmedBets] = useState<{ bets: Record<string, number>; total: number } | null>(null);

  const handleBetOK = async () => {
    const currentTiming = checkIsGameBettingOpen(gameName);
    if (!currentTiming.isOpen) {
      soundManager.playCancelSound();
      setBetTimeOverModal(currentTiming.reason || 'BET TIME OVER! Is game me abhi bet nahi lag sakti.');
      return;
    }
    if (Object.keys(stagedBets).length === 0) {
      soundManager.playCancelSound();
      return;
    }
    if (userPoints < stagedTotal) {
      triggerInsufficientAlert('Insufficient Points Balance to place this bet.');
      return;
    }
    const placedBetsSnapshot = { ...stagedBets };
    const placedTotalSnapshot = stagedTotal;
    setIsConfirming(true);
    try {
      const confirmed = await onConfirmBets(gameName, placedBetsSnapshot);
      if (!confirmed) return;
      soundManager.playBetOkSound();
      setStagedBets({});
      setLastConfirmedBets({ bets: placedBetsSnapshot, total: placedTotalSnapshot });
    } finally {
      setIsConfirming(false);
    }
  };

  const handleSendToWhatsAppDirect = () => {
    soundManager.playSelectSound();
    if (Object.keys(stagedBets).length > 0) {
      triggerInsufficientAlert('Please pehle BET OK karein. Confirm hone ke baad hi WhatsApp slip bhej sakte hain.');
      return;
    }
    const betsToSend = lastConfirmedBets?.bets;
    if (!betsToSend || Object.keys(betsToSend).length === 0) {
      soundManager.playCancelSound();
      triggerInsufficientAlert('WhatsApp par bhejne se pehle BET OK karein.');
      return;
    }
    const msg = formatUserBetsForWhatsApp(currentUser, gameName, betsToSend);
    sendToWhatsApp(msg);
  };

  // COMBINE (Crossing) Logic: Front digits cross with Back digits
  const generatedCombineJodis: string[] = [];
  for (const f of selectedFrontDigits) {
    for (const b of selectedBackDigits) {
      generatedCombineJodis.push(`${f}${b}`);
    }
  }

  const toggleFrontDigit = (d: number) => {
    soundManager.playSelectSound();
    setSelectedFrontDigits(prev => 
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  };

  const toggleBackDigit = (d: number) => {
    soundManager.playSelectSound();
    setSelectedBackDigits(prev => 
      prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort((a, b) => a - b)
    );
  };

  // Khud se Khud / Self Crossing
  const handleKhudSeKhud = () => {
    soundManager.playChipSound();
    if (selectedFrontDigits.length > 0) {
      setSelectedBackDigits([...selectedFrontDigits]);
    } else if (selectedBackDigits.length > 0) {
      setSelectedFrontDigits([...selectedBackDigits]);
    } else {
      setSelectedFrontDigits([1, 2, 3, 4, 5]);
      setSelectedBackDigits([1, 2, 3, 4, 5]);
    }
  };

  const handleSwapSides = () => {
    soundManager.playSelectSound();
    const temp = [...selectedFrontDigits];
    setSelectedFrontDigits([...selectedBackDigits]);
    setSelectedBackDigits(temp);
  };

  const handleSelectAllFront = () => {
    soundManager.playSelectSound();
    setSelectedFrontDigits([...ALL_DIGITS]);
  };

  const handleClearFront = () => {
    soundManager.playSelectSound();
    setSelectedFrontDigits([]);
  };

  const handleSelectAllBack = () => {
    soundManager.playSelectSound();
    setSelectedBackDigits([...ALL_DIGITS]);
  };

  const handleClearBack = () => {
    soundManager.playSelectSound();
    setSelectedBackDigits([]);
  };

  const handleApplyCombine = () => {
    const currentTiming = checkIsGameBettingOpen(gameName);
    if (!currentTiming.isOpen) {
      soundManager.playCancelSound();
      setBetTimeOverModal(currentTiming.reason || 'BET TIME OVER! Is game me abhi bet nahi lag sakti.');
      setIsCombineModalOpen(false);
      return;
    }
    if (generatedCombineJodis.length === 0) {
      soundManager.playCancelSound();
      return;
    }
    const cost = generatedCombineJodis.length * selectedToken;
    if (remainingPoints < cost) {
      triggerInsufficientAlert(`Points kam hain! ${generatedCombineJodis.length} jodi ke liye ${cost}P chahiye (Available: ${remainingPoints}P)`);
      return;
    }
    soundManager.playBetOkSound();
    setStagedBets(prev => {
      const next = { ...prev };
      for (const num of generatedCombineJodis) {
        const boxId = `J-${num}`;
        next[boxId] = (next[boxId] || 0) + selectedToken;
      }
      return next;
    });
    setIsCombineModalOpen(false);
  };

  const handleRemoveCombine = () => {
    if (generatedCombineJodis.length === 0) return;
    soundManager.playCancelSound();
    setStagedBets(prev => {
      const next = { ...prev };
      for (const num of generatedCombineJodis) {
        const boxId = `J-${num}`;
        delete next[boxId];
      }
      return next;
    });
  };

  const combineCost = generatedCombineJodis.length * selectedToken;

  return (
    <div className="min-h-screen w-full bg-[#0d0206] text-white flex flex-col pb-44 select-none relative">
      {/* Insufficient Points Toast Alert */}
      {insufficientAlert && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-red-600 text-white border-2 border-yellow-300 font-extrabold text-xs sm:text-sm px-4 py-2.5 rounded-xl shadow-[0_0_30px_rgba(239,68,68,0.9)] flex items-center gap-2 animate-bounce">
          <AlertTriangle className="w-4 h-4 text-yellow-300 shrink-0" />
          <span>{insufficientAlert}</span>
        </div>
      )}

      {/* Top Bar */}
      <div className="sticky top-0 z-30 bg-[#240610]/95 backdrop-blur-md border-b-2 border-amber-500/80 px-2.5 sm:px-5 py-2 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-2 sm:gap-3">
          <button
            onClick={() => {
              handleAllCancel();
              onBack();
            }}
            className="flex items-center gap-1 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[#3d0f1c] hover:bg-[#521426] border border-amber-500/40 text-amber-300 text-xs font-bold transition-all active:scale-95"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>BACK</span>
          </button>
          <div>
            <h1 className="text-sm sm:text-lg font-bold font-display text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
              <span>{gameName}</span>
              <span className="text-[9px] bg-red-600/30 text-red-300 border border-red-500/50 px-1 py-0.2 rounded font-mono">LIVE</span>
            </h1>
            {GAME_TIMINGS[gameName] && (
              <div className="text-[9px] text-zinc-300 font-mono flex items-center gap-1">
                <Clock className="w-2.5 h-2.5 text-amber-400" />
                <span>Last {GAME_TIMINGS[gameName].lastTime} | Result {GAME_TIMINGS[gameName].openTime}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <button
            onClick={toggleAudio}
            className="p-1.5 rounded-lg bg-[#3d0f1c] text-zinc-300 hover:text-amber-400 border border-zinc-700 transition-colors"
            title={soundOn ? 'Mute Sound' : 'Enable Sound'}
          >
            {soundOn ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-zinc-500" />}
          </button>
          <div className="bg-[#120308] border border-amber-500/50 px-2 sm:px-3 py-0.5 rounded-lg text-right">
            <span className="text-[9px] text-zinc-400 block uppercase font-bold">Avail Pts</span>
            <span className="text-xs sm:text-base font-extrabold text-emerald-400 font-mono">
              {remainingPoints} P
            </span>
          </div>
        </div>
      </div>

      <div className="max-w-4xl w-full mx-auto p-2 sm:p-4 space-y-3">
        {/* BET TIME OVER Warning Banner if closed */}
        {!bettingStatus.isOpen && (
          <div className="bg-red-950/95 border-2 border-red-500 text-red-200 text-xs px-4 py-3 rounded-xl flex items-center justify-between gap-3 shadow-[0_0_25px_rgba(239,68,68,0.5)] animate-pulse">
            <div className="flex items-center gap-2 font-bold">
              <AlertTriangle className="w-5 h-5 text-yellow-300 shrink-0" />
              <div>
                <span className="text-yellow-300 uppercase block font-black text-xs sm:text-sm">⛔ BET TIME OVER</span>
                <span className="text-[11px] text-zinc-300">{bettingStatus.reason}</span>
              </div>
            </div>
            <button
              onClick={onBack}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase shrink-0"
            >
              Back
            </button>
          </div>
        )}

        {/* Last Placed Bet Success Banner with WhatsApp sharing */}
        {lastConfirmedBets && (
          <div className="bg-emerald-950/90 border border-emerald-500 text-emerald-200 text-xs px-3 py-2.5 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 shadow-lg">
            <div>
              <div className="font-extrabold text-emerald-300 flex items-center gap-1.5 text-xs sm:text-sm">
                <span>BET PLACED SUCCESSFULLY!</span>
                <span className="font-mono text-yellow-300">({lastConfirmedBets.total} Points Wagered)</span>
              </div>
              <div className="text-[11px] text-zinc-300">
                Confirmed wager on {gameName}. Ab slip WhatsApp par bhej sakte hain:
              </div>
            </div>
            <button
              onClick={() => {
                const msg = formatUserBetsForWhatsApp(currentUser, gameName, lastConfirmedBets.bets);
                sendToWhatsApp(msg);
              }}
              className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center gap-1.5 border border-emerald-300 shadow cursor-pointer active:scale-95"
            >
              <span>SEND SLIP TO WHATSAPP ({WHATSAPP_DISPLAY_NUMBER})</span>
            </button>
          </div>
        )}

        {/* Insufficient Points Warning Banner */}
        {remainingPoints < 10 && (
          <div className="bg-red-950/90 border border-red-500 text-red-200 text-xs px-3 py-2 rounded-xl flex items-center justify-between shadow">
            <div className="flex items-center gap-1.5 font-bold">
              <AlertTriangle className="w-4 h-4 text-yellow-400 shrink-0" />
              <span>Low Balance (Shesh: {remainingPoints} P)</span>
            </div>
            <span className="text-[10px] text-amber-300 font-semibold">Admin se points lein</span>
          </div>
        )}

        {/* COMBINE BET BUTTON CARD */}
        <div className="bg-gradient-to-r from-[#280812] via-[#3d0e1d] to-[#1c050c] border-2 border-amber-500/80 rounded-xl p-3 shadow-lg flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-orange-600 border border-yellow-300 flex items-center justify-center text-black font-black shadow-[0_0_15px_rgba(245,158,11,0.5)] shrink-0">
              <Layers className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-black font-display text-amber-300 uppercase tracking-wider">
                  COMBINE BET
                </h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-mono font-bold">
                  0-9 CROSSING
                </span>
              </div>
              <p className="text-[11px] text-zinc-300 mt-0.5">
                Front (0-9) aur Back (0-9) digits cross karke jodi banayein
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              soundManager.playSelectSound();
              setIsCombineModalOpen(true);
            }}
            className="w-full sm:w-auto px-5 py-2.5 bg-gradient-to-r from-orange-600 via-amber-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-black font-black text-xs uppercase tracking-wider rounded-xl border-2 border-yellow-300 shadow-[0_0_20px_rgba(245,158,11,0.5)] transition-all active:scale-95 flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <span>OPEN COMBINE BET</span>
            <ArrowRight className="w-4 h-4 stroke-[3]" />
          </button>
        </div>

        {/* HARUP A & B CONTAINERS */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {/* A HARUP */}
          <div className="bg-[#1c050d] border border-amber-500/50 rounded-xl p-2.5 shadow-md">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-1 mb-2">
              <span className="text-[11px] sm:text-xs font-bold text-emerald-400 font-display tracking-wider">
                A HARUP (ANDAR: 0 - 9)
              </span>
              <span className="text-[10px] text-zinc-400 font-bold">9x Payout</span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
              {ALL_DIGITS.map(i => {
                const boxId = `A-${i}`;
                const pts = stagedBets[boxId] || 0;
                return (
                  <button
                    key={boxId}
                    onClick={() => handleNumberClick(boxId)}
                    className={`relative min-h-[46px] sm:min-h-[50px] rounded-lg border flex flex-col items-center justify-center p-0.5 transition-all ${
                      pts > 0
                        ? 'bg-[#3b0918] border-yellow-300 text-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.6)] scale-105 z-10 ring-2 ring-yellow-400'
                        : 'bg-[#2b0814] hover:bg-[#3d0b1c] border-amber-500/30 text-white'
                    }`}
                  >
                    <span className="font-bold text-xs">{`A-${i}`}</span>
                    {pts > 0 && (
                      <span className="mt-0.5 px-1 py-0.2 bg-yellow-400 text-black font-black text-[10px] sm:text-xs rounded shadow leading-none border border-black/40">
                        {pts}P
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* B HARUP */}
          <div className="bg-[#1c050d] border border-amber-500/50 rounded-xl p-2.5 shadow-md">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-1 mb-2">
              <span className="text-[11px] sm:text-xs font-bold text-emerald-400 font-display tracking-wider">
                B HARUP (BAHAR: 0 - 9)
              </span>
              <span className="text-[10px] text-zinc-400 font-bold">9x Payout</span>
            </div>
            <div className="grid grid-cols-5 sm:grid-cols-10 gap-1">
              {ALL_DIGITS.map(i => {
                const boxId = `B-${i}`;
                const pts = stagedBets[boxId] || 0;
                return (
                  <button
                    key={boxId}
                    onClick={() => handleNumberClick(boxId)}
                    className={`relative min-h-[46px] sm:min-h-[50px] rounded-lg border flex flex-col items-center justify-center p-0.5 transition-all ${
                      pts > 0
                        ? 'bg-[#3b0918] border-yellow-300 text-yellow-300 shadow-[0_0_12px_rgba(250,204,21,0.6)] scale-105 z-10 ring-2 ring-yellow-400'
                        : 'bg-[#2b0814] hover:bg-[#3d0b1c] border-amber-500/30 text-white'
                    }`}
                  >
                    <span className="font-bold text-xs">{`B-${i}`}</span>
                    {pts > 0 && (
                      <span className="mt-0.5 px-1 py-0.2 bg-yellow-400 text-black font-black text-[10px] sm:text-xs rounded shadow leading-none border border-black/40">
                        {pts}P
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* 00 TO 99 JODI GRID */}
        <div className="bg-[#17040a] border-2 border-amber-500/60 rounded-xl p-2 sm:p-4 shadow-lg">
          <div className="flex items-center justify-between border-b border-amber-500/30 pb-1.5 mb-2.5">
            <div className="flex items-center gap-1.5">
              <span className="text-xs sm:text-sm font-bold text-emerald-400 font-display tracking-wider">
                00 TO 99 JODI NUMBERS
              </span>
              <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                90x Win
              </span>
            </div>
            <span className="text-[10px] text-zinc-400 font-mono">Tap no. to place {selectedToken}P</span>
          </div>

          <div className="grid grid-cols-10 gap-1 sm:gap-1.5">
            {Array.from({ length: 100 }).map((_, i) => {
              const numStr = i < 10 ? `0${i}` : `${i}`;
              const boxId = `J-${numStr}`;
              const pts = stagedBets[boxId] || 0;
              return (
                <button
                  key={boxId}
                  onClick={() => handleNumberClick(boxId)}
                  className={`relative min-h-[44px] sm:min-h-[48px] rounded-lg border flex flex-col items-center justify-center p-0.5 transition-all touch-manipulation active:scale-95 ${
                    pts > 0
                      ? 'bg-gradient-to-br from-amber-700 to-orange-800 border-yellow-300 text-white font-extrabold shadow-[0_0_12px_rgba(250,204,21,0.7)] scale-105 z-10 ring-2 ring-yellow-400'
                      : 'bg-[#290712] hover:bg-[#400c1e] border-amber-500/25 text-zinc-100 font-bold'
                  }`}
                >
                  <span className="text-xs sm:text-sm tracking-tighter leading-none">{numStr}</span>
                  {pts > 0 && (
                    <span className="mt-0.5 px-1 py-0.2 bg-yellow-400 text-black font-black text-[9.5px] sm:text-[11px] rounded shadow leading-none border border-black/50">
                      {pts}P
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Floating Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#1e050e]/98 backdrop-blur-md border-t-2 border-amber-500 px-2 sm:px-6 py-2 shadow-[0_-5px_25px_rgba(0,0,0,0.9)]">
        <div className="max-w-4xl mx-auto flex flex-col gap-1.5">
          {/* Chips Selector Row */}
          <div className="flex items-center justify-center gap-2 sm:gap-4 overflow-x-auto py-0.5">
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-wider hidden sm:inline">
              Chips:
            </span>
            {TOKEN_VALUES.map(val => {
              const isSelected = selectedToken === val;
              let chipBg = 'bg-sky-500 text-black';
              if (val === 50) chipBg = 'bg-purple-600 text-white';
              if (val === 100) chipBg = 'bg-orange-500 text-black';
              if (val === 500) chipBg = 'bg-emerald-500 text-black';
              if (val === 1000) chipBg = 'bg-amber-400 text-black';
              return (
                <button
                  key={val}
                  onClick={() => handleSelectToken(val)}
                  className={`w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center font-black text-xs font-mono shadow border-2 transition-all cursor-pointer ${chipBg} ${
                    isSelected
                      ? 'border-emerald-300 ring-4 ring-emerald-500/50 scale-110 -translate-y-0.5'
                      : 'border-white/40 opacity-80'
                  }`}
                >
                  {val}
                </button>
              );
            })}
          </div>

          {/* Action Buttons Row */}
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex items-center gap-1.5 text-[11px] sm:text-xs">
              <span className="text-zinc-400">Total: <strong className="text-white">{Object.keys(stagedBets).length}</strong></span>
              <span className="text-zinc-500">|</span>
              <span className="text-amber-400">Wager: <strong className="text-emerald-400 font-mono">{stagedTotal} P</strong></span>
            </div>

            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                type="button"
                onClick={handleSendToWhatsAppDirect}
                disabled={stagedTotal === 0 && !lastConfirmedBets}
                className="px-2.5 sm:px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-30 disabled:pointer-events-none text-white font-black text-xs uppercase tracking-wider border border-emerald-300 shadow transition-all active:scale-95 flex items-center gap-1 cursor-pointer"
                title={`Send Slip to WhatsApp ${WHATSAPP_DISPLAY_NUMBER}`}
              >
                <span>WHATSAPP</span>
              </button>
              <button
                onClick={handleAllCancel}
                disabled={stagedTotal === 0 || isConfirming}
                className="px-2.5 sm:px-4 py-2 rounded-lg bg-red-700 hover:bg-red-600 disabled:opacity-30 disabled:pointer-events-none text-white font-bold text-xs uppercase tracking-wider border border-red-400 shadow transition-all active:scale-95 flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>CANCEL</span>
              </button>
              <button
                onClick={handleBetOK}
                disabled={stagedTotal === 0}
                className="px-4 sm:px-7 py-2 rounded-lg bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 disabled:opacity-30 disabled:pointer-events-none text-white font-black text-xs uppercase tracking-wider border-2 border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all active:scale-95 flex items-center gap-1.5"
              >
                <Check className="w-4 h-4 stroke-[3]" />
                <span>{isConfirming ? 'SAVING...' : 'BET OK'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* COMBINE BET MODAL */}
      {isCombineModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-xl bg-[#1b050f] border-2 border-amber-500 rounded-2xl shadow-[0_0_40px_rgba(245,158,11,0.4)] flex flex-col max-h-[92vh] overflow-hidden">
            {/* Modal Header */}
            <div className="px-4 py-3 border-b border-amber-500/40 bg-[#290714] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-amber-400" />
                <h2 className="text-base font-black font-display text-amber-300 tracking-wider uppercase">
                  COMBINE BET (CROSSING)
                </h2>
              </div>
              <button
                onClick={() => setIsCombineModalOpen(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-4 overflow-y-auto space-y-4">
              {/* 1. FRONT DIGITS */}
              <div className="bg-[#14030a] border border-amber-500/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wide">
                      1. FRONT DIGITS (ANDAR)
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      Selected: [{selectedFrontDigits.join(', ') || 'None'}]
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      onClick={handleSelectAllFront}
                      className="px-2 py-0.5 bg-[#2d0916] hover:bg-[#410e20] text-amber-300 rounded border border-amber-500/30"
                    >
                      All (0-9)
                    </button>
                    <button
                      onClick={handleClearFront}
                      className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {ALL_DIGITS.map(d => {
                    const isSelected = selectedFrontDigits.includes(d);
                    return (
                      <button
                        key={d}
                        onClick={() => toggleFrontDigit(d)}
                        className={`h-10 rounded-lg font-black text-base transition-all flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-b from-amber-400 to-orange-500 text-black border-2 border-yellow-200 shadow-[0_0_12px_rgba(245,158,11,0.8)] scale-105 ring-1 ring-yellow-300'
                            : 'bg-[#290712] hover:bg-[#3d0b1c] border border-amber-500/30 text-white'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* MIDDLE SHORTCUTS: KHUD SE KHUD & SWAP */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={handleKhudSeKhud}
                  className="px-4 py-2 bg-gradient-to-r from-red-600 via-rose-600 to-amber-600 hover:from-red-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-wider rounded-xl border border-yellow-300 shadow-md transition-all active:scale-95 flex items-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-yellow-300 animate-spin" />
                  <span>KHUD SE KHUD (SELF CROSS)</span>
                </button>
                <button
                  type="button"
                  onClick={handleSwapSides}
                  className="px-3.5 py-2 bg-[#2d0916] hover:bg-[#430e21] border border-amber-500/40 text-amber-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all active:scale-95 flex items-center gap-1.5 shadow"
                  title="Swap Front & Back"
                >
                  <ArrowRightLeft className="w-3.5 h-3.5 text-amber-400" />
                  <span>SWAP (FRONT ⇋ BACK)</span>
                </button>
              </div>

              {/* 2. BACK DIGITS */}
              <div className="bg-[#14030a] border border-emerald-500/40 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-black text-emerald-400 uppercase tracking-wide">
                      2. BACK DIGITS (BAHAR)
                    </span>
                    <span className="text-[11px] text-zinc-400 font-mono">
                      Selected: [{selectedBackDigits.join(', ') || 'None'}]
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-[10px]">
                    <button
                      onClick={handleSelectAllBack}
                      className="px-2 py-0.5 bg-[#12280d] hover:bg-[#1d3d15] text-emerald-300 rounded border border-emerald-500/30"
                    >
                      All (0-9)
                    </button>
                    <button
                      onClick={handleClearBack}
                      className="px-2 py-0.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
                    >
                      Clear
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {ALL_DIGITS.map(d => {
                    const isSelected = selectedBackDigits.includes(d);
                    return (
                      <button
                        key={d}
                        onClick={() => toggleBackDigit(d)}
                        className={`h-10 rounded-lg font-black text-base transition-all flex items-center justify-center cursor-pointer ${
                          isSelected
                            ? 'bg-gradient-to-b from-emerald-400 to-green-500 text-black border-2 border-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.8)] scale-105 ring-1 ring-emerald-300'
                            : 'bg-[#1a0810] hover:bg-[#280c18] border border-emerald-500/30 text-white'
                        }`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 3. LIVE GENERATED JODIS SUMMARY */}
              <div className="bg-[#120409] border border-amber-500/40 rounded-xl p-3 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-white">Banegi Jodi:</span>
                    <span className="text-base font-black text-yellow-300 font-mono">
                      {generatedCombineJodis.length} JODI
                    </span>
                  </div>
                  <div className="text-zinc-400">
                    Total Cost: <strong className="text-emerald-400 font-mono text-sm">{combineCost} P</strong> ({selectedToken}P per Jodi)
                  </div>
                </div>

                {generatedCombineJodis.length === 0 ? (
                  <div className="text-center py-4 text-zinc-500 text-xs">
                    Kripya kam se kam 1 Front aur 1 Back digit chunein
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto p-1.5 bg-black/60 rounded-lg border border-zinc-800">
                    {generatedCombineJodis.map(jodi => (
                      <span
                        key={jodi}
                        className={`px-2 py-0.5 rounded text-xs font-mono font-black ${
                          stagedBets[`J-${jodi}`]
                            ? 'bg-amber-400 text-black border border-yellow-200 shadow'
                            : 'bg-[#2b0814] text-amber-200 border border-amber-500/30'
                        }`}
                      >
                        {jodi}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Modal Footer Controls */}
            <div className="px-4 py-3 border-t border-amber-500/30 bg-[#220711] flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsCombineModalOpen(false)}
                  className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase rounded-xl transition-all"
                >
                  CANCEL
                </button>
                {generatedCombineJodis.some(j => stagedBets[`J-${j}`]) && (
                  <button
                    type="button"
                    onClick={handleRemoveCombine}
                    className="px-3 py-2 bg-red-700 hover:bg-red-600 text-white font-bold text-xs rounded-xl border border-red-400 transition-all active:scale-95 flex items-center gap-1"
                    title="Remove from board"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>REMOVE FROM BOARD</span>
                  </button>
                )}
              </div>
              <button
                type="button"
                onClick={handleApplyCombine}
                disabled={generatedCombineJodis.length === 0}
                className="px-6 py-2.5 bg-gradient-to-r from-emerald-600 to-green-500 hover:from-emerald-500 hover:to-green-400 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-emerald-300 shadow-[0_0_20px_rgba(16,185,129,0.5)] transition-all active:scale-95 flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-4 h-4 stroke-[3]" />
                <span>APPLY TO BOARD ({generatedCombineJodis.length} JODI)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* BET TIME OVER POPUP MODAL                               */}
      {/* ======================================================== */}
      {betTimeOverModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-sm bg-[#1c040d] border-2 border-red-500 rounded-2xl shadow-[0_0_50px_rgba(239,68,68,0.7)] p-5 text-center flex flex-col items-center gap-3 animate-in zoom-in-95">
            <div className="w-16 h-16 rounded-full bg-red-600/30 border-2 border-red-500 flex items-center justify-center shadow-[0_0_20px_rgba(239,68,68,0.8)] animate-bounce">
              <AlertTriangle className="w-9 h-9 text-yellow-300 stroke-[2.5]" />
            </div>
            <h3 className="text-xl font-black font-display text-yellow-300 uppercase tracking-wider">
              BET TIME OVER!
            </h3>
            <p className="text-xs text-zinc-300 leading-relaxed bg-black/60 p-3 rounded-xl border border-red-500/40">
              {betTimeOverModal}
            </p>
            <div className="flex items-center gap-2 w-full mt-2">
              <button
                type="button"
                onClick={() => setBetTimeOverModal(null)}
                className="flex-1 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-xl transition-all"
              >
                Close
              </button>
              <button
                type="button"
                onClick={() => {
                  setBetTimeOverModal(null);
                  onBack();
                }}
                className="flex-1 py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-xs uppercase tracking-wider rounded-xl shadow transition-all active:scale-95"
              >
                Go Back
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
