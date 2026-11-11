import { PlayingCard, CardSuit, CardRank, CardGameType } from '../types';

export const CARD_SUITS: CardSuit[] = ['♠', '♥', '♦', '♣'];
export const CARD_RANKS: CardRank[] = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function rankToValue(rank: CardRank): number {
  switch (rank) {
    case '2': return 2;
    case '3': return 3;
    case '4': return 4;
    case '5': return 5;
    case '6': return 6;
    case '7': return 7;
    case '8': return 8;
    case '9': return 9;
    case '10': return 10;
    case 'J': return 11;
    case 'Q': return 12;
    case 'K': return 13;
    case 'A': return 14;
  }
}

export function createFullDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of CARD_SUITS) {
    const isRed = suit === '♥' || suit === '♦';
    for (const rank of CARD_RANKS) {
      deck.push({
        suit,
        rank,
        value: rankToValue(rank),
        isRed
      });
    }
  }
  return shuffleDeck(deck);
}

export function shuffleDeck(deck: PlayingCard[]): PlayingCard[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Teen Patti / Flash Hand Evaluation (3 cards)
 * Hand Rankings:
 * 1. Trail / Trio (Three of a Kind) - e.g. AAA, KKK
 * 2. Pure Sequence (Straight Flush) - e.g. A-K-Q same suit
 * 3. Sequence (Straight) - e.g. A-K-Q different suits
 * 4. Color / Flush - e.g. same suit
 * 5. Pair - two cards of same rank
 * 6. High Card
 */
export interface HandEvaluation {
  score: number;
  description: string;
  categoryRank: number; // 6 = Trail down to 1 = High card
}

export function evaluateTeenPattiHand(cards: PlayingCard[]): HandEvaluation {
  if (cards.length < 3) {
    return { score: 0, description: 'Incomplete', categoryRank: 0 };
  }
  const sorted = [...cards].sort((a, b) => b.value - a.value);
  const [c1, c2, c3] = sorted;
  const isFlush = c1.suit === c2.suit && c2.suit === c3.suit;

  // Trio
  if (c1.value === c2.value && c2.value === c3.value) {
    return {
      categoryRank: 6,
      score: 600000 + c1.value * 100,
      description: `Trail / Trio of ${c1.rank}s (तीन इक्के/बादशाह)`
    };
  }

  // Check straight: normal (e.g. Q-J-10) or special A-2-3 / A-K-Q
  const isNormalStraight = c1.value === c2.value + 1 && c2.value === c3.value + 1;
  const isA23 = c1.value === 14 && c2.value === 3 && c3.value === 2;
  const isStraight = isNormalStraight || isA23;
  const straightHighVal = isA23 ? 3.5 : c1.value;

  // Pure Sequence (Straight Flush)
  if (isStraight && isFlush) {
    return {
      categoryRank: 5,
      score: 500000 + straightHighVal * 100,
      description: `Pure Sequence (${c1.rank}-${c2.rank}-${c3.rank} of ${c1.suit})`
    };
  }

  // Straight / Normal Sequence
  if (isStraight) {
    return {
      categoryRank: 4,
      score: 400000 + straightHighVal * 100,
      description: `Normal Sequence (${c1.rank}-${c2.rank}-${c3.rank})`
    };
  }

  // Color / Flush
  if (isFlush) {
    return {
      categoryRank: 3,
      score: 300000 + c1.value * 100 + c2.value * 5 + c3.value,
      description: `Color / Flush (${c1.suit})`
    };
  }

  // Pair
  if (c1.value === c2.value) {
    return {
      categoryRank: 2,
      score: 200000 + c1.value * 100 + c3.value,
      description: `Pair of ${c1.rank}s (जोड़ी)`
    };
  }
  if (c2.value === c3.value) {
    return {
      categoryRank: 2,
      score: 200000 + c2.value * 100 + c1.value,
      description: `Pair of ${c2.rank}s (जोड़ी)`
    };
  }
  if (c1.value === c3.value) {
    return {
      categoryRank: 2,
      score: 200000 + c1.value * 100 + c2.value,
      description: `Pair of ${c1.rank}s (जोड़ी)`
    };
  }

  // High Card
  return {
    categoryRank: 1,
    score: 100000 + c1.value * 100 + c2.value * 5 + c3.value,
    description: `High Card ${c1.rank} (${c1.rank} बड़ा पत्ता)`
  };
}

/**
 * Maang Patta Evaluation:
 * In Maang Patta, a Trump rank (or called card) is revealed. Players get cards dealt.
 * Whoever gets the called/trump card wins! If none or multiple, closest value or highest card wins.
 */
export function evaluateMaangPattaWinner(
  playerCards: Record<string, PlayingCard[]>,
  targetRank: CardRank
): { winnerId: string; reason: string } {
  const playerIds = Object.keys(playerCards);
  if (playerIds.length === 0) return { winnerId: '', reason: 'No players' };

  // First priority: did someone receive the targetRank?
  for (const pid of playerIds) {
    const cards = playerCards[pid] || [];
    const hasTarget = cards.some(c => c.rank === targetRank);
    if (hasTarget) {
      return { winnerId: pid, reason: `Maang Patta [${targetRank}] khula aur jeet gaya!` };
    }
  }

  // If nobody received target rank, highest sum of cards wins
  let bestPid = playerIds[0];
  let bestScore = -1;
  for (const pid of playerIds) {
    const cards = playerCards[pid] || [];
    const sum = cards.reduce((acc, c) => acc + c.value, 0);
    if (sum > bestScore) {
      bestScore = sum;
      bestPid = pid;
    }
  }

  return { winnerId: bestPid, reason: `Highest card points total se jeeta!` };
}
