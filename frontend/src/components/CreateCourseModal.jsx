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
  FileText,
  Eye,
  EyeOff,
  GraduationCap,
  Globe,
  FileEdit
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { coursesAPI } from '../services/api';
import {
  TARGET_BRANCHES,
  DIFFICULTY_LEVELS,
  extractYoutubeVideoId
} from '../constants/academic';

function generateCourseCode(title) {
  const words = (title || '').trim().split(/\s+/).filter(Boolean);
  let prefix = 'CP';
  if (words.length >= 2) {
    prefix = (words[0][0] + words[1][0]).toUpperCase();
  } else if (words.length === 1 && words[0].length >= 2) {
    prefix = words[0].substring(0, 2).toUpperCase();
  }
  prefix = prefix.replace(/[^A-Z0-9]/g, '') || 'CP';
  const randNum = Math.floor(1000 + Math.random() * 9000);
  const randSuffix = Math.random().toString(36).substring(2, 5).toUpperCase();
  return `${prefix}${randNum}-${randSuffix}`;
}

export default function CreateCourseModal({
  isOpen,
  onClose,
  onCourseCreated
}) {
  const [title, setTitle] = useState('');
  const [targetBranch, setTargetBranch] = useState('Computer Science & Engineering (CSE)');
  const [difficulty, setDifficulty] = useState('Medium');
  const [description, setDescription] = useState('');
  const [thumbnailUrl, setThumbnailUrl] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [previewTopicId, setPreviewTopicId] = useState(null);

  const [modules, setModules] = useState([
    {
      id: 'mod_1',
      title: 'Module 1: Foundations & Core Concepts',
      description: 'Foundational concepts, architecture, and practical principles.',
      pdfFile: null,
      pdfTitle: '',
      topics: [
        {
          id: 'top_1_1',
          title: 'Lecture 1: Introduction & System Overview',
          description: 'Comprehensive conceptual walkthrough and implementation overview.',
          youtube_url: 'https://www.youtube.com/watch?v=qH6clASSS54'
        }
      ]
    }
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAddModule = () => {
    const nextNum = modules.length + 1;
    setModules((prev) => [
      ...prev,
      {
        id: `mod_${Date.now()}_${nextNum}`,
        title: `Module ${nextNum}: Advanced Concepts & Applications`,
        description: `Structured learning syllabus for Module ${nextNum}.`,
        pdfFile: null,
        pdfTitle: '',
        topics: [
          {
            id: `top_${Date.now()}_1`,
            title: `Lecture 1: Core Methodologies`,
            description: 'Detailed walkthrough and practical demonstration.',
            youtube_url: ''
          }
        ]
      }
    ]);
  };

  const handleRemoveModule = (modId) => {
    if (modules.length <= 1) return;
    setModules((prev) => prev.filter((m) => m.id !== modId));
  };

  const handleUpdateModule = (modId, field, value) => {
    setModules((prev) =>
      prev.map((m) => (m.id === modId ? { ...m, [field]: value } : m))
    );
  };

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
              title: `Lecture ${nextNum}: Key Topic`,
              description: 'Conceptual walkthrough and hands-on analysis.',
              youtube_url: ''
            }
          ]
        };
      })
    );
  };

  const handleRemoveTopic = (modId, topicId) => {
    setModules((prev) =>
      prev.map((m) => {
        if (m.id !== modId) return m;
        if ((m.topics || []).length <= 1) return m;
        return {
          ...m,
          topics: (m.topics || []).filter((t) => t.id !== topicId)
        };
      })
    );
  };

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

  const validateForm = () => {
    if (!title || title.trim().length < 2) {
      return 'Please enter a valid Course Title (at least 2 characters).';
    }
    if (!description || !description.trim()) {
      return 'Please provide a Course Description explaining what students will learn.';
    }
    if (!targetBranch || !targetBranch.trim()) {
      return 'Please select a Target Student Branch.';
    }
    if (!difficulty || !['Easy', 'Medium', 'Hard'].includes(difficulty)) {
      return 'Please select a valid Course Difficulty (Easy, Medium, or Hard).';
    }
    if (!modules || modules.length === 0) {
      return 'A course must include at least one Module.';
    }

    for (let mIdx = 0; mIdx < modules.length; mIdx++) {
      const mod = modules[mIdx];
      if (!mod.title || !mod.title.trim()) {
        return `Module ${mIdx + 1} requires a non-empty title.`;
      }
      if (!mod.topics || mod.topics.length === 0) {
        return `Module "${mod.title.trim()}" must include at least one Topic.`;
      }
      for (let tIdx = 0; tIdx < mod.topics.length; tIdx++) {
        const top = mod.topics[tIdx];
        if (!top.title || !top.title.trim()) {
          return `Topic ${tIdx + 1} in Module "${mod.title.trim()}" requires a title.`;
        }
        const ytId = extractYoutubeVideoId(top.youtube_url);
        if (!ytId) {
          return `Topic "${top.title.trim()}" in Module "${mod.title.trim()}" requires a valid YouTube video URL (watch, share, embed, or shorts link).`;
        }
      }
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErr = validateForm();
    if (validationErr) {
      setError(validationErr);
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

      const courseCode = generateCourseCode(title);
      const coursePayload = {
        title: title.trim(),
        code: courseCode,
        category: targetBranch.trim(),
        target_branch: targetBranch.trim(),
        difficulty,
        description: description.trim(),
        thumbnail_url: thumbnailUrl.trim() || undefined,
        is_published: isPublished,
        modules: modules.map((m) => ({
          title: m.title.trim(),
          description: m.description?.trim() || undefined,
          topics: (m.topics || []).map((t) => ({
            title: t.title.trim(),
            description: t.description?.trim() || undefined,
            youtube_url: t.youtube_url.trim()
          }))
        }))
      };

      const newCourse = await coursesAPI.create(coursePayload);

      // If any modules had optional PDF files selected during initial creation, upload them now
      const hasPdfUploads = modules.some((m) => m.pdfFile instanceof File);
      if (newCourse?.id && hasPdfUploads) {
        try {
          const hierarchy = await coursesAPI.getHierarchy(newCourse.id);
          const createdMods = hierarchy?.modules || [];
          for (let i = 0; i < modules.length; i++) {
            const pdfFile = modules[i].pdfFile;
            const targetMod = createdMods[i];
            if (pdfFile instanceof File && targetMod?.id) {
              const fd = new FormData();
              fd.append('title', (modules[i].pdfTitle || pdfFile.name.replace(/\.pdf$/i, '')).trim());
              fd.append('file', pdfFile);
              await coursesAPI.uploadResource(targetMod.id, fd);
            }
          }
        } catch (pdfErr) {
          console.warn('Optional module PDF upload warning:', pdfErr);
        }
      }

      try {
        confetti({
          particleCount: 70,
          spread: 65,
          origin: { y: 0.6 }
        });
      } catch {}

      if (onCourseCreated) {
        onCourseCreated(newCourse, { openCurriculumStudio: true });
      }
      onClose();
    } catch (err) {
      console.error('Failed to create course:', err);
      let errMsg = 'Failed to create course. Please verify your inputs and try again.';
      if (err.message === 'Network Error' || !err.response) {
        errMsg = 'Network communication error: Unable to reach the CogniPath server. Please check your connection and try again.';
      } else if (err.response?.status === 401 || err.response?.status === 403) {
        errMsg = err.response?.data?.detail || 'You do not have Educator permissions to create courses.';
      } else if (err.response?.data?.detail) {
        errMsg =
          typeof err.response.data.detail === 'string'
            ? err.response.data.detail
            : JSON.stringify(err.response.data.detail);
      } else if (err.message) {
        errMsg = err.message;
      }
      setError(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-gradient-to-b from-[#131927] to-[#0e131f] border border-indigo-500/40 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6 my-8 relative overflow-hidden max-h-[92vh] flex flex-col">
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-80 h-32 bg-indigo-600/20 blur-3xl rounded-full pointer-events-none" />

        {/* Header */}
        <div className="flex items-start justify-between relative border-b border-[#1e2638] pb-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Sparkles className="h-6 w-6 text-cyan-300" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-white">Create New Course</h2>
                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                  Educator Curriculum Studio
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Define course details and initial module structure. After creation, you will enter the Curriculum Manager to add more modules, topics, and PDF notes anytime.
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

        <form onSubmit={handleSubmit} className="space-y-6 overflow-y-auto pr-1 flex-1">
          {/* Section 1: Course Metadata */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 uppercase tracking-wider">
              <BookOpen className="h-3.5 w-3.5" />
              <span>Course Metadata &amp; Academic Targeting</span>
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
                placeholder="e.g. Distributed Systems & Cloud Consensus"
                className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Target Student Branch <span className="text-rose-400">*</span>
                </label>
                <div className="relative">
                  <select
                    value={targetBranch}
                    onChange={(e) => setTargetBranch(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 transition cursor-pointer"
                  >
                    {TARGET_BRANCHES.map((branch) => (
                      <option key={branch} value={branch}>
                        {branch}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Course Difficulty <span className="text-rose-400">*</span>
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {DIFFICULTY_LEVELS.map((lvl) => (
                    <button
                      key={lvl.value}
                      type="button"
                      onClick={() => setDifficulty(lvl.value)}
                      className={`py-2 rounded-xl text-xs font-bold border transition ${
                        difficulty === lvl.value
                          ? `${lvl.badgeClass} ring-2 ring-indigo-500/30`
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
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Course Description <span className="text-rose-400">*</span>
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Explain the learning outcomes, prerequisites, and key topics covered in this course..."
                className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition resize-none"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Publication Status
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPublished(true)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                      isPublished
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-[#0b0f19] border-[#1e2638] text-slate-400 hover:text-white'
                    }`}
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span>Publish Now</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsPublished(false)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition ${
                      !isPublished
                        ? 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                        : 'bg-[#0b0f19] border-[#1e2638] text-slate-400 hover:text-white'
                    }`}
                  >
                    <FileEdit className="h-3.5 w-3.5" />
                    <span>Save as Draft</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Cover Thumbnail URL <span className="text-slate-500">(Optional)</span>
                </label>
                <input
                  type="url"
                  value={thumbnailUrl}
                  onChange={(e) => setThumbnailUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Initial Curriculum */}
          <div className="space-y-4 pt-3 border-t border-[#1e2638]">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2 text-xs font-bold text-cyan-400 uppercase tracking-wider">
                  <Layers className="h-3.5 w-3.5" />
                  <span>Initial Curriculum Structure ({modules.length} {modules.length === 1 ? 'Module' : 'Modules'})</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  At least 1 module and 1 topic with a valid YouTube lecture URL are required.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddModule}
                className="px-3 py-1.5 rounded-xl bg-indigo-600/30 hover:bg-indigo-600/50 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Module</span>
              </button>
            </div>

            <div className="space-y-4">
              {modules.map((mod, mIdx) => (
                <div
                  key={mod.id}
                  className="p-4 rounded-2xl bg-[#0b0f19] border border-[#1e2638] hover:border-indigo-500/40 transition space-y-3.5"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                      Module {mIdx + 1}
                    </span>
                    {modules.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveModule(mod.id)}
                        className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition"
                        title="Remove module"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Module Title <span className="text-rose-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={mod.title}
                        onChange={(e) => handleUpdateModule(mod.id, 'title', e.target.value)}
                        placeholder={`e.g. Module ${mIdx + 1}: Core Architecture`}
                        className="w-full bg-[#131927] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-bold text-slate-400 mb-1">
                        Module Summary <span className="text-slate-500">(Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={mod.description}
                        onChange={(e) => handleUpdateModule(mod.id, 'description', e.target.value)}
                        placeholder="Brief learning goal for this module"
                        className="w-full bg-[#131927] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  {/* Optional Module PDF Notes */}
                  <div className="p-2.5 rounded-xl bg-[#131927]/70 border border-[#1e2638] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                      <div>
                        <span className="font-semibold">Module PDF Lecture Notes</span>
                        <span className="text-[11px] text-slate-500 ml-1.5">(Optional — can also be uploaded later)</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <label className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold cursor-pointer border border-slate-700 transition">
                        {mod.pdfFile ? mod.pdfFile.name : 'Attach PDF'}
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files?.[0] || null;
                            handleUpdateModule(mod.id, 'pdfFile', file);
                          }}
                        />
                      </label>
                      {mod.pdfFile && (
                        <button
                          type="button"
                          onClick={() => handleUpdateModule(mod.id, 'pdfFile', null)}
                          className="text-xs text-rose-400 hover:text-rose-300 px-1.5"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Topics List */}
                  <div className="space-y-2.5 pt-2 border-t border-[#1e2638]/60">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase font-bold text-slate-400">
                        Topics &amp; YouTube Video Lectures ({mod.topics?.length || 0})
                      </span>
                      <button
                        type="button"
                        onClick={() => handleAddTopic(mod.id)}
                        className="text-[11px] font-semibold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 transition"
                      >
                        <Plus className="h-3 w-3" />
                        <span>Add Topic</span>
                      </button>
                    </div>

                    {mod.topics?.map((top, tIdx) => {
                      const ytId = extractYoutubeVideoId(top.youtube_url);
                      const hasTypedUrl = Boolean(top.youtube_url && top.youtube_url.trim());
                      const isPreviewOpen = previewTopicId === top.id;
                      return (
                        <div
                          key={top.id}
                          className="p-3 rounded-xl bg-[#131927] border border-[#1e2638] space-y-2.5"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-bold text-slate-400">
                              Topic {tIdx + 1}
                            </span>
                            {mod.topics.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveTopic(mod.id, top.id)}
                                className="text-slate-500 hover:text-rose-400 transition"
                                title="Remove topic"
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <input
                                type="text"
                                required
                                value={top.title}
                                onChange={(e) => handleUpdateTopic(mod.id, top.id, 'title', e.target.value)}
                                placeholder="Topic Title *"
                                className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                              />
                            </div>
                            <div className="relative">
                              <input
                                type="text"
                                required
                                value={top.youtube_url}
                                onChange={(e) => handleUpdateTopic(mod.id, top.id, 'youtube_url', e.target.value)}
                                placeholder="YouTube URL (watch, youtu.be, embed, shorts) *"
                                className={`w-full bg-[#0b0f19] border rounded-lg pl-7 pr-2.5 py-1.5 text-xs text-white focus:outline-none font-mono ${
                                  hasTypedUrl && !ytId
                                    ? 'border-rose-500/60 focus:border-rose-500'
                                    : 'border-[#1e2638] focus:border-indigo-500'
                                }`}
                              />
                              <Youtube className="h-3.5 w-3.5 text-rose-400 absolute left-2 top-2" />
                            </div>
                          </div>

                          <input
                            type="text"
                            value={top.description || ''}
                            onChange={(e) => handleUpdateTopic(mod.id, top.id, 'description', e.target.value)}
                            placeholder="Topic description / key takeaways (optional)"
                            className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-lg px-2.5 py-1.5 text-[11px] text-slate-300 focus:outline-none focus:border-indigo-500"
                          />

                          {ytId ? (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 text-[10px] text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  <span>
                                    Valid YouTube Video ID: <strong className="font-mono text-white">{ytId}</strong>
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setPreviewTopicId(isPreviewOpen ? null : top.id)}
                                  className="text-[10px] font-semibold text-indigo-300 hover:text-indigo-200 flex items-center gap-1"
                                >
                                  {isPreviewOpen ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                                  <span>{isPreviewOpen ? 'Hide Preview' : 'Preview Video'}</span>
                                </button>
                              </div>
                              {isPreviewOpen && (
                                <div className="aspect-video w-full max-w-md rounded-xl overflow-hidden border border-slate-700 bg-black">
                                  <iframe
                                    title={`Preview ${top.title}`}
                                    src={`https://www.youtube.com/embed/${ytId}`}
                                    className="w-full h-full"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                              )}
                            </div>
                          ) : hasTypedUrl ? (
                            <div className="flex items-center gap-1.5 text-[10px] text-rose-400">
                              <AlertCircle className="h-3 w-3" />
                              <span>Invalid YouTube link. Use a standard watch, youtu.be, embed, or shorts URL.</span>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex items-center justify-between pt-4 border-t border-[#1e2638] shrink-0">
            <span className="text-[11px] text-slate-400 flex items-center gap-1.5">
              <GraduationCap className="h-4 w-4 text-indigo-400" />
              <span>Opens Curriculum Manager immediately after creation</span>
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
                disabled={loading}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-indigo-500 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 disabled:opacity-40 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
              >
                {loading ? (
                  <span>Creating Course...</span>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    <span>{isPublished ? 'Create & Publish Course' : 'Save Draft & Manage Curriculum'}</span>
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
