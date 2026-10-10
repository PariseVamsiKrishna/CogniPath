import React, { useState } from 'react';
import {
  X,
  Sparkles,
  BookOpen,
  Send,
  Youtube,
  Layers,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { coursesAPI } from '../services/api';

const CATEGORY_PRESETS = [
  'Computer Science',
  'Artificial Intelligence',
  'Data Structures & Algorithms',
  'Cloud Architecture & DevOps',
  'Web & Mobile Development',
  'Cybersecurity & Networks',
  'Mathematics & Physics'
];

const DIFFICULTY_LEVELS = [
  { id: 'Beginner', label: 'Beginner', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'Intermediate', label: 'Intermediate', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
  { id: 'Advanced', label: 'Advanced', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' }
];

// Helper to auto-generate unique course reference code without prompting educator
function generateCourseCode(title) {
  const words = (title || '').trim().split(/\s+/).filter(Boolean);
  let prefix = 'CP';
  if (words.length >= 2) {
    prefix = (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1 && words[0].length >= 2) {
    prefix = words[0].substring(0, 2).toUpperCase();
  }
  const randNum = Math.floor(100 + Math.random() * 900);
  return `${prefix}${randNum}`;
}

export default function CreateCourseModal({
  isOpen,
  onClose,
  onCourseCreated
}) {
  // Course Metadata Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Computer Science');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  // Dynamic Multi-Module Curriculum State
  const [modules, setModules] = useState([
    {
      id: 'mod_1',
      title: 'Module 1: Foundations & Architecture',
      description: 'Foundational concepts and principles.',
      topics: [
        {
          id: 'top_1_1',
          title: 'Lecture 1: Core Concepts Overview',
          description: 'Comprehensive overview and visual walkthrough.',
          youtube_url: 'https://www.youtube.com/watch?v=qH6clASSS54'
        }
      ]
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Add another module
  const handleAddModule = () => {
    const nextNum = modules.length + 1;
    setModules((prev) => [
      ...prev,
      {
        id: `mod_${Date.now()}_${nextNum}`,
        title: `Module ${nextNum}: Core Concepts & Applications`,
        description: `Comprehensive syllabus for Module ${nextNum}.`,
        topics: [
          {
            id: `top_${Date.now()}_1`,
            title: `Lecture 1: Methodologies & Demonstrations`,
            description: 'Algorithmic proofs and visual animations.',
            youtube_url: 'https://www.youtube.com/watch?v=IHZwWFHWa-w'
          }
        ]
      }
    ]);
  };

  // Remove a module
  const handleRemoveModule = (modId) => {
    if (modules.length <= 1) return;
    setModules((prev) => prev.filter((m) => m.id !== modId));
  };

  // Update module fields
  const handleUpdateModule = (modId, field, value) => {
    setModules((prev) =>
      prev.map((m) => (m.id === modId ? { ...m, [field]: value } : m))
    );
  };

  // Add a topic/video to a specific module
  const handleAddTopic = (modId) => {
    setModules((prev) =>
      prev.map((m) => {
        if (m.id !== modId) return m;
        const nextNum = (m.topics?.length || 0) + 1;
        return {
          ...m,
          topics: [
            ...(m.topics || []),
            {
              id: `top_${Date.now()}_${nextNum}`,
              title: `Lecture ${nextNum}: Key Concepts`,
              description: 'Conceptual walkthrough and practical implementation.',
              youtube_url: 'https://www.youtube.com/watch?v=aircAruvnKk'
            }
          ]
        };
      })
    );
  };

  // Remove a topic/video from a module
  const handleRemoveTopic = (modId, topicId) => {
    setModules((prev) =>
      prev.map((m) => {
        if (m.id !== modId) return m;
        return {
          ...m,
          topics: (m.topics || []).filter((t) => t.id !== topicId)
        };
      })
    );
  };

  // Update topic fields
  const handleUpdateTopic = (modId, topicId, field, value) => {
    setModules((prev) =>
      prev.map((m) => {
        if (m.id !== modId) return m;
        return {
          ...m,
          topics: (m.topics || []).map((t) =>
            t.id === topicId ? { ...t, [field]: value } : t
          )
        };
      })
    );
  };

  const extractYoutubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:v=|\/embed\/|\/watch\?v=|\.be\/|\/v\/)([0-9A-Za-z_-]{11})/);
    return match ? match[1] : null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a course title.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('cognipath_token');
      if (!token) {
        setError('Authentication session not found. Please log in before creating a course.');
        setLoading(false);
        return;
      }

      // 1. Auto-generate course code for internal reference
      const courseCode = generateCourseCode(title);

      // 2. Create the Course in database
      const newCourse = await coursesAPI.create({
        title: title.trim(),
        code: courseCode,
        category,
        difficulty,
        description: description.trim() || `${title} - Comprehensive syllabus for college students.`,
        thumbnail_url: thumbnailUrl.trim() || undefined
      });

      // 3. Sequentially create each module and topic
      const failedItems = [];
      if (newCourse?.id && modules.length > 0) {
        for (let mIdx = 0; mIdx < modules.length; mIdx++) {
          const mod = modules[mIdx];
          if (!mod.title.trim()) continue;
          try {
            const createdMod = await coursesAPI.createModule(newCourse.id, {
              title: mod.title.trim(),
              description: mod.description?.trim() || `Module ${mIdx + 1} syllabus.`
            });

            if (createdMod?.id && Array.isArray(mod.topics)) {
              for (let tIdx = 0; tIdx < mod.topics.length; tIdx++) {
                const top = mod.topics[tIdx];
                if (!top.title.trim()) continue;
                try {
                  await coursesAPI.createTopic(createdMod.id, {
                    title: top.title.trim(),
                    description: top.description?.trim() || 'Video lecture and conceptual walkthrough.',
                    youtube_url: top.youtube_url?.trim() || 'https://www.youtube.com/watch?v=qH6clASSS54'
                  });
                } catch (topErr) {
                  console.warn(`Topic creation notice for ${top.title}:`, topErr);
                  failedItems.push(`Topic "${top.title}"`);
                }
              }
            }
          } catch (modErr) {
            console.warn(`Module creation notice for ${mod.title}:`, modErr);
            failedItems.push(`Module "${mod.title}"`);
          }
        }
      }

      if (failedItems.length > 0) {
        alert(`Course created! Note that some curriculum items could not be saved: ${failedItems.join(', ')}. You can add them anytime inside the Course Player.`);
      }

      // 4. Trigger celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {}

      // 5. Callback to parent App
      if (onCourseCreated) {
        onCourseCreated(newCourse);
      }
      onClose();
    } catch (err) {
      console.error('Failed to post course:', err);
      setError(
        err.response?.data?.detail ||
        err.message ||
        'Failed to create course. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-3xl bg-gradient-to-b from-[#131927] to-[#0e131f] border border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-8 relative overflow-hidden max-h-[92vh] flex flex-col">
        {/* Glow ambient background accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-indigo-600/20 blur-3xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between relative border-b border-[#1e2638] pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Sparkles className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">Create &amp; Post New Course</h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                  Educator Studio
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Design the course curriculum, configure modules with YouTube lectures, and post immediately for students.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {error && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2 shrink-0">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto pr-1 flex-1">
          {/* Section 1: Course Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Course Identity &amp; Metadata</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Course Title <span className="text-rose-400">*</span>
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Distributed Consensus & Cloud Architecture"
                className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Category / Domain</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                >
                  {CATEGORY_PRESETS.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Difficulty Level</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {DIFFICULTY_LEVELS.map((lvl) => (
                    <button
                      key={lvl.id}
                      type="button"
                      onClick={() => setDifficulty(lvl.id)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        difficulty === lvl.id
                          ? lvl.color + ' ring-2 ring-indigo-500/30'
                          : 'bg-[#0b0f19] border-[#1e2638] text-slate-400 hover:text-white'
                      }`}
                    >
                      {lvl.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Course Description &amp; Objectives</label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what concepts, frameworks, and practical projects students will master..."
                className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition resize-none"
              />
            </div>
          </div>

          {/* Section 2: Dynamic Multi-Module Curriculum Builder */}
          <div className="space-y-4 pt-2 border-t border-[#1e2638]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                <Layers className="h-3.5 w-3.5" />
                <span>Curriculum Modules &amp; Video Lectures ({modules.length})</span>
              </div>
              <button
                type="button"
                onClick={handleAddModule}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Another Module</span>
              </button>
            </div>

            <div className="space-y-4">
              {modules.map((mod, mIdx) => (
                <div
                  key={mod.id}
                  className="p-4 rounded-2xl bg-[#0b0f19] border border-[#1e2638] hover:border-indigo-500/40 transition space-y-3.5 relative"
                >
                  {/* Module Header */}
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Module {mIdx + 1}
                    </span>
                    {modules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveModule(mod.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition"
                        title="Remove this module"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="space-y-2">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">Module Title</label>
                      <input
                        type="text"
                        required
                        value={mod.title}
                        onChange={(e) => handleUpdateModule(mod.id, 'title', e.target.value)}
                        placeholder={`e.g. Module ${mIdx + 1}: Foundational Architecture`}
                        className="w-full bg-[#131927] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        value={mod.description}
                        onChange={(e) => handleUpdateModule(mod.id, 'description', e.target.value)}
                        placeholder="Module summary or learning goals (optional)"
                        className="w-full bg-[#131927] border border-[#1e2638] rounded-xl px-3 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Topics List for this Module */}
                  <div className="space-y-2.5 pt-2 border-t border-[#1e2638]/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Video Lectures in Module {mIdx + 1}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddTopic(mod.id)}
                        className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add Video Lecture</span>
                      </button>
                    </div>

                    {mod.topics?.map((top, tIdx) => {
                      const ytId = extractYoutubeId(top.youtube_url);
                      return (
                        <div
                          key={top.id}
                          className="p-3 rounded-xl bg-[#131927] border border-[#1e2638] space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-400">Lecture {tIdx + 1}</span>
                            {mod.topics.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTopic(mod.id, top.id)}
                                className="text-slate-500 hover:text-red-400 transition"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <input
                              type="text"
                              value={top.title}
                              onChange={(e) => handleUpdateTopic(mod.id, top.id, 'title', e.target.value)}
                              placeholder="Lecture Topic Title"
                              className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                            />
                            <div className="relative">
                              <input
                                type="text"
                                value={top.youtube_url}
                                onChange={(e) => handleUpdateTopic(mod.id, top.id, 'youtube_url', e.target.value)}
                                placeholder="YouTube Video URL"
                                className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                              />
                              <Youtube className="h-3.5 w-3.5 text-rose-400 absolute left-2 top-2" />
                            </div>
                          </div>

                          {ytId && (
                            <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                              <CheckCircle2 className="h-3 w-3" />
                              <span>Verified YouTube Video ID: <strong className="font-mono text-white">{ytId}</strong></span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer Bar */}
          <div className="flex items-center justify-between pt-4 border-t border-[#1e2638] shrink-0">
            <span className="text-[11px] text-slate-400 flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>Instantly provisions Community &amp; AI Tutor channels</span>
            </span>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="px-4 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={loading || !title.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <span>Posting Course &amp; Modules...</span>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>Post &amp; Publish Course</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
