import React, { useState, useEffect } from 'react';
import Navbar, { SUPPORTED_LANGUAGES } from './components/Navbar';
import Sidebar from './components/Sidebar';
import { Suspense, lazy } from 'react';

const Login = lazy(() => import('./pages/Login'));
const DashboardHome = lazy(() => import('./pages/DashboardHome'));
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
import ErrorBoundary from './components/ErrorBoundary';
import { coursesAPI, authAPI } from './services/api';
import { Globe, X, Check } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [courses, setCourses] = useState([
    { id: 1, code: 'CS101', title: 'Data Structures & Algorithms', category: 'Computer Science', description: 'Comprehensive study of linear and hierarchical data structures.' },
    { id: 2, code: 'DBMS', title: 'Database Management Systems', category: 'Database Systems', description: 'Relational database architecture, relational algebra, and SQL optimization.' }
  ]);
  const [enrolledCourses, setEnrolledCourses] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
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

  const refreshAllCourses = async (currentUser = user) => {
    let freshList = null;
    try {
      freshList = await coursesAPI.list();
      if (freshList && freshList.length > 0) {
        setCourses(freshList);
      }
    } catch (err) {
      console.warn('coursesAPI.list notice:', err);
    }

    if (currentUser) {
      await fetchEnrolledCourses(currentUser, freshList || courses);
    }
  };

  const handleCourseCreated = async (newCourse) => {
    setShowCreateCourseModal(false);
    if (newCourse?.id) {
      try {
        const key = `cognipath_created_courses_${user?.id || user?.email || 'educator'}`;
        const existing = JSON.parse(localStorage.getItem(key) || '[]');
        if (!existing.includes(newCourse.id)) {
          existing.push(newCourse.id);
          localStorage.setItem(key, JSON.stringify(existing));
        }
      } catch (e) {}
    }
    await refreshAllCourses(user);
    if (newCourse?.id) {
      setSelectedCourseId(newCourse.id);
    }
    setActiveTab(user?.role === 'EDUCATOR' ? 'analytics' : 'dashboard');
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

  const fetchCourses = async () => {
    try {
      const data = await coursesAPI.list();
      if (data && data.length > 0) {
        setCourses(data);
      }
    } catch (err) {
      console.log('Using default course syllabus data.');
    }
  };

  const fetchEnrolledCourses = async (currentUser, allAvailableCourses = null) => {
    if (!currentUser) {
      setEnrolledCourses([]);
      setSelectedCourseId(null);
      return;
    }

    const available = allAvailableCourses || courses;

    try {
      const data = await coursesAPI.getEnrolled();
      if (data && Array.isArray(data)) {
        setEnrolledCourses(data);
        localStorage.setItem(`cognipath_enrolled_${currentUser.id || currentUser.email}`, JSON.stringify(data));
        if (data.length > 0) {
          setSelectedCourseId(data[0].id);
        } else {
          setSelectedCourseId(null);
        }
        return;
      }
    } catch (err) {
      console.warn('API getEnrolled failed, checking local storage:', err);
    }

    // Local cached fallback per user
    try {
      const cached = localStorage.getItem(`cognipath_enrolled_${currentUser.id || currentUser.email}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setEnrolledCourses(parsed);
        if (parsed.length > 0) {
          setSelectedCourseId(parsed[0].id);
        } else {
          setSelectedCourseId(null);
        }
        return;
      }
    } catch (e) {}

    // No auto-enrollments: users start with 0 enrolled courses unless they enroll themselves
    setEnrolledCourses([]);
    setSelectedCourseId(null);
    try {
      localStorage.setItem(`cognipath_enrolled_${currentUser.id || currentUser.email}`, JSON.stringify([]));
    } catch (e) {}
  };

  const handleEnrollCourse = async (courseId) => {
    try {
      await coursesAPI.enroll(courseId);
    } catch (err) {
      console.warn('Backend enrollment API call failed, persisting locally:', err);
    }

    const targetCourse = courses.find((c) => c.id === courseId) || {
      id: courseId,
      title: 'Enrolled Course',
      code: 'CS',
      progress_percentage: 0
    };

    const newEnrolled = [
      ...enrolledCourses.filter((c) => c.id !== courseId),
      {
        ...targetCourse,
        is_enrolled: true,
        progress_percentage: targetCourse.progress_percentage || 0
      }
    ];

    setEnrolledCourses(newEnrolled);
    if (user) {
      localStorage.setItem(
        `cognipath_enrolled_${user.id || user.email}`,
        JSON.stringify(newEnrolled)
      );
    }
    setSelectedCourseId(courseId);

    // Refresh from API if possible
    try {
      const fresh = await coursesAPI.getEnrolled();
      if (fresh && Array.isArray(fresh) && fresh.length > 0) {
        setEnrolledCourses(fresh);
      }
    } catch (e) {}
  };

  const handleUnenrollCourse = async (courseId) => {
    try {
      await coursesAPI.unenroll(courseId);
    } catch (err) {
      console.warn('Backend unenroll API call failed, removing locally:', err);
    }

    const updated = enrolledCourses.filter((c) => c.id !== courseId);
    setEnrolledCourses(updated);
    if (user) {
      localStorage.setItem(
        `cognipath_enrolled_${user.id || user.email}`,
        JSON.stringify(updated)
      );
    }
    if (selectedCourseId === courseId) {
      setSelectedCourseId(updated.length > 0 ? updated[0].id : null);
    }
  };

  const handleDeleteCoursePermanently = async (courseId) => {
    // 1. Call backend delete API; do not swallow error so that UI can display real failure message if any
    await coursesAPI.deleteCourse(courseId);

    // 2. Clean up creator tracking in localStorage
    try {
      const keysToClean = [
        `cognipath_created_courses_${user?.id || user?.email || 'educator'}`,
        'cognipath_created_courses_educator'
      ];
      keysToClean.forEach((key) => {
        const stored = JSON.parse(localStorage.getItem(key) || '[]');
        const filtered = stored.filter((id) => Number(id) !== Number(courseId));
        localStorage.setItem(key, JSON.stringify(filtered));
      });
    } catch (e) {}

    // 3. Clean up enrollment cache in localStorage
    if (user) {
      try {
        const enrKey = `cognipath_enrolled_${user.id || user.email}`;
        const storedEnr = JSON.parse(localStorage.getItem(enrKey) || '[]');
        const filteredEnr = storedEnr.filter((c) => (c.id || c) !== courseId);
        localStorage.setItem(enrKey, JSON.stringify(filteredEnr));
      } catch (e) {}
    }

    // 4. Update memory state
    const updatedAll = courses.filter((c) => c.id !== courseId);
    setCourses(updatedAll);
    const updatedEnrolled = enrolledCourses.filter((c) => c.id !== courseId);
    setEnrolledCourses(updatedEnrolled);
    if (selectedCourseId === courseId) {
      setSelectedCourseId(updatedEnrolled.length > 0 ? updatedEnrolled[0].id : null);
    }
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
          if (activeUser) {
            await fetchEnrolledCourses(activeUser, data);
          }
        }
      } catch (err) {
        if (activeUser) {
          await fetchEnrolledCourses(activeUser);
        }
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

    // Persist verified user session
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

    // Immediately display user role workspace without delay
    const targetTab = validUser.role === 'EDUCATOR' ? 'analytics' : 'dashboard';
    setActiveTab(targetTab);

    // Refresh courses and personal enrollments for authenticated user
    try {
      await refreshAllCourses(validUser);
    } catch (err) {
      console.warn('Courses background refresh notice:', err);
    }
  };

  const handleProfileUpdated = (updatedUser) => {
    setUser(updatedUser);
    localStorage.setItem('cognipath_user', JSON.stringify(updatedUser));
    if (updatedUser.role === 'EDUCATOR' && activeTab === 'dashboard') {
      setActiveTab('analytics');
    } else if (updatedUser.role === 'STUDENT' && activeTab === 'analytics') {
      setActiveTab('dashboard');
    }
  };

  const handleLogout = () => {
    authAPI.logout();
    setUser(null);
    setEnrolledCourses([]);
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

  const handleSwitchRole = () => {
    if (!user) return;
    const newRole = user.role === 'EDUCATOR' ? 'STUDENT' : 'EDUCATOR';
    const updated = {
      ...user,
      role: newRole,
      full_name: newRole === 'EDUCATOR' ? 'Prof. Rajesh Ramanujan' : 'Alex Kumar',
      email: newRole === 'EDUCATOR' ? 'teacher@cognipath.edu' : 'student@cognipath.edu'
    };
    setUser(updated);
    localStorage.setItem('cognipath_user', JSON.stringify(updated));
    setActiveTab(newRole === 'EDUCATOR' ? 'analytics' : 'dashboard');
  };

  const handleNavigate = (tab, courseId) => {
    setActiveTab(tab);
    if (courseId) setSelectedCourseId(courseId);
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
        onSelectTab={setActiveTab}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen((prev) => !prev)}
        onOpenProfile={() => setShowProfileModal(true)}
      />

      {/* Main App Layout */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Left Closable Sidebar */}
        <Sidebar
          activeTab={activeTab}
          setActiveTab={setActiveTab}
          userRole={user.role}
          onOpenLangModal={() => setShowLangModal(true)}
          isOpen={isSidebarOpen}
          onClose={() => setIsSidebarOpen(false)}
        />

        {/* Dynamic Main Workspace Tab with Ambient Radial Glows */}
        <main className={`flex-1 min-h-0 bg-[#0A0D1C] ambient-canvas ${
          activeTab === 'tutor'
            ? 'overflow-hidden flex flex-col'
            : 'overflow-y-auto'
        }`}>
          <ErrorBoundary onReset={() => setActiveTab(user?.role === 'EDUCATOR' ? 'analytics' : 'dashboard')}>
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
                onSelectCourse={setSelectedCourseId}
                onNavigateTab={handleNavigate}
                onOpenCreateCourse={() => setShowCreateCourseModal(true)}
                onDeleteCoursePermanently={handleDeleteCoursePermanently}
                onRefreshCourses={() => refreshAllCourses(user)}
                user={user}
              />
            )}

            {/* Native Learning Pods (formerly Live Kshetra Studio) */}
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

            {/* Native WhatsApp-Style Course Community Channels */}
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
              'dashboard', 'exam-studio',
              'assignments', 'tutor', 'roadmap', 'quizzes', 'flashcards',
              'analytics', 'kshetra', 'pods', 'community', 'landing'
            ].includes(activeTab) && (
              user.role === 'EDUCATOR' ? (
                <EducatorDashboard
                  courseId={selectedCourseId}
                  courses={courses}
                  onSelectCourse={setSelectedCourseId}
                  onNavigateTab={handleNavigate}
                  onOpenCreateCourse={() => setShowCreateCourseModal(true)}
                />
              ) : (
                <DashboardHome
                  user={user}
                  onNavigateTab={handleNavigate}
                  targetLang={targetLang}
                  enrolledCourses={enrolledCourses}
                  allCourses={courses}
                  onEnrollCourse={handleEnrollCourse}
                  onUnenrollCourse={handleUnenrollCourse}
                  onRefreshCourses={() => fetchEnrolledCourses(user)}
                  onOpenExploreCatalog={() => setShowCatalogModal(true)}
                />
              )
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
        onSelectCourse={async (cId) => {
          await handleEnrollCourse(cId);
          setShowCatalogModal(false);
          setActiveTab('dashboard');
        }}
        user={user}
        enrolledCourses={enrolledCourses}
      />

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
