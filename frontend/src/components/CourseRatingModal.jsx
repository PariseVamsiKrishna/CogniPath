import React, { useState, useEffect } from 'react';
import {
  X,
  Star,
  MessageSquare,
  Sparkles,
  CheckCircle2,
  Clock,
  User,
  GraduationCap
} from 'lucide-react';
import { coursesAPI } from '../services/api';

export default function CourseRatingModal({
  isOpen,
  onClose,
  courseId,
  courseTitle = 'Course',
  educatorName = 'Prof. Rajesh Ramanujan',
  onRatingUpdated
}) {
  const [hoverRating, setHoverRating] = useState(0);
  const [selectedRating, setSelectedRating] = useState(5);
  const [reviewText, setReviewText] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [ratingsSummary, setRatingsSummary] = useState(null);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (isOpen && courseId) {
      loadRatings();
    }
  }, [isOpen, courseId]);

  const loadRatings = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const data = await coursesAPI.getCourseRatings(courseId);
      setRatingsSummary(data);
      if (data?.user_rating) {
        setSelectedRating(data.user_rating);
      }
      if (data?.user_review) {
        setReviewText(data.user_review);
      }
    } catch (err) {
      console.error('Failed to load ratings summary:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitRating = async (e) => {
    e.preventDefault();
    if (!selectedRating || selectedRating < 1) {
      setErrorMsg('Please select a star rating (1 to 5 stars).');
      return;
    }

    setSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      await coursesAPI.rateCourse(courseId, {
        rating: selectedRating,
        review: reviewText.trim() || undefined
      });
      setSuccessMsg('Thank you! Your rating has been submitted.');
      await loadRatings();
      if (onRatingUpdated) {
        onRatingUpdated();
      }
      setTimeout(() => {
        setSuccessMsg('');
      }, 3500);
    } catch (err) {
      console.error('Failed to submit course rating:', err);
      setErrorMsg(err.response?.data?.detail || 'Failed to submit rating. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121826] border border-[#1e2638] rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Glow Accent */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-400 via-purple-500 to-indigo-500" />

        {/* Modal Header */}
        <div className="p-6 border-b border-[#1e2638] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <Star className="h-5 w-5 fill-amber-400" />
            </div>
            <div>
              <h2 className="text-lg font-black text-white leading-tight">Rate & Review Course</h2>
              <p className="text-xs text-slate-400 font-medium truncate max-w-md">
                {courseTitle} • <span className="text-indigo-300">Created by {educatorName}</span>
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#1a2338] transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6 flex-1">
          {/* Rating Benchmark Header Card */}
          <div className="rounded-2xl bg-[#0b0f19] border border-[#1e2638] p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="text-3xl font-black text-white flex items-center gap-1.5">
                <span className="text-amber-400">★</span>
                <span>{ratingsSummary ? ratingsSummary.average_rating.toFixed(1) : '4.9'}</span>
              </div>
              <div className="space-y-0.5">
                <div className="text-xs font-bold text-slate-200">Overall Student Rating</div>
                <div className="text-[11px] text-slate-400">
                  Based on {ratingsSummary ? ratingsSummary.total_ratings : '0'} verified student reviews
                </div>
              </div>
            </div>

            <div className="text-xs font-semibold text-indigo-400 bg-indigo-500/10 px-3 py-1.5 rounded-xl border border-indigo-500/20 flex items-center gap-1.5 self-start sm:self-auto">
              <GraduationCap className="h-4 w-4" />
              <span>Verified Educator Curriculum</span>
            </div>
          </div>

          {/* Interactive Rating Form */}
          <form onSubmit={handleSubmitRating} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Your Star Rating <span className="text-rose-400">*</span>
              </label>

              {/* 5-Star Interactive Selector */}
              <div className="flex items-center gap-2">
                {[1, 2, 3, 4, 5].map((starVal) => {
                  const isFilled = (hoverRating || selectedRating) >= starVal;
                  return (
                    <button
                      key={starVal}
                      type="button"
                      onMouseEnter={() => setHoverRating(starVal)}
                      onMouseLeave={() => setHoverRating(0)}
                      onClick={() => setSelectedRating(starVal)}
                      className="p-1.5 rounded-xl hover:scale-110 transition-transform focus:outline-none"
                    >
                      <Star
                        className={`h-7 w-7 transition-colors ${
                          isFilled
                            ? 'text-amber-400 fill-amber-400 filter drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                            : 'text-slate-600 hover:text-slate-400'
                        }`}
                      />
                    </button>
                  );
                })}
                <span className="ml-2 text-sm font-extrabold text-amber-400">
                  {selectedRating} of 5 Stars
                </span>
              </div>
            </div>

            {/* Optional Review Text */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300 block">
                Feedback & Review <span className="text-slate-500 text-[10px] font-normal">(Optional)</span>
              </label>
              <textarea
                value={reviewText}
                onChange={(e) => setReviewText(e.target.value)}
                placeholder="Share your thoughts on lecture clarity, code examples, quizzes, and curriculum structure..."
                rows={3}
                className="w-full rounded-2xl bg-[#0b0f19] border border-[#1e2638] px-4 py-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition"
              />
            </div>

            {/* Status Messages */}
            {successMsg && (
              <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs font-bold">
                {errorMsg}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-[#1a2338] hover:bg-slate-700 text-slate-300 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-400 hover:to-indigo-500 text-white text-xs font-bold transition shadow-lg shadow-indigo-600/25 flex items-center gap-2 disabled:opacity-50"
              >
                {submitting ? (
                  <span>Submitting...</span>
                ) : (
                  <>
                    <Star className="h-3.5 w-3.5 fill-current" />
                    <span>{ratingsSummary?.user_rating ? 'Update Rating' : 'Submit Review'}</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Peer Reviews List */}
          <div className="space-y-3 pt-4 border-t border-[#1e2638]">
            <h3 className="text-xs font-extrabold text-slate-400 uppercase tracking-wider flex items-center gap-2">
              <MessageSquare className="h-3.5 w-3.5" />
              <span>Student Reviews ({ratingsSummary?.reviews?.length || 0})</span>
            </h3>

            {loading ? (
              <div className="py-6 text-center text-slate-500 text-xs font-semibold">
                Loading community reviews...
              </div>
            ) : ratingsSummary?.reviews && ratingsSummary.reviews.length > 0 ? (
              <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                {ratingsSummary.reviews.map((rev) => (
                  <div
                    key={rev.id}
                    className="p-3.5 rounded-2xl bg-[#0b0f19] border border-[#1e2638] space-y-1.5"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center text-[10px] font-bold">
                          {rev.user_name ? rev.user_name.charAt(0).toUpperCase() : 'S'}
                        </div>
                        <span className="text-xs font-bold text-white">{rev.user_name}</span>
                      </div>
                      <div className="flex items-center gap-1 text-amber-400 text-xs font-extrabold">
                        <span>★</span>
                        <span>{rev.rating.toFixed(1)}</span>
                      </div>
                    </div>

                    {rev.review && (
                      <p className="text-xs text-slate-300 leading-relaxed pl-8">
                        {rev.review}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 text-xs font-semibold">
                No reviews yet. Be the first student to review this course!
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
