import React from 'react';
import { X, Trophy, ShieldCheck, Zap, Info } from 'lucide-react';

interface RulesModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const RulesModal: React.FC<RulesModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#18060c] border-2 border-amber-500/80 rounded-xl shadow-[0_0_30px_rgba(245,158,11,0.25)] flex flex-col max-h-[85vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-4 border-b border-amber-500/40 bg-[#250812] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-lg font-bold tracking-wider text-amber-300 font-display uppercase">Game Rules & Payout Rates</h2>
          </div>
          <button 
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-sm text-zinc-200">
          <div className="bg-[#2a0c16] border border-amber-500/30 rounded-lg p-3.5 space-y-2">
            <div className="text-amber-400 font-bold flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-300" />
              <span>PAYOUT MULTIPLIERS</span>
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="bg-[#19050d] p-2.5 rounded border border-amber-500/20">
                <span className="text-zinc-400 block">Jodi (00 - 99)</span>
                <span className="text-emerald-400 font-bold text-base">90x Payout</span>
                <p className="text-[11px] text-zinc-400 mt-0.5">10 P wager = 900 P Win</p>
              </div>
              <div className="bg-[#19050d] p-2.5 rounded border border-amber-500/20">
                <span className="text-zinc-400 block">Harup (A & B 0 - 9)</span>
                <span className="text-emerald-400 font-bold text-base">9x Payout</span>
                <p className="text-[11px] text-zinc-400 mt-0.5">10 P wager = 90 P Win</p>
              </div>
            </div>
          </div>

          <div className="space-y-2 text-xs leading-relaxed text-zinc-300">
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Jodi Numbers (00 - 99):</strong> Choose any 2-digit number. If the declared result matches your number, you receive 90 times your wager!
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">A-Harup (Andar / Tens Digit):</strong> Predict the first digit (0 to 9) of the declared 2-digit result. Wins 9x your wager.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">B-Harup (Bahar / Units Digit):</strong> Predict the second digit (0 to 9) of the declared 2-digit result. Wins 9x your wager.
              </div>
            </div>
            <div className="flex items-start gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-white">Instant Settlement:</strong> When results are declared by the Admin, winning points are credited automatically and immediately to your balance.
              </div>
            </div>
          </div>

          <div className="bg-[#14060b] p-3 rounded-lg border border-zinc-800 text-xs text-zinc-400">
            <div className="font-semibold text-zinc-300 mb-1">Point Transfer System:</div>
            <ul className="list-disc pl-4 space-y-1">
              <li>Users can send points to Admin anytime.</li>
              <li>Admin transfers show up in your "RECEIVE POINTS" panel where you can claim them into your balance with one click.</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-amber-500/20 bg-[#1e070e] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white font-bold text-xs rounded-lg uppercase tracking-wider transition-all shadow-md"
          >
            I Understand
          </button>
        </div>
      </div>
    </div>
  );
};
