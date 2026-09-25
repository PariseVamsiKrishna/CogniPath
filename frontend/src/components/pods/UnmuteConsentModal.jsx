import React from 'react';
import { Mic, ShieldCheck, X } from 'lucide-react';

/**
 * UnmuteConsentModal
 * Privacy-preserving consent dialog presented to participants when a host invites
 * or grants permission to unmute. Enforces zero unconsented audio capture.
 */
export default function UnmuteConsentModal({
  isOpen = false,
  hostName = 'The Pod Host',
  onConfirmUnmute,
  onDismiss
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-gradient-to-b from-slate-900 to-slate-950 border border-indigo-500/40 rounded-3xl max-w-md w-full p-6 space-y-5 shadow-2xl relative overflow-hidden">
        {/* Ambient Top Glow */}
        <div className="absolute -top-16 left-1/2 -translate-x-1/2 w-48 h-20 bg-indigo-500/20 blur-3xl rounded-full pointer-events-none" />

        <div className="flex items-start justify-between relative">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-indigo-600/30 border border-indigo-400/40 text-cyan-300 flex items-center justify-center shadow-lg shadow-indigo-600/20">
              <Mic className="h-6 w-6 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 text-xs text-indigo-300 font-bold uppercase tracking-wider">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                <span>Privacy Protected Handshake</span>
              </div>
              <h3 className="text-lg font-black text-white mt-0.5">
                Host Invited You to Speak
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
            title="Dismiss & Stay Muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Informative Body */}
        <div className="bg-slate-900/80 border border-slate-800/80 rounded-2xl p-4 text-xs text-slate-300 space-y-2">
          <p className="leading-relaxed">
            <strong className="text-white font-bold">{hostName}</strong> has granted permission for you to turn on your microphone.
          </p>
          <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-semibold pt-1 border-t border-slate-800/60">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Your microphone will never turn on without your explicit click.</span>
          </div>
        </div>

        {/* Explicit Action Buttons */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="button"
            onClick={onDismiss}
            className="flex-1 py-3 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-bold text-xs uppercase tracking-wider transition text-center"
          >
            Stay Muted
          </button>
          <button
            type="button"
            onClick={onConfirmUnmute}
            className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-cyan-600 hover:from-emerald-500 hover:to-cyan-500 text-white font-extrabold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition flex items-center justify-center gap-2"
          >
            <Mic className="h-4 w-4" />
            <span>Unmute Now</span>
          </button>
        </div>
      </div>
    </div>
  );
}
