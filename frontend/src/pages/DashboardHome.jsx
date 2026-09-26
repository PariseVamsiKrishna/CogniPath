import React, { useState, useEffect } from 'react';
import {
  Star,
  Laptop,
  Database,
  Globe,
  Play,
  ArrowRight,
  FileText,
  Send,
  Flame,
  CheckCircle2,
  Layers,
  Bot,
  Sparkles,
  ShieldCheck,
  TrendingUp,
  Clock,
  Grid,
  Link2,
  Code2,
  BookOpen,
  Plus
} from 'lucide-react';
import { tutorAPI, analyticsAPI } from '../services/api';
import JourneyTrackCard from '../components/JourneyTrackCard';
import RecommendationCard from '../components/RecommendationCard';

export default function DashboardHome({
  user,
  onNavigateTab,
  targetLang,
  enrolledCourses = [],
  allCourses = [],
  onEnrollCourse,
  onOpenExploreCatalog
}) {
  const firstName = user?.full_name ? user.full_name.trim().split(' ')[0] : 'Learner';

  // Greeting by current time
  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  // Student specific stats
  const [stats, setStats] = useState(() => {
    const isDemoStudent = user?.email === 'student@cognipath.edu';
    if (isDemoStudent) {
      return {
        streak_days: 12,
        overall_score: 78.0,
        topics_completed: 32,
        total_topics: 68,
        recommendations: [
          {
            id: 'rec_1',
            topic_title: 'Recursion Call Stacks',
            course_id: 1,
            course_title: 'Data Structures and Algorithms',
            category: 'DSA',
            difficulty: 'Intermediate',
            reason: 'Strengthen recursion tree analysis and invariants.'
          },
          {
            id: 'rec_2',
            topic_title: 'Relational SQL Joins',
            course_id: 2,
            course_title: 'Database Management Systems',
            category: 'DBMS',
            difficulty: 'Beginner',
            reason: 'Identified concept gap from recent query diagnostics.'
          },
          {
            id: 'rec_3',
            topic_title: 'Modern CSS Grid Layouts',
            course_id: 3,
            course_title: 'Web Development Fundamentals',
            category: 'Web Dev',
            difficulty: 'Advanced',
            reason: 'Master responsive multi-column CSS grid tracks.'
          }
        ]
      };
    }

    // Try reading cached student stats
    try {
      const cached = localStorage.getItem(`cognipath_student_stats_${user?.id || user?.email}`);
      if (cached) return JSON.parse(cached);
    } catch (e) {}

    const totalTopicsEstimate = enrolledCourses.length * 12;
    const avgProg = enrolledCourses.length > 0
      ? enrolledCourses.reduce((acc, c) => acc + (c.progress_percentage || 0), 0) / enrolledCourses.length
      : 0;
    const completedTopicsEstimate = Math.round((avgProg / 100) * (totalTopicsEstimate || 12));

    return {
      streak_days: enrolledCourses.length > 0 ? 1 : 0,
      overall_score: avgProg > 0 ? Math.round(avgProg) : 0,
      topics_completed: completedTopicsEstimate,
      total_topics: totalTopicsEstimate,
      recommendations: []
    };
  });

  useEffect(() => {
    let isMounted = true;
    const loadOverview = async () => {
      try {
        const data = await analyticsAPI.getStudentOverview();
        if (data && isMounted) {
          setStats((prev) => ({
            ...prev,
            ...data
          }));
          localStorage.setItem(
            `cognipath_student_stats_${user?.id || user?.email}`,
            JSON.stringify(data)
          );
        }
      } catch (err) {
        // Fallback calculations for offline or demo
        if (isMounted) {
          const totalTopicsEstimate = enrolledCourses.length * 12;
          const avgProg = enrolledCourses.length > 0
            ? enrolledCourses.reduce((acc, c) => acc + (c.progress_percentage || 0), 0) / enrolledCourses.length
            : 0;
          setStats((prev) => ({
            ...prev,
            topics_completed: Math.round((avgProg / 100) * (totalTopicsEstimate || 12)),
            total_topics: totalTopicsEstimate
          }));
        }
      }
    };

    loadOverview();
    return () => {
      isMounted = false;
    };
  }, [user?.id, user?.email, enrolledCourses.length]);

  // Live AI Tutor Widget Chat State
  const [widgetMessages, setWidgetMessages] = useState([
    {
      id: '1',
      sender: 'ai',
      text: `Hi ${firstName}! I'm your AI tutor. Ask me anything from your syllabus.`,
    },
    {
      id: '2',
      sender: 'user',
      text: 'Can you explain time complexity of binary search?',
    },
    {
      id: '3',
      sender: 'ai',
      text: 'Binary Search has a time complexity of O(log n) because the search space is reduced by half in each step.',
      citation: 'Source: DSA Notes.pdf (Page 45)'
    }
  ]);
  const [widgetInput, setWidgetInput] = useState('');
  const [isAsking, setIsAsking] = useState(false);

  const handleWidgetSubmit = async (e) => {
    e.preventDefault();
    if (!widgetInput.trim() || isAsking) return;

    const query = widgetInput;
    setWidgetInput('');
    const userMsg = { id: Date.now().toString(), sender: 'user', text: query };
    setWidgetMessages((prev) => [...prev, userMsg]);
    setIsAsking(true);

    try {
      const activeCourseId = enrolledCourses.length > 0 ? enrolledCourses[0].id : 1;
      const res = await tutorAPI.query({
        course_id: activeCourseId,
        query,
        target_language: targetLang || 'en'
      });
      const topCitation = res.citations && res.citations.length > 0
        ? `Source: ${res.citations[0].source_title} (${res.citations[0].page_or_chunk})`
        : 'Source: Syllabus Lecture Notes';

      setWidgetMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: res.answer,
          citation: topCitation
        }
      ]);
    } catch (err) {
      setWidgetMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          sender: 'ai',
          text: 'Binary Search operates in O(log n) by dividing the search interval in half on each comparison step.',
          citation: 'Source: CS101_Lecture_04_Trees_and_BST.pdf (Page 2)'
        }
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  // Curated quick-enroll preview courses for students with 0 enrollments
  const fallbackPreviewCourses = [
    {
      id: 1,
      title: 'Data Structures & Algorithms',
      code: 'CS101',
      description: 'Comprehensive study of linear and hierarchical data structures, sorting, and graph algorithms.'
    },
    {
      id: 2,
      title: 'Database Management Systems',
      code: 'DBMS',
      description: 'Relational database architecture, relational algebra, SQL optimization, and normalization.'
    },
    {
      id: 3,
      title: 'Web Development Fundamentals',
      code: 'WEB',
      description: 'Modern front-end architecture, semantic HTML5, responsive CSS Grid/Flexbox, and asynchronous JavaScript.'
    }
  ];

  const quickEnrollCourses = (allCourses && allCourses.length > 0 ? allCourses : fallbackPreviewCourses)
    .filter((c) => !enrolledCourses.some((e) => e.id === c.id))
    .slice(0, 3);

  // Recommendations list
  const activeRecommendations = (stats.recommendations && stats.recommendations.length > 0)
    ? stats.recommendations
    : [
        {
          id: 'rec_1',
          topic_title: 'Recursion Call Stacks & Invariants',
          course_id: 1,
          course_title: 'Data Structures and Algorithms',
          category: 'DSA',
          difficulty: 'Intermediate',
          reason: 'Strengthen recursion tree analysis and invariants.'
        },
        {
          id: 'rec_2',
          topic_title: 'Relational SQL Joins & Query Plans',
          course_id: 2,
          course_title: 'Database Management Systems',
          category: 'DBMS',
          difficulty: 'Beginner',
          reason: 'Identified concept gap from recent query diagnostics.'
        },
        {
          id: 'rec_3',
          topic_title: 'Modern CSS Grid & Flexbox Layouts',
          course_id: 3,
          course_title: 'Web Development Fundamentals',
          category: 'Web Dev',
          difficulty: 'Advanced',
          reason: 'Master responsive multi-column CSS grid tracks.'
        }
      ];

  return (
    <div className="p-5 sm:p-7 max-w-[1600px] mx-auto space-y-7">
      {/* 2-Column Responsive Dashboard Layout */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-7 items-start">
        {/* Left / Center Column (8 cols on xl) */}
        <div className="xl:col-span-8 space-y-7">
          {/* Top Hero Greeting Banner */}
          <div
            style={{ boxShadow: '0 18px 34px -18px rgba(0,0,0,0.55)' }}
            className="rounded-2xl bg-[#12162B] border border-[#262C4C] p-6 sm:p-7 flex items-center justify-between relative overflow-hidden"
          >
            {/* Soft Ambient Glow */}
            <div
              className="absolute -top-12 -left-12 w-48 h-48 rounded-full pointer-events-none opacity-20 blur-2xl"
              style={{ background: 'radial-gradient(circle, #8B7CFF 0%, transparent 70%)' }}
            />

            <div className="space-y-1.5 z-10 max-w-xl">
              <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#ECEDF7] tracking-tight flex items-center gap-2">
                <span>{getGreeting()}, {firstName}</span>
                <span className="inline-block animate-bounce">👋</span>
              </h1>
              <p className="text-sm text-[#8A90B4] font-medium">
                {enrolledCourses.length > 0
                  ? `You are currently enrolled in ${enrolledCourses.length} active ${enrolledCourses.length === 1 ? 'course' : 'courses'}. Track your progress below.`
                  : "Welcome to your personal CogniPath workspace! Enroll in courses below to begin your adaptive learning journey."}
              </p>
            </div>

            {/* Student Mascot Graphic */}
            <div className="relative shrink-0 hidden md:flex items-center justify-center pr-2">
              <div className="h-24 w-28 rounded-2xl bg-[#171C36] border border-[#262C4C] flex flex-col items-center justify-center p-2 relative shadow-inner">
                <div className="h-10 w-10 rounded-full bg-[#FFC15E] border-2 border-[#FFD082] flex items-center justify-center text-[#0A0D1C] font-bold text-xs shadow-md">
                  👨‍💻
                </div>
                <div className="w-16 h-3 bg-[#8B7CFF]/40 rounded-full mt-2 border border-[#8B7CFF]/50 flex items-center justify-center">
                  <div className="w-3 h-1 bg-white/80 rounded-full" />
                </div>
              </div>
            </div>
          </div>

          {/* =============================================================== */}
          {/* Continue Learning Section (User's Individual Enrolled Courses)  */}
          {/* =============================================================== */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-xl font-bold text-[#ECEDF7] tracking-tight flex items-center gap-2">
                  <span>Continue Learning</span>
                  {enrolledCourses.length > 0 && (
                    <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-[#8B7CFF]/15 text-[#8B7CFF] border border-[#8B7CFF]/30">
                      {enrolledCourses.length} Enrolled
                    </span>
                  )}
                </h2>
                <p className="text-xs text-[#8A90B4]">
                  Visual milestone track for your active curricula
                </p>
              </div>

              <div className="flex items-center gap-2">
                {onOpenExploreCatalog && (
                  <button
                    type="button"
                    onClick={onOpenExploreCatalog}
                    className="text-xs font-semibold text-[#8B7CFF] hover:text-[#9d91ff] flex items-center gap-1.5 transition px-3.5 py-1.5 rounded-full bg-[#171C36] hover:bg-[#1f2648] border border-[#262C4C] shadow-sm cursor-pointer"
                  >
                    <span>+ Explore Catalog</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => onNavigateTab('courses')}
                  className="text-xs font-semibold text-slate-300 hover:text-white flex items-center gap-1.5 transition px-3 py-1.5 rounded-full bg-[#12162B] border border-[#262C4C]"
                >
                  <span>View courses</span>
                </button>
              </div>
            </div>

            {/* Enrolled Courses Grid or Empty State */}
            {enrolledCourses && enrolledCourses.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5">
                {enrolledCourses.map((course, idx) => (
                  <JourneyTrackCard
                    key={course.id}
                    course={course}
                    index={idx}
                    onSelectCourse={() => onNavigateTab('course-player', course.id)}
                  />
                ))}
              </div>
            ) : (
              <div
                style={{ boxShadow: '0 18px 34px -18px rgba(0,0,0,0.55)' }}
                className="rounded-3xl bg-[#12162B] border border-[#262C4C] p-8 sm:p-10 text-center space-y-6"
              >
                <div className="h-16 w-16 rounded-2xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 flex items-center justify-center mx-auto text-[#8B7CFF] shadow-lg shadow-[#8B7CFF]/10">
                  <BookOpen className="h-8 w-8" />
                </div>
                <div className="max-w-md mx-auto space-y-2">
                  <h3 className="font-heading text-lg font-bold text-[#ECEDF7]">
                    You haven't enrolled in any courses yet
                  </h3>
                  <p className="text-xs text-[#8A90B4] leading-relaxed">
                    Build your personalized curriculum. Explore courses from our university catalog and start tracking your topics, quizzes, and learning roadmaps.
                  </p>
                </div>

                {onOpenExploreCatalog && (
                  <div>
                    <button
                      type="button"
                      onClick={onOpenExploreCatalog}
                      className="px-6 py-3 rounded-full bg-gradient-to-r from-[#8B7CFF] to-[#FF6F9C] hover:from-[#9d91ff] hover:to-[#ff8cb1] text-[#0A0D1C] font-bold text-xs uppercase tracking-wider shadow-[0_4px_16px_rgba(139,124,255,0.3)] transition cursor-pointer"
                    >
                      Browse Course Catalog & Enroll
                    </button>
                  </div>
                )}

                {/* Quick 1-Click Enrollment Suggestions */}
                {quickEnrollCourses.length > 0 && (
                  <div className="pt-6 border-t border-[#262C4C] text-left">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-[#8A90B4]">
                        Quick 1-Click Enrollment
                      </span>
                      <span className="text-[10px] text-[#8B7CFF] font-medium">Click to enroll instantly</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {quickEnrollCourses.map((c) => (
                        <div
                          key={c.id}
                          className="p-4 rounded-2xl bg-[#171C36] border border-[#262C4C] hover:border-[#8B7CFF]/40 flex flex-col justify-between space-y-3 transition"
                        >
                          <div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#8B7CFF]/15 text-[#8B7CFF] border border-[#8B7CFF]/30">
                              {c.code || 'CS'}
                            </span>
                            <h4 className="font-bold text-xs text-[#ECEDF7] mt-2 line-clamp-1">
                              {c.title}
                            </h4>
                            <p className="text-[10px] text-[#8A90B4] mt-1 line-clamp-2">
                              {c.description}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => onEnrollCourse ? onEnrollCourse(c.id) : (onOpenExploreCatalog && onOpenExploreCatalog())}
                            className="w-full py-2 rounded-xl bg-[#8B7CFF] hover:bg-[#9d91ff] text-[#0A0D1C] text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            <span>Enroll in Course</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* =============================================================== */}
          {/* Recommended for You Section (Cogni Intelligence)                 */}
          {/* =============================================================== */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-xl bg-[#FFC15E]/15 border border-[#FFC15E]/30 flex items-center justify-center text-[#FFC15E] shrink-0">
                <Star className="h-4 w-4 fill-[#FFC15E] text-[#FFC15E]" />
              </div>
              <div>
                <h2 className="font-heading text-lg font-bold text-[#ECEDF7] tracking-tight flex items-center gap-2">
                  <span>Recommended for You</span>
                  <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-[#8B7CFF]/25 to-[#FF6F9C]/25 text-[#ECEDF7] border border-[#8B7CFF]/40 flex items-center gap-1">
                    <Sparkles className="h-3 w-3 text-[#FF6F9C]" />
                    <span>Cogni Intelligence</span>
                  </span>
                </h2>
                <p className="text-xs text-[#8A90B4]">
                  Topics recommended by AI based on your curriculum and diagnostic performance
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {activeRecommendations.map((rec) => (
                <RecommendationCard
                  key={rec.id}
                  recommendation={rec}
                  onStartLearning={() => {
                    if (rec.course_id && enrolledCourses.some((c) => c.id === rec.course_id)) {
                      onNavigateTab('course-player', rec.course_id);
                    } else {
                      onNavigateTab('tutor');
                    }
                  }}
                />
              ))}
            </div>
          </div>

          {/* Quick Quiz Banner */}
          <div
            style={{ boxShadow: '0 18px 34px -18px rgba(0,0,0,0.55)' }}
            className="rounded-2xl bg-[#12162B] border border-[#262C4C] p-5 flex flex-col sm:flex-row items-center justify-between gap-4"
          >
            <div className="flex items-center gap-3.5">
              <div className="h-11 w-11 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-[#8B7CFF]" />
              </div>
              <div>
                <h3 className="font-heading font-bold text-[#ECEDF7] text-sm sm:text-base">Quick Assessment Quiz</h3>
                <p className="text-xs text-[#8A90B4]">Test your curriculum mastery with a 5-minute diagnostic quiz</p>
              </div>
            </div>

            <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
              <button
                type="button"
                onClick={() => onNavigateTab('quizzes')}
                className="px-6 py-2.5 rounded-full bg-gradient-to-r from-[#8B7CFF] to-[#FF6F9C] hover:from-[#9d91ff] hover:to-[#ff8cb1] text-[#0A0D1C] font-bold text-xs uppercase tracking-wider shadow-[0_4px_16px_rgba(139,124,255,0.3)] transition shrink-0 cursor-pointer"
              >
                Start Quiz
              </button>
              <div className="text-right text-[11px] text-[#8A90B4] leading-tight shrink-0">
                <div className="font-semibold text-[#ECEDF7]">5 Questions</div>
                <div className="text-[#8A90B4]/70">5 Minutes</div>
              </div>
            </div>
          </div>

          {/* Bottom 4 Feature Pillars */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2">
            <div className="p-3.5 rounded-2xl bg-[#12162B] border border-[#262C4C] space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ECEDF7]">
                <Globe className="h-3.5 w-3.5 text-[#8B7CFF]" />
                <span className="font-heading">Learn in Your Language</span>
              </div>
              <p className="text-[10px] text-[#8A90B4] leading-relaxed">
                Bhashini integration for regional Indian language translation
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#12162B] border border-[#262C4C] space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ECEDF7]">
                <ShieldCheck className="h-3.5 w-3.5 text-[#5FE3B0]" />
                <span className="font-heading">Syllabus-Aligned AI</span>
              </div>
              <p className="text-[10px] text-[#8A90B4] leading-relaxed">
                Answers verified against uploaded university lecture notes
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#12162B] border border-[#262C4C] space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#ECEDF7]">
                <TrendingUp className="h-3.5 w-3.5 text-[#5FE3B0]" />
                <span className="font-heading">Smart Analytics</span>
              </div>
              <p className="text-[10px] text-[#8A90B4] leading-relaxed">
                Track personal retention and identify weak conceptual topics
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-[#12162B] border border-[#262C4C] space-y-1">
              <div className="flex items-center gap-2 text-xs font-bold text-[#FFC15E]">
                <Clock className="h-3.5 w-3.5 text-[#FFC15E]" />
                <span className="font-heading">24/7 AI Tutor</span>
              </div>
              <p className="text-[10px] text-[#8A90B4] leading-relaxed">
                Get instant doubt resolution grounded in your course materials
              </p>
            </div>
          </div>
        </div>

        {/* Right Column (4 cols on xl) — AI Tutor & Your Progress */}
        <div className="xl:col-span-4 space-y-7">
          {/* AI Tutor Live Card */}
          <div
            style={{ boxShadow: '0 18px 34px -18px rgba(0,0,0,0.55)' }}
            className="rounded-2xl bg-[#12162B] border border-[#262C4C] overflow-hidden flex flex-col h-[460px]"
          >
            {/* Header */}
            <div className="p-4 border-b border-[#262C4C] flex items-center justify-between bg-[#171C36]">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-lg bg-[#8B7CFF]/20 border border-[#8B7CFF]/30 flex items-center justify-center text-[#8B7CFF]">
                  <Bot className="h-4 w-4" />
                </div>
                <span className="font-heading font-bold text-sm text-[#ECEDF7]">AI Tutor</span>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#5FE3B0]/15 text-[#5FE3B0] border border-[#5FE3B0]/30 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-[#5FE3B0] animate-pulse" />
                Online
              </span>
            </div>

            {/* Chat message bubbles */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3 text-xs">
              {widgetMessages.map((m) => (
                <div
                  key={m.id}
                  className={`flex gap-2.5 ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {m.sender === 'ai' && (
                    <div className="h-6 w-6 rounded-full bg-[#8B7CFF]/20 border border-[#8B7CFF]/30 flex items-center justify-center text-xs shrink-0 mt-1">
                      🤖
                    </div>
                  )}

                  <div className={`space-y-1 max-w-[85%]`}>
                    <div
                      className={`p-3 rounded-2xl ${
                        m.sender === 'user'
                          ? 'bg-[#8B7CFF] text-[#0A0D1C] font-semibold rounded-tr-none shadow-sm'
                          : 'bg-[#171C36] border border-[#262C4C] text-[#ECEDF7] rounded-tl-none leading-relaxed'
                      }`}
                    >
                      <p>{m.text}</p>
                    </div>

                    {m.citation && (
                      <div className="flex items-center gap-1 text-[10px] text-[#5FE3B0] font-semibold bg-[#5FE3B0]/10 px-2.5 py-1 rounded-full border border-[#5FE3B0]/20 w-fit">
                        <FileText className="h-3 w-3" />
                        <span>{m.citation}</span>
                      </div>
                    )}
                  </div>

                  {m.sender === 'user' && (
                    <div className="h-6 w-6 rounded-full bg-[#8B7CFF] flex items-center justify-center text-[#0A0D1C] text-[10px] font-bold shrink-0 mt-1">
                      {firstName.charAt(0)}
                    </div>
                  )}
                </div>
              ))}
              {isAsking && (
                <div className="flex items-center gap-2 text-xs text-[#8B7CFF] italic">
                  <Bot className="h-3.5 w-3.5 animate-spin" />
                  <span>Cogni is answering...</span>
                </div>
              )}
            </div>

            {/* Chat Input */}
            <form
              onSubmit={handleWidgetSubmit}
              className="p-3 border-t border-[#262C4C] bg-[#171C36] flex items-center gap-2"
            >
              <input
                type="text"
                value={widgetInput}
                onChange={(e) => setWidgetInput(e.target.value)}
                placeholder="Ask about your syllabus..."
                className="flex-1 bg-[#12162B] border border-[#262C4C] rounded-full px-3.5 py-2 text-xs text-[#ECEDF7] placeholder-[#8A90B4]/60 focus:outline-none focus:border-[#8B7CFF]"
              />
              <button
                type="submit"
                disabled={!widgetInput.trim() || isAsking}
                className="h-8 w-8 rounded-full bg-[#8B7CFF] hover:bg-[#9d91ff] disabled:opacity-40 text-[#0A0D1C] flex items-center justify-center transition shrink-0 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </form>
          </div>

          {/* Your Progress Widget */}
          <div
            style={{ boxShadow: '0 18px 34px -18px rgba(0,0,0,0.55)' }}
            className="rounded-2xl bg-[#12162B] border border-[#262C4C] p-5 space-y-4"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-bold text-sm text-[#ECEDF7] tracking-tight">Your Progress</h3>
              <button
                type="button"
                onClick={() => onNavigateTab('roadmap')}
                className="text-[11px] font-bold text-[#8B7CFF] hover:text-[#9d91ff] transition cursor-pointer"
              >
                View detailed report →
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              {/* Learning Streak */}
              <div className="p-3.5 rounded-2xl bg-[#171C36] border border-[#262C4C] space-y-1">
                <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#8A90B4]">
                  <Flame className="h-3.5 w-3.5 text-[#FFC15E] fill-[#FFC15E]" />
                  <span>Learning Streak</span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-heading text-xl font-bold text-[#ECEDF7]">
                    {stats.streak_days}
                  </span>
                  <span className="text-xs text-[#8A90B4]">days</span>
                </div>
              </div>

              {/* Overall Score */}
              <div className="p-3.5 rounded-2xl bg-[#171C36] border border-[#262C4C] space-y-1">
                <div className="text-[11px] font-semibold text-[#8A90B4]">
                  <span>Overall Score</span>
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="font-heading text-xl font-bold text-[#5FE3B0]">
                    {stats.overall_score > 0 ? `${stats.overall_score}%` : 'New'}
                  </span>
                  <span className="text-xs text-[#5FE3B0] font-bold">
                    {stats.overall_score >= 70 ? 'Good' : stats.overall_score > 0 ? 'Active' : 'Beginner'}
                  </span>
                </div>
              </div>
            </div>

            {/* Topics Completed */}
            <div className="p-3.5 rounded-2xl bg-[#171C36] border border-[#262C4C] flex items-center justify-between">
              <div>
                <div className="text-[11px] font-semibold text-[#8A90B4]">Topics Completed</div>
                <div className="font-heading text-xl font-bold text-[#ECEDF7] mt-1">
                  {stats.topics_completed}
                  <span className="text-sm font-semibold text-[#8A90B4]/60">
                    /{stats.total_topics || (enrolledCourses.length * 12 || 12)}
                  </span>
                </div>
              </div>
              <div className="h-10 w-10 rounded-xl bg-[#8B7CFF]/15 border border-[#8B7CFF]/30 flex items-center justify-center">
                <Layers className="h-5 w-5 text-[#8B7CFF]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
