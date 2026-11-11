import React, { useState } from 'react';
import { UsersDB, AdminCredentials } from '../types';
import { soundManager } from '../utils/audio';
import { 
  X, 
  UserPlus, 
  Send, 
  Users, 
  KeyRound, 
  ShieldCheck, 
  Lock, 
  Unlock, 
  AlertCircle 
} from 'lucide-react';

interface UserManagementModalProps {
  isOpen: boolean;
  onClose: () => void;
  usersDB: UsersDB;
  adminCreds: AdminCredentials;
  onCreateUser: (userId: string, pass: string) => void;
  onTransferPoints: (userId: string, points: number, directCredit: boolean) => void;
  onUpdateUserPassword: (userId: string, newPass: string) => void;
  onUpdateAdminCreds: (newCreds: AdminCredentials, currentPass: string) => Promise<{ success: boolean; message?: string }>;
  onToggleUserDeactivation?: (userId: string, deactivate?: boolean) => void;
}

export const UserManagementModal: React.FC<UserManagementModalProps> = ({
  isOpen,
  onClose,
  usersDB,
  adminCreds,
  onCreateUser,
  onTransferPoints,
  onUpdateUserPassword,
  onUpdateAdminCreds,
  onToggleUserDeactivation
}) => {
  // Tab: 'users' | 'transfer' | 'admin-settings'
  const [activeTab, setActiveTab] = useState<'users' | 'transfer' | 'admin-settings'>('users');

  // Create User
  const [newUserId, setNewUserId] = useState('');
  const [newUserPass, setNewUserPass] = useState('');
  const [createError, setCreateError] = useState('');

  // Transfer Points
  const [selectedUser, setSelectedUser] = useState('');
  const [transferPts, setTransferPts] = useState('');
  const [directCredit, setDirectCredit] = useState(true);

  // Change User Password & Unlock
  const [selectedUserForPwd, setSelectedUserForPwd] = useState('');
  const [userNewPassword, setUserNewPassword] = useState('');
  const [userPwdMsg, setUserPwdMsg] = useState('');

  // Admin Credentials Change
  const [adminUsername, setAdminUsername] = useState(adminCreds.username || 'ADMIN');
  const [adminCurrentPass, setAdminCurrentPass] = useState('');
  const [adminNewPass, setAdminNewPass] = useState('');
  const [adminCredMsg, setAdminCredMsg] = useState<{ text: string; isError: boolean } | null>(null);

  if (!isOpen) return null;

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError('');
    const idClean = newUserId.trim().toUpperCase();
    const passClean = newUserPass.trim();

    if (!idClean || !passClean) {
      setCreateError('User ID aur Password dono dalein!');
      soundManager.playCancelSound();
      return;
    }
    if (passClean.length < 12) {
      setCreateError('Temporary password must be at least 12 characters.');
      soundManager.playCancelSound();
      return;
    }

    if (!/^KK00\d{4,28}$/.test(idClean)) {
      setCreateError("User ID 'KK00' se shuru ho aur uske baad kam-se-kam 4 digits hon (jaise KK001234).");
      soundManager.playCancelSound();
      return;
    }

    soundManager.playBetOkSound();
    onCreateUser(idClean, passClean);
    setNewUserId('');
    setNewUserPass('');
    setCreateError('✅ User ' + idClean + ' safaltapoorvak ban gaya!');
  };

  const handleTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    const pts = parseInt(transferPts, 10);
    if (!selectedUser || !pts || pts <= 0) return;
    soundManager.playBetOkSound();
    onTransferPoints(selectedUser, pts, directCredit);
    setTransferPts('');
  };

  const handleUserPasswordReset = (e: React.FormEvent) => {
    e.preventDefault();
    setUserPwdMsg('');
    if (!selectedUserForPwd || !userNewPassword.trim()) {
      soundManager.playCancelSound();
      setUserPwdMsg('User aur naya password dono select karein!');
      return;
    }
    if (userNewPassword.trim().length < 12) {
      soundManager.playCancelSound();
      setUserPwdMsg('Temporary password must be at least 12 characters.');
      return;
    }

    soundManager.playBetOkSound();
    onUpdateUserPassword(selectedUserForPwd, userNewPassword.trim());
    setUserPwdMsg(`✅ ${selectedUserForPwd} ka password update ho gaya aur account UNLOCK ho gaya!`);
    setUserNewPassword('');
  };

  const handleAdminCredsChange = async (e: React.FormEvent) => {
    e.preventDefault();
    setAdminCredMsg(null);

    if (!adminCurrentPass) {
      soundManager.playCancelSound();
      setAdminCredMsg({ text: 'Current Admin Password dalein!', isError: true });
      return;
    }

    if (!adminNewPass.trim() || adminNewPass.trim().length < 12) {
      soundManager.playCancelSound();
      setAdminCredMsg({ text: 'Naya Admin Password kam se kam 12 akshar ka hona chahiye!', isError: true });
      return;
    }

    const result = await onUpdateAdminCreds({
      username: adminUsername.trim().toUpperCase() || 'ADMIN',
      pass: adminNewPass.trim()
    }, adminCurrentPass);
    if (!result.success) {
      soundManager.playCancelSound();
      setAdminCredMsg({ text: result.message || 'Admin credentials update nahi huye.', isError: true });
      return;
    }
    soundManager.playBetOkSound();
    setAdminCredMsg({ text: '✅ Admin Credentials safaltapoorvak update ho gaye!', isError: false });
    setAdminCurrentPass('');
    setAdminNewPass('');
  };

  const userList = Object.keys(usersDB);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-[#1f060f] border-2 border-amber-500 rounded-xl shadow-[0_0_35px_rgba(245,158,11,0.3)] flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-amber-500/40 bg-[#2b0815] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-bold font-display text-amber-300 tracking-wider uppercase">
              Admin User & Password Control
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigator */}
        <div className="px-5 py-2 bg-[#17040a] border-b border-zinc-800 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('users')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
              activeTab === 'users'
                ? 'bg-amber-500 text-black shadow'
                : 'bg-[#290812] text-zinc-300 hover:bg-[#380b19]'
            }`}
          >
            User Accounts & Pwd
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('transfer')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
              activeTab === 'transfer'
                ? 'bg-amber-500 text-black shadow'
                : 'bg-[#290812] text-zinc-300 hover:bg-[#380b19]'
            }`}
          >
            Transfer Points
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('admin-settings')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
              activeTab === 'admin-settings'
                ? 'bg-red-600 text-white shadow'
                : 'bg-[#290812] text-zinc-300 hover:bg-[#380b19]'
            }`}
          >
            Admin Credentials
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-5">
          {/* TAB 1: USERS & PASSWORD RESET / UNLOCK */}
          {activeTab === 'users' && (
            <div className="space-y-4">
              {/* Create User Form */}
              <div className="bg-[#17040a] border border-emerald-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between text-emerald-400 font-bold text-xs uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <UserPlus className="w-4 h-4" />
                    <span>Create New User (KK00 Format)</span>
                  </div>
                  <span className="text-[10px] text-zinc-400 font-mono">Starts with KK00</span>
                </div>
                {createError && (
                  <div className={`p-2 rounded-lg text-[11px] font-semibold ${
                    createError.startsWith('✅') ? 'bg-emerald-950/80 text-emerald-200 border border-emerald-500' : 'bg-red-950/80 text-red-200 border border-red-500'
                  }`}>
                    {createError}
                  </div>
                )}
                <form onSubmit={handleCreate} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">
                      User ID (KK00 + minimum 4 digits)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. KK001234"
                      value={newUserId}
                      onChange={e => setNewUserId(e.target.value)}
                      className="w-full px-3 py-2 bg-black/50 border border-zinc-700 rounded-lg text-white text-xs font-bold uppercase focus:outline-none focus:border-emerald-400 font-mono"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">Initial Password</label>
                    <input
                      placeholder="Temporary password (min 12 characters)"
                      value={newUserPass}
                      onChange={e => setNewUserPass(e.target.value)}
                      type="password"
                      autoComplete="new-password"
                      className="w-full px-3 py-2 bg-black/50 border border-zinc-700 rounded-lg text-white text-xs font-semibold focus:outline-none focus:border-emerald-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-[0.98] cursor-pointer"
                  >
                    Save User Account
                  </button>
                </form>
              </div>

              {/* Reset User Password & Unlock Form */}
              <div className="bg-[#17040a] border border-amber-500/40 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs uppercase tracking-wider">
                  <KeyRound className="w-4 h-4" />
                  <span>Reset User Password & Unlock (5 Attempts Expiry)</span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-relaxed">
                  Agar kisi user ne 5 baar galat password dala aur uski ID expire/lock ho gayi, to yahan se naya password daal kar reset karein. ID turant unlock ho jayegi!
                </p>
                {userPwdMsg && (
                  <div className="p-2 rounded-lg bg-emerald-950/80 text-emerald-200 border border-emerald-500 text-[11px] font-semibold">
                    {userPwdMsg}
                  </div>
                )}
                <form onSubmit={handleUserPasswordReset} className="space-y-3">
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">Choose User</label>
                    <select
                      value={selectedUserForPwd}
                      onChange={e => setSelectedUserForPwd(e.target.value)}
                      className="w-full px-3 py-2 bg-black/50 border border-zinc-700 rounded-lg text-amber-300 text-xs font-bold focus:outline-none focus:border-amber-400"
                    >
                      <option value="">-- Select User to Reset / Unlock --</option>
                      {userList.map(u => {
                        const acc = usersDB[u];
                        return (
                          <option key={u} value={u}>
                            {u} {acc.isLocked ? '🔒 [LOCKED/EXPIRED]' : ''}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">Naya Password</label>
                    <input
                      type="password"
                      placeholder="Temporary password (min 12 characters)"
                      value={userNewPassword}
                      onChange={e => setUserNewPassword(e.target.value)}
                      autoComplete="new-password"
                      className="w-full px-3 py-2 bg-black/50 border border-zinc-700 rounded-lg text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-[0.98] flex items-center justify-center gap-1.5 cursor-pointer shadow"
                  >
                    <Unlock className="w-3.5 h-3.5" />
                    <span>Reset Password & Unlock User</span>
                  </button>
                </form>
              </div>

              {/* Account Status: Active / De-Active Fast Control */}
              {onToggleUserDeactivation && (
                <div className="bg-[#17040a] border border-red-500/40 rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold text-xs uppercase tracking-wider">
                    <ShieldCheck className="w-4 h-4 text-red-400" />
                    <span>Account Status: Active / De-Active (Block ID)</span>
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    Jis user ki ID ko De-Active kar denge, wo login nahi kar payega. Dobara Active karne par uska account turant shuru ho jayega.
                  </p>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {userList.map(u => {
                      const acc = usersDB[u];
                      const isDeact = !!acc.isDeactivated;
                      return (
                        <div key={u} className="flex items-center justify-between p-2 rounded-lg bg-black/40 border border-zinc-800 text-xs">
                          <div>
                            <span className="font-bold font-mono text-white">{u}</span>
                            <span className="text-[10px] text-zinc-400 ml-2">({acc.points || 0} P)</span>
                            <div className="text-[10px] mt-0.5">
                              {isDeact ? (
                                <span className="text-red-400 font-extrabold">⛔ DE-ACTIVE</span>
                              ) : acc.isLocked ? (
                                <span className="text-orange-400 font-bold">🔒 LOCKED (5 FAILED)</span>
                              ) : (
                                <span className="text-emerald-400 font-bold">🟢 ACTIVE</span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              soundManager.playSelectSound();
                              onToggleUserDeactivation(u, !isDeact);
                            }}
                            className={`px-3 py-1 rounded text-[11px] font-black uppercase transition-all active:scale-95 cursor-pointer border ${
                              isDeact
                                ? 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400 shadow'
                                : 'bg-red-900/80 hover:bg-red-800 text-red-200 border-red-500 shadow'
                            }`}
                          >
                            {isDeact ? 'Active Karein' : 'De-Active Karein'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: TRANSFER POINTS */}
          {activeTab === 'transfer' && (
            <div className="bg-[#17040a] border border-amber-500/40 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 font-bold text-xs uppercase tracking-wider">
                <Send className="w-4 h-4" />
                <span>Transfer Points To User</span>
              </div>
              <form onSubmit={handleTransfer} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">Select User</label>
                  <select
                    value={selectedUser}
                    onChange={e => setSelectedUser(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-zinc-700 rounded-lg text-amber-300 text-xs font-bold focus:outline-none focus:border-amber-400"
                  >
                    <option value="">-- Choose User Account --</option>
                    {userList.map(u => (
                      <option key={u} value={u}>
                        {u} (Current: {usersDB[u]?.points || 0} P) {usersDB[u]?.isLocked ? '🔒 [LOCKED]' : ''}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">Points Amount</label>
                  <input
                    type="number"
                    placeholder="Enter Points (e.g. 1000)"
                    value={transferPts}
                    onChange={e => setTransferPts(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-zinc-700 rounded-lg text-white text-xs font-bold focus:outline-none focus:border-amber-400"
                  />
                </div>
                <div className="flex items-center gap-2 pt-1 text-xs text-zinc-300">
                  <input
                    type="checkbox"
                    id="direct-credit"
                    checked={directCredit}
                    onChange={e => setDirectCredit(e.target.checked)}
                    className="rounded border-zinc-700 text-amber-500 focus:ring-0"
                  />
                  <label htmlFor="direct-credit" className="cursor-pointer">
                    Instant Direct Credit (or uncheck to send as claimable pending transfer)
                  </label>
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-[0.98] cursor-pointer"
                >
                  Send Points Now
                </button>
              </form>
            </div>
          )}

          {/* TAB 3: ADMIN CREDENTIALS CHANGE */}
          {activeTab === 'admin-settings' && (
            <div className="bg-[#17040a] border border-red-500/50 rounded-xl p-4 space-y-3">
              <div className="flex items-center gap-2 text-red-400 font-bold text-xs uppercase tracking-wider">
                <ShieldCheck className="w-4 h-4" />
                <span>Change Admin ID & Password</span>
              </div>
              <p className="text-[11px] text-zinc-400 leading-relaxed">
                Aap yahan se Admin Panel ka Login ID aur Password badal sakte hain.
              </p>
              {adminCredMsg && (
                <div className={`p-2 rounded-lg text-[11px] font-semibold ${
                  adminCredMsg.isError ? 'bg-red-950/80 text-red-200 border border-red-500' : 'bg-emerald-950/80 text-emerald-200 border border-emerald-500'
                }`}>
                  {adminCredMsg.text}
                </div>
              )}
              <form onSubmit={handleAdminCredsChange} className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">Admin Username</label>
                  <input
                    type="text"
                    value={adminUsername}
                    onChange={e => setAdminUsername(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-zinc-700 rounded-lg text-amber-300 text-xs font-mono font-bold uppercase focus:outline-none focus:border-red-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">Current Admin Password</label>
                  <input
                    type="password"
                    placeholder="Enter current password"
                    value={adminCurrentPass}
                    onChange={e => setAdminCurrentPass(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-zinc-400 uppercase block mb-1">New Admin Password</label>
                  <input
                    type="password"
                    placeholder="Temporary password (min 12 chars)"
                    value={adminNewPass}
                    onChange={e => setAdminNewPass(e.target.value)}
                    className="w-full px-3 py-2 bg-black/50 border border-zinc-700 rounded-lg text-white text-xs focus:outline-none focus:border-red-400"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full py-2.5 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-xs uppercase tracking-wider rounded-lg transition-all active:scale-[0.98] shadow cursor-pointer"
                >
                  Save New Admin Credentials
                </button>
              </form>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-amber-500/20 bg-[#17050c] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-bold text-xs rounded-lg uppercase tracking-wider transition-colors cursor-pointer"
          >
            Close Window
          </button>
        </div>
      </div>
    </div>
  );
};
