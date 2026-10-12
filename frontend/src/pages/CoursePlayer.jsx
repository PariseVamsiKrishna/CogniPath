import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  BookOpen,
  Plus,
  Compass,
  Sparkles,
  GraduationCap,
  Building2,
  Layers,
  Video,
  Users,
  Star,
  Calendar,
  Clock,
  Globe,
  FileEdit,
  Trash2,
  Edit3,
  Play,
  CheckCircle2,
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ArrowUp,
  ArrowDown,
  FileText,
  Upload,
  ExternalLink,
  Eye,
  RefreshCw,
  Check,
  Youtube,
  X,
  Settings,
  Lock
} from 'lucide-react';
import { coursesAPI } from '../services/api';
import {
  TARGET_BRANCHES,
  DIFFICULTY_LEVELS,
  formatDifficulty,
  getDifficultyBadgeClass,
  extractYoutubeVideoId
} from '../constants/academic';
import CourseDeleteModal from '../components/CourseDeleteModal';

function formatDateShort(dateStr) {
  if (!dateStr) return 'Recently';
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return 'Recently';
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  } catch {
    return 'Recently';
  }
}

export default function CoursePlayer({
  user,
  selectedCourseId,
  onSelectCourse,
  onBackToDashboard,
  enrolledCourses = [],
  myCreatedCourses = [],
  onRefreshCourses,
  onOpenExploreCatalog,
  onOpenCreateCourse,
  onOpenRateModal,
  onDeleteCoursePermanently,
  onUnenrollCourse,
  initialWorkspaceTab = 'learn',
  previewOnly = false
}) {
  const isEducatorRole = user?.role === 'EDUCATOR' || user?.role === 'ADMIN';

  // Lifecycle & Stale-Response Protection Refs
  const isMountedRef = useRef(true);
  const selectedCourseIdRef = useRef(selectedCourseId);
  const workspaceReqIdRef = useRef(0);
  const progressReqIdRef = useRef(0);
  const toggleReqIdRef = useRef(0);
  const createdReqIdRef = useRef(0);
  const enrolledReqIdRef = useRef(0);
  const pdfReqIdRef = useRef(0);
  const activePdfUrlRef = useRef(null);
  const bannerTimeoutRef = useRef(null);
  const activeModuleIdRef = useRef(null);
  const activeTopicIdRef = useRef(null);

  // Independent Dashboard Section States
  const [createdList, setCreatedList] = useState(myCreatedCourses || []);
  const [createdLoading, setCreatedLoading] = useState(false);
  const [createdError, setCreatedError] = useState('');

  const [enrolledList, setEnrolledList] = useState(enrolledCourses || []);
  const [enrolledLoading, setEnrolledLoading] = useState(false);
  const [enrolledError, setEnrolledError] = useState('');

  // Course Workspace / Preview States
  const [hierarchy, setHierarchy] = useState(null);
  const [hierarchyLoading, setHierarchyLoading] = useState(false);
  const [hierarchyError, setHierarchyError] = useState('');
  const [activeTab, setActiveTab] = useState(initialWorkspaceTab || 'learn'); // 'learn' | 'curriculum' | 'notes'
  const [expandedModules, setExpandedModules] = useState({});
  const [activeModuleId, setActiveModuleId] = useState(null);
  const [activeTopicId, setActiveTopicId] = useState(null);
  const [completedTopicIds, setCompletedTopicIds] = useState(new Set());
  const [progressLoading, setProgressLoading] = useState(false);
  const [progressError, setProgressError] = useState('');
  const [togglingComplete, setTogglingComplete] = useState(false);
  const [enrollingInPreview, setEnrollingInPreview] = useState(false);

  // PDF Viewer State
  const [activePdfUrl, setActivePdfUrl] = useState(null);
  const [activePdfTitle, setActivePdfTitle] = useState('');
  const [activePdfResourceId, setActivePdfResourceId] = useState(null);
  const [pdfLoading, setPdfLoading] = useState(false);
  const [pdfError, setPdfError] = useState('');

  // Educator Action / CRUD States
  const [actionBanner, setActionBanner] = useState(null); // { type: 'success' | 'error', text: string }
  const [courseToDelete, setCourseToDelete] = useState(null);
  const [deleteMode, setDeleteMode] = useState('delete'); // 'delete' | 'unenroll'
  const [deletingCourse, setDeletingCourse] = useState(false);
  const deletingCourseRef = useRef(false);

  // Edit Course Metadata Modal State
  const [editingCourse, setEditingCourse] = useState(null);
  const [editCourseForm, setEditCourseForm] = useState({
    title: '',
    description: '',
    difficulty: 'Medium',
    target_branch: 'Computer Science & Engineering (CSE)',
    thumbnail_url: ''
  });
  const [savingCourseMeta, setSavingCourseMeta] = useState(false);

  // Curriculum Studio Module Form State
  const [moduleModal, setModuleModal] = useState(null); // { mode: 'create' | 'edit', module?: obj }
  const [moduleForm, setModuleForm] = useState({ title: '', description: '' });
  const [savingModule, setSavingModule] = useState(false);

  // Curriculum Studio Topic Form State
  const [topicModal, setTopicModal] = useState(null); // { mode: 'create' | 'edit', moduleId: number, topic?: obj }
  const [topicForm, setTopicForm] = useState({ title: '', description: '', youtube_url: '' });
  const [savingTopic, setSavingTopic] = useState(false);

  // PDF Upload State per Module (Map of moduleId -> boolean to avoid race conditions with overlapping uploads)
  const [uploadingModuleIds, setUploadingModuleIds] = useState({});

  // Module & Topic Reordering Concurrency Guards
  const [reorderingModules, setReorderingModules] = useState(false);
  const reorderingModulesRef = useRef(false);
  const [reorderingTopicModules, setReorderingTopicModules] = useState({});
  const reorderingTopicsRef = useRef(new Set());

  useEffect(() => {
    activeModuleIdRef.current = activeModuleId;
  }, [activeModuleId]);

  useEffect(() => {
    activeTopicIdRef.current = activeTopicId;
  }, [activeTopicId]);

  const clearActivePdf = useCallback(() => {
    if (activePdfUrlRef.current) {
      URL.revokeObjectURL(activePdfUrlRef.current);
      activePdfUrlRef.current = null;
    }
    setActivePdfUrl(null);
    setActivePdfTitle('');
    setActivePdfResourceId(null);
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      workspaceReqIdRef.current += 1;
      progressReqIdRef.current += 1;
      createdReqIdRef.current += 1;
      enrolledReqIdRef.current += 1;
      pdfReqIdRef.current += 1;
      if (bannerTimeoutRef.current) {
        clearTimeout(bannerTimeoutRef.current);
      }
      if (activePdfUrlRef.current) {
        URL.revokeObjectURL(activePdfUrlRef.current);
        activePdfUrlRef.current = null;
      }
    };
  }, []);

  // Sync props when parent updates
  useEffect(() => {
    setCreatedList(myCreatedCourses || []);
  }, [myCreatedCourses]);

  useEffect(() => {
    setEnrolledList(enrolledCourses || []);
  }, [enrolledCourses]);

  useEffect(() => {
    if (initialWorkspaceTab) {
      setActiveTab(initialWorkspaceTab);
    }
  }, [initialWorkspaceTab, selectedCourseId]);

  // Independent Dashboard Fetchers
  const fetchMyCreatedCourses = useCallback(async () => {
    if (!isEducatorRole) return;
    const reqId = ++createdReqIdRef.current;
    setCreatedLoading(true);
    setCreatedError('');
    try {
      const data = await coursesAPI.getMyCourses();
      if (!isMountedRef.current || reqId !== createdReqIdRef.current) return;
      const filtered = (Array.isArray(data) ? data : []).filter(
        (c) => Number(c.educator_id) === Number(user?.id)
      );
      setCreatedList(filtered);
    } catch (err) {
      if (!isMountedRef.current || reqId !== createdReqIdRef.current) return;
      console.error('Failed to load educator created courses:', err);
      setCreatedError(
        err.response?.data?.detail ||
          'Failed to load your created courses. Please try again.'
      );
    } finally {
      if (isMountedRef.current && reqId === createdReqIdRef.current) {
        setCreatedLoading(false);
      }
    }
  }, [isEducatorRole, user?.id]);

  const fetchMyEnrolledCourses = useCallback(async () => {
    const reqId = ++enrolledReqIdRef.current;
    setEnrolledLoading(true);
    setEnrolledError('');
    try {
      const data = await coursesAPI.getEnrolled();
      if (!isMountedRef.current || reqId !== enrolledReqIdRef.current) return;
      setEnrolledList(Array.isArray(data) ? data : []);
    } catch (err) {
      if (!isMountedRef.current || reqId !== enrolledReqIdRef.current) return;
      console.error('Failed to load enrolled courses:', err);
      setEnrolledError(
        err.response?.data?.detail ||
          'Failed to load your enrolled courses. Please try again.'
      );
    } finally {
      if (isMountedRef.current && reqId === enrolledReqIdRef.current) {
        setEnrolledLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      fetchMyCreatedCourses();
      fetchMyEnrolledCourses();
    }
  }, [selectedCourseId, fetchMyCreatedCourses, fetchMyEnrolledCourses]);

  // Fetch Course Completion Progress with Stale-Response Protection
  const fetchCourseProgress = useCallback(async (courseId, { preserveOnError = true } = {}) => {
    if (!courseId || Number(selectedCourseIdRef.current) !== Number(courseId)) return;
    const reqId = ++progressReqIdRef.current;
    setProgressLoading(true);
    setProgressError('');
    try {
      const comp = await coursesAPI.getCompletedTopics(courseId);
      if (
        !isMountedRef.current ||
        reqId !== progressReqIdRef.current ||
        Number(selectedCourseIdRef.current) !== Number(courseId)
      ) {
        return;
      }
      if (comp && Array.isArray(comp.completed_topic_ids)) {
        const normalizedIds = comp.completed_topic_ids
          .map((id) => Number(id))
          .filter((id) => !Number.isNaN(id));
        setCompletedTopicIds(new Set(normalizedIds));
      }
    } catch (err) {
      if (
        !isMountedRef.current ||
        reqId !== progressReqIdRef.current ||
        Number(selectedCourseIdRef.current) !== Number(courseId)
      ) {
        return;
      }
      console.warn('Failed to fetch course progress:', err);
      setProgressError('Could not sync progress from server.');
      if (!preserveOnError) {
        setCompletedTopicIds(new Set());
      }
    } finally {
      if (
        isMountedRef.current &&
        reqId === progressReqIdRef.current &&
        Number(selectedCourseIdRef.current) === Number(courseId)
      ) {
        setProgressLoading(false);
      }
    }
  }, []);

  // Load Course Hierarchy when a course is selected
  const loadCourseWorkspace = useCallback(
    async (courseId, preserveSelection = false) => {
      if (!courseId || Number(selectedCourseIdRef.current) !== Number(courseId)) return;
      const reqId = ++workspaceReqIdRef.current;
      setHierarchyLoading(true);
      setHierarchyError('');
      try {
        const data = await coursesAPI.getHierarchy(courseId);
        if (
          !isMountedRef.current ||
          reqId !== workspaceReqIdRef.current ||
          Number(selectedCourseIdRef.current) !== Number(courseId)
        ) {
          return;
        }
        setHierarchy(data);

        const mods = data?.modules || [];
        const initialExpanded = {};
        mods.forEach((m) => {
          initialExpanded[m.id] = true;
        });
        setExpandedModules((prev) => {
          if (!preserveSelection) return initialExpanded;
          const nextExpanded = { ...initialExpanded };
          Object.keys(prev).forEach((modKey) => {
            if (Object.prototype.hasOwnProperty.call(nextExpanded, modKey)) {
              nextExpanded[modKey] = prev[modKey];
            }
          });
          return nextExpanded;
        });

        if (!preserveSelection) {
          if (mods.length > 0) {
            const firstModWithTopic = mods.find((m) => (m.topics || []).length > 0) || mods[0];
            const firstTopic = firstModWithTopic.topics?.[0] || null;
            setActiveModuleId(firstModWithTopic.id);
            activeModuleIdRef.current = firstModWithTopic.id;
            setActiveTopicId(firstTopic ? firstTopic.id : null);
            activeTopicIdRef.current = firstTopic ? firstTopic.id : null;
          } else {
            setActiveModuleId(null);
            activeModuleIdRef.current = null;
            setActiveTopicId(null);
            activeTopicIdRef.current = null;
          }
        } else {
          const prevModId = activeModuleIdRef.current;
          const prevTopId = activeTopicIdRef.current;
          const modContainingPrevTopic =
            prevTopId != null
              ? mods.find((m) =>
                  (m.topics || []).some((t) => Number(t.id) === Number(prevTopId))
                )
              : null;

          if (modContainingPrevTopic) {
            setActiveModuleId(modContainingPrevTopic.id);
            activeModuleIdRef.current = modContainingPrevTopic.id;
            setActiveTopicId(prevTopId);
            activeTopicIdRef.current = prevTopId;
          } else {
            const prevModStillExists =
              prevModId != null
                ? mods.find((m) => Number(m.id) === Number(prevModId)) || null
                : null;

            if (prevModStillExists && (prevTopId == null || (prevModStillExists.topics || []).length > 0)) {
              const nextTop = prevModStillExists.topics?.[0] || null;
              setActiveModuleId(prevModStillExists.id);
              activeModuleIdRef.current = prevModStillExists.id;
              setActiveTopicId(nextTop ? nextTop.id : null);
              activeTopicIdRef.current = nextTop ? nextTop.id : null;
            } else {
              const fallbackMod =
                mods.find((m) => (m.topics || []).length > 0) ||
                prevModStillExists ||
                mods[0] ||
                null;
              const fallbackTop = fallbackMod?.topics?.[0] || null;
              setActiveModuleId(fallbackMod ? fallbackMod.id : null);
              activeModuleIdRef.current = fallbackMod ? fallbackMod.id : null;
              setActiveTopicId(fallbackTop ? fallbackTop.id : null);
              activeTopicIdRef.current = fallbackTop ? fallbackTop.id : null;
            }
          }
        }

        const isOwnerOrAdmin =
          user?.role === 'ADMIN' ||
          (isEducatorRole && Number(data?.educator_id) === Number(user?.id));
        const isUserEnrolled = Boolean(data?.is_enrolled);

        if (isOwnerOrAdmin || (isUserEnrolled && !previewOnly)) {
          await fetchCourseProgress(courseId, { preserveOnError: preserveSelection });
        } else {
          setCompletedTopicIds(new Set());
          setProgressError('');
          setProgressLoading(false);
        }
      } catch (err) {
        if (
          !isMountedRef.current ||
          reqId !== workspaceReqIdRef.current ||
          Number(selectedCourseIdRef.current) !== Number(courseId)
        ) {
          return;
        }
        console.error('Failed to load course hierarchy:', err);
        setHierarchyError(
          err.response?.data?.detail ||
            'Failed to load course details from the server. Please try reloading.'
        );
      } finally {
        if (
          isMountedRef.current &&
          reqId === workspaceReqIdRef.current &&
          Number(selectedCourseIdRef.current) === Number(courseId)
        ) {
          setHierarchyLoading(false);
        }
      }
    },
    [fetchCourseProgress, isEducatorRole, previewOnly, user?.id, user?.role]
  );

  useEffect(() => {
    selectedCourseIdRef.current = selectedCourseId;
    workspaceReqIdRef.current += 1;
    progressReqIdRef.current += 1;
    toggleReqIdRef.current += 1;
    pdfReqIdRef.current += 1;
    clearActivePdf();
    setPdfError('');
    setPdfLoading(false);
    setProgressLoading(false);
    setTogglingComplete(false);
    setEnrollingInPreview(false);
    setModuleModal(null);
    setTopicModal(null);
    setEditingCourse(null);
    setActiveModuleId(null);
    setActiveTopicId(null);
    activeModuleIdRef.current = null;
    activeTopicIdRef.current = null;

    if (selectedCourseId) {
      setHierarchy(null);
      setHierarchyError('');
      setCompletedTopicIds(new Set());
      setProgressError('');
      loadCourseWorkspace(selectedCourseId, false);
    } else {
      setHierarchy(null);
      setHierarchyError('');
      setCompletedTopicIds(new Set());
      setProgressError('');
    }
  }, [selectedCourseId, loadCourseWorkspace, clearActivePdf]);

  const isCourseOwner = useMemo(() => {
    if (!hierarchy || !user) return false;
    if (user.role === 'ADMIN') return true;
    return isEducatorRole && Number(hierarchy.educator_id) === Number(user.id);
  }, [hierarchy, user, isEducatorRole]);

  const isEnrolledInSelected = useMemo(() => {
    if (!hierarchy) return false;
    if (hierarchy.is_enrolled) return true;
    return enrolledList.some((c) => Number(c.id) === Number(hierarchy.id));
  }, [hierarchy, enrolledList]);

  const activeModule = useMemo(() => {
    if (!hierarchy?.modules) return null;
    return (
      hierarchy.modules.find((m) => Number(m.id) === Number(activeModuleId)) ||
      hierarchy.modules[0] ||
      null
    );
  }, [hierarchy, activeModuleId]);

  const activeTopic = useMemo(() => {
    if (!activeModule) return null;
    const topics = activeModule.topics || [];
    const foundInActiveMod = topics.find((t) => Number(t.id) === Number(activeTopicId));
    if (foundInActiveMod) return foundInActiveMod;
    return topics[0] || null;
  }, [activeModule, activeTopicId]);

  const activeTopicModule = useMemo(() => {
    return activeModule;
  }, [activeModule]);

  // Clear active PDF viewer if the user switches to a module that does not own the currently open PDF resource
  useEffect(() => {
    if (!activeModule || !activePdfResourceId) return;
    const belongsToActiveMod = (activeModule.resources || []).some(
      (r) => Number(r.id) === Number(activePdfResourceId)
    );
    if (!belongsToActiveMod) {
      pdfReqIdRef.current += 1;
      clearActivePdf();
      setPdfLoading(false);
      setPdfError('');
    }
  }, [activeModule, activePdfResourceId, clearActivePdf]);

  const totalTopicsCount = useMemo(() => {
    if (!hierarchy?.modules) return 0;
    return hierarchy.modules.reduce((acc, m) => acc + (m.topics?.length || 0), 0);
  }, [hierarchy]);

  const completedTopicsCount = useMemo(() => {
    if (!hierarchy?.modules || totalTopicsCount === 0) return 0;
    const validTopicIds = new Set(
      (hierarchy.modules || []).flatMap((m) => (m.topics || []).map((t) => Number(t.id)))
    );
    let done = 0;
    completedTopicIds.forEach((id) => {
      if (validTopicIds.has(Number(id))) done += 1;
    });
    return done;
  }, [hierarchy, totalTopicsCount, completedTopicIds]);

  const completionPercent = useMemo(() => {
    if (totalTopicsCount === 0) return 0;
    return Math.min(100, Math.round((completedTopicsCount / totalTopicsCount) * 100));
  }, [totalTopicsCount, completedTopicsCount]);

  const showBanner = useCallback((type, text) => {
    setActionBanner({ type, text });
    if (bannerTimeoutRef.current) {
      clearTimeout(bannerTimeoutRef.current);
    }
    bannerTimeoutRef.current = setTimeout(() => {
      if (isMountedRef.current) {
        setActionBanner((prev) => (prev?.text === text ? null : prev));
      }
    }, 5000);
  }, []);

  // Toggle Topic Completion
  const handleToggleTopicComplete = async (topic) => {
    if (!topic || togglingComplete || !hierarchy?.id) return;
    const targetCourseId = hierarchy.id;
    if (Number(selectedCourseIdRef.current) !== Number(targetCourseId)) return;

    const topicIdNum = Number(topic.id);
    const currentlyDone = completedTopicIds.has(topicIdNum);
    const nextState = !currentlyDone;
    const reqId = ++progressReqIdRef.current;
    const toggleReqId = ++toggleReqIdRef.current;
    setTogglingComplete(true);
    setProgressError('');
    try {
      const res = await coursesAPI.completeTopic(topicIdNum, { is_completed: nextState });
      if (
        !isMountedRef.current ||
        reqId !== progressReqIdRef.current ||
        Number(selectedCourseIdRef.current) !== Number(targetCourseId)
      ) {
        return;
      }
      if (res && Array.isArray(res.completed_topic_ids)) {
        setCompletedTopicIds(
          new Set(
            res.completed_topic_ids
              .map((id) => Number(id))
              .filter((id) => !Number.isNaN(id))
          )
        );
      } else {
        setCompletedTopicIds((prev) => {
          const next = new Set(prev);
          if (nextState) next.add(topicIdNum);
          else next.delete(topicIdNum);
          return next;
        });
      }
      setProgressError('');
      if (onRefreshCourses) onRefreshCourses();
    } catch (err) {
      if (
        !isMountedRef.current ||
        reqId !== progressReqIdRef.current ||
        Number(selectedCourseIdRef.current) !== Number(targetCourseId)
      ) {
        return;
      }
      const errMsg = err.response?.data?.detail || 'Could not update topic completion status.';
      setProgressError(errMsg);
      showBanner('error', errMsg);
    } finally {
      if (
        isMountedRef.current &&
        reqId === progressReqIdRef.current &&
        Number(selectedCourseIdRef.current) === Number(targetCourseId)
      ) {
        setProgressLoading(false);
      }
      if (
        isMountedRef.current &&
        toggleReqId === toggleReqIdRef.current &&
        Number(selectedCourseIdRef.current) === Number(targetCourseId)
      ) {
        setTogglingComplete(false);
      }
    }
  };

  // Enroll from Course Preview
  const handleEnrollFromPreview = async () => {
    if (!hierarchy || enrollingInPreview) return;
    const targetCourseId = hierarchy.id;
    const targetCourseTitle = hierarchy.title;
    setEnrollingInPreview(true);
    try {
      await coursesAPI.enroll(targetCourseId);
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        await loadCourseWorkspace(targetCourseId, true);
        setActiveTab('learn');
        showBanner('success', `Successfully enrolled in "${targetCourseTitle}"!`);
      }
      await fetchMyEnrolledCourses();
      if (onRefreshCourses) await onRefreshCourses();
    } catch (err) {
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        showBanner('error', err.response?.data?.detail || 'Failed to enroll in this course.');
      }
    } finally {
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        setEnrollingInPreview(false);
      }
    }
  };

  // Publish / Unpublish Course
  const handleTogglePublish = async (courseObj) => {
    const targetId = courseObj?.id;
    if (!targetId) return;
    const currentlyPublished = Boolean(courseObj.is_published ?? true);
    try {
      if (currentlyPublished) {
        await coursesAPI.unpublish(targetId);
        showBanner('success', `Course "${courseObj.title}" is now saved as DRAFT and hidden from discovery.`);
      } else {
        await coursesAPI.publish(targetId);
        showBanner('success', `Course "${courseObj.title}" is now PUBLISHED and live for students!`);
      }
      if (Number(selectedCourseIdRef.current) === Number(targetId)) {
        await loadCourseWorkspace(targetId, true);
      }
      await fetchMyCreatedCourses();
      if (onRefreshCourses) await onRefreshCourses();
    } catch (err) {
      showBanner(
        'error',
        err.response?.data?.detail || 'Failed to update course publication status.'
      );
    }
  };

  // Open Edit Course Info Modal
  const openEditCourseModal = (courseObj) => {
    setEditingCourse(courseObj);
    setEditCourseForm({
      title: courseObj.title || '',
      description: courseObj.description || '',
      difficulty: formatDifficulty(courseObj.difficulty),
      target_branch:
        courseObj.target_branch ||
        courseObj.category ||
        'Computer Science & Engineering (CSE)',
      thumbnail_url: courseObj.thumbnail_url || ''
    });
  };

  const handleSaveCourseMetadata = async (e) => {
    e.preventDefault();
    if (!editingCourse) return;
    if (!editCourseForm.title.trim() || editCourseForm.title.trim().length < 2) {
      showBanner('error', 'Course title must be at least 2 characters.');
      return;
    }
    if (!editCourseForm.description.trim()) {
      showBanner('error', 'Course description cannot be empty.');
      return;
    }

    const targetCourseId = editingCourse.id;
    setSavingCourseMeta(true);
    try {
      await coursesAPI.update(targetCourseId, {
        title: editCourseForm.title.trim(),
        description: editCourseForm.description.trim(),
        difficulty: editCourseForm.difficulty,
        target_branch: editCourseForm.target_branch,
        category: editCourseForm.target_branch,
        thumbnail_url: editCourseForm.thumbnail_url.trim() || null
      });
      if (isMountedRef.current) {
        setEditingCourse(null);
        showBanner('success', 'Course details updated successfully.');
      }
      if (Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        await loadCourseWorkspace(targetCourseId, true);
      }
      await fetchMyCreatedCourses();
      if (onRefreshCourses) await onRefreshCourses();
    } catch (err) {
      if (isMountedRef.current) {
        showBanner('error', err.response?.data?.detail || 'Failed to update course metadata.');
      }
    } finally {
      if (isMountedRef.current) {
        setSavingCourseMeta(false);
      }
    }
  };

  // Confirm Delete or Unenroll
  const handleConfirmDeleteOrUnenroll = async (courseObj) => {
    if (!courseObj || deletingCourseRef.current) return;
    const targetCourseId =
      typeof courseObj === 'object' && courseObj !== null ? courseObj.id : courseObj;
    const targetCourseTitle =
      (typeof courseObj === 'object' && courseObj !== null ? courseObj.title : null) || 'Course';
    if (targetCourseId == null || targetCourseId === '') return;

    deletingCourseRef.current = true;
    setDeletingCourse(true);
    try {
      if (deleteMode === 'delete') {
        if (onDeleteCoursePermanently) {
          await onDeleteCoursePermanently(targetCourseId);
        } else {
          await coursesAPI.deleteCourse(targetCourseId);
          await fetchMyCreatedCourses();
        }
        if (isMountedRef.current) {
          setCreatedList((prev) => prev.filter((c) => Number(c.id) !== Number(targetCourseId)));
          setEnrolledList((prev) => prev.filter((c) => Number(c.id) !== Number(targetCourseId)));
          showBanner('success', `Course "${targetCourseTitle}" was permanently deleted.`);
        }
      } else {
        if (onUnenrollCourse) {
          const freshEnrolled = await onUnenrollCourse(targetCourseId);
          if (isMountedRef.current) {
            if (Array.isArray(freshEnrolled)) {
              setEnrolledList(freshEnrolled);
            } else {
              try {
                await fetchMyEnrolledCourses();
              } catch (refreshErr) {
                console.warn('Background fetchMyEnrolledCourses notice after unenroll:', refreshErr);
              }
            }
          }
        } else {
          await coursesAPI.unenroll(targetCourseId);
          if (isMountedRef.current) {
            setEnrolledList((prev) => (Array.isArray(prev) ? prev : []).filter((c) => Number(c.id) !== Number(targetCourseId)));
            try {
              await fetchMyEnrolledCourses();
            } catch (refreshErr) {
              console.warn('Background fetchMyEnrolledCourses notice after unenroll:', refreshErr);
            }
          }
        }
        if (isMountedRef.current) {
          showBanner('success', `Unenrolled from "${targetCourseTitle}".`);
        }
      }
      if (isMountedRef.current) {
        setCourseToDelete(null);
      }
      if (Number(selectedCourseIdRef.current) === Number(targetCourseId) && onBackToDashboard) {
        onBackToDashboard();
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.detail || err.message || 'Operation failed. Please try again.';
      if (isMountedRef.current) {
        showBanner('error', errMsg);
      }
      throw err;
    } finally {
      deletingCourseRef.current = false;
      if (isMountedRef.current) {
        setDeletingCourse(false);
      }
    }
  };

  // Module CRUD Handlers
  const handleSaveModule = async (e) => {
    e.preventDefault();
    if (!moduleModal || !hierarchy) return;
    if (!moduleForm.title.trim()) {
      showBanner('error', 'Module title is required.');
      return;
    }
    const targetCourseId = hierarchy.id;
    const modalSnapshot = moduleModal;
    setSavingModule(true);
    try {
      let created = null;
      if (modalSnapshot.mode === 'create') {
        created = await coursesAPI.createModule(targetCourseId, {
          title: moduleForm.title.trim(),
          description: moduleForm.description.trim() || undefined
        });
      } else if (modalSnapshot.module) {
        await coursesAPI.updateModule(modalSnapshot.module.id, {
          title: moduleForm.title.trim(),
          description: moduleForm.description.trim() || undefined
        });
      }
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        if (created) {
          setActiveModuleId(created.id);
          activeModuleIdRef.current = created.id;
          setActiveTopicId(null);
          activeTopicIdRef.current = null;
          showBanner('success', `Module "${created.title}" added.`);
        } else {
          showBanner('success', 'Module updated.');
        }
        setModuleModal(null);
        await loadCourseWorkspace(targetCourseId, true);
      }
      await fetchMyCreatedCourses();
      if (onRefreshCourses) await onRefreshCourses();
    } catch (err) {
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        showBanner('error', err.response?.data?.detail || 'Failed to save module.');
      }
    } finally {
      if (isMountedRef.current) {
        setSavingModule(false);
      }
    }
  };

  const handleDeleteModule = async (mod) => {
    if (!mod || !hierarchy) return;
    if (!window.confirm(`Delete module "${mod.title}" and all topics inside it?`)) return;
    const targetCourseId = hierarchy.id;
    try {
      await coursesAPI.deleteModule(mod.id);
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        if (
          (mod.resources || []).some((r) => Number(r.id) === Number(activePdfResourceId))
        ) {
          pdfReqIdRef.current += 1;
          clearActivePdf();
        }
        showBanner('success', `Module "${mod.title}" deleted.`);
        await loadCourseWorkspace(targetCourseId, true);
      }
      await fetchMyCreatedCourses();
      if (onRefreshCourses) await onRefreshCourses();
    } catch (err) {
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        showBanner('error', err.response?.data?.detail || 'Failed to delete module.');
      }
    }
  };

  const handleMoveModule = async (modIndex, direction) => {
    const targetCourseId = hierarchy?.id;
    if (!targetCourseId || reorderingModulesRef.current) return;
    const mods = [...(hierarchy?.modules || [])];
    const targetIndex = modIndex + direction;
    if (targetIndex < 0 || targetIndex >= mods.length) return;

    reorderingModulesRef.current = true;
    setReorderingModules(true);

    const temp = mods[modIndex];
    mods[modIndex] = mods[targetIndex];
    mods[targetIndex] = temp;
    try {
      await coursesAPI.reorderModules(
        targetCourseId,
        mods.map((m) => m.id)
      );
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        await loadCourseWorkspace(targetCourseId, true);
      }
    } catch (err) {
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        showBanner('error', err.response?.data?.detail || 'Failed to reorder modules.');
      }
    } finally {
      reorderingModulesRef.current = false;
      if (isMountedRef.current) {
        setReorderingModules(false);
      }
    }
  };

  // Topic CRUD Handlers
  const handleSaveTopic = async (e) => {
    e.preventDefault();
    if (!topicModal || !hierarchy) return;
    if (!topicForm.title.trim()) {
      showBanner('error', 'Topic title is required.');
      return;
    }
    const ytId = extractYoutubeVideoId(topicForm.youtube_url);
    if (!ytId) {
      showBanner(
        'error',
        'Invalid YouTube URL. Please enter a valid YouTube watch, youtu.be, embed, or shorts URL.'
      );
      return;
    }

    const targetCourseId = hierarchy.id;
    const modalSnapshot = topicModal;
    setSavingTopic(true);
    try {
      let created = null;
      if (modalSnapshot.mode === 'create') {
        created = await coursesAPI.createTopic(modalSnapshot.moduleId, {
          title: topicForm.title.trim(),
          description: topicForm.description.trim() || undefined,
          youtube_url: topicForm.youtube_url.trim()
        });
      } else if (modalSnapshot.topic) {
        await coursesAPI.updateTopic(modalSnapshot.topic.id, {
          title: topicForm.title.trim(),
          description: topicForm.description.trim() || undefined,
          youtube_url: topicForm.youtube_url.trim()
        });
      }
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        if (created) {
          setActiveModuleId(modalSnapshot.moduleId);
          activeModuleIdRef.current = modalSnapshot.moduleId;
          setActiveTopicId(created.id);
          activeTopicIdRef.current = created.id;
          showBanner('success', `Topic "${created.title}" added.`);
        } else {
          showBanner('success', 'Topic updated.');
        }
        setTopicModal(null);
        await loadCourseWorkspace(targetCourseId, true);
      }
      await fetchMyCreatedCourses();
      if (onRefreshCourses) await onRefreshCourses();
    } catch (err) {
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        showBanner('error', err.response?.data?.detail || 'Failed to save topic.');
      }
    } finally {
      if (isMountedRef.current) {
        setSavingTopic(false);
      }
    }
  };

  const handleDeleteTopic = async (topic) => {
    if (!topic || !hierarchy) return;
    if (!window.confirm(`Delete topic "${topic.title}"?`)) return;
    const targetCourseId = hierarchy.id;
    try {
      await coursesAPI.deleteTopic(topic.id);
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        showBanner('success', `Topic "${topic.title}" deleted.`);
        await loadCourseWorkspace(targetCourseId, true);
      }
      await fetchMyCreatedCourses();
      if (onRefreshCourses) await onRefreshCourses();
    } catch (err) {
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        showBanner('error', err.response?.data?.detail || 'Failed to delete topic.');
      }
    }
  };

  const handleMoveTopic = async (moduleObj, topicIndex, direction) => {
    const targetCourseId = hierarchy?.id;
    const moduleId = moduleObj?.id;
    if (!targetCourseId || !moduleId || reorderingTopicsRef.current.has(moduleId)) return;
    const topics = [...(moduleObj.topics || [])];
    const targetIndex = topicIndex + direction;
    if (targetIndex < 0 || targetIndex >= topics.length) return;

    reorderingTopicsRef.current.add(moduleId);
    setReorderingTopicModules((prev) => ({ ...prev, [moduleId]: true }));

    const temp = topics[topicIndex];
    topics[topicIndex] = topics[targetIndex];
    topics[targetIndex] = temp;
    try {
      await coursesAPI.reorderTopics(
        moduleId,
        topics.map((t) => t.id)
      );
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        await loadCourseWorkspace(targetCourseId, true);
      }
    } catch (err) {
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        showBanner('error', err.response?.data?.detail || 'Failed to reorder topics.');
      }
    } finally {
      reorderingTopicsRef.current.delete(moduleId);
      if (isMountedRef.current) {
        setReorderingTopicModules((prev) => {
          const next = { ...prev };
          delete next[moduleId];
          return next;
        });
      }
    }
  };

  // Module PDF Upload, View, and Delete
  const handleUploadModulePdf = async (moduleId, file) => {
    if (!file || !hierarchy) return;
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showBanner('error', 'Only PDF files are supported for module notes.');
      return;
    }
    const targetCourseId = hierarchy.id;
    setUploadingModuleIds((prev) => ({ ...prev, [moduleId]: true }));
    try {
      const fd = new FormData();
      fd.append('title', file.name.replace(/\.pdf$/i, ''));
      fd.append('file', file);
      await coursesAPI.uploadResource(moduleId, fd);
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        showBanner('success', `Uploaded PDF notes "${file.name}".`);
        await loadCourseWorkspace(targetCourseId, true);
      }
    } catch (err) {
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        showBanner('error', err.response?.data?.detail || 'Failed to upload PDF notes.');
      }
    } finally {
      if (isMountedRef.current) {
        setUploadingModuleIds((prev) => {
          const next = { ...prev };
          delete next[moduleId];
          return next;
        });
      }
    }
  };

  const handleViewModulePdf = async (resource, moduleId = null) => {
    if (!resource) return;
    const reqId = ++pdfReqIdRef.current;
    const targetCourseId = selectedCourseIdRef.current;
    const resolvedModuleId =
      moduleId ??
      resource.module_id ??
      hierarchy?.modules?.find((m) =>
        (m.resources || []).some((r) => Number(r.id) === Number(resource.id))
      )?.id ??
      null;

    if (resolvedModuleId != null) {
      const currentModId = activeModuleIdRef.current ?? activeModule?.id ?? null;
      const isSwitchingModule = Number(currentModId) !== Number(resolvedModuleId);
      setActiveModuleId(resolvedModuleId);
      activeModuleIdRef.current = resolvedModuleId;
      if (isSwitchingModule) {
        const targetMod = (hierarchy?.modules || []).find(
          (m) => Number(m.id) === Number(resolvedModuleId)
        );
        if (targetMod) {
          const currentTopInTarget = (targetMod.topics || []).some(
            (t) => Number(t.id) === Number(activeTopicIdRef.current)
          );
          if (!currentTopInTarget) {
            const firstTop = targetMod.topics?.[0] || null;
            const nextTopId = firstTop ? firstTop.id : null;
            setActiveTopicId(nextTopId);
            activeTopicIdRef.current = nextTopId;
          }
        }
        setExpandedModules((prev) => ({
          ...prev,
          [resolvedModuleId]: true
        }));
      }
    }

    clearActivePdf();
    setPdfLoading(true);
    setPdfError('');
    setActivePdfResourceId(resource.id);
    setActivePdfTitle(resource.title || 'Module Lecture Notes');
    setActiveTab('notes');
    try {
      const blob = await coursesAPI.viewResource(resource.id);
      if (
        !isMountedRef.current ||
        reqId !== pdfReqIdRef.current ||
        Number(selectedCourseIdRef.current) !== Number(targetCourseId) ||
        (resolvedModuleId != null &&
          Number(activeModuleIdRef.current) !== Number(resolvedModuleId))
      ) {
        return;
      }
      const pdfBlob = new Blob([blob], { type: 'application/pdf' });
      const url = URL.createObjectURL(pdfBlob);
      activePdfUrlRef.current = url;
      setActivePdfUrl(url);
    } catch (err) {
      if (
        !isMountedRef.current ||
        reqId !== pdfReqIdRef.current ||
        Number(selectedCourseIdRef.current) !== Number(targetCourseId) ||
        (resolvedModuleId != null &&
          Number(activeModuleIdRef.current) !== Number(resolvedModuleId))
      ) {
        return;
      }
      console.error('Failed to load PDF resource:', err);
      setPdfError(
        err.response?.data?.detail ||
          'Unable to load the PDF document from the server.'
      );
    } finally {
      if (
        isMountedRef.current &&
        reqId === pdfReqIdRef.current &&
        Number(selectedCourseIdRef.current) === Number(targetCourseId) &&
        (resolvedModuleId == null ||
          Number(activeModuleIdRef.current) === Number(resolvedModuleId))
      ) {
        setPdfLoading(false);
      }
    }
  };

  const handleDeleteModulePdf = async (resource) => {
    if (!resource || !hierarchy) return;
    if (!window.confirm(`Remove PDF notes "${resource.title}"?`)) return;
    const targetCourseId = hierarchy.id;
    try {
      await coursesAPI.deleteResource(resource.id);
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        if (Number(activePdfResourceId) === Number(resource.id)) {
          pdfReqIdRef.current += 1;
          clearActivePdf();
          setPdfError('');
        }
        showBanner('success', 'PDF notes removed.');
        await loadCourseWorkspace(targetCourseId, true);
      }
    } catch (err) {
      if (isMountedRef.current && Number(selectedCourseIdRef.current) === Number(targetCourseId)) {
        showBanner('error', err.response?.data?.detail || 'Failed to remove PDF notes.');
      }
    }
  };

  // ============================================================================
  // RENDER MODE 1: SELECTED COURSE WORKSPACE / PREVIEW / CURRICULUM STUDIO
  // ============================================================================
  if (selectedCourseId) {
    if (hierarchyLoading) {
      return (
        <div className="py-24 flex flex-col items-center justify-center gap-4 text-slate-400">
          <div className="h-12 w-12 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
          <p className="text-sm font-semibold">Loading course curriculum and learning environment...</p>
        </div>
      );
    }

    if (hierarchyError || !hierarchy) {
      return (
        <div className="max-w-2xl mx-auto my-12 p-8 rounded-3xl bg-[#121826] border border-rose-500/30 text-center space-y-5">
          <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
            <AlertCircle className="h-7 w-7" />
          </div>
          <div>
            <h2 className="text-lg font-black text-white">Unable to Load Course</h2>
            <p className="text-xs text-rose-300 mt-1">{hierarchyError || 'Course not found.'}</p>
          </div>
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={onBackToDashboard}
              className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold transition flex items-center gap-1.5"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Courses</span>
            </button>
            <button
              onClick={() => loadCourseWorkspace(selectedCourseId, false)}
              className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry</span>
            </button>
          </div>
        </div>
      );
    }

    const canAccessFullWorkspace = isCourseOwner || (isEnrolledInSelected && !previewOnly);
    const difficultyLabel = formatDifficulty(hierarchy.difficulty);
    const difficultyClass = getDifficultyBadgeClass(hierarchy.difficulty);
    const hasRatings = Number(hierarchy.total_ratings || 0) > 0;
    const activeVideoId = activeTopic
      ? extractYoutubeVideoId(activeTopic.youtube_video_id) ||
        extractYoutubeVideoId(activeTopic.youtube_url)
      : null;

    return (
      <div className="space-y-6 pb-12">
        {/* Top Course Header Bar */}
        <div className="rounded-3xl bg-gradient-to-r from-[#121826] via-[#151d30] to-[#121826] border border-[#1e2638] p-6 shadow-xl space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button
              onClick={onBackToDashboard}
              className="px-3.5 py-2 rounded-xl bg-[#0b0f19] hover:bg-slate-800 text-slate-300 hover:text-white border border-[#1e2638] text-xs font-bold transition flex items-center gap-2"
            >
              <ArrowLeft className="h-4 w-4 text-indigo-400" />
              <span>Back to Course Dashboard</span>
            </button>

            <div className="flex flex-wrap items-center gap-2">
              {isCourseOwner && (
                <>
                  <span
                    className={`px-3 py-1 rounded-full text-[11px] font-black uppercase tracking-wider border ${
                      hierarchy.is_published
                        ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                    }`}
                  >
                    {hierarchy.is_published ? 'Published' : 'Draft'}
                  </span>

                  <button
                    onClick={() => openEditCourseModal(hierarchy)}
                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition flex items-center gap-1.5"
                  >
                    <Edit3 className="h-3.5 w-3.5 text-indigo-400" />
                    <span>Edit Info</span>
                  </button>

                  <button
                    onClick={() => handleTogglePublish(hierarchy)}
                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                      hierarchy.is_published
                        ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border-amber-500/30'
                        : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/30'
                    }`}
                  >
                    {hierarchy.is_published ? (
                      <>
                        <FileEdit className="h-3.5 w-3.5" />
                        <span>Unpublish to Draft</span>
                      </>
                    ) : (
                      <>
                        <Globe className="h-3.5 w-3.5" />
                        <span>Publish Course</span>
                      </>
                    )}
                  </button>

                  <button
                    onClick={() => {
                      setDeleteMode('delete');
                      setCourseToDelete(hierarchy);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 text-xs font-bold transition flex items-center gap-1.5"
                    title="Delete Course Permanently"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Delete</span>
                  </button>
                </>
              )}

              {isEnrolledInSelected && !isCourseOwner && (
                <>
                  <button
                    onClick={() => onOpenRateModal && onOpenRateModal(hierarchy)}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition flex items-center gap-1.5"
                  >
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                    <span>Rate Course</span>
                  </button>
                  <button
                    onClick={() => {
                      setDeleteMode('unenroll');
                      setCourseToDelete(hierarchy);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-[#0b0f19] hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-[#1e2638] text-xs font-bold transition flex items-center gap-1.5"
                    title="Unenroll from Course"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>Unenroll</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {actionBanner && (
            <div
              className={`p-3.5 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-2 ${
                actionBanner.type === 'error'
                  ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <div className="flex items-center gap-2">
                {actionBanner.type === 'error' ? (
                  <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                )}
                <span>{actionBanner.text}</span>
              </div>
              <button onClick={() => setActionBanner(null)} className="text-slate-400 hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Course Title & Metadata Summary */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pt-1">
            <div className="space-y-2 max-w-3xl">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                  {hierarchy.code}
                </span>
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                  {hierarchy.target_branch || hierarchy.category}
                </span>
                <span className={`text-[11px] font-extrabold px-2.5 py-0.5 rounded-full border ${difficultyClass}`}>
                  {difficultyLabel}
                </span>
                <span className="text-xs font-bold text-amber-300 flex items-center gap-1 ml-1">
                  <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                  {hasRatings
                    ? `${Number(hierarchy.average_rating).toFixed(1)} (${hierarchy.total_ratings} reviews)`
                    : 'No ratings yet'}
                </span>
              </div>

              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                {hierarchy.title}
              </h1>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                {hierarchy.description}
              </p>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                <span className="flex items-center gap-1.5 font-semibold text-slate-200">
                  <GraduationCap className="h-4 w-4 text-purple-400" />
                  <span>{hierarchy.educator_name || 'Course Instructor'}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Building2 className="h-4 w-4 text-cyan-400" />
                  <span>{hierarchy.university || hierarchy.educator_university || 'University / Institution not specified'}</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-indigo-400" />
                  <span>{hierarchy.modules?.length || 0} Modules</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Video className="h-4 w-4 text-emerald-400" />
                  <span>{totalTopicsCount} Topics</span>
                </span>
                <span>•</span>
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-amber-400" />
                  <span>{hierarchy.enrolled_count ?? 0} Enrolled</span>
                </span>
              </div>
            </div>

            {/* Progress or Enrollment Call-to-Action */}
            {canAccessFullWorkspace ? (
              <div className="bg-[#0b0f19] border border-[#1e2638] rounded-2xl p-4 min-w-[230px] space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-400">Course Progress</span>
                  <span className="text-emerald-400">{completionPercent}%</span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                    style={{ width: `${completionPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[11px] text-slate-500">
                    {progressLoading
                      ? 'Syncing progress...'
                      : `${completedTopicsCount} of ${totalTopicsCount} topics completed`}
                  </p>
                  {progressError && (
                    <button
                      type="button"
                      onClick={() => fetchCourseProgress(hierarchy.id, { preserveOnError: true })}
                      className="text-[10px] font-bold text-amber-400 hover:text-amber-300 flex items-center gap-1"
                      title={progressError}
                    >
                      <RefreshCw className="h-3 w-3" />
                      <span>Retry</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-[#0b0f19] border border-indigo-500/40 rounded-2xl p-5 min-w-[250px] space-y-3 text-center">
                <p className="text-xs font-semibold text-slate-300">
                  Enroll in this course to unlock video lectures, module PDF notes, and progress tracking.
                </p>
                <button
                  onClick={handleEnrollFromPreview}
                  disabled={enrollingInPreview}
                  className="w-full py-2.5 px-5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition flex items-center justify-center gap-2"
                >
                  {enrollingInPreview ? (
                    <span>Enrolling...</span>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Enroll in Course</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Workspace Mode Switcher Tabs */}
          {canAccessFullWorkspace && (
            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-[#1e2638]">
              <button
                onClick={() => setActiveTab('learn')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === 'learn'
                    ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/25'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-[#1e2638]'
                }`}
              >
                <Play className="h-3.5 w-3.5" />
                <span>Video Lectures &amp; Learning</span>
              </button>

              <button
                onClick={() => setActiveTab('notes')}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                  activeTab === 'notes'
                    ? 'bg-cyan-600 text-white shadow-md shadow-cyan-600/25'
                    : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-[#1e2638]'
                }`}
              >
                <FileText className="h-3.5 w-3.5" />
                <span>Module PDF Notes ({activeModule?.resources?.length || 0})</span>
              </button>

              {isCourseOwner && (
                <button
                  onClick={() => setActiveTab('curriculum')}
                  className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 ${
                    activeTab === 'curriculum'
                      ? 'bg-purple-600 text-white shadow-md shadow-purple-600/25'
                      : 'bg-[#0b0f19] text-slate-400 hover:text-white border border-[#1e2638]'
                  }`}
                >
                  <Settings className="h-3.5 w-3.5" />
                  <span>Manage Curriculum (Modules, Topics &amp; PDFs)</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* If Unenrolled Preview Mode: Show Syllabus Preview */}
        {!canAccessFullWorkspace ? (
          <div className="rounded-3xl bg-[#121826] border border-[#1e2638] p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-lg font-black text-white">Course Curriculum Outline</h2>
                <p className="text-xs text-slate-400">
                  Preview the modules and topics included in this course. Click &ldquo;Enroll in Course&rdquo; above to begin learning.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {(hierarchy.modules || []).map((mod, mIdx) => (
                <div
                  key={mod.id}
                  className="p-4 rounded-2xl bg-[#0b0f19] border border-[#1e2638] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-indigo-400">
                        Module {mIdx + 1}
                      </span>
                      <h3 className="text-sm font-bold text-white">{mod.title}</h3>
                      {mod.description && (
                        <p className="text-xs text-slate-400 mt-0.5">{mod.description}</p>
                      )}
                    </div>
                    <span className="text-xs font-semibold text-slate-400">
                      {mod.topics?.length || 0} Topics • {mod.resources?.length || 0} PDFs
                    </span>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t border-[#1e2638]">
                    {(mod.topics || []).map((top, tIdx) => (
                      <div
                        key={top.id}
                        className="flex items-center justify-between py-1.5 px-3 rounded-xl bg-[#121826] text-xs text-slate-300"
                      >
                        <div className="flex items-center gap-2">
                          <Lock className="h-3.5 w-3.5 text-slate-500" />
                          <span className="font-semibold">
                            {tIdx + 1}. {top.title}
                          </span>
                        </div>
                        <span className="text-[11px] text-slate-500">Video Lecture</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : activeTab === 'curriculum' && isCourseOwner ? (
          /* ==================================================================
             EDUCATOR CURRICULUM STUDIO (ADD / EDIT / REORDER / DELETE)
             ================================================================== */
          <div className="rounded-3xl bg-[#121826] border border-[#1e2638] p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#1e2638] pb-4">
              <div>
                <h2 className="text-lg font-black text-white flex items-center gap-2">
                  <Layers className="h-5 w-5 text-purple-400" />
                  <span>Curriculum Management Studio</span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Add, edit, reorder, or remove modules, YouTube video topics, and optional PDF lecture notes. All changes persist directly to the database.
                </p>
              </div>

              <button
                onClick={() => {
                  setModuleForm({ title: '', description: '' });
                  setModuleModal({ mode: 'create' });
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/25 transition flex items-center gap-2 self-start sm:self-auto"
              >
                <Plus className="h-4 w-4" />
                <span>Add New Module</span>
              </button>
            </div>

            {(hierarchy.modules || []).length === 0 ? (
              <div className="py-12 text-center space-y-3 bg-[#0b0f19] rounded-2xl border border-[#1e2638]">
                <Layers className="h-10 w-10 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-white">No modules in this course yet</p>
                <p className="text-xs text-slate-400">
                  Add at least one module and one topic with a valid YouTube video URL before publishing.
                </p>
              </div>
            ) : (
              <div className="space-y-5">
                {hierarchy.modules.map((mod, mIdx) => (
                  <div
                    key={mod.id}
                    className="rounded-2xl bg-[#0b0f19] border border-[#1e2638] p-5 space-y-4"
                  >
                    {/* Module Header & Controls */}
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-[#1e2638] pb-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-black uppercase px-2.5 py-0.5 rounded-md bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                            Module {mIdx + 1}
                          </span>
                          <h3 className="text-base font-extrabold text-white">{mod.title}</h3>
                        </div>
                        {mod.description && (
                          <p className="text-xs text-slate-400 mt-1">{mod.description}</p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          disabled={mIdx === 0 || reorderingModules}
                          onClick={() => handleMoveModule(mIdx, -1)}
                          className="p-1.5 rounded-lg bg-[#121826] hover:bg-slate-800 disabled:opacity-30 text-slate-300 border border-[#1e2638]"
                          title="Move Module Up"
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={mIdx === hierarchy.modules.length - 1 || reorderingModules}
                          onClick={() => handleMoveModule(mIdx, 1)}
                          className="p-1.5 rounded-lg bg-[#121826] hover:bg-slate-800 disabled:opacity-30 text-slate-300 border border-[#1e2638]"
                          title="Move Module Down"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setModuleForm({
                              title: mod.title || '',
                              description: mod.description || ''
                            });
                            setModuleModal({ mode: 'edit', module: mod });
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-[#121826] hover:bg-slate-800 text-slate-200 text-xs font-bold border border-[#1e2638] flex items-center gap-1"
                        >
                          <Edit3 className="h-3.5 w-3.5 text-indigo-400" />
                          <span>Edit</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setTopicForm({ title: '', description: '', youtube_url: '' });
                            setTopicModal({ mode: 'create', moduleId: mod.id });
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 text-xs font-bold border border-indigo-500/30 flex items-center gap-1"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add Topic</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteModule(mod)}
                          className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                          title="Delete Module"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    {/* Topics inside Module */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Topics &amp; YouTube Lectures ({mod.topics?.length || 0})
                      </div>

                      {(mod.topics || []).length === 0 ? (
                        <div className="p-4 rounded-xl bg-[#121826] border border-amber-500/30 text-amber-300 text-xs flex items-center justify-between">
                          <span>This module has no topics yet. Add at least one topic with a YouTube URL.</span>
                          <button
                            onClick={() => {
                              setTopicForm({ title: '', description: '', youtube_url: '' });
                              setTopicModal({ mode: 'create', moduleId: mod.id });
                            }}
                            className="px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 font-bold"
                          >
                            + Add Topic
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {mod.topics.map((top, tIdx) => (
                            <div
                              key={top.id}
                              className="p-3 rounded-xl bg-[#121826] border border-[#1e2638] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                            >
                              <div className="space-y-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                                    Topic {tIdx + 1}
                                  </span>
                                  <span className="text-xs font-bold text-white truncate">
                                    {top.title}
                                  </span>
                                </div>
                                {top.description && (
                                  <p className="text-[11px] text-slate-400 line-clamp-1">
                                    {top.description}
                                  </p>
                                )}
                                <div className="flex items-center gap-2 text-[11px] text-emerald-400 font-mono">
                                  <Youtube className="h-3.5 w-3.5 text-rose-400" />
                                  <span className="truncate">{top.youtube_url}</span>
                                  {top.youtube_video_id && (
                                    <span className="text-slate-500">({top.youtube_video_id})</span>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  disabled={tIdx === 0 || Boolean(reorderingTopicModules[mod.id])}
                                  onClick={() => handleMoveTopic(mod, tIdx, -1)}
                                  className="p-1.5 rounded-lg bg-[#0b0f19] hover:bg-slate-800 disabled:opacity-30 text-slate-300 border border-[#1e2638]"
                                  title="Move Topic Up"
                                >
                                  <ArrowUp className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  disabled={tIdx === mod.topics.length - 1 || Boolean(reorderingTopicModules[mod.id])}
                                  onClick={() => handleMoveTopic(mod, tIdx, 1)}
                                  className="p-1.5 rounded-lg bg-[#0b0f19] hover:bg-slate-800 disabled:opacity-30 text-slate-300 border border-[#1e2638]"
                                  title="Move Topic Down"
                                >
                                  <ArrowDown className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setActiveModuleId(mod.id);
                                    activeModuleIdRef.current = mod.id;
                                    setActiveTopicId(top.id);
                                    activeTopicIdRef.current = top.id;
                                    setActiveTab('learn');
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center gap-1"
                                >
                                  <Play className="h-3 w-3" />
                                  <span>Watch</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTopicForm({
                                      title: top.title || '',
                                      description: top.description || '',
                                      youtube_url: top.youtube_url || ''
                                    });
                                    setTopicModal({
                                      mode: 'edit',
                                      moduleId: mod.id,
                                      topic: top
                                    });
                                  }}
                                  className="px-2.5 py-1 rounded-lg bg-[#0b0f19] hover:bg-slate-800 text-slate-200 text-xs font-bold border border-[#1e2638]"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteTopic(top)}
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                                  title="Delete Topic"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Module PDF Notes Management */}
                    <div className="pt-3 border-t border-[#1e2638] space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5" />
                          <span>Optional Module PDF Lecture Notes ({mod.resources?.length || 0})</span>
                        </span>

                        <label className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 border border-cyan-500/30 text-xs font-bold cursor-pointer transition flex items-center gap-1.5">
                          <Upload className="h-3.5 w-3.5" />
                          <span>
                            {Boolean(uploadingModuleIds[mod.id]) ? 'Uploading PDF...' : 'Upload PDF Notes'}
                          </span>
                          <input
                            type="file"
                            accept=".pdf,application/pdf"
                            className="hidden"
                            disabled={Boolean(uploadingModuleIds[mod.id])}
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUploadModulePdf(mod.id, file);
                              e.target.value = '';
                            }}
                          />
                        </label>
                      </div>

                      {(mod.resources || []).length === 0 ? (
                        <p className="text-xs text-slate-500 italic">
                          No PDF notes uploaded for this module. PDF notes are optional.
                        </p>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {mod.resources.map((res) => (
                            <div
                              key={res.id}
                              className="p-2.5 rounded-xl bg-[#121826] border border-[#1e2638] flex items-center justify-between gap-2"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <FileText className="h-4 w-4 text-cyan-400 shrink-0" />
                                <span className="text-xs font-semibold text-slate-200 truncate">
                                  {res.title}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleViewModulePdf(res, mod.id)}
                                  className="px-2.5 py-1 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-[11px] font-bold"
                                >
                                  View PDF
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteModulePdf(res)}
                                  className="p-1 rounded-lg text-rose-400 hover:bg-rose-500/15"
                                  title="Remove PDF"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ==================================================================
             STUDENT / EDUCATOR INTERACTIVE VIDEO & PDF LEARNING WORKSPACE
             ================================================================== */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Sidebar: Curriculum Modules & Topics Tree */}
            <div className="lg:col-span-4 rounded-3xl bg-[#121826] border border-[#1e2638] p-4 space-y-3 self-start">
              <div className="flex items-center justify-between px-2 py-1 border-b border-[#1e2638] pb-3">
                <div>
                  <h2 className="text-sm font-black text-white uppercase tracking-wider">
                    Course Curriculum
                  </h2>
                  <p className="text-[11px] text-slate-400">
                    {hierarchy.modules?.length || 0} Modules • {totalTopicsCount} Video Topics
                  </p>
                </div>
                {isCourseOwner && (
                  <button
                    onClick={() => setActiveTab('curriculum')}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-300 border border-purple-500/30 text-[11px] font-bold"
                  >
                    + Edit Syllabus
                  </button>
                )}
              </div>

              <div className="space-y-2.5 max-h-[70vh] overflow-y-auto pr-1">
                {(hierarchy.modules || []).map((mod, mIdx) => {
                  const isExpanded = expandedModules[mod.id] !== false;
                  const isCurrentMod = activeModule?.id === mod.id;
                  return (
                    <div
                      key={mod.id}
                      className={`rounded-2xl border transition ${
                        isCurrentMod
                          ? 'bg-[#0b0f19] border-indigo-500/40'
                          : 'bg-[#0b0f19]/60 border-[#1e2638]'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          const switchingModule = Number(activeModule?.id) !== Number(mod.id);
                          setActiveModuleId(mod.id);
                          activeModuleIdRef.current = mod.id;
                          if (switchingModule) {
                            const firstModTopic = mod.topics?.[0] || null;
                            const nextTopicId = firstModTopic ? firstModTopic.id : null;
                            setActiveTopicId(nextTopicId);
                            activeTopicIdRef.current = nextTopicId;
                            setExpandedModules((prev) => ({
                              ...prev,
                              [mod.id]: true
                            }));
                          } else {
                            setExpandedModules((prev) => ({
                              ...prev,
                              [mod.id]: !isExpanded
                            }));
                          }
                        }}
                        className="w-full p-3.5 text-left flex items-center justify-between gap-2"
                      >
                        <div className="min-w-0">
                          <span className="text-[10px] font-extrabold uppercase text-indigo-400 block">
                            Module {mIdx + 1}
                          </span>
                          <span className="text-xs font-bold text-white truncate block">
                            {mod.title}
                          </span>
                        </div>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-400 shrink-0" />
                        )}
                      </button>

                      {isExpanded && (
                        <div className="px-2.5 pb-3 space-y-1.5 border-t border-[#1e2638]/70 pt-2">
                          {(mod.topics || []).map((top, tIdx) => {
                            const isSelected =
                              Number(activeTopic?.id) === Number(top.id) && activeTab === 'learn';
                            const isDone = completedTopicIds.has(Number(top.id));
                            return (
                              <button
                                key={top.id}
                                type="button"
                                onClick={() => {
                                  setActiveModuleId(mod.id);
                                  activeModuleIdRef.current = mod.id;
                                  setActiveTopicId(top.id);
                                  activeTopicIdRef.current = top.id;
                                  setActiveTab('learn');
                                }}
                                className={`w-full px-3 py-2 rounded-xl text-left text-xs transition flex items-center justify-between gap-2 ${
                                  isSelected
                                    ? 'bg-indigo-600 text-white font-bold shadow-md shadow-indigo-600/20'
                                    : 'hover:bg-[#121826] text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {isDone ? (
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                                  ) : (
                                    <Play className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
                                  )}
                                  <span className="truncate">
                                    {tIdx + 1}. {top.title}
                                  </span>
                                </div>
                              </button>
                            );
                          })}

                          {/* Module PDF Notes shortcut inside module tree */}
                          {(mod.resources || []).map((res) => (
                            <button
                              key={`res_${res.id}`}
                              type="button"
                              onClick={() => handleViewModulePdf(res, mod.id)}
                              className="w-full px-3 py-2 rounded-xl text-left text-xs bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/20 transition flex items-center gap-2"
                            >
                              <FileText className="h-3.5 w-3.5 shrink-0" />
                              <span className="truncate">PDF: {res.title}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Right Main Area: Video Player or PDF Notes Viewer */}
            <div className="lg:col-span-8 space-y-5">
              {activeTab === 'notes' ? (
                <div className="rounded-3xl bg-[#121826] border border-[#1e2638] p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1e2638] pb-4">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-cyan-400">
                        {activeModule ? activeModule.title : 'Module Resources'}
                      </span>
                      <h2 className="text-lg font-black text-white">
                        {activePdfTitle || 'Module PDF Lecture Notes'}
                      </h2>
                    </div>

                    {isCourseOwner && activeModule && (
                      <label className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold cursor-pointer transition flex items-center gap-1.5">
                        <Upload className="h-3.5 w-3.5" />
                        <span>
                          {Boolean(uploadingModuleIds[activeModule.id]) ? 'Uploading...' : 'Upload PDF to Module'}
                        </span>
                        <input
                          type="file"
                          accept=".pdf,application/pdf"
                          className="hidden"
                          disabled={Boolean(uploadingModuleIds[activeModule.id])}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) handleUploadModulePdf(activeModule.id, f);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    )}
                  </div>

                  {/* List of PDFs in Active Module */}
                  {activeModule?.resources?.length > 0 ? (
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-center gap-2">
                        {activeModule.resources.map((res) => (
                          <div key={res.id} className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => handleViewModulePdf(res, activeModule.id)}
                              className={`px-3.5 py-2 rounded-xl text-xs font-bold border transition flex items-center gap-2 ${
                                Number(activePdfResourceId) === Number(res.id)
                                  ? 'bg-cyan-600 text-white border-cyan-500'
                                  : 'bg-[#0b0f19] text-slate-300 border-[#1e2638] hover:border-cyan-500/40'
                              }`}
                            >
                              <FileText className="h-3.5 w-3.5" />
                              <span>{res.title}</span>
                            </button>
                            {isCourseOwner && (
                              <button
                                type="button"
                                onClick={() => handleDeleteModulePdf(res)}
                                className="p-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20"
                                title="Delete PDF"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {pdfLoading ? (
                        <div className="py-20 text-center text-slate-400 space-y-2">
                          <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent mx-auto" />
                          <p className="text-xs">Loading PDF document...</p>
                        </div>
                      ) : pdfError ? (
                        <div className="p-6 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs text-center">
                          {pdfError}
                        </div>
                      ) : activePdfUrl ? (
                        <div className="w-full h-[650px] rounded-2xl overflow-hidden border border-[#1e2638] bg-[#0b0f19]">
                          <iframe
                            title={activePdfTitle || 'PDF Viewer'}
                            src={activePdfUrl}
                            className="w-full h-full"
                          />
                        </div>
                      ) : (
                        <div className="py-12 text-center text-slate-400 text-xs">
                          Click any PDF button above to open it in the reader.
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="py-16 text-center space-y-3 bg-[#0b0f19] rounded-2xl border border-[#1e2638]">
                      <FileText className="h-10 w-10 text-slate-600 mx-auto" />
                      <h3 className="text-sm font-bold text-white">
                        No PDF notes have been uploaded for this module.
                      </h3>
                      <p className="text-xs text-slate-400 max-w-md mx-auto">
                        Module PDF notes are optional. You can continue watching the video lectures in the Learning tab.
                      </p>
                    </div>
                  )}
                </div>
              ) : activeTopic ? (
                <div className="rounded-3xl bg-[#121826] border border-[#1e2638] overflow-hidden shadow-2xl">
                  {/* Embedded YouTube Player */}
                  <div className="aspect-video w-full bg-black relative">
                    {activeVideoId ? (
                      <iframe
                        key={`${activeTopic.id}_${activeVideoId}`}
                        title={activeTopic.title}
                        src={`https://www.youtube.com/embed/${activeVideoId}?rel=0&modestbranding=1`}
                        className="w-full h-full"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-6 text-center space-y-2">
                        <AlertCircle className="h-8 w-8 text-rose-400" />
                        <p className="text-sm font-bold text-white">
                          Video URL is missing or invalid for this topic.
                        </p>
                        {isCourseOwner && (
                          <button
                            onClick={() => {
                              setTopicForm({
                                title: activeTopic.title || '',
                                description: activeTopic.description || '',
                                youtube_url: activeTopic.youtube_url || ''
                              });
                              setTopicModal({
                                mode: 'edit',
                                moduleId: activeTopicModule?.id || activeModule?.id,
                                topic: activeTopic
                              });
                            }}
                            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold"
                          >
                            Fix YouTube URL
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Topic Details & Actions Bar */}
                  <div className="p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[11px] font-extrabold uppercase text-indigo-400">
                          {activeTopicModule?.title || activeModule?.title}
                        </span>
                        <h2 className="text-xl font-black text-white mt-0.5">
                          {activeTopic.title}
                        </h2>
                      </div>

                      <div className="flex flex-wrap items-center gap-2.5">
                        {activeVideoId && (
                          <a
                            href={`https://www.youtube.com/watch?v=${activeVideoId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3.5 py-2 rounded-xl bg-[#0b0f19] hover:bg-slate-800 text-slate-200 border border-[#1e2638] text-xs font-bold transition flex items-center gap-1.5"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-rose-400" />
                            <span>Watch on YouTube</span>
                          </a>
                        )}

                        <button
                          type="button"
                          onClick={() => handleToggleTopicComplete(activeTopic)}
                          disabled={togglingComplete}
                          className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            completedTopicIds.has(Number(activeTopic.id))
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/25'
                          }`}
                        >
                          <Check className="h-4 w-4" />
                          <span>
                            {completedTopicIds.has(Number(activeTopic.id))
                              ? 'Completed'
                              : 'Mark as Complete'}
                          </span>
                        </button>
                      </div>
                    </div>

                    {activeTopic.description && (
                      <p className="text-xs sm:text-sm text-slate-300 leading-relaxed pt-2 border-t border-[#1e2638]">
                        {activeTopic.description}
                      </p>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-3xl bg-[#121826] border border-[#1e2638] p-12 text-center space-y-3">
                  <Video className="h-10 w-10 text-slate-600 mx-auto" />
                  <h3 className="text-base font-bold text-white">No Topic Selected</h3>
                  <p className="text-xs text-slate-400">
                    Select a module and topic from the curriculum sidebar to start watching.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal: Edit Course Metadata */}
        {editingCourse && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-3xl bg-[#121826] border border-indigo-500/40 p-6 space-y-5 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#1e2638] pb-3">
                <h3 className="text-base font-black text-white">Edit Course Information</h3>
                <button
                  onClick={() => setEditingCourse(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveCourseMetadata} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Course Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={editCourseForm.title}
                    onChange={(e) =>
                      setEditCourseForm((p) => ({ ...p, title: e.target.value }))
                    }
                    className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Target Student Branch *
                    </label>
                    <select
                      value={editCourseForm.target_branch}
                      onChange={(e) =>
                        setEditCourseForm((p) => ({ ...p, target_branch: e.target.value }))
                      }
                      className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {TARGET_BRANCHES.map((b) => (
                        <option key={b} value={b}>
                          {b}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Difficulty *
                    </label>
                    <select
                      value={editCourseForm.difficulty}
                      onChange={(e) =>
                        setEditCourseForm((p) => ({ ...p, difficulty: e.target.value }))
                      }
                      className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white"
                    >
                      {DIFFICULTY_LEVELS.map((d) => (
                        <option key={d.value} value={d.value}>
                          {d.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Course Description *
                  </label>
                  <textarea
                    rows={3}
                    required
                    value={editCourseForm.description}
                    onChange={(e) =>
                      setEditCourseForm((p) => ({ ...p, description: e.target.value }))
                    }
                    className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2 text-xs text-white resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setEditingCourse(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingCourseMeta}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                  >
                    {savingCourseMeta ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create / Edit Module */}
        {moduleModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-md rounded-3xl bg-[#121826] border border-indigo-500/40 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#1e2638] pb-3">
                <h3 className="text-base font-black text-white">
                  {moduleModal.mode === 'create' ? 'Add New Module' : 'Edit Module'}
                </h3>
                <button
                  onClick={() => setModuleModal(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveModule} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Module Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={moduleForm.title}
                    onChange={(e) =>
                      setModuleForm((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="e.g. Module 2: Consensus Protocols"
                    className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={moduleForm.description}
                    onChange={(e) =>
                      setModuleForm((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="Learning objectives for this module"
                    className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2 text-xs text-white resize-none"
                  />
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setModuleModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingModule}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                  >
                    {savingModule ? 'Saving...' : 'Save Module'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Modal: Create / Edit Topic */}
        {topicModal && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="w-full max-w-lg rounded-3xl bg-[#121826] border border-indigo-500/40 p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#1e2638] pb-3">
                <h3 className="text-base font-black text-white">
                  {topicModal.mode === 'create' ? 'Add Video Lecture Topic' : 'Edit Topic'}
                </h3>
                <button
                  onClick={() => setTopicModal(null)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleSaveTopic} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Topic Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={topicForm.title}
                    onChange={(e) =>
                      setTopicForm((p) => ({ ...p, title: e.target.value }))
                    }
                    placeholder="e.g. Lecture 1: Raft Leader Election"
                    className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    YouTube Video URL *
                  </label>
                  <input
                    type="text"
                    required
                    value={topicForm.youtube_url}
                    onChange={(e) =>
                      setTopicForm((p) => ({ ...p, youtube_url: e.target.value }))
                    }
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2 text-xs text-white font-mono"
                  />
                  {topicForm.youtube_url && (
                    <div className="mt-2">
                      {extractYoutubeVideoId(topicForm.youtube_url) ? (
                        <div className="space-y-2">
                          <span className="text-[11px] text-emerald-400 flex items-center gap-1">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>
                              Valid Video ID:{' '}
                              <strong>{extractYoutubeVideoId(topicForm.youtube_url)}</strong>
                            </span>
                          </span>
                          <div className="aspect-video w-full rounded-xl overflow-hidden border border-slate-700 bg-black">
                            <iframe
                              title="Topic Video Preview"
                              src={`https://www.youtube.com/embed/${extractYoutubeVideoId(
                                topicForm.youtube_url
                              )}`}
                              className="w-full h-full"
                              allowFullScreen
                            />
                          </div>
                        </div>
                      ) : (
                        <span className="text-[11px] text-rose-400 flex items-center gap-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          <span>Invalid YouTube URL format.</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={topicForm.description}
                    onChange={(e) =>
                      setTopicForm((p) => ({ ...p, description: e.target.value }))
                    }
                    placeholder="Key takeaways and lecture notes summary"
                    className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2 text-xs text-white resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setTopicModal(null)}
                    className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={savingTopic}
                    className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                  >
                    {savingTopic ? 'Saving...' : 'Save Topic'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete / Unenroll Confirmation Modal in Workspace */}
        <CourseDeleteModal
          isOpen={Boolean(courseToDelete)}
          course={courseToDelete}
          isCreator={deleteMode === 'delete'}
          isEducator={isEducatorRole}
          loading={deletingCourse}
          onClose={() => setCourseToDelete(null)}
          onConfirm={handleConfirmDeleteOrUnenroll}
        />
      </div>
    );
  }

  // ============================================================================
  // RENDER MODE 2: COURSE PLAYER DASHBOARD (TWO PRIMARY SECTIONS)
  //   SECTION 1: MY CREATED COURSES (Educators)
  //   SECTION 2: MY ENROLLED COURSES (Students & Educators)
  // ============================================================================
  return (
    <div className="space-y-10 pb-12">
      {/* Top Banner */}
      <div className="rounded-3xl bg-gradient-to-r from-[#121826] via-[#172036] to-[#121826] border border-[#1e2638] p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6 shadow-xl">
        <div className="space-y-2 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
              CogniPath Course Hub
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
            Course Management &amp; Learning Studio
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            {isEducatorRole
              ? 'Create and manage your published curricula in My Created Courses, or explore and track enrolled courses below.'
              : 'Access your enrolled courses, watch structured video lectures, review module PDF notes, or discover new courses.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {isEducatorRole && (
            <button
              onClick={onOpenCreateCourse}
              className="px-5 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/30 transition flex items-center gap-2 cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>Create New Course</span>
            </button>
          )}

          <button
            onClick={onOpenExploreCatalog}
            className="px-5 py-3 rounded-2xl bg-[#0b0f19] hover:bg-slate-800 text-slate-100 border border-indigo-500/40 text-xs font-black uppercase tracking-wider transition flex items-center gap-2 cursor-pointer"
          >
            <Compass className="h-4 w-4 text-cyan-400" />
            <span>Find New Courses</span>
          </button>
        </div>
      </div>

      {actionBanner && (
        <div
          className={`p-4 rounded-2xl border text-xs font-semibold flex items-center justify-between gap-2 ${
            actionBanner.type === 'error'
              ? 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {actionBanner.type === 'error' ? (
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
            )}
            <span>{actionBanner.text}</span>
          </div>
          <button onClick={() => setActionBanner(null)} className="text-slate-400 hover:text-white">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ====================================================================
          SECTION 1: MY CREATED COURSES (Primarily for Educators)
         ==================================================================== */}
      {isEducatorRole && (
        <section className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e2638] pb-4">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-xl font-black text-white">My Created Courses</h2>
                <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                  {createdList.length}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Courses authored by you. Manage modules, YouTube lectures, PDF notes, and publication status.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchMyCreatedCourses}
                className="p-2 rounded-xl bg-[#121826] hover:bg-slate-800 text-slate-400 hover:text-white border border-[#1e2638] transition"
                title="Refresh My Created Courses"
              >
                <RefreshCw className={`h-4 w-4 ${createdLoading ? 'animate-spin' : ''}`} />
              </button>
              <button
                onClick={onOpenCreateCourse}
                className="px-4 py-2 rounded-xl bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-bold transition flex items-center gap-1.5"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Create Course</span>
              </button>
            </div>
          </div>

          {createdLoading ? (
            <div className="py-14 rounded-3xl bg-[#121826]/60 border border-[#1e2638] flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <p className="text-xs font-semibold">Loading your created courses...</p>
            </div>
          ) : createdError ? (
            <div className="p-8 rounded-3xl bg-[#121826] border border-rose-500/30 text-center space-y-3">
              <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
              <p className="text-sm font-bold text-white">Could not load My Created Courses</p>
              <p className="text-xs text-rose-300">{createdError}</p>
              <button
                onClick={fetchMyCreatedCourses}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
              >
                Retry
              </button>
            </div>
          ) : createdList.length === 0 ? (
            <div className="p-10 rounded-3xl bg-[#121826]/70 border border-[#1e2638] text-center space-y-4">
              <div className="h-12 w-12 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
                <Sparkles className="h-6 w-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-white">
                  You haven&apos;t created any courses yet.
                </h3>
                <p className="text-xs text-slate-400 max-w-md mx-auto">
                  Launch your first course with structured modules, YouTube lectures, and optional PDF lecture notes.
                </p>
              </div>
              <button
                onClick={onOpenCreateCourse}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold shadow-lg shadow-indigo-600/25 transition inline-flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                <span>Create Your First Course</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {createdList.map((course) => {
                const isPublished = Boolean(course.is_published ?? true);
                const diffLabel = formatDifficulty(course.difficulty);
                const diffClass = getDifficultyBadgeClass(course.difficulty);
                const branchLabel =
                  course.target_branch || course.category || 'Computer Science & Engineering (CSE)';

                return (
                  <div
                    key={course.id}
                    className="rounded-3xl bg-[#121826] border border-[#1e2638] hover:border-indigo-500/50 p-6 flex flex-col justify-between shadow-xl transition space-y-5"
                  >
                    <div className="space-y-4">
                      {/* Status + Difficulty + Code */}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span
                          className={`text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full border ${
                            isPublished
                              ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {isPublished ? 'Published' : 'Draft'}
                        </span>

                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                            {course.code}
                          </span>
                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${diffClass}`}>
                            {diffLabel}
                          </span>
                        </div>
                      </div>

                      {/* Title & Description */}
                      <div>
                        <h3 className="text-base font-extrabold text-white line-clamp-1">
                          {course.title}
                        </h3>
                        <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                          {course.description}
                        </p>
                      </div>

                      {/* Target Branch & University */}
                      <div className="p-3 rounded-2xl bg-[#0b0f19] border border-[#1a2335] space-y-1.5 text-xs">
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Branch</span>
                          <span className="font-semibold text-indigo-300 truncate max-w-[70%]">
                            {branchLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-slate-300">
                          <span className="text-[10px] uppercase font-bold text-slate-500">Institution</span>
                          <span className="truncate max-w-[70%] text-slate-300">
                            {course.university || course.educator_university || user?.university || 'Institution not specified'}
                          </span>
                        </div>
                      </div>

                      {/* Metrics: Modules, Topics, Enrolled Students */}
                      <div className="grid grid-cols-3 gap-2 text-center">
                        <div className="p-2 rounded-xl bg-[#0b0f19] border border-[#1a2335]">
                          <div className="text-sm font-black text-white">
                            {course.modules_count ?? 0}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-400">Modules</div>
                        </div>
                        <div className="p-2 rounded-xl bg-[#0b0f19] border border-[#1a2335]">
                          <div className="text-sm font-black text-white">
                            {course.topics_count ?? 0}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-400">Topics</div>
                        </div>
                        <div className="p-2 rounded-xl bg-[#0b0f19] border border-[#1a2335]">
                          <div className="text-sm font-black text-cyan-300">
                            {course.enrolled_count ?? 0}
                          </div>
                          <div className="text-[10px] font-semibold text-slate-400">Students</div>
                        </div>
                      </div>

                      {/* Created & Updated Dates */}
                      <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Created {formatDateShort(course.created_at)}
                        </span>
                        {course.updated_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Updated {formatDateShort(course.updated_at)}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Educator Action Buttons */}
                    <div className="pt-4 border-t border-[#1e2638] space-y-2">
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          onClick={() => {
                            setActiveTab('learn');
                            onSelectCourse(course.id, { workspaceTab: 'learn' });
                          }}
                          className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>View Course</span>
                        </button>

                        <button
                          onClick={() => {
                            setActiveTab('curriculum');
                            onSelectCourse(course.id, { workspaceTab: 'curriculum' });
                          }}
                          className="py-2 px-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-bold transition flex items-center justify-center gap-1.5"
                        >
                          <Layers className="h-3.5 w-3.5" />
                          <span>Curriculum</span>
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => openEditCourseModal(course)}
                          className="flex-1 py-1.5 px-2.5 rounded-xl bg-[#0b0f19] hover:bg-slate-800 text-slate-300 border border-[#1e2638] text-[11px] font-bold transition flex items-center justify-center gap-1"
                        >
                          <Edit3 className="h-3 w-3 text-indigo-400" />
                          <span>Edit Info</span>
                        </button>

                        <button
                          onClick={() => handleTogglePublish(course)}
                          className={`flex-1 py-1.5 px-2.5 rounded-xl border text-[11px] font-bold transition flex items-center justify-center gap-1 ${
                            isPublished
                              ? 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                          }`}
                        >
                          {isPublished ? 'Unpublish' : 'Publish'}
                        </button>

                        <button
                          onClick={() => {
                            setDeleteMode('delete');
                            setCourseToDelete(course);
                          }}
                          className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition"
                          title="Delete Course Permanently"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* ====================================================================
          SECTION 2: MY ENROLLED COURSES (Students & Educators)
         ==================================================================== */}
      <section className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#1e2638] pb-4">
          <div>
            <div className="flex items-center gap-2.5">
              <h2 className="text-xl font-black text-white">My Enrolled Courses</h2>
              <span className="text-xs font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                {enrolledList.length}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Courses in which you are actively enrolled as a learner.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchMyEnrolledCourses}
              className="p-2 rounded-xl bg-[#121826] hover:bg-slate-800 text-slate-400 hover:text-white border border-[#1e2638] transition"
              title="Refresh Enrolled Courses"
            >
              <RefreshCw className={`h-4 w-4 ${enrolledLoading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onOpenExploreCatalog}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-md shadow-indigo-600/20"
            >
              <Compass className="h-3.5 w-3.5" />
              <span>Find New Courses</span>
            </button>
          </div>
        </div>

        {enrolledLoading ? (
          <div className="py-14 rounded-3xl bg-[#121826]/60 border border-[#1e2638] flex flex-col items-center justify-center gap-3 text-slate-400">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
            <p className="text-xs font-semibold">Loading your enrolled courses...</p>
          </div>
        ) : enrolledError ? (
          <div className="p-8 rounded-3xl bg-[#121826] border border-rose-500/30 text-center space-y-3">
            <AlertCircle className="h-8 w-8 text-rose-400 mx-auto" />
            <p className="text-sm font-bold text-white">Could not load My Enrolled Courses</p>
            <p className="text-xs text-rose-300">{enrolledError}</p>
            <button
              onClick={fetchMyEnrolledCourses}
              className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
            >
              Retry
            </button>
          </div>
        ) : enrolledList.length === 0 ? (
          <div className="p-12 rounded-3xl bg-[#121826]/80 border border-[#1e2638] text-center space-y-4">
            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 flex items-center justify-center mx-auto">
              <BookOpen className="h-7 w-7" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                You haven&apos;t enrolled in any courses yet.
              </h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Explore published courses from educators across branches and enroll to start watching lectures and tracking your progress.
              </p>
            </div>
            <button
              onClick={onOpenExploreCatalog}
              className="px-6 py-3 rounded-2xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-black uppercase tracking-wider shadow-lg shadow-indigo-600/25 transition inline-flex items-center gap-2 cursor-pointer"
            >
              <Compass className="h-4 w-4" />
              <span>Find New Courses</span>
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {enrolledList.map((course) => {
              const diffLabel = formatDifficulty(course.difficulty);
              const diffClass = getDifficultyBadgeClass(course.difficulty);
              const progress = Math.min(
                100,
                Math.max(0, Math.round(Number(course.completion_percentage || 0)))
              );
              const hasRatings = Number(course.total_ratings || 0) > 0;
              const branchLabel =
                course.target_branch || course.category || 'Computer Science & Engineering (CSE)';

              return (
                <div
                  key={course.id}
                  className="rounded-3xl bg-[#121826] border border-[#1e2638] hover:border-indigo-500/50 p-6 flex flex-col justify-between shadow-xl transition space-y-5"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30 truncate max-w-[65%]">
                        {course.code} • {branchLabel}
                      </span>

                      <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${diffClass}`}>
                        {diffLabel}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-base font-extrabold text-white line-clamp-1">
                        {course.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {course.description}
                      </p>
                    </div>

                    {/* Educator & University */}
                    <div className="p-3 rounded-2xl bg-[#0b0f19] border border-[#1a2335] space-y-1.5">
                      <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-purple-400 shrink-0" />
                        <span className="text-xs font-bold text-slate-200 truncate">
                          {course.educator_name || 'Course Instructor'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px] text-slate-400">
                        <Building2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                        <span className="truncate">
                          {course.university ||
                            course.educator_university ||
                            'University / Institution not specified'}
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-bold">
                        <span className="text-slate-400">Completion Progress</span>
                        <span className="text-emerald-400">{progress}%</span>
                      </div>
                      <div className="w-full h-2 rounded-full bg-[#0b0f19] overflow-hidden border border-[#1e2638]">
                        <div
                          className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400 transition-all duration-300"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>

                    {/* Counts & Rating */}
                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1">
                      <span>
                        {course.modules_count ?? 0} Modules • {course.topics_count ?? 0} Topics
                      </span>
                      <button
                        type="button"
                        onClick={() => onOpenRateModal && onOpenRateModal(course)}
                        className="flex items-center gap-1 text-amber-300 font-bold hover:underline"
                      >
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span>
                          {hasRatings
                            ? `${Number(course.average_rating).toFixed(1)} (${course.total_ratings})`
                            : 'Rate'}
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Card Footer */}
                  <div className="pt-4 border-t border-[#1e2638] flex items-center justify-between gap-2">
                    <button
                      onClick={() => {
                        setActiveTab('learn');
                        onSelectCourse(course.id, { workspaceTab: 'learn' });
                      }}
                      className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white text-xs font-bold transition flex items-center justify-center gap-2 shadow-lg shadow-indigo-600/20"
                    >
                      <Play className="h-3.5 w-3.5 fill-current" />
                      <span>{progress > 0 ? 'Continue Learning' : 'Start Course'}</span>
                    </button>

                    <button
                      onClick={() => {
                        setDeleteMode('unenroll');
                        setCourseToDelete(course);
                      }}
                      className="p-2.5 rounded-xl bg-[#0b0f19] hover:bg-rose-500/15 text-slate-400 hover:text-rose-400 border border-[#1e2638] transition"
                      title="Unenroll from Course"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Edit Course Metadata Modal from Dashboard */}
      {editingCourse && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-3xl bg-[#121826] border border-indigo-500/40 p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#1e2638] pb-3">
              <h3 className="text-base font-black text-white">Edit Course Information</h3>
              <button
                onClick={() => setEditingCourse(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCourseMetadata} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Course Title *
                </label>
                <input
                  type="text"
                  required
                  value={editCourseForm.title}
                  onChange={(e) =>
                    setEditCourseForm((p) => ({ ...p, title: e.target.value }))
                  }
                  className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2 text-xs text-white"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Target Student Branch *
                  </label>
                  <select
                    value={editCourseForm.target_branch}
                    onChange={(e) =>
                      setEditCourseForm((p) => ({ ...p, target_branch: e.target.value }))
                    }
                    className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {TARGET_BRANCHES.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Difficulty *
                  </label>
                  <select
                    value={editCourseForm.difficulty}
                    onChange={(e) =>
                      setEditCourseForm((p) => ({ ...p, difficulty: e.target.value }))
                    }
                    className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3 py-2 text-xs text-white"
                  >
                    {DIFFICULTY_LEVELS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Course Description *
                </label>
                <textarea
                  rows={3}
                  required
                  value={editCourseForm.description}
                  onChange={(e) =>
                    setEditCourseForm((p) => ({ ...p, description: e.target.value }))
                  }
                  className="w-full bg-[#0b0f19] border border-[#1e2638] rounded-xl px-3.5 py-2 text-xs text-white resize-none"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingCourse(null)}
                  className="px-4 py-2 rounded-xl bg-slate-800 text-slate-300 text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingCourseMeta}
                  className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                >
                  {savingCourseMeta ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Unenroll Confirmation Modal */}
      <CourseDeleteModal
        isOpen={Boolean(courseToDelete)}
        course={courseToDelete}
        isCreator={deleteMode === 'delete'}
        isEducator={isEducatorRole}
        loading={deletingCourse}
        onClose={() => setCourseToDelete(null)}
        onConfirm={handleConfirmDeleteOrUnenroll}
      />
    </div>
  );
}
