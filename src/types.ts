export type GameName =
  | 'Faridabad'
  | 'Gaziyabad'
  | 'Gali'
  | 'Dishawar'
  | 'Faridabad Old'
  | 'Dishawar Old';

export const ALL_GAMES: GameName[] = [
  'Faridabad',
  'Gaziyabad',
  'Gali',
  'Dishawar',
  'Faridabad Old',
  'Dishawar Old'
];

export interface GameTimingInfo {
  lastTime?: string; // e.g. "5:30 PM"
  openTime?: string; // e.g. "6:00 PM"
  isComingSoon?: boolean;
}

export const GAME_TIMINGS: Record<GameName, GameTimingInfo> = {
  'Faridabad': { lastTime: '5:30 PM', openTime: '6:00 PM' },
  'Gaziyabad': { lastTime: '9:20 PM', openTime: '9:55 PM' },
  'Gali': { lastTime: '11:00 PM', openTime: '11:25 PM' },
  'Dishawar': { lastTime: '1:00 AM', openTime: '5:00 AM' },
  'Faridabad Old': { isComingSoon: true },
  'Dishawar Old': { isComingSoon: true }
};

export interface UserAccount {
  pass: string;
  points: number;
  failedAttempts?: number;
  isLocked?: boolean;
  lockReason?: string;
  isDeactivated?: boolean;
  deactivatedReason?: string;
}

export type UsersDB = Record<string, UserAccount>;

export interface AdminCredentials {
  username: string;
  pass: string;
}

export interface BetItem {
  id?: string;
  time: string;
  game: GameName;
  num: string; // e.g. "00"-"99", or "A-0"-"A-9", "B-0"-"B-9"
  pts: number;
  status: 'pending' | 'win' | 'loss';
  payout?: number;
}

export type UserBetsDB = Record<string, Record<string, BetItem>>;

export type ResultsDB = Record<string, string>;

export type ResultDeclaredTimesDB = Record<string, number>;

export interface PointHistoryItem {
  type: string;
  points: number;
  time: string;
  game?: string;
}

export type PointHistoryDB = Record<string, PointHistoryItem[]>;

export interface UserToAdminReq {
  id?: string;
  user: string;
  points: number;
  time: string;
}

export interface AdminTransferItem {
  points: number;
  time: string;
}

export type AdminTransfersDB = Record<string, AdminTransferItem[]>;

export interface AdminTxLog {
  user: string;
  type: string;
  pts: number;
  time: string;
  timestamp?: number;
}

export interface ChartRecord {
  date: string;        // 'YYYY-MM-DD' key
  dayNumber: string;   // '10', '11', '12', '13'
  fullDate: string;    // '10/10/2026'
  FBD: string;         // Faridabad
  GALI: string;        // Gali
  GZB: string;         // Gaziyabad
  DISHAWAR: string;    // Dishawar
}

export type ChartHistoryDB = Record<string, ChartRecord>;

export interface PaymentRequest {
  id: string;
  userId: string;
  mobileNumber?: string;
  accountNumber?: string;
  qrCodeDataUrl?: string;
  createdAt: number;
  expiresAt: number;
}

export type AdminPaymentQrCode = string;

// -------------------------------------------------------------
// ROYAL CARD GAMES (TEEN PATTI, FLASH, MAANG PATTA, RUMMY)
// -------------------------------------------------------------

export type CardGameType = 'TEEN_PATTI' | 'FLASH' | 'MAANG_PATTA' | 'RUMMY';

export type CardSuit = '♠' | '♥' | '♦' | '♣';
export type CardRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | '10' | 'J' | 'Q' | 'K' | 'A';

export interface PlayingCard {
  suit: CardSuit;
  rank: CardRank;
  value: number; // 2..14 (A=14)
  isRed: boolean;
}

export type TableRoomStatus = 'WAITING' | 'PLAYING' | 'FINISHED';

export interface TableRoom {
  id: string;
  name: string;
  gameType: CardGameType;
  stake: number; // 10, 20, 50, 100, etc.
  creatorId: string;
  creatorName: string;
  status: TableRoomStatus;
  maxPlayers: number; // typically 2 to 4
  players: string[]; // user IDs currently in room
  readyPlayers: string[]; // users who clicked ready/accepted
  activeTurnIndex: number;
  pot: number;
  winnerId?: string;
  winnerHandDesc?: string;
  createdAt: number;
  // Game specific state
  cardsDealt?: Record<string, PlayingCard[]>; // userId -> cards
  maangTrumpCard?: PlayingCard; // for Maang Patta
  maangSelectedRank?: CardRank; // rank player called
  turnTimer?: number;
  logs: string[];
}

export interface GameChallengeRequest {
  id: string;
  fromUserId: string;
  fromUserName: string;
  toUserId?: string; // If 1v1 direct, or undefined if room join request
  targetRoomId?: string; // If asking to join existing room with 2 players
  gameType: CardGameType;
  stake: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  timestamp: number;
  message?: string;
}
