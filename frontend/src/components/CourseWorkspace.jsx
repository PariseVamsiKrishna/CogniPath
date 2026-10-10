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
  Star,
  ShieldCheck,
  AlertTriangle,
  RotateCw
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { coursesAPI, examsAPI } from '../services/api';
import CurriculumTreeSidebar from './CurriculumTreeSidebar';
import SupplementaryVideoPlayer from './SupplementaryVideoPlayer';
import CogniTutorDrawer from './CogniTutorDrawer';
import ModuleExamBuilder from './ModuleExamBuilder';
import CourseRatingModal from './CourseRatingModal';

export function normalizeQuestionOptions(rawOptions) {
  if (!rawOptions) return [];
  if (Array.isArray(rawOptions)) return rawOptions.map(String);
  if (typeof rawOptions === 'string') {
    const trimmed = rawOptions.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map(String);
      if (typeof parsed === 'object' && parsed !== null) return Object.values(parsed).map(String);
      return [String(parsed)];
    } catch (_) {
      try {
        const cleanJson = trimmed.replace(/'/g, '"');
        const parsed = JSON.parse(cleanJson);
        if (Array.isArray(parsed)) return parsed.map(String);
      } catch (_) {}
      if (trimmed.includes('\n')) {
        return trimmed.split('\n').map((s) => s.trim()).filter(Boolean);
      }
      return [trimmed];
    }
  }
  return [];
}

export default function CourseWorkspace({
  courseId,
  user,
  isEnrolled = true,
  onEnrollCourse,
  onBackToCourses,
  onNavigateTab,
  onRefreshCourses
}) {
  const isEducator = user?.role === 'EDUCATOR';
  const [localEnrolled, setLocalEnrolled] = useState(isEnrolled);
  const [enrollingLocal, setEnrollingLocal] = useState(false);

  useEffect(() => {
    setLocalEnrolled(isEnrolled);
  }, [isEnrolled]);

  const handleEnrollInCourse = async () => {
    try {
      setEnrollingLocal(true);
      if (onEnrollCourse) {
        await onEnrollCourse(courseId);
      } else {
        await coursesAPI.enroll(courseId);
      }
      setLocalEnrolled(true);
      if (onRefreshCourses) {
        await onRefreshCourses();
      }
    } catch (err) {
      console.error('Enrollment error:', err);
    } finally {
      setEnrollingLocal(false);
    }
  };

  // Hierarchy and Course State
  const [hierarchy, setHierarchy] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hierarchyError, setHierarchyError] = useState(null);
  const hierarchyReqIdRef = useRef(0);
  const isCourseOwner = user?.role === 'ADMIN' || (isEducator && hierarchy && String(hierarchy.educator_id) === String(user?.id));

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
  const [completingTopicId, setCompletingTopicId] = useState(null);

  // Protected PDF Viewer State
  const [pdfDoc, setPdfDoc] = useState(null);
  const [pageNum, setPageNum] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [zoomScale, setZoomScale] = useState(1.1);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState(null);
  const canvasRef = useRef(null);
  const renderTaskRef = useRef(null);
  const pdfReqIdRef = useRef(0);

  // Module Exam Taking State
  const [moduleExam, setModuleExam] = useState(null);
  const [examLoading, setExamLoading] = useState(false);
  const [examActive, setExamActive] = useState(false);
  const [studentAnswers, setStudentAnswers] = useState({});
  const studentAnswersRef = useRef({});
  const handleSubmitExamRef = useRef(null);
  const isSubmittingExamRef = useRef(false);
  const timerSubmittedRef = useRef(false);
  const [examTimeLeft, setExamTimeLeft] = useState(900);
  const [submissionResult, setSubmissionResult] = useState(null);
  const [submittingExam, setSubmittingExam] = useState(false);
  const [generatingExamRAG, setGeneratingExamRAG] = useState(false);
  const [creatingFinalExam, setCreatingFinalExam] = useState(false);
  const [isFinalExam, setIsFinalExam] = useState(false);

  useEffect(() => {
    studentAnswersRef.current = studentAnswers;
  }, [studentAnswers]);

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

  // URL Helper Functions
  const getUrlParams = () => {
    try {
      return new URLSearchParams(window.location.search);
    } catch (_) {
      return new URLSearchParams();
    }
  };

  const syncUrlState = (updates = {}) => {
    try {
      const params = getUrlParams();
      if (courseId) params.set('courseId', courseId);
      if (updates.moduleId !== undefined) {
        if (updates.moduleId) params.set('moduleId', updates.moduleId);
        else params.delete('moduleId');
      }
      if (updates.topicId !== undefined) {
        if (updates.topicId) params.set('topicId', updates.topicId);
        else params.delete('topicId');
      }
      if (updates.resourceId !== undefined) {
        if (updates.resourceId) params.set('resourceId', updates.resourceId);
        else params.delete('resourceId');
      }
      if (updates.view !== undefined) {
        if (updates.view) params.set('view', updates.view);
        else params.delete('view');
      }
      if (updates.isFinalExam !== undefined) {
        if (updates.isFinalExam) params.set('isFinalExam', 'true');
        else params.delete('isFinalExam');
      }
      const queryStr = params.toString();
      const newUrl = queryStr ? `${window.location.pathname}?${queryStr}` : window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    } catch (_) {}
  };

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
      fetchHierarchy(courseId, true);
      loadCompletedTopics(courseId);
    }
  }, [courseId]);

  // Listen to browser Back / Forward buttons
  useEffect(() => {
    const handlePopState = () => {
      if (hierarchy?.modules) {
        const params = getUrlParams();
        const qTopId = params.get('topicId') ? Number(params.get('topicId')) : null;
        const qResId = params.get('resourceId') ? Number(params.get('resourceId')) : null;
        const qModId = params.get('moduleId') ? Number(params.get('moduleId')) : null;
        const qView = params.get('view');
        const qIsFinal = params.get('isFinalExam') === 'true';

        if (qIsFinal && hierarchy.final_exam) {
          setIsFinalExam(true);
          setActiveModuleId(null);
          setActiveTopic(null);
          setActiveResource(null);
          setActiveContentType('exam');
          return;
        }

        if (qTopId) {
          for (const m of hierarchy.modules) {
            const t = (m.topics || []).find((top) => top.id === qTopId);
            if (t) {
              setActiveModuleId(m.id);
              setActiveTopic(t);
              setActiveResource(null);
              setIsFinalExam(false);
              setActiveContentType('video');
              return;
            }
          }
        }

        if (qResId) {
          for (const m of hierarchy.modules) {
            const r = (m.resources || []).find((res) => res.id === qResId);
            if (r) {
              setActiveModuleId(m.id);
              setActiveResource(r);
              setActiveTopic(null);
              setIsFinalExam(false);
              setActiveContentType('notes');
              return;
            }
          }
        }

        if (qModId) {
          const m = hierarchy.modules.find((mod) => mod.id === qModId);
          if (m) {
            setActiveModuleId(m.id);
            if (qView === 'exam') {
              setActiveTopic(null);
              setActiveResource(null);
              setIsFinalExam(false);
              setActiveContentType('exam');
              return;
            }
          }
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [hierarchy]);

  const loadCompletedTopics = async (cId) => {
    const localKey = user?.id && cId ? `cgp_completed_topics_${user.id}_${cId}` : null;
    try {
      const data = await coursesAPI.getCompletedTopics(cId);
      if (data && Array.isArray(data.completed_topic_ids)) {
        const map = {};
        data.completed_topic_ids.forEach((id) => {
          map[id] = true;
        });
        setCompletedTopics(map);
        if (localKey) {
          localStorage.setItem(localKey, JSON.stringify(map));
        }
        return;
      }
    } catch (err) {
      console.warn('Authoritative topic completion fetch failed, checking offline cache:', err);
    }

    if (localKey) {
      try {
        const saved = localStorage.getItem(localKey);
        if (saved) {
          setCompletedTopics(JSON.parse(saved));
        }
      } catch (_) {}
    }
  };

  const fetchHierarchy = async (cId, preserveSelection = true, targetSelection = null) => {
    if (!cId) return;
    const reqId = ++hierarchyReqIdRef.current;
    try {
      setLoading(true);
      setHierarchyError(null);
      const data = await coursesAPI.getHierarchy(cId);
      if (reqId !== hierarchyReqIdRef.current) return;
      setHierarchy(data);

      const modules = data.modules || [];
      if (modules.length === 0) {
        setActiveModuleId(null);
        setActiveTopic(null);
        setActiveResource(null);
        return;
      }

      // 1. Explicit target selection (e.g. from educator creating content)
      if (targetSelection) {
        if (targetSelection.topicId) {
          for (const m of modules) {
            const t = (m.topics || []).find((top) => top.id === targetSelection.topicId);
            if (t) {
              setActiveModuleId(m.id);
              setActiveTopic(t);
              setActiveResource(null);
              setIsFinalExam(false);
              setActiveContentType('video');
              syncUrlState({ moduleId: m.id, topicId: t.id, resourceId: null, view: 'video', isFinalExam: false });
              return;
            }
          }
        }
        if (targetSelection.resourceId) {
          for (const m of modules) {
            const r = (m.resources || []).find((res) => res.id === targetSelection.resourceId);
            if (r) {
              setActiveModuleId(m.id);
              setActiveResource(r);
              setActiveTopic(null);
              setIsFinalExam(false);
              setActiveContentType('notes');
              syncUrlState({ moduleId: m.id, resourceId: r.id, topicId: null, view: 'notes', isFinalExam: false });
              return;
            }
          }
        }
        if (targetSelection.moduleId) {
          const m = modules.find((mod) => mod.id === targetSelection.moduleId);
          if (m) {
            setActiveModuleId(m.id);
            if (m.topics && m.topics.length > 0) {
              setActiveTopic(m.topics[0]);
              setActiveResource(null);
              setIsFinalExam(false);
              setActiveContentType('video');
              syncUrlState({ moduleId: m.id, topicId: m.topics[0].id, resourceId: null, view: 'video', isFinalExam: false });
              return;
            }
          }
        }
      }

      // 2. Preserve existing selection if still valid
      if (preserveSelection) {
        if (isFinalExam && data.final_exam) {
          return;
        }
        if (activeContentType === 'exam' && activeModuleId) {
          const m = modules.find((mod) => mod.id === activeModuleId);
          if (m && m.has_module_exam) {
            return;
          }
        }
        if (activeContentType === 'notes' && activeResource?.id) {
          for (const m of modules) {
            const r = (m.resources || []).find((res) => res.id === activeResource.id);
            if (r) {
              setActiveModuleId(m.id);
              setActiveResource(r);
              return;
            }
          }
        }
        if (activeContentType === 'video' && activeTopic?.id) {
          for (const m of modules) {
            const t = (m.topics || []).find((top) => top.id === activeTopic.id);
            if (t) {
              setActiveModuleId(m.id);
              setActiveTopic(t);
              return;
            }
          }
        }
      }

      // 3. Restore selection from URL query parameters
      const params = getUrlParams();
      const qView = params.get('view');
      const qIsFinal = params.get('isFinalExam') === 'true';
      const qModId = params.get('moduleId') ? Number(params.get('moduleId')) : null;
      const qTopId = params.get('topicId') ? Number(params.get('topicId')) : null;
      const qResId = params.get('resourceId') ? Number(params.get('resourceId')) : null;

      if (qIsFinal && data.final_exam) {
        setIsFinalExam(true);
        setActiveModuleId(null);
        setActiveTopic(null);
        setActiveResource(null);
        setActiveContentType('exam');
        syncUrlState({ moduleId: null, topicId: null, resourceId: null, view: 'exam', isFinalExam: true });
        return;
      }

      if (qTopId) {
        for (const m of modules) {
          const t = (m.topics || []).find((top) => top.id === qTopId);
          if (t) {
            setActiveModuleId(m.id);
            setActiveTopic(t);
            setActiveResource(null);
            setIsFinalExam(false);
            setActiveContentType('video');
            syncUrlState({ moduleId: m.id, topicId: t.id, resourceId: null, view: 'video', isFinalExam: false });
            return;
          }
        }
      }

      if (qResId) {
        for (const m of modules) {
          const r = (m.resources || []).find((res) => res.id === qResId);
          if (r) {
            setActiveModuleId(m.id);
            setActiveResource(r);
            setActiveTopic(null);
            setIsFinalExam(false);
            setActiveContentType('notes');
            syncUrlState({ moduleId: m.id, resourceId: r.id, topicId: null, view: 'notes', isFinalExam: false });
            return;
          }
        }
      }

      if (qModId) {
        const m = modules.find((mod) => mod.id === qModId);
        if (m) {
          setActiveModuleId(m.id);
          if (qView === 'exam' && m.has_module_exam) {
            setActiveTopic(null);
            setActiveResource(null);
            setIsFinalExam(false);
            setActiveContentType('exam');
            syncUrlState({ moduleId: m.id, topicId: null, resourceId: null, view: 'exam', isFinalExam: false });
            return;
          }
          if (m.topics && m.topics.length > 0) {
            setActiveTopic(m.topics[0]);
            setActiveResource(null);
            setIsFinalExam(false);
            setActiveContentType('video');
            syncUrlState({ moduleId: m.id, topicId: m.topics[0].id, resourceId: null, view: 'video', isFinalExam: false });
            return;
          }
        }
      }

      // 4. Default: First module and its first content
      const firstMod = modules[0];
      setActiveModuleId(firstMod.id);
      setIsFinalExam(false);
      if (firstMod.topics && firstMod.topics.length > 0) {
        setActiveTopic(firstMod.topics[0]);
        setActiveResource(null);
        setActiveContentType('video');
        syncUrlState({ moduleId: firstMod.id, topicId: firstMod.topics[0].id, resourceId: null, view: 'video', isFinalExam: false });
      } else if (firstMod.resources && firstMod.resources.length > 0) {
        setActiveResource(firstMod.resources[0]);
        setActiveTopic(null);
        setActiveContentType('notes');
        syncUrlState({ moduleId: firstMod.id, resourceId: firstMod.resources[0].id, topicId: null, view: 'notes', isFinalExam: false });
      } else {
        setActiveTopic(null);
        setActiveResource(null);
        setActiveContentType('video');
      }
    } catch (err) {
      if (reqId === hierarchyReqIdRef.current) {
        console.error('Failed to load course workspace hierarchy:', err);
        setHierarchyError('Failed to load course hierarchy. Please check your network connection and try again.');
      }
    } finally {
      if (reqId === hierarchyReqIdRef.current) {
        setLoading(false);
      }
    }
  };

  const currentModule = useMemo(() => {
    if (!hierarchy?.modules || !activeModuleId) return null;
    return hierarchy.modules.find((m) => m.id === activeModuleId) || hierarchy.modules[0];
  }, [hierarchy, activeModuleId]);

  const flattenedTopics = useMemo(() => {
    if (!hierarchy?.modules) return [];
    const list = [];
    hierarchy.modules.forEach((mod) => {
      (mod.topics || []).forEach((top) => {
        list.push({ topic: top, module: mod });
      });
    });
    return list;
  }, [hierarchy]);

  const currentTopicIndex = useMemo(() => {
    return flattenedTopics.findIndex((item) => item.topic.id === activeTopic?.id);
  }, [flattenedTopics, activeTopic]);

  const prevTopicItem = currentTopicIndex > 0 ? flattenedTopics[currentTopicIndex - 1] : null;
  const nextTopicItem = currentTopicIndex >= 0 && currentTopicIndex < flattenedTopics.length - 1 ? flattenedTopics[currentTopicIndex + 1] : null;

  const handlePrevTopic = () => {
    if (prevTopicItem) {
      setActiveModuleId(prevTopicItem.module.id);
      setActiveTopic(prevTopicItem.topic);
      setActiveResource(null);
      setIsFinalExam(false);
      setActiveContentType('video');
      syncUrlState({ moduleId: prevTopicItem.module.id, topicId: prevTopicItem.topic.id, resourceId: null, view: 'video', isFinalExam: false });
    }
  };

  const handleNextTopic = () => {
    if (nextTopicItem) {
      setActiveModuleId(nextTopicItem.module.id);
      setActiveTopic(nextTopicItem.topic);
      setActiveResource(null);
      setIsFinalExam(false);
      setActiveContentType('video');
      syncUrlState({ moduleId: nextTopicItem.module.id, topicId: nextTopicItem.topic.id, resourceId: null, view: 'video', isFinalExam: false });
    } else if (currentModule?.has_module_exam) {
      setActiveTopic(null);
      setActiveResource(null);
      setIsFinalExam(false);
      setActiveContentType('exam');
      syncUrlState({ moduleId: currentModule.id, topicId: null, resourceId: null, view: 'exam', isFinalExam: false });
    }
  };

  // Load Exam Data when Exam is Active
  useEffect(() => {
    if (activeContentType === 'exam' && !isFinalExam && currentModule) {
      loadModuleExamData(currentModule);
    }
  }, [activeContentType, currentModule, isFinalExam]);

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
  // 2. TREE NAVIGATION HANDLERS (WITH AUTO-CLEANUP & URL STATE SYNC)
  // ---------------------------------------------------------------------------
  const handleSelectTopic = (mod, topic) => {
    setIsFinalExam(false);
    setEphemeralSecondaryVideo(null);

    setActiveModuleId(mod.id);
    setActiveTopic(topic);
    setActiveResource(null);
    setActiveContentType('video');
    syncUrlState({ moduleId: mod.id, topicId: topic.id, resourceId: null, view: 'video', isFinalExam: false });
  };

  const handleSelectResource = (mod, res) => {
    setIsFinalExam(false);
    setEphemeralSecondaryVideo(null);

    setActiveModuleId(mod.id);
    setActiveResource(res);
    setActiveTopic(null);
    setActiveContentType('notes');
    syncUrlState({ moduleId: mod.id, resourceId: res.id, topicId: null, view: 'notes', isFinalExam: false });
    loadPdfDoc(res);
  };

  const handleSelectExam = (mod) => {
    setIsFinalExam(false);
    setEphemeralSecondaryVideo(null);

    setActiveModuleId(mod.id);
    setActiveTopic(null);
    setActiveResource(null);
    setActiveContentType('exam');
    syncUrlState({ moduleId: mod.id, topicId: null, resourceId: null, view: 'exam', isFinalExam: false });
  };

  const handleSelectFinalExam = async (fExam) => {
    setEphemeralSecondaryVideo(null);
    setIsFinalExam(true);
    setActiveModuleId(null);
    setActiveTopic(null);
    setActiveResource(null);
    setActiveContentType('exam');
    setExamActive(false);
    setSubmissionResult(null);
    setStudentAnswers({});
    syncUrlState({ moduleId: null, topicId: null, resourceId: null, view: 'exam', isFinalExam: true });

    try {
      setExamLoading(true);
      if (fExam?.questions && fExam.questions.length > 0) {
        setModuleExam(fExam);
        setExamTimeLeft((fExam.time_limit_mins || 30) * 60);
      } else if (fExam?.id) {
        const fullData = await examsAPI.get(fExam.id);
        setModuleExam(fullData);
        setExamTimeLeft((fullData.time_limit_mins || 30) * 60);
      } else {
        const list = await examsAPI.listByCourse(courseId);
        const finalE = list.find((e) => e.exam_type === 'FINAL_EXAM');
        if (finalE) {
          const fullData = await examsAPI.get(finalE.id);
          setModuleExam(fullData);
          setExamTimeLeft((fullData.time_limit_mins || 30) * 60);
        } else {
          setModuleExam(null);
        }
      }
    } catch (err) {
      console.error('Error loading course final exam:', err);
      setModuleExam(fExam || null);
    } finally {
      setExamLoading(false);
    }
  };

  const handleGenerateExamRAG = async () => {
    if (!currentModule || generatingExamRAG) return;
    if (!isCourseOwner) {
      alert('You can only generate AI assessments for courses that you have authored.');
      return;
    }

    // Preflight: warn if no documents uploaded — RAG will fail silently otherwise
    const hasDocuments = currentModule.resources && currentModule.resources.length > 0;
    if (!hasDocuments) {
      alert('⚠️ No documents found in this module.\n\nPlease upload at least one PDF or document to the module first. The AI generates exam questions by reading your uploaded course material.');
      return;
    }

    setGeneratingExamRAG(true);
    try {
      await coursesAPI.generateExamRAG(currentModule.id, { question_count: 5, difficulty: 'medium' });
      await loadModuleExamData(currentModule);
      alert('✅ AI exam generated successfully! Students can now take it.');
    } catch (err) {
      alert('❌ Failed to generate exam. The AI could not read the module documents. Try re-uploading the documents and try again.');
    } finally {
      setGeneratingExamRAG(false);
    }
  };

  const handleCreateFinalExam = async () => {
    if (creatingFinalExam) return;
    if (!isCourseOwner) {
      alert('You can only create final exams for courses that you have authored.');
      return;
    }
    setCreatingFinalExam(true);
    try {
      await examsAPI.create({
        course_id: courseId,
        module_id: null,
        title: `Final Exam: ${hierarchy?.title || 'Course'}`,
        exam_type: 'FINAL_EXAM',
        time_limit_mins: 45,
        passing_score: 70,
        questions: []
      });
      await fetchHierarchy(courseId, true);
      alert('✅ Final course exam created! Use the Exam Builder to add questions.');
    } catch (err) {
      alert('Failed to create final exam.');
    } finally {
      setCreatingFinalExam(false);
    }
  };

  const toggleTopicCompleted = async (topicId) => {
    if (!isEducator && !localEnrolled) {
      alert('Please enroll in this course to mark topics as completed and track your milestone progress.');
      return;
    }
    if (completingTopicId === topicId) return;

    const previousCompleted = { ...completedTopics };
    const newStatus = !completedTopics[topicId];
    const updated = { ...completedTopics, [topicId]: newStatus };
    setCompletedTopics(updated);

    const localKey = user?.id && courseId ? `cgp_completed_topics_${user.id}_${courseId}` : null;
    if (localKey) {
      localStorage.setItem(localKey, JSON.stringify(updated));
    }

    if (newStatus) {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.75 }
      });
    }

    try {
      setCompletingTopicId(topicId);
      const res = await coursesAPI.completeTopic(topicId, { is_completed: newStatus });
      if (res && Array.isArray(res.completed_topic_ids)) {
        const serverMap = {};
        res.completed_topic_ids.forEach((id) => {
          serverMap[id] = true;
        });
        setCompletedTopics(serverMap);
        if (localKey) {
          localStorage.setItem(localKey, JSON.stringify(serverMap));
        }
      }
      if (onRefreshCourses) onRefreshCourses();
    } catch (err) {
      // Rollback on failure!
      setCompletedTopics(previousCompleted);
      if (localKey) {
        localStorage.setItem(localKey, JSON.stringify(previousCompleted));
      }
      alert('Failed to update topic completion on server. Please check your network and try again.');
    } finally {
      setCompletingTopicId(null);
    }
  };

  // ---------------------------------------------------------------------------
  // 3. SECURE PDF VIEWER ENGINE
  // ---------------------------------------------------------------------------
  const loadPdfDoc = async (resource) => {
    if (!resource) return;
    const currentReqId = ++pdfReqIdRef.current;
    setPdfLoading(true);
    setPdfError(null);
    setPageNum(1);
    setTotalPages(1);

    // Cancel in-flight render task and destroy previous doc
    if (renderTaskRef.current) {
      try {
        renderTaskRef.current.cancel();
      } catch (_) {}
      renderTaskRef.current = null;
    }
    if (pdfDoc) {
      try {
        pdfDoc.destroy();
      } catch (_) {}
      setPdfDoc(null);
    }

    // Clear canvas
    if (canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

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

      const blob = await coursesAPI.viewResource(resource.id);
      if (currentReqId !== pdfReqIdRef.current) return;

      const arrayBuffer = await blob.arrayBuffer();
      if (currentReqId !== pdfReqIdRef.current) return;

      const loadingTask = window.pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      if (currentReqId !== pdfReqIdRef.current) {
        pdf.destroy();
        return;
      }

      setPdfDoc(pdf);
      setTotalPages(pdf.numPages);
      renderPdfPage(1, pdf, zoomScale);
    } catch (err) {
      if (currentReqId === pdfReqIdRef.current) {
        console.error('PDF rendering failed:', err);
        setPdfError('Failed to load protected lecture notes. The file may be unavailable or access was denied.');
      }
    } finally {
      if (currentReqId === pdfReqIdRef.current) {
        setPdfLoading(false);
      }
    }
  };

  const renderPdfPage = async (pageNumber, pdfInstance = pdfDoc, scale = zoomScale) => {
    if (!pdfInstance || !canvasRef.current) return;
    try {
      if (renderTaskRef.current) {
        try {
          renderTaskRef.current.cancel();
        } catch (_) {}
      }
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
      const renderTask = page.render(renderContext);
      renderTaskRef.current = renderTask;
      await renderTask.promise;
    } catch (err) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('Page render error:', err);
      }
    }
  };

  useEffect(() => {
    if (activeContentType === 'notes' && activeResource?.id) {
      loadPdfDoc(activeResource);
    }
  }, [activeContentType, activeResource?.id]);

  useEffect(() => {
    if (pdfDoc && activeResource && activeContentType === 'notes') {
      renderPdfPage(pageNum, pdfDoc, zoomScale);
    }
  }, [pageNum, zoomScale, activeContentType]);

  // Clean up PDF resources on unmount
  useEffect(() => {
    return () => {
      if (renderTaskRef.current) {
        try { renderTaskRef.current.cancel(); } catch (_) {}
      }
      if (pdfDoc) {
        try { pdfDoc.destroy(); } catch (_) {}
      }
    };
  }, [pdfDoc]);

  // ---------------------------------------------------------------------------
  // 4. STUDENT EXAM TAKING & SUBMISSION
  // ---------------------------------------------------------------------------
  const handleAnswerOption = (questionId, optionVal) => {
    setStudentAnswers((prev) => {
      const next = {
        ...prev,
        [questionId]: optionVal
      };
      studentAnswersRef.current = next;
      return next;
    });
  };

  const handleSubmitExam = async () => {
    if (!moduleExam || submittingExam || isSubmittingExamRef.current) return;
    try {
      isSubmittingExamRef.current = true;
      setSubmittingExam(true);
      const answers = studentAnswersRef.current || studentAnswers;
      const responses = Object.entries(answers).map(([qid, val]) => ({
        question_id: parseInt(qid),
        selected_option: val
      }));

      const result = await examsAPI.submit(moduleExam.id, responses);
      setSubmissionResult(result);
      setExamActive(false);

      if (result.passed) {
        if (isFinalExam) {
          const passKey = `cgp_final_exam_passed_${user?.id}_${courseId}`;
          localStorage.setItem(passKey, 'true');
        } else if (currentModule) {
          const passKey = `cgp_exam_passed_${user?.id}_${currentModule.id}`;
          localStorage.setItem(passKey, 'true');
        }

        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 }
        });
      }
    } catch (err) {
      alert('Error evaluating exam submission. Please check your network and retry.');
    } finally {
      setSubmittingExam(false);
      isSubmittingExamRef.current = false;
    }
  };

  useEffect(() => {
    handleSubmitExamRef.current = handleSubmitExam;
  });

  // Reset timer single-fire flag when exam starts or changes
  useEffect(() => {
    timerSubmittedRef.current = false;
  }, [moduleExam?.id, examActive]);

  // Exam Countdown Timer (runs stably without recreating interval every second)
  useEffect(() => {
    let timer;
    if (examActive && !submissionResult) {
      timer = setInterval(() => {
        setExamTimeLeft((t) => {
          if (t <= 1) {
            clearInterval(timer);
            if (!timerSubmittedRef.current && handleSubmitExamRef.current) {
              timerSubmittedRef.current = true;
              handleSubmitExamRef.current();
            }
            return 0;
          }
          return t - 1;
        });
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [examActive, submissionResult]);

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
    if (!newModuleTitle.trim() || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await coursesAPI.createModule(courseId, {
        title: newModuleTitle.trim(),
        description: newModuleDesc.trim()
      });
      setNewModuleTitle('');
      setNewModuleDesc('');
      setShowAddModuleModal(false);
      await fetchHierarchy(courseId, true, { moduleId: res.id });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add module');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddTopicAction = async (e) => {
    e.preventDefault();
    if (!targetModuleId || !newTopicTitle.trim() || !newTopicUrl.trim() || actionLoading) return;
    try {
      setActionLoading(true);
      const res = await coursesAPI.createTopic(targetModuleId, {
        title: newTopicTitle.trim(),
        description: newTopicDesc.trim(),
        youtube_url: newTopicUrl.trim()
      });
      setNewTopicTitle('');
      setNewTopicDesc('');
      setNewTopicUrl('');
      setShowAddTopicModal(false);
      await fetchHierarchy(courseId, true, { moduleId: targetModuleId, topicId: res.id });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to add topic. Please check the YouTube URL.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUploadNotesAction = async (e) => {
    e.preventDefault();
    if (!targetModuleId || !resourceTitle.trim() || !resourceFile || actionLoading) return;
    try {
      setActionLoading(true);
      const formData = new FormData();
      formData.append('title', resourceTitle.trim());
      formData.append('file', resourceFile);
      const res = await coursesAPI.uploadResource(targetModuleId, formData);
      setResourceTitle('');
      setResourceFile(null);
      setShowUploadModal(false);
      await fetchHierarchy(courseId, true, { moduleId: targetModuleId, resourceId: res.id });
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to upload notes. Please ensure the file is a PDF.');
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

      {/* Course Preview / Enrollment Banner for unenrolled students */}
      {!isEducator && !localEnrolled && (
        <div className="bg-gradient-to-r from-amber-500/20 via-purple-500/20 to-indigo-500/20 border-b border-amber-500/30 px-4 sm:px-6 py-2.5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 z-30 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-7 w-7 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Lock className="h-3.5 w-3.5" />
            </div>
            <div>
              <p className="text-xs font-bold text-amber-200">
                Course Preview Mode: You are not yet enrolled in this course
              </p>
              <p className="text-[11px] text-amber-200/70">
                Enroll now to track your topics, submit assignments, take exams, and unlock all learning materials.
              </p>
            </div>
          </div>
          <button
            type="button"
            disabled={enrollingLocal}
            onClick={handleEnrollInCourse}
            className="px-4 py-1.5 rounded-full bg-gradient-to-r from-[#8B7CFF] to-[#FF6F9C] hover:from-[#9d91ff] hover:to-[#ff8cb1] text-[#0A0D1C] text-xs font-bold transition shadow-md flex items-center gap-1.5 cursor-pointer shrink-0 disabled:opacity-50"
          >
            {enrollingLocal ? (
              <span>Enrolling...</span>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 stroke-[3]" />
                <span>Enroll in Course</span>
              </>
            )}
          </button>
        </div>
      )}

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
          finalExam={hierarchy?.final_exam}
          onSelectFinalExam={handleSelectFinalExam}
          isFinalExamActive={activeContentType === 'exam' && isFinalExam}
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
          {/* HIERARCHY LOAD ERROR BANNER */}
          {hierarchyError && (
            <div className="max-w-xl mx-auto my-auto p-8 rounded-3xl bg-red-950/20 border border-red-500/30 text-center space-y-4 shadow-xl">
              <div className="h-14 w-14 rounded-2xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mx-auto">
                <AlertTriangle className="h-7 w-7" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">Failed to Load Course Syllabus</h3>
                <p className="text-xs text-red-300 max-w-sm mx-auto">{hierarchyError}</p>
              </div>
              <button
                onClick={() => fetchHierarchy(courseId, true)}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Retry Loading Syllabus</span>
              </button>
            </div>
          )}

          {/* EMPTY CURRICULUM STATE (0 Modules) */}
          {!hierarchyError && (!hierarchy?.modules || hierarchy.modules.length === 0) && (
            <div className="max-w-xl mx-auto my-auto p-8 rounded-3xl bg-[#121826] border border-[#1e2638] text-center space-y-5 shadow-2xl">
              <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto shadow-inner">
                <Layers className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white">Course Curriculum in Preparation</h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                  {isEducator
                    ? 'This course has no modules yet. Add your first module to begin organizing video lectures, protected notes, and conceptual assessments.'
                    : 'Your educator is currently setting up the curriculum for this course. Video lessons, reading materials, and assessments will appear here once published.'}
                </p>
              </div>
              {isEducator && (
                <button
                  onClick={() => setShowAddModuleModal(true)}
                  className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition shadow-xl shadow-indigo-600/30 inline-flex items-center gap-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create First Module</span>
                </button>
              )}
            </div>
          )}

          {/* EMPTY TOPIC STATE (Modules exist, video mode active, but no topic selected) */}
          {hierarchy?.modules?.length > 0 && activeContentType === 'video' && !activeTopic && (
            <div className="max-w-xl mx-auto my-auto p-8 rounded-3xl bg-[#121826] border border-[#1e2638] text-center space-y-4 shadow-xl">
              <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mx-auto">
                <Youtube className="h-7 w-7 text-indigo-400" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-black text-white">No Lecture Topic Selected</h3>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  {isEducator
                    ? 'Add a concept topic to this module or select an existing topic from the syllabus tree on the left.'
                    : 'Choose a video lecture from the syllabus on the left to start watching.'}
                </p>
              </div>
              {isEducator && currentModule && (
                <button
                  onClick={() => {
                    setTargetModuleId(currentModule.id);
                    setShowAddTopicModal(true);
                  }}
                  className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition inline-flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Concept Video</span>
                </button>
              )}
            </div>
          )}

          {/* PRIMARY CONTENT: TOPIC VIDEO */}
          {activeContentType === 'video' && activeTopic && (
            <div className="space-y-6 max-w-5xl mx-auto w-full">
              {/* Primary 16:9 YouTube Embed */}
              <div className="w-full aspect-video rounded-3xl overflow-hidden bg-black shadow-2xl border border-[#1e2638] relative">
                {/^[0-9A-Za-z_-]{11}$/.test(activeTopic.youtube_video_id || '') ? (
                  <iframe
                    key={activeTopic.youtube_video_id}
                    className="w-full h-full"
                    src={`https://www.youtube-nocookie.com/embed/${activeTopic.youtube_video_id}?autoplay=0&rel=0&modestbranding=1`}
                    title={activeTopic.title || 'Topic Video Lecture'}
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-[#0b0f19] text-center space-y-3">
                    <div className="h-14 w-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center">
                      <AlertTriangle className="h-7 w-7" />
                    </div>
                    <div className="space-y-1">
                      <h4 className="text-base font-black text-white">Video Lecture Not Available</h4>
                      <p className="text-xs text-slate-400 max-w-md">
                        {isEducator
                          ? 'The configured YouTube URL for this topic is invalid or missing. Please edit the topic to set a valid YouTube link.'
                          : 'This topic does not have a valid video attached yet. Please check the lecture notes or contact your instructor.'}
                      </p>
                    </div>
                  </div>
                )}
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

                  <div className="flex items-center gap-3 flex-wrap">
                    <button
                      onClick={handlePrevTopic}
                      disabled={!prevTopicItem}
                      className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition bg-[#1a2338] hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={prevTopicItem ? `Previous: ${prevTopicItem.topic.title}` : 'No previous topic'}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      <span>Previous</span>
                    </button>

                    <button
                      onClick={handleNextTopic}
                      disabled={!nextTopicItem && !currentModule?.has_module_exam}
                      className="px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition bg-[#1a2338] hover:bg-slate-700 text-slate-200 disabled:opacity-40 disabled:cursor-not-allowed"
                      title={nextTopicItem ? `Next: ${nextTopicItem.topic.title}` : (currentModule?.has_module_exam ? 'Take Module Exam' : 'End of course')}
                    >
                      <span>Next</span>
                      <ChevronRight className="h-4 w-4" />
                    </button>

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
                ) : pdfError ? (
                  <div className="flex flex-col items-center gap-3 p-8 bg-[#121826] border border-red-500/30 rounded-2xl text-center max-w-md shadow-xl">
                    <AlertTriangle className="h-8 w-8 text-red-400" />
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-white">Failed to Load Notes</h4>
                      <p className="text-xs text-red-300">{pdfError}</p>
                    </div>
                    <button
                      onClick={() => loadPdfDoc(activeResource)}
                      className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>Retry Loading Notes</span>
                    </button>
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
                          {isFinalExam ? 'Comprehensive Capstone Exam' : (moduleExam.scope || 'Module End Assessment')}
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
                      {isEducator && isCourseOwner ? (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowExamBuilderModal(true)}
                            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-md shadow-indigo-600/30"
                          >
                            <Sparkles className="h-4 w-4" />
                            <span>{isFinalExam ? 'Edit Final Exam Questions' : 'Edit RAG Assessment'}</span>
                          </button>
                          {!hierarchy?.final_exam && (
                            <button
                              onClick={handleCreateFinalExam}
                              disabled={creatingFinalExam}
                              className="px-4 py-2 bg-amber-600/20 hover:bg-amber-600/30 text-amber-300 border border-amber-500/40 rounded-xl text-xs font-bold transition flex items-center gap-2 disabled:opacity-50"
                            >
                              {creatingFinalExam ? 'Creating...' : '🏆 Add Final Exam'}
                            </button>
                          )}
                        </div>
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
                              {submissionResult.passed ? (isFinalExam ? 'PASSED • COURSE CERTIFIED 🏆' : 'PASSED • MODULE MASTERED') : 'NEEDS RETRY'}
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

                      {submissionResult.unlocked_badge && (
                        <div className="mt-4 p-4 rounded-2xl bg-[#0e1726] border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                              <ShieldCheck className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-black text-amber-300">
                                  {submissionResult.unlocked_badge.badge_name}
                                </span>
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                  {submissionResult.unlocked_badge.difficulty_level}
                                </span>
                              </div>
                              <p className="text-[11px] text-slate-400 font-mono mt-0.5 truncate max-w-sm">
                                Hash: {submissionResult.unlocked_badge.verification_hash}
                              </p>
                            </div>
                          </div>
                          <a
                            href={`/api/v1/courses/badges/verify/${submissionResult.unlocked_badge.verification_hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5 shrink-0 self-start sm:self-auto"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            <span>Verify Credential</span>
                          </a>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Questions List */}
                  <div className="space-y-4">
                    {moduleExam.questions?.map((q, idx) => {
                      const parsedOptions = normalizeQuestionOptions(q.options);
                      const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
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
                            {isEducator && q.correct_answer && (
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
                              const isCorrect = q.correct_answer && (
                                String(q.correct_answer).toUpperCase() === optLetter ||
                                String(q.correct_answer) === String(oIdx)
                              );

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
                                      handleAnswerOption(q.id, optLetter);
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
        module={isFinalExam ? null : currentModule}
        courseId={courseId}
        isFinalExam={isFinalExam}
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
