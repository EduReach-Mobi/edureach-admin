export type ApiResponse<T> = {
  success: boolean;
  message: string;
  data: T;
};

export type PagedResponse<T> = {
  data: T[];
  currentPage: number;
  totalPages: number;
  totalElements: number;
  pageSize: number;
  isLast: boolean;
};

export type AuthResponse = {
  token?: string;
  accessToken?: string;
  refreshToken?: string;
  studentUuid: string;
  displayName: string;
  email: string;
  role?: string;
};

export type Subject = {
  subjectUuid: string;
  name: string;
  description?: string;
  iconUrl?: string;
  isActive?: boolean;
};

export type Level = {
  levelUuid: string;
  name: string;
  description?: string;
  orderIndex: number;
  subjectUuid?: string;
  isActive?: boolean;
};

export type Category = {
  categoryUuid?: string;
  name: string;
  description?: string;
  iconUrl?: string;
  isActive?: boolean;
};

export type ResourceSummary = {
  resourceUuid: string;
  categoryUuid?: string;
  title: string;
  subjectName?: string;
  categoryName?: string;
  fileType?: string;
  fileSizeBytes?: number;
  isDownloadable?: boolean;
  isActive?: boolean;
  thumbnailUrl?: string;
  storageProvider?: string;
  cloudinaryResourceType?: string;
  uploadedAt?: string;
  levelUuid?: string;
  levelName?: string;
  englishSkillUuid?: string;
  englishSkillName?: string;
  englishSkillDescription?: string;
  author?: string;
  language?: string;
  format?: string;
  duration?: string;
  channelName?: string;
  source?: string;
  isFeatured?: boolean;
  notifyStudents?: boolean;
  notificationTitle?: string;
  notificationBody?: string;
};

export type ResourceDetail = ResourceSummary & {
  description?: string;
  fileUrl?: string;
  fileName?: string;
  storageProvider?: string;
  cloudinaryPublicId?: string;
  cloudinaryResourceType?: string;
  keywords?: string;
  downloadCount?: number;
  averageRating?: number;
  totalRatings?: number;
  author?: string;
  language?: string;
  pageCount?: number;
  format?: string;
  duration?: string;
  channelName?: string;
  source?: string;
  isFeatured?: boolean;
};

export type AdminStudent = {
  studentUuid: string;
  displayName: string;
  email: string;
  role: string;
  createdAt?: string;
};

export type Dashboard = {
  totalStudents: number;
  totalResources: number;
  totalSubjects: number;
  totalDownloads: number;
  totalBookmarks: number;
  totalRatings: number;
  mostDownloadedResources: ResourceSummary[];
  mostRecentResources: ResourceSummary[];
  recentStudents: AdminStudent[];
};

export type ResourcePayload = {
  title: string;
  description?: string;
  subjectUuid: string;
  categoryUuid?: string;
  levelUuid?: string;
  englishSkillUuid?: string;
  fileUrl: string;
  fileName: string;
  fileSizeBytes?: number;
  fileType?: string;
  thumbnailUrl?: string;
  storageProvider?: string;
  cloudinaryPublicId?: string;
  cloudinaryResourceType?: string;
  keywords?: string;
  isDownloadable: boolean;
  isActive: boolean;
  author?: string;
  language?: string;
  pageCount?: number;
  format?: string;
  duration?: string;
  channelName?: string;
  source?: string;
  isFeatured?: boolean;
  notifyStudents?: boolean;
  notificationTitle?: string;
  notificationBody?: string;
};

export type SubjectPayload = {
  name: string;
  description?: string;
  iconUrl?: string;
  isActive: boolean;
};

export type LevelPayload = {
  name: string;
  description?: string;
  orderIndex: number;
  isActive: boolean;
};


export type GoogleBookImport = {
  googleVolumeId: string;
  title?: string;
  authors: string[];
  publisher?: string;
  publishedDate?: string;
  description?: string;
  categories: string[];
  isbn13: string[];
  isbn10: string[];
  pageCount?: number;
  format?: string;
  language?: string;
  thumbnailUrl?: string;
  previewUrl?: string;
  infoUrl?: string;
};


export type YouTubeVideoImport = {
  videoId: string;
  title?: string;
  channelTitle?: string;
  channelId?: string;
  duration?: string;
  description?: string;
  publishedAt?: string;
  thumbnailUrl?: string;
  videoUrl: string;
  embedUrl?: string;
};

export type OpenLibraryBook = {
  title?: string;
  author?: string;
  publisher?: string;
  publicationYear?: number;
  isbn?: string;
  coverUrl?: string;
  pageCount?: number;
  subject?: string;
  openLibraryKey?: string;
};

export type OpenLibraryImportPayload = {
  isbn: string;
  subjectUuid: string;
  categoryUuid: string;
  levelUuid?: string;
  fileUrl?: string;
  keywords?: string;
};

export type EnglishSkill = {
  skillUuid: string;
  name: string;
  description?: string;
  orderIndex: number;
  isActive?: boolean;
};

export type FileUploadResponse = {
  fileName: string;
  fileUrl: string;
  fileType: string;
  fileSizeBytes: number;
  folder?: string;
  storageProvider?: string;
  cloudinaryPublicId?: string;
  cloudinaryResourceType?: string;
};

export type CloudinaryImportPayload = {
  fileUrl?: string;
  publicId?: string;
  resourceType?: string;
};

export type NotificationType = 'NEW_RESOURCE' | 'ANNOUNCEMENT' | 'SYSTEM';

export type SendNotificationPayload = {
  title: string;
  body: string;
  type: NotificationType;
  sendToAll?: boolean;
  studentUuid?: string;
  data?: Record<string, string>;
};
