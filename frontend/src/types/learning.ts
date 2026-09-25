/**
 * TypeScript Data Contracts for CogniPath Student Learning Interface
 * Defines models for courses, curriculum hierarchy, AI doubt resolution,
 * and ephemeral video recommendations.
 */

export interface Course {
  id: number;
  code: string;
  title: string;
  description?: string;
  category: string;
  difficulty?: 'Beginner' | 'Intermediate' | 'Advanced';
  thumbnail_url?: string;
  progress_percentage: number;
  next_topic_title?: string;
  category_icon?: 'laptop' | 'database' | 'globe' | 'bot' | 'shield' | 'code';
  accent_color?: string; // hex or tailwind color token
  modules_count?: number;
  topics_count?: number;
}

export interface Topic {
  id: number;
  module_id: number;
  title: string;
  description?: string;
  youtube_url: string;
  youtube_video_id: string;
  order_index: number;
  duration_minutes?: number;
  is_completed?: boolean;
}

export interface ResourceNode {
  id: number;
  module_id: number;
  title: string;
  file_url: string;
  file_type: 'PDF' | 'SLIDES' | 'DOCUMENT';
  page_count?: number;
  view_only: boolean;
}

export interface ModuleExamSummary {
  id: number;
  title: string;
  time_limit_mins: number;
  passing_score: number;
  questions_count: number;
  scope?: string;
}

export interface Module {
  id: number;
  course_id: number;
  title: string;
  description?: string;
  order_index: number;
  topics: Topic[];
  resources: ResourceNode[];
  has_module_exam: boolean;
  module_exam_id?: number | null;
  module_exam?: ModuleExamSummary | null;
  is_completed?: boolean;
  progress_percentage?: number;
}

export interface CourseHierarchy {
  id: number;
  code: string;
  title: string;
  description?: string;
  category: string;
  difficulty: string;
  modules: Module[];
}

export interface CitationRef {
  source_title: string;
  page_or_chunk: string;
  snippet: string;
  similarity_score: number;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'cogni';
  text: string;
  timestamp: string;
  citations?: CitationRef[];
  timestamps_referenced?: Array<{
    time_seconds: number;
    time_formatted: string;
    label: string;
  }>;
  suggested_video?: SupplementaryVideo | null;
  highlighted_excerpt?: string;
}

export interface SupplementaryVideo {
  title: string;
  youtube_video_id: string;
  embed_url: string;
  channel?: string;
  duration?: string;
  relevance_reason: string;
  timestamp_anchor?: number;
}

export interface RecommendedTopic {
  id: string;
  topic_title: string;
  course_id: number;
  course_title: string;
  category: string;
  reason: string;
  difficulty: 'Beginner' | 'Intermediate' | 'Advanced';
  target_module_id?: number;
  target_topic_id?: number;
}
