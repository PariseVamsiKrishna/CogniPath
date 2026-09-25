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
  HelpCircle,
  Image,
  Award,
  Plus
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

export default function CreateCourseModal({
  isOpen,
  onClose,
  onCourseCreated
}) {
  // Course Metadata Form State
  const [title, setTitle] = useState('');
  const [code, setCode] = useState('');
  const [category, setCategory] = useState('Computer Science');
  const [difficulty, setDifficulty] = useState('Intermediate');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');

  // Optional Quick-Start Initial Curriculum Starter
  const [includeStarter, setIncludeStarter] = useState(true);
  const [initialModuleTitle, setInitialModuleTitle] = useState('Module 1: Foundations & Architecture');
  const [initialTopicTitle, setInitialTopicTitle] = useState('Core Concepts Overview');
  const [initialYoutubeUrl, setInitialYoutubeUrl] = useState('https://www.youtube.com/watch?v=qH6clASSS54');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  // Auto-generate a clean course code from title if not manually edited
  const handleTitleChange = (val) => {
    setTitle(val);
    if (!code || code.startsWith('CS') || code.length <= 5) {
      const words = val.trim().split(/\s+/).filter(Boolean);
      if (words.length >= 2) {
        const generated = (words[0][0] + words[1][0]).toUpperCase() + Math.floor(100 + Math.random() * 900);
        setCode(generated);
      }
    }
  };

  const extractYoutubeId = (url) => {
    if (!url) return null;
    const match = url.match(/(?:v=|\/embed\/|\/watch\?v=|\.be\/|\/v\/)([0-9A-Za-z_-]{11})/);
    return match ? match[1] : null;
  };

  const youtubeVideoId = extractYoutubeId(initialYoutubeUrl);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Please provide a course title.');
      return;
    }
    if (!code.trim()) {
      setError('Please provide a unique course code.');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // 1. Create the Course
      const newCourse = await coursesAPI.create({
        title: title.trim(),
        code: code.trim().toUpperCase(),
        category,
        difficulty,
        description: description.trim() || `${title} - Comprehensive syllabus for college students.`,
        thumbnail_url: thumbnailUrl.trim() || undefined
      });

      // 2. Optionally create initial module & YouTube lecture topic
      if (includeStarter && newCourse?.id && initialModuleTitle.trim()) {
        try {
          const mod = await coursesAPI.createModule(newCourse.id, {
            title: initialModuleTitle.trim(),
            description: 'Introductory module covering foundational concepts.'
          });

          if (mod?.id && initialTopicTitle.trim() && initialYoutubeUrl.trim()) {
            await coursesAPI.createTopic(mod.id, {
              title: initialTopicTitle.trim(),
              description: 'Introductory topic with video walkthrough.',
              youtube_url: initialYoutubeUrl.trim()
            });
          }
        } catch (starterErr) {
          console.warn('Initial module starter optional creation error:', starterErr);
        }
      }

      // 3. Trigger celebration confetti
      try {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      } catch (err) {}

      // 4. Callback to parent App
      if (onCourseCreated) {
        onCourseCreated(newCourse);
      }
      onClose();
    } catch (err) {
      console.error('Failed to post course:', err);
      setError(
        err.response?.data?.detail ||
        'Failed to post course. Ensure the course code is unique and you are logged in as an Educator.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-2xl bg-gradient-to-b from-[#131927] to-[#0e131f] border border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-8 relative overflow-hidden">
        {/* Glow ambient background accent */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-indigo-600/20 blur-3xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between relative border-b border-[#1e2638] pb-4">
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
                Design the course curriculum, configure YouTube lectures, and post immediately for students.
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
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Section 1: Course Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Course Identity &amp; Metadata</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Course Title <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => handleTitleChange(e.target.value)}
                  placeholder="e.g. Distributed Consensus & Cloud Architecture"
                  className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Course Code <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="e.g. CS401"
                  className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2.5 text-xs font-mono font-bold text-cyan-300 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition uppercase"
                />
              </div>
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

          {/* Section 2: Quick-Start Initial Module & Lecture */}
          <div className="p-4 rounded-2xl bg-[#0b0f19]/80 border border-[#1e2638] space-y-3.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                <Layers className="h-3.5 w-3.5" />
                <span>Initial Syllabus Starter (Optional)</span>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeStarter}
                  onChange={(e) => setIncludeStarter(e.target.checked)}
                  className="rounded border-[#1e2638] text-indigo-600 focus:ring-indigo-500 h-3.5 w-3.5 cursor-pointer"
                />
                <span className="text-xs text-slate-300 font-semibold">Pre-seed first module</span>
              </label>
            </div>

            {includeStarter && (
              <div className="space-y-3 pt-1 animate-in fade-in duration-150">
                <div>
                  <label className="block text-[11px] font-bold text-slate-400 mb-1">Module 1 Title</label>
                  <input
                    type="text"
                    value={initialModuleTitle}
                    onChange={(e) => setInitialModuleTitle(e.target.value)}
                    placeholder="e.g. Module 1: Distributed Architectures"
                    className="w-full bg-[#131927] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1">Lecture 1 Topic Title</label>
                    <input
                      type="text"
                      value={initialTopicTitle}
                      onChange={(e) => setInitialTopicTitle(e.target.value)}
                      placeholder="e.g. Introduction to Consensus"
                      className="w-full bg-[#131927] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 mb-1 flex items-center gap-1">
                      <Youtube className="h-3.5 w-3.5 text-rose-400" />
                      <span>YouTube Lecture URL</span>
                    </label>
                    <input
                      type="text"
                      value={initialYoutubeUrl}
                      onChange={(e) => setInitialYoutubeUrl(e.target.value)}
                      placeholder="https://www.youtube.com/watch?v=..."
                      className="w-full bg-[#131927] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                    />
                  </div>
                </div>

                {/* Live YouTube Preview validation badge */}
                {youtubeVideoId && (
                  <div className="p-2.5 rounded-xl bg-slate-950 border border-indigo-500/30 flex items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="h-6 w-6 rounded-lg bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                        <Youtube className="h-3.5 w-3.5" />
                      </div>
                      <span className="text-[11px] text-slate-300 truncate">
                        Validated YouTube ID: <strong className="text-white font-mono">{youtubeVideoId}</strong>
                      </span>
                    </div>
                    <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 shrink-0">
                      ✓ Player Ready
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Action Footer Bar */}
          <div className="flex items-center justify-between pt-3 border-t border-[#1e2638]">
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
                disabled={loading || !title.trim() || !code.trim()}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <span>Posting Course...</span>
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
