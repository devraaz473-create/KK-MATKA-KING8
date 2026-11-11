import React, { useState } from 'react';
import { ChartRecord } from '../types';
import { Table, Calendar, Sparkles } from 'lucide-react';
import { buildCurrentMonthChartRecords, getISTDateParts } from '../utils/storage';

interface ChartHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  chartRecords: ChartRecord[];
}

export const ChartHistoryModal: React.FC<ChartHistoryModalProps> = ({
  isOpen,
  onClose,
  chartRecords
}) => {
  const [selectedMonth, setSelectedMonth] = useState(() => getISTDateParts().date.slice(0, 7));
  if (!isOpen) return null;

  const availableMonths = Array.from(new Set([
    getISTDateParts().date.slice(0, 7),
    ...chartRecords.map(record => record.date.slice(0, 7))
  ])).sort((a, b) => b.localeCompare(a));
  const monthDate = new Date(`${selectedMonth}-15T12:00:00.000Z`);
  const monthRecords = buildCurrentMonthChartRecords(chartRecords, monthDate)
    .filter(record => record.date.startsWith(`${selectedMonth}-`));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-[#18040c] border-2 border-amber-500 rounded-2xl shadow-[0_0_40px_rgba(245,158,11,0.5)] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-4 py-3 bg-gradient-to-r from-[#290714] to-[#1e050f] border-b border-amber-500/40 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-yellow-300 border border-amber-500/40">
              <Table className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black font-display text-amber-300 tracking-wider uppercase flex items-center gap-1.5">
                <span>CHART HISTORY</span>
                <Sparkles className="w-4 h-4 text-yellow-400 animate-spin" />
              </h2>
              <p className="text-[10px] sm:text-xs text-zinc-400 font-mono">DATE | FBD | GZBD | GALI | DISHWAR</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Chart Table */}
        <div className="p-3 sm:p-5 overflow-y-auto flex-1">
          <label className="mb-3 flex items-center gap-2 text-xs font-bold text-amber-300">
            MONTH
            <select
              value={selectedMonth}
              onChange={event => setSelectedMonth(event.target.value)}
              className="rounded-lg border border-amber-500/50 bg-black/60 px-3 py-1.5 text-white"
            >
              {availableMonths.map(month => (
                <option key={month} value={month}>
                  {new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' })
                    .format(new Date(`${month}-01T12:00:00.000Z`))}
                </option>
              ))}
            </select>
          </label>
          <div className="overflow-x-auto rounded-xl border-2 border-amber-500/60 shadow-lg bg-[#140209]">
            <table className="w-full border-collapse text-center">
              <thead>
                <tr className="bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 text-black font-display font-black text-xs sm:text-sm tracking-wider uppercase border-b-2 border-yellow-300">
                  <th className="py-2.5 px-3 border-r border-amber-800/40">
                    <div className="flex items-center justify-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-black" />
                      <span>DATE</span>
                    </div>
                  </th>
                  <th className="py-2.5 px-3 border-r border-amber-800/40">FBD</th>
                  <th className="py-2.5 px-3 border-r border-amber-800/40">GZBD</th>
                  <th className="py-2.5 px-3 border-r border-amber-800/40">GALI</th>
                  <th className="py-2.5 px-3">DISHWAR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-500/20 text-xs sm:text-sm font-mono font-bold">
                {monthRecords.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-zinc-500">
                      Koi record uplabdh nahi hai
                    </td>
                  </tr>
                ) : (
                  monthRecords.map((item) => (
                    <tr
                      key={item.date}
                      className="hover:bg-amber-500/10 transition-colors odd:bg-[#1a050d] even:bg-[#140209]"
                    >
                      {/* DATE Column: only day number (e.g., 10, 11, 12, 13) */}
                      <td className="py-3 px-3 border-r border-amber-500/20 font-black text-emerald-400 text-sm sm:text-base font-display">
                        <span className="inline-block px-2.5 py-0.5 rounded-md bg-emerald-950/70 border border-emerald-500/40 shadow-sm" title={item.fullDate}>
                          {item.dayNumber}
                        </span>
                      </td>
                      {/* FBD Result */}
                      <td className="py-3 px-3 border-r border-amber-500/20">
                        <span className={`inline-block px-2.5 py-0.5 rounded font-black text-sm sm:text-base tracking-widest ${
                          item.FBD !== '--' 
                            ? 'bg-yellow-400 text-black shadow-[0_0_8px_rgba(250,204,21,0.6)]' 
                            : 'text-zinc-500'
                        }`}>
                          {item.FBD}
                        </span>
                      </td>
                      {/* GZBD Result */}
                      <td className="py-3 px-3 border-r border-amber-500/20">
                        <span className={`inline-block px-2.5 py-0.5 rounded font-black text-sm sm:text-base tracking-widest ${
                          item.GZB !== '--' 
                            ? 'bg-yellow-400 text-black shadow-[0_0_8px_rgba(250,204,21,0.6)]' 
                            : 'text-zinc-500'
                        }`}>
                          {item.GZB}
                        </span>
                      </td>
                      {/* GALI Result */}
                      <td className="py-3 px-3 border-r border-amber-500/20">
                        <span className={`inline-block px-2.5 py-0.5 rounded font-black text-sm sm:text-base tracking-widest ${
                          item.GALI !== '--' 
                            ? 'bg-yellow-400 text-black shadow-[0_0_8px_rgba(250,204,21,0.6)]' 
                            : 'text-zinc-500'
                        }`}>
                          {item.GALI}
                        </span>
                      </td>
                      {/* DISHAWAR Result */}
                      <td className="py-3 px-3">
                        <span className={`inline-block px-2.5 py-0.5 rounded font-black text-sm sm:text-base tracking-widest ${
                          item.DISHAWAR !== '--' 
                            ? 'bg-yellow-400 text-black shadow-[0_0_8px_rgba(250,204,21,0.6)]' 
                            : 'text-zinc-500'
                        }`}>
                          {item.DISHAWAR}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="mt-3 flex items-center justify-between text-[11px] text-zinc-400 px-1">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" />
              <span>Date Column me sirf Tarikh No (10, 11, 12, 13...) show hoti hai.</span>
            </span>
            <span className="font-mono text-amber-400 font-bold">Total: {monthRecords.length} Days</span>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 bg-[#15030a] border-t border-amber-500/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-wider rounded-xl border border-yellow-300 shadow transition-all active:scale-95 cursor-pointer"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
