import React, { useState, useEffect } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Award,
  ChevronRight,
  TrendingUp,
  AlertTriangle,
  Plus,
  Send,
  BookOpen,
  ArrowRight,
  FileCheck
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { assignmentsAPI, coursesAPI } from '../services/api';

export default function AssignmentView({
  courseId = 1,
  user
}) {
  const [modules, setModules] = useState([]);
  const [selectedModuleId, setSelectedModuleId] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [selectedAssignment, setSelectedAssignment] = useState(null);
  const [loading, setLoading] = useState(true);

  // Student Submission
  const [submissionText, setSubmissionText] = useState('');
  const [submissionPdf, setSubmissionPdf] = useState(null);
  const [submissionMethod, setSubmissionMethod] = useState('pdf'); // 'pdf' | 'text'
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [evaluationResult, setEvaluationResult] = useState(null);

  // Educator Create Assignment Modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createTitle, setCreateTitle] = useState('');
  const [createDesc, setCreateDesc] = useState('');
  const [createRubric, setCreateRubric] = useState([
    { criterion: 'Algorithm & Invariant Correctness', max_points: 40, description: 'Accurate implementation matching lecture principles.' },
    { criterion: 'Mathematical & Complexity Proof', max_points: 30, description: 'Formal asymptotic proof and empirical analysis.' },
    { criterion: 'Code Quality, Modularity & Edge Cases', max_points: 30, description: 'Clean architecture and edge case coverage.' }
  ]);
  const [createLoading, setCreateLoading] = useState(false);

  const isEducator = user?.role === 'EDUCATOR';

  useEffect(() => {
    loadCourseModules();
  }, [courseId]);

  useEffect(() => {
    if (selectedModuleId) {
      loadModuleAssignments(selectedModuleId);
    }
  }, [selectedModuleId]);

  const loadCourseModules = async () => {
    try {
      setLoading(true);
      const data = await coursesAPI.getHierarchy(courseId);
      if (data.modules && data.modules.length > 0) {
        setModules(data.modules);
        setSelectedModuleId(data.modules[0].id);
      }
    } catch (err) {
      console.error('Failed to load course modules:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadModuleAssignments = async (moduleId) => {
    try {
      const data = await assignmentsAPI.listByModule(moduleId);
      setAssignments(data);
      if (data && data.length > 0) {
        setSelectedAssignment(data[0]);
      } else {
        setSelectedAssignment(null);
      }
      setEvaluationResult(null);
      setSubmissionText('');
      setSubmissionPdf(null);
    } catch (err) {
      console.error('Failed to list module assignments:', err);
    }
  };

  const handleSubmitAssignment = async (e) => {
    e.preventDefault();
    if (!selectedAssignment) return;
    if (submissionMethod === 'pdf' && !submissionPdf) {
      alert('Please select a PDF document to upload.');
      return;
    }
    if (submissionMethod === 'text' && !submissionText.trim()) {
      alert('Please enter your written solution text.');
      return;
    }

    try {
      setIsSubmitting(true);
      const formData = new FormData();
      if (submissionMethod === 'pdf') {
        formData.append('file', submissionPdf);
      } else {
        formData.append('text_submission', submissionText);
      }

      const result = await assignmentsAPI.submit(selectedAssignment.id, formData);
      setEvaluationResult(result);

      if (result.ai_score >= 70) {
        confetti({
          particleCount: 60,
          spread: 70,
          origin: { y: 0.7 }
        });
      }
    } catch (err) {
      alert('Auto-evaluation failed. Please verify submission format.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCriterion = () => {
    setCreateRubric(prev => [
      ...prev,
      { criterion: '', max_points: 20, description: '' }
    ]);
  };

  const handleRemoveCriterion = (idx) => {
    setCreateRubric(prev => prev.filter((_, i) => i !== idx));
  };

  const handleCriterionChange = (idx, field, value) => {
    setCreateRubric(prev => {
      const updated = [...prev];
      updated[idx][field] = value;
      return updated;
    });
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    if (!selectedModuleId || !createTitle.trim()) return;
    try {
      setCreateLoading(true);
      const totalMax = createRubric.reduce((acc, r) => acc + (parseFloat(r.max_points) || 0), 0);
      await assignmentsAPI.create({
        module_id: selectedModuleId,
        title: createTitle,
        description: createDesc,
        assignment_type: 'PRACTICAL_PDF',
        rubric: createRubric.map(r => ({
          criterion: r.criterion,
          max_points: parseFloat(r.max_points) || 10,
          description: r.description
        })),
        max_score: totalMax || 100.0
      });

      setShowCreateModal(false);
      setCreateTitle('');
      setCreateDesc('');
      await loadModuleAssignments(selectedModuleId);
    } catch (err) {
      alert('Failed to create assignment');
    } finally {
      setCreateLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center text-slate-400">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0b0f19] text-slate-100 overflow-hidden">
      {/* Top Header */}
      <div className="border-b border-[#1e2638] bg-[#0e131f]/90 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center text-white shadow-lg shadow-emerald-500/20">
            <FileText className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                AI Rubric Evaluation
              </span>
              <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Gemini 3.5 Flash-Lite
              </span>
            </div>
            <h1 className="text-lg font-black text-white">Course Assignments & Submissions</h1>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Module Selector */}
          <select
            value={selectedModuleId || ''}
            onChange={(e) => setSelectedModuleId(Number(e.target.value))}
            className="px-3 py-2 rounded-xl bg-[#121826] border border-[#1e2638] text-xs font-bold text-slate-200 focus:outline-none focus:border-emerald-500"
          >
            {modules.map(m => (
              <option key={m.id} value={m.id}>{m.title}</option>
            ))}
          </select>

          {isEducator && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-md shadow-emerald-600/30"
            >
              <Plus className="h-4 w-4" />
              <span>Create Assignment</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Workspace: Left Assignment List & Details, Right Submission & AI Report */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Column: Assignment Details & Rubric Breakdown */}
        <div className="w-1/2 border-r border-[#1e2638] flex flex-col overflow-y-auto p-6 space-y-6">
          {/* Assignment Selector Tabs if multiple */}
          {assignments.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {assignments.map(a => (
                <button
                  key={a.id}
                  onClick={() => {
                    setSelectedAssignment(a);
                    setEvaluationResult(null);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition ${
                    selectedAssignment?.id === a.id
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'bg-[#121826] text-slate-400 hover:text-white border border-[#1e2638]'
                  }`}
                >
                  {a.title}
                </button>
              ))}
            </div>
          )}

          {selectedAssignment ? (
            <div className="space-y-6">
              {/* Assignment Overview */}
              <div className="bg-[#121826] rounded-2xl border border-[#1e2638] p-6 space-y-3 shadow-xl">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">
                    Max Score: {selectedAssignment.max_score} Points
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    Type: {selectedAssignment.assignment_type}
                  </span>
                </div>
                <h2 className="text-xl font-black text-white">{selectedAssignment.title}</h2>
                <p className="text-xs text-slate-300 leading-relaxed">
                  {selectedAssignment.description}
                </p>
              </div>

              {/* Rubric Criteria Breakdown Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                    <Award className="h-4 w-4 text-emerald-400" />
                    <span>Grading Rubric Specifications</span>
                  </h3>
                  <span className="text-[11px] text-slate-500 font-semibold">
                    {selectedAssignment.rubric?.length || 0} Evaluated Criteria
                  </span>
                </div>

                <div className="space-y-2">
                  {selectedAssignment.rubric?.map((crit, idx) => (
                    <div
                      key={idx}
                      className="bg-[#121826] rounded-xl border border-[#1e2638] p-4 space-y-1"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-white">{crit.criterion}</span>
                        <span className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {crit.max_points} Pts
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{crit.description}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-xs font-semibold">
              No assignments found for this module.
            </div>
          )}
        </div>

        {/* Right Column: Submission Dropzone OR AI Auto-Evaluation Report */}
        <div className="w-1/2 flex flex-col overflow-y-auto p-6 space-y-6">
          {evaluationResult ? (
            /* ================================================================
               AI AUTO-EVALUATION REPORT CARD
               ================================================================ */
            <div className="space-y-6 animate-fade-in">
              {/* Score Header Card */}
              <div className="bg-[#121826] rounded-2xl border border-emerald-500/30 p-6 space-y-4 shadow-2xl">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-12 w-12 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                      <Sparkles className="h-6 w-6 animate-pulse" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white">AI Rubric Evaluation Report</h3>
                      <p className="text-xs text-slate-400">Evaluated instantly by Gemini</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="text-3xl font-black text-emerald-400">
                      {evaluationResult.ai_score}
                      <span className="text-sm text-slate-400"> / {selectedAssignment.max_score}</span>
                    </div>
                    <span className="text-[11px] font-extrabold text-emerald-300">
                      {Math.round((evaluationResult.ai_score / selectedAssignment.max_score) * 100)}% Grade
                    </span>
                  </div>
                </div>

                {evaluationResult.ai_feedback?.actionable_feedback && (
                  <div className="bg-[#0b0f19] p-3.5 rounded-xl border border-[#1e2638] text-xs text-slate-300 leading-relaxed">
                    <span className="font-bold text-emerald-400">Educator Summary: </span>
                    {evaluationResult.ai_feedback.actionable_feedback}
                  </div>
                )}
              </div>

              {/* Criterion-by-Criterion Awarded Breakdown */}
              <div className="space-y-3">
                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-300">
                  Criterion-by-Criterion Scoring
                </h4>

                <div className="space-y-2">
                  {evaluationResult.ai_feedback?.criteria_scores?.map((item, idx) => (
                    <div
                      key={idx}
                      className="bg-[#121826] rounded-xl border border-[#1e2638] p-4 space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-extrabold text-white">{item.criterion}</span>
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                          {item.awarded_points} / {item.max_points} Pts
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{item.feedback}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Strengths & Areas to Improve */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Strengths */}
                <div className="bg-[#121826] rounded-xl border border-emerald-500/20 p-4 space-y-2">
                  <div className="text-xs font-extrabold text-emerald-400 flex items-center gap-1.5">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>Identified Strengths</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {evaluationResult.ai_feedback?.strengths?.map((s, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                        <span className="text-emerald-400 shrink-0">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Areas for Improvement */}
                <div className="bg-[#121826] rounded-xl border border-amber-500/20 p-4 space-y-2">
                  <div className="text-xs font-extrabold text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle className="h-4 w-4" />
                    <span>Improvement Areas</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-slate-300">
                    {evaluationResult.ai_feedback?.weaknesses?.map((w, idx) => (
                      <li key={idx} className="flex items-start gap-1.5 text-[11px]">
                        <span className="text-amber-400 shrink-0">•</span>
                        <span>{w}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Reset button */}
              <button
                onClick={() => setEvaluationResult(null)}
                className="w-full py-2.5 rounded-xl bg-[#1e2638] hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Submit Revised Solution
              </button>
            </div>
          ) : (
            /* ================================================================
               STUDENT SUBMISSION FORM (PDF OR WRITTEN TEXT)
               ================================================================ */
            <div className="bg-[#121826] rounded-2xl border border-[#1e2638] p-6 space-y-5 shadow-xl">
              <div>
                <h3 className="text-base font-black text-white flex items-center gap-2">
                  <UploadCloud className="h-5 w-5 text-emerald-400" />
                  <span>Submit Assignment Solution</span>
                </h3>
                <p className="text-xs text-slate-400 mt-1">
                  Upload your completed PDF or paste your solution code & proofs below.
                </p>
              </div>

              {/* Switch submission method */}
              <div className="flex p-1 rounded-xl bg-[#0b0f19] border border-[#1e2638]">
                <button
                  type="button"
                  onClick={() => setSubmissionMethod('pdf')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    submissionMethod === 'pdf'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Upload PDF Document
                </button>
                <button
                  type="button"
                  onClick={() => setSubmissionMethod('text')}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition ${
                    submissionMethod === 'text'
                      ? 'bg-emerald-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  Written Code / Text
                </button>
              </div>

              <form onSubmit={handleSubmitAssignment} className="space-y-4">
                {submissionMethod === 'pdf' ? (
                  <div className="border-2 border-dashed border-[#232b3d] hover:border-emerald-500/50 rounded-2xl p-8 text-center space-y-3 transition bg-[#0b0f19]/40">
                    <div className="mx-auto w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center">
                      <UploadCloud className="h-6 w-6" />
                    </div>
                    <div>
                      <p className="text-xs font-extrabold text-white">Select PDF Solution File</p>
                      <p className="text-[11px] text-slate-400 mt-0.5">Supports PDF up to 10MB</p>
                    </div>
                    <input
                      type="file"
                      accept="application/pdf"
                      onChange={(e) => setSubmissionPdf(e.target.files[0])}
                      className="text-xs text-slate-400 file:mr-3 file:py-1.5 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white hover:file:bg-emerald-500 cursor-pointer"
                    />
                    {submissionPdf && (
                      <div className="text-xs font-bold text-emerald-400 flex items-center justify-center gap-1">
                        <FileCheck className="h-4 w-4" />
                        <span>Ready: {submissionPdf.name}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="text-xs font-bold text-slate-300">Solution Implementation & Proofs</label>
                    <textarea
                      rows={10}
                      required
                      placeholder="Paste your source code, invariant proofs, and asymptotic complexity analysis here..."
                      value={submissionText}
                      onChange={(e) => setSubmissionText(e.target.value)}
                      className="w-full mt-1.5 p-3.5 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-500 font-mono focus:outline-none focus:border-emerald-500 resize-none leading-relaxed"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting || !selectedAssignment}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-white font-extrabold text-xs shadow-xl shadow-emerald-500/20 disabled:opacity-50 transition flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                      <span>Gemini is Auto-Grading Against Rubrics...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      <span>Submit Solution for Instant AI Evaluation</span>
                    </>
                  )}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Educator Create Assignment */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl bg-[#131927] border border-[#1e2638] rounded-2xl p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-emerald-400" />
              <span>Create Rubric-Graded Assignment</span>
            </h3>

            <form onSubmit={handleCreateAssignment} className="space-y-4">
              <div>
                <label className="text-xs font-bold text-slate-300">Assignment Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Assignment 2: Graph Shortest Path Implementation"
                  value={createTitle}
                  onChange={(e) => setCreateTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300">Problem Statement & Requirements</label>
                <textarea
                  rows={3}
                  placeholder="Detailed instructions for students..."
                  value={createDesc}
                  onChange={(e) => setCreateDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 resize-none"
                />
              </div>

              {/* Rubric Builder */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-emerald-400">Rubric Criteria Breakdown</label>
                  <button
                    type="button"
                    onClick={handleAddCriterion}
                    className="text-xs font-bold text-indigo-400 hover:text-indigo-300 flex items-center gap-1"
                  >
                    <Plus className="h-3.5 w-3.5" /> Add Criterion
                  </button>
                </div>

                <div className="space-y-2">
                  {createRubric.map((crit, idx) => (
                    <div key={idx} className="bg-[#0b0f19] p-3 rounded-xl border border-[#1e2638] space-y-2">
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          required
                          placeholder="Criterion name (e.g. Algorithm Correctness)"
                          value={crit.criterion}
                          onChange={(e) => handleCriterionChange(idx, 'criterion', e.target.value)}
                          className="flex-1 px-2.5 py-1.5 bg-[#121826] border border-[#1e2638] rounded-lg text-xs text-white"
                        />
                        <input
                          type="number"
                          required
                          min="1"
                          placeholder="Max Pts"
                          value={crit.max_points}
                          onChange={(e) => handleCriterionChange(idx, 'max_points', e.target.value)}
                          className="w-20 px-2 py-1.5 bg-[#121826] border border-[#1e2638] rounded-lg text-xs text-white font-bold text-center"
                        />
                        {createRubric.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCriterion(idx)}
                            className="p-1.5 text-slate-500 hover:text-rose-400"
                          >
                            ×
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        placeholder="Evaluation guideline for AI grader..."
                        value={crit.description}
                        onChange={(e) => handleCriterionChange(idx, 'description', e.target.value)}
                        className="w-full px-2.5 py-1 bg-[#121826] border border-[#1e2638] rounded-lg text-[11px] text-slate-300"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#1e2638]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {createLoading ? 'Publishing...' : 'Publish Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
