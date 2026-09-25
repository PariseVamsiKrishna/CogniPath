import React from 'react';
import { Sparkles, X, Youtube, Info, Clock, ExternalLink } from 'lucide-react';

export default function SupplementaryVideoPlayer({
  video,
  onDismiss
}) {
  if (!video) return null;

  return (
    <div className="rounded-3xl bg-gradient-to-b from-[#181a30] to-[#121526] border border-purple-500/50 p-6 shadow-2xl space-y-4 relative overflow-hidden transition-all duration-300 animate-fadeIn">
      {/* Top Banner & AI Badge */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-2xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-300 shadow-lg shadow-purple-500/20 shrink-0">
            <Sparkles className="h-5 w-5 animate-pulse text-purple-400" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30">
                Cogni AI Concept Helper
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                Ephemeral Session Video
              </span>
              {video.duration && (
                <span className="text-[10px] font-semibold text-slate-400 flex items-center gap-1">
                  <Clock className="h-3 w-3" /> {video.duration}
                </span>
              )}
            </div>
            <h3 className="text-base sm:text-lg font-black text-white mt-1 leading-snug">
              Recommended by Cogni: {video.title}
            </h3>
          </div>
        </div>

        {/* Dismiss Button */}
        <button
          onClick={onDismiss}
          className="p-2 rounded-xl bg-[#0f1220] hover:bg-slate-800 text-slate-400 hover:text-white border border-[#232942] transition shrink-0"
          title="Dismiss Supplementary Player"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Embedded Secondary Video Canvas */}
      <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-purple-500/30 relative">
        <iframe
          className="w-full h-full"
          src={video.embed_url || `https://www.youtube-nocookie.com/embed/${video.youtube_video_id}?autoplay=0&rel=0`}
          title={video.title}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>

      {/* Rationale & Educational Context Card */}
      <div className="bg-[#0b0d18]/80 rounded-2xl p-4 border border-[#222942] flex items-start gap-3 text-xs">
        <Info className="h-4 w-4 text-purple-400 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-bold text-purple-300">Why Cogni Recommended This Video:</p>
          <p className="text-slate-300 leading-relaxed">
            {video.relevance_reason || 'This alternative visual explanation reinforces the core invariants and conceptual foundations using animated step-by-step traces.'}
          </p>
          {video.channel && (
            <p className="text-[10px] text-slate-500 pt-0.5">
              Source Channel: <span className="text-slate-400 font-semibold">{video.channel}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
