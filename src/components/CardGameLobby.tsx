import React, { useState, useEffect } from 'react';
import { 
  CardGameType, 
  PlayingCard, 
  TableRoom, 
  GameChallengeRequest, 
  UsersDB,
  CardRank
} from '../types';
import { 
  createFullDeck, 
  evaluateTeenPattiHand, 
  evaluateMaangPattaWinner, 
  CARD_RANKS 
} from '../utils/cardGameEngine';
import { 
  getTableRoomsDB, 
  saveTableRoomsDB, 
  getChallengeRequestsDB, 
  saveChallengeRequestsDB, 
  getUsersDB, 
  saveUsersDB, 
  addPointHistory 
} from '../utils/storage';
import { soundManager } from '../utils/audio';
import { 
  Sparkles, 
  Users, 
  Trophy, 
  PlusCircle, 
  Play, 
  Check, 
  X, 
  ArrowLeft, 
  RotateCcw, 
  Coins, 
  ShieldAlert, 
  Crown,
  Eye,
  Send,
  UserCheck,
  Flame
} from 'lucide-react';

interface CardGameLobbyProps {
  currentUser: string;
  userPoints: number;
  usersDB: UsersDB;
  onBack: () => void;
  showToast: (msg: string) => void;
  onRefreshUserData: () => void;
}

export const CardGameLobby: React.FC<CardGameLobbyProps> = ({
  currentUser,
  userPoints,
  usersDB,
  onBack,
  showToast,
  onRefreshUserData
}) => {
  // Navigation inside Card game: 'lobby' | 'table'
  const [activeTab, setActiveTab] = useState<'tables' | 'requests' | 'create'>('tables');
  const [selectedGameType, setSelectedGameType] = useState<CardGameType>('TEEN_PATTI');
  
  // Rooms and Requests
  const [rooms, setRooms] = useState<TableRoom[]>(() => getTableRoomsDB());
  const [challenges, setChallenges] = useState<GameChallengeRequest[]>(() => getChallengeRequestsDB());
  const [currentTableId, setCurrentTableId] = useState<string | null>(null);

  // New Table Form
  const [newTableName, setNewTableName] = useState('');
  const [newTableStake, setNewTableStake] = useState<number>(20);
  const [newTableMaxPlayers, setNewTableMaxPlayers] = useState<number>(3);

  // Direct challenge modal
  const [challengeTargetUser, setChallengeTargetUser] = useState<string>('');
  const [challengeStake, setChallengeStake] = useState<number>(20);
  const [isChallengeModalOpen, setIsChallengeModalOpen] = useState(false);

  // In-Game state
  const [seeCards, setSeeCards] = useState<boolean>(false);
  const [selectedMaangRank, setSelectedMaangRank] = useState<CardRank>('K');

  // Auto-sync intervals to simulate multiplayer / acceptances
  useEffect(() => {
    const interval = setInterval(() => {
      setRooms(getTableRoomsDB());
      setChallenges(getChallengeRequestsDB());
    }, 2500);
    return () => clearInterval(interval);
  }, []);

  const activeTable = rooms.find(r => r.id === currentTableId);

  // Filter challenges for me
  const incomingChallenges = challenges.filter(
    c => c.status === 'PENDING' && (c.toUserId === currentUser || (!c.toUserId && c.targetRoomId))
  );

  // -------------------------------------------------------------
  // CREATE TABLE
  // -------------------------------------------------------------
  const handleCreateTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (userPoints < newTableStake) {
      soundManager.playCancelSound();
      showToast(`Pehle balance add karein! Stake: ${newTableStake} Points`);
      return;
    }

    // Deduct stake points from creator
    const currentDB = getUsersDB();
    if ((currentDB[currentUser]?.points || 0) < newTableStake) {
      showToast('Insufficient points!');
      return;
    }

    currentDB[currentUser].points -= newTableStake;
    saveUsersDB(currentDB);
    addPointHistory(currentUser, `Royal Card Stake (${selectedGameType})`, newTableStake);
    onRefreshUserData();

    const newRoom: TableRoom = {
      id: `room-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      name: newTableName.trim() || `${selectedGameType.replace('_', ' ')} #${Math.floor(Math.random() * 900 + 100)}`,
      gameType: selectedGameType,
      stake: newTableStake,
      creatorId: currentUser,
      creatorName: currentUser,
      status: 'WAITING',
      maxPlayers: newTableMaxPlayers,
      players: [currentUser],
      readyPlayers: [currentUser],
      activeTurnIndex: 0,
      pot: newTableStake,
      createdAt: Date.now(),
      logs: [`${currentUser} ne ${newTableStake} P table shuru kiya. Joining open hai!`]
    };

    const nextRooms = [newRoom, ...rooms];
    saveTableRoomsDB(nextRooms);
    setRooms(nextRooms);
    setCurrentTableId(newRoom.id);
    setActiveTab('tables');
    soundManager.playBetOkSound();
    showToast(`Table create ho gaya! Pot: ${newTableStake} P`);
  };

  // -------------------------------------------------------------
  // JOIN TABLE
  // -------------------------------------------------------------
  const handleJoinTable = (room: TableRoom) => {
    if (room.players.includes(currentUser)) {
      setCurrentTableId(room.id);
      return;
    }

    if (room.players.length >= room.maxPlayers) {
      soundManager.playCancelSound();
      showToast('Table Full hai! Doosra table chunein ya naya banayein.');
      return;
    }

    if (userPoints < room.stake) {
      soundManager.playCancelSound();
      showToast(`Shamil hone ke liye ${room.stake} Points hone chahiye!`);
      return;
    }

    // If 2 users already playing and 3rd wants to join: Send Join Request to room
    if (room.players.length >= 2) {
      const newReq: GameChallengeRequest = {
        id: `req-join-${Date.now()}`,
        fromUserId: currentUser,
        fromUserName: currentUser,
        targetRoomId: room.id,
        toUserId: room.creatorId,
        gameType: room.gameType,
        stake: room.stake,
        status: 'PENDING',
        timestamp: Date.now(),
        message: `${currentUser} aapke table me shamil hona chahta hai!`
      };
      const nextReqs = [newReq, ...challenges];
      saveChallengeRequestsDB(nextReqs);
      setChallenges(nextReqs);
      soundManager.playSelectSound();
      showToast(`Join Request bheji gayi ${room.creatorName} ko! Accept hone ka intezar karein.`);
      return;
    }

    // Direct Join for 1st guest
    const currentDB = getUsersDB();
    if ((currentDB[currentUser]?.points || 0) < room.stake) {
      showToast('Insufficient points!');
      return;
    }

    currentDB[currentUser].points -= room.stake;
    saveUsersDB(currentDB);
    addPointHistory(currentUser, `Joined ${room.gameType} Table`, room.stake);
    onRefreshUserData();

    const updatedRoom: TableRoom = {
      ...room,
      players: [...room.players, currentUser],
      readyPlayers: [...room.readyPlayers, currentUser],
      pot: room.pot + room.stake,
      logs: [...room.logs, `${currentUser} table me jud gaya! Pot ab ${room.pot + room.stake} P hai.`]
    };

    const nextRooms = rooms.map(r => r.id === room.id ? updatedRoom : r);
    saveTableRoomsDB(nextRooms);
    setRooms(nextRooms);
    setCurrentTableId(room.id);
    soundManager.playBetOkSound();
    showToast(`Table me jud gaye! Pot: ${updatedRoom.pot} P`);
  };

  // -------------------------------------------------------------
  // SEND 1V1 CHALLENGE REQUEST (10, 20, 50, 100 PTS)
  // -------------------------------------------------------------
  const handleSendChallenge = (targetUid: string, stakeAmt: number) => {
    if (userPoints < stakeAmt) {
      soundManager.playCancelSound();
      showToast(`Challenge bhejne ke liye ${stakeAmt} Points chahiye!`);
      return;
    }

    const newReq: GameChallengeRequest = {
      id: `req-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      fromUserId: currentUser,
      fromUserName: currentUser,
      toUserId: targetUid,
      gameType: selectedGameType,
      stake: stakeAmt,
      status: 'PENDING',
      timestamp: Date.now(),
      message: `${currentUser} ne aapko ${stakeAmt} Points ka ${selectedGameType.replace('_', ' ')} challenge bheja hai!`
    };

    const nextChallenges = [newReq, ...challenges];
    saveChallengeRequestsDB(nextChallenges);
    setChallenges(nextChallenges);
    setIsChallengeModalOpen(false);
    soundManager.playSelectSound();
    showToast(`Challenge Request ${targetUid} ko bhej di gayi (${stakeAmt} P)!`);
  };

  // -------------------------------------------------------------
  // ACCEPT CHALLENGE REQUEST (HA)
  // -------------------------------------------------------------
  const handleAcceptChallenge = (req: GameChallengeRequest) => {
    if (userPoints < req.stake) {
      soundManager.playCancelSound();
      showToast(`Accept karne ke liye kam se kam ${req.stake} Points chahiye!`);
      return;
    }

    const currentDB = getUsersDB();
    if ((currentDB[currentUser]?.points || 0) < req.stake) {
      showToast('Insufficient points!');
      return;
    }

    // Check sender balance too
    if ((currentDB[req.fromUserId]?.points || 0) < req.stake) {
      showToast(`Sender (${req.fromUserId}) ke paas ab points nahi hain!`);
      return;
    }

    // If join request for existing room:
    if (req.targetRoomId) {
      const room = rooms.find(r => r.id === req.targetRoomId);
      if (room && !room.players.includes(req.fromUserId)) {
        // deduct from the requester
        currentDB[req.fromUserId].points -= req.stake;
        saveUsersDB(currentDB);
        addPointHistory(req.fromUserId, `Joined ${room.gameType} Table`, req.stake);

        room.players.push(req.fromUserId);
        room.readyPlayers.push(req.fromUserId);
        room.pot += req.stake;
        room.logs.push(`${req.fromUserId} ka join request swikar hua! 3 Khiladi table par hain.`);

        saveTableRoomsDB([...rooms]);
        setRooms([...rooms]);
      }
    } else {
      // 1v1 New Game Table
      currentDB[currentUser].points -= req.stake;
      currentDB[req.fromUserId].points -= req.stake;
      saveUsersDB(currentDB);

      addPointHistory(currentUser, `Accepted ${req.gameType} Challenge`, req.stake);
      addPointHistory(req.fromUserId, `Challenge Accepted by ${currentUser}`, req.stake);
      onRefreshUserData();

      const newRoom: TableRoom = {
        id: `room-1v1-${Date.now()}`,
        name: `1v1 ${req.gameType.replace('_', ' ')} (${req.fromUserId} vs ${currentUser})`,
        gameType: req.gameType,
        stake: req.stake,
        creatorId: req.fromUserId,
        creatorName: req.fromUserId,
        status: 'WAITING',
        maxPlayers: 2,
        players: [req.fromUserId, currentUser],
        readyPlayers: [req.fromUserId, currentUser],
        activeTurnIndex: 0,
        pot: req.stake * 2,
        createdAt: Date.now(),
        logs: [`Match tay! ${req.fromUserId} aur ${currentUser} table par aa chuke hain. Pot: ${req.stake * 2} P`]
      };

      const nextRooms = [newRoom, ...rooms];
      saveTableRoomsDB(nextRooms);
      setRooms(nextRooms);
      setCurrentTableId(newRoom.id);
    }

    // Update challenge status
    const nextReqs = challenges.map(c => c.id === req.id ? { ...c, status: 'ACCEPTED' as const } : c);
    saveChallengeRequestsDB(nextReqs);
    setChallenges(nextReqs);

    soundManager.playBetOkSound();
    showToast(`Challenge swikar kiya! Khel shuru.`);
  };

  // -------------------------------------------------------------
  // REJECT CHALLENGE REQUEST (NA)
  // -------------------------------------------------------------
  const handleRejectChallenge = (req: GameChallengeRequest) => {
    const nextReqs = challenges.map(c => c.id === req.id ? { ...c, status: 'REJECTED' as const } : c);
    saveChallengeRequestsDB(nextReqs);
    setChallenges(nextReqs);
    soundManager.playCancelSound();
    showToast(`Request aswikar kar di gayi.`);
  };

  // -------------------------------------------------------------
  // START DEALING / PLAYING CARDS IN TABLE
  // -------------------------------------------------------------
  const handleStartGameDeal = (room: TableRoom) => {
    if (room.players.length < 2) {
      showToast('Khel shuru karne ke liye kam se kam 2 khiladi chahiye!');
      return;
    }

    const deck = createFullDeck();
    const cardsDealt: Record<string, PlayingCard[]> = {};

    // Deal cards based on game type
    // Teen Patti / Flash: 3 cards each
    // Maang Patta: 3 cards each + 1 trump card
    // Rummy: 7 cards each
    const cardsPerPlayer = room.gameType === 'RUMMY' ? 7 : 3;

    let cardIdx = 0;
    for (const pid of room.players) {
      cardsDealt[pid] = deck.slice(cardIdx, cardIdx + cardsPerPlayer);
      cardIdx += cardsPerPlayer;
    }

    let trumpCard: PlayingCard | undefined = undefined;
    if (room.gameType === 'MAANG_PATTA') {
      trumpCard = deck[cardIdx];
      cardIdx++;
    }

    const updatedRoom: TableRoom = {
      ...room,
      status: 'PLAYING',
      cardsDealt,
      maangTrumpCard: trumpCard,
      maangSelectedRank: selectedMaangRank,
      logs: [
        ...room.logs,
        `🃏 Patte baant diye gaye (${cardsPerPlayer} cards)! Sabhi khiladi apne patte dekh sakte hain.`
      ]
    };

    const nextRooms = rooms.map(r => r.id === room.id ? updatedRoom : r);
    saveTableRoomsDB(nextRooms);
    setRooms(nextRooms);
    soundManager.playBetOkSound();
    setSeeCards(true);
    showToast('🃏 Patte distribute ho gaye! Khel shuru.');
  };

  // -------------------------------------------------------------
  // SHOWDOWN & CLAIM WINNER
  // -------------------------------------------------------------
  const handleShowdown = (room: TableRoom) => {
    if (!room.cardsDealt) return;

    let winnerId = room.players[0];
    let winDesc = '';

    if (room.gameType === 'MAANG_PATTA') {
      const evalRes = evaluateMaangPattaWinner(room.cardsDealt, room.maangSelectedRank || selectedMaangRank);
      winnerId = evalRes.winnerId;
      winDesc = evalRes.reason;
    } else {
      // Teen Patti & Flash
      let bestScore = -1;
      for (const pid of room.players) {
        const pCards = room.cardsDealt[pid] || [];
        const ev = evaluateTeenPattiHand(pCards);
        if (ev.score > bestScore) {
          bestScore = ev.score;
          winnerId = pid;
          winDesc = ev.description;
        }
      }
    }

    // Award Pot to Winner
    const currentDB = getUsersDB();
    if (currentDB[winnerId]) {
      currentDB[winnerId].points += room.pot;
      saveUsersDB(currentDB);
      addPointHistory(winnerId, `Won ${room.gameType} Pot (${winDesc})`, room.pot);
      onRefreshUserData();
    }

    const updatedRoom: TableRoom = {
      ...room,
      status: 'FINISHED',
      winnerId,
      winnerHandDesc: winDesc,
      logs: [
        ...room.logs,
        `🏆 VICTORY! ${winnerId} ne baazi maari (${winDesc})! +${room.pot} Points balance me credit!`
      ]
    };

    const nextRooms = rooms.map(r => r.id === room.id ? updatedRoom : r);
    saveTableRoomsDB(nextRooms);
    setRooms(nextRooms);
    soundManager.playWinSound();
    showToast(`🏆 ${winnerId} jeet gaya! +${room.pot} Points!`);
  };

  // -------------------------------------------------------------
  // RESET / REPLAY TABLE
  // -------------------------------------------------------------
  const handleReplayTable = (room: TableRoom) => {
    if (userPoints < room.stake) {
      showToast(`Replay ke liye ${room.stake} Points chahiye!`);
      return;
    }

    const currentDB = getUsersDB();
    currentDB[currentUser].points -= room.stake;
    saveUsersDB(currentDB);
    addPointHistory(currentUser, `Replay ${room.gameType} Table`, room.stake);
    onRefreshUserData();

    const updatedRoom: TableRoom = {
      ...room,
      status: 'WAITING',
      pot: room.stake,
      readyPlayers: [currentUser],
      winnerId: undefined,
      winnerHandDesc: undefined,
      cardsDealt: undefined,
      maangTrumpCard: undefined,
      logs: [`Naya daav shuru! ${currentUser} ne ${room.stake} P daale.`]
    };

    const nextRooms = rooms.map(r => r.id === room.id ? updatedRoom : r);
    saveTableRoomsDB(nextRooms);
    setRooms(nextRooms);
    setSeeCards(false);
    showToast('Naya round shuru!');
  };

  // Other users list for 1v1 challenge
  const availableUsers = Object.keys(usersDB).filter(u => u !== currentUser);

  // -------------------------------------------------------------
  // RENDER: TABLE ACTIVE PLAY SCREEN
  // -------------------------------------------------------------
  if (activeTable) {
    const isHost = activeTable.creatorId === currentUser;
    const myCards = activeTable.cardsDealt ? (activeTable.cardsDealt[currentUser] || []) : [];
    const myHandEval = myCards.length >= 3 ? evaluateTeenPattiHand(myCards) : null;

    return (
      <div className="min-h-screen bg-[#070104] text-white flex flex-col p-2.5 sm:p-5">
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-amber-500/40 pb-3 mb-3">
          <button
            onClick={() => {
              soundManager.playSelectSound();
              setCurrentTableId(null);
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-700 text-xs font-bold hover:text-amber-300"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>LOBBY PAR WAPAS</span>
          </button>

          <div className="text-center">
            <div className="text-base sm:text-lg font-black text-yellow-300 font-display uppercase tracking-wider flex items-center justify-center gap-1.5">
              <Crown className="w-5 h-5 text-amber-400" />
              <span>{activeTable.name}</span>
            </div>
            <div className="text-[11px] text-zinc-400 font-mono">
              Game: <strong className="text-emerald-400">{activeTable.gameType.replace('_', ' ')}</strong> | Stake: <strong className="text-yellow-300">{activeTable.stake} P</strong>
            </div>
          </div>

          <div className="text-right">
            <span className="text-xs text-zinc-400 font-mono block">Mera Balance</span>
            <span className="text-sm font-black text-emerald-400 font-mono">{userPoints} P</span>
          </div>
        </div>

        {/* GREEN CASINO FELT TABLE BOARD */}
        <div className="flex-1 max-w-4xl w-full mx-auto bg-gradient-to-b from-[#0b381e] via-[#062914] to-[#041c0e] border-4 border-amber-600/80 rounded-3xl p-4 sm:p-6 shadow-[0_0_40px_rgba(5,150,105,0.25)] flex flex-col justify-between relative overflow-hidden">
          {/* Subtle table felt watermark */}
          <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none select-none">
            <span className="text-8xl sm:text-9xl font-black font-display tracking-widest text-amber-300">
              ROYAL ♣
            </span>
          </div>

          {/* Table Center: Pot, Status, Trump Card */}
          <div className="relative z-10 text-center my-auto flex flex-col items-center gap-2">
            {/* Total Pot */}
            <div className="inline-flex items-center gap-2 px-6 py-2.5 rounded-full bg-black/60 border-2 border-yellow-400 shadow-[0_0_20px_rgba(250,204,21,0.5)]">
              <Coins className="w-6 h-6 text-yellow-400 animate-pulse" />
              <div className="text-left">
                <span className="text-[10px] text-zinc-300 uppercase tracking-widest block font-bold">TOTAL POT</span>
                <span className="text-2xl font-black text-yellow-300 font-display tracking-wider">
                  {activeTable.pot} POINTS
                </span>
              </div>
            </div>

            {/* Winner Banner */}
            {activeTable.status === 'FINISHED' && activeTable.winnerId && (
              <div className="mt-3 p-4 bg-emerald-950/90 border-2 border-emerald-400 rounded-2xl shadow-xl animate-bounce max-w-md w-full">
                <div className="flex items-center justify-center gap-2 text-yellow-300 font-black text-lg">
                  <Trophy className="w-6 h-6 text-yellow-400" />
                  <span>WINNER: {activeTable.winnerId}!</span>
                </div>
                <div className="text-xs text-emerald-200 mt-1 font-semibold">
                  {activeTable.winnerHandDesc}
                </div>
                <div className="text-sm font-bold text-white mt-1">
                  Jeet mili: <span className="text-yellow-300 font-mono font-black">+{activeTable.pot} Points</span>
                </div>
              </div>
            )}

            {/* Maang Patta Trump Card & Rank Selector */}
            {activeTable.gameType === 'MAANG_PATTA' && (
              <div className="mt-2 p-3 bg-black/50 border border-amber-500/50 rounded-xl max-w-sm w-full">
                <div className="text-xs font-bold text-amber-300 mb-1">
                  MAANG PATTA (चुनिए आपका मांगा पत्ता)
                </div>
                {activeTable.status === 'WAITING' ? (
                  <div className="flex items-center justify-center gap-1 flex-wrap">
                    {CARD_RANKS.slice(7).map(r => (
                      <button
                        key={r}
                        onClick={() => setSelectedMaangRank(r)}
                        className={`w-7 h-7 rounded text-xs font-bold transition-all ${
                          selectedMaangRank === r
                            ? 'bg-amber-400 text-black font-black scale-110 shadow'
                            : 'bg-zinc-800 text-zinc-300'
                        }`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-yellow-300 font-bold">
                    Maanga gaya Patta: <strong className="text-base text-white px-2 py-0.5 rounded bg-amber-600/80">{activeTable.maangSelectedRank || selectedMaangRank}</strong>
                  </div>
                )}

                {activeTable.maangTrumpCard && (
                  <div className="mt-2 flex items-center justify-center gap-2">
                    <span className="text-xs text-zinc-300">Trump Reveal:</span>
                    <div className={`px-2.5 py-1 rounded bg-white font-black text-sm ${
                      activeTable.maangTrumpCard.isRed ? 'text-red-600' : 'text-black'
                    }`}>
                      {activeTable.maangTrumpCard.rank}{activeTable.maangTrumpCard.suit}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Waiting for Players notification */}
            {activeTable.status === 'WAITING' && (
              <div className="text-xs text-amber-300 font-mono bg-black/40 px-3 py-1 rounded-full border border-amber-500/30">
                Khiladi: {activeTable.players.length}/{activeTable.maxPlayers} • Shuru karne ke liye tayaar
              </div>
            )}
          </div>

          {/* Opponents / Table Seats (Top & Sides) */}
          <div className="relative z-10 flex items-center justify-around gap-2 mb-4">
            {activeTable.players.map((pid, idx) => {
              const isMe = pid === currentUser;
              const theirCards = activeTable.cardsDealt ? (activeTable.cardsDealt[pid] || []) : [];
              const showOtherCards = activeTable.status === 'FINISHED';

              return (
                <div 
                  key={pid} 
                  className={`flex flex-col items-center p-2 rounded-xl transition-all ${
                    isMe 
                      ? 'bg-amber-950/60 border-2 border-yellow-400 shadow-md' 
                      : 'bg-black/50 border border-zinc-700'
                  }`}
                >
                  <div className="flex items-center gap-1 text-xs font-bold text-zinc-200">
                    {pid === activeTable.creatorId && <Crown className="w-3.5 h-3.5 text-amber-400" />}
                    <span>{pid}</span>
                    {isMe && <span className="text-[9px] text-yellow-300 font-mono">(Aap)</span>}
                  </div>
                  <div className="text-[10px] text-emerald-400 font-mono">
                    {usersDB[pid]?.points || 0} P
                  </div>

                  {/* Opponent Card backs or revealed */}
                  {!isMe && (
                    <div className="flex gap-1 mt-1.5">
                      {activeTable.status === 'WAITING' ? (
                        <div className="w-8 h-11 rounded border border-zinc-600 bg-zinc-800/80 flex items-center justify-center text-[10px] text-zinc-500 font-mono">
                          SEAT
                        </div>
                      ) : showOtherCards ? (
                        theirCards.map((c, i) => (
                          <div 
                            key={i} 
                            className={`w-8 h-11 rounded bg-white border border-zinc-300 shadow flex flex-col items-center justify-center text-[11px] font-bold ${
                              c.isRed ? 'text-red-600' : 'text-black'
                            }`}
                          >
                            <span>{c.rank}</span>
                            <span className="text-[9px] -mt-1">{c.suit}</span>
                          </div>
                        ))
                      ) : (
                        [1, 2, 3].map(n => (
                          <div 
                            key={n} 
                            className="w-7 h-10 rounded bg-gradient-to-br from-red-900 to-red-950 border border-amber-400/60 flex items-center justify-center shadow"
                          >
                            <span className="text-[9px] text-amber-300 font-black">♠</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* MY CARDS SECTION (Bottom Felt Area) */}
          <div className="relative z-10 bg-black/60 border-2 border-amber-500/70 rounded-2xl p-3 sm:p-4 mt-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-yellow-300 uppercase flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-orange-500" />
                <span>AAPKE PATTE (YOUR HAND)</span>
              </span>
              {myHandEval && activeTable.status === 'PLAYING' && (
                <span className="text-xs font-black text-emerald-400 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-500/50">
                  {myHandEval.description}
                </span>
              )}
            </div>

            {/* Cards Display */}
            {activeTable.status === 'WAITING' ? (
              <div className="text-center py-4 text-xs text-zinc-400">
                Khel shuru hone par yahan aapke patte aayenge. Khiladi tayaar hain to deal karein!
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 sm:gap-3 my-2">
                {myCards.map((c, i) => {
                  if (!seeCards && activeTable.status === 'PLAYING') {
                    // Face down (Blind Play)
                    return (
                      <div 
                        key={i} 
                        className="w-14 sm:w-16 h-20 sm:h-24 rounded-lg bg-gradient-to-br from-red-900 via-[#400d16] to-[#1a0509] border-2 border-amber-400 shadow-xl flex items-center justify-center cursor-pointer transition-transform hover:scale-105"
                        onClick={() => setSeeCards(true)}
                      >
                        <span className="text-xs font-bold text-amber-300 font-display">BLIND</span>
                      </div>
                    );
                  }

                  // Face up
                  return (
                    <div 
                      key={i} 
                      className={`w-14 sm:w-16 h-20 sm:h-24 rounded-lg bg-white border-2 border-zinc-200 shadow-xl flex flex-col items-center justify-between p-1.5 transition-transform hover:-translate-y-2 select-none ${
                        c.isRed ? 'text-red-600' : 'text-zinc-900'
                      }`}
                    >
                      <div className="w-full flex items-center justify-between text-xs sm:text-sm font-black">
                        <span>{c.rank}</span>
                        <span>{c.suit}</span>
                      </div>
                      <div className="text-2xl sm:text-3xl font-extrabold my-auto">
                        {c.suit}
                      </div>
                      <div className="w-full flex items-center justify-between text-xs sm:text-sm font-black rotate-180">
                        <span>{c.rank}</span>
                        <span>{c.suit}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex items-center justify-center gap-2 mt-3 flex-wrap">
              {activeTable.status === 'WAITING' && (
                <button
                  onClick={() => handleStartGameDeal(activeTable)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs uppercase tracking-wider shadow-lg flex items-center gap-1.5 transition-all active:scale-95"
                >
                  <Play className="w-4 h-4 fill-white" />
                  <span>DEAL CARDS & PLAY</span>
                </button>
              )}

              {activeTable.status === 'PLAYING' && (
                <>
                  {!seeCards ? (
                    <button
                      onClick={() => {
                        soundManager.playSelectSound();
                        setSeeCards(true);
                      }}
                      className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-1.5"
                    >
                      <Eye className="w-4 h-4" />
                      <span>SEE PATTE (SEEN)</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => {
                        soundManager.playSelectSound();
                        setSeeCards(false);
                      }}
                      className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 font-bold text-xs uppercase tracking-wider"
                    >
                      CHHUPAYEIN (HIDE)
                    </button>
                  )}

                  <button
                    onClick={() => handleShowdown(activeTable)}
                    className="px-6 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-black text-xs uppercase tracking-wider shadow-lg border border-yellow-300 active:scale-95"
                  >
                    SHOWDOWN (BAAZI KHOLO)
                  </button>
                </>
              )}

              {activeTable.status === 'FINISHED' && (
                <button
                  onClick={() => handleReplayTable(activeTable)}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-yellow-600 text-black font-black text-xs uppercase tracking-wider shadow flex items-center gap-1.5 active:scale-95"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>PHIR SE KHELEIN (REPLAY - {activeTable.stake} P)</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Live Table Game Logs */}
        <div className="max-w-4xl w-full mx-auto mt-3 bg-black/60 border border-zinc-800 rounded-xl p-2.5">
          <div className="text-[10px] text-zinc-400 font-mono uppercase mb-1">Live Table Chat & Logs:</div>
          <div className="space-y-0.5 max-h-20 overflow-y-auto text-[11px] font-mono text-zinc-300">
            {activeTable.logs.slice(-4).map((log, i) => (
              <div key={i}>• {log}</div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: LOBBY (ROOMS, CHALLENGES, REQUESTS)
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen bg-[#0a0205] text-white flex flex-col p-2.5 sm:p-5 select-none">
      {/* Top Header */}
      <div className="sticky top-0 z-20 bg-[#1f050f]/95 backdrop-blur-md border-b-2 border-amber-500/70 p-3 rounded-2xl flex items-center justify-between shadow-lg mb-4">
        <button
          onClick={() => {
            soundManager.playSelectSound();
            onBack();
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 border border-zinc-700 text-xs font-bold hover:text-amber-300 transition-all active:scale-95"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>MAIN MENU</span>
        </button>

        <div className="text-center">
          <div className="text-base sm:text-xl font-black text-yellow-300 font-display uppercase tracking-wider flex items-center justify-center gap-1.5 drop-shadow-[0_0_8px_rgba(250,204,21,0.6)]">
            <Crown className="w-5 h-5 text-amber-400" />
            <span>ROYAL CARD GAMING ARENA</span>
          </div>
          <div className="text-[10px] sm:text-xs text-emerald-400 font-mono">
            Teen Patti • Flash • Maang Patta • Rummy (Live Player vs Player)
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-zinc-400 font-mono block">Points Balance</span>
          <span className="text-sm sm:text-base font-black text-emerald-400 font-mono">{userPoints} P</span>
        </div>
      </div>

      {/* Incoming Challenge Alerts (if any player challenged me) */}
      {incomingChallenges.length > 0 && (
        <div className="max-w-4xl w-full mx-auto mb-4 space-y-2">
          {incomingChallenges.map(req => (
            <div 
              key={req.id} 
              className="p-3 bg-gradient-to-r from-red-950 via-[#3a0815] to-amber-950 border-2 border-amber-400 rounded-2xl shadow-xl flex items-center justify-between flex-wrap gap-2 animate-pulse"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-yellow-300" />
                <div>
                  <div className="text-xs sm:text-sm font-black text-yellow-300">
                    {req.message || `${req.fromUserName} ne ${req.stake} P ka challenge bheja!`}
                  </div>
                  <div className="text-[11px] text-zinc-300 font-mono">
                    Game: <strong className="text-white">{req.gameType.replace('_', ' ')}</strong> | दाव: <strong className="text-emerald-400">{req.stake} Points</strong>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleAcceptChallenge(req)}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs uppercase flex items-center gap-1 shadow transition-all active:scale-95"
                >
                  <Check className="w-4 h-4" />
                  <span>HA (ACCEPT)</span>
                </button>
                <button
                  onClick={() => handleRejectChallenge(req)}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-red-800 text-zinc-300 hover:text-white font-bold text-xs uppercase flex items-center gap-1 transition-all active:scale-95"
                >
                  <X className="w-4 h-4" />
                  <span>NA (REJECT)</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Main Tabs Navigation */}
      <div className="max-w-4xl w-full mx-auto flex items-center justify-between gap-2 border-b border-zinc-800 pb-3 mb-4 flex-wrap">
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setActiveTab('tables')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all ${
              activeTab === 'tables'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow border border-yellow-300'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            LIVE TABLES ({rooms.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1 ${
              activeTab === 'create'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow border border-yellow-300'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            <PlusCircle className="w-3.5 h-3.5" />
            <span>NAYA TABLE BANAYEIN</span>
          </button>
          <button
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase transition-all relative ${
              activeTab === 'requests'
                ? 'bg-gradient-to-r from-amber-600 to-orange-600 text-white shadow border border-yellow-300'
                : 'bg-zinc-900 text-zinc-400 hover:text-white'
            }`}
          >
            1V1 CHALLENGES ({challenges.length})
            {incomingChallenges.length > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500 absolute top-1 right-1 animate-ping" />
            )}
          </button>
        </div>

        {/* 1v1 Challenge Direct Button */}
        <button
          onClick={() => setIsChallengeModalOpen(true)}
          className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-600 hover:to-indigo-600 text-white font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow active:scale-95 border border-purple-400/50"
        >
          <Send className="w-3.5 h-3.5" />
          <span>CHALLENGE BHEJO</span>
        </button>
      </div>

      {/* TAB 1: LIVE TABLES LIST */}
      {activeTab === 'tables' && (
        <div className="max-w-4xl w-full mx-auto space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {rooms.map(room => {
              const isJoined = room.players.includes(currentUser);
              const isFull = room.players.length >= room.maxPlayers;

              return (
                <div
                  key={room.id}
                  className="bg-[#18050c] border-2 border-amber-500/50 hover:border-amber-400 rounded-2xl p-4 shadow-lg flex flex-col justify-between transition-all"
                >
                  <div>
                    <div className="flex items-center justify-between gap-1 mb-2">
                      <span className="text-sm font-black text-yellow-300 uppercase tracking-wide">
                        {room.name}
                      </span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase font-mono ${
                        room.status === 'PLAYING'
                          ? 'bg-orange-950 text-orange-300 border border-orange-500'
                          : 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                      }`}>
                        {room.status}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs font-mono text-zinc-300 mb-3 bg-black/40 p-2.5 rounded-xl">
                      <div>Game: <strong className="text-white">{room.gameType.replace('_', ' ')}</strong></div>
                      <div>Stake: <strong className="text-yellow-300">{room.stake} P</strong></div>
                      <div>Khiladi: <strong className="text-emerald-400">{room.players.length}/{room.maxPlayers}</strong></div>
                      <div>Pot: <strong className="text-amber-400 font-bold">{room.pot} P</strong></div>
                    </div>

                    <div className="text-[11px] text-zinc-400 mb-3 font-mono">
                      Host: <strong className="text-zinc-200">{room.creatorName}</strong>
                      {room.players.length > 0 && ` • Players: ${room.players.join(', ')}`}
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2 pt-2 border-t border-zinc-800">
                    <span className="text-xs text-zinc-400">
                      {isJoined ? 'Aap is table par hain' : isFull ? 'Table full (Request bhej sakte hain)' : 'Khali jagah uplabdh'}
                    </span>
                    <button
                      onClick={() => handleJoinTable(room)}
                      className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider transition-all active:scale-95 shadow ${
                        isJoined
                          ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                          : 'bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white border border-yellow-300'
                      }`}
                    >
                      {isJoined ? 'TABLE KHELO' : isFull ? 'JOIN REQUEST BHEJEIN' : `JOIN (${room.stake} P)`}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: CREATE NEW TABLE */}
      {activeTab === 'create' && (
        <div className="max-w-xl w-full mx-auto bg-[#17050d] border-2 border-amber-500/70 rounded-2xl p-4 sm:p-6 shadow-xl">
          <div className="text-center pb-3 border-b border-amber-500/30 mb-4">
            <div className="text-base sm:text-lg font-black text-yellow-300 uppercase font-display">
              NAYA CARD GAME TABLE BANAYEIN
            </div>
            <div className="text-xs text-zinc-400">
              Apni pasand ka game, stake points aur players chun kar table kholiye
            </div>
          </div>

          <form onSubmit={handleCreateTable} className="space-y-4">
            {/* Game Selector */}
            <div>
              <label className="text-xs font-bold text-amber-300 block mb-1.5 uppercase">
                Game Ka Chunav (Select Game):
              </label>
              <div className="grid grid-cols-2 gap-2">
                {(['TEEN_PATTI', 'FLASH', 'MAANG_PATTA', 'RUMMY'] as CardGameType[]).map(t => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedGameType(t)}
                    className={`py-2 px-3 rounded-xl text-xs font-black uppercase transition-all ${
                      selectedGameType === t
                        ? 'bg-amber-500 text-black border-2 border-yellow-300 shadow'
                        : 'bg-black/50 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    {t.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Stake Amount Selector */}
            <div>
              <label className="text-xs font-bold text-amber-300 block mb-1.5 uppercase">
                Stake Points (दाव):
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[10, 20, 50, 100].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setNewTableStake(amt)}
                    className={`py-2 rounded-xl text-xs font-bold font-mono transition-all ${
                      newTableStake === amt
                        ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white border border-yellow-300 shadow scale-105'
                        : 'bg-black/50 text-zinc-300 border border-zinc-700'
                    }`}
                  >
                    {amt} P
                  </button>
                ))}
              </div>
            </div>

            {/* Table Name */}
            <div>
              <label className="text-xs font-bold text-amber-300 block mb-1 uppercase">
                Table Ka Naam (Optional):
              </label>
              <input
                type="text"
                placeholder="e.g. Royal Teen Patti #1"
                value={newTableName}
                onChange={e => setNewTableName(e.target.value)}
                className="w-full px-3 py-2 bg-black/60 border border-zinc-700 rounded-xl text-white text-xs focus:outline-none focus:border-amber-400"
              />
            </div>

            {/* Max Players */}
            <div>
              <label className="text-xs font-bold text-amber-300 block mb-1.5 uppercase">
                Khiladiyon Ki Sankhya (Max Players):
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[2, 3, 4].map(num => (
                  <button
                    key={num}
                    type="button"
                    onClick={() => setNewTableMaxPlayers(num)}
                    className={`py-2 rounded-xl text-xs font-bold transition-all ${
                      newTableMaxPlayers === num
                        ? 'bg-amber-500 text-black border border-yellow-300'
                        : 'bg-black/50 text-zinc-400 border border-zinc-700'
                    }`}
                  >
                    {num} Khiladi
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              className="w-full py-3 bg-gradient-to-r from-orange-600 via-amber-600 to-yellow-600 hover:opacity-95 text-black font-black text-sm uppercase tracking-wider rounded-xl shadow-lg border border-yellow-300 transition-all active:scale-95"
            >
              TABLE CREATE KAREIN & BAITHEIN ({newTableStake} P)
            </button>
          </form>
        </div>
      )}

      {/* TAB 3: 1V1 REQUESTS HISTORY */}
      {activeTab === 'requests' && (
        <div className="max-w-4xl w-full mx-auto space-y-3">
          <div className="text-xs text-zinc-400 font-mono mb-2">
            Aapke bheje aur prapt huye 1v1 game challenges:
          </div>
          {challenges.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 bg-black/40 rounded-2xl border border-zinc-800">
              Koi challenge abhi active nahi hai. 'Challenge Bhejo' button se kisi bhi online user ko challenge bhej sakte hain!
            </div>
          ) : (
            <div className="space-y-2">
              {challenges.map(req => (
                <div
                  key={req.id}
                  className="bg-[#18050c] border border-zinc-800 rounded-xl p-3 flex items-center justify-between gap-2 flex-wrap"
                >
                  <div>
                    <div className="text-xs font-black text-yellow-300">
                      {req.fromUserName} ➔ {req.toUserId || 'Open Room'}
                    </div>
                    <div className="text-[11px] text-zinc-400 font-mono">
                      Game: {req.gameType} | Stake: {req.stake} P | Time: {new Date(req.timestamp).toLocaleTimeString()}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded font-mono uppercase ${
                      req.status === 'ACCEPTED'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-500'
                        : req.status === 'REJECTED'
                        ? 'bg-red-950 text-red-300 border border-red-500'
                        : 'bg-amber-950 text-amber-300 border border-amber-500'
                    }`}>
                      {req.status}
                    </span>

                    {req.status === 'PENDING' && req.toUserId === currentUser && (
                      <>
                        <button
                          onClick={() => handleAcceptChallenge(req)}
                          className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-bold"
                        >
                          HA
                        </button>
                        <button
                          onClick={() => handleRejectChallenge(req)}
                          className="px-2 py-1 bg-zinc-800 text-zinc-400 rounded text-[11px] font-bold"
                        >
                          NA
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* DIRECT 1V1 CHALLENGE MODAL */}
      {isChallengeModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3">
          <div className="bg-[#17040b] border-2 border-amber-500/80 rounded-2xl p-5 max-w-sm w-full shadow-2xl">
            <div className="flex items-center justify-between pb-2 border-b border-amber-500/30 mb-3">
              <span className="text-sm font-black text-yellow-300 uppercase">
                DOOSRE USER KO CHALLENGE BHEJO
              </span>
              <button
                onClick={() => setIsChallengeModalOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                  Khiladi Chunein (Select Player):
                </label>
                <div className="space-y-1 max-h-36 overflow-y-auto">
                  {availableUsers.map(u => (
                    <button
                      key={u}
                      type="button"
                      onClick={() => setChallengeTargetUser(u)}
                      className={`w-full py-2 px-3 rounded-lg text-xs font-bold text-left flex items-center justify-between transition-all ${
                        challengeTargetUser === u
                          ? 'bg-amber-500 text-black font-black'
                          : 'bg-black/40 text-zinc-300 hover:bg-zinc-800'
                      }`}
                    >
                      <span>{u}</span>
                      <span className="text-[10px] font-mono">{usersDB[u]?.points || 0} P</span>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-zinc-300 block mb-1">
                  Stake Points (दाव):
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[10, 20, 50, 100].map(s => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setChallengeStake(s)}
                      className={`py-1.5 rounded-lg text-xs font-bold font-mono ${
                        challengeStake === s
                          ? 'bg-amber-500 text-black font-black'
                          : 'bg-black/40 text-zinc-400 border border-zinc-700'
                      }`}
                    >
                      {s} P
                    </button>
                  ))}
                </div>
              </div>

              <button
                disabled={!challengeTargetUser}
                onClick={() => handleSendChallenge(challengeTargetUser, challengeStake)}
                className={`w-full py-2.5 rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow ${
                  challengeTargetUser
                    ? 'bg-gradient-to-r from-orange-600 to-amber-600 text-white cursor-pointer active:scale-95'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
                }`}
              >
                CHALLENGE REQUEST BHEJEIN ({challengeStake} P)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
