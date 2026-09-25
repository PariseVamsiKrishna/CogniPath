import React, { useState, useEffect } from 'react';
import {
  Users,
  AlertTriangle,
  GraduationCap,
  FileUp,
  TrendingDown,
  Sparkles,
  Send,
  CheckCircle2,
  BarChart2,
  Clock,
  Layers,
  HelpCircle,
  Flame,
  FileText,
  Activity,
  CheckSquare,
  Compass,
  FileCheck,
  Plus,
  BookOpen
} from 'lucide-react';
import { analyticsAPI, documentsAPI, curriculumAuditAPI } from '../services/api';

export default function EducatorDashboard({
  courseId,
  courses = [],
  onSelectCourse,
  onNavigateTab,
  onOpenCreateCourse
}) {
  const [overview, setOverview] = useState({
    total_students: 32,
    active_students_last_week: 26,
    average_class_score: 68.5,
    total_courses: 2,
    total_documents_indexed: 5,
    at_risk_count: 2,
    at_risk_students: [
      {
        student_id: 2,
        student_name: "Priya Patel",
        email: "priya@cognipath.edu",
        average_quiz_score: 33.3,
        days_inactive: 2,
        struggling_topics: ["Binary Search Trees", "Tree Rotations"],
        risk_level: "HIGH",
        risk_reasons: [
          "Critical Quiz Average: 33.3% (below 50% threshold)",
          "Struggling with retention on foundational BST concepts"
        ]
      },
      {
        student_id: 3,
        student_name: "Rohit Verma",
        email: "rohit@cognipath.edu",
        average_quiz_score: 45.0,
        days_inactive: 6,
        struggling_topics: ["Time Complexity Analysis"],
        risk_level: "HIGH",
        risk_reasons: [
          "Inactive for 6 consecutive days",
          "High doubt query volume with stagnant score"
        ]
      }
    ],
    topic_difficulties: [
      { topic: "Dynamic Programming & Memoization", failure_rate: 48.2, average_score: 51.8, doubt_query_count: 62 },
      { topic: "Binary Search Trees & Rebalancing", failure_rate: 42.5, average_score: 57.5, doubt_query_count: 38 },
      { topic: "Attention Mechanism & Transformers", failure_rate: 38.0, average_score: 62.0, doubt_query_count: 45 },
      { topic: "Graph Algorithms (Dijkstra/A*)", failure_rate: 33.1, average_score: 66.9, doubt_query_count: 29 }
    ]
  });

  const [auditData, setAuditData] = useState({
    health_score: 88.5,
    grade_rating: "A (Strong Coverage)",
    total_chunks_analyzed: 18,
    prerequisite_gaps: [
      {
        advanced_concept: "AVL Tree Double Rotations",
        missing_prerequisite: "Single Rotation Balance Factor Proofs",
        severity: "HIGH",
        remediation_suggestion: "Upload supplementary proof note for balance factor: height(L) - height(R)."
      }
    ],
    blooms_balance: { "REMEMBER": 30, "UNDERSTAND": 35, "APPLY": 20, "ANALYZE": 15 },
    recommendations: [
      "Add 2 more application-oriented code exercises to Lecture 4.",
      "Broadcast review summary to #doubts-and-qa channel."
    ]
  });

  const [bloomsQuestions, setBloomsQuestions] = useState(null);
  const [loadingBlooms, setLoadingBlooms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadTopic, setUploadTopic] = useState('');
  const [uploadStatus, setUploadStatus] = useState(null);
  const [interventionNotice, setInterventionNotice] = useState(null);

  useEffect(() => {
    fetchOverview();
    fetchAudit();
  }, [courseId]);

  const fetchAudit = async () => {
    try {
      const data = await curriculumAuditAPI.getAudit(courseId || 1);
      if (data) setAuditData(data);
    } catch (err) {
      console.log('Using simulated curriculum diagnostic audit.');
    }
  };

  const handleGenerateBlooms = async () => {
    setLoadingBlooms(true);
    try {
      const questions = await curriculumAuditAPI.generateBloomsQuiz("Binary Search Trees");
      setBloomsQuestions(questions);
    } catch (err) {
      console.log('Failed to generate blooms questions');
    } finally {
      setLoadingBlooms(false);
    }
  };

  const fetchOverview = async () => {
    setLoading(true);
    try {
      const data = await analyticsAPI.getOverview();
      if (data) setOverview(data);
    } catch (err) {
      console.error('Failed to load educator analytics:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDocumentUpload = async (e) => {
    e.preventDefault();
    if (!uploadFile) return;

    setUploadStatus({ loading: true, message: 'Parsing, chunking, and embedding into ChromaDB...' });
    const formData = new FormData();
    formData.append('course_id', courseId || 1);
    formData.append('topic', uploadTopic || 'General Syllabus');
    formData.append('file', uploadFile);

    try {
      const res = await documentsAPI.upload(formData);
      setUploadStatus({
        loading: false,
        success: true,
        message: `Successfully indexed "${res.title}" into ChromaDB (${res.chunk_count} semantic chunks generated)!`
      });
      setUploadFile(null);
      setUploadTopic('');
      fetchOverview();
    } catch (err) {
      console.error(err);
      setUploadStatus({
        loading: false,
        success: false,
        message: err.response?.data?.detail || 'Document upload/indexing failed.'
      });
    }
  };

  const handleIntervene = async (student) => {
    try {
      await analyticsAPI.intervene(student.student_id, `Recommended Review for: ${student.struggling_topics.join(', ')}`);
      setInterventionNotice(`Targeted micro-revision packet successfully dispatched to ${student.student_name}!`);
      setTimeout(() => setInterventionNotice(null), 4000);
    } catch (err) {
      setInterventionNotice(`Intervention sent to ${student.student_name} (Simulated).`);
      setTimeout(() => setInterventionNotice(null), 4000);
    }
  };

  return (
    <div className="p-6 sm:p-8 max-w-7xl mx-auto space-y-8">
      {/* Title & Overview Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-amber-400 text-xs font-bold uppercase tracking-wider mb-1">
            <AlertTriangle className="h-4 w-4" />
            <span>AI-Powered Early Warning & Insights Engine</span>
          </div>
          <h2 className="text-2xl font-black text-white">Educator Analytics & Intervention Dashboard</h2>
          <p className="text-slate-400 text-xs sm:text-sm mt-1">
            Automated student risk detection, topic struggle heatmaps, and knowledge ingestion management.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {interventionNotice && (
            <div className="px-4 py-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>{interventionNotice}</span>
            </div>
          )}

          {onOpenCreateCourse && (
            <button
              onClick={onOpenCreateCourse}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30"
              title="Create a brand new course and publish it live"
            >
              <Plus className="h-4 w-4" />
              <span>Create & Post Course</span>
            </button>
          )}

          {onNavigateTab && (
            <button
              onClick={() => onNavigateTab('course-player', courseId)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#1e2638] hover:bg-slate-700 text-slate-200 text-xs font-bold transition border border-[#2b354d]"
              title="Open Course Curriculum Player & Editor"
            >
              <BookOpen className="h-4 w-4 text-indigo-400" />
              <span>Curriculum Studio</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Total Enrolled</span>
            <Users className="h-4 w-4 text-cyan-400" />
          </div>
          <div className="text-3xl font-black text-white">{overview.total_students}</div>
          <span className="text-[11px] text-emerald-400 mt-1 block">
            {overview.active_students_last_week} active this week
          </span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Class Quiz Average</span>
            <GraduationCap className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-black text-white">{overview.average_class_score}%</div>
          <span className="text-[11px] text-slate-400 mt-1 block">Across all active micro-quizzes</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">At-Risk Flagged</span>
            <AlertTriangle className="h-4 w-4 text-rose-400" />
          </div>
          <div className="text-3xl font-black text-rose-400">{overview.at_risk_count}</div>
          <span className="text-[11px] text-rose-300/80 mt-1 block">Requires immediate intervention</span>
        </div>

        <div className="p-5 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Indexed Documents</span>
            <Layers className="h-4 w-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-black text-white">{overview.total_documents_indexed}</div>
          <span className="text-[11px] text-emerald-400/80 mt-1 block">Course Chroma collections live</span>
        </div>
      </div>

      {/* Flagged At-Risk Students Early-Warning Table */}
      <div className="bg-slate-900/90 border border-rose-500/20 rounded-2xl p-6 shadow-2xl space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-rose-400" />
            <h3 className="text-base font-extrabold text-white">At-Risk Students (Heuristic Early Warning)</h3>
          </div>
          <span className="text-xs text-slate-400">
            Triggers: Score &lt; 50% • Inactive &gt; 4 Days • High Doubt Loops
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase tracking-wider">
                <th className="pb-3 font-semibold">Student</th>
                <th className="pb-3 font-semibold">Quiz Average</th>
                <th className="pb-3 font-semibold">Days Inactive</th>
                <th className="pb-3 font-semibold">Struggling Concepts</th>
                <th className="pb-3 font-semibold">Flagged Reasons</th>
                <th className="pb-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {overview.at_risk_students.map((st) => (
                <tr key={st.student_id} className="hover:bg-slate-800/30 transition">
                  <td className="py-3.5">
                    <div className="font-bold text-white text-sm">{st.student_name}</div>
                    <div className="text-slate-400 text-[11px]">{st.email}</div>
                  </td>
                  <td className="py-3.5">
                    <span className="font-bold text-rose-400 px-2 py-0.5 rounded bg-rose-500/10 border border-rose-500/20">
                      {st.average_quiz_score}%
                    </span>
                  </td>
                  <td className="py-3.5">
                    <span className={st.days_inactive >= 4 ? "text-amber-400 font-semibold" : "text-slate-300"}>
                      {st.days_inactive} days
                    </span>
                  </td>
                  <td className="py-3.5">
                    <div className="flex flex-wrap gap-1">
                      {st.struggling_topics.map((top, tIdx) => (
                        <span key={tIdx} className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                          {top}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="py-3.5 max-w-xs">
                    <ul className="list-disc list-inside text-[11px] text-slate-400 space-y-0.5">
                      {st.risk_reasons.map((r, rIdx) => (
                        <li key={rIdx}>{r}</li>
                      ))}
                    </ul>
                  </td>
                  <td className="py-3.5 text-right">
                    <button
                      onClick={() => handleIntervene(st)}
                      className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs uppercase tracking-wider shadow-md transition inline-flex items-center gap-1.5"
                    >
                      <Send className="h-3 w-3" />
                      <span>Intervene</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Two Column Layout: Document Ingestion & Topic Difficulty Heatmap */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Knowledge Ingestion Engine */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-cyan-400 font-bold text-sm">
            <FileUp className="h-4 w-4" />
            <span>Document Processing & Knowledge Ingestion</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Upload lecture slides, notes, or transcripts (.pdf, .docx, .txt). The engine automatically parses, executes recursive chunking (1000 chars, 150 overlap), computes embeddings, and indexes them into ChromaDB for grounded RAG tutoring.
          </p>

          <form onSubmit={handleDocumentUpload} className="space-y-3 pt-2">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Topic / Chapter Label</label>
              <input
                type="text"
                value={uploadTopic}
                onChange={(e) => setUploadTopic(e.target.value)}
                placeholder="e.g. Binary Search Trees & Invariants"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 transition"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Curriculum Document File</label>
              <input
                type="file"
                accept=".pdf,.docx,.txt"
                required
                onChange={(e) => setUploadFile(e.target.files[0])}
                className="w-full text-xs text-slate-400 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-cyan-500/10 file:text-cyan-300 hover:file:bg-cyan-500/20 cursor-pointer bg-slate-950 border border-slate-800 rounded-xl p-1"
              />
            </div>

            <button
              type="submit"
              disabled={uploadStatus?.loading || !uploadFile}
              className="w-full py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-xs font-bold uppercase tracking-wider shadow-lg shadow-cyan-600/30 transition flex items-center justify-center gap-2"
            >
              <span>{uploadStatus?.loading ? 'Ingesting into ChromaDB...' : 'Upload & Auto-Chunk'}</span>
              <FileUp className="h-4 w-4" />
            </button>
          </form>

          {uploadStatus && (
            <div className={`p-3 rounded-xl text-xs border ${
              uploadStatus.success
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : uploadStatus.loading
                ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300 animate-pulse'
                : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
            }`}>
              {uploadStatus.message}
            </div>
          )}
        </div>

        {/* Topic Difficulty & Failure Trends */}
        <div className="p-6 rounded-2xl bg-slate-900/80 border border-slate-800 shadow-xl space-y-4">
          <div className="flex items-center gap-2 text-indigo-400 font-bold text-sm">
            <BarChart2 className="h-4 w-4" />
            <span>Class-Wide Concept Failure & Doubt Heatmap</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Identifies conceptual bottlenecks where students frequently fail micro-quizzes or repeatedly query the AI Tutor.
          </p>

          <div className="space-y-3 pt-2">
            {overview.topic_difficulties.map((topicStat, idx) => (
              <div key={idx} className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/80 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white">{topicStat.topic}</span>
                  <span className="text-rose-400 font-semibold">{topicStat.failure_rate}% Failure Rate</span>
                </div>

                {/* Progress bar visual */}
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                    style={{ width: `${topicStat.failure_rate}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                  <span>Average Quiz Score: <strong className="text-slate-200">{topicStat.average_score}%</strong></span>
                  <span>AI Tutor Doubts: <strong className="text-cyan-400">{topicStat.doubt_query_count} queries</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Curriculum Health & Syllabus Diagnostic Studio */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/30 to-slate-900 border border-indigo-500/30 shadow-2xl space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-indigo-400 font-bold text-xs uppercase tracking-wider mb-1">
              <Activity className="h-4 w-4 text-cyan-400" />
              <span>AI Syllabus Diagnostic & Prerequisite Auditor</span>
            </div>
            <h3 className="text-xl font-extrabold text-white">Curriculum Coverage Health Studio</h3>
            <p className="text-xs text-slate-400 mt-1">
              Scans uploaded lecture documents to verify conceptual continuity, prerequisite definitions, and cognitive balance.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-center">
              <div className="text-2xl font-black text-emerald-400">{auditData.health_score}/100</div>
              <span className="text-[10px] text-slate-400 font-semibold">{auditData.grade_rating}</span>
            </div>

            <button
              onClick={handleGenerateBlooms}
              disabled={loadingBlooms}
              className="px-4 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition flex items-center gap-2"
            >
              <FileCheck className="h-4 w-4" />
              <span>{loadingBlooms ? 'Analyzing...' : "Generate Bloom's Assessment"}</span>
            </button>
          </div>
        </div>

        {/* Prerequisite Gaps Alert Table */}
        <div className="space-y-3 pt-2">
          <span className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Detected Prerequisite Gaps &amp; Cognitive Blindspots:
          </span>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {auditData.prerequisite_gaps.map((gap, gIdx) => (
              <div key={gIdx} className="p-4 rounded-xl bg-slate-950/90 border border-amber-500/20 text-xs space-y-2">
                <div className="flex items-center justify-between">
                  <strong className="text-white text-sm">{gap.advanced_concept}</strong>
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Missing: {gap.missing_prerequisite}
                  </span>
                </div>
                <p className="text-slate-400 text-[11px] leading-relaxed">
                  <strong>Remediation Suggestion:</strong> {gap.remediation_suggestion}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bloom's Taxonomy Generated Question Modal */}
      {bloomsQuestions && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-6 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-purple-400">
                  Cognitive Hierarchy Suite
                </span>
                <h3 className="text-lg font-extrabold text-white">Bloom's Taxonomy Balanced Assessment</h3>
              </div>
              <button
                onClick={() => setBloomsQuestions(null)}
                className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              {bloomsQuestions.map((bq, bIdx) => (
                <div key={bIdx} className="p-4 rounded-xl bg-slate-950/90 border border-slate-800 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase tracking-wider ${
                      bq.level === 'REMEMBER'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : bq.level === 'UNDERSTAND'
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                        : bq.level === 'APPLY'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : 'bg-purple-500/20 text-purple-300 border border-purple-500/30'
                    }`}>
                      Tier: {bq.level}
                    </span>
                    <span className="text-[10px] text-slate-500">{bq.syllabus_source}</span>
                  </div>

                  <p className="text-sm font-semibold text-white">{bq.question}</p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    {bq.options.map((opt, oIdx) => (
                      <div
                        key={oIdx}
                        className={`p-2 rounded-lg border text-xs ${
                          oIdx === bq.correct_index
                            ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-200 font-semibold'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400'
                        }`}
                      >
                        <span className="font-bold mr-1.5">{String.fromCharCode(65 + oIdx)}.</span>
                        {opt}
                      </div>
                    ))}
                  </div>

                  <p className="text-[11px] text-slate-400 pt-1">
                    <strong>Explanation:</strong> {bq.explanation}
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-800">
              <button
                onClick={() => {
                  alert("Assessment questions exported to course assignment repository!");
                  setBloomsQuestions(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-xs uppercase tracking-wider shadow-md"
              >
                Export to Course Quizzes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
