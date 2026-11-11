import React from 'react';
import { Trophy, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundManager } from '../utils/audio';

export interface WinCelebrationData {
  game: string;
  winningNumber: string;
  totalWonPoints: number;
  betNumbers: string[];
}

interface WinningCelebrationModalProps {
  isOpen: boolean;
  onClose: () => void;
  winData: WinCelebrationData | null;
  username: string;
}

export const WinningCelebrationModal: React.FC<WinningCelebrationModalProps> = ({
  isOpen,
  onClose,
  winData,
  username
}) => {
  React.useEffect(() => {
    if (isOpen && winData) {
      soundManager.playWinCelebration();
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
        setTimeout(() => {
          confetti({
            particleCount: 50,
            angle: 60,
            spread: 55,
            origin: { x: 0 }
          });
          confetti({
            particleCount: 50,
            angle: 120,
            spread: 55,
            origin: { x: 1 }
          });
        }, 250);
      } catch {}
    }
  }, [isOpen, winData]);

  if (!isOpen || !winData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-gradient-to-b from-[#2a0614] via-[#1a030d] to-[#0d0107] border-2 border-yellow-400 rounded-2xl shadow-[0_0_50px_rgba(250,204,21,0.6)] overflow-hidden text-center p-5 sm:p-6 animate-in zoom-in-95 duration-200">
        
        {/* Glowing Ambient Top Effect */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-20 bg-yellow-500/25 blur-3xl pointer-events-none rounded-full" />

        {/* Trophy & Badge */}
        <div className="relative mx-auto w-20 h-20 rounded-full bg-gradient-to-tr from-amber-600 via-yellow-400 to-amber-500 p-1 shadow-[0_0_25px_rgba(250,204,21,0.8)] flex items-center justify-center animate-bounce">
          <div className="w-full h-full rounded-full bg-[#1b030b] flex items-center justify-center">
            <Trophy className="w-10 h-10 text-yellow-300 drop-shadow-[0_0_10px_rgba(250,204,21,0.9)]" />
          </div>
        </div>

        {/* Title */}
        <div className="mt-3 space-y-1">
          <div className="text-[11px] font-black uppercase tracking-widest text-emerald-400 flex items-center justify-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
            <span>BIG WIN CONGRATULATIONS!</span>
            <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-yellow-200 via-amber-300 to-yellow-500 font-display tracking-wider animate-pulse">
            {username}!
          </h2>
          <p className="text-xs text-zinc-300">
            Aapka number result se match ho gaya hai!
          </p>
        </div>

        {/* Win Details Card */}
        <div className="mt-4 bg-[#140209] border border-amber-500/50 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between text-xs border-b border-amber-500/30 pb-2">
            <span className="text-zinc-400">Game Name:</span>
            <span className="font-bold text-amber-300 uppercase tracking-wide">{winData.game}</span>
          </div>
          <div className="flex items-center justify-between text-xs border-b border-amber-500/30 pb-2">
            <span className="text-zinc-400">Declared Result:</span>
            <span className="font-black text-yellow-300 text-lg font-mono tracking-widest px-2.5 py-0.5 rounded bg-amber-500/20 border border-yellow-400/40">
              {winData.winningNumber}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs border-b border-amber-500/30 pb-2">
            <span className="text-zinc-400">Winning Numbers:</span>
            <span className="font-bold text-emerald-300 font-mono">
              {winData.betNumbers.join(', ')}
            </span>
          </div>
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs font-bold text-zinc-300">Total Winning Payout:</span>
            <span className="text-xl sm:text-2xl font-black text-emerald-400 font-display drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]">
              +{winData.totalWonPoints} P
            </span>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-5">
          <button
            onClick={() => {
              soundManager.playBetOkSound();
              onClose();
            }}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-yellow-400 to-amber-600 hover:from-amber-400 hover:to-yellow-500 text-black font-extrabold text-sm font-display tracking-wider shadow-[0_0_20px_rgba(250,204,21,0.6)] flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-95"
          >
            <CheckCircle2 className="w-5 h-5 text-black" />
            <span>COLLECT & ENJOY ({winData.totalWonPoints} P)</span>
            <ArrowRight className="w-4 h-4 text-black" />
          </button>
        </div>
      </div>
    </div>
  );
};
