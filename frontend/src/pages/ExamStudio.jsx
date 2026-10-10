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
  FileCheck,
  Save,
  BookOpen,
  Check,
  RotateCcw,
  ArrowRight,
  X,
  AlertCircle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { examsAPI, coursesAPI } from '../services/api';

export default function ExamStudio({
  courseId = 1,
  user,
  onNavigateTab
}) {
  const isEducator = user?.role === 'EDUCATOR';

  // Course Selector State
  const [courses, setCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(courseId || 1);

  // Exam List & Active Exam State
  const [exams, setExams] = useState([]);
  const [selectedExamId, setSelectedExamId] = useState(null);
  const [activeExam, setActiveExam] = useState(null);
  const [loading, setLoading] = useState(true);

  // Educator Builder State
  const [isEditMode, setIsEditMode] = useState(isEducator);
  const [questions, setQuestions] = useState([]);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingAi, setLoadingAi] = useState(false);
  const [saveStatus, setSaveStatus] = useState('');

  // Create Assessment Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newExamTitle, setNewExamTitle] = useState('');
  const [newExamType, setNewExamType] = useState('MODULE_QUIZ');
  const [newTimeLimit, setNewTimeLimit] = useState(15);
  const [newPassingScore, setNewPassingScore] = useState(60);
  const [autoGenerateAI, setAutoGenerateAI] = useState(true);
  const [isCreatingExam, setIsCreatingExam] = useState(false);

  // Manual Question Addition Modal State
  const [showManualModal, setShowManualModal] = useState(false);
  const [manualText, setManualText] = useState('');
  const [manualOptions, setManualOptions] = useState(['', '', '', '']);
  const [manualCorrect, setManualCorrect] = useState('0');
  const [manualExplanation, setManualExplanation] = useState('');

  // Student Test Taking State
  const [studentAnswers, setStudentAnswers] = useState({}); // question_id -> option_index
  const [submissionResult, setSubmissionResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timeLeftSecs, setTimeLeftSecs] = useState(900);
  const [testActive, setTestActive] = useState(false);

  // 1. Fetch all available courses for dropdown
  useEffect(() => {
    async function loadCourses() {
      try {
        const list = await coursesAPI.explore();
        if (list && list.length > 0) {
          setCourses(list);
          if (!selectedCourseId) {
            setSelectedCourseId(list[0].id);
          }
        }
      } catch (e) {
        console.warn('Courses load error:', e);
      }
    }
    loadCourses();
  }, []);

  // 2. Fetch exams whenever selected course changes
  useEffect(() => {
    if (selectedCourseId) {
      fetchExams(selectedCourseId);
    }
  }, [selectedCourseId]);

  // 3. Load exam details when active exam selection changes
  useEffect(() => {
    if (selectedExamId) {
      loadExamDetails(selectedExamId);
    } else {
      setActiveExam(null);
      setQuestions([]);
    }
  }, [selectedExamId]);

  // 4. Timer countdown during student test
  useEffect(() => {
    let timer;
    if (testActive && timeLeftSecs > 0 && !submissionResult) {
      timer = setInterval(() => {
        setTimeLeftSecs((t) => {
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

  const fetchExams = async (cId) => {
    try {
      setLoading(true);
      const data = await examsAPI.listByCourse(cId);
      setExams(data || []);
      if (data && data.length > 0) {
        setSelectedExamId(data[0].id);
      } else {
        setSelectedExamId(null);
        setActiveExam(null);
        setQuestions([]);
      }
    } catch (err) {
      console.error('Failed to list exams:', err);
      setExams([]);
      setSelectedExamId(null);
    } finally {
      setLoading(false);
    }
  };

  const loadExamDetails = async (examId) => {
    try {
      const data = await examsAPI.get(examId);
      setActiveExam(data);
      setQuestions(data.questions || []);
      setTimeLeftSecs((data.time_limit_mins || 15) * 60);
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

  // Generate MCQs from RAG video concepts & notes
  const fetchAiSuggestions = async (topicTitle) => {
    try {
      setLoadingAi(true);
      const res = await examsAPI.suggestAI({
        course_id: selectedCourseId,
        module_id: activeExam?.module_id || null,
        topic: topicTitle || activeExam?.title || 'Course Concepts',
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

  // Create New Assessment Flow
  const handleCreateNewExam = async (e) => {
    e.preventDefault();
    if (!newExamTitle.trim()) return;

    try {
      setIsCreatingExam(true);
      let initialQuestions = [];

      // If auto-generate is enabled, fetch RAG questions immediately
      if (autoGenerateAI) {
        try {
          const aiRes = await examsAPI.suggestAI({
            course_id: selectedCourseId,
            module_id: null,
            topic: newExamTitle.trim(),
            count: 4,
            difficulty: 'Intermediate'
          });
          if (aiRes && aiRes.suggestions && aiRes.suggestions.length > 0) {
            initialQuestions = aiRes.suggestions.map((s, idx) => ({
              question_type: 'MCQ',
              question_text: s.question_text,
              options: s.options || ['Option A', 'Option B', 'Option C', 'Option D'],
              correct_answer: String(s.correct_answer ?? '0'),
              explanation: s.explanation || '',
              source_ref: s.source_ref || newExamTitle.trim(),
              order_index: idx + 1
            }));
          }
        } catch (aiErr) {
          console.warn('AI initial generation notice:', aiErr);
        }
      }

      // Persist to Supabase
      const created = await examsAPI.create({
        course_id: selectedCourseId,
        module_id: null,
        title: newExamTitle.trim(),
        exam_type: newExamType,
        time_limit_mins: Number(newTimeLimit || 15),
        passing_score: Number(newPassingScore || 60),
        questions: initialQuestions
      });

      setShowCreateModal(false);
      setNewExamTitle('');
      await fetchExams(selectedCourseId);

      if (created?.id) {
        setSelectedExamId(created.id);
        await loadExamDetails(created.id);
      }
    } catch (err) {
      console.error('Failed to create assessment:', err);
      alert(err.response?.data?.detail || 'Failed to create assessment.');
    } finally {
      setIsCreatingExam(false);
    }
  };

  // Add Manual Question
  const handleAddManualQuestion = (e) => {
    e.preventDefault();
    if (!manualText.trim()) return;

    const newQ = {
      id: `manual_${Date.now()}`,
      question_type: 'MCQ',
      question_text: manualText.trim(),
      options: manualOptions.map((o, i) => o.trim() || `Option ${String.fromCharCode(65 + i)}`),
      correct_answer: String(manualCorrect),
      explanation: manualExplanation.trim() || 'Author verified explanation.',
      source_ref: activeExam?.title || 'Educator Authored',
      order_index: questions.length + 1
    };

    setQuestions((prev) => [...prev, newQ]);
    setShowManualModal(false);
    setManualText('');
    setManualOptions(['', '', '', '']);
    setManualCorrect('0');
    setManualExplanation('');
  };

  // Reordering Questions
  const moveQuestion = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= questions.length) return;

    const reordered = [...questions];
    const temp = reordered[index];
    reordered[index] = reordered[targetIdx];
    reordered[targetIdx] = temp;

    const updated = reordered.map((q, idx) => ({ ...q, order_index: idx + 1 }));
    setQuestions(updated);
  };

  // Push AI suggestion into active questions
  const pushAiSuggestion = (suggestion, idx) => {
    const newQ = {
      id: `sug_${Date.now()}_${idx}`,
      question_type: 'MCQ',
      question_text: suggestion.question_text,
      options: suggestion.options || ['Option A', 'Option B', 'Option C', 'Option D'],
      correct_answer: String(suggestion.correct_answer ?? '0'),
      explanation: suggestion.explanation || '',
      source_ref: suggestion.source_ref || activeExam?.title || 'Course Material',
      order_index: questions.length + 1
    };
    setQuestions((prev) => [...prev, newQ]);
    setAiSuggestions((prev) => prev.filter((_, i) => i !== idx));
  };

  // Drop AI suggestion
  const dropAiSuggestion = (idx) => {
    setAiSuggestions((prev) => prev.filter((_, i) => i !== idx));
  };

  // Delete Question from Exam
  const deleteQuestion = (index) => {
    setQuestions((prev) => {
      const filtered = prev.filter((_, i) => i !== index);
      return filtered.map((q, idx) => ({ ...q, order_index: idx + 1 }));
    });
  };

  // Real Save / Sync Exam to Backend
  const handleSaveExam = async () => {
    if (!activeExam) return;
    try {
      setSaveStatus('Saving changes to cloud...');

      const formattedQuestions = questions.map((q, idx) => ({
        question_type: 'MCQ',
        question_text: q.question_text,
        options: Array.isArray(q.options) ? q.options : ['Option A', 'Option B', 'Option C', 'Option D'],
        correct_answer: String(q.correct_answer ?? '0'),
        explanation: q.explanation || '',
        source_ref: q.source_ref || activeExam.title,
        order_index: idx + 1
      }));

      await examsAPI.update(activeExam.id, {
        course_id: activeExam.course_id,
        module_id: activeExam.module_id,
        title: activeExam.title,
        exam_type: activeExam.exam_type || 'MODULE_QUIZ',
        time_limit_mins: Number(activeExam.time_limit_mins || 15),
        passing_score: Number(activeExam.passing_score || 60),
        questions: formattedQuestions
      });

      setSaveStatus('✅ Assessment saved successfully to cloud!');
      setTimeout(() => setSaveStatus(''), 2500);
      await loadExamDetails(activeExam.id);
    } catch (err) {
      console.error('Failed to save exam:', err);
      setSaveStatus('❌ Failed to save assessment');
      setTimeout(() => setSaveStatus(''), 3000);
    }
  };

  // Submit Exam Answers
  const handleSubmitExam = async () => {
    if (!activeExam) return;
    try {
      setIsSubmitting(true);
      const responses = Object.entries(studentAnswers).map(([qid, ansIdx]) => ({
        question_id: parseInt(qid),
        selected_option: String(ansIdx)
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
      alert('Error evaluating exam submission: ' + (err.response?.data?.detail || err.message));
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
                Assessment Studio
              </span>
              {activeExam && (
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {activeExam.exam_type || 'MODULE_QUIZ'}
                </span>
              )}
            </div>
            <h1 className="text-lg font-black text-white">{activeExam?.title || 'Course Assessments'}</h1>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-3">
          {/* Course Selector Dropdown */}
          <select
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(Number(e.target.value))}
            className="px-3 py-2 rounded-xl bg-[#121826] border border-[#1e2638] text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
            title="Select Course"
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code ? `${c.code}: ` : ''}{c.title}
              </option>
            ))}
          </select>

          {/* Exam Selector Dropdown */}
          {exams.length > 0 && (
            <select
              value={selectedExamId || ''}
              onChange={(e) => setSelectedExamId(Number(e.target.value))}
              className="px-3 py-2 rounded-xl bg-[#121826] border border-[#1e2638] text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-500 cursor-pointer"
              title="Select Assessment"
            >
              {exams.map((ex) => (
                <option key={ex.id} value={ex.id}>
                  {ex.title} ({ex.questions?.length || 0} Qs)
                </option>
              ))}
            </select>
          )}

          {/* Educator: + Create New Assessment Button */}
          {isEducator && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:opacity-90 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-amber-500/20"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Create Assessment</span>
            </button>
          )}

          {/* Mode Switcher */}
          {activeExam && (
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
              <span>{isEditMode ? 'Test-Taking Mode' : 'Builder Mode'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Content Area */}
      {exams.length === 0 ? (
        /* Empty State */
        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <ClipboardCheck className="h-8 w-8" />
          </div>
          <div className="max-w-md space-y-1">
            <h3 className="text-lg font-bold text-white">No Assessments Created Yet</h3>
            <p className="text-xs text-slate-400">
              {isEducator
                ? 'Create a custom assessment or let AI generate multiple choice questions grounded in your course videos and lecture notes.'
                : 'No published assessments for this course yet. Check back soon!'}
            </p>
          </div>
          {isEducator && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-2.5 rounded-2xl bg-gradient-to-r from-amber-500 to-rose-600 hover:opacity-90 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-amber-500/30"
            >
              <Plus className="h-4 w-4" />
              <span>Create First Assessment (with AI MCQs)</span>
            </button>
          )}
        </div>
      ) : isEditMode ? (
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
                  Multiple-choice questions grounded in curriculum concepts. Reorder, edit, or sync with cloud.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {saveStatus && (
                  <span className="text-xs font-bold text-emerald-400 animate-fade-in">{saveStatus}</span>
                )}
                <button
                  type="button"
                  onClick={() => setShowManualModal(true)}
                  className="px-3 py-1.5 rounded-lg bg-[#161e30] hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition border border-[#232b3d]"
                >
                  <Plus className="h-3.5 w-3.5 text-cyan-400" />
                  <span>Add Question</span>
                </button>
                <button
                  type="button"
                  onClick={handleSaveExam}
                  className="px-3.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-sm"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>Save Assessment</span>
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
                        MCQ
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
                  <p className="text-[10px] text-slate-400">Grounded in Video Lectures</p>
                </div>
              </div>

              <button
                onClick={() => fetchAiSuggestions(activeExam?.title)}
                disabled={loadingAi}
                className="px-2.5 py-1.5 rounded-lg bg-[#161e30] hover:bg-slate-700 text-slate-300 hover:text-white transition border border-[#232b3d] disabled:opacity-40 text-xs font-semibold flex items-center gap-1.5"
                title="Generate Fresh MCQs"
              >
                <RefreshCw className={`h-3 w-3 ${loadingAi ? 'animate-spin text-purple-400' : ''}`} />
                <span>Generate</span>
              </button>
            </div>

            {loadingAi ? (
              <div className="flex-1 flex flex-col items-center justify-center p-8 gap-2 text-slate-400">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                <span className="text-xs font-semibold">Synthesizing lecture concepts...</span>
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
                        {item.bloom_level || 'MCQ'}
                      </span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => pushAiSuggestion(item, idx)}
                          className="px-2 py-1 rounded bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-extrabold flex items-center gap-1 transition shadow-sm"
                          title="Add to Exam"
                        >
                          <Plus className="h-3 w-3" />
                          <span>Add</span>
                        </button>
                        <button
                          onClick={() => dropAiSuggestion(idx)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition text-[10px]"
                          title="Dismiss"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs font-bold text-white leading-relaxed">{item.question_text}</p>

                    <div className="text-[10px] text-slate-400">
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
                    Click <strong>Generate</strong> to extract MCQs from course video concepts and notes.
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
                      const isSelected = studentAnswers[q.id] === String(optIdx);
                      return (
                        <label
                          key={optIdx}
                          onClick={() => {
                            if (!submissionResult) {
                              setStudentAnswers((prev) => ({ ...prev, [q.id]: String(optIdx) }));
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
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:from-amber-400 hover:to-rose-500 text-white font-extrabold text-sm shadow-xl shadow-amber-500/20 disabled:opacity-50 transition flex items-center gap-2 cursor-pointer"
              >
                {isSubmitting ? 'Evaluating Submission...' : 'Submit Assessment for Instant AI Grading'}
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal: Create Assessment */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#131927] border border-[#1e2638] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e2638] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-400" />
                <span>Create New Assessment</span>
              </h3>
              <button onClick={() => setShowCreateModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewExam} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Assessment Title</label>
                <input
                  type="text"
                  required
                  value={newExamTitle}
                  onChange={(e) => setNewExamTitle(e.target.value)}
                  placeholder="e.g. Mid-Term Mastery Assessment"
                  className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Scope</label>
                  <select
                    value={newExamType}
                    onChange={(e) => setNewExamType(e.target.value)}
                    className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  >
                    <option value="MODULE_QUIZ">Module Quiz</option>
                    <option value="FINAL_EXAM">Final Exam</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Time Limit (mins)</label>
                  <input
                    type="number"
                    min="5"
                    max="180"
                    value={newTimeLimit}
                    onChange={(e) => setNewTimeLimit(Number(e.target.value))}
                    className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Passing Threshold (%)</label>
                <input
                  type="number"
                  min="30"
                  max="100"
                  value={newPassingScore}
                  onChange={(e) => setNewPassingScore(Number(e.target.value))}
                  className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-amber-500"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer p-3 rounded-xl bg-purple-500/10 border border-purple-500/30 text-xs">
                <input
                  type="checkbox"
                  checked={autoGenerateAI}
                  onChange={(e) => setAutoGenerateAI(e.target.checked)}
                  className="rounded text-purple-600 focus:ring-purple-500"
                />
                <span className="text-purple-200 font-semibold">
                  Auto-generate 4 MCQs from course video concepts using RAG
                </span>
              </label>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e2638]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingExam || !newExamTitle.trim()}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-rose-600 hover:opacity-90 disabled:opacity-40 text-white font-bold text-xs"
                >
                  {isCreatingExam ? 'Creating & Generating...' : 'Create Assessment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Manual Question */}
      {showManualModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-[#131927] border border-[#1e2638] rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#1e2638] pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-cyan-400" />
                <span>Add Question to Assessment</span>
              </h3>
              <button onClick={() => setShowManualModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleAddManualQuestion} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Question Prompt</label>
                <textarea
                  rows={2}
                  required
                  value={manualText}
                  onChange={(e) => setManualText(e.target.value)}
                  placeholder="e.g. What is the time complexity of searching in a balanced BST?"
                  className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>

              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">Options (Select radio for correct answer)</label>
                {manualOptions.map((opt, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="correctOption"
                      checked={manualCorrect === String(i)}
                      onChange={() => setManualCorrect(String(i))}
                      className="text-emerald-500 focus:ring-emerald-400"
                    />
                    <input
                      type="text"
                      required
                      value={opt}
                      onChange={(e) => {
                        const val = e.target.value;
                        setManualOptions((prev) => prev.map((o, idx) => (idx === i ? val : o)));
                      }}
                      placeholder={`Option ${String.fromCharCode(65 + i)}`}
                      className="flex-1 bg-[#0b0f19] border border-[#1e2638] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Explanation (Optional)</label>
                <input
                  type="text"
                  value={manualExplanation}
                  onChange={(e) => setManualExplanation(e.target.value)}
                  placeholder="Why is this option correct?"
                  className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#1e2638]">
                <button
                  type="button"
                  onClick={() => setShowManualModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!manualText.trim()}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs"
                >
                  Add Question
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
