import React, { useState, useEffect, useRef, Suspense, lazy } from 'react';
import Navbar, { SUPPORTED_LANGUAGES } from './components/Navbar';
import Sidebar from './components/Sidebar';

const Login = lazy(() => import('./pages/Login'));
const DashboardHome = lazy(() => import('./pages/DashboardHome'));
const CoursePlayer = lazy(() => import('./pages/CoursePlayer'));
const StudentPortal = lazy(() => import('./pages/StudentPortal'));
const SpacedQuizView = lazy(() => import('./pages/SpacedQuizView'));
const EducatorDashboard = lazy(() => import('./pages/EducatorDashboard'));
const LearningPods = lazy(() => import('./pages/LearningPods'));
const CommunityFeed = lazy(() => import('./pages/CommunityFeed'));
const LearningRoadmapView = lazy(() => import('./pages/LearningRoadmapView'));
const ExamStudio = lazy(() => import('./pages/ExamStudio'));
const AssignmentView = lazy(() => import('./pages/AssignmentView'));
const LiveKshetraStudio = lazy(() => import('./pages/LiveKshetraStudio'));
const LandingPage = lazy(() => import('./pages/LandingPage'));
import CreateCourseModal from './components/CreateCourseModal';
import AcademicProfileModal from './components/AcademicProfileModal';
import CourseCatalogModal from './components/CourseCatalogModal';
import CourseRatingModal from './components/CourseRatingModal';
import ErrorBoundary from './components/ErrorBoundary';
import { coursesAPI, authAPI, normalizeCourseId } from './services/api';
import { Globe, X, Check } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [ratingModalCourse, setRatingModalCourse] = useState(null);
  const [courses, setCourses] = useState([]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const enrolledCoursesRef = useRef(enrolledCourses);
  const pendingUnenrollsRef = useRef(new Set());
  useEffect(() => {
    enrolledCoursesRef.current = enrolledCourses;
  }, [enrolledCourses]);
  const [myCreatedCourses, setMyCreatedCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [courseWorkspaceTab, setCourseWorkspaceTab] = useState('learn');
  const [coursePreviewOnly, setCoursePreviewOnly] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [targetLang, setTargetLang] = useState('en');
  const [isInitializing, setIsInitializing] = useState(true);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showCreateCourseModal, setShowCreateCourseModal] = useState(false);
  const [isLoginView, setIsLoginView] = useState(() => {
    return window.location.hash === '#login' || window.location.pathname === '/login';
  });
  const [loginRole, setLoginRole] = useState('STUDENT');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const fetchMyCreatedCourses = async (currentUser = user) => {
    if (!currentUser || (currentUser.role !== 'EDUCATOR' && currentUser.role !== 'ADMIN')) {
      setMyCreatedCourses([]);
      return [];
    }
    try {
      const created = await coursesAPI.getMyCourses();
      const valid = Array.isArray(created)
        ? created.filter((c) => Number(c.educator_id) === Number(currentUser.id))
        : [];
      setMyCreatedCourses(valid);
      return valid;
    } catch (err) {
      console.warn('coursesAPI.getMyCourses notice:', err);
      return [];
    }
  };

  const refreshAllCourses = async (currentUser = user) => {
    try {
      const freshList = await coursesAPI.list();
      if (Array.isArray(freshList)) {
        setCourses(freshList);
      }
    } catch (err) {
      console.warn('coursesAPI.list notice:', err);
    }

    if (currentUser) {
      await Promise.all([
        fetchEnrolledCourses(currentUser),
        fetchMyCreatedCourses(currentUser)
      ]);
    }
  };

  const handleCourseCreated = async (newCourse, options = {}) => {
    setShowCreateCourseModal(false);
    await refreshAllCourses(user);
    if (newCourse?.id) {
      setSelectedCourseId(newCourse.id);
      setCoursePreviewOnly(false);
      setCourseWorkspaceTab(options.openCurriculumStudio !== false ? 'curriculum' : 'learn');
      setActiveTab('courses');
    } else {
      setActiveTab('courses');
    }
  };

  useEffect(() => {
    const handleHashChange = () => {
      if (user) {
        setIsLoginView(false);
        if (window.location.hash === '#login' || window.location.pathname === '/login') {
          try {
            window.history.replaceState(null, '', '/');
          } catch (e) {}
        }
      } else {
        if (window.location.hash === '#login' || window.location.pathname === '/login') {
          setIsLoginView(true);
        } else {
          setIsLoginView(false);
        }
      }

      if (
        window.location.hash === '#kshetra' ||
        window.location.search.includes('room=') ||
        window.location.hash.includes('join=')
      ) {
        setActiveTab('kshetra');
      }
    };
    handleHashChange();
    window.addEventListener('popstate', handleHashChange);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handleHashChange);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [user]);

  const fetchEnrolledCourses = async (currentUser) => {
    if (!currentUser) {
      setEnrolledCourses([]);
      enrolledCoursesRef.current = [];
      return [];
    }

    try {
      const data = await coursesAPI.getEnrolled();
      if (Array.isArray(data)) {
        // Exclude any courses that currently have an in-flight unenrollment request
        const filtered = data.filter((c) => !pendingUnenrollsRef.current.has(Number(c.id)));
        setEnrolledCourses(filtered);
        enrolledCoursesRef.current = filtered;
        if (currentUser) {
          try {
            localStorage.setItem(
              `cognipath_enrolled_${currentUser.id || currentUser.email}`,
              JSON.stringify(filtered)
            );
          } catch (storageErr) {
            console.warn('[COGNIPATH] Failed to update localStorage cache:', storageErr);
          }
        }
        return filtered;
      }
    } catch (err) {
      console.warn('API getEnrolled failed:', err);
      return null;
    }

    setEnrolledCourses([]);
    enrolledCoursesRef.current = [];
    return [];
  };

  const handleEnrollCourse = async (courseId) => {
    const numId = normalizeCourseId(courseId);
    if (numId === null) {
      throw new Error('A valid positive integer courseId is required to enroll.');
    }
    await coursesAPI.enroll(numId);
    const fresh = await fetchEnrolledCourses(user);
    setSelectedCourseId(numId);
    setCoursePreviewOnly(false);
    setCourseWorkspaceTab('learn');
    return fresh;
  };

  const handleUnenrollCourse = async (courseId) => {
    const numId = normalizeCourseId(courseId);
    if (numId === null) {
      throw new Error('A valid positive integer courseId is required to unenroll.');
    }
    if (pendingUnenrollsRef.current.has(numId)) {
      console.warn(`[COGNIPATH] Unenroll request for course ${numId} already in flight. Ignoring duplicate.`);
      throw new Error(`Unenrollment request for course ${numId} is already in progress.`);
    }
    pendingUnenrollsRef.current.add(numId);
    try {
      await coursesAPI.unenroll(numId);

      // Synchronously update the ref immediately so subsequent reads see the removal
      enrolledCoursesRef.current = (Array.isArray(enrolledCoursesRef.current) ? enrolledCoursesRef.current : []).filter(
        (c) => Number(c.id) !== Number(numId)
      );

      // Functional state updater guarantees React applies this removal on top of the latest state
      setEnrolledCourses((prev) =>
        (Array.isArray(prev) ? prev : []).filter((c) => Number(c.id) !== Number(numId))
      );

      // Separately update localStorage cache outside state updater; storage failure does not undo server unenrollment
      if (user) {
        try {
          localStorage.setItem(
            `cognipath_enrolled_${user.id || user.email}`,
            JSON.stringify(enrolledCoursesRef.current)
          );
        } catch (storageErr) {
          console.warn('[COGNIPATH] Failed to update localStorage cache after unenrollment:', storageErr);
        }
      }

      if (Number(selectedCourseId) === Number(numId)) {
        setSelectedCourseId(null);
      }

      // Existing server remains authoritative for enrollment data
      try {
        const fresh = await fetchEnrolledCourses(user);
        return Array.isArray(fresh) ? fresh : enrolledCoursesRef.current;
      } catch (refreshErr) {
        console.warn('[COGNIPATH] Background refresh of enrolled courses failed after unenrollment:', refreshErr);
        return enrolledCoursesRef.current;
      }
    } finally {
      pendingUnenrollsRef.current.delete(numId);
    }
  };

  const handleDeleteCoursePermanently = async (courseId) => {
    const numId = normalizeCourseId(courseId);
    if (numId === null) {
      throw new Error('A valid positive integer courseId is required to delete a course.');
    }
    await coursesAPI.deleteCourse(numId);
    setCourses((prev) => (Array.isArray(prev) ? prev : []).filter((c) => Number(c.id) !== Number(numId)));
    setMyCreatedCourses((prev) => (Array.isArray(prev) ? prev : []).filter((c) => Number(c.id) !== Number(numId)));
    setEnrolledCourses((prev) => (Array.isArray(prev) ? prev : []).filter((c) => Number(c.id) !== Number(numId)));
    enrolledCoursesRef.current = (Array.isArray(enrolledCoursesRef.current) ? enrolledCoursesRef.current : []).filter(
      (c) => Number(c.id) !== Number(numId)
    );
    if (Number(selectedCourseId) === Number(numId)) {
      setSelectedCourseId(null);
    }
    await refreshAllCourses(user);
  };

  useEffect(() => {
    const init = async () => {
      let activeUser = null;
      const storedUser = localStorage.getItem('cognipath_user');
      if (storedUser) {
        try {
          activeUser = JSON.parse(storedUser);
          if (activeUser && (activeUser.email || activeUser.id)) {
            setUser(activeUser);
            setIsLoginView(false);
            if (activeUser.role === 'EDUCATOR') {
              setActiveTab('analytics');
            } else {
              setActiveTab('dashboard');
            }
          }
        } catch (e) {
          console.error(e);
        }
      }
      try {
        const data = await coursesAPI.list();
        if (data && Array.isArray(data)) {
          setCourses(data);
        }
      } catch (err) {
        console.warn('Initial coursesAPI.list notice:', err);
      }
      if (activeUser) {
        await Promise.all([
          fetchEnrolledCourses(activeUser),
          fetchMyCreatedCourses(activeUser)
        ]);
      }
      setIsInitializing(false);
    };
    init();
  }, []);

  const handleLoginSuccess = async (userData) => {
    const validUser = (userData && typeof userData === 'object') ? (userData.user || userData) : null;
    if (!validUser || (!validUser.email && !validUser.id)) {
      console.error('Invalid user data received in handleLoginSuccess:', userData);
      return;
    }

    try {
      localStorage.setItem('cognipath_user', JSON.stringify(validUser));
      const currToken = localStorage.getItem('cognipath_token');
      if (currToken && (currToken.startsWith('local_') || currToken.startsWith('mock_'))) {
        localStorage.removeItem('cognipath_token');
      }
    } catch (e) {}

    setUser(validUser);
    setIsLoginView(false);
    setSelectedCourseId(null);
    setShowProfileModal(false);

    try {
      if (window.location.hash === '#login' || window.location.hash.includes('login') || window.location.pathname === '/login') {
        window.history.replaceState(null, '', '/');
      }
    } catch (e) {}

    const targetTab = validUser.role === 'EDUCATOR' ? 'courses' : 'dashboard';
    setActiveTab(targetTab);

    try {
      await refreshAllCourses(validUser);
    } catch (err) {
      console.warn('Courses background refresh notice:', err);
    }
  };

  const handleProfileUpdated = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('cognipath_user', JSON.stringify(updatedUser));
    refreshAllCourses(updatedUser);
  };

  const handleLogout = () => {
    authAPI.logout();
    setUser(null);
    setEnrolledCourses([]);
    setMyCreatedCourses([]);
    setSelectedCourseId(null);
    setIsLoginView(false);
    setActiveTab('dashboard');
  };

  const handleOpenLogin = (role = 'STUDENT') => {
    setLoginRole(role);
    setIsLoginView(true);
    window.location.hash = 'login';
  };

  const handleBackToHome = () => {
    setIsLoginView(false);
    if (window.location.hash === '#login') {
      window.history.pushState(null, '', window.location.pathname);
    }
  };

  const handleQuickLogin = async (demoEmail, demoRole) => {
    const defaultUser = {
      id: demoRole === 'EDUCATOR' ? 1 : 2,
      email: demoEmail,
      full_name: demoRole === 'EDUCATOR' ? 'Prof. Rajesh Ramanujan' : 'Alex Kumar',
      role: demoRole,
      university:
        demoRole === 'EDUCATOR'
          ? 'Indian Institute of Technology Bombay (IIT Bombay)'
          : 'Birla Institute of Technology & Science (BITS Pilani)',
      department: 'Computer Science & Engineering (CSE)',
      profile_completed: true
    };

    try {
      const data = await authAPI.login(demoEmail, 'password123');
      const candidate = (data && typeof data === 'object') ? (data.user || data) : null;
      if (candidate && (candidate.email || candidate.id)) {
        if (data.access_token) {
          localStorage.setItem('cognipath_token', data.access_token);
        }
        handleLoginSuccess({ ...candidate, profile_completed: true });
        return;
      }
    } catch (err) {
      console.warn('Backend quick login notice, using demo profile:', err?.message);
    }

    localStorage.setItem('cognipath_user', JSON.stringify(defaultUser));
    handleLoginSuccess(defaultUser);
  };

  const handleNavigate = (tab, courseId, options = {}) => {
    setActiveTab(tab);
    if (courseId !== undefined) {
      setSelectedCourseId(courseId);
      setCoursePreviewOnly(Boolean(options.previewOnly));
      setCourseWorkspaceTab(options.workspaceTab || 'learn');
    } else if (tab === 'courses') {
      setSelectedCourseId(null);
      setCoursePreviewOnly(false);
    }
  };

  const handleSelectSidebarTab = (tab) => {
    if (tab === 'courses') {
      setSelectedCourseId(null);
      setCoursePreviewOnly(false);
    }
    setActiveTab(tab);
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-[#0b0f19] flex items-center justify-center text-indigo-400">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-500" />
      </div>
    );
  }

  if (!user) {
    if (isLoginView) {
      return (
        <Suspense fallback={<div className="min-h-screen bg-[#0b0f19] flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-500" /></div>}>
          <Login
            onLoginSuccess={handleLoginSuccess}
            onBackToHome={handleBackToHome}
            initialRole={loginRole}
          />
        </Suspense>
      );
    }
    return (
      <Suspense fallback={<div className="min-h-screen bg-[#0b0f19] flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-indigo-500" /></div>}>
        <LandingPage
          onOpenLogin={handleOpenLogin}
          onQuickLogin={handleQuickLogin}
        />
      </Suspense>
    );
  }

  return (
    <ErrorBoundary onReset={() => {
      localStorage.removeItem('cognipath_user');
      window.location.reload();
    }}>
      <div className="h-screen max-h-screen overflow-hidden bg-[#0A0D1C] flex flex-col text-[#ECEDF7] antialiased selection:bg-[#8B7CFF] selection:text-white">
      {/* Top Navbar */}
      <Navbar
        user={user}
        targetLang={targetLang}
        onChangeLang={setTargetLang}
        onLogout={handleLogout}
        onSelectTab={handleSelectSidebarTab}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onOpenProfile={() => setShowProfileModal(true)}
      />

      {/* Main App Layout */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Closable Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={handleSelectSidebarTab}
          userRole={user.role}
          onOpenLangModal={() => setShowLangModal(true)}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Dynamic Main Workspace Tab */}
        <main className={`flex-1 min-h-0 bg-[#0A0D1C] ambient-canvas ${
          activeTab === 'tutor'
            ? 'overflow-hidden flex flex-col'
            : 'overflow-y-auto'
        }`}>
          <ErrorBoundary onReset={() => setActiveTab(user?.role === 'EDUCATOR' ? 'courses' : 'dashboard')}>
            <Suspense fallback={
              <div className="min-h-[400px] w-full flex items-center justify-center p-12 text-slate-400">
                <div className="flex flex-col items-center gap-3">
                  <div className="w-8 h-8 border-3 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                  <span className="text-xs font-semibold tracking-wide uppercase">Loading Page Component...</span>
                </div>
              </div>
            }>
            {/* Dashboard Home View */}
            {activeTab === 'dashboard' && (
              <DashboardHome
                user={user}
                onNavigateTab={handleNavigate}
                targetLang={targetLang}
                enrolledCourses={enrolledCourses}
                allCourses={courses}
                onEnrollCourse={handleEnrollCourse}
                onUnenrollCourse={handleUnenrollCourse}
                onDeleteCoursePermanently={handleDeleteCoursePermanently}
                onRefreshCourses={() => refreshAllCourses(user)}
                onOpenExploreCatalog={() => setShowCatalogModal(true)}
              />
            )}

            {/* Course Player Dashboard, Preview, Curriculum Studio & Learning View */}
            {(activeTab === 'courses' || activeTab === 'course-player') && (
              <div className="p-5 sm:p-7 max-w-[1600px] mx-auto">
                <CoursePlayer
                  user={user}
                  selectedCourseId={selectedCourseId}
                  onSelectCourse={(cId, opts = {}) => {
                    setSelectedCourseId(cId);
                    setCoursePreviewOnly(Boolean(opts.previewOnly));
                    setCourseWorkspaceTab(opts.workspaceTab || 'learn');
                  }}
                  onBackToDashboard={() => {
                    setSelectedCourseId(null);
                    setCoursePreviewOnly(false);
                  }}
                  enrolledCourses={enrolledCourses}
                  myCreatedCourses={myCreatedCourses}
                  onRefreshCourses={() => refreshAllCourses(user)}
                  onOpenExploreCatalog={() => setShowCatalogModal(true)}
                  onOpenCreateCourse={() => setShowCreateCourseModal(true)}
                  onOpenRateModal={(courseObj) => setRatingModalCourse(courseObj)}
                  onDeleteCoursePermanently={handleDeleteCoursePermanently}
                  onUnenrollCourse={handleUnenrollCourse}
                  initialWorkspaceTab={courseWorkspaceTab}
                  previewOnly={coursePreviewOnly}
                />
              </div>
            )}

            {/* Dual-Engine Assessment System (Exams, Quizzes & AI Suggestion Studio) */}
            {activeTab === 'exam-studio' && (
              <ExamStudio
                courseId={selectedCourseId}
                user={user}
                onNavigateTab={handleNavigate}
                onOpenCreateCourse={() => setShowCreateCourseModal(true)}
              />
            )}

            {/* Assignment Engine & AI Auto-Evaluation with Criteria Rubrics */}
            {activeTab === 'assignments' && (
              <AssignmentView
                courseId={selectedCourseId}
                user={user}
              />
            )}

            {/* AI Tutor View with Socratic Mode & Concept Mindmaps */}
            {activeTab === 'tutor' && (
              <StudentPortal
                courseId={selectedCourseId}
                targetLang={targetLang}
                courses={courses}
                enrolledCourses={enrolledCourses}
                onSelectCourse={setSelectedCourseId}
                user={user}
              />
            )}

            {/* Adaptive Learning Roadmap & Knowledge Gap Radar */}
            {activeTab === 'roadmap' && (
              <LearningRoadmapView
                courseId={selectedCourseId}
                onNavigateTab={setActiveTab}
              />
            )}

            {/* Spaced Repetition SM-2 Quiz View & Flashcards */}
            {(activeTab === 'quizzes' || activeTab === 'flashcards') && (
              <SpacedQuizView
                courseId={selectedCourseId}
                courses={courses}
                enrolledCourses={enrolledCourses}
                onSelectCourse={setSelectedCourseId}
                defaultMode={activeTab === 'flashcards' ? 'flashcards' : 'quiz'}
              />
            )}

            {/* Educator Analytics & Curriculum Health Diagnostic Studio */}
            {activeTab === 'analytics' && (
              <EducatorDashboard
                courseId={selectedCourseId}
                courses={courses}
                onSelectCourse={(cId) => {
                  setSelectedCourseId(cId);
                  setCoursePreviewOnly(false);
                }}
                onNavigateTab={handleNavigate}
                onOpenCreateCourse={() => setShowCreateCourseModal(true)}
                onDeleteCoursePermanently={handleDeleteCoursePermanently}
                onRefreshCourses={() => refreshAllCourses(user)}
                user={user}
              />
            )}

            {/* Native Learning Pods */}
            {activeTab === 'kshetra' && (
              <LiveKshetraStudio
                courseId={selectedCourseId}
                user={user}
                onNavigateTab={handleNavigate}
              />
            )}

            {/* Ongoing Pods Collaborative Rooms */}
            {activeTab === 'pods' && (
              <LearningPods
                courseId={selectedCourseId}
                user={user}
              />
            )}

            {/* Course Community Channels */}
            {activeTab === 'community' && (
              <CommunityFeed
                courseId={selectedCourseId}
                user={user}
                courses={courses}
                enrolledCourses={enrolledCourses}
                onSelectCourse={setSelectedCourseId}
                onEnrollCourse={handleEnrollCourse}
                onUnenrollCourse={handleUnenrollCourse}
              />
            )}

            {/* Platform Overview & SIH Landing View */}
            {activeTab === 'landing' && (
              <LandingPage
                onOpenLogin={() => {}}
                onQuickLogin={handleQuickLogin}
              />
            )}

            {/* Robust Fallback in case activeTab is unhandled */}
            {![
              'dashboard', 'courses', 'course-player', 'exam-studio',
              'assignments', 'tutor', 'roadmap', 'quizzes', 'flashcards',
              'analytics', 'kshetra', 'pods', 'community', 'landing'
            ].includes(activeTab) && (
              <div className="p-5 sm:p-7 max-w-[1600px] mx-auto">
                <CoursePlayer
                  user={user}
                  selectedCourseId={selectedCourseId}
                  onSelectCourse={(cId, opts = {}) => {
                    setSelectedCourseId(cId);
                    setCoursePreviewOnly(Boolean(opts.previewOnly));
                    setCourseWorkspaceTab(opts.workspaceTab || 'learn');
                  }}
                  onBackToDashboard={() => {
                    setSelectedCourseId(null);
                    setCoursePreviewOnly(false);
                  }}
                  enrolledCourses={enrolledCourses}
                  myCreatedCourses={myCreatedCourses}
                  onRefreshCourses={() => refreshAllCourses(user)}
                  onOpenExploreCatalog={() => setShowCatalogModal(true)}
                  onOpenCreateCourse={() => setShowCreateCourseModal(true)}
                  onOpenRateModal={(courseObj) => setRatingModalCourse(courseObj)}
                  onDeleteCoursePermanently={handleDeleteCoursePermanently}
                  onUnenrollCourse={handleUnenrollCourse}
                  initialWorkspaceTab={courseWorkspaceTab}
                  previewOnly={coursePreviewOnly}
                />
              </div>
            )}
          </Suspense>
          </ErrorBoundary>
        </main>
      </div>

      {/* Bhashini Language Switcher Modal */}
      {showLangModal && (
        <div className="fixed inset-0 z-50 bg-[#0A0D1C]/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div
            style={{ boxShadow: '0 18px 34px -18px rgba(0,0,0,0.55)' }}
            className="w-full max-w-md rounded-2xl bg-[#12162B] border border-[#262C4C] p-6 space-y-4"
          >
            <div className="flex items-center justify-between pb-3 border-b border-[#262C4C]">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 flex items-center justify-center text-[#8B7CFF]">
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-heading font-bold text-sm text-[#ECEDF7]">Select Regional Language</h3>
                  <p className="text-[11px] text-[#8A90B4]">Powered by India Bhashini ULCA Engine</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLangModal(false)}
                className="p-1.5 rounded-full text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#171C36] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-72 overflow-y-auto">
              {SUPPORTED_LANGUAGES.map((lang) => {
                const isSelected = targetLang === lang.code;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => {
                      setTargetLang(lang.code);
                      setShowLangModal(false);
                    }}
                    className={`p-3 rounded-full text-left text-xs font-semibold flex items-center justify-between transition ${
                      isSelected
                        ? 'bg-[#8B7CFF] text-[#0A0D1C] font-bold shadow-[0_4px_12px_rgba(139,124,255,0.3)]'
                        : 'bg-[#171C36] text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#262C4C] border border-[#262C4C]'
                    }`}
                  >
                    <span>{lang.name}</span>
                    {isSelected && <Check className="h-4 w-4 text-[#0A0D1C] stroke-[3]" />}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Global Course Catalog Explorer Modal */}
      <CourseCatalogModal
        isOpen={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        onPreviewCourse={(cId) => {
          setSelectedCourseId(cId);
          setCoursePreviewOnly(true);
          setCourseWorkspaceTab('learn');
          setActiveTab('courses');
        }}
        onEnrollSuccess={async (cId) => {
          await fetchEnrolledCourses(user);
          setSelectedCourseId(cId);
          setCoursePreviewOnly(false);
          setCourseWorkspaceTab('learn');
          setActiveTab('courses');
        }}
        onSelectCourse={(cId, opts = {}) => {
          setSelectedCourseId(cId);
          setCoursePreviewOnly(Boolean(opts.previewOnly));
          setCourseWorkspaceTab('learn');
          setActiveTab('courses');
        }}
        onOpenRateModal={(courseObj) => setRatingModalCourse(courseObj)}
        user={user}
        enrolledCourses={enrolledCourses}
      />

      {/* Global Course Rating & Reviews Modal */}
      {ratingModalCourse && (
        <CourseRatingModal
          isOpen={Boolean(ratingModalCourse)}
          course={ratingModalCourse}
          user={user}
          onClose={() => setRatingModalCourse(null)}
          onRatingSubmitted={() => refreshAllCourses(user)}
        />
      )}

      {/* Global Create & Post Course Modal */}
      <CreateCourseModal
        isOpen={showCreateCourseModal}
        onClose={() => setShowCreateCourseModal(false)}
        onCourseCreated={handleCourseCreated}
      />

      {/* Smart Multi-Role Academic Onboarding & Profile-Completion Modal */}
      <AcademicProfileModal
        isOpen={showProfileModal}
        onClose={() => setShowProfileModal(false)}
        user={user}
        onProfileUpdated={handleProfileUpdated}
        isOnboarding={false}
      />
    </div>
  </ErrorBoundary>
  );
}
