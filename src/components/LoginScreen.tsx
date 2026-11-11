import React, { useState } from 'react';
import { UsersDB } from '../types';
import { soundManager } from '../utils/audio';
import { 
  getLoginBgImage,
  saveLoginBgImage,
  performServerLogin,
  completePasswordReset
} from '../utils/storage';
import { PWAInstallButton } from './PWAInstallButton';
import { User, KeyRound, Sparkles, AlertCircle, Gamepad2, Lock, Image as ImageIcon, Upload, Trash2, X } from 'lucide-react';

interface LoginScreenProps {
  onLoginSuccess: (userId: string, isAdmin: boolean) => void;
  usersDB: UsersDB;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onLoginSuccess, usersDB }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [bgImage, setBgImage] = useState<string>(() => getLoginBgImage());
  const [showBgSettings, setShowBgSettings] = useState(false);
  const [customUrlInput, setCustomUrlInput] = useState('');
  const [passwordReset, setPasswordReset] = useState<{ userId: string; isAdmin: boolean } | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setErrorMsg('Kripya sirf photo ya image file select karein!');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        // Compress/resize image to fit within localStorage limits comfortably
        const img = new Image();
        img.onload = () => {
          const maxDim = 1200;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, width, height);
            const compressed = canvas.toDataURL('image/jpeg', 0.82);
            setBgImage(compressed);
            saveLoginBgImage(compressed);
          } else {
            setBgImage(result);
            saveLoginBgImage(result);
          }
          soundManager.playBetOkSound();
        };
        img.onerror = () => {
          setBgImage(result);
          saveLoginBgImage(result);
          soundManager.playBetOkSound();
        };
        img.src = result;
      }
    };
    reader.readAsDataURL(file);
  };

  const handleApplyUrl = () => {
    if (!customUrlInput.trim()) return;
    setBgImage(customUrlInput.trim());
    saveLoginBgImage(customUrlInput.trim());
    soundManager.playBetOkSound();
    setCustomUrlInput('');
    setShowBgSettings(false);
  };

  const handleResetBg = () => {
    setBgImage('');
    saveLoginBgImage('');
    soundManager.playCancelSound();
  };

  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    soundManager.playSelectSound();
    if (passwordReset) {
      if (newPassword.trim().length < 12) {
        setErrorMsg('New password must be at least 12 characters.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('New password and confirmation do not match.');
        return;
      }
      setIsLoggingIn(true);
      setErrorMsg('');
      const result = await completePasswordReset(passwordReset.userId, passwordReset.isAdmin, password, newPassword);
      setIsLoggingIn(false);
      if (!result.success) {
        setErrorMsg(result.message || 'Password reset failed.');
        soundManager.playCancelSound();
        return;
      }
      setPasswordReset(null);
      setPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setErrorMsg('Password changed. Sign in again with your new password.');
      soundManager.playBetOkSound();
      return;
    }

    const idClean = username.trim().toUpperCase();
    const passClean = password;

    if (!idClean || !passClean.trim()) {
      setErrorMsg('Please enter User ID and Password.');
      soundManager.playCancelSound();
      return;
    }

    setIsLoggingIn(true);
    setErrorMsg('');

    try {
      // Real-time server authentication across all devices
      const serverResult = await performServerLogin(idClean, passClean);
      if (serverResult.success) {
        if (serverResult.passwordResetRequired) {
          setPasswordReset({
            userId: serverResult.username || idClean,
            isAdmin: !!serverResult.isAdmin
          });
          setUsername(serverResult.username || idClean);
          setErrorMsg('For account safety, set a new password before continuing.');
          return;
        }
        soundManager.playBetOkSound();
        onLoginSuccess(serverResult.username || idClean, !!serverResult.isAdmin);
        return;
      } else {
        setErrorMsg(serverResult.message || 'Login asafal raha!');
        soundManager.playCancelSound();
      }
    } catch {
      setErrorMsg('Network error. Kripya internet ya server check karein.');
      soundManager.playCancelSound();
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-[100svh] w-full flex items-center justify-center px-3 pt-16 pb-4 sm:p-4 bg-black relative overflow-x-hidden overflow-y-visible select-none">
      {/* Custom Background Image or Default Cyber Gaming Atmosphere */}
      {bgImage ? (
        <div 
          className="absolute inset-0 bg-cover bg-center transition-all duration-700 pointer-events-none"
          style={{ backgroundImage: `url(${bgImage})` }}
        >
          {/* Subtle dark vignette overlay for sharp readability of cards and text */}
          <div className="absolute inset-0 bg-black/65 backdrop-blur-[2px]" />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-black/70" />
        </div>
      ) : (
        <>
          {/* Default Background Cyber Laser & Gaming Atmosphere */}
          <div className="absolute top-1/6 left-1/5 w-80 h-80 bg-red-600/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute bottom-1/6 right-1/5 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none animate-pulse" />
          <div className="absolute inset-0 bg-[radial-gradient(#ffffff0a_1px,transparent_1px)] [background-size:20px_20px] pointer-events-none" />
        </>
      )}

      {/* Top Bar with PWA Install and Background Image Button */}
      <div className="absolute top-3 right-3 sm:top-4 sm:right-4 z-20 flex items-center gap-2">
        <button
          onClick={() => {
            soundManager.playSelectSound();
            setShowBgSettings(!showBgSettings);
          }}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-full bg-black/70 hover:bg-black/90 border border-amber-500/50 text-amber-300 text-xs font-bold transition-all active:scale-95 shadow backdrop-blur-md cursor-pointer"
          title="Login Screen Background Photo Badlein"
        >
          <ImageIcon className="w-3.5 h-3.5 text-amber-400" />
          <span className="hidden sm:inline">BG PHOTO</span>
        </button>
        <PWAInstallButton />
      </div>

      {/* Background Customizer Popup / Drawer */}
      {showBgSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#14050b] border-2 border-amber-500 rounded-2xl max-w-sm w-full p-4 shadow-[0_0_40px_rgba(245,158,11,0.5)] flex flex-col gap-3 relative">
            <div className="flex items-center justify-between border-b border-amber-500/30 pb-2">
              <div className="flex items-center gap-2 text-amber-300 font-bold text-sm">
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>LOGIN BACKGROUND PHOTO</span>
              </div>
              <button
                onClick={() => setShowBgSettings(false)}
                className="text-zinc-400 hover:text-white p-1 rounded-full hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[11px] text-zinc-300 leading-relaxed">
              Apne device se koi bhi picture upload karein ya image ka URL dalein, yeh Login screen ke background me lag jayegi:
            </p>

            {/* Upload File Input */}
            <div>
              <label className="flex items-center justify-center gap-2 w-full py-2.5 px-3 bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white font-extrabold text-xs rounded-xl shadow cursor-pointer transition-all active:scale-95 border border-yellow-300">
                <Upload className="w-4 h-4" />
                <span>CHOOSE PHOTO FROM MOBILE / PC</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </label>
            </div>

            {/* Or Paste Image Link */}
            <div className="flex flex-col gap-1 mt-1">
              <span className="text-[10px] text-zinc-400 font-bold uppercase">Ya Picture Ka Link (URL) Dalein:</span>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  placeholder="https://... image link"
                  value={customUrlInput}
                  onChange={(e) => setCustomUrlInput(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg bg-black border border-amber-500/40 text-xs text-white focus:outline-none focus:border-yellow-400 font-mono"
                />
                <button
                  type="button"
                  onClick={handleApplyUrl}
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow cursor-pointer active:scale-95"
                >
                  SET
                </button>
              </div>
            </div>

            {/* Current Background Preview & Remove */}
            {bgImage && (
              <div className="pt-2 border-t border-zinc-800 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <img src={bgImage} alt="Custom Background" className="w-10 h-10 object-cover rounded border border-amber-400" />
                  <span className="text-[10.5px] text-emerald-400 font-bold">Photo Active Hai</span>
                </div>
                <button
                  onClick={handleResetBg}
                  className="flex items-center gap-1 px-2 py-1 bg-red-950/80 hover:bg-red-900 text-red-300 border border-red-700/60 rounded text-[10px] font-bold cursor-pointer transition-all"
                >
                  <Trash2 className="w-3 h-3 text-red-400" />
                  <span>REMOVE PHOTO</span>
                </button>
              </div>
            )}

            <button
              onClick={() => setShowBgSettings(false)}
              className="mt-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-bold rounded-lg transition-colors cursor-pointer"
            >
              DONE / CLOSE
            </button>
          </div>
        </div>
      )}

      <div className="w-full max-w-sm relative z-10">
        <div className="relative bg-[#0d0107]/95 backdrop-blur-xl border-[3px] border-amber-400/90 rounded-[1.4rem] p-4 sm:p-6 shadow-[inset_0_0_0_2px_rgba(127,29,29,0.75),0_0_34px_rgba(245,158,11,0.28),0_0_55px_rgba(239,68,68,0.2)] flex flex-col gap-3.5 sm:gap-4">
          
          {/* Cyber Corner Decors */}
          <div className="absolute -top-1.5 -left-1.5 w-4 h-4 border-t-3 border-l-3 border-amber-400 rounded-tl pointer-events-none" />
          <div className="absolute -top-1.5 -right-1.5 w-4 h-4 border-t-3 border-r-3 border-amber-400 rounded-tr pointer-events-none" />
          <div className="absolute -bottom-1.5 -left-1.5 w-4 h-4 border-b-3 border-l-3 border-amber-400 rounded-bl pointer-events-none" />
          <div className="absolute -bottom-1.5 -right-1.5 w-4 h-4 border-b-3 border-r-3 border-amber-400 rounded-br pointer-events-none" />

          {/* KK gaming emblem */}
          <div className="flex flex-col items-center text-center">
            <div className="relative mb-1.5" onClick={() => soundManager.playChipSound()}>
              <img
                src="/icon.svg"
                alt="KK Gaming logo"
                className="w-24 h-24 sm:w-28 sm:h-28 rounded-[1.2rem] object-contain drop-shadow-[0_0_18px_rgba(245,158,11,0.55)]"
              />
            </div>

            <div className="relative mt-0.5 w-full">
              <h1 className="text-xl sm:text-3xl font-black font-display tracking-[0.16em] sm:tracking-widest uppercase animate-hd-flash drop-shadow-[0_0_20px_rgba(250,204,21,0.8)]">
                KK GAMING
              </h1>
            </div>

            <div className="flex items-center justify-center gap-1.5 mt-1 max-w-full text-[9px] sm:text-[11px] font-bold text-emerald-400 bg-emerald-950/60 border border-emerald-500/40 px-2.5 py-1 rounded-full shadow-sm">
              <Sparkles className="w-3.5 h-3.5 text-yellow-400 animate-spin" />
              <span className="leading-tight">LIVE JODI & HARUP 90X SYSTEM</span>
            </div>
          </div>

          {/* Error Banner */}
          {errorMsg && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-red-950/90 border border-red-500 text-red-200 text-xs shadow">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span className="font-semibold leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> {passwordReset ? 'Account' : 'ID (User: / Admin)'}
                </span>
                <span className="text-[10px] text-amber-300/80 font-mono"></span>
              </label>
              <div className="relative">
                <input
                  type="text"
                  value={username}
                  onChange={(e) => { setUsername(e.target.value); setErrorMsg(''); }}
                  readOnly={!!passwordReset}
                  placeholder="e.g. KK0001 or ADMIN"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border-2 border-amber-500/50 text-white placeholder-zinc-500 font-bold text-sm focus:outline-none focus:border-yellow-400 focus:shadow-[0_0_15px_rgba(250,204,21,0.5)] transition-all uppercase font-mono"
                  autoComplete="username"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" /> {passwordReset ? 'Current password' : 'Password'}
                </span>
                {!passwordReset && <span className="text-[10px] text-red-400 font-mono flex items-center gap-0.5">
                  <Lock className="w-2.5 h-2.5" /> Max 5 Attempts
                </span>}
              </label>
              <div className="relative">
                <input
                  type="password"
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setErrorMsg(''); }}
                  readOnly={!!passwordReset}
                  placeholder={passwordReset ? 'Verified current password' : 'Enter Password'}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border-2 border-amber-500/50 text-white placeholder-zinc-500 font-bold text-sm focus:outline-none focus:border-yellow-400 focus:shadow-[0_0_15px_rgba(250,204,21,0.5)] transition-all"
                  autoComplete="current-password"
                />
              </div>
            </div>

            {passwordReset && (
              <>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">New password (minimum 12 characters)</label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => { setNewPassword(e.target.value); setErrorMsg(''); }}
                    autoComplete="new-password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border-2 border-amber-500/50 text-white placeholder-zinc-500 font-bold text-sm focus:outline-none focus:border-yellow-400"
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider">Confirm new password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => { setConfirmPassword(e.target.value); setErrorMsg(''); }}
                    autoComplete="new-password"
                    className="w-full px-3.5 py-2.5 rounded-xl bg-black/60 border-2 border-amber-500/50 text-white placeholder-zinc-500 font-bold text-sm focus:outline-none focus:border-yellow-400"
                    required
                  />
                </div>
              </>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="mt-1 w-full py-3 bg-gradient-to-r from-orange-600 via-amber-600 to-amber-500 hover:from-orange-500 hover:to-amber-400 text-white font-black text-sm rounded-xl border-2 border-yellow-300 shadow-[0_0_25px_rgba(245,158,11,0.6)] transition-all uppercase tracking-wider active:scale-[0.98] flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isLoggingIn ? (
                <span className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 animate-spin text-yellow-300" />
                  CONNECTING LIVE SERVER...
                </span>
              ) : (
                <>
                  {passwordReset ? <KeyRound className="w-4 h-4" /> : <Gamepad2 className="w-4 h-4" />}
                  <span>{passwordReset ? 'SET NEW PASSWORD' : 'ENTER GAMING ARENA'}</span>
                </>
              )}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};
