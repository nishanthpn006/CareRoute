import { firebaseAuth } from './firebase.js';

const rawBaseUrl = import.meta.env.VITE_API_BASE_URL;
const API_BASE_URL = (rawBaseUrl && rawBaseUrl !== 'http://localhost:4000' && rawBaseUrl !== 'http://127.0.0.1:4000')
  ? rawBaseUrl.replace(/\/$/, '')
  : '';
let sessionToken = localStorage.getItem('careroute_session_token') || '';

export function setSessionToken(token) {
  sessionToken = token || '';
  if (sessionToken) localStorage.setItem('careroute_session_token', sessionToken);
  else localStorage.removeItem('careroute_session_token');
}

export async function apiRequest(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  let token = sessionToken;
  if (import.meta.env.VITE_DATA_MODE === 'firebase' && firebaseAuth?.currentUser) {
    token = await firebaseAuth.currentUser.getIdToken();
    setSessionToken(token);
  }
  if (token && options.auth !== false) headers.Authorization = `Bearer ${token}`;
  const { auth: ignoredAuth, ...fetchOptions } = options;
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers,
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = Array.isArray(body.details) ? ` ${body.details.join(' ')}` : '';
    throw new Error(`${body.error || 'Request failed.'}${detail}`);
  }
  return body;
}
