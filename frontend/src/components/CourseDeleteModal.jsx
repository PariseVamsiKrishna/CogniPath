import React, { useState, useEffect } from 'react';
import { AlertTriangle, Trash2, X, ShieldAlert, CheckCircle2 } from 'lucide-react';

/**
 * CourseDeleteModal
 *
 * Strict confirmation modal requiring the user to type "delete" to proceed.
 * Supports:
 * - Student unenrollment: removes the course and progress from student's account.
 * - Educator permanent deletion: permanently erases the course, syllabus, student enrollments,
 *   and Chroma vectors from CogniPath.
 */
export default function CourseDeleteModal({
  isOpen,
  onClose,
  onConfirm,
  course,
  isEducator = false,
  isCreator = false,
}) {
  const [inputValue, setInputValue] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue('');
      setIsDeleting(false);
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen || !course) return null;

  const isPermanentDelete = isEducator || isCreator;
  const isMatch = inputValue.trim().toLowerCase() === 'delete';

  const handleConfirm = async () => {
    if (!isMatch || isDeleting) return;

    try {
      setIsDeleting(true);
      setErrorMsg(null);
      await onConfirm(course);
      onClose();
    } catch (err) {
      console.error('Delete error:', err);
      setErrorMsg(err.response?.data?.detail || err.message || 'Failed to delete course');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && isMatch && !isDeleting) {
      e.preventDefault();
      handleConfirm();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
      <div
        className="w-full max-w-md bg-[#12162B] border border-[#262C4C] rounded-2xl p-6 shadow-2xl relative space-y-5"
        style={{
          boxShadow: isPermanentDelete
            ? '0 20px 40px -15px rgba(239, 68, 68, 0.3)'
            : '0 20px 40px -15px rgba(245, 158, 11, 0.25)',
        }}
      >
        {/* Close Button */}
        <button
          type="button"
          onClick={onClose}
          disabled={isDeleting}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#171C36] transition"
          title="Close dialog"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Modal Header */}
        <div className="flex items-start gap-3.5">
          <div
            className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 border ${
              isPermanentDelete
                ? 'bg-red-500/15 text-red-400 border-red-500/30'
                : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
            }`}
          >
            {isPermanentDelete ? (
              <Trash2 className="h-5 w-5 stroke-[2.2]" />
            ) : (
              <AlertTriangle className="h-5 w-5 stroke-[2.2]" />
            )}
          </div>
          <div>
            <h3 className="font-heading text-lg font-bold text-[#ECEDF7] leading-tight">
              {isPermanentDelete ? 'Permanently Delete Course' : 'Delete Enrolled Course'}
            </h3>
            <p className="text-xs text-[#8A90B4] mt-1 font-medium">
              {course.code ? `${course.code}: ` : ''}
              <span className="text-[#ECEDF7] font-semibold">{course.title}</span>
            </p>
          </div>
        </div>

        {/* Informational Warning Box */}
        <div
          className={`p-3.5 rounded-xl border text-xs leading-relaxed space-y-1.5 ${
            isPermanentDelete
              ? 'bg-red-950/40 border-red-500/30 text-red-200'
              : 'bg-amber-950/40 border-amber-500/30 text-amber-200'
          }`}
        >
          <div className="flex items-center gap-2 font-bold uppercase tracking-wider text-[10px]">
            <ShieldAlert className="h-3.5 w-3.5 shrink-0" />
            <span>{isPermanentDelete ? 'Permanent Action • Irreversible' : 'Account Progress Removal'}</span>
          </div>
          <p className="text-[11px] opacity-90">
            {isPermanentDelete
              ? 'Deleting as course creator will permanently remove this course, syllabus modules, topics, video materials, student quiz records, and Chroma vector embeddings. It will be lost forever.'
              : 'Removing this course will delete your current completion percentage, milestones, and quiz streak for this curriculum from your account.'}
          </p>
        </div>

        {/* Instruction & Confirmation Input */}
        <div className="space-y-2">
          <label className="block text-xs font-semibold text-[#8A90B4]">
            Type <span className="text-red-400 font-mono font-bold bg-red-500/10 px-1.5 py-0.5 rounded border border-red-500/20">delete</span> below to confirm:
          </label>
          <input
            type="text"
            autoFocus
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isDeleting}
            placeholder='Type "delete"'
            className="w-full bg-[#171C36] border border-[#262C4C] focus:border-red-500/60 rounded-xl px-3.5 py-2.5 text-sm text-[#ECEDF7] placeholder-[#8A90B4]/50 focus:outline-none transition font-mono"
          />
        </div>

        {/* Error message if any */}
        {errorMsg && (
          <div className="p-2.5 rounded-lg bg-red-900/30 border border-red-500/40 text-xs text-red-300">
            {errorMsg}
          </div>
        )}

        {/* Actions Buttons */}
        <div className="pt-2 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isDeleting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8A90B4] hover:text-[#ECEDF7] hover:bg-[#171C36] transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isMatch || isDeleting}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md ${
              isMatch && !isDeleting
                ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/30 cursor-pointer'
                : 'bg-[#171C36] text-[#8A90B4]/40 border border-[#262C4C] cursor-not-allowed opacity-60'
            }`}
          >
            {isDeleting ? (
              <span className="flex items-center gap-2">
                <span className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </span>
            ) : (
              <>
                <Trash2 className="h-3.5 w-3.5" />
                <span>OK, Delete</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
