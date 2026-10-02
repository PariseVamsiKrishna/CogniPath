import axios from 'axios';

const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
const isProd = import.meta.env.PROD;

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
  timeout: 30000,
});

// Ping health endpoint on load to wake up cold-start backend (e.g. Render free tier)
try {
  const wakeUrl = cleanBase ? `${cleanBase}/health` : '/health';
  axios.get(wakeUrl, { timeout: 10000 }).catch(() => {
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
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle Unauthenticated
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      console.warn('[COGNIPATH API] 401 Unauthorized encountered');
    }
    return Promise.reject(error);
  }
);

// Exports
export const authAPI = {
  login: (credentials) => apiClient.post('/auth/login', credentials),
  register: (userData) => apiClient.post('/auth/register', userData),
  getMe: () => apiClient.get('/auth/me'),
  updateProfile: (data) => apiClient.put('/auth/profile', data),
};

export const coursesAPI = {
  list: (params) => apiClient.get('/courses', { params }),
  get: (id) => apiClient.get(`/courses/${id}`),
  enroll: (courseId) => apiClient.post(`/courses/${courseId}/enroll`),
  getEnrolled: () => apiClient.get('/courses/enrolled'),
  getHierarchy: (courseId) => apiClient.get(`/courses/${courseId}/hierarchy`),
};

export const documentsAPI = {
  upload: (formData) => apiClient.post('/documents/upload', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  }),
  list: (params) => apiClient.get('/documents', { params }),
  delete: (id) => apiClient.delete(`/documents/${id}`),
};

export const tutorAPI = {
  ask: (data) => apiClient.post('/tutor/ask', data),
};

export const quizzesAPI = {
  generate: (courseId, topic) => apiClient.post(`/quizzes/generate?course_id=${courseId}&topic=${encodeURIComponent(topic)}`),
  submitAttempt: (attemptData) => apiClient.post('/quizzes/attempt', attemptData),
  getDue: (courseId) => apiClient.get(`/quizzes/due?course_id=${courseId}`),
};

export const analyticsAPI = {
  getEducatorOverview: (courseId) => apiClient.get(`/analytics/educator/overview?course_id=${courseId}`),
  getStudentProgress: () => apiClient.get('/analytics/student/progress'),
};

export const podsAPI = {
  list: (courseId) => apiClient.get(`/pods?course_id=${courseId}`),
  get: (id) => apiClient.get(`/pods/${id}`),
  create: (data) => apiClient.post('/pods', data),
  verifyPasscode: (podId, passcode) => apiClient.post(`/pods/${podId}/verify-passcode`, { passcode }),
  getMessages: (podId) => apiClient.get(`/pods/${podId}/messages`),
  endPod: (podId, reason) => apiClient.post(`/pods/${podId}/end`, { reason }),
  getQuota: () => apiClient.get('/pods/educator/quota'),
};

export const communitiesAPI = {
  listChannels: (courseId) => apiClient.get(`/communities/channels?course_id=${courseId}`),
  getMessages: (channelId) => apiClient.get(`/communities/channels/${channelId}/messages`),
  postMessage: (channelId, content) => apiClient.post(`/communities/channels/${channelId}/messages`, { content }),
};

export const socraticAPI = {
  startSession: (topic) => apiClient.post('/socratic/start', { topic }),
  respond: (sessionId, answer) => apiClient.post(`/socratic/${sessionId}/respond`, { answer }),
};

export const roadmapAPI = {
  generate: (goal) => apiClient.post('/roadmap/generate', { goal }),
  get: () => apiClient.get('/roadmap'),
};

export const curriculumAuditAPI = {
  audit: (courseId) => apiClient.post(`/curriculum-audit/${courseId}`),
};

export const examsAPI = {
  list: (courseId) => apiClient.get(`/exams?course_id=${courseId}`),
  get: (id) => apiClient.get(`/exams/${id}`),
  create: (data) => apiClient.post('/exams', data),
  submit: (examId, answers) => apiClient.post(`/exams/${examId}/submit`, { answers }),
};

export const assignmentsAPI = {
  list: (courseId) => apiClient.get(`/assignments?course_id=${courseId}`),
  create: (data) => apiClient.post('/assignments', data),
  submit: (assignmentId, file) => {
    const formData = new FormData();
    formData.append('file', file);
    return apiClient.post(`/assignments/${assignmentId}/submit`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },
};

export default apiClient;
