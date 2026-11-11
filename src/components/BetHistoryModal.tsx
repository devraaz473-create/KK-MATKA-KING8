import React, { useState } from 'react';
import { UserBetsDB, GameName, BetItem } from '../types';
import { X, Trophy, Clock, CheckCircle2, XCircle, Search } from 'lucide-react';
import { sendToWhatsApp, formatUserBetsForWhatsApp, WHATSAPP_DISPLAY_NUMBER } from '../utils/whatsapp';

interface BetHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: string;
  userBetsDB: UserBetsDB;
}

export const BetHistoryModal: React.FC<BetHistoryModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  userBetsDB
}) => {
  const [filter, setFilter] = useState<'all' | 'pending' | 'win' | 'loss'>('all');
  const [search, setSearch] = useState('');

  if (!isOpen) return null;

  const userBetsMap = userBetsDB[currentUser] || {};
  const allBetsList = Object.entries(userBetsMap).map(([key, bet]) => ({
    key,
    ...bet
  })).reverse(); // latest first

  const filteredBets = allBetsList.filter(b => {
    if (filter !== 'all' && b.status !== filter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      return b.game.toLowerCase().includes(q) || b.num.toLowerCase().includes(q);
    }
    return true;
  });

  const totalWagered = allBetsList.reduce((acc, b) => acc + (b.pts || 0), 0);
  const totalWon = allBetsList
    .filter(b => b.status === 'win')
    .reduce((acc, b) => acc + (b.payout || b.pts * 90), 0);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#1c060e] border-2 border-amber-500 rounded-xl shadow-[0_0_35px_rgba(245,158,11,0.3)] flex flex-col max-h-[88vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-amber-500/30 bg-[#260813] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold font-display text-amber-300 tracking-wider uppercase">
              My Bet History ({currentUser})
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Overview Stats */}
        <div className="px-4 py-2.5 bg-[#140409] border-b border-zinc-800 grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-[#240811] p-2 rounded border border-amber-500/20">
            <span className="text-zinc-400 text-[11px] block">Total Bets</span>
            <span className="font-bold text-white text-sm">{allBetsList.length}</span>
          </div>
          <div className="bg-[#240811] p-2 rounded border border-amber-500/20">
            <span className="text-zinc-400 text-[11px] block">Total Wagered</span>
            <span className="font-bold text-amber-400 text-sm">{totalWagered} P</span>
          </div>
          <div className="bg-[#240811] p-2 rounded border border-amber-500/20">
            <span className="text-zinc-400 text-[11px] block">Total Won</span>
            <span className="font-bold text-emerald-400 text-sm">+{totalWon} P</span>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="px-4 py-2.5 bg-[#1e0710] flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800">
          <div className="flex items-center gap-1.5">
            {(['all', 'pending', 'win', 'loss'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-3 py-1 rounded text-xs font-bold uppercase transition-all ${
                  filter === tab
                    ? 'bg-amber-500 text-black shadow-sm'
                    : 'bg-[#2e0b17] text-zinc-300 hover:bg-[#3d0f20]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input
              type="text"
              placeholder="Search game/number..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1 bg-black/40 border border-amber-500/30 rounded text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-amber-400"
            />
          </div>
        </div>

        {/* Bets List */}
        <div className="p-4 overflow-y-auto space-y-2 flex-1">
          {filteredBets.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-sm">
              No bet records found for this filter.
            </div>
          ) : (
            filteredBets.map(bet => {
              const isWin = bet.status === 'win';
              const isLoss = bet.status === 'loss';
              const isPending = bet.status === 'pending';

              return (
                <div
                  key={bet.key}
                  className={`p-3 rounded-lg border flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs transition-colors ${
                    isWin
                      ? 'bg-emerald-950/30 border-emerald-500/60'
                      : isLoss
                      ? 'bg-red-950/20 border-red-900/60'
                      : 'bg-[#230812] border-amber-500/30'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-black/40 border border-amber-500/40 flex items-center justify-center font-bold text-amber-300 text-sm font-display">
                      {bet.num}
                    </div>
                    <div>
                      <div className="font-bold text-white text-sm flex items-center gap-1.5">
                        <span>{bet.game}</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                          {bet.num.startsWith('A-') ? 'Harup A' : bet.num.startsWith('B-') ? 'Harup B' : 'Jodi'}
                        </span>
                      </div>
                      <div className="text-zinc-400 text-[11px] flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-zinc-500" />
                        <span>{bet.time}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between sm:justify-end gap-3 pt-2 sm:pt-0 border-t sm:border-t-0 border-zinc-800">
                    <div className="text-right">
                      <div className="text-zinc-400 text-[11px]">Wagered: <span className="font-bold text-white">{bet.pts} P</span></div>
                      {isWin && (
                        <div className="text-emerald-400 font-extrabold text-xs">
                          Won: +{bet.payout || bet.pts * 90} P
                        </div>
                      )}
                    </div>
                    <div className="shrink-0">
                      {isWin && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500 font-bold text-[11px]">
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" /> WIN
                        </span>
                      )}
                      {isLoss && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-red-500/20 text-red-300 border border-red-500/50 font-bold text-[11px]">
                          <XCircle className="w-3.5 h-3.5 text-red-400" /> LOSS
                        </span>
                      )}
                      {isPending && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 font-bold text-[11px]">
                          <Clock className="w-3.5 h-3.5 text-amber-400" /> PENDING
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-amber-500/20 bg-[#16050b] flex flex-wrap items-center justify-between gap-2">
          {filteredBets.length > 0 && (
            <button
              onClick={() => {
                const betsArray: BetItem[] = filteredBets.map(b => ({
                  game: b.game as GameName,
                  num: b.num,
                  pts: b.pts,
                  status: b.status,
                  time: b.time
                }));
                const targetGame = (filter !== 'all' && filteredBets[0]?.game) 
                  ? filteredBets[0].game as GameName 
                  : 'Faridabad';
                const msg = formatUserBetsForWhatsApp(currentUser, targetGame, betsArray);
                sendToWhatsApp(msg);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs uppercase flex items-center gap-1.5 border border-emerald-300 shadow cursor-pointer active:scale-95"
              title={`Send all listed bets to WhatsApp ${WHATSAPP_DISPLAY_NUMBER}`}
            >
              <span>SEND ALL BETS TO WHATSAPP ({WHATSAPP_DISPLAY_NUMBER})</span>
            </button>
          )}
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-white rounded font-bold text-xs uppercase ml-auto"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
