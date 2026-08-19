import type {
  AdminStudent,
  ApiResponse,
  AuthResponse,
  Category,
  CloudinaryImportPayload,
  Dashboard,
  EnglishSkill,
  GoogleBookImport,
  OpenLibraryBook,
  OpenLibraryImportPayload,
  YouTubeVideoImport,
  Level,
  LevelPayload,
  PagedResponse,
  FileUploadResponse,
  ResourceDetail,
  ResourcePayload,
  ResourceSummary,
  SendNotificationPayload,
  Subject,
  SubjectPayload,
} from '../types/api';

const configuredBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined;
const TOKEN_KEY = 'edureach_admin_token';
const REFRESH_TOKEN_KEY = 'edureach_admin_refresh_token';
const PROFILE_KEY = 'edureach_admin_profile';

type ApiRequestOptions = RequestInit & {
  skipAuth?: boolean;
  skipRefresh?: boolean;
};

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function normalizeApiBaseUrl(value?: string) {
  const baseUrl = (value || '').trim().replace(/\/+$/, '');
  if (!baseUrl) return '';
  return baseUrl.endsWith('/api/v1') ? baseUrl : `${baseUrl}/api/v1`;
}

function getApiBaseUrls() {
  const configured = normalizeApiBaseUrl(configuredBaseUrl);
  if (!import.meta.env.DEV) return unique([configured]);

  return unique([
    configured,
    'http://localhost:2377/api/v1',
    'http://127.0.0.1:2377/api/v1',
  ]);
}

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

function getRefreshToken() {
  return localStorage.getItem(REFRESH_TOKEN_KEY);
}

export function getProfile(): AuthResponse | null {
  const raw = localStorage.getItem(PROFILE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthResponse;
  } catch {
    return null;
  }
}

export function saveSession(profile: AuthResponse) {
  const token = profile.accessToken || profile.token;
  if (!token) throw new Error('Login did not return an access token.');
  localStorage.setItem(TOKEN_KEY, token);
  if (profile.refreshToken) localStorage.setItem(REFRESH_TOKEN_KEY, profile.refreshToken);
  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(PROFILE_KEY);
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  for (const baseUrl of getApiBaseUrls()) {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      continue;
    }

    let body: ApiResponse<AuthResponse> | null = null;
    try {
      body = (await response.json()) as ApiResponse<AuthResponse>;
    } catch {
      body = null;
    }

    if (!response.ok || body?.success === false || !body?.data?.accessToken) {
      continue;
    }

    const current = getProfile();
    const nextProfile = { ...(current || body.data), ...body.data };
    saveSession(nextProfile);
    return true;
  }

  return false;
}

async function request<T>(
  path: string,
  options: ApiRequestOptions = {},
  hasRetried = false,
): Promise<T> {
  const { skipAuth = false, skipRefresh = false, ...fetchOptions } = options;
  const token = skipAuth ? null : getToken();
  const headers = new Headers(fetchOptions.headers);
  const isFormData = fetchOptions.body instanceof FormData;
  if (!isFormData) headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const bases = getApiBaseUrls();
  if (bases.length === 0) {
    throw new Error(
      'The admin API URL is not configured. Set VITE_API_BASE_URL and rebuild the dashboard.',
    );
  }
  const failedBases: string[] = [];

  for (const baseUrl of bases) {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, { ...fetchOptions, headers });
    } catch {
      failedBases.push(baseUrl);
      continue;
    }

    let body: ApiResponse<T> | null = null;
    try {
      body = (await response.json()) as ApiResponse<T>;
    } catch {
      body = null;
    }

    if (!response.ok || body?.success === false) {
      if (
        (response.status === 401 || response.status === 403) &&
        !skipRefresh &&
        !hasRetried
      ) {
        const refreshed = await refreshAccessToken();
        if (refreshed) return request<T>(path, options, true);
      }
      if (
        (response.status === 401 || response.status === 403) &&
        !skipRefresh
      ) {
        clearSession();
      }
      throw new Error(body?.message || `Request failed with status ${response.status}`);
    }

    return body?.data as T;
  }

  throw new Error(
    `Cannot reach the EduReach backend. Tried: ${failedBases.join(', ')}. Check VITE_API_BASE_URL and the backend status.`,
  );
}

export const api = {
  login: (email: string, password: string) =>
    request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
      skipAuth: true,
      skipRefresh: true,
    }),

  dashboard: () => request<Dashboard>('/admin/dashboard'),
  sendNotification: (payload: SendNotificationPayload) =>
    request<void>('/admin/notifications/send', { method: 'POST', body: JSON.stringify(payload) }),
  searchGoogleBooks: (query: string, maxResults = 10) =>
    request<GoogleBookImport[]>(`/admin/import/google-books/search?query=${encodeURIComponent(query)}&maxResults=${maxResults}`),
  searchYouTubeVideos: (query: string, maxResults = 10) =>
    request<YouTubeVideoImport[]>(`/admin/import/youtube/search?query=${encodeURIComponent(query)}&maxResults=${maxResults}`),
  searchOpenLibrary: (query: string, limit = 10) =>
    request<OpenLibraryBook[]>(`/admin/openlibrary/search?q=${encodeURIComponent(query)}&limit=${limit}`),
  getOpenLibraryByIsbn: (isbn: string) =>
    request<OpenLibraryBook>(`/admin/openlibrary/isbn/${encodeURIComponent(isbn)}`),
  importOpenLibraryBook: (payload: OpenLibraryImportPayload) =>
    request<ResourceDetail>('/admin/openlibrary/import', { method: 'POST', body: JSON.stringify(payload) }),

  resources: (page = 0, size = 20) =>
    request<PagedResponse<ResourceSummary>>(`/resources?page=${page}&size=${size}`),
  adminResources: (page = 0, size = 20, includeInactive = false) =>
    request<PagedResponse<ResourceSummary>>(`/admin/resources?page=${page}&size=${size}&includeInactive=${includeInactive}`),
  resource: (uuid: string) => request<ResourceDetail>(`/resources/${uuid}`),
  createResource: (payload: ResourcePayload) =>
    request<ResourceDetail>('/admin/resources', { method: 'POST', body: JSON.stringify(payload) }),
  updateResource: (uuid: string, payload: ResourcePayload) =>
    request<ResourceDetail>(`/admin/resources/${uuid}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteResource: (uuid: string) => request<void>(`/admin/resources/${uuid}`, { method: 'DELETE' }),
  toggleResource: (uuid: string) => request<void>(`/admin/resources/${uuid}/toggle`, { method: 'PATCH' }),
  uploadFile: (file: File, folder?: string) => {
    const body = new FormData();
    body.append('file', file);
    if (folder) body.append('folder', folder);
    return request<FileUploadResponse>('/admin/upload', { method: 'POST', body });
  },
  importCloudinaryFile: (payload: CloudinaryImportPayload) =>
    request<FileUploadResponse>('/admin/upload/cloudinary/import', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  subjects: () => request<Subject[]>('/subjects'),
  createSubject: (payload: SubjectPayload) =>
    request<Subject>('/admin/subjects', { method: 'POST', body: JSON.stringify(payload) }),
  updateSubject: (uuid: string, payload: SubjectPayload) =>
    request<Subject>(`/admin/subjects/${uuid}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteSubject: (uuid: string) => request<void>(`/admin/subjects/${uuid}`, { method: 'DELETE' }),

  levels: () => request<Level[]>('/levels'),
  englishSkills: () => request<EnglishSkill[]>('/english-skills'),
  createLevel: (payload: LevelPayload) =>
    request<Level>('/admin/levels', { method: 'POST', body: JSON.stringify(payload) }),
  updateLevel: (uuid: string, payload: LevelPayload) =>
    request<Level>(`/admin/levels/${uuid}`, { method: 'PUT', body: JSON.stringify(payload) }),
  deleteLevel: (uuid: string) => request<void>(`/admin/levels/${uuid}`, { method: 'DELETE' }),

  categories: () => request<Category[]>('/resource-categories/list'),
  students: (page = 0, size = 20) =>
    request<PagedResponse<AdminStudent>>(`/admin/students?page=${page}&size=${size}`),
  toggleStudent: (uuid: string) => request<void>(`/admin/students/${uuid}/toggle`, { method: 'PATCH' }),
};
