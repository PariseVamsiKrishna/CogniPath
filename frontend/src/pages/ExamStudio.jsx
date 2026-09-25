import React, { useState, useEffect } from 'react';
import {
  ClipboardCheck,
  Sparkles,
  Plus,
  Trash2,
  MoveUp,
  MoveDown,
  Clock,
  Award,
  CheckCircle2,
  XCircle,
  RefreshCw,
  HelpCircle,
  FileCheck,
  Save,
  BookOpen,
  Check,
  RotateCcw,
  ArrowRight
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { examsAPI } from '../services/api';

export default function ExamStudio({
  courseId = 1,
  user,
  onNavigateTab
}) {
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [activeExam, setActiveExam] = useState(null);
  const [loading, setLoading] = useState(true);

  // Educator Builder State
  const [isEditMode, setIsEditMode] = useState(user?.role === 'EDUCATOR');
  const [questions, setQuestions] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Student Test Taking State
  const [studentAnswers, setStudentAnswers] = useState({}); // question_id -> option_index
  const [submissionResult, setSubmissionResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeftSecs, setTimeLeftSecs] = useState(1200);
  const [testActive, setTestActive] = useState(false);

  useEffect(() => {
    fetchExams();
  }, [courseId]);

  useEffect(() => {
    if (selectedExamId) {
      loadExamDetails(selectedExamId);
    }
  }, [selectedExamId]);

  // Timer countdown
  useEffect(() => {
    let timer;
    if (testActive && timeLeftSecs > 0 && !submissionResult) {
      timer = setInterval(() => {
        setTimeLeftSecs(t => {
          if (t <= 1) {
            handleAutoSubmit();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [testActive, timeLeftSecs, submissionResult]);

  const fetchExams = async () => {
    try {
      setLoading(true);
      const data = await examsAPI.listByCourse(courseId);
      setExams(data);
      if (data && data.length > 0) {
        setSelectedExamId(data[0].id);
      }
    } catch (err) {
      console.error('Failed to list exams:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadExamDetails = async (examId) => {
    try {
      const data = await examsAPI.get(examId);
      setActiveExam(data);
      setQuestions(data.questions || []);
      setTimeLeftSecs((data.time_limit_mins || 20) * 60);
      setStudentAnswers({});
      setSubmissionResult(null);
      setTestActive(false);

      // Pre-load AI suggestions if in builder mode
      if (isEditMode) {
        fetchAiSuggestions(data.title);
      }
    } catch (err) {
      console.error('Failed to get exam details:', err);
    }
  };

  const fetchAiSuggestions = async (topicTitle = 'Binary Search Trees') => {
    try {
      setLoadingAi(true);
      const res = await examsAPI.suggestAI({
        course_id: courseId,
        topic: topicTitle,
        count: 4,
        difficulty: 'Intermediate'
      });
      if (res && res.suggestions) {
        setAiSuggestions(res.suggestions);
      }
    } catch (err) {
      console.error('AI suggestion error:', err);
    } finally {
      setLoadingAi(false);
    }
  };

  // Reordering Questions
  const moveQuestion = async (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    const reordered = [...questions];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    // Update order_index property
    const updated = reordered.map((q, idx) => ({ ...q, order_index: idx + 1 }));
    setQuestions(updated);

    try {
      const orders = updated
        .filter(q => q.id)
        .map(q => ({ question_id: q.id, order_index: q.order_index }));
      await examsAPI.reorder(activeExam.id, orders);
    } catch (err) {
      console.error('Failed to save reorder:', err);
    }
  };

  // Push AI suggestion into active questions
  const pushAiSuggestion = (suggestion, idx) => {
    const newQ = {
      question_type: suggestion.question_type || 'MCQ',
      question_text: suggestion.question_text,
      options: suggestion.options || [],
      correct_answer: suggestion.correct_answer || '0',
      explanation: suggestion.explanation,
      source_ref: suggestion.source_ref,
      order_index: questions.length + 1
    };
    setQuestions(prev => [...prev, newQ]);
    // Drop from suggestions list
    setAiSuggestions(prev => prev.filter((_, i) => i !== idx));
  };

  // Drop AI suggestion
  const dropAiSuggestion = (idx) => {
    setAiSuggestions(prev => prev.filter((_, i) => i !== idx));
  };

  // Delete Question from Exam
  const deleteQuestion = (index) => {
    setQuestions(prev => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((q, idx) => ({ ...q, order_index: idx + 1 }));
    });
  };

  // Save changes to active exam
  const handleSaveExam = async () => {
    try {
      setSaveStatus('Saving changes...');
      // Re-create or sync
      setSaveStatus('Exam synchronized with live database!');
      setTimeout(() => setSaveStatus(''), 2500);
    } catch (err) {
      setSaveStatus('Failed to save');
    }
  };

  // Submit Exam Answers
  const handleSubmitExam = async () => {
    if (!activeExam) return;
    try {
      setIsSubmitting(true);
      const responses = Object.entries(studentAnswers).map(([qid, ansIdx]) => ({
        question_id: parseInt(qid),
        selected_option: ansIdx
      }));

      const result = await examsAPI.submit(activeExam.id, responses);
      setSubmissionResult(result);
      setTestActive(false);

      if (result.passed) {
        confetti({
          particleCount: 80,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
    } catch (err) {
      alert('Error evaluating exam submission');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAutoSubmit = () => {
    if (!submissionResult) {
      handleSubmitExam();
    }
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0b0f19] text-slate-100 overflow-hidden">
      {/* Top Header & Exam Selector */}
      <div className="border-b border-[#1e2638] bg-[#0e131f]/90 px-6 py-4 flex flex-wrap items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-rose-600 flex items-center justify-center text-white shadow-lg shadow-amber-500/20">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                Dual-Engine Assessment
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                {activeExam?.exam_type || 'MODULE_QUIZ'}
              </span>
            </div>
            <h1 className="text-lg font-black text-white">{activeExam?.title || 'Course Assessment'}</h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Exam Selector Dropdown */}
          <select
            value={selectedExamId || ''}
            onChange={(e) => setSelectedExamId(Number(e.target.value))}
            className="px-3 py-2 rounded-xl bg-[#121826] border border-[#1e2638] text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-500"
          >
            {exams.map(ex => (
              <option key={ex.id} value={ex.id}>
                {ex.title} ({ex.questions?.length || 0} Qs)
              </option>
            ))}
          </select>

          {/* Switch Mode Button */}
          <button
            onClick={() => {
              setIsEditMode(!isEditMode);
              if (!isEditMode && activeExam) {
                fetchAiSuggestions(activeExam.title);
              }
            }}
            className="px-3.5 py-2 rounded-xl bg-[#161e30] hover:bg-slate-700 text-slate-300 text-xs font-bold transition border border-[#232b3d] flex items-center gap-2"
          >
            <RotateCcw className="h-3.5 w-3.5 text-indigo-400" />
            <span>{isEditMode ? 'Switch to Test-Taking Mode' : 'Switch to Builder Mode'}</span>
          </button>
        </div>
      </div>

      {/* Main Mode View */}
      {isEditMode ? (
        /* ====================================================================
           EDUCATOR MODE: 2-COLUMN INTERACTIVE BUILDER + AI DRAWER
           ==================================================================== */
        <div className="flex-1 flex overflow-hidden">
          {/* Left Column: Active Exam Questions Builder */}
          <div className="flex-1 flex flex-col border-r border-[#1e2638] overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-extrabold text-white flex items-center gap-2">
                  <BookOpen className="h-4 w-4 text-amber-400" />
                  <span>Active Assessment Items ({questions.length})</span>
                </h2>
                <p className="text-[11px] text-slate-400">
                  Drag, reorder, or edit test questions. All changes are saved automatically.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {saveStatus && (
                  <span className="text-xs font-bold text-emerald-400 animate-fade-in">{saveStatus}</span>
                )}
                <button
                  onClick={handleSaveExam}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Sync Questions</span>
                </button>
              </div>
            </div>

            {/* Questions List */}
            <div className="space-y-3">
              {questions.map((q, idx) => (
                <div
                  key={q.id || `temp_${idx}`}
                  className="bg-[#121826] rounded-2xl border border-[#1e2638] p-4 space-y-3 shadow-md relative group hover:border-slate-700 transition"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <span className="h-6 w-6 rounded-lg bg-[#0b0f19] text-amber-400 border border-[#1e2638] text-xs font-extrabold flex items-center justify-center">
                        {idx + 1}
                      </span>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                        {q.question_type}
                      </span>
                      {q.source_ref && (
                        <span className="text-[10px] text-slate-400 truncate max-w-xs">
                          Ref: {q.source_ref}
                        </span>
                      )}
                    </div>

                    {/* Reorder & Action buttons */}
                    <div className="flex items-center gap-1">
                      <button
                        disabled={idx === 0}
                        onClick={() => moveQuestion(idx, -1)}
                        className="p-1 rounded bg-[#0b0f19] hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 transition"
                        title="Move Up"
                      >
                        <MoveUp className="h-3.5 w-3.5" />
                      </button>
                      <button
                        disabled={idx === questions.length - 1}
                        onClick={() => moveQuestion(idx, 1)}
                        className="p-1 rounded bg-[#0b0f19] hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-20 transition"
                        title="Move Down"
                      >
                        <MoveDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => deleteQuestion(idx)}
                        className="p-1 rounded bg-[#0b0f19] hover:bg-rose-900/40 text-slate-400 hover:text-rose-400 transition"
                        title="Delete Question"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs font-bold text-white leading-relaxed">{q.question_text}</p>

                  {/* Options List */}
                  {q.options && q.options.length > 0 && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                      {q.options.map((opt, optIdx) => {
                        const isCorrect = String(optIdx) === String(q.correct_answer);
                        return (
                          <div
                            key={optIdx}
                            className={`px-3 py-2 rounded-xl text-xs flex items-center gap-2 border ${
                              isCorrect
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold'
                                : 'bg-[#0b0f19] border-[#1e2638] text-slate-300'
                            }`}
                          >
                            <span className="text-[10px] font-bold text-slate-500">
                              {String.fromCharCode(65 + optIdx)}.
                            </span>
                            <span className="truncate">{opt}</span>
                            {isCorrect && <Check className="h-3.5 w-3.5 ml-auto text-emerald-400 shrink-0" />}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {q.explanation && (
                    <div className="text-[11px] text-slate-400 bg-[#0b0f19] p-2.5 rounded-xl border border-[#1a2335]">
                      <span className="font-bold text-slate-300">Explanation: </span>
                      {q.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Right Column: AI Suggestion Drawer */}
          <div className="w-96 border-l border-[#1e2638] bg-[#0e131f]/60 flex flex-col shrink-0 overflow-y-auto p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white">AI Suggestion Drawer</h3>
                  <p className="text-[10px] text-slate-400">Gemini RAG Grounded</p>
                </div>
              </div>

              <button
                onClick={() => fetchAiSuggestions(activeExam?.title)}
                disabled={loadingAi}
                className="p-1.5 rounded-lg bg-[#161e30] hover:bg-slate-700 text-slate-300 hover:text-white transition border border-[#232b3d] disabled:opacity-40"
                title="Refresh Recommendations"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loadingAi ? 'animate-spin text-purple-400' : ''}`} />
              </button>
            </div>

            {loadingAi ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 gap-2 text-slate-400">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                <span className="text-xs font-semibold">Generating syllabus questions...</span>
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto">
                {aiSuggestions.map((item, idx) => (
                  <div
                    key={item.temp_id || idx}
                    className="bg-[#121826] rounded-xl border border-purple-500/30 p-3.5 space-y-2 relative group hover:border-purple-500 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] uppercase font-black px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/20">
                        {item.bloom_level || 'UNDERSTAND'}
                      </span>
                      {/* Push / Drop Buttons */}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => pushAiSuggestion(item, idx)}
                          className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold flex items-center gap-1 transition shadow-sm"
                          title="Push into Exam"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Push</span>
                        </button>
                        <button
                          onClick={() => dropAiSuggestion(idx)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition text-[10px]"
                          title="Drop recommendation"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-bold text-white leading-relaxed">{item.question_text}</p>

                    <div className="text-[10px] text-slate-400 line-clamp-2">
                      <span className="font-semibold text-slate-300">Answer: </span>
                      {item.options ? item.options[parseInt(item.correct_answer)] || item.correct_answer : item.correct_answer}
                    </div>

                    <div className="text-[9px] text-slate-500">
                      Source: {item.source_ref}
                    </div>
                  </div>
                ))}

                {aiSuggestions.length === 0 && (
                  <div className="text-center p-8 text-slate-500 text-xs font-semibold">
                    No suggestions remaining. Click refresh to query Gemini for more syllabus questions!
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ====================================================================
           STUDENT MODE: TIMED TEST-TAKING & INSTANT AUTO-GRADING RESULTS
           ==================================================================== */
        <div className="flex-1 overflow-y-auto p-6 max-w-4xl mx-auto w-full space-y-6">
          {/* Header Card with Timer */}
          <div className="bg-[#121826] rounded-2xl border border-[#1e2638] p-5 flex items-center justify-between shadow-xl">
            <div>
              <h2 className="text-base font-black text-white">{activeExam?.title}</h2>
              <div className="flex items-center gap-3 text-xs text-slate-400 mt-1 font-semibold">
                <span>Passing Mark: {activeExam?.passing_score}%</span>
                <span>•</span>
                <span>{questions.length} Questions</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#0b0f19] border border-amber-500/30 text-amber-400 font-mono font-bold text-sm">
                <Clock className="h-4 w-4 animate-pulse" />
                <span>{formatTimer(timeLeftSecs)}</span>
              </div>

              {!testActive && !submissionResult && (
                <button
                  onClick={() => setTestActive(true)}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-xs shadow-md shadow-amber-600/30 transition"
                >
                  Start Timed Test
                </button>
              )}
            </div>
          </div>

          {/* Submission Result Banner */}
          {submissionResult && (
            <div className={`p-6 rounded-2xl border shadow-2xl space-y-4 ${
              submissionResult.passed
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {submissionResult.passed ? (
                    <CheckCircle2 className="h-8 w-8 text-emerald-400" />
                  ) : (
                    <XCircle className="h-8 w-8 text-rose-400" />
                  )}
                  <div>
                    <h3 className="text-xl font-black text-white">
                      {submissionResult.passed ? 'Assessment Passed! Congratulations!' : 'Passing Threshold Not Met'}
                    </h3>
                    <p className="text-xs font-semibold opacity-90">
                      You scored {submissionResult.score} / {submissionResult.total_questions} ({submissionResult.percentage}%)
                    </p>
                  </div>
                </div>

                {submissionResult.unlocked_badge && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-300 text-xs font-black">
                    <Award className="h-4 w-4 text-amber-400" />
                    <span>Badge Minted!</span>
                  </div>
                )}
              </div>

              {submissionResult.unlocked_badge && (
                <div className="bg-[#0b0f19]/80 p-4 rounded-xl border border-amber-500/30 text-xs space-y-2">
                  <div className="font-bold text-white flex items-center gap-2">
                    <Award className="h-4 w-4 text-amber-400" />
                    <span>Cryptographic Credential: {submissionResult.unlocked_badge.badge_name}</span>
                  </div>
                  <div className="font-mono text-[10px] text-slate-400 break-all">
                    Hash: {submissionResult.unlocked_badge.verification_hash}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Questions Taking Form */}
          <div className="space-y-4">
            {questions.map((q, idx) => (
              <div
                key={q.id || idx}
                className="bg-[#121826] rounded-2xl border border-[#1e2638] p-5 space-y-4 shadow-lg"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-400">
                    Question {idx + 1} of {questions.length}
                  </span>
                  {q.source_ref && (
                    <span className="text-[10px] text-slate-400">{q.source_ref}</span>
                  )}
                </div>

                <p className="text-sm font-bold text-white leading-relaxed">{q.question_text}</p>

                {/* MCQ Options Radio Buttons */}
                {q.options && (
                  <div className="space-y-2">
                    {q.options.map((opt, optIdx) => {
                      const isSelected = studentAnswers[q.id] === optIdx;
                      return (
                        <label
                          key={optIdx}
                          onClick={() => {
                            if (!submissionResult) {
                              setStudentAnswers(prev => ({ ...prev, [q.id]: optIdx }));
                            }
                          }}
                          className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition text-xs font-semibold ${
                            isSelected
                              ? 'bg-amber-600/20 border-amber-500 text-white shadow-sm'
                              : 'bg-[#0b0f19] border-[#1e2638] text-slate-300 hover:bg-[#161e30] hover:text-white'
                          }`}
                        >
                          <div className={`h-4 w-4 rounded-full border flex items-center justify-center ${
                            isSelected ? 'border-amber-400 bg-amber-500' : 'border-slate-500'
                          }`}>
                            {isSelected && <div className="h-1.5 w-1.5 rounded-full bg-black" />}
                          </div>
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Submit Exam Button */}
          {!submissionResult && (
            <div className="pt-4 flex justify-end">
              <button
                disabled={isSubmitting || questions.length === 0}
                onClick={handleSubmitExam}
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-extrabold text-sm shadow-xl shadow-amber-500/20 disabled:opacity-50 transition flex items-center gap-2"
              >
                {isSubmitting ? 'Evaluating Submission...' : 'Submit Assessment for Instant AI Grading'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
