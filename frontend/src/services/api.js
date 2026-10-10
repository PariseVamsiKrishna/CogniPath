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
  list: async () => {
    const res = await apiClient.get('/courses');
    return res.data;
  },
  getEnrolled: async () => {
    const res = await apiClient.get('/courses/enrolled');
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
  enroll: async (courseId) => {
    const res = await apiClient.post(`/courses/${courseId}/enroll`);
    return res.data;
  },
  unenroll: async (courseId) => {
    const res = await apiClient.post(`/courses/${courseId}/unenroll`);
    return res.data;
  },
  deleteCourse: async (courseId) => {
    const res = await apiClient.delete(`/courses/${courseId}`);
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
  listChannels: (courseId) => apiClient.get(`/communities/courses/${courseId}/channels`),
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



export default apiClient;
