import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  BookOpen,
  Award,
  CheckCircle2,
  Circle,
  Clock,
  Lock,
  Sparkles,
  Youtube,
  FileText,
  ChevronRight,
  ChevronLeft,
  ZoomIn,
  ZoomOut,
  Plus,
  ShieldCheck,
  Share2,
  Send,
  RotateCcw,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  RefreshCw,
  Sliders,
  Check,
  FolderPlus,
  UploadCloud,
  Copy,
  ChevronDown,
  HelpCircle,
  Play
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { coursesAPI, examsAPI } from '../services/api';
import CreateCourseModal from './CreateCourseModal';
import ModuleExamBuilder from './ModuleExamBuilder';

export default function CourseTabsPlayer({
  courseId = 1,
  user,
  onNavigateTab,
  courses = [],
  onSelectCourse,
  onRefreshCourses
}) {
  const isEducator = user?.role === 'EDUCATOR';

  // State: Curriculum hierarchy & Tabs summary
  const [hierarchy, setHierarchy] = useState(null);
  const [tabsSummary, setTabsSummary] = useState([]);
  const [loading, setLoading] = useState(true);

  // Active Navigation State (Synchronized with URL params)
  const [activeCourseId, setActiveCourseId] = useState(courseId);
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeTab, setActiveTab] = useState('video'); // 'video' | 'notes' | 'exam'
  const [activeTopic, setActiveTopic] = useState(null);
  const [activeResource, setActiveResource] = useState(null);

  // Topic Completion Tracking
  const [completedTopics, setCompletedTopics] = useState({});

  // PDF Viewer State
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoomScale, setZoomScale] = useState(1.1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const canvasRef = useRef(null);

  // Student Exam Taking State
  const [moduleExam, setModuleExam] = useState(null);
  const [examLoading, setExamLoading] = useState(false);
  const [examActive, setExamActive] = useState(false);
  const [studentAnswers, setStudentAnswers] = useState({}); // question_id -> option letter or index
  const [examTimeLeft, setExamTimeLeft] = useState(900); // 15 mins default
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submittingExam, setSubmittingExam] = useState(false);

  // Modals & Action States
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [showAddModuleModal, setShowAddModuleModal] = useState(false);
  const [showAddTopicModal, setShowAddTopicModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showExamBuilderModal, setShowExamBuilderModal] = useState(false);
  const [showBadgeModal, setShowBadgeModal] = useState(false);
  const [verifiedBadge, setVerifiedBadge] = useState(null);
  const [badgeCopied, setBadgeCopied] = useState(false);
  const [publishToast, setPublishToast] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Form states for modals
  const [newModuleTitle, setNewModuleTitle] = useState('');
  const [newModuleDesc, setNewModuleDesc] = useState('');
  const [newTopicTitle, setNewTopicTitle] = useState('');
  const [newTopicDesc, setNewTopicDesc] = useState('');
  const [newTopicUrl, setNewTopicUrl] = useState('');
  const [resourceTitle, setResourceTitle] = useState('');
  const [resourceFile, setResourceFile] = useState(null);

  // ---------------------------------------------------------------------------
  // 1. URL QUERY PARAM PERSISTENCE (?courseId=...&moduleId=...&tab=...&topicId=...)
  // ---------------------------------------------------------------------------
  const syncToURL = (cId, mId, tTab, topId) => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (cId) params.set('courseId', cId);
      if (mId) params.set('moduleId', mId);
      if (tTab) params.set('tab', tTab);
      if (topId) params.set('topicId', topId);
      else params.delete('topicId');

      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    } catch (e) {
      // Ignore in restricted environments
    }
  };

  // Read URL query params on initial mount
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const qCourseId = params.get('courseId');
      const qModuleId = params.get('moduleId');
      const qTab = params.get('tab');

      if (qCourseId && !isNaN(Number(qCourseId))) {
        setActiveCourseId(Number(qCourseId));
      } else if (courseId) {
        setActiveCourseId(courseId);
      }

      if (qModuleId && !isNaN(Number(qModuleId))) {
        setActiveModuleId(Number(qModuleId));
      }
      if (qTab && ['video', 'notes', 'exam'].includes(qTab)) {
        setActiveTab(qTab);
      }
    } catch (e) {
      // Fallback to prop
      setActiveCourseId(courseId);
    }
  }, []);

  // Update active course if prop changes from parent switcher
  useEffect(() => {
    if (courseId && courseId !== activeCourseId) {
      setActiveCourseId(courseId);
    }
  }, [courseId]);

  // Fetch Hierarchy and Badge when activeCourseId changes
  useEffect(() => {
    if (activeCourseId) {
      fetchCourseHierarchy(activeCourseId);
      loadStudentBadge(activeCourseId);
      loadTabsSummary();
    }
  }, [activeCourseId]);

  const loadTabsSummary = async () => {
    try {
      const data = await coursesAPI.getTabsSummary();
      if (data && data.courses) {
        setTabsSummary(data.courses);
      }
    } catch (err) {
      // Optional fallback
    }
  };

  const fetchCourseHierarchy = async (cId) => {
    try {
      setLoading(true);
      const data = await coursesAPI.getHierarchy(cId);
      setHierarchy(data);

      const params = new URLSearchParams(window.location.search);
      const qModuleId = params.get('moduleId') ? Number(params.get('moduleId')) : null;
      const qTab = params.get('tab');
      const qTopicId = params.get('topicId') ? Number(params.get('topicId')) : null;

      if (data.modules && data.modules.length > 0) {
        // Resolve target module
        const targetModule = qModuleId
          ? data.modules.find((m) => m.id === qModuleId) || data.modules[0]
          : data.modules[0];

        setActiveModuleId(targetModule.id);

        // Resolve active tab
        const resolvedTab = ['video', 'notes', 'exam'].includes(qTab) ? qTab : 'video';
        setActiveTab(resolvedTab);

        // Resolve active topic
        if (targetModule.topics && targetModule.topics.length > 0) {
          const targetTopic = qTopicId
            ? targetModule.topics.find((t) => t.id === qTopicId) || targetModule.topics[0]
            : targetModule.topics[0];
          setActiveTopic(targetTopic);
          syncToURL(cId, targetModule.id, resolvedTab, targetTopic.id);
        } else {
          setActiveTopic(null);
          syncToURL(cId, targetModule.id, resolvedTab, null);
        }

        // Resolve active resource (PDF notes)
        if (targetModule.resources && targetModule.resources.length > 0) {
          setActiveResource(targetModule.resources[0]);
        } else {
          setActiveResource(null);
        }
      } else {
        setActiveModuleId(null);
        setActiveTopic(null);
        setActiveResource(null);
        syncToURL(cId, null, 'video', null);
      }
    } catch (err) {
      console.error('Failed to load course hierarchy:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStudentBadge = async (cId) => {
    if (!user?.id) return;
    try {
      const badges = await examsAPI.getStudentBadges(user.id);
      const courseBadge = badges.find((b) => b.course_id === cId);
      setVerifiedBadge(courseBadge || null);
    } catch (err) {
      // Silent error
    }
  };

  // Active module object
  const currentModule = useMemo(() => {
    if (!hierarchy?.modules || !activeModuleId) return null;
    return hierarchy.modules.find((m) => m.id === activeModuleId) || hierarchy.modules[0];
  }, [hierarchy, activeModuleId]);

  // Load Exam Details when on Exam tab
  useEffect(() => {
    if (activeTab === 'exam' && currentModule) {
      loadModuleExam(currentModule);
    }
  }, [activeTab, currentModule]);

  const loadModuleExam = async (mod) => {
    if (!mod) return;
    try {
      setExamLoading(true);
      setSubmissionResult(null);
      setExamActive(false);
      setStudentAnswers({});

      // If module has an exam attached
      if (mod.module_exam_id) {
        const examData = await examsAPI.get(mod.module_exam_id);
        setModuleExam(examData);
        setExamTimeLeft((examData.time_limit_mins || 15) * 60);
      } else {
        // Check if there is an exam scoped to this module in course exam list
        const courseExams = await examsAPI.listByCourse(activeCourseId);
        const modExam = courseExams.find((e) => e.module_id === mod.id);
        if (modExam) {
          const examData = await examsAPI.get(modExam.id);
          setModuleExam(examData);
          setExamTimeLeft((examData.time_limit_mins || 15) * 60);
        } else {
          setModuleExam(null);
        }
      }
    } catch (err) {
      console.error('Failed to load module exam:', err);
      setModuleExam(null);
    } finally {
      setExamLoading(false);
    }
  };

  // Exam Countdown Timer
  useEffect(() => {
    let timer;
    if (examActive && examTimeLeft > 0 && !submissionResult) {
      timer = setInterval(() => {
        setExamTimeLeft((prev) => {
          if (prev <= 1) {
            handleAutoSubmitExam();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [examActive, examTimeLeft, submissionResult]);

  const handleAutoSubmitExam = () => {
    if (!submissionResult && !submittingExam) {
      handleSubmitExam();
    }
  };

  // ---------------------------------------------------------------------------
  // 2. TAB CLICK HANDLERS (Level 1, Level 2, Level 3)
  // ---------------------------------------------------------------------------
  const handleSelectCourse = (cId) => {
    setActiveCourseId(cId);
    if (onSelectCourse) {
      onSelectCourse(cId);
    }
    syncToURL(cId, null, 'video', null);
  };

  const handleSelectModule = (mId) => {
    setActiveModuleId(mId);
    const mod = hierarchy?.modules?.find((m) => m.id === mId);
    const firstTopic = mod?.topics?.[0] || null;
    const firstRes = mod?.resources?.[0] || null;

    setActiveTopic(firstTopic);
    setActiveResource(firstRes);
    syncToURL(activeCourseId, mId, activeTab, firstTopic?.id || null);

    if (activeTab === 'notes' && firstRes) {
      loadPdf(firstRes);
    } else if (activeTab === 'exam' && mod) {
      loadModuleExam(mod);
    }
  };

  const handleSelectTab = (tabKey) => {
    setActiveTab(tabKey);
    syncToURL(activeCourseId, activeModuleId, tabKey, activeTopic?.id || null);

    if (tabKey === 'notes' && activeResource) {
      loadPdf(activeResource);
    } else if (tabKey === 'exam' && currentModule) {
      loadModuleExam(currentModule);
    }
  };

  const handleSelectTopic = (topic) => {
    setActiveTopic(topic);
    syncToURL(activeCourseId, activeModuleId, 'video', topic.id);
  };

  // Topic Completion Toggle
  const toggleTopicCompleted = (topicId) => {
    setCompletedTopics((prev) => {
      const updated = { ...prev, [topicId]: !prev[topicId] };
      if (updated[topicId]) {
        confetti({
          particleCount: 45,
          spread: 55,
          origin: { y: 0.75 }
        });
      }
      return updated;
    });
  };

  // Calculate Course Progress Percentage
  const courseProgress = useMemo(() => {
    if (!hierarchy?.modules || hierarchy.modules.length === 0) return 0;
    let totalTopics = 0;
    let doneTopics = 0;

    hierarchy.modules.forEach((mod) => {
      if (mod.topics) {
        totalTopics += mod.topics.length;
        mod.topics.forEach((t) => {
          if (completedTopics[t.id]) doneTopics++;
        });
      }
    });

    if (totalTopics === 0) return 0;
    return Math.round((doneTopics / totalTopics) * 100);
  }, [hierarchy, completedTopics]);

  // Calculate Module Completion Status
  const isModuleCompleted = (mod) => {
    if (!mod.topics || mod.topics.length === 0) return false;
    return mod.topics.every((t) => completedTopics[t.id]);
  };

  // ---------------------------------------------------------------------------
  // 3. SECURE PDF VIEWER ENGINE
  // ---------------------------------------------------------------------------
  const loadPdf = async (resource) => {
    if (!resource) return;
    setPdfLoading(true);
    setActiveResource(resource);
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
    if (pdfDoc && activeResource && activeTab === 'notes') {
      renderPdfPage(pageNum, pdfDoc, zoomScale);
    }
  }, [pageNum, zoomScale, activeTab]);

  // ---------------------------------------------------------------------------
  // 4. STUDENT EXAM TAKING & EVALUATION
  // ---------------------------------------------------------------------------
  const handleAnswerChange = (questionId, optionValue) => {
    setStudentAnswers((prev) => ({
      ...prev,
      [questionId]: optionValue
    }));
  };

  const handleSubmitExam = async () => {
    if (!moduleExam) return;
    try {
      setSubmittingExam(true);

      const letters = ['A', 'B', 'C', 'D'];
      const responses = Object.entries(studentAnswers).map(([qid, val]) => {
        // Resolve value matching either option letter or option index
        return {
          question_id: parseInt(qid),
          selected_option: val
        };
      });

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
      console.error('Exam evaluation error:', err);
      alert(err.response?.data?.detail || 'Error evaluating exam answers.');
    } finally {
      setSubmittingExam(false);
    }
  };

  const handleRetakeExam = () => {
    setStudentAnswers({});
    setSubmissionResult(null);
    setExamActive(true);
    setExamTimeLeft((moduleExam?.time_limit_mins || 15) * 60);
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // ---------------------------------------------------------------------------
  // 5. EDUCATOR CURRICULUM MANAGEMENT
  // ---------------------------------------------------------------------------
  const handleCreateModule = async (e) => {
    e.preventDefault();
    if (!newModuleTitle.trim()) return;
    try {
      setActionLoading(true);
      const created = await coursesAPI.createModule(activeCourseId, {
        title: newModuleTitle.trim(),
        description: newModuleDesc.trim()
      });
      setNewModuleTitle('');
      setNewModuleDesc('');
      setShowAddModuleModal(false);
      await fetchCourseHierarchy(activeCourseId);
      if (created?.id) {
        setActiveModuleId(created.id);
      }
    } catch (err) {
      alert('Failed to create module');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCreateTopic = async (e) => {
    e.preventDefault();
    if (!activeModuleId || !newTopicTitle.trim() || !newTopicUrl.trim()) return;
    try {
      setActionLoading(true);
      await coursesAPI.createTopic(activeModuleId, {
        title: newTopicTitle.trim(),
        description: newTopicDesc.trim(),
        youtube_url: newTopicUrl.trim()
      });
      setNewTopicTitle('');
      setNewTopicDesc('');
      setNewTopicUrl('');
      setShowAddTopicModal(false);
      await fetchCourseHierarchy(activeCourseId);
    } catch (err) {
      alert('Failed to add topic. Check YouTube link.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadResource = async (e) => {
    e.preventDefault();
    if (!activeModuleId || !resourceTitle.trim() || !resourceFile) return;
    try {
      setActionLoading(true);
      const formData = new FormData();
      formData.append('title', resourceTitle.trim());
      formData.append('file', resourceFile);
      await coursesAPI.uploadResource(activeModuleId, formData);
      setResourceTitle('');
      setResourceFile(null);
      setShowUploadModal(false);
      await fetchCourseHierarchy(activeCourseId);
      setActiveTab('notes');
    } catch (err) {
      alert('Failed to upload notes.');
    } finally {
      setActionLoading(false);
    }
  };

  const handlePublishCourse = () => {
    confetti({
      particleCount: 75,
      spread: 60,
      origin: { y: 0.6 }
    });
    setPublishToast(`🎉 "${hierarchy?.title || 'Course'}" is live and posted to students!`);
    setTimeout(() => setPublishToast(null), 4000);
  };

  const handleCourseCreated = async (newCourse) => {
    setShowCreateCourseModal(false);
    if (onRefreshCourses) {
      await onRefreshCourses();
    }
    if (newCourse?.id) {
      handleSelectCourse(newCourse.id);
    }
    setPublishToast(`🚀 Course "${newCourse?.title || 'New Course'}" created successfully!`);
    setTimeout(() => setPublishToast(null), 4000);
  };

  const handleExamSaved = async (savedExam, moduleId) => {
    setPublishToast(`📝 Module Exam linked successfully to ${currentModule?.title || 'Module'}!`);
    setTimeout(() => setPublishToast(null), 4000);
    await fetchCourseHierarchy(activeCourseId);
    setActiveTab('exam');
    setModuleExam(savedExam);
  };

  const handleCopyVerification = () => {
    if (!verifiedBadge?.verification_hash) return;
    const verifyUrl = `${window.location.origin}/api/v1/courses/badges/verify/${verifiedBadge.verification_hash}`;
    navigator.clipboard.writeText(verifyUrl);
    setBadgeCopied(true);
    setTimeout(() => setBadgeCopied(false), 2500);
  };

  // Loading Screen
  if (loading && !hierarchy) {
    return (
      <div className="h-full flex items-center justify-center p-12 text-slate-400 bg-[#0b0f19]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-xs font-semibold text-slate-400">Loading tabbed course workspace...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-[#0b0f19] text-slate-100 overflow-hidden select-none relative">
      {/* Toast Notification */}
      {publishToast && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-2xl bg-emerald-950/90 border border-emerald-500/50 text-emerald-200 text-xs font-bold shadow-2xl flex items-center gap-2.5 backdrop-blur-md animate-bounce">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>{publishToast}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* LEVEL 1: COURSE HORIZONTAL TABS (TOP BAR) */}
      {/* ========================================================================= */}
      <header className="border-b border-[#1e2638] bg-[#0d121f] px-6 py-2.5 flex items-center justify-between gap-4 shrink-0 shadow-md">
        {/* Scrollable Horizontal Course Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto py-1 scrollbar-none max-w-4xl">
          {courses && courses.length > 0 ? (
            courses.map((c) => {
              const isActive = c.id === activeCourseId;
              return (
                <button
                  key={c.id}
                  onClick={() => handleSelectCourse(c.id)}
                  className={`flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border border-indigo-500 text-white shadow-lg shadow-indigo-500/10 ring-1 ring-indigo-400/40'
                      : 'bg-[#121826] hover:bg-[#182133] border border-[#20293d] text-slate-300 hover:text-white'
                  }`}
                  title={c.title}
                >
                  <span className={`text-[10px] font-extrabold uppercase px-1.5 py-0.5 rounded ${
                    isActive ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {c.code || 'CS'}
                  </span>
                  <span className="truncate max-w-[150px] sm:max-w-[200px]">{c.title}</span>
                  {/* Miniature Progress Pill */}
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                      : 'bg-slate-800/80 text-slate-400'
                  }`}>
                    {isActive ? `${courseProgress}%` : '0%'}
                  </span>
                </button>
              );
            })
          ) : (
            <div className="text-xs text-slate-400 font-semibold px-2">No courses enrolled</div>
          )}

          {/* "+ New Course" Button (Visible to Educators) */}
          {isEducator && (
            <button
              onClick={() => setShowCreateCourseModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition shadow-md shadow-indigo-600/30 shrink-0"
              title="Create a brand new course"
            >
              <Plus className="h-4 w-4" />
              <span>New Course</span>
            </button>
          )}
        </div>

        {/* Course Action Utilities (Badge / Publish) */}
        <div className="flex items-center gap-2.5 shrink-0">
          {verifiedBadge ? (
            <button
              onClick={() => setShowBadgeModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-500/20 to-purple-500/20 border border-amber-500/40 text-amber-300 hover:text-amber-200 text-xs font-bold transition shadow-sm"
            >
              <Award className="h-4 w-4 text-amber-400" />
              <span className="hidden sm:inline">Verified Credential</span>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
            </button>
          ) : (
            <button
              onClick={() => onNavigateTab && onNavigateTab('exam-studio', activeCourseId)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/10 hover:bg-indigo-600/20 border border-indigo-500/20 text-indigo-300 text-xs font-bold transition"
            >
              <Award className="h-4 w-4 text-indigo-400" />
              <span className="hidden sm:inline">Final Exam</span>
            </button>
          )}

          {isEducator && (
            <button
              onClick={handlePublishCourse}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 hover:text-emerald-200 text-xs font-bold transition"
              title="Post course live"
            >
              <Send className="h-3.5 w-3.5 text-emerald-400" />
              <span className="hidden sm:inline">Post Course</span>
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
            </button>
          )}
        </div>
      </header>

      {/* ========================================================================= */}
      {/* LEVEL 2: SUB-NAVIGATION BAR (MODULE HORIZONTAL TABS) */}
      {/* ========================================================================= */}
      <nav className="border-b border-[#1e2638] bg-[#0a0e18] px-6 py-2 flex items-center justify-between gap-3 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-2.5 overflow-x-auto scrollbar-none py-1">
          {(!hierarchy?.modules || hierarchy.modules.length === 0) ? (
            <span className="text-xs text-slate-500 font-medium italic">
              No modules created yet. Add a module to structure the curriculum.
            </span>
          ) : (
            hierarchy.modules.map((mod, idx) => {
              const isActive = mod.id === activeModuleId;
              const isDone = isModuleCompleted(mod);
              const hasExam = Boolean(mod.has_module_exam || mod.module_exam_id);

              return (
                <button
                  key={mod.id}
                  onClick={() => handleSelectModule(mod.id)}
                  className={`group flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-indigo-600/25 border border-indigo-400/60 text-white shadow-md shadow-indigo-500/10'
                      : 'bg-[#101625] hover:bg-[#161e33] border border-[#1e273b] text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {/* Completion or Module Number Icon */}
                  {isDone ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <span className={`h-4 w-4 rounded-full flex items-center justify-center text-[10px] font-black shrink-0 ${
                      isActive ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                    }`}>
                      {idx + 1}
                    </span>
                  )}

                  <span className="truncate max-w-[180px]">{mod.title}</span>

                  {/* Active Badge: Module Exam */}
                  {hasExam && (
                    <span className="text-[9px] font-black px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40 flex items-center gap-1 shrink-0">
                      <span>📝</span>
                      <span className="hidden md:inline">Exam</span>
                    </span>
                  )}
                </button>
              );
            })
          )}

          {/* Educator Add Module Button */}
          {isEducator && (
            <button
              onClick={() => setShowAddModuleModal(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#141c2c] hover:bg-[#1d273d] text-slate-300 hover:text-white text-xs font-bold transition border border-dashed border-[#2d3952] shrink-0"
              title="Add a new module to this course"
            >
              <Plus className="h-3.5 w-3.5 text-indigo-400" />
              <span>Add Module</span>
            </button>
          )}
        </div>

        {/* Course & Module Info Pill */}
        {currentModule && (
          <div className="hidden lg:flex items-center gap-2 text-xs text-slate-400 shrink-0">
            <span className="text-indigo-400 font-semibold">{hierarchy?.title}</span>
            <span>•</span>
            <span className="text-slate-300 font-bold">{currentModule.title}</span>
          </div>
        )}
      </nav>

      {/* ========================================================================= */}
      {/* LEVEL 3: CONTENT PANE (SEGMENTED SUB-TABS & WORKSPACE) */}
      {/* ========================================================================= */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Level 3 Sub-Navigation Segmented Tabs */}
        <div className="border-b border-[#1a2335] bg-[#0c101c] px-6 py-2 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-1.5 bg-[#080b13] p-1 rounded-xl border border-[#1a2335]">
            {/* Sub-tab 1: Video Lectures */}
            <button
              onClick={() => handleSelectTab('video')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'video'
                  ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#121826]'
              }`}
            >
              <Youtube className={`h-3.5 w-3.5 ${activeTab === 'video' ? 'text-white' : 'text-red-400'}`} />
              <span>Video Lectures</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'video' ? 'bg-indigo-800 text-indigo-200' : 'bg-slate-800 text-slate-400'
              }`}>
                {currentModule?.topics?.length || 0}
              </span>
            </button>

            {/* Sub-tab 2: Protected PDF Notes */}
            <button
              onClick={() => handleSelectTab('notes')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'notes'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#121826]'
              }`}
            >
              <FileText className={`h-3.5 w-3.5 ${activeTab === 'notes' ? 'text-white' : 'text-purple-400'}`} />
              <span>Protected PDF Notes</span>
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                activeTab === 'notes' ? 'bg-purple-800 text-purple-200' : 'bg-slate-800 text-slate-400'
              }`}>
                {currentModule?.resources?.length || 0}
              </span>
            </button>

            {/* Sub-tab 3: Module End Exam */}
            <button
              onClick={() => handleSelectTab('exam')}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeTab === 'exam'
                  ? 'bg-amber-600 text-white shadow-md shadow-amber-600/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-[#121826]'
              }`}
            >
              <Award className={`h-3.5 w-3.5 ${activeTab === 'exam' ? 'text-white' : 'text-amber-400'}`} />
              <span>Module End Exam</span>
              {(currentModule?.has_module_exam || currentModule?.module_exam_id || moduleExam) && (
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              )}
            </button>
          </div>

          {/* Level 3 Context Actions */}
          <div className="flex items-center gap-2">
            {isEducator && activeTab === 'video' && (
              <button
                onClick={() => setShowAddTopicModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 text-indigo-300 text-xs font-bold transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Video Concept</span>
              </button>
            )}

            {isEducator && activeTab === 'notes' && (
              <button
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 text-purple-300 text-xs font-bold transition"
              >
                <UploadCloud className="h-3.5 w-3.5" />
                <span>Upload PDF Notes</span>
              </button>
            )}

            {isEducator && activeTab === 'exam' && (
              <button
                onClick={() => setShowExamBuilderModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-amber-600 to-purple-600 hover:from-amber-500 hover:to-purple-500 text-white text-xs font-bold transition shadow-md shadow-amber-600/20"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{moduleExam ? 'Configure Exam' : 'Build RAG Exam'}</span>
              </button>
            )}
          </div>
        </div>

        {/* ----------------------------------------------------------------------- */}
        {/* TAB 1 CONTENT: VIDEO LECTURES */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === 'video' && (
          <div className="flex-1 flex flex-col overflow-y-auto p-6 space-y-5">
            {/* Topic Picker Ribbon (if multiple topics) */}
            {currentModule?.topics && currentModule.topics.length > 0 && (
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider shrink-0 mr-1">
                  Topics:
                </span>
                {currentModule.topics.map((topic, tIdx) => {
                  const isSelected = activeTopic?.id === topic.id;
                  const isDone = completedTopics[topic.id];
                  return (
                    <button
                      key={topic.id}
                      onClick={() => handleSelectTopic(topic)}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                        isSelected
                          ? 'bg-indigo-600/30 border border-indigo-400 text-white'
                          : 'bg-[#121826] hover:bg-[#182133] border border-[#20293d] text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                      )}
                      <span>Topic {tIdx + 1}: {topic.title}</span>
                    </button>
                  );
                })}
              </div>
            )}

            {activeTopic ? (
              <div className="space-y-6 max-w-6xl mx-auto w-full">
                {/* 16:9 YouTube Player Canvas */}
                <div className="w-full aspect-video rounded-2xl overflow-hidden bg-black shadow-2xl border border-[#1e2638] relative">
                  <iframe
                    className="w-full h-full"
                    src={`https://www.youtube-nocookie.com/embed/${activeTopic.youtube_video_id || 'qH6clASSS54'}?autoplay=0&rel=0&modestbranding=1`}
                    title={activeTopic.title}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>

                {/* Video Info Ribbon & Student Completion Actions */}
                <div className="bg-[#121826] rounded-2xl border border-[#1e2638] p-6 space-y-4 shadow-xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-2 text-xs font-bold text-indigo-400 mb-1">
                        <Youtube className="h-4 w-4 text-red-500" />
                        <span>Lecture Topic #{activeTopic.order_index}</span>
                      </div>
                      <h2 className="text-xl font-black text-white">{activeTopic.title}</h2>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => toggleTopicCompleted(activeTopic.id)}
                        className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition shadow-md ${
                          completedTopics[activeTopic.id]
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#1e2638] hover:bg-slate-700 text-slate-200'
                        }`}
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        <span>{completedTopics[activeTopic.id] ? 'Completed' : 'Mark as Completed'}</span>
                      </button>

                      <button
                        onClick={() => onNavigateTab && onNavigateTab('tutor', activeCourseId)}
                        className="px-4 py-2 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/40 text-xs font-bold flex items-center gap-2 transition"
                      >
                        <Sparkles className="h-4 w-4 text-purple-400" />
                        <span>Ask AI Tutor</span>
                      </button>
                    </div>
                  </div>

                  <div className="text-xs text-slate-300 leading-relaxed bg-[#0b0f19]/80 rounded-xl p-4 border border-[#1a2335]">
                    <p className="font-semibold text-slate-200 mb-1">Concept Synopsis:</p>
                    <p>{activeTopic.description || 'Comprehensive conceptual overview and architectural implementation invariants.'}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-12 text-center text-slate-500 space-y-3">
                <Youtube className="h-12 w-12 text-slate-600" />
                <p className="text-sm font-bold text-slate-300">No Video Lectures in this Module</p>
                <p className="text-xs text-slate-500 max-w-sm">
                  {isEducator
                    ? 'Click "+ Add Video Concept" above to attach educational videos with automatic YouTube ID extraction.'
                    : 'Your educator has not uploaded lecture recordings for this module yet.'}
                </p>
                {isEducator && (
                  <button
                    onClick={() => setShowAddTopicModal(true)}
                    className="mt-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    <span>Add First Video</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* TAB 2 CONTENT: PROTECTED PDF NOTES */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === 'notes' && (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#090d16]">
            {/* PDF Top Controls Bar */}
            <div className="h-14 border-b border-[#1e2638] bg-[#101625] px-6 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <Lock className="h-4 w-4" />
                </div>
                <div>
                  {currentModule?.resources && currentModule.resources.length > 1 ? (
                    <select
                      value={activeResource?.id || ''}
                      onChange={(e) => {
                        const res = currentModule.resources.find((r) => r.id === Number(e.target.value));
                        if (res) loadPdf(res);
                      }}
                      className="bg-[#0b0f19] border border-[#232b3d] text-white text-xs font-bold rounded-lg px-2.5 py-1 outline-none"
                    >
                      {currentModule.resources.map((r) => (
                        <option key={r.id} value={r.id}>{r.title}</option>
                      ))}
                    </select>
                  ) : (
                    <h3 className="text-xs font-extrabold text-white truncate max-w-sm">
                      {activeResource?.title || 'Lecture Reference Document'}
                    </h3>
                  )}
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 font-semibold">
                    <span className="text-emerald-400">Protected Canvas View</span>
                    <span>•</span>
                    <span>Text selection & download disabled</span>
                  </div>
                </div>
              </div>

              {/* Pagination & Zoom Controls */}
              {activeResource && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 bg-[#0b0f19] px-2 py-1 rounded-lg border border-[#1e2638] text-xs font-bold">
                    <button
                      disabled={pageNum <= 1}
                      onClick={() => setPageNum((p) => Math.max(1, p - 1))}
                      className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    <span className="px-2 text-slate-300">
                      {pageNum} / {totalPages}
                    </span>
                    <button
                      disabled={pageNum >= totalPages}
                      onClick={() => setPageNum((p) => Math.min(totalPages, p + 1))}
                      className="p-1 rounded text-slate-400 hover:text-white disabled:opacity-30"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1 bg-[#0b0f19] px-2 py-1 rounded-lg border border-[#1e2638] text-xs font-bold">
                    <button
                      onClick={() => setZoomScale((s) => Math.max(0.8, s - 0.2))}
                      className="p-1 rounded text-slate-400 hover:text-white"
                      title="Zoom Out"
                    >
                      <ZoomOut className="h-4 w-4" />
                    </button>
                    <span className="px-1 text-[11px] text-slate-400">{Math.round(zoomScale * 100)}%</span>
                    <button
                      onClick={() => setZoomScale((s) => Math.min(2.0, s + 0.2))}
                      className="p-1 rounded text-slate-400 hover:text-white"
                      title="Zoom In"
                    >
                      <ZoomIn className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Canvas Viewport with Anti-Copy Watermark Grid */}
            <div
              className="flex-1 overflow-auto flex items-center justify-center p-8 relative select-none"
              onContextMenu={(e) => e.preventDefault()}
              style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
            >
              {pdfLoading ? (
                <div className="flex flex-col items-center gap-2 text-slate-400">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-purple-500 border-t-transparent" />
                  <span className="text-xs font-semibold">Decrypting and securely rendering document...</span>
                </div>
              ) : activeResource ? (
                <div className="relative shadow-2xl rounded-lg overflow-hidden border border-[#2b354d] bg-white">
                  <canvas ref={canvasRef} className="block pointer-events-none" />

                  {/* Watermark Overlay */}
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
              ) : (
                <div className="text-center p-12 space-y-3">
                  <FileText className="h-12 w-12 text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">No PDF Notes Uploaded for this Module</p>
                  <p className="text-xs text-slate-500 max-w-sm">
                    {isEducator
                      ? 'Upload PDF lecture notes or research papers. They will be automatically indexed for RAG question generation.'
                      : 'Reference notes have not been published for this module yet.'}
                  </p>
                  {isEducator && (
                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="mt-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition inline-flex items-center gap-2"
                    >
                      <UploadCloud className="h-4 w-4" />
                      <span>Upload PDF Notes</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ----------------------------------------------------------------------- */}
        {/* TAB 3 CONTENT: MODULE END EXAM (INTERACTIVE TEST OR EDUCATOR PREVIEW) */}
        {/* ----------------------------------------------------------------------- */}
        {activeTab === 'exam' && (
          <div className="flex-1 flex flex-col overflow-y-auto p-6 bg-[#090d16]">
            {examLoading ? (
              <div className="h-full flex items-center justify-center p-12 text-slate-400">
                <div className="flex flex-col items-center gap-2">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-amber-500 border-t-transparent" />
                  <span className="text-xs font-semibold">Loading assessment environment...</span>
                </div>
              </div>
            ) : moduleExam ? (
              <div className="max-w-4xl mx-auto w-full space-y-6">
                {/* Exam Title & Status Banner */}
                <div className="bg-[#121826] border border-[#1e2638] rounded-2xl p-6 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] uppercase font-extrabold px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
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
                    <p className="text-xs text-slate-400 mt-1">
                      Passing Grade Requirement: <span className="text-emerald-400 font-bold">{moduleExam.passing_score}%</span>
                    </p>
                  </div>

                  {/* Actions depending on Role & Test State */}
                  <div className="flex items-center gap-3">
                    {isEducator ? (
                      <button
                        onClick={() => setShowExamBuilderModal(true)}
                        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-indigo-600/30"
                      >
                        <Sparkles className="h-4 w-4" />
                        <span>Edit / Reconfigure RAG</span>
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
                          <span>{formatTimer(examTimeLeft)}</span>
                        </div>
                        <button
                          onClick={handleSubmitExam}
                          disabled={submittingExam}
                          className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-emerald-600/30 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                          <span>{submittingExam ? 'Grading...' : 'Submit Exam'}</span>
                        </button>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* Scorecard Results Banner (If Submitted) */}
                {submissionResult && (
                  <div className={`p-6 rounded-2xl border shadow-2xl space-y-4 ${
                    submissionResult.passed
                      ? 'bg-emerald-950/40 border-emerald-500/40'
                      : 'bg-red-950/40 border-red-500/40'
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${
                          submissionResult.passed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                        }`}>
                          <Award className="h-6 w-6" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded ${
                              submissionResult.passed
                                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                : 'bg-red-500/20 text-red-300 border border-red-500/40'
                            }`}>
                              {submissionResult.passed ? 'PASSED • MODULE MASTERED' : 'NEEDS PRACTICE'}
                            </span>
                          </div>
                          <h3 className="text-xl font-black text-white mt-1">
                            Score: {submissionResult.percentage}% ({submissionResult.score} Points)
                          </h3>
                        </div>
                      </div>

                      <button
                        onClick={handleRetakeExam}
                        className="px-4 py-2 rounded-xl bg-[#1e2638] hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-2 self-start sm:self-auto"
                      >
                        <RotateCcw className="h-4 w-4" />
                        <span>Retake Exam</span>
                      </button>
                    </div>

                    <p className="text-xs text-slate-300 leading-relaxed">
                      {submissionResult.passed
                        ? 'Outstanding work! You have proven mastery of the concepts and invariants presented in this module.'
                        : `Your score is below the ${moduleExam.passing_score}% passing threshold. Review the explanations below and practice again.`}
                    </p>
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
                          <div className="flex items-center gap-2">
                            <span className="h-6 w-6 rounded-lg bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-xs font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-[10px] uppercase font-bold text-slate-500">
                              {q.source_ref || 'Curriculum Concept'}
                            </span>
                          </div>
                          {/* Educator view indicator */}
                          {isEducator && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                              Correct: {q.correct_answer}
                            </span>
                          )}
                        </div>

                        <p className="text-sm font-bold text-white leading-relaxed">
                          {q.question_text}
                        </p>

                        {/* Options Buttons */}
                        <div className="grid grid-cols-1 gap-2.5 pt-1">
                          {parsedOptions.map((opt, oIdx) => {
                            const optLetter = letters[oIdx] || String(oIdx);
                            const isSelected = selectedVal === optLetter || selectedVal === String(oIdx);

                            // In evaluation mode: highlight correct vs wrong
                            const isCorrectOpt =
                              String(q.correct_answer).toUpperCase() === optLetter ||
                              String(q.correct_answer) === String(oIdx);

                            let borderStyle = 'border-[#1e2638] hover:border-slate-600 bg-[#0e131f] text-slate-300';
                            if (submissionResult) {
                              if (isCorrectOpt) {
                                borderStyle = 'border-emerald-500/60 bg-emerald-950/30 text-emerald-200 font-bold';
                              } else if (isSelected && !isCorrectOpt) {
                                borderStyle = 'border-red-500/60 bg-red-950/30 text-red-200';
                              }
                            } else if (isSelected) {
                              borderStyle = 'border-indigo-500 bg-indigo-600/20 text-white font-bold ring-1 ring-indigo-500';
                            }

                            return (
                              <label
                                key={oIdx}
                                onClick={() => {
                                  if (examActive && !submissionResult) {
                                    // Match correct answer convention
                                    const isLetterAnswer = ['A', 'B', 'C', 'D'].includes(String(q.correct_answer).toUpperCase());
                                    handleAnswerChange(q.id, isLetterAnswer ? optLetter : String(oIdx));
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

                        {/* Explanation & Source Reference (Shown after Submission or in Educator Preview) */}
                        {(submissionResult || isEducator) && q.explanation && (
                          <div className="p-3.5 rounded-xl bg-[#0b0f19] border border-[#1a2335] text-xs space-y-1">
                            <div className="flex items-center gap-1.5 text-indigo-400 font-bold">
                              <Sparkles className="h-3.5 w-3.5" />
                              <span>AI Invariant Explanation:</span>
                            </div>
                            <p className="text-slate-300 leading-relaxed">{q.explanation}</p>
                            {q.source_ref && (
                              <p className="text-[10px] text-slate-500 pt-1">Source: {q.source_ref}</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="max-w-md mx-auto text-center my-auto p-8 rounded-3xl bg-[#121826] border border-[#1e2638] space-y-4 shadow-2xl">
                <div className="mx-auto w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                  <Award className="h-7 w-7" />
                </div>
                <div>
                  <h3 className="text-base font-black text-white">No End-of-Module Exam Linked</h3>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    {isEducator
                      ? 'This module does not have an assessment configured yet. You can use our grounded RAG generator to synthesize conceptual MCQs instantly from lecture notes.'
                      : 'Your educator has not scheduled a module-end examination for this unit yet. Review the video concepts and notes!'}
                  </p>
                </div>
                {isEducator && (
                  <button
                    onClick={() => setShowExamBuilderModal(true)}
                    className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-amber-500/25"
                  >
                    <Sparkles className="h-4 w-4" />
                    <span>Generate Assessment with RAG</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODALS */}
      {/* ========================================================================= */}

      {/* 1. Module Exam Builder (RAG Pipeline & Review Drawer) */}
      <ModuleExamBuilder
        isOpen={showExamBuilderModal}
        onClose={() => setShowExamBuilderModal(false)}
        module={currentModule}
        courseId={activeCourseId}
        existingExam={moduleExam}
        onExamSaved={handleExamSaved}
      />

      {/* 2. Create Course Wizard */}
      <CreateCourseModal
        isOpen={showCreateCourseModal}
        onClose={() => setShowCreateCourseModal(false)}
        onCourseCreated={handleCourseCreated}
      />

      {/* 3. Add Module Modal */}
      {showAddModuleModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#131927] border border-[#1e2638] rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Plus className="h-5 w-5 text-indigo-400" />
              <span>Add Curriculum Module</span>
            </h3>
            <form onSubmit={handleCreateModule} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400">Module Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Module 2: Binary Search Trees & AVL Rotations"
                  value={newModuleTitle}
                  onChange={(e) => setNewModuleTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400">Description</label>
                <textarea
                  rows={3}
                  placeholder="Synopsis of core algorithmic invariants..."
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

      {/* 4. Add Concept Video Modal */}
      {showAddTopicModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#131927] border border-[#1e2638] rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <Youtube className="h-5 w-5 text-red-500" />
              <span>Add Concept Video Lecture</span>
            </h3>
            <form onSubmit={handleCreateTopic} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400">Topic Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. In-Order & Post-Order Tree Traversal"
                  value={newTopicTitle}
                  onChange={(e) => setNewTopicTitle(e.target.value)}
                  className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-400">YouTube Video URL</label>
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
                <label className="text-[11px] font-bold text-slate-400">Concept Notes</label>
                <textarea
                  rows={2}
                  placeholder="Key algorithmic points and complexity..."
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
                  {actionLoading ? 'Saving...' : 'Add Topic'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 5. Upload PDF Notes Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#131927] border border-[#1e2638] rounded-2xl p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-extrabold text-white flex items-center gap-2">
              <UploadCloud className="h-5 w-5 text-purple-400" />
              <span>Upload Secure PDF Notes</span>
            </h3>
            <form onSubmit={handleUploadResource} className="space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400">Document Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Balanced Trees & Red-Black Invariants.pdf"
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
                  className="w-full mt-1 px-3 py-2 bg-[#0b0f19] border border-[#1e2638] rounded-xl text-xs text-slate-300 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-purple-600 file:text-white hover:file:bg-purple-500"
                />
                <span className="text-[10px] text-slate-500">Document will be encrypted and indexed into ChromaDB for RAG inquiries.</span>
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

      {/* 6. Verified Digital Credential Modal */}
      {showBadgeModal && verifiedBadge && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#121826] border border-amber-500/40 p-8 shadow-2xl relative space-y-6 text-center">
            <div className="mx-auto w-24 h-24 rounded-3xl bg-gradient-to-tr from-amber-500 via-purple-600 to-indigo-500 p-1 shadow-2xl shadow-amber-500/30">
              <div className="w-full h-full rounded-[22px] bg-[#0b0f19] flex items-center justify-center">
                <Award className="h-12 w-12 text-amber-400 animate-pulse" />
              </div>
            </div>

            <div>
              <span className="text-[10px] uppercase tracking-widest font-black text-amber-400 bg-amber-500/10 px-3 py-1 rounded-full border border-amber-500/20">
                Official Digital Credential
              </span>
              <h2 className="text-2xl font-black text-white mt-3">{verifiedBadge.badge_name}</h2>
              <p className="text-xs text-slate-400 mt-1 font-semibold">
                Awarded to <span className="text-white font-extrabold">{user?.full_name}</span> for comprehensive mastery of {hierarchy?.title}.
              </p>
            </div>

            <div className="bg-[#0b0f19] rounded-2xl p-4 border border-[#1e2638] text-left space-y-2">
              <div className="flex items-center justify-between text-[11px] font-bold text-slate-400">
                <span>Tamper-Proof Verification Hash</span>
                <span className="text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5" /> SHA-256 Verified
                </span>
              </div>
              <div className="font-mono text-[10px] text-slate-300 break-all bg-[#121826] p-2 rounded-lg border border-[#232b3d]">
                {verifiedBadge.verification_hash}
              </div>
              <div className="text-[10px] text-slate-500 flex items-center justify-between pt-1">
                <span>Issued on: {new Date(verifiedBadge.issued_at).toLocaleDateString()}</span>
                <span>Track: {hierarchy?.code}</span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleCopyVerification}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 to-purple-600 hover:from-amber-400 hover:to-purple-500 text-white font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-amber-500/20"
              >
                {badgeCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                <span>{badgeCopied ? 'Verification Link Copied!' : 'Copy Verification URL'}</span>
              </button>
              <button
                onClick={() => setShowBadgeModal(false)}
                className="py-3 px-5 rounded-xl bg-[#1e2638] hover:bg-slate-700 text-slate-300 font-bold text-xs transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
