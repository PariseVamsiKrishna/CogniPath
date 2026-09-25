import React from 'react';
import { ArrowRight, Sparkles } from 'lucide-react';

// Subject tag color presets aligned with design system
const SUBJECT_TAG_STYLES = {
  dsa: {
    label: 'DSA',
    bg: 'bg-[#8B7CFF]/15 text-[#8B7CFF] border-[#8B7CFF]/30',
    btnBorderHover: 'hover:border-[#8B7CFF] hover:text-[#8B7CFF]'
  },
  dbms: {
    label: 'DBMS',
    bg: 'bg-[#5FE3B0]/15 text-[#5FE3B0] border-[#5FE3B0]/30',
    btnBorderHover: 'hover:border-[#5FE3B0] hover:text-[#5FE3B0]'
  },
  'web dev': {
    label: 'WEB DEV',
    bg: 'bg-[#FFC15E]/15 text-[#FFC15E] border-[#FFC15E]/30',
    btnBorderHover: 'hover:border-[#FFC15E] hover:text-[#FFC15E]'
  },
  default: {
    label: 'AI & ML',
    bg: 'bg-[#FF6F9C]/15 text-[#FF6F9C] border-[#FF6F9C]/30',
    btnBorderHover: 'hover:border-[#FF6F9C] hover:text-[#FF6F9C]'
  }
};

export default function RecommendationCard({
  recommendation,
  onStartLearning
}) {
  const catKey = (recommendation.category || '').toLowerCase();
  const tagStyle = SUBJECT_TAG_STYLES[catKey] || SUBJECT_TAG_STYLES.default;

  return (
    <div
      style={{
        boxShadow: '0 18px 34px -18px rgba(0,0,0,0.55)'
      }}
      className="rounded-2xl bg-[#12162B] hover:bg-[#171C36] border border-[#262C4C] hover:border-[#8B7CFF]/40 p-5 space-y-4 transition-all duration-300 flex flex-col justify-between group"
    >
      <div className="space-y-3">
        {/* Top Tag Strip: Colored Subject Pill & Difficulty Level */}
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-extrabold uppercase px-3 py-1 rounded-full border tracking-wider ${tagStyle.bg}`}>
            {recommendation.category || tagStyle.label}
          </span>
          <span className="text-[11px] font-medium text-[#8A90B4]">
            {recommendation.difficulty || 'Intermediate'}
          </span>
        </div>

        {/* Title */}
        <h4 className="font-heading text-base font-bold text-[#ECEDF7] group-hover:text-[#8B7CFF] transition-colors leading-snug line-clamp-1">
          {recommendation.topic_title || recommendation.title}
        </h4>

        {/* One-line Reasoning Text */}
        <p className="text-xs text-[#8A90B4] leading-relaxed line-clamp-2">
          {recommendation.reason || 'Curriculum milestone recommended by Cogni AI based on your diagnostic assessments.'}
        </p>
      </div>

      {/* Footer: Course Context & Bordered Pill "Start →" Button */}
      <div className="pt-3 border-t border-[#262C4C] flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-[#8A90B4] truncate max-w-[170px]">
          {recommendation.course_title || 'Core Engineering Track'}
        </span>

        <button
          type="button"
          onClick={() => onStartLearning && onStartLearning(recommendation)}
          className={`px-3.5 py-1.5 rounded-full bg-transparent hover:bg-[#12162B] border border-[#262C4C] text-[#ECEDF7] text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${tagStyle.btnBorderHover}`}
        >
          <span>Start</span>
          <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </div>
  );
}
