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
  ChevronLeft,
  AlertTriangle,
  Layers,
  BookOpen,
  Check,
  X,
  Target,
  FileText
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { quizzesAPI } from '../services/api';

// Curated high-yield flashcard decks per subject
const COURSE_FLASHCARDS = {
  // Course 1: DSA
  dsa: [
    {
      id: 'f1',
      front: 'What is the time complexity of Binary Search Tree search in the average vs. worst case?',
      back: 'Average Case: O(log N) when balanced.\nWorst Case: O(N) when degenerate (unbalanced linear chain).',
      formula: 'T(N) = O(log N) [Balanced] | T(N) = O(N) [Degenerate]',
      citation: 'CS101_Lecture_04_Trees_and_BST.pdf, Page 2'
    },
    {
      id: 'f2',
      front: 'Why does an In-order traversal of a valid BST produce ascending sorted order?',
      back: 'By BST invariant, all nodes in the left subtree are smaller than root, and all nodes in the right subtree are larger. Recursively visiting (Left -> Root -> Right) guarantees non-decreasing order.',
      formula: 'Order: L < Root < R',
      citation: 'CS101_Lecture_04_Trees_and_BST.pdf, Page 3'
    },
    {
      id: 'f3',
      front: 'What balance condition must hold for every node in an AVL Tree?',
      back: 'For every node, the height difference (balance factor) between left and right subtrees must be in {-1, 0, +1}.',
      formula: 'Balance Factor = height(Left) - height(Right) in {-1, 0, 1}',
      citation: 'CS101_Lecture_05_AVL_Rotations.pdf, Page 1'
    }
  ],
  // Course 2: DBMS
  dbms: [
    {
      id: 'f4',
      front: 'What are the ACID properties in relational database transaction management?',
      back: 'Atomicity (All or nothing), Consistency (Preserves database integrity constraints), Isolation (Concurrent transactions do not interfere), Durability (Committed updates persist permanently).',
      formula: 'ACID Guarantee: WAL (Write-Ahead Logging) + 2PL (Two-Phase Locking)',
      citation: 'DBMS_Module_04_Transactions_and_ACID.pdf, Page 2'
    },
    {
      id: 'f5',
      front: 'What condition defines Third Normal Form (3NF)?',
      back: 'A relation is in 3NF if it is in 2NF and has no transitive dependencies for non-prime attributes: X -> Y requires X to be a superkey or Y to be a prime attribute.',
      formula: '3NF: Eliminates Transitive Dependency (X -> Y)',
      citation: 'DBMS_Module_03_Normalization.pdf, Page 4'
    }
  ],
  // Course 3: Web Dev
  web: [
    {
      id: 'f6',
      front: 'In the JavaScript Event Loop, how are microtasks prioritized over macrotasks?',
      back: 'The event loop completely empties the entire microtask queue (Promise callbacks, queueMicrotask) before picking the next single macrotask (setTimeout, setInterval).',
      formula: 'Precedence: Synchronous Call Stack -> All Microtasks -> 1 Macrotask',
      citation: 'WebDev_Lecture_02_EventLoop.pdf, Page 1'
    },
    {
      id: 'f7',
      front: 'What makes an HTTP method idempotent in REST API design?',
      back: 'Making multiple identical requests has the same intended effect on the server state as a single request (e.g., GET, PUT, DELETE are idempotent; POST is not).',
      formula: 'f(f(x)) = f(x) for GET, PUT, DELETE',
      citation: 'WebDev_Lecture_06_REST_APIs.pdf, Page 3'
    }
  ],
  default: [
    {
      id: 'f8',
      front: 'What is the primary pedagogical benefit of Spaced Repetition (SM-2)?',
      back: 'It schedules concept reviews at increasing intervals right before the forgetting curve threshold, maximizing long-term synaptic retention.',
      formula: 'I(n) = I(n-1) * EF',
      citation: 'CogniPath_Learning_Science_Standard.pdf'
    }
  ]
};

// Key Syllabus Invariants summary per course
const COURSE_SYLLABUS_POINTS = {
  dsa: [
    { title: 'BST Invariant', point: 'Left subtree keys < Root < Right subtree keys. In-order traversal produces sorted keys in O(N) time.' },
    { title: 'AVL Balance Factor', point: 'Height difference must stay in {-1, 0, 1}. Single rotations (LL, RR) or double rotations (LR, RL) restore balance in O(1).' },
    { title: 'Heap Property', point: 'Max-Heap: parent >= children; Min-Heap: parent <= children. Priority queue insertions and extractions operate in O(log N).' },
    { title: 'Master Theorem', point: 'T(N) = aT(N/b) + O(N^d). Compares log_b(a) with d to determine complexity bound.' }
  ],
  dbms: [
    { title: 'ACID Guarantees', point: 'Atomicity, Consistency, Isolation, Durability ensure zero data corruption during system crashes.' },
    { title: '3NF Normalization', point: 'Every non-trivial functional dependency X -> Y must have X as superkey or Y as prime attribute.' },
    { title: 'B+ Tree Indexing', point: 'All data records stored at leaf nodes with linked pointers for fast range queries in O(log N).' }
  ],
  web: [
    { title: 'Event Loop Precedence', point: 'Call Stack -> Microtasks Queue (Promises) -> Render -> Macrotask Queue (setTimeout).' },
    { title: 'HTTP Idempotency', point: 'GET, PUT, DELETE produce identical side effects regardless of repeated calls; POST does not.' },
    { title: 'Virtual DOM Diffing', point: 'Heuristic O(N) reconciliation algorithm compares keys and element types to minimize layout reflows.' }
  ],
  default: [
    { title: 'Active Recall', point: 'Testing yourself with feedback produces significantly stronger memory consolidation than passive review.' },
    { title: 'SM-2 Retention', point: 'Review intervals expand by Ease Factor (EF) on successful recall.' }
  ]
};

export default function SpacedQuizView({
  courseId,
  courses = [],
  enrolledCourses = [],
  onSelectCourse,
  defaultMode = 'flashcards'
}) {
  const availableCourses = enrolledCourses.length > 0 ? enrolledCourses : courses;
  const activeCourse = availableCourses.find((c) => c.id === courseId) || availableCourses[0] || {
    id: 1,
    title: 'Data Structures and Algorithms',
    code: 'CS101'
  };

  const getCourseCategoryKey = () => {
    const text = `${activeCourse.title || ''} ${activeCourse.code || ''}`.toLowerCase();
    if (text.includes('database') || text.includes('dbms') || text.includes('sql')) return 'dbms';
    if (text.includes('web') || text.includes('html') || text.includes('react')) return 'web';
    if (text.includes('data') || text.includes('algo') || text.includes('cs101')) return 'dsa';
    return 'default';
  };

  const categoryKey = getCourseCategoryKey();
  const currentDeck = COURSE_FLASHCARDS[categoryKey] || COURSE_FLASHCARDS.default;
  const currentKeyPoints = COURSE_SYLLABUS_POINTS[categoryKey] || COURSE_SYLLABUS_POINTS.default;

  // View mode: 'flashcards', 'quiz', 'points'
  const [viewMode, setViewMode] = useState(defaultMode);

  // Flashcard State
  const [cardIndex, setCardIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [reviewedCards, setReviewedCards] = useState({});

  useEffect(() => {
    setCardIndex(0);
    setIsFlipped(false);
  }, [activeCourse.id]);

  const activeCard = currentDeck[cardIndex] || currentDeck[0];

  const handleNextCard = () => {
    setIsFlipped(false);
    setCardIndex((prev) => (prev + 1) % currentDeck.length);
  };

  const handlePrevCard = () => {
    setIsFlipped(false);
    setCardIndex((prev) => (prev - 1 + currentDeck.length) % currentDeck.length);
  };

  const handleSM2Rating = (ratingScore) => {
    setReviewedCards((prev) => ({
      ...prev,
      [activeCard.id]: ratingScore
    }));
    handleNextCard();
  };

  // Spaced Repetition Quiz State
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [answers, setAnswers] = useState({});
  const [submissionResult, setSubmissionResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const startQuiz = async (topic) => {
    setLoading(true);
    setSubmissionResult(null);
    setAnswers({});
    try {
      const quizData = await quizzesAPI.generate(activeCourse.id || 1, topic);
      setActiveQuiz(quizData);
    } catch (err) {
      // Fallback sample quiz
      setActiveQuiz({
        id: 99,
        course_id: activeCourse.id || 1,
        topic: topic,
        title: `Retention Check: ${activeCourse.title}`,
        difficulty_level: 'Adaptive',
        questions: [
          {
            id: 101,
            question_text: "Which traversal of a Binary Search Tree (BST) produces values in strictly sorted ascending order?",
            options: [
              "In-order traversal (Left, Root, Right)",
              "Pre-order traversal (Root, Left, Right)",
              "Post-order traversal",
              "Level-order traversal"
            ],
            correct_option_index: 0,
            explanation: "In-order traversal visits elements in ascending key order due to BST subtree ordering invariants.",
            source_chunk_ref: "CS101_Lecture_04_Trees_and_BST.pdf, Page 3"
          },
          {
            id: 102,
            question_text: "Under which condition does a Binary Search Tree degrade to worst-case O(N) lookup time?",
            options: [
              "Balanced AVL rotations applied",
              "Sequential insertion without balancing causing a linear chain",
              "Root node deletion with two children",
              "Multiple concurrent reads"
            ],
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

  const handleSubmitQuiz = async () => {
    if (!activeQuiz) return;
    setLoading(true);
    try {
      const res = await quizzesAPI.submit(activeQuiz.id, answers);
      setSubmissionResult(res);
      if (res.passed) {
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
      }
    } catch (err) {
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
        feedback: pct >= 60
          ? "Concept mastered! SuperMemo SM-2 interval scheduled in 6 days."
          : "Needs reinforcement. SM-2 interval scheduled in 1 day."
      });
      if (pct >= 60) {
        confetti({ particleCount: 70, spread: 60 });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl mx-auto space-y-6 text-[#ECEDF7]">
      {/* Top Banner with Course Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[#12162B] border border-[#262C4C] p-5 sm:p-6 rounded-2xl shadow-xl">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[#8B7CFF] font-bold text-xs uppercase tracking-wider">
            <Zap className="h-4 w-4 text-[#FFC15E]" />
            <span>SuperMemo SM-2 Spaced Retention Studio</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-[#ECEDF7]">
            Flashcards &amp; Syllabus Memory Engine
          </h2>
          <p className="text-xs text-[#8A90B4] max-w-xl">
            Active recall cards and spaced repetition quizzes tailored to your enrolled courses.
          </p>
        </div>

        {/* Course Selector Dropdown */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
          <div className="space-y-1">
            <label className="text-[10px] font-bold uppercase tracking-wider text-[#8A90B4] block">
              Active Course:
            </label>
            {availableCourses.length > 0 ? (
              <select
                value={activeCourse.id}
                onChange={(e) => onSelectCourse && onSelectCourse(Number(e.target.value))}
                className="bg-[#171C36] text-xs font-bold text-[#ECEDF7] border border-[#262C4C] rounded-xl px-3 py-2 focus:outline-none focus:border-[#8B7CFF] cursor-pointer"
              >
                {availableCourses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code ? `${c.code}: ` : ''}{c.title}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-xs font-bold text-white">{activeCourse.title}</span>
            )}
          </div>
        </div>
      </div>

      {/* View Mode Switcher Pills */}
      <div className="flex items-center gap-2 border-b border-[#262C4C] pb-3">
        <button
          type="button"
          onClick={() => setViewMode('flashcards')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            viewMode === 'flashcards'
              ? 'bg-[#8B7CFF] text-[#0A0D1C] shadow-md shadow-[#8B7CFF]/20'
              : 'bg-[#12162B] text-[#8A90B4] hover:text-[#ECEDF7] border border-[#262C4C]'
          }`}
        >
          <Layers className="h-4 w-4" />
          <span>Interactive Flashcards ({currentDeck.length})</span>
        </button>

        <button
          type="button"
          onClick={() => {
            setViewMode('quiz');
            if (!activeQuiz) startQuiz(activeCourse.title);
          }}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            viewMode === 'quiz'
              ? 'bg-[#FFC15E] text-[#0A0D1C] shadow-md shadow-[#FFC15E]/20'
              : 'bg-[#12162B] text-[#8A90B4] hover:text-[#ECEDF7] border border-[#262C4C]'
          }`}
        >
          <Target className="h-4 w-4" />
          <span>Adaptive Quiz Check</span>
        </button>

        <button
          type="button"
          onClick={() => setViewMode('points')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition ${
            viewMode === 'points'
              ? 'bg-[#5FE3B0] text-[#0A0D1C] shadow-md shadow-[#5FE3B0]/20'
              : 'bg-[#12162B] text-[#8A90B4] hover:text-[#ECEDF7] border border-[#262C4C]'
          }`}
        >
          <FileText className="h-4 w-4" />
          <span>Syllabus Key Invariants</span>
        </button>
      </div>

      {/* ===================================================================== */}
      {/* VIEW 1: INTERACTIVE 3D FLASHCARDS WITH SM-2 RATING                   */}
      {/* ===================================================================== */}
      {viewMode === 'flashcards' && (
        <div className="space-y-6">
          {/* Card Carousel Header */}
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#8A90B4]">
              Card {cardIndex + 1} of {currentDeck.length}
            </span>
            <span className="text-xs text-[#8A90B4]">
              Click card or press flip to reveal invariant
            </span>
          </div>

          {/* Flashcard 3D Card */}
          <div
            onClick={() => setIsFlipped(!isFlipped)}
            className="w-full min-h-[260px] sm:min-h-[300px] rounded-3xl bg-[#12162B] hover:bg-[#171C36] border border-[#262C4C] p-8 sm:p-10 flex flex-col justify-between cursor-pointer transition-all duration-300 shadow-2xl relative group select-none"
            style={{
              boxShadow: '0 20px 40px -15px rgba(139, 124, 255, 0.15)'
            }}
          >
            {/* Top Indicator */}
            <div className="flex items-center justify-between text-xs">
              <span className="font-extrabold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[#8B7CFF]/15 text-[#8B7CFF] border border-[#8B7CFF]/30">
                {isFlipped ? 'Answer & Invariant' : 'Question / Concept'}
              </span>
              <span className="text-[#8A90B4] text-[11px] group-hover:text-[#ECEDF7] transition">
                {isFlipped ? 'Tap to see Question 🔄' : 'Tap to Flip 🔄'}
              </span>
            </div>

            {/* Middle Content */}
            <div className="py-6 text-center space-y-4">
              <h3 className="font-heading text-lg sm:text-2xl font-bold text-[#ECEDF7] leading-relaxed max-w-2xl mx-auto">
                {isFlipped ? activeCard.back : activeCard.front}
              </h3>

              {isFlipped && activeCard.formula && (
                <div className="p-3 rounded-xl bg-[#0A0D1C] border border-[#262C4C] font-mono text-xs sm:text-sm text-[#5FE3B0] max-w-lg mx-auto">
                  {activeCard.formula}
                </div>
              )}
            </div>

            {/* Bottom Citation */}
            <div className="flex items-center justify-between text-[11px] text-[#8A90B4] pt-4 border-t border-[#262C4C]/60">
              <span className="truncate">Source: {activeCard.citation}</span>
              <span className="font-semibold text-[#8B7CFF]">CogniPath Grounded</span>
            </div>
          </div>

          {/* SM-2 Interval Grading Buttons */}
          <div className="space-y-3">
            <span className="text-[11px] uppercase font-bold text-[#8A90B4] block text-center">
              Rate your recall (SuperMemo SM-2 Interval Calculation):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 max-w-2xl mx-auto">
              <button
                type="button"
                onClick={() => handleSM2Rating('again')}
                className="p-3 rounded-xl bg-red-950/30 hover:bg-red-900/50 border border-red-500/30 text-red-300 text-xs font-bold transition flex flex-col items-center"
              >
                <span>Again</span>
                <span className="text-[10px] text-red-400/80 font-normal mt-0.5">&lt; 1 min</span>
              </button>

              <button
                type="button"
                onClick={() => handleSM2Rating('hard')}
                className="p-3 rounded-xl bg-amber-950/30 hover:bg-amber-900/50 border border-amber-500/30 text-amber-300 text-xs font-bold transition flex flex-col items-center"
              >
                <span>Hard</span>
                <span className="text-[10px] text-amber-400/80 font-normal mt-0.5">1 day</span>
              </button>

              <button
                type="button"
                onClick={() => handleSM2Rating('good')}
                className="p-3 rounded-xl bg-emerald-950/30 hover:bg-emerald-900/50 border border-emerald-500/30 text-emerald-300 text-xs font-bold transition flex flex-col items-center"
              >
                <span>Good</span>
                <span className="text-[10px] text-emerald-400/80 font-normal mt-0.5">3 days</span>
              </button>

              <button
                type="button"
                onClick={() => handleSM2Rating('easy')}
                className="p-3 rounded-xl bg-blue-950/30 hover:bg-blue-900/50 border border-blue-500/30 text-blue-300 text-xs font-bold transition flex flex-col items-center"
              >
                <span>Easy</span>
                <span className="text-[10px] text-blue-400/80 font-normal mt-0.5">7 days</span>
              </button>
            </div>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handlePrevCard}
              className="px-4 py-2 rounded-xl bg-[#12162B] hover:bg-[#171C36] border border-[#262C4C] text-xs font-bold text-[#ECEDF7] transition flex items-center gap-1.5"
            >
              <ChevronLeft className="h-4 w-4" />
              <span>Previous</span>
            </button>

            <button
              type="button"
              onClick={() => setIsFlipped(!isFlipped)}
              className="px-4 py-2 rounded-xl bg-[#171C36] hover:bg-[#202747] border border-[#262C4C] text-xs font-bold text-[#8B7CFF] transition"
            >
              Flip Card
            </button>

            <button
              type="button"
              onClick={handleNextCard}
              className="px-4 py-2 rounded-xl bg-[#12162B] hover:bg-[#171C36] border border-[#262C4C] text-xs font-bold text-[#ECEDF7] transition flex items-center gap-1.5"
            >
              <span>Next</span>
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 2: ADAPTIVE RETENTION QUIZ CHECK                                 */}
      {/* ===================================================================== */}
      {viewMode === 'quiz' && (
        <div className="space-y-6">
          {activeQuiz ? (
            <div className="bg-[#12162B] border border-[#262C4C] rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#262C4C]">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#FFC15E]">
                    {activeQuiz.topic}
                  </span>
                  <h3 className="text-lg sm:text-xl font-bold text-[#ECEDF7]">{activeQuiz.title}</h3>
                </div>
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-[#FFC15E]/15 text-[#FFC15E] border border-[#FFC15E]/30">
                  {activeQuiz.questions.length} Questions
                </span>
              </div>

              {/* Questions List */}
              <div className="space-y-6">
                {activeQuiz.questions.map((q, idx) => (
                  <div key={q.id} className="p-4 sm:p-5 rounded-2xl bg-[#171C36] border border-[#262C4C] space-y-3">
                    <p className="font-semibold text-xs sm:text-sm text-[#ECEDF7] leading-relaxed">
                      {idx + 1}. {q.question_text}
                    </p>

                    <div className="space-y-2">
                      {q.options.map((opt, oIdx) => {
                        const isSelected = answers[q.id] === oIdx;
                        return (
                          <button
                            key={oIdx}
                            type="button"
                            onClick={() => selectAnswer(q.id, oIdx)}
                            className={`w-full text-left p-3 rounded-xl text-xs font-medium border transition flex items-center justify-between ${
                              isSelected
                                ? 'bg-[#8B7CFF]/20 border-[#8B7CFF] text-[#ECEDF7]'
                                : 'bg-[#12162B] border-[#262C4C] text-[#8A90B4] hover:bg-[#1a203f]'
                            }`}
                          >
                            <span>{String.fromCharCode(65 + oIdx)}. {opt}</span>
                            {isSelected && <Check className="h-4 w-4 text-[#8B7CFF]" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              {/* Result Banner if submitted */}
              {submissionResult && (
                <div className={`p-4 rounded-xl border text-xs leading-relaxed ${
                  submissionResult.passed
                    ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300'
                    : 'bg-amber-950/40 border-amber-500/40 text-amber-300'
                }`}>
                  <strong className="block text-sm mb-1">
                    Score: {submissionResult.score} / {submissionResult.total_questions} ({submissionResult.percentage}%)
                  </strong>
                  {submissionResult.feedback}
                </div>
              )}

              {/* Submit CTA */}
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={handleSubmitQuiz}
                  disabled={loading || Object.keys(answers).length < activeQuiz.questions.length}
                  className="px-6 py-2.5 rounded-xl bg-[#FFC15E] hover:bg-[#ffd082] text-[#0A0D1C] font-bold text-xs shadow-md transition disabled:opacity-50"
                >
                  {loading ? 'Evaluating...' : 'Submit Answers'}
                </button>
              </div>
            </div>
          ) : (
            <div className="p-8 text-center bg-[#12162B] border border-[#262C4C] rounded-2xl space-y-3">
              <Target className="h-10 w-10 text-[#FFC15E] mx-auto" />
              <h3 className="font-bold text-sm text-[#ECEDF7]">No Active Retention Check Loaded</h3>
              <button
                type="button"
                onClick={() => startQuiz(activeCourse.title)}
                className="px-4 py-2 rounded-xl bg-[#FFC15E] text-[#0A0D1C] font-bold text-xs transition"
              >
                Generate Quiz for {activeCourse.title}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ===================================================================== */}
      {/* VIEW 3: SYLLABUS KEY INVARIANTS SUMMARY                              */}
      {/* ===================================================================== */}
      {viewMode === 'points' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#5FE3B0] flex items-center gap-2">
              <FileText className="h-4 w-4" />
              <span>Key Syllabus Invariants: {activeCourse.title}</span>
            </h3>
            <span className="text-xs text-[#8A90B4]">Essential for Exams &amp; Interviews</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {currentKeyPoints.map((item, idx) => (
              <div
                key={idx}
                className="p-5 rounded-2xl bg-[#12162B] border border-[#262C4C] space-y-2 hover:border-[#5FE3B0]/40 transition shadow-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full bg-[#5FE3B0]" />
                  <h4 className="font-bold text-xs sm:text-sm text-[#ECEDF7]">{item.title}</h4>
                </div>
                <p className="text-xs text-[#8A90B4] leading-relaxed pl-4">
                  {item.point}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
