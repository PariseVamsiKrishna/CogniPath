import React from 'react';
import {
  ArrowRight,
  Star,
  Sparkles,
  BookOpen,
  Plus
} from 'lucide-react';
import JourneyTrackCard from './JourneyTrackCard';
import RecommendationCard from './RecommendationCard';

// Default / fallback recommendations curated with Cogni Intelligence reasoning
const DEFAULT_RECOMMENDATIONS = [
  {
    id: 'rec_1',
    topic_title: 'Recursion Call Stacks & Invariants',
    course_id: 1,
    course_title: 'Data Structures and Algorithms',
    category: 'DSA',
    difficulty: 'Intermediate',
    reason: 'Identified conceptual gap from your recent Binary Trees diagnostic assessment.'
  },
  {
    id: 'rec_2',
    topic_title: 'Relational SQL Joins & Query Plans',
    course_id: 2,
    course_title: 'Database Management Systems',
    category: 'DBMS',
    difficulty: 'Beginner',
    reason: 'Recommended prerequisite before entering the 3NF Normalization module.'
  },
  {
    id: 'rec_3',
    topic_title: 'Asynchronous JavaScript & Event Loops',
    course_id: 3,
    course_title: 'Web Development Fundamentals',
    category: 'Web Dev',
    difficulty: 'Advanced',
    reason: 'High-frequency engineering interview concept aligned with your milestone progress.'
  }
];

export default function EnrolledCoursesGrid({
  courses = [],
  allCourses = [],
  onSelectCourse,
  onOpenExploreCatalog,
  onOpenCreateCourse,
  onOpenRateModal,
  onDeleteCourse,
  onSelectRecommendedTopic,
  user
}) {
  const isEducator = user?.role === 'EDUCATOR';
  const createdCourses = (allCourses && allCourses.length > 0 ? allCourses : courses).filter(
    (c) => c.educator_id === user?.id
  );

  return (
    <div className="min-h-full ambient-canvas p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-10">
      {/* ===================================================================== */}
      {/* SECTION 0: MY CREATED COURSES (EDUCATOR ONLY)                         */}
      {/* ===================================================================== */}
      {isEducator && (
        <section className="space-y-5">
          <div className="flex items-center justify-between border-b border-[#262C4C] pb-4">
            <div>
              <h2 className="font-heading text-xl font-bold text-[#ECEDF7] tracking-tight flex items-center gap-2">
                <span>My Created Courses</span>
                <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30">
                  Creator
                </span>
              </h2>
              <p className="text-xs text-[#8A90B4] mt-1">Courses you have created and are managing</p>
            </div>
            {onOpenCreateCourse && (
              <button onClick={onOpenCreateCourse} className="px-4 py-2 rounded-full bg-gradient-to-r from-[#FF9933] to-[#FFC15E] hover:opacity-90 text-[#0A0D1C] font-bold text-xs flex items-center gap-2 transition shadow-md">
                <Plus className="h-3.5 w-3.5" />
                Create New Course
              </button>
            )}
          </div>
          {createdCourses.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
              {createdCourses.map((course, idx) => (
                <JourneyTrackCard
                  key={course.id || idx}
                  course={course}
                  index={idx}
                  onSelectCourse={onSelectCourse}
                  onOpenRateModal={onOpenRateModal}
                  onDeleteCourse={onDeleteCourse}
                  user={user}
                />
              ))}
            </div>
          ) : (
            <div className="p-8 rounded-2xl bg-[#12162B] border border-[#262C4C] text-center space-y-4">
              <div className="h-14 w-14 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center mx-auto">
                <BookOpen className="h-7 w-7 text-amber-400" />
              </div>
              <div>
                <h3 className="font-heading text-base font-bold text-[#ECEDF7]">No courses created yet</h3>
                <p className="text-xs text-[#8A90B4] mt-1">Create your first course to get started</p>
              </div>
              {onOpenCreateCourse && (
                <button onClick={onOpenCreateCourse} className="px-5 py-2 rounded-full bg-amber-500 hover:bg-amber-400 text-[#0A0D1C] font-bold text-xs transition">
                  Create First Course
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {/* ===================================================================== */}
      {/* SECTION 1: CONTINUE LEARNING HEADER & JOURNEY TRACK CARD GRID         */}
      {/* ===================================================================== */}
      <section className="space-y-6">
        {/* Header Ribbon */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#262C4C] pb-5">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-[#ECEDF7] tracking-tight">
              Continue Learning
            </h1>
            <p className="text-xs sm:text-sm text-[#8A90B4] font-medium mt-1">
              Your personalized curriculum journey map. Track milestone progress and prepare for assessments.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* STRICT ROLE GATING: Only educators can create courses */}
            {isEducator && onOpenCreateCourse && (
              <button
                type="button"
                onClick={onOpenCreateCourse}
                className="px-4 py-2 rounded-full bg-[#171C36] hover:bg-[#262C4C] text-[#ECEDF7] text-xs font-bold transition border border-[#262C4C] flex items-center gap-2 shrink-0 shadow-sm"
                title="Create a new course (Educators only)"
              >
                <Plus className="h-4 w-4 text-[#8B7CFF]" />
                <span>+ New Course</span>
              </button>
            )}

            {/* Find New Courses CTA */}
            <button
              type="button"
              onClick={onOpenExploreCatalog}
              className="px-5 py-2.5 rounded-full bg-gradient-to-r from-[#8B7CFF] to-[#FF6F9C] hover:from-[#9d91ff] hover:to-[#ff8cb1] text-[#0A0D1C] text-xs font-bold transition shadow-[0_4px_16px_rgba(139,124,255,0.3)] flex items-center gap-2 group shrink-0"
              title="Browse the complete course catalog"
            >
              <span>Find New Courses</span>
              <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>

        {/* Elevated Journey Track Cards Grid (Stacks to single column on mobile) */}
        {courses && courses.length > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {courses.map((course, idx) => (
              <JourneyTrackCard
                key={course.id}
                course={course}
                index={idx}
                onSelectCourse={onSelectCourse}
                onOpenRateModal={onOpenRateModal}
                onDeleteCourse={user?.role === 'ADMIN' || course.educator_id === user?.id ? onDeleteCourse : (user?.role === 'STUDENT' ? onDeleteCourse : null)}
                user={user}
              />
            ))}
          </div>
        ) : (
          <div
            style={{ boxShadow: '0 18px 34px -18px rgba(0,0,0,0.55)' }}
            className="p-12 text-center rounded-2xl bg-[#12162B] border border-[#262C4C] space-y-4"
          >
            <BookOpen className="h-12 w-12 text-[#8A90B4] mx-auto" />
            <div>
              <h3 className="font-heading text-base font-bold text-[#ECEDF7]">No Enrolled Courses Found</h3>
              <p className="text-xs text-[#8A90B4] mt-1 max-w-sm mx-auto">
                Explore our catalog of verified engineering courses and begin your learning path.
              </p>
            </div>
            <button
              type="button"
              onClick={onOpenExploreCatalog}
              className="px-5 py-2.5 rounded-full bg-[#8B7CFF] text-[#0A0D1C] text-xs font-bold transition hover:bg-[#9d91ff]"
            >
              Browse Course Catalog
            </button>
          </div>
        )}
      </section>

      {/* ===================================================================== */}
      {/* SECTION 2: "⭐ RECOMMENDED FOR YOU" COGNI INTELLIGENCE STRIP          */}
      {/* ===================================================================== */}
      <section className="space-y-4 pt-2">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-[#FFC15E]/15 border border-[#FFC15E]/30 flex items-center justify-center text-[#FFC15E] shrink-0">
            <Star className="h-4 w-4 fill-[#FFC15E] text-[#FFC15E]" />
          </div>
          <div>
            <h2 className="font-heading text-lg font-bold text-[#ECEDF7] tracking-tight flex items-center gap-2.5">
              <span>Recommended for You</span>
              {/* Cogni Intelligence Gradient Badge */}
              <span className="text-[10px] uppercase font-extrabold px-3 py-0.5 rounded-full bg-gradient-to-r from-[#8B7CFF]/25 to-[#FF6F9C]/25 text-[#ECEDF7] border border-[#8B7CFF]/40 shadow-sm flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-[#FF6F9C]" />
                <span>Cogni Intelligence</span>
              </span>
            </h2>
            <p className="text-xs text-[#8A90B4]">
              Topics recommended by AI based on your diagnostic performance and curriculum milestones.
            </p>
          </div>
        </div>

        {/* 3-Column Grid stacking to single column on mobile */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {DEFAULT_RECOMMENDATIONS.map((rec) => (
            <RecommendationCard
              key={rec.id}
              recommendation={rec}
              onStartLearning={(item) => {
                if (onSelectRecommendedTopic) {
                  onSelectRecommendedTopic(item);
                } else if (onSelectCourse) {
                  onSelectCourse(item.course_id);
                }
              }}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
