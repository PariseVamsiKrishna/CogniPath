/**
 * Shared Academic Branches, Difficulty Levels, and YouTube URL Parser
 * Used across AcademicProfileModal, CreateCourseModal, CourseCatalogModal, and CoursePlayer.
 */

export const TARGET_BRANCHES = [
  'All Engineering & Science Branches',
  'Computer Science & Engineering (CSE)',
  'Artificial Intelligence & Machine Learning (AI/ML)',
  'Data Science & Engineering',
  'Information Technology (IT)',
  'Electronics & Communication Engineering (ECE)',
  'Electrical & Electronics Engineering (EEE)',
  'Mechanical Engineering (ME)',
  'Civil Engineering',
  'Cybersecurity & Blockchain',
  'Aerospace & Robotics Engineering',
  'Biotechnology & Bioinformatics',
  'Chemical Engineering',
  'Mathematics & Computing',
];

export const DIFFICULTY_LEVELS = [
  { value: 'Easy', label: 'Easy', badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30' },
  { value: 'Medium', label: 'Medium', badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { value: 'Hard', label: 'Hard', badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
];

export function formatDifficulty(raw) {
  const val = String(raw || '').trim().toLowerCase();
  if (val === 'easy' || val === 'beginner' || val === 'basic' || val === 'introductory') {
    return 'Easy';
  }
  if (val === 'hard' || val === 'advanced' || val === 'expert') {
    return 'Hard';
  }
  return 'Medium';
}

export function getDifficultyBadgeClass(raw) {
  const normalized = formatDifficulty(raw);
  const found = DIFFICULTY_LEVELS.find((d) => d.value === normalized);
  return found ? found.badgeClass : DIFFICULTY_LEVELS[1].badgeClass;
}

/**
 * Extracts a valid 11-character YouTube video ID from:
 * - https://www.youtube.com/watch?v=VIDEO_ID
 * - https://youtu.be/VIDEO_ID
 * - https://www.youtube.com/embed/VIDEO_ID
 * - https://www.youtube.com/shorts/VIDEO_ID
 * - https://www.youtube.com/live/VIDEO_ID
 * - Raw 11-character video ID
 * Returns null if invalid. Never returns a fake or default video ID.
 */
export function extractYoutubeVideoId(url) {
  if (!url || typeof url !== 'string') return null;
  const cleaned = url.trim();
  if (!cleaned) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(cleaned)) {
    return cleaned;
  }

  const patterns = [
    /(?:youtube(?:-nocookie)?\.com\/(?:[^/\n\s]+\/\S+\/|(?:v|e(?:mbed)?|shorts|live)\/|\S*?[?&]v=))([a-zA-Z0-9_-]{11})/,
    /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];

  for (const pattern of patterns) {
    const match = cleaned.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  return null;
}
