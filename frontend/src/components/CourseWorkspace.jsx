import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ArrowLeft,
  Sparkles,
  CheckCircle2,
  Lock,
  Award,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  Play,
  RotateCcw,
  Check,
  Clock,
  Youtube,
  Send,
  Plus,
  UploadCloud,
  Layers,
  ChevronDown,
  Star
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { coursesAPI, examsAPI } from '../services/api';
import CurriculumTreeSidebar from './CurriculumTreeSidebar';
import SupplementaryVideoPlayer from './SupplementaryVideoPlayer';
import CogniTutorDrawer from './CogniTutorDrawer';
import ModuleExamBuilder from './ModuleExamBuilder';
import CourseRatingModal from './CourseRatingModal';

export default function CourseWorkspace({
  courseId,
  user,
  onBackToCourses,
  onNavigateTab,
  onRefreshCourses
}) {
  const isEducator = user?.role === 'EDUCATOR';

  // Hierarchy and Course State
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);

  // Active Navigation Hierarchy
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeContentType, setActiveContentType] = useState('video'); // 'video' | 'notes' | 'exam'
  const [activeTopic, setActiveTopic] = useState(null);
  const [activeResource, setActiveResource] = useState(null);

  // Layout Panels State
  const [isTreeSidebarOpen, setIsTreeSidebarOpen] = useState(true);
  const [isCogniOpen, setIsCogniOpen] = useState(false);

  // Dynamic Ephemeral Supplementary Video (Strictly Client-Scoped)
  const [ephemeralSecondaryVideo, setEphemeralSecondaryVideo] = useState(null);

  // Topic Completion Tracking
  const [completedTopics, setCompletedTopics] = useState({});

  // Protected PDF Viewer State
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoomScale, setZoomScale] = useState(1.1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const canvasRef = useRef(null);

  // Module Exam Taking State
  const [moduleExam, setModuleExam] = useState(null);
  const [examLoading, setExamLoading] = useState(false);
  const [examActive, setExamActive] = useState(false);
  const [studentAnswers, setStudentAnswers] = useState({});
  const [examTimeLeft, setExamTimeLeft] = useState(900);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submittingExam, setSubmittingExam] = useState(false);

  // Educator Modals
  const [showExamBuilderModal, setShowExamBuilderModal] = useState(false);
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [targetModuleId, setTargetModuleId] = useState(null);
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');
  const [newTopicUrl, setNewTopicUrl] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceFile, setResourceFile] = useState(null);
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleDesc, setNewModuleDesc] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Ratings State
  const [showCourseRatingModal, setShowCourseRatingModal] = useState(false);
  const [topicRatingSummary, setTopicRatingSummary] = useState(null);
  const [topicUserRating, setTopicUserRating] = useState(0);
  const [topicHoverRating, setTopicHoverRating] = useState(0);
  const [ratingToast, setRatingToast] = useState('');

  // Fetch topic rating when active topic changes
  useEffect(() => {
    if (activeTopic?.id) {
      loadTopicRating(activeTopic.id);
    }
  }, [activeTopic?.id]);

  const loadTopicRating = async (topicId) => {
    try {
      const summary = await coursesAPI.getTopicRatings(topicId);
      setTopicRatingSummary(summary);
      if (summary?.user_rating) {
        setTopicUserRating(summary.user_rating);
      } else {
        setTopicUserRating(0);
      }
    } catch (err) {
      console.error('Failed to load topic rating:', err);
    }
  };

  const handleRateTopic = async (starVal) => {
    if (!activeTopic?.id) return;
    setTopicUserRating(starVal);
    try {
      await coursesAPI.rateTopic(activeTopic.id, { rating: starVal });
      setRatingToast(`Rated ★${starVal}!`);
      await loadTopicRating(activeTopic.id);
      if (onRefreshCourses) onRefreshCourses();
      setTimeout(() => setRatingToast(''), 3000);
    } catch (err) {
      console.error('Failed to rate lecture topic:', err);
    }
  };

  // ---------------------------------------------------------------------------
  // 1. DATA INITIALIZATION & SYNC
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (courseId) {
      fetchHierarchy(courseId);
    }
  }, [courseId]);

  const fetchHierarchy = async (cId) => {
    try {
      setLoading(true);
      const data = await coursesAPI.getHierarchy(cId);
      setHierarchy(data);

      if (data.modules && data.modules.length > 0) {
        const firstMod = data.modules[0];
        setActiveModuleId(firstMod.id);

        if (firstMod.topics && firstMod.topics.length > 0) {
          setActiveTopic(firstMod.topics[0]);
          setActiveContentType('video');
        } else if (firstMod.resources && firstMod.resources.length > 0) {
          setActiveResource(firstMod.resources[0]);
          setActiveContentType('notes');
        }
      }
    } catch (err) {
      console.error('Failed to load course workspace hierarchy:', err);
    } finally {
      setLoading(false);
    }
  };

  const currentModule = useMemo(() => {
    if (!hierarchy?.modules || !activeModuleId) return null;
    return hierarchy.modules.find((m) => m.id === activeModuleId) || hierarchy.modules[0];
  }, [hierarchy, activeModuleId]);

  // Load Exam Data when Exam is Active
  useEffect(() => {
    if (activeContentType === 'exam' && currentModule) {
      loadModuleExamData(currentModule);
    }
  }, [activeContentType, currentModule]);

  const loadModuleExamData = async (mod) => {
    try {
      setExamLoading(true);
      setExamActive(false);
      setSubmissionResult(null);
      setStudentAnswers({});

      if (mod.module_exam_id) {
        const data = await examsAPI.get(mod.module_exam_id);
        setModuleExam(data);
        setExamTimeLeft((data.time_limit_mins || 15) * 60);
      } else {
        const list = await examsAPI.listByCourse(courseId);
        const modExam = list.find((e) => e.module_id === mod.id);
        if (modExam) {
          const data = await examsAPI.get(modExam.id);
          setModuleExam(data);
          setExamTimeLeft((data.time_limit_mins || 15) * 60);
        } else {
          setModuleExam(null);
        }
      }
    } catch (e) {
      setModuleExam(null);
    } finally {
      setExamLoading(false);
    }
  };

  // ---------------------------------------------------------------------------
  // 2. TREE NAVIGATION HANDLERS (WITH AUTO-CLEANUP RULE)
  // ---------------------------------------------------------------------------
  const handleSelectTopic = (mod, topic) => {
    // AUTO-CLEANUP RULE: Reset ephemeral supplementary video whenever topic changes
    setEphemeralSecondaryVideo(null);

    setActiveModuleId(mod.id);
    setActiveTopic(topic);
    setActiveResource(null);
    setActiveContentType('video');
  };

  const handleSelectResource = (mod, res) => {
    // AUTO-CLEANUP RULE
    setEphemeralSecondaryVideo(null);

    setActiveModuleId(mod.id);
    setActiveResource(res);
    setActiveTopic(null);
    setActiveContentType('notes');
    loadPdfDoc(res);
  };

  const handleSelectExam = (mod) => {
    // AUTO-CLEANUP RULE
    setEphemeralSecondaryVideo(null);

    setActiveModuleId(mod.id);
    setActiveTopic(null);
    setActiveResource(null);
    setActiveContentType('exam');
  };

  const toggleTopicCompleted = (topicId) => {
    setCompletedTopics((prev) => {
      const updated = { ...prev, [topicId]: !prev[topicId] };
      if (updated[topicId]) {
        confetti({
          particleCount: 50,
          spread: 60,
          origin: { y: 0.75 }
        });
      }
      return updated;
    });
  };

  // ---------------------------------------------------------------------------
  // 3. SECURE PDF VIEWER ENGINE
  // ---------------------------------------------------------------------------
  const loadPdfDoc = async (resource) => {
    if (!resource) return;
    setPdfLoading(true);
    setPageNum(1);

    try {
      if (!window.pdfjsLib) {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
          script.onload = () => {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc =
              'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
            resolve();
          };
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      const resUrl = `/api/v1/courses/resources/${resource.id}/view`;
      const token = localStorage.getItem('cognipath_token');
      const response = await fetch(resUrl, {
        headers: token ? { Authorization: `Bearer ${token}` } : {}
      });
      const blob = await response.blob();
      const arrayBuffer = await blob.arrayBuffer();

      const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      renderPdfPage(1, pdf, zoomScale);
    } catch (err) {
      console.error('PDF rendering failed:', err);
    } finally {
      setPdfLoading(false);
    }
  };

  const renderPdfPage = async (pageNumber, pdfInstance = pdfDoc, scale = zoomScale) => {
    if (!pdfInstance || !canvasRef.current) return;
    try {
      const page = await pdfInstance.getPage(pageNumber);
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      canvas.height = viewport.height;
      canvas.width = viewport.width;

      const renderContext = {
        canvasContext: context,
        viewport: viewport
      };
      await page.render(renderContext).promise;
    } catch (err) {
      console.error('Page render error:', err);
    }
  };

  useEffect(() => {
    if (pdfDoc && activeResource && activeContentType === 'notes') {
      renderPdfPage(pageNum, pdfDoc, zoomScale);
    }
  }, [pageNum, zoomScale, activeContentType]);

  // ---------------------------------------------------------------------------
  // 4. STUDENT EXAM TAKING & SUBMISSION
  // ---------------------------------------------------------------------------
  const handleAnswerOption = (questionId, optionVal) => {
    setStudentAnswers((prev) => ({
      ...prev,
      [questionId]: optionVal
    }));
  };

  const handleSubmitExam = async () => {
    if (!moduleExam) return;
    try {
      setSubmittingExam(true);
      const responses = Object.entries(studentAnswers).map(([qid, val]) => ({
        question_id: parseInt(qid),
        selected_option: val
      }));

      const result = await examsAPI.submit(moduleExam.id, responses);
      setSubmissionResult(result);
      setExamActive(false);

      if (result.passed) {
        confetti({
          particleCount: 85,
          spread: 75,
          origin: { y: 0.6 }
        });
      }
    } catch (err) {
      alert('Error evaluating exam submission.');
    } finally {
      setSubmittingExam(false);
    }
  };

  // Exam Countdown Timer
  useEffect(() => {
    let timer;
    if (examActive && examTimeLeft > 0 && !submissionResult) {
      timer = setInterval(() => {
        setExamTimeLeft((t) => {
          if (t <= 1) {
            handleSubmitExam();
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [examActive, examTimeLeft, submissionResult]);

  const formatExamTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ---------------------------------------------------------------------------
  // 5. EDUCATOR CURRICULUM ACTIONS
  // ---------------------------------------------------------------------------
  const handleAddModuleAction = async (e) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    try {
      setActionLoading(true);
      await coursesAPI.createModule(courseId, {
        title: newModuleTitle.trim(),
        description: newModuleDesc.trim()
      });
      setNewModuleTitle('');
      setNewModuleDesc('');
      setShowAddModuleModal(false);
      await fetchHierarchy(courseId);
    } catch (err) {
      alert('Failed to add module');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTopicAction = async (e) => {
    e.preventDefault();
    if (!targetModuleId || !newTopicTitle.trim() || !newTopicUrl.trim()) return;
    try {
      setActionLoading(true);
      await coursesAPI.createTopic(targetModuleId, {
        title: newTopicTitle.trim(),
        description: newTopicDesc.trim(),
        youtube_url: newTopicUrl.trim()
      });
      setNewTopicTitle('');
      setNewTopicDesc('');
      setNewTopicUrl('');
      setShowAddTopicModal(false);
      await fetchHierarchy(courseId);
    } catch (err) {
      alert('Failed to add topic.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadNotesAction = async (e) => {
    e.preventDefault();
    if (!targetModuleId || !resourceTitle.trim() || !resourceFile) return;
    try {
      setActionLoading(true);
      const formData = new FormData();
      formData.append('title', resourceTitle.trim());
      formData.append('file', resourceFile);
      await coursesAPI.uploadResource(targetModuleId, formData);
      setResourceTitle('');
      setResourceFile(null);
      setShowUploadModal(false);
      await fetchHierarchy(courseId);
    } catch (err) {
      alert('Failed to upload notes.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center p-12 text-slate-400 bg-[#0b0f19]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-xs font-semibold">Loading course learning workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0b0f19] text-slate-100 overflow-hidden select-none relative">
      {/* ===================================================================== */}
      {/* MINIMALIST TOP BAR & BREADCRUMB */}
      {/* ===================================================================== */}
      <header className="h-14 border-b border-[#1e2638] bg-[#0d1220] px-4 sm:px-6 flex items-center justify-between gap-4 shrink-0 shadow-sm z-30">
        <div className="flex items-center gap-3 min-w-0">
          {/* Back Arrow */}
          <button
            onClick={onBackToCourses}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#131929] hover:bg-[#1a2338] border border-[#20293d] text-slate-300 hover:text-white text-xs font-bold transition shrink-0"
            title="Return to Enrolled Courses Dashboard"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Courses</span>
          </button>

          <span className="text-slate-600 hidden sm:inline">•</span>

          {/* Active Breadcrumb: Course > Module > Subtopic */}
          <div className="flex items-center gap-1.5 text-xs truncate">
            <span className="font-extrabold text-white truncate max-w-[140px] sm:max-w-[200px]">
              {hierarchy?.title || 'Course'}
            </span>
            {currentModule && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-indigo-300 font-semibold truncate max-w-[120px] sm:max-w-[180px]">
                  {currentModule.title}
                </span>
              </>
            )}
            {activeTopic && (
              <>
                <span className="text-slate-600">/</span>
                <span className="text-slate-400 truncate max-w-[120px] sm:max-w-[200px] hidden md:inline">
                  {activeTopic.title}
                </span>
              </>
            )}
          </div>
        </div>

        {/* Top-Right Action: Rate Course & Glowing "Ask Cogni ✨" Button */}
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => setShowCourseRatingModal(true)}
            className="px-3.5 py-2 rounded-2xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            title="Rate this course and read student reviews"
          >
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="hidden sm:inline">Rate Course</span>
          </button>

          <button
            onClick={() => setIsCogniOpen((prev) => !prev)}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition-all duration-300 flex items-center gap-2 shadow-lg ${
              isCogniOpen
                ? 'bg-purple-600 text-white shadow-purple-600/30 ring-2 ring-purple-400'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white shadow-purple-600/25 ring-2 ring-purple-500/40 animate-pulse'
            }`}
          >
            <Sparkles className="h-4 w-4 text-purple-200" />
            <span>Ask Cogni</span>
          </button>
        </div>
      </header>

      {/* ===================================================================== */}
      {/* 3-COLUMN WORKSPACE: TREE SIDEBAR | MAIN STAGE | COGNI DRAWER */}
      {/* ===================================================================== */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* 1. Left Sidebar: Collapsible Curriculum Tree Navigation */}
        <CurriculumTreeSidebar
          hierarchy={hierarchy}
          activeModuleId={activeModuleId}
          activeTopicId={activeTopic?.id}
          activeResourceId={activeResource?.id}
          activeContentType={activeContentType}
          completedTopics={completedTopics}
          onSelectTopic={handleSelectTopic}
          onSelectResource={handleSelectResource}
          onSelectExam={handleSelectExam}
          isOpen={isTreeSidebarOpen}
          onToggleSidebar={() => setIsTreeSidebarOpen((prev) => !prev)}
          isEducator={isEducator}
          onAddTopic={(modId) => {
            setTargetModuleId(modId);
            setShowAddTopicModal(true);
          }}
          onUploadNotes={(modId) => {
            setTargetModuleId(modId);
            setShowUploadModal(true);
          }}
          onAddModule={() => setShowAddModuleModal(true)}
        />

        {/* 2. Center Viewport: Primary Media Stage & Injected Secondary Player */}
        <main className="flex-1 min-w-0 bg-[#090d16] flex flex-col overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          {/* PRIMARY CONTENT: TOPIC VIDEO */}
          {activeContentType === 'video' && activeTopic && (
            <div className="space-y-6 max-w-5xl mx-auto w-full">
              {/* Primary 16:9 YouTube Embed */}
              <div className="w-full aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl border border-[#1e2638] relative">
                <iframe
                  className="w-full h-full"
                  src={`https://www.youtube-nocookie.com/embed/${activeTopic.youtube_video_id || 'qH6clASSS54'}?autoplay=0&rel=0&modestbranding=1`}
                  title={activeTopic.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              </div>

              {/* Lecture Ribbon & Completion CTA */}
              <div className="bg-[#121826] rounded-3xl border border-[#1e2638] p-6 space-y-4 shadow-xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-1">
                      <Youtube className="h-4 w-4 text-red-500" />
                      <span>Topic #{activeTopic.order_index}</span>
                    </div>
                    <h2 className="text-xl font-black text-white">{activeTopic.title}</h2>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => toggleTopicCompleted(activeTopic.id)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md ${
                        completedTopics[activeTopic.id]
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[#1a2338] hover:bg-slate-700 text-slate-200'
                      }`}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{completedTopics[activeTopic.id] ? 'Completed' : 'Mark as Completed'}</span>
                    </button>

                    <button
                      onClick={() => setIsCogniOpen(true)}
                      className="px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-2 transition"
                    >
                      <Sparkles className="h-4 w-4 text-purple-400" />
                      <span>Ask Cogni</span>
                    </button>
                  </div>
                </div>

                {/* Subtopic / Video Lecture 5-Star Interactive Rating Strip */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-[#1a2335]">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-slate-400">Rate this lecture:</span>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((starVal) => {
                        const isFilled = (topicHoverRating || topicUserRating) >= starVal;
                        return (
                          <button
                            key={starVal}
                            type="button"
                            onMouseEnter={() => setTopicHoverRating(starVal)}
                            onMouseLeave={() => setTopicHoverRating(0)}
                            onClick={() => handleRateTopic(starVal)}
                            className="p-1 hover:scale-125 transition-transform focus:outline-none"
                            title={`Rate ${starVal} star${starVal > 1 ? 's' : ''}`}
                          >
                            <Star
                              className={`h-4 w-4 transition-colors ${
                                isFilled
                                  ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_6px_rgba(251,191,36,0.6)]'
                                  : 'text-slate-600 hover:text-slate-400'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                    {topicRatingSummary && (
                      <span className="text-[11px] font-bold text-amber-300/80">
                        ★ {topicRatingSummary.average_rating ? topicRatingSummary.average_rating.toFixed(1) : '5.0'} ({topicRatingSummary.total_ratings || 0})
                      </span>
                    )}
                  </div>

                  {ratingToast && (
                    <span className="text-xs font-bold text-emerald-400 animate-fade-in">
                      {ratingToast}
                    </span>
                  )}
                </div>

                <div className="text-xs text-slate-300 leading-relaxed bg-[#0b0e18]/80 rounded-2xl p-4 border border-[#1a2335]">
                  <p className="font-semibold text-slate-200 mb-1">Concept Synopsis:</p>
                  <p>{activeTopic.description || 'Comprehensive conceptual exploration of invariants and architectural principles.'}</p>
                </div>
              </div>

              {/* DYNAMIC EPHEMERAL INJECTION POINT (Located directly beneath primary player) */}
              {ephemeralSecondaryVideo && (
                <SupplementaryVideoPlayer
                  video={ephemeralSecondaryVideo}
                  onDismiss={() => setEphemeralSecondaryVideo(null)}
                />
              )}
            </div>
          )}

          {/* PRIMARY CONTENT: PROTECTED VIEW-ONLY PDF NOTES */}
          {activeContentType === 'notes' && activeResource && (
            <div className="flex-1 flex flex-col rounded-3xl border border-[#1e2638] bg-[#0d1220] overflow-hidden shadow-2xl max-w-5xl mx-auto w-full min-h-[75vh]">
              {/* PDF Top Navigation */}
              <div className="h-14 border-b border-[#1e2638] bg-[#121828] px-6 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="text-xs font-extrabold text-white truncate max-w-md">
                      {activeResource.title}
                    </h3>
                    <span className="text-[10px] text-emerald-400 font-semibold">
                      Protected Canvas View-Only • Copy Disabled
                    </span>
                  </div>
                </div>

                {/* Page Controls */}
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-[#0b0f19] px-2.5 py-1 rounded-lg border border-[#1e2638] text-xs font-bold">
                    <button
                      disabled={pageNum <= 1}
                      onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 text-slate-300">{pageNum} / {totalPages}</span>
                    <button
                      disabled={pageNum >= totalPages}
                      onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))}
                      className="p-1 text-slate-400 hover:text-white disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 bg-[#0b0f19] px-2 py-1 rounded-lg border border-[#1e2638] text-xs font-bold">
                    <button
                      onClick={() => setZoomScale((s) => Math.max(0.8, s - 0.2))}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="px-1 text-[11px] text-slate-400">{Math.round(zoomScale * 100)}%</span>
                    <button
                      onClick={() => setZoomScale((s) => Math.min(2.0, s + 0.2))}
                      className="p-1 text-slate-400 hover:text-white"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              {/* Canvas Viewport with Overlay Watermark */}
              <div
                className="flex-1 overflow-auto flex items-center justify-center p-8 relative select-none"
                onContextMenu={(e) => e.preventDefault()}
                style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
              >
                {pdfLoading ? (
                  <div className="flex flex-col items-center gap-2 text-slate-400">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                    <span className="text-xs font-semibold">Decrypting document...</span>
                  </div>
                ) : (
                  <div className="relative shadow-2xl rounded-lg overflow-hidden border border-[#2b354d] bg-white">
                    <canvas ref={canvasRef} className="block pointer-events-none" />
                    {/* Watermark Grid */}
                    <div
                      className="absolute inset-0 pointer-events-none flex flex-col justify-around overflow-hidden opacity-25 select-none"
                      style={{ transform: 'rotate(-25deg) scale(1.4)' }}
                    >
                      {[1, 2, 3, 4, 5, 6].map((idx) => (
                        <div key={idx} className="whitespace-nowrap text-center text-slate-800 font-extrabold text-sm tracking-widest uppercase">
                          {user?.full_name || 'Student'} • {user?.email || 'student@cognipath.edu'} • CONFIDENTIAL COGNIPATH LECTURE NOTE • DO NOT COPY
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* PRIMARY CONTENT: MODULE END EXAM */}
          {activeContentType === 'exam' && (
            <div className="max-w-4xl mx-auto w-full space-y-6">
              {examLoading ? (
                <div className="h-64 flex items-center justify-center text-slate-400">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                </div>
              ) : moduleExam ? (
                <div className="space-y-6">
                  {/* Exam Card Header */}
                  <div className="bg-[#121826] border border-[#1e2638] rounded-3xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          {moduleExam.scope || 'Module End Assessment'}
                        </span>
                        <span className="text-xs font-bold text-slate-400">
                          {moduleExam.questions?.length || 0} Questions
                        </span>
                        <span className="text-xs font-bold text-slate-400">•</span>
                        <span className="text-xs font-bold text-indigo-400 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" /> {moduleExam.time_limit_mins || 15} Mins
                        </span>
                      </div>
                      <h2 className="text-xl font-black text-white">{moduleExam.title}</h2>
                    </div>

                    <div className="flex items-center gap-3">
                      {isEducator ? (
                        <button
                          onClick={() => setShowExamBuilderModal(true)}
                          className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-indigo-600/30"
                        >
                          <Sparkles className="h-4 w-4" />
                          <span>Edit RAG Assessment</span>
                        </button>
                      ) : !examActive && !submissionResult ? (
                        <button
                          onClick={() => {
                            setExamActive(true);
                            setStudentAnswers({});
                            setExamTimeLeft((moduleExam.time_limit_mins || 15) * 60);
                          }}
                          className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white text-xs font-bold transition shadow-lg shadow-amber-500/25 flex items-center gap-2"
                        >
                          <Play className="h-4 w-4 fill-white" />
                          <span>Start Assessment</span>
                        </button>
                      ) : examActive ? (
                        <div className="flex items-center gap-3">
                          <div className="px-3.5 py-1.5 rounded-xl bg-[#0b0f19] border border-amber-500/40 text-amber-300 font-mono text-sm font-bold flex items-center gap-2">
                            <Clock className="h-4 w-4 text-amber-400 animate-pulse" />
                            <span>{formatExamTimer(examTimeLeft)}</span>
                          </div>
                          <button
                            onClick={handleSubmitExam}
                            disabled={submittingExam}
                            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 disabled:opacity-50"
                          >
                            <Check className="h-4 w-4" />
                            <span>{submittingExam ? 'Evaluating...' : 'Submit Exam'}</span>
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Submission Scorecard */}
                  {submissionResult && (
                    <div className={`p-6 rounded-3xl border shadow-2xl space-y-4 ${
                      submissionResult.passed ? 'bg-emerald-950/40 border-emerald-500/40' : 'bg-red-950/40 border-red-500/40'
                    }`}>
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                            submissionResult.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            <Award className="h-6 w-6" />
                          </div>
                          <div>
                            <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              {submissionResult.passed ? 'PASSED • MODULE MASTERED' : 'NEEDS RETRY'}
                            </span>
                            <h3 className="text-xl font-black text-white mt-1">
                              Score: {submissionResult.percentage}% ({submissionResult.score} Points)
                            </h3>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            setSubmissionResult(null);
                            setStudentAnswers({});
                            setExamActive(true);
                            setExamTimeLeft((moduleExam.time_limit_mins || 15) * 60);
                          }}
                          className="px-4 py-2 rounded-xl bg-[#1e2638] hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2"
                        >
                          <RotateCcw className="h-4 w-4" />
                          <span>Retake Exam</span>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Questions List */}
                  <div className="space-y-4">
                    {moduleExam.questions?.map((q, idx) => {
                      const parsedOptions = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
                      const letters = ['A', 'B', 'C', 'D'];
                      const selectedVal = studentAnswers[q.id];

                      return (
                        <div
                          key={q.id || idx}
                          className="bg-[#121826] border border-[#1e2638] rounded-2xl p-6 space-y-4 shadow-lg"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <span className="h-6 w-6 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-black flex items-center justify-center">
                              {idx + 1}
                            </span>
                            {isEducator && (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                Correct: {q.correct_answer}
                              </span>
                            )}
                          </div>

                          <p className="text-sm font-bold text-white leading-relaxed">
                            {q.question_text}
                          </p>

                          <div className="grid grid-cols-1 gap-2 pt-1">
                            {parsedOptions.map((opt, oIdx) => {
                              const optLetter = letters[oIdx] || String(oIdx);
                              const isSelected = selectedVal === optLetter || selectedVal === String(oIdx);
                              const isCorrect = String(q.correct_answer).toUpperCase() === optLetter;

                              let borderStyle = 'border-[#1e2638] bg-[#0e131f] text-slate-300';
                              if (submissionResult) {
                                if (isCorrect) borderStyle = 'border-emerald-500/60 bg-emerald-950/30 text-emerald-200 font-bold';
                                else if (isSelected && !isCorrect) borderStyle = 'border-red-500/60 bg-red-950/30 text-red-200';
                              } else if (isSelected) {
                                borderStyle = 'border-indigo-500 bg-indigo-600/20 text-white font-bold ring-1 ring-indigo-500';
                              }

                              return (
                                <label
                                  key={oIdx}
                                  onClick={() => {
                                    if (examActive && !submissionResult) {
                                      const isLetterAns = ['A', 'B', 'C', 'D'].includes(String(q.correct_answer).toUpperCase());
                                      handleAnswerOption(q.id, isLetterAns ? optLetter : String(oIdx));
                                    }
                                  }}
                                  className={`flex items-center gap-3 p-3 rounded-xl border text-xs cursor-pointer transition ${borderStyle}`}
                                >
                                  <span className={`h-5 w-5 rounded-lg flex items-center justify-center text-[10px] font-black shrink-0 ${
                                    isSelected ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-400'
                                  }`}>
                                    {optLetter}
                                  </span>
                                  <span className="flex-1">{opt}</span>
                                </label>
                              );
                            })}
                          </div>

                          {(submissionResult || isEducator) && q.explanation && (
                            <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-[#1a2335] text-xs space-y-1">
                              <span className="text-indigo-400 font-bold flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5" /> AI Invariant Explanation:
                              </span>
                              <p className="text-slate-300 leading-relaxed">{q.explanation}</p>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center rounded-3xl bg-[#121826] border border-[#1e2638] space-y-3">
                  <Award className="h-10 w-10 text-amber-400 mx-auto" />
                  <h3 className="text-base font-bold text-white">No Exam Scheduled for this Module</h3>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    {isEducator
                      ? 'You can synthesize conceptual MCQs instantly using our grounded RAG generator.'
                      : 'Review the video concepts and protected lecture notes!'}
                  </p>
                  {isEducator && (
                    <button
                      onClick={() => setShowExamBuilderModal(true)}
                      className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 text-white text-xs font-bold transition inline-flex items-center gap-2"
                    >
                      <Sparkles className="h-4 w-4" />
                      <span>Configure RAG Exam</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
        </main>

        {/* 3. Right Drawer: "Cogni" AI Tutor (RAG Doubt Resolution & Video Injection) */}
        {isCogniOpen && (
          <CogniTutorDrawer
            isOpen={isCogniOpen}
            onClose={() => setIsCogniOpen(false)}
            courseId={courseId}
            currentModule={currentModule}
            currentTopic={activeTopic}
            onInjectSupplementaryVideo={(video) => {
              setEphemeralSecondaryVideo(video);
            }}
          />
        )}
      </div>

      {/* ===================================================================== */}
      {/* EDUCATOR MODALS */}
      {/* ===================================================================== */}
      <ModuleExamBuilder
        isOpen={showExamBuilderModal}
        onClose={() => setShowExamBuilderModal(false)}
        module={currentModule}
        courseId={courseId}
        existingExam={moduleExam}
        onExamSaved={(saved) => {
          setModuleExam(saved);
          fetchHierarchy(courseId);
        }}
      />

      {/* Modal: Add Topic */}
      {showAddTopicModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#131927] border border-[#1e2638] rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Youtube className="h-5 w-5 text-red-500" />
              <span>Add Concept Video</span>
            </h3>
            <form onSubmit={handleAddTopicAction} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400">Topic Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Breadth First Search (BFS)"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400">YouTube URL</label>
                <input
                  type="url"
                  required
                  placeholder="https://www.youtube.com/watch?v=..."
                  value={newTopicUrl}
                  onChange={(e) => setNewTopicUrl(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400">Synopsis</label>
                <textarea
                  rows={2}
                  value={newTopicDesc}
                  onChange={(e) => setNewTopicDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddTopicModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Saving...' : 'Add Video'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Upload Notes */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#131927] border border-[#1e2638] rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-purple-400" />
              <span>Upload PDF Notes</span>
            </h3>
            <form onSubmit={handleUploadNotesAction} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Graph Invariants Reference.pdf"
                  value={resourceTitle}
                  onChange={(e) => setResourceTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400">PDF File</label>
                <input
                  type="file"
                  accept="application/pdf"
                  required
                  onChange={(e) => setResourceFile(e.target.files[0])}
                  className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Uploading...' : 'Upload Notes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Module */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#131927] border border-[#1e2638] rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-400" />
              <span>Add Module</span>
            </h3>
            <form onSubmit={handleAddModuleAction} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400">Module Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Module 3: Advanced Graph Theory"
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400">Description</label>
                <textarea
                  rows={2}
                  value={newModuleDesc}
                  onChange={(e) => setNewModuleDesc(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                />
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModuleModal(false)}
                  className="px-3 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={actionLoading}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold disabled:opacity-50"
                >
                  {actionLoading ? 'Creating...' : 'Create Module'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Course Rating Modal */}
      <CourseRatingModal
        isOpen={showCourseRatingModal}
        onClose={() => setShowCourseRatingModal(false)}
        courseId={courseId}
        courseTitle={hierarchy?.title || 'Course'}
        educatorName={hierarchy?.educator_name || 'Prof. Rajesh Ramanujan'}
        onRatingUpdated={() => {
          if (onRefreshCourses) onRefreshCourses();
        }}
      />
    </div>
  );
}
