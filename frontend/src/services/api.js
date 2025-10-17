import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8000'

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      const { status, data } = error.response
      const normalized = {
        status,
        code: data?.code ?? 'unknown_error',
        detail: data?.detail ?? 'Unexpected error occurred',
        errors: data?.errors ?? null,
      }
      throw normalized
    }

    throw {
      status: 0,
      code: 'network_error',
      detail: error.message ?? 'Network error occurred',
      errors: null,
    }
  },
)

export function setAuthToken(token) {
  if (!token) {
    delete api.defaults.headers.common.Authorization
    return
  }

  api.defaults.headers.common.Authorization = `Bearer ${token}`
}

export function get(url, config) {
  return api.get(url, config).then((res) => res.data)
}

export function post(url, data, config) {
  return api.post(url, data, config).then((res) => res.data)
}

export function put(url, data, config) {
  return api.put(url, data, config).then((res) => res.data)
}

export function del(url, config) {
  return api.delete(url, config).then((res) => res.data)
}

export default api
