import React, { useState } from 'react';
import { Mic, MicOff, Lock, Loader2 } from 'lucide-react';

/**
 * AudioControlButton
 * Manages participant microphone toggle with strict enforcement of host moderation locks:
 * 1. Normal State: Freely toggle mic on/off.
 * 2. Force-Muted State: Shows lock indicator; clicking initiates "Ask Host for Permission to Unmute".
 * 3. Request Pending State: Shows spinning loader and "Request Sent..." status.
 */
export default function AudioControlButton({
  micOn = false,
  isForceMutedByHost = false,
  unmuteRequestPending = false,
  onToggleMic,
  onRequestUnmute,
  className = '',
  variant = 'bottom-bar'
}) {
  const [showTooltip, setShowTooltip] = useState(false);

  const handleClick = (e) => {
    e.stopPropagation();
    if (unmuteRequestPending) {
      return;
    }

    if (isForceMutedByHost) {
      // Participant is locked out from direct unmute; ask host for permission
      if (onRequestUnmute) {
        onRequestUnmute();
      }
      return;
    }

    if (onToggleMic) {
      onToggleMic();
    }
  };

  // Tooltip label logic
  const getTooltipText = () => {
    if (unmuteRequestPending) {
      return 'Waiting for host to review your unmute request...';
    }
    if (isForceMutedByHost) {
      return 'You were muted by the host. Click to request unmute.';
    }
    return micOn ? 'Mute Microphone' : 'Unmute Microphone';
  };

  const isPending = unmuteRequestPending;
  const isLocked = isForceMutedByHost && !micOn;

  return (
    <div
      className="relative inline-flex items-center"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className={`relative p-3 rounded-2xl font-bold transition-all flex items-center justify-center ${
          isPending
            ? 'bg-amber-600/30 text-amber-300 border border-amber-500/50 cursor-wait ring-4 ring-amber-500/20'
            : isLocked
            ? 'bg-rose-950/80 hover:bg-rose-900/90 text-rose-300 border border-rose-600/60 shadow-lg shadow-rose-950/40 ring-2 ring-rose-500/30 hover:ring-rose-500/60'
            : micOn
            ? 'bg-slate-800 hover:bg-slate-700 text-white'
            : 'bg-rose-500 hover:bg-rose-600 text-white ring-4 ring-rose-500/20'
        } ${className}`}
        title={getTooltipText()}
      >
        {isPending ? (
          <div className="flex items-center gap-1.5 px-1">
            <Loader2 className="h-5 w-5 animate-spin text-amber-300" />
            {variant === 'bottom-bar' && (
              <span className="text-[11px] font-bold text-amber-300 hidden md:inline">
                Request Sent...
              </span>
            )}
          </div>
        ) : isLocked ? (
          <div className="relative flex items-center gap-1.5 px-0.5">
            <MicOff className="h-5 w-5 text-rose-400" />
            <span className="absolute -top-1.5 -right-1.5 bg-rose-600 text-white rounded-full p-0.5 shadow-md">
              <Lock className="h-2.5 w-2.5" />
            </span>
            {variant === 'bottom-bar' && (
              <span className="text-[10px] font-extrabold text-rose-300 hidden lg:inline pl-1 uppercase tracking-wider">
                Ask Unmute
              </span>
            )}
          </div>
        ) : micOn ? (
          <Mic className="h-5 w-5 text-emerald-400" />
        ) : (
          <MicOff className="h-5 w-5" />
        )}
      </button>

      {/* Floating Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2.5 py-1 rounded-lg bg-slate-950 text-white border border-slate-700 text-[11px] font-semibold whitespace-nowrap z-30 shadow-xl pointer-events-none animate-in fade-in zoom-in-95 duration-150">
          {getTooltipText()}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-950" />
        </div>
      )}
    </div>
  );
}
