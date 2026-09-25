import React, { useState, useEffect } from 'react';
import {
  X,
  Search,
  Star,
  BookOpen,
  ArrowRight,
  GraduationCap,
  Sparkles,
  Layers,
  Video,
  CheckCircle2,
  TrendingUp,
  Clock,
  Play,
  Filter
} from 'lucide-react';
import { coursesAPI } from '../services/api';

const CATEGORIES = [
  'All',
  'Computer Science',
  'Database Systems',
  'Web Development',
  'Artificial Intelligence'
];

export default function CourseCatalogModal({
  isOpen,
  onClose,
  onSelectCourse,
  user,
  onOpenRateModal
}) {
  const [courses, setCourses] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [sortBy, setSortBy] = useState('rating'); // 'rating' | 'popular' | 'newest'
  const [loading, setLoading] = useState(false);
  const [enrollingCourseId, setEnrollingCourseId] = useState(null);

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
    }
  }, [isOpen, searchQuery, selectedCategory, sortBy]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const data = await coursesAPI.explore({
        q: searchQuery.trim() || undefined,
        category: selectedCategory !== 'All' ? selectedCategory : undefined,
        sort_by: sortBy
      });
      setCourses(data || []);
    } catch (err) {
      console.error('Failed to explore courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollOrResume = async (course) => {
    if (course.is_enrolled) {
      onSelectCourse(course.id);
      onClose();
      return;
    }

    setEnrollingCourseId(course.id);
    try {
      await coursesAPI.enroll(course.id);
      onSelectCourse(course.id);
      onClose();
    } catch (err) {
      console.error('Enrollment failed:', err);
      // Fallback: still navigate
      onSelectCourse(course.id);
      onClose();
    } finally {
      setEnrollingCourseId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0e1424] border border-[#1e2638] rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Glow Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-amber-500" />

        {/* Modal Header */}
        <div className="p-6 border-b border-[#1e2638] bg-[#121826]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                CogniPath Academy
              </span>
              <span className="text-xs font-semibold text-slate-400">
                • Verified Engineering Curricula
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Find New Courses</span>
              <Sparkles className="h-5 w-5 text-amber-400" />
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Explore university modules with high-rated lectures, AI tutor Cogni, and end-of-module assessments.
            </p>
          </div>

          <button
            onClick={onClose}
            className="p-2.5 rounded-2xl text-slate-400 hover:text-white hover:bg-[#1a2338] transition self-start sm:self-auto"
            title="Close explorer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="p-5 border-b border-[#1e2638] bg-[#0b0f19] space-y-4">
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by course title, code, keywords, or creator name (e.g., Prof. Rajesh)..."
                className="w-full pl-11 pr-4 py-2.5 rounded-2xl bg-[#121826] border border-[#1e2638] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Sorting Controls */}
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-bold text-slate-400 hidden lg:inline">Sort:</span>
              <div className="bg-[#121826] p-1 rounded-2xl border border-[#1e2638] flex items-center gap-1">
                <button
                  onClick={() => setSortBy('rating')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    sortBy === 'rating'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Sort by highest student star ratings"
                >
                  <Star className="h-3.5 w-3.5 fill-current text-amber-400" />
                  <span>Highest Rated</span>
                </button>

                <button
                  onClick={() => setSortBy('popular')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    sortBy === 'popular'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Most Popular</span>
                </button>

                <button
                  onClick={() => setSortBy('newest')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    sortBy === 'newest'
                      ? 'bg-purple-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Clock className="h-3.5 w-3.5" />
                  <span>Newest</span>
                </button>
              </div>
            </div>
          </div>

          {/* Category Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-500 shrink-0">Filter:</span>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedCategory === cat
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-[#121826] hover:bg-[#1a2338] text-slate-400 hover:text-slate-200 border border-[#1e2638]'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Modal Main Content: Course Grid */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <p className="text-xs font-semibold">Searching curated engineering courses...</p>
            </div>
          ) : courses && courses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => (
                <div
                  key={course.id}
                  className="rounded-3xl bg-[#121826]/90 border border-[#1e2638] hover:border-indigo-500/50 p-6 flex flex-col justify-between shadow-xl hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 relative group"
                >
                  <div className="space-y-4">
                    {/* Top Row: Category Badge & Star Rating */}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-slate-800/90 text-indigo-300 border border-indigo-500/30">
                        {course.code} • {course.category}
                      </span>

                      {/* Prominent Star Rating Badge */}
                      <button
                        onClick={() => onOpenRateModal && onOpenRateModal(course)}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black transition cursor-pointer"
                        title="Click to view ratings or rate this course"
                      >
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        <span>{course.average_rating ? course.average_rating.toFixed(1) : '4.9'}</span>
                        <span className="text-[10px] font-medium text-slate-400">
                          ({course.total_ratings || 0})
                        </span>
                      </button>
                    </div>

                    {/* Course Title & Description */}
                    <div>
                      <h3 className="text-base font-extrabold text-white group-hover:text-indigo-300 transition-colors line-clamp-1">
                        {course.title}
                      </h3>
                      <p className="text-xs text-slate-400 mt-1 line-clamp-2 leading-relaxed">
                        {course.description || `${course.category} comprehensive curriculum with hands-on practice.`}
                      </p>
                    </div>

                    {/* CREATED BY EDUCATOR STRIP */}
                    <div className="p-3 rounded-2xl bg-[#0b0f19] border border-[#1a2335] flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                          <GraduationCap className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold text-slate-500 block uppercase">Created by</span>
                          <span className="text-xs font-bold text-slate-200 truncate block">
                            {course.educator_name || 'Prof. Rajesh Ramanujan'}
                          </span>
                        </div>
                      </div>

                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                        {course.difficulty || 'Intermediate'}
                      </span>
                    </div>

                    {/* Syllabus Metrics: Modules & Topics */}
                    <div className="flex items-center gap-4 text-xs font-semibold text-slate-400 pt-1">
                      <div className="flex items-center gap-1.5">
                        <Layers className="h-3.5 w-3.5 text-indigo-400" />
                        <span>{course.modules_count || 3} Modules</span>
                      </div>
                      <span>•</span>
                      <div className="flex items-center gap-1.5">
                        <Video className="h-3.5 w-3.5 text-emerald-400" />
                        <span>{course.topics_count || 8} Lectures</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Action Footer */}
                  <div className="pt-5 mt-4 border-t border-[#1a2335] flex items-center justify-between gap-3">
                    <button
                      onClick={() => onOpenRateModal && onOpenRateModal(course)}
                      className="px-3 py-2 rounded-xl bg-[#1a2338] hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5"
                    >
                      <Star className="h-3.5 w-3.5 text-amber-400" />
                      <span>Reviews</span>
                    </button>

                    <button
                      onClick={() => handleEnrollOrResume(course)}
                      disabled={enrollingCourseId === course.id}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-2 shadow-lg ${
                        course.is_enrolled
                          ? 'bg-indigo-600/20 hover:bg-indigo-600 text-indigo-300 hover:text-white border border-indigo-500/40'
                          : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-600/25'
                      }`}
                    >
                      {enrollingCourseId === course.id ? (
                        <span>Enrolling...</span>
                      ) : course.is_enrolled ? (
                        <>
                          <Play className="h-3.5 w-3.5 fill-current" />
                          <span>Resume Learning</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          <span>Enroll & Start</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-16 text-center space-y-4">
              <BookOpen className="h-12 w-12 text-slate-600 mx-auto" />
              <div>
                <h3 className="text-base font-bold text-white">No courses match your query</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Try searching with different terms or selecting another category filter.
                </p>
              </div>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('All');
                }}
                className="px-4 py-2 rounded-xl bg-[#1a2338] text-slate-200 text-xs font-bold transition"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
