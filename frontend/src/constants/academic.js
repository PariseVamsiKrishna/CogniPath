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

  let candidateUrl = cleaned;
  if (!/^https?:\/\//i.test(candidateUrl)) {
    if (/^(?:(?:www|m|music)\.)?(?:youtube(?:-nocookie)?\.com|youtu\.be)\//i.test(candidateUrl)) {
      candidateUrl = `https://${candidateUrl}`;
    } else {
      return null;
    }
  }

  try {
    const parsed = new URL(candidateUrl);
    const host = parsed.hostname.toLowerCase();
    const validYoutubeHosts = new Set([
      'youtube.com',
      'www.youtube.com',
      'm.youtube.com',
      'music.youtube.com',
      'youtube-nocookie.com',
      'www.youtube-nocookie.com',
    ]);

    if (host === 'youtu.be' || host === 'www.youtu.be') {
      const segments = parsed.pathname.split('/').filter(Boolean);
      if (segments.length !== 1) return null;
      const vid = segments[0];
      return /^[a-zA-Z0-9_-]{11}$/.test(vid) ? vid : null;
    }

    if (!validYoutubeHosts.has(host)) {
      return null;
    }

    if (parsed.pathname === '/watch' || parsed.pathname === '/watch/') {
      const vParam = parsed.searchParams.get('v');
      if (vParam && /^[a-zA-Z0-9_-]{11}$/.test(vParam)) {
        return vParam;
      }
      return null;
    }

    const segments = parsed.pathname.split('/').filter(Boolean);
    if (segments.length === 2 && ['embed', 'shorts', 'v', 'e', 'live'].includes(segments[0])) {
      const vid = segments[1];
      if (/^[a-zA-Z0-9_-]{11}$/.test(vid)) {
        return vid;
      }
    }
  } catch {
    return null;
  }

  return null;
}

