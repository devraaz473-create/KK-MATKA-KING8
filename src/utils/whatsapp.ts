/**
 * WhatsApp Helper for KK Gaming System
 * Target Mobile No: 9310123692
 */
import { GameName, BetItem, GAME_TIMINGS } from '../types';

export const WHATSAPP_TARGET_NUMBER = '919310123692';
export const WHATSAPP_DISPLAY_NUMBER = '9310123692';

/**
 * Open WhatsApp with pre-formatted message
 */
export function sendToWhatsApp(message: string, phone: string = WHATSAPP_TARGET_NUMBER) {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMsg = encodeURIComponent(message);
  const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;
  window.open(waUrl, '_blank', 'noopener,noreferrer');
}

/**
 * Format Admin Aggregated Bets List for WhatsApp:
 * "admin id se jab whts kare to bas kis no par kitne point he yahi aaye aur kuch nhi bas only yahi"
 */
export function formatAdminAggregatedBetsForWhatsApp(
  game: GameName,
  aggregatedBets: Record<string, number>,
  totalPool: number
): string {
  const entries = Object.entries(aggregatedBets).sort((a, b) => b[1] - a[1]);
  let lines: string[] = [
    '```',
    '+----------------------+',
    `| ${game.toUpperCase().padEnd(20)} |`,
    '+------------+---------+',
    '| NUMBER     | POINTS  |',
    '+------------+---------+'
  ];

  if (entries.length === 0) {
    lines.push('| No active bets          |');
  } else {
    entries.forEach(([num, pts]) => {
      lines.push(`| ${num.padEnd(10)} | ${String(pts).padStart(5)} P |`);
    });
  }

  lines.push('+------------+---------+');
  lines.push(`| TOTAL      | ${String(totalPool).padStart(5)} P |`);
  lines.push('+----------------------+');
  lines.push('```');
  return lines.join('\n');
}

/**
 * Format User Staged/Placed Bets for WhatsApp
 */
export function formatUserBetsForWhatsApp(
  userId: string,
  game: GameName,
  bets: Record<string, number> | BetItem[]
): string {
  const timing = GAME_TIMINGS[game];
  const timeStr = timing?.lastTime && timing?.openTime 
    ? `⏰ Timing: Last ${timing.lastTime} | Result ${timing.openTime}` 
    : '';
  const dateStr = new Date().toLocaleString('en-IN', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });

  let entries: { num: string; pts: number }[] = [];
  let totalPts = 0;

  if (Array.isArray(bets)) {
    entries = bets.map(b => ({ num: b.num, pts: b.pts }));
    totalPts = bets.reduce((acc, b) => acc + b.pts, 0);
  } else {
    for (const [k, pts] of Object.entries(bets)) {
      const cleanNum = k.startsWith('J-') 
        ? k.slice(2) 
        : k.startsWith('HA-') 
          ? `A-${k.slice(3)}` 
          : k.startsWith('HB-') 
            ? `B-${k.slice(3)}` 
            : k;
      entries.push({ num: cleanNum, pts });
      totalPts += pts;
    }
  }

  let lines: string[] = [
    `THE KK GAMING - CONFIRMED BET SLIP`,
    '```',
    '+----------------------------+',
    `| USER: ${userId.padEnd(18)} |`,
    `| GAME: ${game.toUpperCase().padEnd(18)} |`,
    '+------------+---------------+',
    '| NUMBER     | POINTS        |',
    '+------------+---------------+'
  ];

  if (entries.length === 0) {
    lines.push('| No confirmed bets         |');
  } else {
    entries.forEach(b => {
      lines.push(`| ${b.num.padEnd(10)} | ${String(b.pts).padStart(8)} P |`);
    });
  }

  lines.push('+------------+---------------+');
  lines.push(`| TOTAL      | ${String(totalPts).padStart(8)} P |`);
  lines.push('+----------------------------+');
  lines.push('```');
  lines.push(`Time: ${dateStr}`);
  if (timeStr) lines.push(timeStr);
  lines.push('Bet confirmed in KK Gaming System.');

  return lines.filter(Boolean).join('\n');
}
