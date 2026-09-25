import React, { useState, useEffect } from 'react';
import Navbar, { SUPPORTED_LANGUAGES } from './components/Navbar';
import Sidebar from './components/Sidebar';
import Login from './pages/Login';
import DashboardHome from './pages/DashboardHome';
import StudentPortal from './pages/StudentPortal';
import SpacedQuizView from './pages/SpacedQuizView';
import EducatorDashboard from './pages/EducatorDashboard';
import LearningPods from './pages/LearningPods';
import CommunityFeed from './pages/CommunityFeed';
import LearningRoadmapView from './pages/LearningRoadmapView';
import CoursePlayer from './pages/CoursePlayer';
import ExamStudio from './pages/ExamStudio';
import AssignmentView from './pages/AssignmentView';
import LandingPage from './pages/LandingPage';
import CreateCourseModal from './components/CreateCourseModal';
import AcademicProfileModal from './components/AcademicProfileModal';
import { coursesAPI, authAPI } from './services/api';
import { Globe, X, Check } from 'lucide-react';

export default function App() {
  const [user, setUser] = useState(null);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [courses, setCourses] = useState([
    { id: 1, code: 'CS101', title: 'Data Structures & Algorithms', category: 'Computer Science' },
    { id: 2, code: 'AI201', title: 'Deep Learning & Neural Networks', category: 'Artificial Intelligence' }
  ]);
  const [selectedCourseId, setSelectedCourseId] = useState(1);
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

  const handleCourseCreated = async (newCourse) => {
    setShowCreateCourseModal(false);
    await fetchCourses();
    if (newCourse?.id) {
      setSelectedCourseId(newCourse.id);
    }
    setActiveTab('course-player');
  };

  useEffect(() => {
    const handleHashChange = () => {
      if (window.location.hash === '#login' || window.location.pathname === '/login') {
        setIsLoginView(true);
      } else if (!user) {
        setIsLoginView(false);
      }
    };
    window.addEventListener('popstate', handleHashChange);
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('popstate', handleHashChange);
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, [user]);

  useEffect(() => {
    // Check local storage for active session
    const storedUser = localStorage.getItem('cognipath_user');
    if (storedUser) {
      try {
        const parsed = JSON.parse(storedUser);
        setUser(parsed);
        if (!parsed.profile_completed) {
          setShowProfileModal(true);
        }
        if (parsed.role === 'EDUCATOR') {
          setActiveTab('analytics');
        } else {
          setActiveTab('dashboard');
        }
      } catch (e) {
        console.error(e);
      }
    }
    fetchCourses();
    setIsInitializing(false);
  }, []);

  const fetchCourses = async () => {
    try {
      const data = await coursesAPI.list();
      if (data && data.length > 0) {
        setCourses(data);
        setSelectedCourseId(data[0].id);
      }
    } catch (err) {
      console.log('Using default course syllabus data.');
    }
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsLoginView(false);
    if (window.location.hash === '#login') {
      window.history.pushState(null, '', window.location.pathname);
    }
    if (!userData.profile_completed) {
      setShowProfileModal(true);
    }
    if (userData.role === 'EDUCATOR') {
      setActiveTab('analytics');
    } else {
      setActiveTab('dashboard');
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
    try {
      const data = await authAPI.login(demoEmail, 'password123');
      handleLoginSuccess(data.user);
    } catch (err) {
      const mockUser = {
        id: demoRole === 'EDUCATOR' ? 1 : 2,
        email: demoEmail,
        full_name: demoRole === 'EDUCATOR' ? 'Prof. Rajesh Ramanujan' : 'Alex Kumar',
        role: demoRole
      };
      localStorage.setItem('cognipath_token', 'mock_token_sih2026');
      localStorage.setItem('cognipath_user', JSON.stringify(mockUser));
      handleLoginSuccess(mockUser);
    }
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
        <Login
          onLoginSuccess={handleLoginSuccess}
          onBackToHome={handleBackToHome}
          initialRole={loginRole}
        />
      );
    }
    return (
      <LandingPage
        onOpenLogin={handleOpenLogin}
        onQuickLogin={handleQuickLogin}
      />
    );
  }

  return (
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
          (activeTab === 'course-player' || activeTab === 'courses' || activeTab === 'tutor')
            ? 'overflow-hidden flex flex-col'
            : 'overflow-y-auto'
        }`}>
          {/* Dashboard Home View */}
          {activeTab === 'dashboard' && (
            <DashboardHome
              user={user}
              onNavigateTab={handleNavigate}
              targetLang={targetLang}
            />
          )}

          {/* Hierarchical Course Delivery & View-Only PDF Player */}
          {(activeTab === 'course-player' || activeTab === 'courses') && (
            <CoursePlayer
              courseId={selectedCourseId}
              user={user}
              onNavigateTab={handleNavigate}
              courses={courses}
              onSelectCourse={setSelectedCourseId}
              onRefreshCourses={fetchCourses}
            />
          )}

          {/* Dual-Engine Assessment System (Exams, Quizzes & AI Suggestion Studio) */}
          {activeTab === 'exam-studio' && (
            <ExamStudio
              courseId={selectedCourseId}
              user={user}
              onNavigateTab={handleNavigate}
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
            />
          )}

          {/* Adaptive Learning Roadmap & Knowledge Gap Radar */}
          {activeTab === 'roadmap' && (
            <LearningRoadmapView
              courseId={selectedCourseId}
              onNavigateTab={setActiveTab}
            />
          )}

          {/* Spaced Repetition SM-2 Quiz View */}
          {(activeTab === 'quizzes' || activeTab === 'flashcards') && (
            <SpacedQuizView courseId={selectedCourseId} />
          )}

          {/* Educator Analytics & Curriculum Health Diagnostic Studio */}
          {activeTab === 'analytics' && (
            <EducatorDashboard
              courseId={selectedCourseId}
              courses={courses}
              onSelectCourse={setSelectedCourseId}
              onNavigateTab={handleNavigate}
              onOpenCreateCourse={() => setShowCreateCourseModal(true)}
            />
          )}

          {/* Native In-App Learning Pods with Live Collaborative Whiteboard */}
          {activeTab === 'pods' && (
            <LearningPods
              courseId={selectedCourseId}
              user={user}
            />
          )}

          {/* Native In-App Community Channels */}
          {activeTab === 'community' && (
            <CommunityFeed
              courseId={selectedCourseId}
              user={user}
            />
          )}

          {/* Platform Overview & SIH Landing View */}
          {activeTab === 'landing' && (
            <LandingPage
              onOpenLogin={() => {}}
              onQuickLogin={handleQuickLogin}
            />
          )}
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
        isOnboarding={user ? !user.profile_completed : false}
      />
    </div>
  );
}
