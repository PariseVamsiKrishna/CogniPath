import React, { useState, useEffect } from 'react';
import {
  ExternalLink,
  Copy,
  Check,
  Maximize2,
  Minimize2,
  RefreshCw,
  ShieldCheck,
  Radio,
  Sparkles,
  Video,
  Info
} from 'lucide-react';

export default function LiveKshetraFrame({
  meetingCode,
  podTitle = 'Learning Pod Video Conference',
  onClose,
  isHost = false
}) {
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [iframeKey, setIframeKey] = useState(1);
  const [loadError, setLoadError] = useState(false);

  const cleanCode = (meetingCode || 'sih-pod-live').trim().replace(/\s+/g, '-').toLowerCase();
  const directJoinUrl = `https://live-kshetra.vercel.app/join/${cleanCode}`;
  const embedProxyUrl = `/api/v1/pods/kshetra-embed/${cleanCode}`;

  const copyCode = (e) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(cleanCode);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const copyLink = (e) => {
    e?.stopPropagation();
    navigator.clipboard.writeText(directJoinUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleReload = () => {
    setIframeKey((prev) => prev + 1);
    setLoadError(false);
  };

  return (
    <div
      className={`flex flex-col bg-[#0A0D1C] rounded-2xl border border-[#262C4C] overflow-hidden shadow-2xl transition-all duration-300 ${
        isFullscreen ? 'fixed inset-2 z-50 h-[calc(100vh-16px)]' : 'w-full h-full min-h-[480px]'
      }`}
    >
      {/* Top Kshetra Control Bar */}
      <div className="flex flex-wrap items-center justify-between p-3 bg-[#12162B] border-b border-[#262C4C] gap-2.5 z-10 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-xl bg-gradient-to-tr from-[#FF9933] to-[#FF6F9C] flex items-center justify-center text-[#0A0D1C] font-black text-xs shadow-md shadow-[#FF9933]/20 shrink-0">
            LK
          </div>
          <div className="truncate">
            <div className="flex items-center gap-2">
              <span className="font-heading font-bold text-xs sm:text-sm text-[#ECEDF7] truncate">
                {podTitle}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#5FE3B0]/15 text-[#5FE3B0] border border-[#5FE3B0]/30 font-semibold flex items-center gap-1 shrink-0">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5FE3B0] animate-ping" />
                Live Kshetra WebRTC
              </span>
            </div>
            <p className="text-[10px] text-[#8A90B4] flex items-center gap-1.5 truncate">
              <ShieldCheck className="h-3 w-3 text-[#5FE3B0]" />
              <span>Zero-Trust Peer Encrypted • Powered by Live Kshetra</span>
            </p>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Meeting Code Chip with Click-to-Copy */}
          <button
            type="button"
            onClick={copyCode}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#171C36] hover:bg-[#262C4C] border border-[#8B7CFF]/40 text-xs font-mono font-bold text-[#5FE3B0] transition shadow-sm"
            title="Click to copy Live Kshetra meeting code"
          >
            <span className="text-[#8A90B4] font-normal text-[10px]">Code:</span>
            <span>{cleanCode}</span>
            {copiedCode ? (
              <Check className="h-3.5 w-3.5 text-[#5FE3B0]" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-[#8A90B4]" />
            )}
          </button>

          {/* Copy Direct Join Link */}
          <button
            type="button"
            onClick={copyLink}
            className="p-1.5 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#171C36] hover:bg-[#262C4C] border border-[#262C4C] text-xs font-semibold text-[#8A90B4] hover:text-[#ECEDF7] flex items-center gap-1.5 transition"
            title="Copy Direct Join Link"
          >
            {copiedLink ? <Check className="h-3.5 w-3.5 text-[#5FE3B0]" /> : <Copy className="h-3.5 w-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? 'Link Copied' : 'Share Link'}</span>
          </button>

          {/* Dedicated Tab / Popout Link */}
          <a
            href={directJoinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="px-2.5 py-1.5 rounded-xl bg-[#FF9933]/15 hover:bg-[#FF9933]/25 border border-[#FF9933]/40 text-[#FF9933] text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
            title="Open Live Kshetra in a new browser window"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Popout Tab</span>
          </a>

          {/* Reload Iframe */}
          <button
            type="button"
            onClick={handleReload}
            className="p-1.5 rounded-xl text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#171C36] border border-transparent hover:border-[#262C4C] transition"
            title="Reload Video Session"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-xl text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#171C36] border border-transparent hover:border-[#262C4C] transition"
            title={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen Video'}
          >
            {isFullscreen ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>

      {/* Main Video Frame Area */}
      <div className="flex-1 w-full h-full relative min-h-[460px] bg-[#0A0D1C]">
        <iframe
          key={iframeKey}
          src={embedProxyUrl}
          title="Live Kshetra Video Conference"
          allow="camera; microphone; display-capture; autoplay; clipboard-write; fullscreen"
          className="w-full h-full border-0 absolute inset-0 bg-[#0A0D1C]"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          onError={() => setLoadError(true)}
        />

        {/* Fallback prompt if user wants dedicated tab */}
        {loadError && (
          <div className="absolute inset-0 bg-[#0A0D1C] flex flex-col items-center justify-center p-6 text-center z-20">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-tr from-[#FF9933] to-[#FF6F9C] flex items-center justify-center text-[#0A0D1C] font-black text-xl mb-3 shadow-lg">
              LK
            </div>
            <h3 className="font-heading font-bold text-lg text-[#ECEDF7]">
              Live Kshetra Direct Connection
            </h3>
            <p className="text-xs text-[#8A90B4] mt-1 max-w-md">
              Your browser may have restricted embedded video permissions. Click below to launch the Live Kshetra session in a dedicated window.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a
                href={directJoinUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-[#FF9933] to-[#FF6F9C] text-[#0A0D1C] font-heading font-bold text-xs uppercase tracking-wider shadow-lg shadow-[#FF9933]/30 transition"
              >
                Launch Room in New Tab ↗
              </a>
              <button
                type="button"
                onClick={handleReload}
                className="px-4 py-2.5 rounded-xl bg-[#171C36] text-[#ECEDF7] text-xs font-semibold border border-[#262C4C] hover:bg-[#262C4C] transition"
              >
                Retry Embedded
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Footer Info Strip */}
      <div className="px-3 py-1.5 bg-[#12162B] border-t border-[#262C4C] flex items-center justify-between text-[10px] text-[#8A90B4]">
        <div className="flex items-center gap-2">
          <span className="text-[#FF9933] font-bold">Live Kshetra</span>
          <span>•</span>
          <span>Room Code: <code className="text-[#5FE3B0] font-mono">{cleanCode}</code></span>
        </div>
        <div className="flex items-center gap-3">
          <span>Cam & Mic ready</span>
          <span>•</span>
          <a
            href={directJoinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#8B7CFF] hover:underline flex items-center gap-1"
          >
            <span>Direct link</span>
            <ExternalLink className="h-2.5 w-2.5" />
          </a>
        </div>
      </div>
    </div>
  );
}
