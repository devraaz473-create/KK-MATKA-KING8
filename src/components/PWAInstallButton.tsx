import React, { useState } from 'react';
import { usePWAInstall } from '../utils/usePWAInstall';
import { Smartphone, Download, Share, X, CheckCircle, ExternalLink, Sparkles } from 'lucide-react';

export const PWAInstallButton: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  // If already running in standalone mode, show a small badge or hide
  if (isInstalled) {
    return (
      <div className={`flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-[10px] font-bold text-emerald-300 font-mono ${className}`}>
        <CheckCircle className="w-3 h-3 text-emerald-400" />
        <span>INSTALLED</span>
      </div>
    );
  }

  return (
    <>
      {/* Button for Chromium / Android */}
      {isInstallable && (
        <button
          onClick={install}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs uppercase tracking-wider border border-emerald-300 shadow-[0_0_15px_rgba(16,185,129,0.5)] transition-all active:scale-95 cursor-pointer ${className}`}
          title="Install app directly to your Android phone / PC"
        >
          <Download className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>INSTALL APP</span>
        </button>
      )}

      {/* Button for iOS or manual guide */}
      {!isInstallable && (
        <button
          onClick={() => setShowGuide(true)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-black font-extrabold text-xs uppercase tracking-wider border border-yellow-300 shadow transition-all active:scale-95 cursor-pointer ${className}`}
          title="Install app on Android or iPhone (No download needed, auto-updates!)"
        >
          <Smartphone className="w-3.5 h-3.5 stroke-[2.5]" />
          <span>APP INSTALL</span>
        </button>
      )}

      {/* Installation Guide & Web Link Modal */}
      {showGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="w-full max-w-md bg-[#18040c] border-2 border-amber-500 rounded-2xl shadow-[0_0_40px_rgba(245,158,11,0.5)] flex flex-col overflow-hidden text-zinc-200 text-xs">
            {/* Header */}
            <div className="px-4 py-3 bg-[#280714] border-b border-amber-500/40 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-amber-400" />
                <h3 className="text-sm sm:text-base font-black font-display text-amber-300 uppercase tracking-wider">
                  Mobile App Install (Android & iOS)
                </h3>
              </div>
              <button
                onClick={() => setShowGuide(false)}
                className="p-1 text-zinc-400 hover:text-white rounded-lg hover:bg-white/10"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-4 space-y-3.5 max-h-[75vh] overflow-y-auto">
              {/* Auto Update Banner */}
              <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/50 space-y-1">
                <div className="font-extrabold text-emerald-300 flex items-center gap-1.5 text-xs sm:text-sm">
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>100% Free: No APK Needed + Auto-Update!</span>
                </div>
                <p className="text-[11px] text-zinc-300 leading-relaxed">
                  Is app me humne <strong>PWA (Progressive Web App)</strong> lagaya hai. Iska sabse bada fayda yeh hai ki jab bhi aap app me koi naya edit karenge, kisi bhi user ko dobara app download ya install nahi karna padega — <strong>app apne aap auto-update ho jayegi</strong> aur sabka data bilkul safe rahega!
                </p>
              </div>

              {/* Android Instructions */}
              <div className="bg-[#210812] border border-emerald-500/40 rounded-xl p-3 space-y-2">
                <div className="font-bold text-emerald-300 uppercase flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Smartphone className="w-4 h-4 text-emerald-400" />
                    <span>Android Phone Me Kaise Chalayein:</span>
                  </div>
                  <span className="text-[10px] bg-emerald-900/60 text-emerald-200 px-1.5 py-0.5 rounded border border-emerald-600/40">10 Sec Step</span>
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-zinc-300 text-[11.5px] leading-relaxed">
                  <li>Apne phone me Google Chrome me yeh link open karein.</li>
                  <li>Upar right me 3-Dots <strong>(⋮)</strong> par click karein.</li>
                  <li><strong>"Add to Home Screen"</strong> ya <strong>"Install App"</strong> par tap karein.</li>
                  <li>Aapke mobile ki screen par KK Gaming ka icon aa jayega aur bilkul asli APK ki tarah full screen chalega!</li>
                </ol>
              </div>

              {/* iPhone / iOS Instructions */}
              <div className="bg-[#210812] border border-sky-500/40 rounded-xl p-3 space-y-2">
                <div className="font-bold text-sky-300 uppercase flex items-center justify-between text-xs">
                  <div className="flex items-center gap-1.5">
                    <Share className="w-4 h-4 text-sky-400" />
                    <span>iPhone / iOS Me Kaise Chalayein:</span>
                  </div>
                  <span className="text-[10px] bg-sky-900/60 text-sky-200 px-1.5 py-0.5 rounded border border-sky-600/40">iOS Friendly</span>
                </div>
                <ol className="list-decimal pl-4 space-y-1 text-zinc-300 text-[11.5px] leading-relaxed">
                  <li>Safari browser me yeh link open karein.</li>
                  <li>Niche center me <strong>Share button</strong> (square arrow) dabayein.</li>
                  <li>Thoda niche scroll karke <strong>"Add to Home Screen"</strong> dabayein.</li>
                  <li>Full screen app iPhone par tayar!</li>
                </ol>
              </div>

              {/* WebIntoApp Issue Explanation */}
              <div className="bg-[#19050d] border border-amber-500/40 rounded-xl p-3 space-y-2 text-[11px] text-zinc-300">
                <div className="font-bold text-amber-300 flex items-center gap-1.5 text-xs">
                  <span>WebIntoApp ne mana kyun kiya aur uska solution:</span>
                </div>
                <p className="text-zinc-400 leading-relaxed">
                  WebIntoApp ka simulator is development link ko isliye reject karta hai kyunki AI Studio ka dev link Google ke private security aur cookies se protected hota hai, jisko bahar ke bots ya simulator load nahi kar pate.
                </p>
                <div className="bg-black/50 p-2.5 rounded-lg border border-amber-500/20 space-y-1.5">
                  <span className="font-bold text-amber-200 block text-[11px]">Agar WebIntoApp se hi APK banani ho toh:</span>
                  <p className="text-zinc-400">
                    AI Studio ke top-right corner me <strong>"Share"</strong> button par click karein aur <strong>Public Preview Link</strong> copy karein, YA is app ko Vercel/Netlify par 1-click free host karein (jiska link WebIntoApp turant accept kar lega).
                  </p>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-4 py-3 bg-[#1e0710] border-t border-amber-500/20 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
              <button
                onClick={() => {
                  if (isInstallable) {
                    install();
                    setShowGuide(false);
                  } else {
                    navigator.clipboard.writeText(window.location.href);
                    alert('Mobile App Link Copied! Apne Chrome browser me paste karein ya WhatsApp par share karein.');
                  }
                }}
                className="px-3 py-2 bg-gradient-to-r from-emerald-600 to-green-600 hover:from-emerald-500 hover:to-green-500 text-white font-black text-xs uppercase tracking-wider rounded-lg border border-emerald-300 shadow active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>{isInstallable ? 'Install On Mobile Now' : 'Copy Mobile App Link'}</span>
              </button>
              <button
                onClick={() => setShowGuide(false)}
                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-bold text-xs uppercase tracking-wider rounded-lg border border-zinc-600 active:scale-95"
              >
                Theek Hai (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
