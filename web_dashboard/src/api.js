import axios from 'axios'

const API_BASE = import.meta.env?.VITE_API_BASE || 'http://localhost:5001/api'

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 30000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json'
  },
  transformResponse: [(data) => {
    // 确保响应被正确解析为JSON
    if (typeof data === 'string') {
      try {
        return JSON.parse(data)
      } catch (e) {
        console.error('[API] Failed to parse JSON:', e)
        return data
      }
    }
    return data
  }]
})

export const fetchReports = (config = {}) => api.get('/reports', config)
export const fetchReportDetails = (reportId, config = {}) => api.get(`/reports/${reportId}`, config)
export const fetchReportSummary = (reportId, config = {}) => api.get(`/reports/${reportId}/summary`, config)
export const startAnalysis = (code, config = {}) => api.post('/analyze', { code }, config)
export const getAnalysisStatus = (taskId, config = {}) => api.get(`/analyze/${taskId}`, config)
export const deleteReport = (reportId, config = {}) => api.delete(`/reports/${reportId}`, config)
export const aiAnalyze = (reportId, { force = false, aiConfig = null } = {}, config = {}) => api.post('/ai-analyze', { report_id: reportId, force, ai_config: aiConfig }, config)

export default api
