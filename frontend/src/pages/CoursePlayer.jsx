import React, { useState, useEffect } from 'react';
import EnrolledCoursesGrid from '../components/EnrolledCoursesGrid';
import CourseWorkspace from '../components/CourseWorkspace';
import CreateCourseModal from '../components/CreateCourseModal';
import CourseCatalogModal from '../components/CourseCatalogModal';
import CourseRatingModal from '../components/CourseRatingModal';

/**
 * CoursePlayer - Redesigned Student Learning Interface
 *
 * Transitions between:
 * - View 1: Enrolled Courses Dashboard (Card Grid, Progress Bars, "Find New Courses ->", "Recommended for You" AI Strip)
 * - View 2: Focused Course Player Workspace (Minimalist Top Bar, Collapsible Tree Navigation, Primary Player, Ephemeral Supplementary Video Player, and Cogni AI Tutor Drawer)
 */
export default function CoursePlayer({
  courseId = null,
  user,
  onNavigateTab,
  courses = [],
  allCourses = [],
  enrolledCourses = [],
  onSelectCourse,
  onRefreshCourses,
  onEnrollCourse,
  onUnenrollCourse
}) {
  const isEducator = user?.role === 'EDUCATOR';

  // Active focused course ID: strictly gate to enrolled courses for students
  const [focusedCourseId, setFocusedCourseId] = useState(() => {
    // Read from URL query param if present
    try {
      const params = new URLSearchParams(window.location.search);
      const qCourseId = params.get('courseId');
      if (qCourseId && !isNaN(Number(qCourseId))) {
        const numId = Number(qCourseId);
        if (isEducator || courses.some((c) => c.id === numId)) {
          return numId;
        }
      }
    } catch (e) {}
    // Only focus if educator or course is in enrolled courses
    if (courseId && (isEducator || courses.some((c) => c.id === Number(courseId)))) {
      return Number(courseId);
    }
    return null;
  });

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showCatalogModal, setShowCatalogModal] = useState(false);
  const [ratingCourse, setRatingCourse] = useState(null);

  // Sync prop changes if parent explicitly changes courseId or courses list updates
  useEffect(() => {
    if (courseId) {
      const numId = Number(courseId);
      if (isEducator || courses.some((c) => c.id === numId)) {
        if (numId !== focusedCourseId) {
          setFocusedCourseId(numId);
        }
      }
    } else if (!isEducator && courses.length === 0 && focusedCourseId) {
      // Student with 0 enrolled courses must never be stuck inside a course workspace
      setFocusedCourseId(null);
    }
  }, [courseId, courses, isEducator, focusedCourseId]);

  // URL Query Param sync
  const updateURL = (cId) => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (cId) {
        params.set('courseId', cId);
      } else {
        params.delete('courseId');
      }
      const newUrl = `${window.location.pathname}?${params.toString()}`;
      window.history.replaceState({}, '', newUrl);
    } catch (e) {}
  };

  const handleSelectCourse = (cId) => {
    setFocusedCourseId(cId);
    if (onSelectCourse) {
      onSelectCourse(cId);
    }
    updateURL(cId);
  };

  const handleBackToCourses = () => {
    setFocusedCourseId(null);
    if (onSelectCourse) {
      onSelectCourse(null);
    }
    updateURL(null);
  };

  const handleCourseCreated = async (newCourse) => {
    setShowCreateModal(false);
    if (onRefreshCourses) {
      await onRefreshCourses();
    }
    if (newCourse?.id) {
      handleSelectCourse(newCourse.id);
    }
  };

  const handleOpenRateModal = (course) => {
    setRatingCourse(course);
  };

  // If a specific course is selected, render View 2: Focused Course Player Workspace
  if (focusedCourseId) {
    const isEnrolledInFocused = isEducator || courses.some((c) => c.id === focusedCourseId);
    return (
      <CourseWorkspace
        courseId={focusedCourseId}
        user={user}
        isEnrolled={isEnrolledInFocused}
        onEnrollCourse={onEnrollCourse}
        onBackToCourses={handleBackToCourses}
        onNavigateTab={onNavigateTab}
        onRefreshCourses={onRefreshCourses}
      />
    );
  }

  // Otherwise, render View 1: Enrolled Courses Dashboard
  return (
    <div className="h-full overflow-y-auto bg-[#0b0f19]">
      <EnrolledCoursesGrid
        courses={courses}
        onSelectCourse={handleSelectCourse}
        onOpenExploreCatalog={() => setShowCatalogModal(true)}
        onOpenCreateCourse={isEducator ? () => setShowCreateModal(true) : undefined}
        onOpenRateModal={handleOpenRateModal}
        onSelectRecommendedTopic={async (rec) => {
          if (!isEducator && !courses.some((c) => c.id === rec.course_id)) {
            if (onEnrollCourse) {
              await onEnrollCourse(rec.course_id);
            }
          }
          handleSelectCourse(rec.course_id);
        }}
        user={user}
      />

      {/* Course Catalog Explorer Modal (Accessible to all students to find courses & search) */}
      <CourseCatalogModal
        isOpen={showCatalogModal}
        onClose={() => setShowCatalogModal(false)}
        onSelectCourse={async (cId) => {
          if (onEnrollCourse) {
            await onEnrollCourse(cId);
          }
          if (onRefreshCourses) await onRefreshCourses();
          handleSelectCourse(cId);
        }}
        user={user}
        onOpenRateModal={handleOpenRateModal}
      />

      {/* Course Rating Modal */}
      {ratingCourse && (
        <CourseRatingModal
          isOpen={Boolean(ratingCourse)}
          onClose={() => setRatingCourse(null)}
          courseId={ratingCourse.id}
          courseTitle={ratingCourse.title}
          educatorName={ratingCourse.educator_name || 'Prof. Rajesh Ramanujan'}
          onRatingUpdated={() => {
            if (onRefreshCourses) onRefreshCourses();
          }}
        />
      )}

      {/* Create Course Modal: STRICTLY GATED TO EDUCATORS */}
      {isEducator && (
        <CreateCourseModal
          isOpen={showCreateModal}
          onClose={() => setShowCreateModal(false)}
          onCourseCreated={handleCourseCreated}
        />
      )}
    </div>
  );
}
