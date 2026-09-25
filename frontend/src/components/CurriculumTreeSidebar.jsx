import React, { useState } from 'react';
import {
  ChevronDown,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Video,
  FileText,
  Award,
  CheckCircle2,
  Circle,
  Lock,
  Plus,
  BookOpen,
  Sparkles
} from 'lucide-react';

export default function CurriculumTreeSidebar({
  hierarchy,
  activeModuleId,
  activeTopicId,
  activeResourceId,
  activeContentType, // 'video' | 'notes' | 'exam'
  completedTopics = {},
  onSelectTopic,
  onSelectResource,
  onSelectExam,
  isOpen = true,
  onToggleSidebar,
  isEducator = false,
  onAddTopic,
  onUploadNotes,
  onAddModule
}) {
  // Expanded module accordion states (default all true)
  const [expandedModules, setExpandedModules] = useState(() => {
    const initial = {};
    if (hierarchy?.modules) {
      hierarchy.modules.forEach((m) => {
        initial[m.id] = true;
      });
    }
    return initial;
  });

  const toggleModule = (moduleId) => {
    setExpandedModules((prev) => ({
      ...prev,
      [moduleId]: !prev[moduleId]
    }));
  };

  // If sidebar is collapsed into mini rail
  if (!isOpen) {
    return (
      <aside className="w-16 border-r border-[#1e2638] bg-[#0c101c] flex flex-col items-center py-4 justify-between shrink-0 transition-all duration-300">
        <div className="flex flex-col items-center gap-4">
          {/* Expand Toggle Button */}
          <button
            onClick={onToggleSidebar}
            className="h-10 w-10 rounded-xl bg-[#131927] hover:bg-indigo-600/30 border border-[#1e2638] hover:border-indigo-500/50 text-indigo-400 flex items-center justify-center transition shadow-sm"
            title="Expand Curriculum Tree (>>)"
          >
            <ChevronsRight className="h-5 w-5" />
          </button>

          {/* Mini Icons for Modules */}
          <div className="space-y-3 pt-2">
            {hierarchy?.modules?.map((mod, idx) => {
              const isActive = mod.id === activeModuleId;
              return (
                <button
                  key={mod.id}
                  onClick={() => {
                    onToggleSidebar();
                    toggleModule(mod.id);
                  }}
                  className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-black transition ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                      : 'bg-[#141b2b] text-slate-400 hover:text-white hover:bg-slate-800'
                  }`}
                  title={`Module ${idx + 1}: ${mod.title}`}
                >
                  {idx + 1}
                </button>
              );
            })}
          </div>
        </div>

        {/* Course Code Miniature Badge */}
        <div className="text-[10px] font-black uppercase text-slate-500 rotate-90 tracking-widest pb-4">
          {hierarchy?.code || 'TREE'}
        </div>
      </aside>
    );
  }

  return (
    <aside className="w-80 lg:w-88 border-r border-[#1e2638] bg-[#0c101c] flex flex-col shrink-0 overflow-hidden transition-all duration-300">
      {/* Sidebar Header & Collapse Toggle */}
      <div className="p-4 border-b border-[#1e2638] bg-[#0e1322] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <BookOpen className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <h3 className="text-xs font-black uppercase tracking-wider text-white truncate">
              Curriculum Syllabus
            </h3>
            <span className="text-[10px] text-slate-400 font-semibold truncate block">
              {hierarchy?.modules?.length || 0} Modules • Structure
            </span>
          </div>
        </div>

        {/* Collapse Toggle Button (<<) */}
        <button
          onClick={onToggleSidebar}
          className="h-8 w-8 rounded-lg bg-[#141b2b] hover:bg-[#1a2338] border border-[#232d42] text-slate-400 hover:text-indigo-300 flex items-center justify-center transition shrink-0"
          title="Collapse Sidebar (<<)"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>
      </div>

      {/* Modules & Subtree Hierarchy List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 scrollbar-thin">
        {(!hierarchy?.modules || hierarchy.modules.length === 0) ? (
          <div className="p-6 text-center text-slate-500 space-y-3">
            <p className="text-xs font-semibold">No modules available.</p>
            {isEducator && (
              <button
                onClick={onAddModule}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-bold transition flex items-center gap-1 mx-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Module</span>
              </button>
            )}
          </div>
        ) : (
          hierarchy.modules.map((mod, modIdx) => {
            const isExpanded = expandedModules[mod.id] ?? true;
            const isCurrentModule = mod.id === activeModuleId;
            const totalTopics = mod.topics?.length || 0;
            const completedCount = mod.topics
              ? mod.topics.filter((t) => completedTopics[t.id]).length
              : 0;
            const isAllDone = totalTopics > 0 && completedCount === totalTopics;
            const hasExam = Boolean(mod.has_module_exam || mod.module_exam_id);

            return (
              <div
                key={mod.id}
                className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                  isCurrentModule
                    ? 'border-indigo-500/40 bg-[#121828]/90 shadow-md'
                    : 'border-[#1e2638] bg-[#0f1422]/60 hover:border-[#2b354d]'
                }`}
              >
                {/* Module Root Accordion Bar */}
                <div
                  onClick={() => toggleModule(mod.id)}
                  className="p-3 bg-[#131929] hover:bg-[#182136] flex items-center justify-between cursor-pointer transition select-none"
                >
                  <div className="flex items-center gap-2.5 min-w-0 pr-2">
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4 text-indigo-400 shrink-0" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                    )}

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-extrabold uppercase text-indigo-400 tracking-wider">
                          Module {modIdx + 1}
                        </span>
                        {isAllDone && (
                          <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0" />
                        )}
                      </div>
                      <h4 className="text-xs font-black text-white truncate">
                        {mod.title}
                      </h4>
                    </div>
                  </div>

                  {/* Progress Pill */}
                  <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-[#222d42] shrink-0">
                    {totalTopics > 0 ? `${completedCount}/${totalTopics}` : 'Ready'}
                  </span>
                </div>

                {/* Sub-Tree Nodes (Concepts, Notes, Exam) */}
                {isExpanded && (
                  <div className="p-2 space-y-1 bg-[#0a0d16]/70 border-t border-[#1a2335]">
                    {/* 1. Subtopic Video Nodes */}
                    {mod.topics?.map((topic, tIdx) => {
                      const isSelected =
                        isCurrentModule &&
                        activeContentType === 'video' &&
                        activeTopicId === topic.id;
                      const isDone = completedTopics[topic.id];

                      return (
                        <div
                          key={topic.id}
                          onClick={() => onSelectTopic(mod, topic)}
                          className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                            isSelected
                              ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/20 border border-indigo-500/50 text-white font-bold shadow-sm'
                              : 'text-slate-300 hover:bg-[#141b2a] hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className="text-sm shrink-0">🎥</span>
                            <span className="truncate">
                              Topic {modIdx + 1}.{tIdx + 1}: {topic.title}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            {isDone ? (
                              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                            ) : (
                              <Circle className="h-3.5 w-3.5 text-slate-600 group-hover:text-slate-400 shrink-0" />
                            )}
                          </div>
                        </div>
                      );
                    })}

                    {/* 2. Module Protected PDF Notes & Slides */}
                    {mod.resources?.map((res) => {
                      const isSelected =
                        isCurrentModule &&
                        activeContentType === 'notes' &&
                        activeResourceId === res.id;

                      return (
                        <div
                          key={res.id}
                          onClick={() => onSelectResource(mod, res)}
                          className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                            isSelected
                              ? 'bg-purple-600/25 border border-purple-500/50 text-white font-bold shadow-sm'
                              : 'text-slate-300 hover:bg-[#141b2a] hover:text-white'
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0 pr-2">
                            <span className="text-sm shrink-0">📄</span>
                            <span className="truncate">{res.title}</span>
                          </div>

                          <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20 flex items-center gap-1 shrink-0">
                            <Lock className="h-2.5 w-2.5" /> View Only
                          </span>
                        </div>
                      );
                    })}

                    {/* 3. Module Assessment / Exam Node */}
                    {hasExam && (
                      <div
                        onClick={() => onSelectExam(mod)}
                        className={`group flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition-all text-xs ${
                          isCurrentModule && activeContentType === 'exam'
                            ? 'bg-amber-600/25 border border-amber-500/50 text-white font-bold shadow-sm'
                            : 'text-amber-300 hover:bg-[#141b2a]'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                          <span className="text-sm shrink-0">📝</span>
                          <span className="truncate">
                            {mod.title} Mastery Assessment
                          </span>
                        </div>

                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 shrink-0">
                          Exam
                        </span>
                      </div>
                    )}

                    {/* Educator Quick Actions */}
                    {isEducator && (
                      <div className="pt-2 border-t border-[#1a2335] flex items-center gap-2">
                        <button
                          onClick={() => onAddTopic(mod.id)}
                          className="flex-1 py-1 px-2 rounded-lg bg-[#141c2c] hover:bg-slate-700 text-[10px] font-bold text-slate-300 hover:text-white flex items-center justify-center gap-1 transition border border-[#222d42]"
                        >
                          <Plus className="h-3 w-3 text-indigo-400" />
                          <span>+ Topic</span>
                        </button>
                        <button
                          onClick={() => onUploadNotes(mod.id)}
                          className="flex-1 py-1 px-2 rounded-lg bg-[#141c2c] hover:bg-slate-700 text-[10px] font-bold text-slate-300 hover:text-white flex items-center justify-center gap-1 transition border border-[#222d42]"
                        >
                          <Plus className="h-3 w-3 text-purple-400" />
                          <span>+ Notes</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
}
