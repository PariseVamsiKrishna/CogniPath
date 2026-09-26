import axios from 'axios';

const rawBase = (import.meta.env.VITE_API_BASE_URL || '').trim();
const cleanBase = rawBase.replace(/\/+$/, '').replace(/\/api\/v1\/?$/, '');
const API_BASE_URL = cleanBase ? `${cleanBase}/api/v1` : '/api/v1';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000,
});

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
      localStorage.removeItem('cognipath_token');
      localStorage.removeItem('cognipath_user');
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  login: async (email, password) => {
    const res = await apiClient.post('/auth/login-json', { email, password });
    if (res.data && res.data.access_token) {
      localStorage.setItem('cognipath_token', res.data.access_token);
      localStorage.setItem('cognipath_user', JSON.stringify(res.data.user || res.data));
    }
    return res.data;
  },
  register: async (userData) => {
    const res = await apiClient.post('/auth/register', userData);
    if (res.data && res.data.access_token) {
      localStorage.setItem('cognipath_token', res.data.access_token);
      localStorage.setItem('cognipath_user', JSON.stringify(res.data.user || res.data));
    }
    return res.data;
  },
  getMe: async () => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
  updateProfile: async (profileData) => {
    try {
      const res = await apiClient.put('/auth/profile', profileData);
      if (res.data) {
        localStorage.setItem('cognipath_user', JSON.stringify(res.data));
      }
      return res.data;
    } catch (err) {
      if (err.response?.status === 404 || err.response?.status === 405) {
        const res2 = await apiClient.post('/auth/onboarding', profileData);
        if (res2.data) {
          localStorage.setItem('cognipath_user', JSON.stringify(res2.data));
        }
        return res2.data;
      }
      throw err;
    }
  },
  logout: () => {
    localStorage.removeItem('cognipath_token');
    localStorage.removeItem('cognipath_user');
  }
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
  create: async (examData) => {
    const res = await apiClient.post('/exams', examData);
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
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  listByCourse: async (courseId) => {
    const res = await apiClient.get(`/documents/course/${courseId}`);
    return res.data;
  }
};

export const tutorAPI = {
  query: async ({ course_id, module_id = null, topic_id = null, query, target_language = 'en', audio_base64 = null }) => {
    const res = await apiClient.post('/tutor/query', {
      course_id,
      module_id,
      topic_id,
      query,
      target_language,
      audio_base64
    });
    return res.data;
  },
  suggestVideo: async ({ course_id = null, module_id = null, topic, query = null }) => {
    const res = await apiClient.post('/tutor/suggest-video', {
      course_id,
      module_id,
      topic,
      query
    });
    return res.data;
  },
  getLanguages: async () => {
    const res = await apiClient.get('/tutor/languages');
    return res.data;
  }
};

export const quizzesAPI = {
  generate: async (courseId, topic) => {
    const res = await apiClient.post(`/quizzes/generate?course_id=${courseId}&topic=${encodeURIComponent(topic)}`);
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
  getOverview: async () => {
    const res = await apiClient.get('/analytics/educator/overview');
    return res.data;
  },
  getStudentOverview: async () => {
    const res = await apiClient.get('/analytics/student/overview');
    return res.data;
  },
  getAtRiskStudents: async () => {
    const res = await apiClient.get('/analytics/educator/at-risk');
    return res.data;
  },
  intervene: async (studentId, note) => {
    const res = await apiClient.post(`/analytics/educator/intervene/${studentId}?custom_note=${encodeURIComponent(note)}`);
    return res.data;
  }
};

export const podsAPI = {
  list: async (courseId) => {
    const res = await apiClient.get(`/pods?course_id=${courseId}`);
    return res.data;
  },
  create: async (data) => {
    const res = await apiClient.post('/pods', data);
    return res.data;
  },
  get: async (id) => {
    const res = await apiClient.get(`/pods/${id}`);
    return res.data;
  },
  getMessages: async (podId) => {
    const res = await apiClient.get(`/pods/${podId}/messages`);
    return res.data;
  },
  verifyPasscode: async (podId, passcode) => {
    const res = await apiClient.post(`/pods/${podId}/verify-passcode`, { passcode });
    return res.data;
  },
  getQuota: async () => {
    const res = await apiClient.get('/pods/educator/quota');
    return res.data;
  },
  endPod: async (podId, reason = 'Host terminated session') => {
    const res = await apiClient.post(`/pods/${podId}/end`, { reason });
    return res.data;
  },
  getKshetraMeta: async (code) => {
    const res = await apiClient.get(`/pods/kshetra-meta/${encodeURIComponent(code)}`);
    return res.data;
  },
  getKshetraEmbedUrl: (code) => {
    return `/api/v1/pods/kshetra-embed/${encodeURIComponent(code)}`;
  }
};

export const communitiesAPI = {
  listChannels: async (courseId) => {
    const res = await apiClient.get(`/communities/courses/${courseId}/channels`);
    return res.data;
  },
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
  }
};

export const socraticAPI = {
  query: async ({ course_id, query, student_attempt = null, target_language = 'en' }) => {
    const res = await apiClient.post('/socratic/query', {
      course_id,
      query,
      student_attempt,
      target_language
    });
    return res.data;
  },
  getMindmap: async (topic) => {
    const res = await apiClient.get(`/socratic/mindmap?topic=${encodeURIComponent(topic)}`);
    return res.data;
  }
};

export const roadmapAPI = {
  get: async (courseId = 1) => {
    const res = await apiClient.get(`/roadmap?course_id=${courseId}`);
    return res.data;
  },
  completeAction: async (actionId) => {
    const res = await apiClient.post(`/roadmap/complete-action/${actionId}`);
    return res.data;
  }
};

export const curriculumAuditAPI = {
  getAudit: async (courseId = 1) => {
    const res = await apiClient.get(`/curriculum-audit?course_id=${courseId}`);
    return res.data;
  },
  generateBloomsQuiz: async (topic = 'Binary Search Trees') => {
    const res = await apiClient.get(`/curriculum-audit/blooms-quiz?topic=${encodeURIComponent(topic)}`);
    return res.data;
  }
};

export default apiClient;
