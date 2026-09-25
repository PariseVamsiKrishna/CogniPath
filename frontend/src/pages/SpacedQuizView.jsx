import React, { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Calendar,
  Zap,
  TrendingUp,
  RotateCcw,
  Sparkles,
  HelpCircle,
  Award,
  ChevronRight,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { quizzesAPI } from '../services/api';

export default function SpacedQuizView({ courseId }) {
  const [dueItems, setDueItems] = useState([
    {
      id: 1,
      concept_tag: 'Binary Search Trees',
      repetition_interval: 1,
      difficulty_factor: 2.1,
      repetitions: 1,
      next_review_date: new Date().toISOString(),
      is_due: true
    },
    {
      id: 2,
      concept_tag: 'Attention Mechanism',
      repetition_interval: 6,
      difficulty_factor: 2.5,
      repetitions: 2,
      next_review_date: new Date(Date.now() + 86400000 * 5).toISOString(),
      is_due: false
    }
  ]);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submissionResult, setSubmissionResult] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchDueItems();
  }, [courseId]);

  const fetchDueItems = async () => {
    try {
      const data = await quizzesAPI.getDue(courseId || 1);
      if (data && data.length > 0) {
        setDueItems(data);
      }
    } catch (err) {
      console.error('Failed to load due concepts:', err);
    }
  };

  const startQuiz = async (topic) => {
    setLoading(true);
    setSubmissionResult(null);
    setAnswers({});
    try {
      const quizData = await quizzesAPI.generate(courseId || 1, topic);
      setActiveQuiz(quizData);
    } catch (err) {
      // Fallback sample quiz if offline
      setActiveQuiz({
        id: 99,
        course_id: courseId || 1,
        topic: topic,
        title: `Spaced Retention Check: ${topic}`,
        difficulty_level: 'Adaptive',
        questions: [
          {
            id: 101,
            question_text: "Which traversal of a Binary Search Tree (BST) produces values in strictly sorted ascending order?",
            options: ["In-order traversal (Left, Root, Right)", "Pre-order traversal (Root, Left, Right)", "Post-order traversal", "Level-order traversal"],
            correct_option_index: 0,
            explanation: "In-order traversal visits elements in ascending key order due to BST subtree ordering properties.",
            source_chunk_ref: "CS101_Lecture_04_Trees_and_BST.pdf, Page 3"
          },
          {
            id: 102,
            question_text: "Under which condition does a Binary Search Tree degrade to worst-case O(N) lookup time?",
            options: ["Balanced AVL rotations applied", "Sequential insertion without balancing causing a linear chain", "Root node deletion with two children", "Multiple concurrent reads"],
            correct_option_index: 1,
            explanation: "When nodes are inserted in already sorted order without self-balancing, the tree degenerates into a singly-linked list with O(N) search.",
            source_chunk_ref: "CS101_Lecture_04_Trees_and_BST.pdf, Page 2"
          }
        ]
      });
    } finally {
      setLoading(false);
    }
  };

  const selectAnswer = (questionId, optionIndex) => {
    setAnswers((prev) => ({
      ...prev,
      [questionId]: optionIndex
    }));
  };

  const handleSubmit = async () => {
    if (!activeQuiz) return;
    setLoading(true);
    try {
      const res = await quizzesAPI.submit(activeQuiz.id, answers);
      setSubmissionResult(res);
      if (res.passed) {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });
      }
      fetchDueItems();
    } catch (err) {
      // Standalone simulation fallback
      const totalQ = activeQuiz.questions.length;
      let correct = 0;
      activeQuiz.questions.forEach((q) => {
        if (answers[q.id] === q.correct_option_index) correct++;
      });
      const pct = Math.round((correct / totalQ) * 100);
      setSubmissionResult({
        score: correct,
        total_questions: totalQ,
        percentage: pct,
        passed: pct >= 60,
        new_interval_days: pct >= 60 ? 6 : 1,
        next_review_date: new Date(Date.now() + (pct >= 60 ? 6 : 1) * 86400000).toISOString(),
        feedback: pct >= 60
          ? "Concept mastered! SuperMemo SM-2 interval scheduled in 6 days."
          : "Needs reinforcement. SM-2 interval reset to 1 day."
      });
      if (pct >= 60) {
        confetti({ particleCount: 70, spread: 60 });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-6xl mx-auto space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
            <Zap className="h-4 w-4 text-amber-400" />
            <span>SuperMemo SM-2 Memory Retention Engine</span>
          </div>
          <h2 className="text-2xl font-black text-white">Adaptive Spaced-Repetition Quizzes</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1 max-w-2xl leading-relaxed">
            COGNIPATH analyzes your doubt questions and quiz mistakes to schedule micro-checks at the exact moment of forgetting, mathematically maximizing long-term memory.
          </p>
        </div>
        <button
          onClick={() => startQuiz('Binary Search Trees')}
          disabled={loading}
          className="px-5 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 hover:from-indigo-500 hover:to-cyan-500 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition shrink-0"
        >
          {loading ? 'Generating...' : 'Start Due Quiz Now'}
        </button>
      </div>

      {/* Concept Retention Cards Grid */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-cyan-400" />
            <span>Your Concept Retention Memory Schedule</span>
          </h3>
          <span className="text-xs text-slate-500 font-medium">Auto-updated via SM-2 Algorithm</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {dueItems.map((item) => {
            const isDue = item.is_due;
            return (
              <div
                key={item.id}
                className={`p-5 rounded-2xl border transition-all ${
                  isDue
                    ? 'bg-gradient-to-b from-amber-500/10 to-slate-900 border-amber-500/30 shadow-lg shadow-amber-500/5'
                    : 'bg-slate-900/60 border-slate-800'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-bold text-white text-base">{item.concept_tag}</h4>
                    <span className="text-[11px] text-slate-400">
                      Repetition Stage: #{item.repetitions}
                    </span>
                  </div>
                  {isDue ? (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 animate-pulse">
                      Review Due
                    </span>
                  ) : (
                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                      In {item.repetition_interval} Days
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs py-2 border-y border-slate-800/80 my-3">
                  <div>
                    <span className="text-slate-500 block text-[10px]">SM-2 Factor (EF)</span>
                    <strong className="text-indigo-300">{item.difficulty_factor.toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Current Interval</span>
                    <strong className="text-cyan-300">{item.repetition_interval} Day(s)</strong>
                  </div>
                </div>

                <button
                  onClick={() => startQuiz(item.concept_tag)}
                  className={`w-full py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    isDue
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-200'
                  }`}
                >
                  <span>{isDue ? 'Take Spaced Quiz' : 'Early Practice'}</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active Quiz Card */}
      {activeQuiz && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800 gap-2">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">
                {activeQuiz.topic}
              </span>
              <h3 className="text-xl font-extrabold text-white">{activeQuiz.title}</h3>
            </div>
            <span className="px-3 py-1 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 self-start sm:self-auto">
              {activeQuiz.questions.length} Questions
            </span>
          </div>

          {/* Question List */}
          <div className="space-y-6">
            {activeQuiz.questions.map((q, idx) => (
              <div key={q.id} className="p-5 rounded-xl bg-slate-950/80 border border-slate-800/80 space-y-3">
                <div className="flex items-start gap-3">
                  <span className="h-6 w-6 rounded-lg bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                    {idx + 1}
                  </span>
                  <p className="text-sm font-semibold text-white leading-relaxed">{q.question_text}</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 pl-9">
                  {q.options.map((opt, optIdx) => {
                    const isSelected = answers[q.id] === optIdx;
                    return (
                      <button
                        key={optIdx}
                        type="button"
                        onClick={() => selectAnswer(q.id, optIdx)}
                        className={`text-left p-3 rounded-xl text-xs font-medium border transition-all ${
                          isSelected
                            ? 'bg-indigo-600/20 border-indigo-500 text-white shadow-md'
                            : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:bg-slate-850 hover:border-slate-700'
                        }`}
                      >
                        <span className="font-bold mr-2 text-indigo-400">
                          {String.fromCharCode(65 + optIdx)}.
                        </span>
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {/* Explanation on submission */}
                {submissionResult && (
                  <div className="mt-3 p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-cyan-400">
                      <HelpCircle className="h-3.5 w-3.5" />
                      <span>Curriculum Explanation & Source Reference:</span>
                    </div>
                    <p className="text-slate-300">{q.explanation}</p>
                    {q.source_chunk_ref && (
                      <p className="text-[11px] text-slate-500 font-mono">
                        Source: {q.source_chunk_ref}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Submission Action or Results */}
          {!submissionResult ? (
            <div className="flex justify-end pt-4">
              <button
                onClick={handleSubmit}
                disabled={loading || Object.keys(answers).length < activeQuiz.questions.length}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 disabled:opacity-40 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-600/30 transition flex items-center gap-2"
              >
                <span>{loading ? 'Grading...' : 'Submit & Compute SM-2 Update'}</span>
                <CheckCircle2 className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-950 via-indigo-950/50 to-slate-950 border border-indigo-500/30 space-y-3">
              <div className="flex items-center gap-3">
                <Award className="h-7 w-7 text-amber-400" />
                <div>
                  <h4 className="text-base font-extrabold text-white">
                    Score: {submissionResult.score} / {submissionResult.total_questions} ({submissionResult.percentage}%)
                  </h4>
                  <p className="text-xs text-indigo-300 font-medium">{submissionResult.feedback}</p>
                </div>
              </div>
              <div className="text-xs text-slate-400 flex items-center gap-2 pt-2 border-t border-slate-800">
                <Calendar className="h-4 w-4 text-cyan-400" />
                <span>
                  Next Scheduled SM-2 Micro-Review: <strong className="text-white">{new Date(submissionResult.next_review_date).toLocaleDateString()}</strong> (Interval: {submissionResult.new_interval_days} day(s))
                </span>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
