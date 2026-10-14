import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Search,
  Star,
  BookOpen,
  GraduationCap,
  Sparkles,
  Layers,
  Video,
  CheckCircle2,
  TrendingUp,
  Clock,
  AlertCircle,
  Building2,
  Users,
  Eye
} from 'lucide-react';
import { coursesAPI } from '../services/api';
import {
  TARGET_BRANCHES,
  formatDifficulty,
  getDifficultyBadgeClass
} from '../constants/academic';

const BRANCH_FILTERS = ['All', ...TARGET_BRANCHES];

export default function CourseCatalogModal({
  isOpen,
  onClose,
  onSelectCourse,
  onPreviewCourse,
  onEnrollSuccess,
  user,
  onOpenRateModal,
  enrolledCourses = []
}) {
  const [courses, setCourses] = useState([]);
  const [hiddenCount, setHiddenCount] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedBranch, setSelectedBranch] = useState('All');
  const [selectedDifficulty, setSelectedDifficulty] = useState('All');
  const [sortBy, setSortBy] = useState('newest'); // 'newest' | 'popular' | 'rating'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [enrollError, setEnrollError] = useState('');
  const [enrollingCourseId, setEnrollingCourseId] = useState(null);
  const fetchReqIdRef = useRef(0);
  const searchTimerRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      fetchCourses();
    }
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [isOpen, selectedBranch, selectedDifficulty, sortBy, enrolledCourses]);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      fetchCourses(val);
    }, 300);
  };

  const handleClearSearch = () => {
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setSearchQuery('');
    fetchCourses('');
  };

  const fetchCourses = async (overrideQuery) => {
    const reqId = ++fetchReqIdRef.current;
    setLoading(true);
    setError('');
    setEnrollError('');
    try {
      const q = overrideQuery !== undefined ? overrideQuery : searchQuery;
      const data = await coursesAPI.explore({
        q: q.trim() || undefined,
        target_branch: selectedBranch !== 'All' ? selectedBranch : undefined,
        difficulty: selectedDifficulty !== 'All' ? selectedDifficulty : undefined,
        sort_by: sortBy
      });
      if (reqId !== fetchReqIdRef.current) return;

      const enrolledIds = new Set((enrolledCourses || []).map((c) => Number(c.id)));
      const isCourseHidden = (c) => {
        if (!c.is_published && c.is_published !== undefined) return true;
        if (c.is_enrolled) return true;
        if (enrolledIds.has(Number(c.id))) return true;
        if (user?.id && Number(c.educator_id) === Number(user.id)) return true;
        return false;
      };

      const rawList = Array.isArray(data) ? data : [];
      setHiddenCount(rawList.filter(isCourseHidden).length);
      setCourses(rawList.filter((c) => !isCourseHidden(c)));
    } catch (err) {
      if (reqId === fetchReqIdRef.current) {
        console.error('Failed to explore courses:', err);
        setError(
          err.response?.data?.detail ||
            'Unable to load courses from the server. Please check your connection and retry.'
        );
      }
    } finally {
      if (reqId === fetchReqIdRef.current) {
        setLoading(false);
      }
    }
  };

  const handleViewDetails = (course) => {
    if (onPreviewCourse) {
      onPreviewCourse(course.id);
    } else if (onSelectCourse) {
      onSelectCourse(course.id, { previewOnly: true });
    }
    onClose();
  };

  const handleEnrollNow = async (course) => {
    setEnrollingCourseId(course.id);
    setEnrollError('');
    try {
      await coursesAPI.enroll(course.id);
      if (onEnrollSuccess) {
        await onEnrollSuccess(course.id);
      } else if (onSelectCourse) {
        onSelectCourse(course.id);
      }
      onClose();
    } catch (err) {
      console.error('Enrollment failed:', err);
      const detail =
        err.response?.data?.detail ||
        'Could not complete enrollment. Please try again.';
      setEnrollError(detail);
    } finally {
      setEnrollingCourseId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-[#0e1424] border border-[#1e2638] rounded-3xl w-full max-w-6xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-500" />

        {/* Modal Header */}
        <div className="p-6 border-b border-[#1e2638] bg-[#121826]/70 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] uppercase font-extrabold px-2.5 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Course Discovery
              </span>
              <span className="text-xs font-semibold text-slate-400">
                • Published Educator Curricula
              </span>
            </div>
            <h2 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
              <span>Find New Courses</span>
              <Sparkles className="h-5 w-5 text-amber-400" />
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Browse published courses, inspect syllabus details, and enroll to start tracking your progress.
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
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearchChange}
                placeholder="Search by course title, code, branch, educator, or university..."
                className="w-full pl-11 pr-9 py-2.5 rounded-2xl bg-[#121826] border border-[#1e2638] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
              {searchQuery && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Difficulty Filter */}
            <div className="flex items-center gap-2">
              <select
                value={selectedDifficulty}
                onChange={(e) => setSelectedDifficulty(e.target.value)}
                className="bg-[#121826] border border-[#1e2638] rounded-2xl px-3.5 py-2.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-indigo-500"
              >
                <option value="All">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>

              {/* Sort Controls */}
              <div className="bg-[#121826] p-1 rounded-2xl border border-[#1e2638] flex items-center gap-1">
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

                <button
                  onClick={() => setSortBy('popular')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    sortBy === 'popular'
                      ? 'bg-indigo-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span>Popular</span>
                </button>

                <button
                  onClick={() => setSortBy('rating')}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                    sortBy === 'rating'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Star className="h-3.5 w-3.5 fill-current text-amber-400" />
                  <span>Highest Rated</span>
                </button>
              </div>
            </div>
          </div>

          {/* Target Branch Filter Pills */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-500 shrink-0">Branch:</span>
            {BRANCH_FILTERS.map((branch) => (
              <button
                key={branch}
                onClick={() => setSelectedBranch(branch)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition ${
                  selectedBranch === branch
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-md shadow-indigo-600/20'
                    : 'bg-[#121826] hover:bg-[#1a2338] text-slate-400 hover:text-slate-200 border border-[#1e2638]'
                }`}
              >
                {branch}
              </button>
            ))}
          </div>

          {hiddenCount > 0 && (
            <p className="text-xs text-slate-500 text-center">
              Already-enrolled and self-created courses are hidden from discovery.
            </p>
          )}

          {enrollError && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
              <span>{enrollError}</span>
            </div>
          )}
        </div>

        {/* Course Grid */}
        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-400">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-indigo-500 border-t-transparent" />
              <p className="text-xs font-semibold">Loading published courses...</p>
            </div>
          ) : error ? (
            <div className="py-16 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-rose-500/10 text-rose-400 border border-rose-500/20 flex items-center justify-center mx-auto">
                <AlertCircle className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Failed to load courses</h3>
                <p className="text-xs text-rose-300 mt-1 max-w-sm mx-auto">{error}</p>
              </div>
              <button
                onClick={fetchCourses}
                className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/30"
              >
                Retry
              </button>
            </div>
          ) : courses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((course) => {
                const difficultyLabel = formatDifficulty(course.difficulty);
                const difficultyClass = getDifficultyBadgeClass(course.difficulty);
                const hasRatings = Number(course.total_ratings || 0) > 0;
                const ratingText = hasRatings
                  ? Number(course.average_rating || 0).toFixed(1)
                  : 'New';
                const educatorName = course.educator_name || 'Course Instructor';
                const universityName =
                  course.university ||
                  course.educator_university ||
                  'University / Institution not specified';
                const branchLabel =
                  course.target_branch || course.category || 'Computer Science & Engineering (CSE)';

                return (
                  <div
                    key={course.id}
                    className="rounded-3xl bg-[#121826]/90 border border-[#1e2638] hover:border-indigo-500/50 p-6 flex flex-col justify-between shadow-xl hover:shadow-2xl transition-all duration-300 relative group"
                  >
                    <div className="space-y-4">
                      {/* Top Row: Branch/Code & Genuine Rating */}
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-slate-800/90 text-indigo-300 border border-indigo-500/30 truncate max-w-[65%]">
                          {course.code} • {branchLabel}
                        </span>

                        <button
                          type="button"
                          onClick={() => onOpenRateModal && onOpenRateModal(course)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-black transition shrink-0"
                          title={hasRatings ? `${ratingText} average from ${course.total_ratings} reviews` : 'No ratings yet'}
                        >
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          <span>{ratingText}</span>
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
                          {course.description || 'Structured engineering curriculum with video lectures and assessments.'}
                        </p>
                      </div>

                      {/* Educator & University Block */}
                      <div className="p-3 rounded-2xl bg-[#0b0f19] border border-[#1a2335] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="h-8 w-8 rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20 flex items-center justify-center shrink-0">
                              <GraduationCap className="h-4 w-4" />
                            </div>
                            <div className="min-w-0">
                              <span className="text-[10px] font-bold text-slate-500 block uppercase">
                                Educator
                              </span>
                              <span className="text-xs font-bold text-slate-200 truncate block">
                                {educatorName}
                              </span>
                            </div>
                          </div>

                          <span className={`text-[10px] font-extrabold px-2.5 py-0.5 rounded-full border ${difficultyClass}`}>
                            {difficultyLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-slate-400 pt-1 border-t border-[#1a2335]/80">
                          <Building2 className="h-3.5 w-3.5 text-cyan-400 shrink-0" />
                          <span className="truncate">{universityName}</span>
                        </div>
                      </div>

                      {/* Metrics Row: Modules, Topics, Enrolled Students */}
                      <div className="flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-400 pt-1">
                        <div className="flex items-center gap-1.5">
                          <Layers className="h-3.5 w-3.5 text-indigo-400" />
                          <span>{course.modules_count ?? 0} Modules</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1.5">
                          <Video className="h-3.5 w-3.5 text-emerald-400" />
                          <span>{course.topics_count ?? 0} Topics</span>
                        </div>
                        <span>•</span>
                        <div className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5 text-cyan-400" />
                          <span>{course.enrolled_count ?? 0} Students</span>
                        </div>
                      </div>
                    </div>

                    {/* Action Footer: View Details vs Enroll Now */}
                    <div className="pt-4 mt-4 border-t border-[#1a2335] flex items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => handleViewDetails(course)}
                        className="px-3.5 py-2 rounded-xl bg-[#1a2338] hover:bg-slate-700 text-slate-200 hover:text-white text-xs font-bold transition flex items-center gap-1.5"
                      >
                        <Eye className="h-3.5 w-3.5 text-indigo-400" />
                        <span>View Details</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleEnrollNow(course)}
                        disabled={enrollingCourseId === course.id}
                        className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-lg shadow-indigo-600/25"
                      >
                        {enrollingCourseId === course.id ? (
                          <span>Enrolling...</span>
                        ) : (
                          <>
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            <span>Enroll Now</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-16 text-center space-y-4">
              <BookOpen className="h-12 w-12 text-slate-600 mx-auto" />
              <div>
                {hiddenCount > 0 && !searchQuery && selectedBranch === 'All' && selectedDifficulty === 'All' ? (
                  <>
                    <h3 className="text-base font-bold text-white">No additional published courses to discover</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      All currently published courses are already in your dashboard.
                    </p>
                  </>
                ) : (
                  <>
                    <h3 className="text-base font-bold text-white">No courses match your filters</h3>
                    <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                      Try clearing your search query or adjusting the branch and difficulty filters.
                    </p>
                  </>
                )}
              </div>
              {(searchQuery || selectedBranch !== 'All' || selectedDifficulty !== 'All') && (
                <button
                  onClick={() => {
                    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
                    setSearchQuery('');
                    setSelectedBranch('All');
                    setSelectedDifficulty('All');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#1a2338] text-slate-200 text-xs font-bold transition"
                >
                  Clear Filters
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
