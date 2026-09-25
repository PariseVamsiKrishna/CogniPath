import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  HelpCircle,
  Plus,
  Minus,
  CheckCircle2,
  AlertCircle,
  Clock,
  Award,
  BookOpen,
  Layers,
  RefreshCw,
  FileText,
  ChevronRight,
  ShieldCheck,
  Send,
  Sliders,
  Trash2,
  Check
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { coursesAPI } from '../services/api';

const DIFFICULTY_LEVELS = [
  { id: 'Beginner', label: 'Beginner', color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30' },
  { id: 'Intermediate', label: 'Intermediate', color: 'text-indigo-400 bg-indigo-500/10 border-indigo-500/30' },
  { id: 'Advanced', label: 'Advanced', color: 'text-purple-400 bg-purple-500/10 border-purple-500/30' }
];

export default function ModuleExamBuilder({
  isOpen,
  onClose,
  module,
  courseId,
  existingExam = null,
  onExamSaved
}) {
  // 1. Educator Toggle: Add End-of-Module Exam (Default: OFF unless existing exam attached)
  const [hasModuleExam, setHasModuleExam] = useState(() => {
    return Boolean(existingExam || module?.has_module_exam);
  });

  // 2. Mode Selection: AI RAG Generation vs Manual Construction
  const [activeMode, setActiveMode] = useState('RAG'); // 'RAG' or 'MANUAL'

  // Exam Metadata Config
  const [examTitle, setExamTitle] = useState(
    existingExam?.title || (module?.title ? `${module.title} Mastery Assessment` : 'Module End Exam')
  );
  const [timeLimit, setTimeLimit] = useState(existingExam?.time_limit_mins || 15);
  const [passingScore, setPassingScore] = useState(existingExam?.passing_score || 70);

  // RAG Generation Parameters
  const [ragTopic, setRagTopic] = useState(module?.title || '');
  const [ragCount, setRagCount] = useState(4);
  const [ragDifficulty, setRagDifficulty] = useState('Intermediate');
  const [isGenerating, setIsGenerating] = useState(false);
  const [genError, setGenError] = useState('');

  // Suggestion Drawer State
  const [suggestions, setSuggestions] = useState([]);
  const [sourcesUsed, setSourcesUsed] = useState([]);

  // Final Staged Exam Questions Queue
  const [stagedQuestions, setStagedQuestions] = useState(() => {
    if (existingExam?.questions && existingExam.questions.length > 0) {
      return existingExam.questions.map((q) => ({
        id: q.id || `q_${Date.now()}_${Math.random()}`,
        question_type: q.question_type || 'MCQ',
        question_text: q.question_text,
        options: q.options || ['Option A', 'Option B', 'Option C', 'Option D'],
        correct_answer: q.correct_answer || 'A',
        explanation: q.explanation || '',
        source_ref: q.source_ref || (module?.title ? `${module.title} Notes` : 'Module Notes')
      }));
    }
    return [];
  });

  // Manual Question Draft State
  const [manualText, setManualText] = useState('');
  const [manualOptions, setManualOptions] = useState(['', '', '', '']);
  const [manualCorrect, setManualCorrect] = useState('A');
  const [manualExplanation, setManualExplanation] = useState('');

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (module) {
      setRagTopic(module.title || '');
      setExamTitle(existingExam?.title || `${module.title} Mastery Assessment`);
      setHasModuleExam(Boolean(existingExam || module.has_module_exam));
    }
  }, [module, existingExam]);

  if (!isOpen || !module) return null;

  // Handler: Generate Questions using RAG Pipeline
  const handleGenerateRAG = async () => {
    try {
      setIsGenerating(true);
      setGenError('');
      const data = await coursesAPI.generateExamRAG(module.id, {
        course_id: courseId,
        topic: ragTopic.trim() || module.title,
        count: Number(ragCount),
        difficulty: ragDifficulty
      });

      if (data && data.questions) {
        setSuggestions(data.questions);
        setSourcesUsed(data.sources_used || []);
        confetti({
          particleCount: 35,
          spread: 45,
          origin: { y: 0.7 }
        });
      }
    } catch (err) {
      console.error('RAG Generation error:', err);
      setGenError(err.response?.data?.detail || 'RAG generation failed. Please retry.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Drawer Action: Add question (+) to Final Exam Queue
  const handleAddSuggestion = (item) => {
    const newQ = {
      id: item.question_id || `q_${Date.now()}`,
      question_type: 'MCQ',
      question_text: item.question_text,
      options: item.options,
      correct_answer: item.correct_option,
      explanation: item.explanation,
      source_ref: item.source_reference
    };
    setStagedQuestions((prev) => [...prev, newQ]);
    // Remove from suggestions drawer once added
    setSuggestions((prev) => prev.filter((s) => s.question_id !== item.question_id));
  };

  // Drawer Action: Discard question (-)
  const handleDiscardSuggestion = (questionId) => {
    setSuggestions((prev) => prev.filter((s) => s.question_id !== questionId));
  };

  // Remove staged question from final queue
  const handleRemoveStaged = (indexToRemove) => {
    setStagedQuestions((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  // Handler: Add Manual Question
  const handleAddManualQuestion = (e) => {
    e.preventDefault();
    if (!manualText.trim() || manualOptions.some((o) => !o.trim())) {
      alert('Please fill out the question prompt and all 4 options.');
      return;
    }

    const newQ = {
      id: `manual_${Date.now()}`,
      question_type: 'MCQ',
      question_text: manualText.trim(),
      options: manualOptions.map((o) => o.trim()),
      correct_answer: manualCorrect,
      explanation: manualExplanation.trim() || `Verified concept for ${module.title}`,
      source_ref: `${module.title} Manual Assessment`
    };

    setStagedQuestions((prev) => [...prev, newQ]);
    setManualText('');
    setManualOptions(['', '', '', '']);
    setManualCorrect('A');
    setManualExplanation('');
  };

  // Handler: Save & Link Module Exam
  const handleSaveExam = async () => {
    if (!hasModuleExam) {
      // If toggled OFF, unlink or confirm
      onClose();
      return;
    }

    if (stagedQuestions.length === 0) {
      alert('Please add at least one question to the exam before saving.');
      return;
    }

    try {
      setSaving(true);
      const payload = {
        title: examTitle.trim() || `${module.title} Mastery Assessment`,
        time_limit_mins: Number(timeLimit) || 15,
        passing_score: Number(passingScore) || 70,
        scope: 'MODULE_END',
        questions: stagedQuestions.map((q, idx) => ({
          question_type: 'MCQ',
          question_text: q.question_text,
          options: q.options,
          correct_answer: q.correct_answer,
          explanation: q.explanation,
          source_ref: q.source_ref,
          order_index: idx + 1
        }))
      };

      const saved = await coursesAPI.createModuleExam(module.id, payload);
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 }
      });

      if (onExamSaved) {
        onExamSaved(saved, module.id);
      }
      onClose();
    } catch (err) {
      console.error('Failed to save module exam:', err);
      alert(err.response?.data?.detail || 'Failed to save module exam.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 lg:p-6 overflow-y-auto">
      <div className="w-full max-w-6xl bg-[#0f1420] border border-[#1e2638] rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#1e2638] bg-[#141b2d] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-purple-600 flex items-center justify-center text-white shadow-lg shadow-indigo-600/30">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black text-white">Module-End Assessment Studio</h3>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 uppercase tracking-wider">
                  Module {module.order_index}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                {module.title} • Grounded RAG Generation & Assessment Assembly
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Master Toggle Banner */}
        <div className="px-6 py-3.5 bg-[#121828] border-b border-[#1e2638] flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center">
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasModuleExam}
                  onChange={(e) => setHasModuleExam(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
              </label>
            </div>
            <div>
              <span className="text-xs font-black text-white flex items-center gap-1.5">
                <span>Add End-of-Module Exam</span>
                {hasModuleExam ? (
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                    Active (ON)
                  </span>
                ) : (
                  <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
                    Disabled (OFF)
                  </span>
                )}
              </span>
              <p className="text-[11px] text-slate-400">
                Tests students on module notes, concepts, and video lectures before advancing.
              </p>
            </div>
          </div>

          {hasModuleExam && (
            <div className="flex items-center gap-2 bg-[#0b0f19] p-1 rounded-xl border border-[#1e2638]">
              <button
                onClick={() => setActiveMode('RAG')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeMode === 'RAG'
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>Generate with AI (RAG)</span>
              </button>
              <button
                onClick={() => setActiveMode('MANUAL')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeMode === 'MANUAL'
                    ? 'bg-[#1e2638] text-white border border-[#2b354d]'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Questions Manually</span>
              </button>
            </div>
          )}
        </div>

        {/* Main Body */}
        {!hasModuleExam ? (
          <div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
            <div className="h-16 w-16 rounded-3xl bg-slate-800/60 border border-slate-700/50 flex items-center justify-center text-slate-400">
              <Award className="h-8 w-8" />
            </div>
            <div className="max-w-md">
              <h4 className="text-base font-extrabold text-white">Module Exam is Currently OFF</h4>
              <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">
                Toggle the switch above to configure an end-of-module assessment. You can either use our RAG pipeline to automatically synthesize questions from your lecture notes or create questions manually.
              </p>
            </div>
            <button
              onClick={() => setHasModuleExam(true)}
              className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/40 flex items-center gap-2"
            >
              <Check className="h-4 w-4" />
              <span>Enable Module Exam</span>
            </button>
          </div>
        ) : (
          <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
            {/* Left Column: Exam Assembly Queue & Settings (60% width) */}
            <div className="flex-1 border-r border-[#1e2638] flex flex-col overflow-y-auto p-5 space-y-5 bg-[#0b0f19]/60">
              {/* Exam Metadata Card */}
              <div className="p-4 rounded-2xl bg-[#121826] border border-[#1e2638] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <Sliders className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Assessment Configuration</span>
                  </span>
                  <span className="text-[11px] font-bold text-indigo-400 bg-indigo-500/10 px-2.5 py-0.5 rounded-full">
                    {stagedQuestions.length} Questions Staged
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-3">
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                      Assessment Title
                    </label>
                    <input
                      type="text"
                      value={examTitle}
                      onChange={(e) => setExamTitle(e.target.value)}
                      placeholder="e.g. Binary Search Trees Mastery Exam"
                      className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 font-semibold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Clock className="h-3 w-3 text-indigo-400" />
                      <span>Time Limit</span>
                    </label>
                    <div className="flex items-center mt-1 bg-[#0b0f19] border border-[#1e2638] rounded-xl px-2.5 py-1.5 text-xs text-white">
                      <input
                        type="number"
                        min="5"
                        max="180"
                        value={timeLimit}
                        onChange={(e) => setTimeLimit(e.target.value)}
                        className="bg-transparent w-full outline-none font-bold text-center"
                      />
                      <span className="text-[11px] text-slate-400 shrink-0">mins</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <ShieldCheck className="h-3 w-3 text-emerald-400" />
                      <span>Passing Score</span>
                    </label>
                    <div className="flex items-center mt-1 bg-[#0b0f19] border border-[#1e2638] rounded-xl px-2.5 py-1.5 text-xs text-white">
                      <input
                        type="number"
                        min="40"
                        max="100"
                        value={passingScore}
                        onChange={(e) => setPassingScore(e.target.value)}
                        className="bg-transparent w-full outline-none font-bold text-center"
                      />
                      <span className="text-[11px] text-slate-400 shrink-0">%</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                      <Layers className="h-3 w-3 text-purple-400" />
                      <span>Scope</span>
                    </label>
                    <div className="mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-indigo-300 font-bold">
                      Module-End (Unit)
                    </div>
                  </div>
                </div>
              </div>

              {/* Mode: Manual Question Creator Form */}
              {activeMode === 'MANUAL' && (
                <form
                  onSubmit={handleAddManualQuestion}
                  className="p-4 rounded-2xl bg-[#121826] border border-[#1e2638] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase tracking-wider text-slate-300">
                      Manual Question Composer
                    </span>
                    <span className="text-[10px] text-slate-400">Add custom conceptual question</span>
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-400">Question Prompt</label>
                    <textarea
                      rows={2}
                      required
                      value={manualText}
                      onChange={(e) => setManualText(e.target.value)}
                      placeholder="e.g. What is the time complexity of searching a balanced binary tree?"
                      className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-extrabold uppercase text-slate-400">
                      Options & Correct Answer Selection
                    </label>
                    {['A', 'B', 'C', 'D'].map((letter, idx) => (
                      <div key={letter} className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setManualCorrect(letter)}
                          className={`h-7 w-7 rounded-lg font-black text-xs shrink-0 transition flex items-center justify-center ${
                            manualCorrect === letter
                              ? 'bg-emerald-600 text-white ring-2 ring-emerald-400/40'
                              : 'bg-slate-800 text-slate-400 hover:text-white'
                          }`}
                          title={`Select option ${letter} as correct`}
                        >
                          {letter}
                        </button>
                        <input
                          type="text"
                          required
                          value={manualOptions[idx]}
                          onChange={(e) => {
                            const updated = [...manualOptions];
                            updated[idx] = e.target.value;
                            setManualOptions(updated);
                          }}
                          placeholder={`Option ${letter} text...`}
                          className="flex-1 px-3 py-1.5 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                    ))}
                  </div>
                  <div>
                    <label className="text-[10px] font-extrabold uppercase text-slate-400">
                      Pedagogical Explanation
                    </label>
                    <input
                      type="text"
                      value={manualExplanation}
                      onChange={(e) => setManualExplanation(e.target.value)}
                      placeholder="Why is this option correct? (shown to students upon submission)"
                      className="w-full mt-1 px-3 py-1.5 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/30 flex items-center justify-center gap-1.5"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Stage Question to Exam</span>
                  </button>
                </form>
              )}

              {/* Staged Final Exam Questions Queue */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    <span>Final Exam Questions Queue ({stagedQuestions.length})</span>
                  </h4>
                  {stagedQuestions.length > 0 && (
                    <button
                      onClick={() => setStagedQuestions([])}
                      className="text-[10px] text-rose-400 hover:underline font-bold"
                    >
                      Clear Queue
                    </button>
                  )}
                </div>

                {stagedQuestions.length === 0 ? (
                  <div className="p-8 text-center rounded-2xl border-2 border-dashed border-[#1e2638] bg-[#121826]/40 space-y-2">
                    <p className="text-xs font-bold text-slate-400">No questions added yet.</p>
                    <p className="text-[11px] text-slate-500 max-w-sm mx-auto">
                      Use the AI Suggestions drawer on the right to review and add (+) questions, or create questions manually.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {stagedQuestions.map((q, qIdx) => (
                      <div
                        key={q.id || qIdx}
                        className="p-3.5 rounded-xl bg-[#121826] border border-[#1e2638] space-y-2 group hover:border-indigo-500/40 transition"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="h-5 w-5 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 text-[10px] font-black flex items-center justify-center shrink-0">
                              #{qIdx + 1}
                            </span>
                            <p className="text-xs font-extrabold text-white line-clamp-2 leading-tight">
                              {q.question_text}
                            </p>
                          </div>
                          <button
                            onClick={() => handleRemoveStaged(qIdx)}
                            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0"
                            title="Remove from exam queue"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        {/* Options preview */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 pt-1">
                          {q.options?.map((opt, oIdx) => {
                            const letter = String.fromCharCode(65 + oIdx);
                            const isCorrect = q.correct_answer === letter || q.correct_answer === String(oIdx);
                            return (
                              <div
                                key={oIdx}
                                className={`px-2 py-1 rounded-lg text-[11px] flex items-center gap-1.5 border truncate ${
                                  isCorrect
                                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold'
                                    : 'bg-[#0b0f19] border-[#1e2638] text-slate-400'
                                }`}
                              >
                                <span className="font-mono font-bold text-[10px] shrink-0">{letter})</span>
                                <span className="truncate">{opt}</span>
                              </div>
                            );
                          })}
                        </div>

                        {q.explanation && (
                          <p className="text-[10px] text-slate-400 bg-[#0b0f19]/80 rounded-lg p-2 border border-[#1a2335] line-clamp-1">
                            <span className="font-semibold text-slate-300">Explanation:</span> {q.explanation}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: AI RAG Suggestion Side-Drawer (40% width) */}
            <div className="w-full lg:w-[420px] bg-[#0c101c] flex flex-col overflow-y-auto shrink-0 border-l border-[#1e2638]">
              {/* Drawer Header & Parameter Controls */}
              <div className="p-4 border-b border-[#1e2638] bg-[#121826] space-y-3 shrink-0">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-purple-400" />
                    <span className="text-xs font-black uppercase tracking-wider text-white">
                      RAG Question Generator
                    </span>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Vector Grounded
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-400">Target Concept Focus</label>
                    <input
                      type="text"
                      value={ragTopic}
                      onChange={(e) => setRagTopic(e.target.value)}
                      placeholder="e.g. AVL Tree Balance Factors & Rotations"
                      className="w-full mt-1 px-3 py-1.5 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-600 focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-400">Count</label>
                      <select
                        value={ragCount}
                        onChange={(e) => setRagCount(Number(e.target.value))}
                        className="w-full mt-1 px-2 py-1.5 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white outline-none cursor-pointer"
                      >
                        <option value={3}>3 Questions</option>
                        <option value={4}>4 Questions</option>
                        <option value={5}>5 Questions</option>
                        <option value={8}>8 Questions</option>
                      </select>
                    </div>
                    <div className="flex-1">
                      <label className="text-[10px] font-bold text-slate-400">Difficulty</label>
                      <select
                        value={ragDifficulty}
                        onChange={(e) => setRagDifficulty(e.target.value)}
                        className="w-full mt-1 px-2 py-1.5 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white outline-none cursor-pointer"
                      >
                        {DIFFICULTY_LEVELS.map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button
                    onClick={handleGenerateRAG}
                    disabled={isGenerating}
                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs transition shadow-lg shadow-indigo-600/30 flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin' : ''}`} />
                    <span>{isGenerating ? 'Retrieving Module Chunks...' : 'Generate with RAG Engine'}</span>
                  </button>

                  {genError && (
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                      <span>{genError}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Suggestions Cards Container */}
              <div className="p-4 space-y-3 flex-1 overflow-y-auto">
                {sourcesUsed.length > 0 && (
                  <div className="p-2.5 rounded-xl bg-indigo-500/5 border border-indigo-500/20">
                    <span className="text-[10px] font-black uppercase tracking-wider text-indigo-400 block mb-1">
                      Module Grounding Sources ({sourcesUsed.length}):
                    </span>
                    <div className="flex flex-wrap gap-1">
                      {sourcesUsed.map((src, sIdx) => (
                        <span
                          key={sIdx}
                          className="text-[9px] font-semibold px-2 py-0.5 rounded bg-[#141b2c] border border-[#222b40] text-slate-300"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {suggestions.length === 0 ? (
                  <div className="py-12 text-center text-slate-500 space-y-2">
                    <Sparkles className="h-8 w-8 mx-auto text-slate-600 opacity-60" />
                    <p className="text-xs font-bold">No AI Suggestions in Drawer</p>
                    <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                      Click "Generate with RAG Engine" above to extract vector chunks and compose MCQs.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-300">
                        Candidate Suggestions ({suggestions.length})
                      </span>
                      <button
                        onClick={handleGenerateRAG}
                        disabled={isGenerating}
                        className="text-[10px] text-indigo-400 hover:text-indigo-300 flex items-center gap-1 font-bold"
                      >
                        <RefreshCw className="h-3 w-3" />
                        <span>Regenerate</span>
                      </button>
                    </div>

                    {suggestions.map((item, idx) => (
                      <div
                        key={item.question_id || idx}
                        className="p-3.5 rounded-2xl bg-[#121826] border border-[#1e2638] space-y-2.5 hover:border-purple-500/40 transition shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-extrabold text-white leading-snug">
                            {item.question_text}
                          </p>
                          <div className="flex items-center gap-1 shrink-0">
                            {/* Discard Button (-) */}
                            <button
                              onClick={() => handleDiscardSuggestion(item.question_id)}
                              className="h-7 w-7 rounded-lg bg-[#1e2638] hover:bg-rose-600/20 text-slate-400 hover:text-rose-300 border border-[#2b354d] flex items-center justify-center transition"
                              title="Discard suggestion (-)"
                            >
                              <Minus className="h-3.5 w-3.5" />
                            </button>
                            {/* Add Button (+) */}
                            <button
                              onClick={() => handleAddSuggestion(item)}
                              className="h-7 w-7 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white flex items-center justify-center transition shadow-sm shadow-emerald-600/30"
                              title="Add to final exam queue (+)"
                            >
                              <Plus className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Options List */}
                        <div className="space-y-1">
                          {item.options?.map((opt, oIdx) => {
                            const letter = String.fromCharCode(65 + oIdx);
                            const isCorrect = item.correct_option === letter;
                            return (
                              <div
                                key={oIdx}
                                className={`px-2 py-1 rounded-lg text-[11px] flex items-center gap-2 border ${
                                  isCorrect
                                    ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-bold'
                                    : 'bg-[#0b0f19] border-[#1e2638] text-slate-300'
                                }`}
                              >
                                <span className="font-mono font-black text-[10px] shrink-0">{letter})</span>
                                <span className="line-clamp-1">{opt}</span>
                              </div>
                            );
                          })}
                        </div>

                        {/* Explanation & Source Reference */}
                        <div className="text-[10px] text-slate-400 space-y-1 pt-1 border-t border-[#1a2335]">
                          <p className="line-clamp-2">
                            <span className="font-semibold text-slate-300">Rationale:</span> {item.explanation}
                          </p>
                          {item.source_reference && (
                            <div className="flex items-center gap-1 text-[9px] text-purple-400 font-semibold truncate">
                              <BookOpen className="h-3 w-3 shrink-0" />
                              <span className="truncate">{item.source_reference}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-[#1e2638] bg-[#141b2d] flex items-center justify-between shrink-0">
          <div className="text-xs text-slate-400">
            {hasModuleExam ? (
              <span>
                Ready to attach: <strong className="text-white">{stagedQuestions.length} questions</strong> • Passing Score:{' '}
                <strong className="text-emerald-400">{passingScore}%</strong>
              </span>
            ) : (
              <span>Assessment is currently disabled for this module.</span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveExam}
              disabled={saving || (hasModuleExam && stagedQuestions.length === 0)}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-950/40 disabled:opacity-40 flex items-center gap-2"
            >
              <Send className="h-3.5 w-3.5" />
              <span>{saving ? 'Linking Exam...' : hasModuleExam ? 'Save & Attach Module Exam' : 'Save Changes'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
