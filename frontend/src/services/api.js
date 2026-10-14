import axios from 'axios';

const rawBase = ((import.meta.env && (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL)) || '').trim();
const isProd = Boolean(import.meta.env && import.meta.env.PROD);

if (isProd && !rawBase) {
  console.error('[COGNIPATH] CRITICAL CONFIG ERROR: VITE_API_BASE_URL environment variable is not set in production! Ensure VITE_API_BASE_URL is configured on Vercel dashboard to point to your backend API URL.');
}

const cleanBase = rawBase.replace(/\/+$/, '').replace(/\/api\/v1\/?$/, '');
const API_BASE_URL = cleanBase ? `${cleanBase}/api/v1` : '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 60000,
});

// Ping health endpoint on load to wake up cold-start backend (e.g. Render free tier)
try {
  const wakeUrl = cleanBase ? `${cleanBase}/health` : '/health';
  axios.get(wakeUrl, { timeout: 60000 }).catch(() => {
    /* silent wake attempt */
  });
} catch (e) {
  /* ignore */
}

// Request Interceptor: Attach JWT Token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('cognipath_token');
    if (token) {
      if (token.startsWith('local_') || token.startsWith('mock_')) {
        localStorage.removeItem('cognipath_token');
      } else {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Safe GET Retries for Render Cold Starts & Unauthenticated Handling
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const config = error.config;
    if (config) {
      const method = (config.method || 'get').toLowerCase();
      const isSafeMethod = ['get', 'head', 'options'].includes(method);

      // Only retry idempotent GET requests; DO NOT retry mutating requests (POST/PUT/DELETE)
      if (isSafeMethod) {
        config.__retryCount = config.__retryCount || 0;
        const maxRetries = 2;
        const isTimeoutOrNetwork = error.code === 'ECONNABORTED' || !error.response;
        const isColdStartServerError = error.response && [502, 503, 504].includes(error.response.status);

        if ((isTimeoutOrNetwork || isColdStartServerError) && config.__retryCount < maxRetries) {
          config.__retryCount += 1;
          const backoffMs = config.__retryCount * 1500;
          console.warn(`[COGNIPATH API] Retrying ${config.url} (${config.__retryCount}/${maxRetries}) after ${backoffMs}ms due to: ${error.message || error.response?.status}`);
          await new Promise((resolve) => setTimeout(resolve, backoffMs));
          return apiClient(config);
        }
      }
    }

    if (error.response && error.response.status === 401) {
      console.warn('[COGNIPATH API] 401 Unauthorized encountered');
    }
    return Promise.reject(error);
  }
);

// Exports
export const authAPI = {
  login: async (emailOrCredentials, maybePassword) => {
    const payload =
      typeof emailOrCredentials === 'string'
        ? { email: emailOrCredentials, password: maybePassword }
        : emailOrCredentials;
    const res = await apiClient.post('/auth/login-json', payload);
    return res.data;
  },
  register: async (userData) => {
    const res = await apiClient.post('/auth/register', userData);
    return res.data;
  },
  getMe: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
  updateProfile: async (data) => {
    const res = await apiClient.put('/auth/profile', data);
    return res.data;
  },
  logout: () => {
    localStorage.removeItem('cognipath_token');
    localStorage.removeItem('cognipath_user');
  },
};

export function normalizeCourseId(courseId) {
  const raw = typeof courseId === 'object' && courseId !== null ? courseId.id : courseId;
  if (raw == null || raw === '' || typeof raw === 'boolean') return null;
  if (typeof raw === 'number') {
    return Number.isFinite(raw) && Number.isInteger(raw) && raw > 0 ? raw : null;
  }
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (/^\d+$/.test(trimmed)) {
      const num = Number(trimmed);
      return Number.isFinite(num) && Number.isInteger(num) && num > 0 ? num : null;
    }
  }
  return null;
}

export const coursesAPI = {
  list: async () => {
    const res = await apiClient.get('/courses');
    return res.data;
  },
  getEnrolled: async () => {
    const res = await apiClient.get('/courses/enrolled');
    return res.data;
  },
  getMyCourses: async () => {
    const res = await apiClient.get('/courses/my-courses');
    return res.data;
  },
  get: async (id) => {
    const res = await apiClient.get(`/courses/${id}`);
    return res.data;
  },
  getHierarchy: async (courseId) => {
    const res = await apiClient.get(`/courses/${courseId}/hierarchy`);
    return res.data;
  },
  create: async (courseData) => {
    const res = await apiClient.post('/courses', courseData);
    return res.data;
  },
  update: async (courseId, courseData) => {
    const res = await apiClient.put(`/courses/${courseId}`, courseData);
    return res.data;
  },
  publish: async (courseId) => {
    const res = await apiClient.post(`/courses/${courseId}/publish`);
    return res.data;
  },
  unpublish: async (courseId) => {
    const res = await apiClient.post(`/courses/${courseId}/unpublish`);
    return res.data;
  },
  enroll: async (courseId) => {
    const id = normalizeCourseId(courseId);
    if (id === null) {
      throw new Error('A valid positive integer courseId is required to enroll.');
    }
    const res = await apiClient.post(`/courses/${id}/enroll`);
    return res.data;
  },
  unenroll: async (courseId) => {
    const id = normalizeCourseId(courseId);
    if (id === null) {
      throw new Error('A valid positive integer courseId is required to unenroll.');
    }
    const res = await apiClient.post(`/courses/${id}/unenroll`);
    return res.data;
  },
  deleteCourse: async (courseId) => {
    const id = normalizeCourseId(courseId);
    if (id === null) {
      throw new Error('A valid positive integer courseId is required to delete a course.');
    }
    const res = await apiClient.delete(`/courses/${id}`);
    return res.data;
  },
  createModule: async (courseId, moduleData) => {
    const res = await apiClient.post(`/courses/${courseId}/modules`, moduleData);
    return res.data;
  },
  updateModule: async (moduleId, moduleData) => {
    const res = await apiClient.put(`/courses/modules/${moduleId}`, moduleData);
    return res.data;
  },
  reorderModules: async (courseId, moduleIds) => {
    const res = await apiClient.put(`/courses/${courseId}/modules/reorder`, { module_ids: moduleIds });
    return res.data;
  },
  deleteModule: async (moduleId) => {
    const res = await apiClient.delete(`/courses/modules/${moduleId}`);
    return res.data;
  },
  createTopic: async (moduleId, topicData) => {
    const res = await apiClient.post(`/courses/modules/${moduleId}/topics`, topicData);
    return res.data;
  },
  updateTopic: async (topicId, topicData) => {
    const res = await apiClient.put(`/courses/topics/${topicId}`, topicData);
    return res.data;
  },
  reorderTopics: async (moduleId, topicIds) => {
    const res = await apiClient.put(`/courses/modules/${moduleId}/topics/reorder`, { topic_ids: topicIds });
    return res.data;
  },
  deleteTopic: async (topicId) => {
    const res = await apiClient.delete(`/courses/topics/${topicId}`);
    return res.data;
  },
  uploadResource: async (moduleId, formData) => {
    const res = await apiClient.post(`/courses/modules/${moduleId}/resources`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  deleteResource: async (resourceId) => {
    const res = await apiClient.delete(`/courses/resources/${resourceId}`);
    return res.data;
  },
  generateExamRAG: async (moduleId, params = {}) => {
    const res = await apiClient.post(`/courses/modules/${moduleId}/generate-exam-rag`, params);
    return res.data;
  },
  createModuleExam: async (moduleId, examData) => {
    const res = await apiClient.post(`/courses/modules/${moduleId}/exam`, examData);
    return res.data;
  },
  getTabsSummary: async () => {
    const res = await apiClient.get('/courses/tabs-summary');
    return res.data;
  },
  explore: async (params = {}) => {
    const res = await apiClient.get('/courses/explore', { params });
    return res.data;
  },
  rateCourse: async (courseId, ratingData) => {
    const res = await apiClient.post(`/courses/${courseId}/rate`, ratingData);
    return res.data;
  },
  getCourseRatings: async (courseId) => {
    const res = await apiClient.get(`/courses/${courseId}/ratings`);
    return res.data;
  },
  rateTopic: async (topicId, ratingData) => {
    const res = await apiClient.post(`/courses/topics/${topicId}/rate`, ratingData);
    return res.data;
  },
  getTopicRatings: async (topicId) => {
    const res = await apiClient.get(`/courses/topics/${topicId}/ratings`);
    return res.data;
  },
  verifyBadge: async (hash) => {
    const res = await apiClient.get(`/courses/badges/verify/${hash}`);
    return res.data;
  },
  completeTopic: async (topicId, data = { is_completed: true }) => {
    const res = await apiClient.post(`/courses/topics/${topicId}/complete`, data);
    return res.data;
  },
  getCompletedTopics: async (courseId) => {
    const res = await apiClient.get(`/courses/${courseId}/completed-topics`);
    return res.data;
  },
  viewResource: async (resourceId) => {
    const res = await apiClient.get(`/courses/resources/${resourceId}/view`, {
      responseType: 'blob'
    });
    return res.data;
  }
};

export const examsAPI = {
  list: async (courseId) => {
    const res = await apiClient.get(`/exams/course/${courseId}`);
    return res.data;
  },
  create: async (examData) => {
    const res = await apiClient.post('/exams', examData);
    return res.data;
  },
  update: async (examId, examData) => {
    const res = await apiClient.put(`/exams/${examId}`, examData);
    return res.data;
  },
  get: async (examId) => {
    const res = await apiClient.get(`/exams/${examId}`);
    return res.data;
  },
  listByCourse: async (courseId) => {
    const res = await apiClient.get(`/exams/course/${courseId}`);
    return res.data;
  },
  reorder: async (examId, questionOrders) => {
    const res = await apiClient.put(`/exams/${examId}/reorder`, { question_orders: questionOrders });
    return res.data;
  },
  submit: async (examId, responses) => {
    const res = await apiClient.post(`/exams/${examId}/submit`, { responses });
    return res.data;
  },
  suggestAI: async (params) => {
    const res = await apiClient.post('/exams/ai-suggest', params);
    return res.data;
  },
  getStudentBadges: async (studentId) => {
    const res = await apiClient.get(`/exams/badges/student/${studentId}`);
    return res.data;
  }
};

export const assignmentsAPI = {
  list: async (moduleId) => {
    const res = await apiClient.get(`/assignments/module/${moduleId}`);
    return res.data;
  },
  create: async (assignmentData) => {
    const res = await apiClient.post('/assignments', assignmentData);
    return res.data;
  },
  listByModule: async (moduleId) => {
    const res = await apiClient.get(`/assignments/module/${moduleId}`);
    return res.data;
  },
  get: async (assignmentId) => {
    const res = await apiClient.get(`/assignments/${assignmentId}`);
    return res.data;
  },
  submit: async (assignmentId, formData) => {
    const res = await apiClient.post(`/assignments/${assignmentId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  listSubmissions: async (assignmentId) => {
    const res = await apiClient.get(`/assignments/${assignmentId}/submissions`);
    return res.data;
  }
};

export const documentsAPI = {
  upload: async (formData) => {
    const res = await apiClient.post('/documents/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
  list: async (params) => {
    const res = await apiClient.get('/documents', { params });
    return res.data;
  },
  delete: async (id) => {
    const res = await apiClient.delete(`/documents/${id}`);
    return res.data;
  },
};

export const tutorAPI = {
  ask: (data) => apiClient.post('/tutor/query', data),
  query: async (data) => {
    const res = await apiClient.post('/tutor/query', data);
    return res.data;
  },
  suggestVideo: async (data) => {
    const res = await apiClient.post('/tutor/suggest-video', data);
    return res.data;
  },
  getLanguages: async () => {
    const res = await apiClient.get('/tutor/languages');
    return res.data;
  }
};

export const quizzesAPI = {
  generate: async (courseId, topic, force = false) => {
    const res = await apiClient.post(`/quizzes/generate?course_id=${courseId}&topic=${encodeURIComponent(topic)}&force_regenerate=${force}`);
    return res.data;
  },
  submit: async (quizId, answers, qualityRating = null) => {
    const res = await apiClient.post('/quizzes/submit', {
      quiz_id: quizId,
      answers,
      quality_rating: qualityRating
    });
    return res.data;
  },
  getDue: async (courseId) => {
    const res = await apiClient.get(`/quizzes/due?course_id=${courseId}`);
    return res.data;
  }
};

export const analyticsAPI = {
  // Student dashboard
  getStudentOverview: async () => {
    const res = await apiClient.get('/analytics/student/overview');
    return res.data;
  },
  // Alias used in some older components
  getStudentProgress: async () => {
    const res = await apiClient.get('/analytics/student/overview');
    return res.data;
  },
  // Educator dashboard — courseId is optional
  getOverview: async (courseId) => {
    const url = courseId
      ? `/analytics/educator/overview?course_id=${courseId}`
      : '/analytics/educator/overview';
    const res = await apiClient.get(url);
    return res.data;
  },
  // Alias used in some older components
  getEducatorOverview: async (courseId) => {
    const url = courseId
      ? `/analytics/educator/overview?course_id=${courseId}`
      : '/analytics/educator/overview';
    const res = await apiClient.get(url);
    return res.data;
  },
  // Trigger intervention for a specific student
  intervene: async (studentId, note) => {
    const res = await apiClient.post(
      `/analytics/educator/intervene/${studentId}`,
      null,
      { params: { custom_note: note } }
    );
    return res.data;
  },
};

// BUG-F03 fixed: all methods now unwrap res.data
export const podsAPI = {
  list: async (courseId) => {
    const res = await apiClient.get(`/pods?course_id=${courseId}`);
    return res.data;
  },
  get: async (id) => {
    const res = await apiClient.get(`/pods/${id}`);
    return res.data;
  },
  create: async (data) => {
    const res = await apiClient.post('/pods', data);
    return res.data;
  },
  verifyPasscode: async (podId, passcode) => {
    const res = await apiClient.post(`/pods/${podId}/verify-passcode`, { passcode });
    return res.data;
  },
  getMessages: async (podId) => {
    const res = await apiClient.get(`/pods/${podId}/messages`);
    return res.data;
  },
  endPod: async (podId, reason) => {
    const res = await apiClient.post(`/pods/${podId}/end`, { reason });
    return res.data;
  },
  getQuota: async () => {
    const res = await apiClient.get('/pods/educator/quota');
    return res.data;
  },
};

// BUG-F05 fixed: added listMessages alias, upvote, getMembers, kickMember, closeCommunity; unwrap data
export const communitiesAPI = {
  listChannels: async (courseId) => {
    const res = await apiClient.get(`/communities/courses/${courseId}/channels`);
    return res.data;
  },
  getMessages: async (channelId) => {
    const res = await apiClient.get(`/communities/channels/${channelId}/messages`);
    return res.data;
  },
  // Alias so both getMessages and listMessages work
  listMessages: async (channelId) => {
    const res = await apiClient.get(`/communities/channels/${channelId}/messages`);
    return res.data;
  },
  postMessage: async (channelId, content) => {
    const res = await apiClient.post(`/communities/channels/${channelId}/messages`, { content });
    return res.data;
  },
  upvote: async (messageId) => {
    const res = await apiClient.post(`/communities/messages/${messageId}/upvote`);
    return res.data;
  },
  getMembers: async (courseId) => {
    const res = await apiClient.get(`/communities/courses/${courseId}/members`);
    return res.data;
  },
  kickMember: async (courseId, memberId) => {
    const res = await apiClient.delete(`/communities/courses/${courseId}/members/${memberId}`);
    return res.data;
  },
  closeCommunity: async (courseId) => {
    const res = await apiClient.delete(`/communities/courses/${courseId}/close`);
    return res.data;
  },
};

// BUG-F06 fixed: added missing query method; all methods unwrap data
export const socraticAPI = {
  query: async (payload) => {
    const res = await apiClient.post('/socratic/query', payload);
    return res.data;
  },
  getMindmap: async (topic) => {
    const res = await apiClient.get(`/socratic/mindmap?topic=${encodeURIComponent(topic)}`);
    return res.data;
  },
  startSession: async (topic) => {
    const res = await apiClient.post('/socratic/start', { topic });
    return res.data;
  },
  respond: async (sessionId, answer) => {
    const res = await apiClient.post(`/socratic/${sessionId}/respond`, { answer });
    return res.data;
  },
};

// BUG-F04 fixed: get() now passes courseId; returns res.data; added completeAction
export const roadmapAPI = {
  generate: async (goal) => {
    const res = await apiClient.post('/roadmap/generate', { goal });
    return res.data;
  },
  get: async (courseId = 1) => {
    const res = await apiClient.get(`/roadmap?course_id=${courseId}`);
    return res.data;
  },
  completeAction: async (actionId) => {
    const res = await apiClient.post(`/roadmap/complete-action/${actionId}`);
    return res.data;
  },
};

// BUG-F07 fixed: renamed to getAudit, corrected HTTP method to GET, added generateBloomsQuiz
export const curriculumAuditAPI = {
  getAudit: async (courseId = 1) => {
    const res = await apiClient.get(`/curriculum-audit?course_id=${courseId}`);
    return res.data;
  },
  // Alias for backward compatibility
  audit: async (courseId = 1) => {
    const res = await apiClient.get(`/curriculum-audit?course_id=${courseId}`);
    return res.data;
  },
  generateBloomsQuiz: async (topic = 'Binary Search Trees') => {
    const res = await apiClient.get(`/curriculum-audit/blooms-quiz?topic=${encodeURIComponent(topic)}`);
    return res.data;
  },
};



export default apiClient;
