import React from 'react';
import {
  Laptop,
  Database,
  Globe,
  Bot,
  Play,
  Star,
  Check,
  Code2,
  Sparkles,
  BookOpen
} from 'lucide-react';

// Preset thematic accents per requirements:
// Course 1: Violet (#8B7CFF)
// Course 2: Mint (#5FE3B0)
// Course 3: Amber (#FFC15E)
// Course 4: Pink (#FF6F9C)
export const COURSE_ACCENTS = [
  {
    name: 'violet',
    hex: '#8B7CFF',
    glowColor: 'rgba(139, 124, 255, 0.45)',
    iconBg: 'bg-[#8B7CFF]/15 text-[#8B7CFF] border-[#8B7CFF]/30',
    trackGradient: 'from-[#8B7CFF] to-[#A396FF]',
    resumeBtn: 'bg-[#8B7CFF] hover:bg-[#9d91ff] text-[#0A0D1C] shadow-[0_4px_14px_rgba(139,124,255,0.35)]',
    cardBorderHover: 'hover:border-[#8B7CFF]/50',
    titleHover: 'group-hover:text-[#8B7CFF]',
    nodeActiveRing: 'ring-[#8B7CFF]/40',
  },
  {
    name: 'mint',
    hex: '#5FE3B0',
    glowColor: 'rgba(95, 227, 176, 0.45)',
    iconBg: 'bg-[#5FE3B0]/15 text-[#5FE3B0] border-[#5FE3B0]/30',
    trackGradient: 'from-[#5FE3B0] to-[#78E9BE]',
    resumeBtn: 'bg-[#5FE3B0] hover:bg-[#78e9be] text-[#0A0D1C] shadow-[0_4px_14px_rgba(95,227,176,0.35)]',
    cardBorderHover: 'hover:border-[#5FE3B0]/50',
    titleHover: 'group-hover:text-[#5FE3B0]',
    nodeActiveRing: 'ring-[#5FE3B0]/40',
  },
  {
    name: 'amber',
    hex: '#FFC15E',
    glowColor: 'rgba(255, 193, 94, 0.45)',
    iconBg: 'bg-[#FFC15E]/15 text-[#FFC15E] border-[#FFC15E]/30',
    trackGradient: 'from-[#FFC15E] to-[#FFD082]',
    resumeBtn: 'bg-[#FFC15E] hover:bg-[#ffd082] text-[#0A0D1C] shadow-[0_4px_14px_rgba(255,193,94,0.35)]',
    cardBorderHover: 'hover:border-[#FFC15E]/50',
    titleHover: 'group-hover:text-[#FFC15E]',
    nodeActiveRing: 'ring-[#FFC15E]/40',
  },
  {
    name: 'pink',
    hex: '#FF6F9C',
    glowColor: 'rgba(255, 111, 156, 0.45)',
    iconBg: 'bg-[#FF6F9C]/15 text-[#FF6F9C] border-[#FF6F9C]/30',
    trackGradient: 'from-[#FF6F9C] to-[#FF8CB1]',
    resumeBtn: 'bg-[#FF6F9C] hover:bg-[#ff8cb1] text-[#0A0D1C] shadow-[0_4px_14px_rgba(255,111,156,0.35)]',
    cardBorderHover: 'hover:border-[#FF6F9C]/50',
    titleHover: 'group-hover:text-[#FF6F9C]',
    nodeActiveRing: 'ring-[#FF6F9C]/40',
  }
];

// Rich curated milestone sequences (5-6 nodes) for common engineering disciplines
const PRESET_MILESTONES = {
  dsa: [
    { title: 'Arrays & Vectors' },
    { title: 'Linked Lists' },
    { title: 'Stacks & Queues' },
    { title: 'Binary Trees' },
    { title: 'BST & Heaps' },
    { title: 'Graph Traversal' }
  ],
  dbms: [
    { title: 'Relational Model' },
    { title: 'SQL & DDL' },
    { title: 'Complex Joins' },
    { title: '3NF Normalization' },
    { title: 'ACID Transactions' },
    { title: 'B-Tree Indexing' }
  ],
  web: [
    { title: 'HTML5 Semantics' },
    { title: 'CSS Box Model' },
    { title: 'Flex & Grid' },
    { title: 'Async JS & Event' },
    { title: 'DOM & Events' },
    { title: 'RESTful APIs' }
  ],
  ai: [
    { title: 'Math Foundations' },
    { title: 'Linear Models' },
    { title: 'Perceptrons' },
    { title: 'Backprop & Optim' },
    { title: 'CNN Architecture' },
    { title: 'Transformers' }
  ],
  default: [
    { title: 'Foundations' },
    { title: 'Core Mechanics' },
    { title: 'Applied Practice' },
    { title: 'Advanced Systems' },
    { title: 'Project Capstone' }
  ]
};

export default function JourneyTrackCard({
  course,
  index = 0,
  onSelectCourse,
  onOpenRateModal,
}) {
  const accent = COURSE_ACCENTS[index % COURSE_ACCENTS.length];

  // Pick subject icon based on course category / title
  const getSubjectIcon = () => {
    const text = `${course.title || ''} ${course.category || ''} ${course.code || ''}`.toLowerCase();
    if (text.includes('database') || text.includes('sql') || text.includes('dbms')) return Database;
    if (text.includes('web') || text.includes('html') || text.includes('front')) return Globe;
    if (text.includes('ai') || text.includes('intelligence') || text.includes('neural')) return Bot;
    return Laptop;
  };
  const SubjectIcon = getSubjectIcon();

  // Resolve 5-6 milestone subtopics
  const getMilestones = () => {
    // If course object provides explicit milestones or modules from backend:
    if (Array.isArray(course.milestones) && course.milestones.length >= 4) {
      return course.milestones.slice(0, 6);
    }
    if (Array.isArray(course.modules) && course.modules.length >= 4) {
      return course.modules.slice(0, 6).map((m) => ({ title: m.title }));
    }

    // Match preset disciplines
    const text = `${course.title || ''} ${course.category || ''} ${course.code || ''}`.toLowerCase();
    if (text.includes('data structure') || text.includes('algorithm') || text.includes('cs101')) {
      return PRESET_MILESTONES.dsa;
    }
    if (text.includes('database') || text.includes('sql') || text.includes('dbms')) {
      return PRESET_MILESTONES.dbms;
    }
    if (text.includes('web') || text.includes('frontend') || text.includes('html')) {
      return PRESET_MILESTONES.web;
    }
    if (text.includes('ai') || text.includes('neural') || text.includes('intelligence')) {
      return PRESET_MILESTONES.ai;
    }
    return PRESET_MILESTONES.default;
  };

  const milestones = getMilestones();
  const totalMilestones = milestones.length;

  // Derive current milestone index based on progress percentage
  // e.g. 68% progress across 6 milestones => current index is 3 (milestones 0, 1, 2 completed)
  const progressPercent = typeof course.progress_percentage === 'number'
    ? course.progress_percentage
    : (index === 0 ? 68 : index === 1 ? 45 : 30);

  const activeMilestoneIndex = Math.min(
    totalMilestones - 1,
    Math.max(0, Math.floor((progressPercent / 100) * totalMilestones))
  );

  const nextTopicTitle = course.next_topic_title ||
    (milestones[activeMilestoneIndex] ? milestones[activeMilestoneIndex].title : 'Next Conceptual Milestone');

  // Track progress line fill percentage
  const trackLineFillPercent = totalMilestones > 1
    ? (activeMilestoneIndex / (totalMilestones - 1)) * 100
    : 0;

  return (
    <div
      onClick={() => onSelectCourse && onSelectCourse(course.id)}
      style={{
        boxShadow: '0 18px 34px -18px rgba(0,0,0,0.55)'
      }}
      className={`group rounded-2xl bg-[#12162B] hover:bg-[#171C36] border border-[#262C4C] ${accent.cardBorderHover} p-6 flex flex-col justify-between transition-all duration-300 cursor-pointer relative overflow-hidden`}
    >
      {/* Subtle top highlight matching course accent */}
      <div
        className="absolute top-0 left-0 right-0 h-[2px] opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        style={{
          background: `linear-gradient(90deg, transparent, ${accent.hex}, transparent)`
        }}
      />

      <div className="space-y-5">
        {/* Top Header: Subject Icon Badge, Star Rating, Course Code */}
        <div className="flex items-start justify-between gap-3">
          <div className={`h-12 w-12 rounded-xl border flex items-center justify-center shadow-md transition-transform duration-300 group-hover:scale-105 ${accent.iconBg}`}>
            <SubjectIcon className="h-6 w-6" />
          </div>

          <div className="flex items-center gap-2">
            {/* Clickable Star Rating Pill */}
            <button
              type="button"
              onClick={(e) => {
                if (onOpenRateModal) {
                  e.stopPropagation();
                  onOpenRateModal(course);
                }
              }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#171C36] hover:bg-[#262C4C] text-[#FFC15E] border border-[#262C4C] text-xs font-bold transition shadow-sm"
              title="Course Rating & Reviews"
            >
              <Star className="h-3.5 w-3.5 fill-[#FFC15E] text-[#FFC15E]" />
              <span>{course.average_rating ? course.average_rating.toFixed(1) : '4.9'}</span>
            </button>

            {/* Course Code Tag */}
            <span className="text-[10px] font-extrabold uppercase px-3 py-1 rounded-full bg-[#171C36] text-[#8A90B4] border border-[#262C4C] tracking-wider">
              {course.code || 'COURSE'}
            </span>
          </div>
        </div>

        {/* Title, Short Description, Creator */}
        <div>
          <h3 className={`font-heading text-lg font-bold text-[#ECEDF7] ${accent.titleHover} transition-colors line-clamp-1`}>
            {course.title}
          </h3>
          <p className="text-xs text-[#8A90B4] mt-1.5 line-clamp-2 leading-relaxed">
            {course.description || `${course.category || 'Computer Science'} comprehensive curriculum.`}
          </p>
          <div className="text-[11px] text-[#8A90B4] mt-2">
            Created by <span className="font-semibold text-[#ECEDF7]">{course.educator_name || 'Prof. Rajesh Ramanujan'}</span>
          </div>
        </div>

        {/* =================================================================== */}
        {/* HORIZONTAL LEARNING JOURNEY TRACK                                   */}
        {/* =================================================================== */}
        <div className="pt-2 pb-1 space-y-2.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="font-heading font-semibold text-[#8A90B4] uppercase tracking-wider text-[10px]">
              Learning Journey Map
            </span>
            <span className="font-heading font-bold text-[#ECEDF7]">
              {progressPercent}% Complete
            </span>
          </div>

          {/* Journey Track Stage */}
          <div className="relative pt-3 pb-1">
            {/* Background Full Width Track Line */}
            <div className="absolute top-[21px] left-3 right-3 h-[2px] bg-[#262C4C] -translate-y-1/2 z-0" />

            {/* Colored Gradient Active Track Line */}
            <div
              className={`absolute top-[21px] left-3 h-[2.5px] bg-gradient-to-r ${accent.trackGradient} -translate-y-1/2 z-0 transition-all duration-500`}
              style={{
                width: `calc(${trackLineFillPercent}% * ((100% - 24px) / 100%))`
              }}
            />

            {/* Milestone Nodes */}
            <div className="relative z-10 flex items-start justify-between">
              {milestones.map((node, mIdx) => {
                const isCompleted = mIdx < activeMilestoneIndex;
                const isCurrent = mIdx === activeMilestoneIndex;
                const isUpcoming = mIdx > activeMilestoneIndex;

                return (
                  <div
                    key={mIdx}
                    className="flex flex-col items-center group/node"
                    style={{ width: `${100 / totalMilestones}%` }}
                  >
                    {/* Circular Milestone Node */}
                    <div className="relative flex items-center justify-center">
                      {isCompleted && (
                        <div
                          className="h-4 w-4 rounded-full flex items-center justify-center ring-4 ring-[#12162B] group-hover:ring-[#171C36] transition-all"
                          style={{ backgroundColor: accent.hex }}
                          title={`Completed: ${node.title}`}
                        >
                          <Check className="h-2.5 w-2.5 text-[#0A0D1C] stroke-[3.5]" />
                        </div>
                      )}

                      {isCurrent && (
                        <div className="relative flex items-center justify-center">
                          {/* Pulsing Beacon Glow */}
                          <span
                            className="animate-ping absolute inline-flex h-5 w-5 rounded-full opacity-75"
                            style={{ backgroundColor: accent.hex }}
                          />
                          {/* Glowing Colored Current Dot */}
                          <div
                            className={`relative h-4 w-4 rounded-full flex items-center justify-center ring-4 ring-[#12162B] group-hover:ring-[#171C36] transition-all ${accent.nodeActiveRing}`}
                            style={{
                              backgroundColor: accent.hex,
                              boxShadow: `0 0 12px ${accent.glowColor}`
                            }}
                            title={`Current Topic: ${node.title}`}
                          >
                            <div className="h-1.5 w-1.5 rounded-full bg-[#0A0D1C]" />
                          </div>
                        </div>
                      )}

                      {isUpcoming && (
                        <div
                          className="h-4 w-4 rounded-full border-2 border-[#262C4C] bg-[#12162B] ring-4 ring-[#12162B] group-hover:ring-[#171C36] transition-all"
                          title={`Upcoming: ${node.title}`}
                        />
                      )}
                    </div>

                    {/* Milestone Subtopic Label */}
                    <span
                      className={`mt-2 text-[10px] text-center px-0.5 leading-tight truncate w-full ${
                        isCurrent
                          ? 'font-bold text-[#ECEDF7]'
                          : isCompleted
                          ? 'font-medium text-[#8A90B4]'
                          : 'text-[#8A90B4]/60'
                      }`}
                      title={node.title}
                    >
                      {node.title}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Card Footer: Next Up & Pill-Shaped Resume CTA */}
      <div className="pt-4 mt-4 border-t border-[#262C4C] flex items-center justify-between gap-3">
        <div className="min-w-0 pr-2">
          <span className="text-[10px] uppercase font-bold text-[#8A90B4] tracking-wider block">
            Next Up
          </span>
          <span className="text-xs font-semibold text-[#ECEDF7] truncate block mt-0.5">
            {nextTopicTitle}
          </span>
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (onSelectCourse) onSelectCourse(course.id);
          }}
          className={`px-4 py-2 rounded-full font-bold text-xs flex items-center gap-1.5 transition-all shrink-0 ${accent.resumeBtn}`}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          <span>Resume</span>
        </button>
      </div>
    </div>
  );
}
