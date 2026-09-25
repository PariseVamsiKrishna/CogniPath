import React from 'react';
import { Mic, Check, X, ShieldAlert, Sparkles } from 'lucide-react';

/**
 * HostRequestNotification
 * Floating notification queue for the host/educator.
 * Displays incoming participant un-mute permission requests with individual [Allow] [Deny]
 * actions as well as batch "Allow All" support.
 */
export default function HostRequestNotification({
  requests = [],
  onAllow,
  onDeny,
  onAllowAll
}) {
  if (!requests || requests.length === 0) return null;

  return (
    <div className="fixed bottom-24 right-6 z-40 max-w-md w-full sm:w-96 space-y-2 pointer-events-auto animate-in slide-in-from-bottom-5 duration-300">
      {/* Header if multiple requests */}
      {requests.length > 1 && (
        <div className="flex items-center justify-between px-4 py-2 rounded-2xl bg-indigo-950/90 border border-indigo-500/40 backdrop-blur-md shadow-xl text-xs font-bold text-white">
          <div className="flex items-center gap-2 text-cyan-300">
            <ShieldAlert className="h-4 w-4 text-amber-400" />
            <span>{requests.length} Unmute Requests</span>
          </div>
          {onAllowAll && (
            <button
              type="button"
              onClick={onAllowAll}
              className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-[11px] font-extrabold transition shadow flex items-center gap-1"
            >
              <Check className="h-3 w-3" />
              <span>Allow All</span>
            </button>
          )}
        </div>
      )}

      {/* Individual Request Cards */}
      {requests.map((req) => (
        <div
          key={req.id || req.senderId}
          className="p-3.5 rounded-2xl bg-slate-900/95 border border-indigo-500/30 backdrop-blur-md shadow-2xl flex items-center justify-between gap-3 text-white transition hover:border-indigo-400/60"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-9 w-9 rounded-full bg-indigo-600/30 border border-indigo-400/50 flex items-center justify-center text-cyan-300 font-bold text-xs shrink-0">
              {req.senderName?.charAt(0) || 'P'}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-bold text-white truncate flex items-center gap-1">
                <span>{req.senderName || 'Participant'}</span>
              </div>
              <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                <Mic className="h-3 w-3 text-amber-400" />
                <span>Wants permission to unmute</span>
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onDeny && onDeny(req.id || req.senderId, req.senderId, 'Host denied request')}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 border border-slate-700/60 hover:border-rose-500/40 text-[11px] font-bold transition flex items-center gap-1"
              title="Deny Request"
            >
              <X className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Deny</span>
            </button>
            <button
              type="button"
              onClick={() => onAllow && onAllow(req.id || req.senderId, req.senderId)}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-extrabold shadow-lg shadow-emerald-600/30 transition flex items-center gap-1"
              title="Allow to Unmute"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Allow</span>
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
