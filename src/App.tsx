import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Bell, BookOpen, CheckCircle2, FileUp, Power, RefreshCcw, Save, Send, Trash2, Video } from 'lucide-react';
import { Shell } from './components/Shell';
import { EmptyState, ErrorState, LoadingState, MetricCard, SectionHeader, formatBytes, formatDate } from './components/ui';
import { api, clearSession, getProfile, saveSession } from './lib/api';
import type { AdminStudent, AuthResponse, Category, Dashboard, GoogleBookImport, OpenLibraryBook, YouTubeVideoImport, EnglishSkill, Level, NotificationType, ResourcePayload, ResourceSummary, SendNotificationPayload, Subject } from './types/api';
import './styles.css';

type View = 'dashboard' | 'resources' | 'students' | 'subjects' | 'levels' | 'notifications';
type ResourceMode = 'books' | 'videos';
type LoadState<T> = { loading: boolean; error: string | null; data: T | null };

const SKILL_CATEGORY_NAMES = new Set(['speaking', 'listening', 'writing', 'reading']);
const BOOK_FILE_TYPES = new Set(['pdf', 'book', 'epub']);
const VIDEO_FILE_TYPES = new Set(['youtube', 'video', 'mp4', 'mov', 'mkv', 'webm']);

const emptyLoad = <T,>(): LoadState<T> => ({ loading: false, error: null, data: null });

function isAdminRole(role?: string) {
  const normalized = (role || '').trim().toUpperCase();
  return normalized === 'ADMIN' || normalized === 'ROLE_ADMIN';
}

function normalizedFileType(fileType?: string) {
  return (fileType || '').trim().toLowerCase();
}

function resourceModeForFileType(fileType?: string): ResourceMode {
  return VIDEO_FILE_TYPES.has(normalizedFileType(fileType)) ? 'videos' : 'books';
}

function uniqueLevels(levels: Level[]) {
  const seen = new Set<string>();
  return levels.filter((level) => {
    const key = `${level.subjectUuid || 'global'}:${level.name.trim().toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function resourceDefaults(base: ResourcePayload, mode: ResourceMode): ResourcePayload {
  return {
    ...base,
    fileType: mode === 'videos' ? 'youtube' : 'pdf',
    fileName: '',
    isDownloadable: mode === 'books',
    author: '',
    language: 'English',
    pageCount: undefined,
    format: mode === 'books' ? 'PDF' : '',
    duration: '',
    channelName: '',
    source: mode === 'videos' ? 'YouTube' : '',
    isFeatured: false,
  };
}

function Login({ onLogin }: { onLogin: (profile: AuthResponse) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const profile = await api.login(email.trim(), password);
      if (!isAdminRole(profile.role)) {
        throw new Error('This account is not an admin account. Use an account with role ADMIN.');
      }
      saveSession(profile);
      onLogin(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not sign in.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="login-page">
      <section className="login-panel">
        <div className="brand-mark large">E</div>
        <h1>EduReach Admin</h1>
        <p>Manage library content, students, subjects, and levels from one focused workspace.</p>
        <form onSubmit={submit} className="form-stack">
          <label>
            <span>Email</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required autoComplete="email" />
          </label>
          <label>
            <span>Password</span>
            <input value={password} onChange={(event) => setPassword(event.target.value)} type="password" required autoComplete="current-password" />
          </label>
          {error && <div className="inline-error">{error}</div>}
          <button className="btn primary full" disabled={loading}>
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>
      </section>
    </main>
  );
}

function DashboardView() {
  const [state, setState] = useState<LoadState<Dashboard>>(emptyLoad);

  const load = useCallback(async () => {
    setState({ loading: true, error: null, data: null });
    try {
      setState({ loading: false, error: null, data: await api.dashboard() });
    } catch (err) {
      setState({ loading: false, error: err instanceof Error ? err.message : 'Dashboard failed.', data: null });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (state.loading) return <LoadingState />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  if (!state.data) return null;

  const dashboard = state.data;
  return (
    <div className="content-stack">
      <div className="metrics-grid">
        <MetricCard label="Students" value={dashboard.totalStudents} />
        <MetricCard label="Resources" value={dashboard.totalResources} tone="mint" />
        <MetricCard label="Subjects" value={dashboard.totalSubjects} tone="amber" />
        <MetricCard label="Downloads" value={dashboard.totalDownloads} tone="blue" />
        <MetricCard label="Bookmarks" value={dashboard.totalBookmarks} tone="violet" />
        <MetricCard label="Ratings" value={dashboard.totalRatings} tone="rose" />
      </div>
      <div className="two-col">
        <ResourceList title="Most Recent Resources" resources={dashboard.mostRecentResources} />
        <ResourceList title="Most Downloaded Resources" resources={dashboard.mostDownloadedResources} />
      </div>
      <section className="panel">
        <SectionHeader title="Recent Students" />
        <StudentTable students={dashboard.recentStudents} compact />
      </section>
    </div>
  );
}

function ResourceList({ title, resources }: { title: string; resources: ResourceSummary[] }) {
  return (
    <section className="panel">
      <SectionHeader title={title} />
      {resources?.length ? (
        <div className="resource-list">
          {resources.map((resource) => (
            <article key={resource.resourceUuid} className="resource-row">
              <div>
                <strong>{resource.title}</strong>
                <span>{resource.subjectName || 'No subject'} / {resource.categoryName || 'No category'}</span>
              </div>
              <small>{resource.fileType || 'file'}</small>
            </article>
          ))}
        </div>
      ) : <EmptyState title="No resources yet" body="New resources will appear here after they are added." />}
    </section>
  );
}

function ResourcesView() {
  const [resources, setResources] = useState<LoadState<ResourceSummary[]>>(emptyLoad);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [englishSkills, setEnglishSkills] = useState<EnglishSkill[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [resourceMode, setResourceMode] = useState<ResourceMode>('books');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [bookQuery, setBookQuery] = useState('');
  const [bookResults, setBookResults] = useState<GoogleBookImport[]>([]);
  const [bookLoading, setBookLoading] = useState(false);
  const [bookError, setBookError] = useState<string | null>(null);
  const [openLibraryQuery, setOpenLibraryQuery] = useState('');
  const [openLibraryResults, setOpenLibraryResults] = useState<OpenLibraryBook[]>([]);
  const [openLibraryLoading, setOpenLibraryLoading] = useState(false);
  const [openLibraryError, setOpenLibraryError] = useState<string | null>(null);
  const [videoQuery, setVideoQuery] = useState('');
  const [videoResults, setVideoResults] = useState<YouTubeVideoImport[]>([]);
  const [videoLoading, setVideoLoading] = useState(false);
  const [videoError, setVideoError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingThumbnail, setUploadingThumbnail] = useState(false);
  const [importingCloudinary, setImportingCloudinary] = useState(false);
  const [cloudinaryInput, setCloudinaryInput] = useState('');
  const [cloudinaryResourceType, setCloudinaryResourceType] = useState('raw');
  const [saving, setSaving] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const blank: ResourcePayload = useMemo(() => ({
    title: '', description: '', subjectUuid: '', categoryUuid: '', levelUuid: '', englishSkillUuid: '', fileUrl: '', fileName: '',
    fileType: 'pdf', thumbnailUrl: '', keywords: '', fileSizeBytes: undefined, storageProvider: undefined, cloudinaryPublicId: undefined, cloudinaryResourceType: undefined, isDownloadable: true, isActive: true,
    author: '', language: 'English', pageCount: undefined, format: 'PDF', duration: '', channelName: '', source: '', isFeatured: false,
    notifyStudents: true, notificationTitle: 'New resource available', notificationBody: '',
  }), []);
  const [form, setForm] = useState<ResourcePayload>(blank);
  const resourceFileType = (form.fileType || '').trim().toLowerCase();
  const supportsBookMetadata = BOOK_FILE_TYPES.has(resourceFileType);
  const supportsVideoMetadata = VIDEO_FILE_TYPES.has(resourceFileType);
  const selectedSubject = subjects.find((subject) => subject.subjectUuid === form.subjectUuid);
  const isEnglishSubject = selectedSubject?.name.trim().toLowerCase() === 'english';
  const levelsForSelectedSubject = form.subjectUuid
    ? levels.filter((level) => !level.subjectUuid || level.subjectUuid === form.subjectUuid)
    : levels;
  const visibleResources = useMemo(
    () => (resources.data || []).filter((resource) => resourceModeForFileType(resource.fileType) === resourceMode),
    [resources.data, resourceMode],
  );
  const bookCount = useMemo(
    () => (resources.data || []).filter((resource) => resourceModeForFileType(resource.fileType) === 'books').length,
    [resources.data],
  );
  const videoCount = useMemo(
    () => (resources.data || []).filter((resource) => resourceModeForFileType(resource.fileType) === 'videos').length,
    [resources.data],
  );
  const modeTitle = resourceMode === 'books' ? 'Book Resource' : 'Video Resource';
  const modeDescription = resourceMode === 'books'
    ? 'Manage PDFs, book previews, literature, and reading materials with book-specific metadata.'
    : 'Manage YouTube lessons and uploaded videos with channel, duration, language, and source fields.';

  function switchResourceMode(mode: ResourceMode) {
    setResourceMode(mode);
    setEditingId(null);
    setMessage(null);
    setUploadError(null);
    setForm(resourceDefaults(blank, mode));
  }

  const load = useCallback(async () => {
    setResources({ loading: true, error: null, data: null });
    try {
      const [firstResourcePage, subjectList, levelList, skillList, categoryList] = await Promise.all([
        api.adminResources(0, 100), api.subjects(), api.levels(), api.englishSkills(), api.categories(),
      ]);
      const allResources = [...firstResourcePage.data];
      for (let page = 1; page < firstResourcePage.totalPages; page += 1) {
        const nextPage = await api.adminResources(page, 100);
        allResources.push(...nextPage.data);
      }
      setSubjects(subjectList);
      setLevels(uniqueLevels(levelList));
      setEnglishSkills(skillList);
      setCategories(categoryList);
      setResources({ loading: false, error: null, data: allResources });
    } catch (err) {
      setResources({ loading: false, error: err instanceof Error ? err.message : 'Resources failed.', data: null });
    }
  }, []);

  useEffect(() => { void load(); }, [load]);


  async function searchGoogleBooks(event: FormEvent) {
    event.preventDefault();
    if (!bookQuery.trim()) return;
    setBookLoading(true);
    setBookError(null);
    try {
      setBookResults(await api.searchGoogleBooks(bookQuery.trim(), 10));
    } catch (err) {
      setBookError(err instanceof Error ? err.message : 'Google Books search failed.');
    } finally {
      setBookLoading(false);
    }
  }

  function useGoogleBook(book: GoogleBookImport) {
    setResourceMode('books');
    setEditingId(null);
    setMessage('Book details copied into the form. Review subject, level, and category before saving.');
    setForm({
      ...blank,
      title: book.title || '',
      description: book.description || '',
      fileUrl: book.previewUrl || book.infoUrl || '',
      fileName: book.title || 'Google Book',
      fileType: 'book',
      thumbnailUrl: book.thumbnailUrl || '',
      keywords: [
        ...(book.authors || []),
        ...(book.categories || []),
        'google-books',
      ].filter(Boolean).join(', '),
      author: book.authors?.join(', ') || '',
      language: book.language || 'English',
      pageCount: book.pageCount,
      format: 'Google Books Preview',
      isDownloadable: false,
      isFeatured: false,
      isActive: true,
    });
  }

  async function searchOpenLibraryBooks(event: FormEvent) {
    event.preventDefault();
    const query = openLibraryQuery.trim();
    if (!query) return;
    setOpenLibraryLoading(true);
    setOpenLibraryError(null);
    try {
      const isIsbn = /^[0-9Xx\-\s]{10,20}$/.test(query);
      if (isIsbn) {
        setOpenLibraryResults([await api.getOpenLibraryByIsbn(query)]);
      } else {
        setOpenLibraryResults(await api.searchOpenLibrary(query, 10));
      }
    } catch (err) {
      setOpenLibraryError(err instanceof Error ? err.message : 'Open Library search failed.');
    } finally {
      setOpenLibraryLoading(false);
    }
  }

  function useOpenLibraryBook(book: OpenLibraryBook) {
    const isbn = book.isbn || '';
    const bookUrl = book.openLibraryKey
      ? 'https://openlibrary.org' + book.openLibraryKey
      : isbn
        ? 'https://openlibrary.org/isbn/' + encodeURIComponent(isbn)
        : 'https://openlibrary.org/search?q=' + encodeURIComponent(book.title || '');

    setResourceMode('books');
    setEditingId(null);
    setMessage('Open Library details copied into the form. Review subject, level, and resource type before saving.');
    setForm({
      ...blank,
      title: book.title || '',
      description: [
        book.subject ? 'Subject: ' + book.subject : '',
        book.publicationYear ? 'First published: ' + book.publicationYear : '',
        isbn ? 'ISBN: ' + isbn : '',
      ].filter(Boolean).join('\n\n'),
      fileUrl: bookUrl,
      fileName: book.title || 'Open Library book',
      fileType: 'book',
      thumbnailUrl: book.coverUrl || '',
      keywords: [book.title, book.author, book.subject, isbn, 'open-library'].filter(Boolean).join(', '),
      author: book.author || '',
      language: 'English',
      pageCount: book.pageCount,
      format: 'Open Library record',
      isDownloadable: false,
      isFeatured: false,
      isActive: true,
    });
  }


  async function searchYouTubeVideos(event: FormEvent) {
    event.preventDefault();
    if (!videoQuery.trim()) return;
    setVideoLoading(true);
    setVideoError(null);
    try {
      setVideoResults(await api.searchYouTubeVideos(videoQuery.trim(), 10));
    } catch (err) {
      setVideoError(err instanceof Error ? err.message : 'YouTube search failed.');
    } finally {
      setVideoLoading(false);
    }
  }

  function useYouTubeVideo(video: YouTubeVideoImport) {
    setResourceMode('videos');
    setEditingId(null);
    setMessage('Video details copied into the form. Review subject, level, and category before saving.');
    setForm({
      ...blank,
      title: video.title || '',
      description: [
        video.description || '',
        video.channelTitle ? 'Channel: ' + video.channelTitle : '',
        video.publishedAt ? 'Published: ' + video.publishedAt.slice(0, 10) : '',
      ].filter(Boolean).join('\n\n'),
      fileUrl: video.videoUrl || (video.videoId ? 'https://www.youtube.com/watch?v=' + video.videoId : ''),
      fileName: video.title || 'YouTube video',
      fileType: 'youtube',
      thumbnailUrl: video.thumbnailUrl || '',
      keywords: [video.channelTitle, video.videoId, 'youtube'].filter(Boolean).join(', '),
      englishSkillUuid: '',
      language: 'English',
      channelName: video.channelTitle || '',
      source: 'YouTube',
      duration: video.duration || '',
      isDownloadable: false,
      isFeatured: false,
      isActive: true,
    });
  }

  async function uploadResourceFile(file: File | null) {
    if (!file) return;
    setUploadError(null);
    setUploading(true);
    try {
      const uploaded = await api.uploadFile(file);
      const uploadedMode = resourceModeForFileType(uploaded.fileType || form.fileType);
      setResourceMode(uploadedMode);
      setForm((current) => ({
        ...current,
        title: current.title || file.name.replace(/\.[^.]+$/, ''),
        fileName: uploaded.fileName || file.name,
        fileUrl: uploaded.fileUrl,
        fileType: uploaded.fileType || current.fileType,
        fileSizeBytes: uploaded.fileSizeBytes,
        storageProvider: uploaded.storageProvider,
        cloudinaryPublicId: uploaded.cloudinaryPublicId,
        cloudinaryResourceType: uploaded.cloudinaryResourceType,
        isDownloadable: uploaded.fileType !== 'youtube' && uploaded.fileType !== 'link',
        ...(uploaded.fileType === 'pdf' || uploaded.fileType === 'book'
          ? {}
          : {
              author: '', pageCount: undefined, format: '', isFeatured: false,
            }),
        ...(uploaded.fileType === 'youtube' || uploaded.fileType === 'video' || uploaded.fileType === 'mp4' || uploaded.fileType === 'mov' || uploaded.fileType === 'mkv' || uploaded.fileType === 'webm'
          ? {
              language: current.language || 'English',
              source: current.source || (uploaded.fileType === 'youtube' ? 'YouTube' : 'Video'),
            }
          : {}),
      }));
      setMessage('File uploaded. Review the resource details before saving.');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'File upload failed.');
    } finally {
      setUploading(false);
    }
  }

  async function uploadThumbnailFile(file: File | null) {
    if (!file) return;
    setUploadError(null);
    setUploadingThumbnail(true);
    try {
      const uploaded = await api.uploadFile(file, 'thumbnails');
      setForm((current) => ({
        ...current,
        thumbnailUrl: uploaded.fileUrl,
      }));
      setMessage('Thumbnail uploaded. Save the resource to keep this thumbnail.');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Thumbnail upload failed.');
    } finally {
      setUploadingThumbnail(false);
    }
  }

  async function importCloudinaryFile() {
    const value = cloudinaryInput.trim();
    if (!value) {
      setUploadError('Enter a Cloudinary URL or public ID first.');
      return;
    }
    setUploadError(null);
    setImportingCloudinary(true);
    try {
      const isUrl = /^https?:\/\//i.test(value);
      const uploaded = await api.importCloudinaryFile({
        fileUrl: isUrl ? value : undefined,
        publicId: isUrl ? undefined : value,
        resourceType: cloudinaryResourceType,
      });
      setForm((current) => ({
        ...current,
        title: current.title || (uploaded.fileName || 'Cloudinary file').replace(/\.[^.]+$/, ''),
        fileName: uploaded.fileName || current.fileName,
        fileUrl: uploaded.fileUrl,
        fileType: uploaded.fileType || current.fileType,
        fileSizeBytes: uploaded.fileSizeBytes,
        storageProvider: uploaded.storageProvider,
        cloudinaryPublicId: uploaded.cloudinaryPublicId,
        cloudinaryResourceType: uploaded.cloudinaryResourceType,
        isDownloadable: uploaded.fileType !== 'youtube' && uploaded.fileType !== 'link',
        ...(uploaded.fileType === 'pdf' || uploaded.fileType === 'book'
          ? { format: current.format || 'PDF' }
          : {}),
      }));
      setMessage('Cloudinary file imported. Review the resource details before saving.');
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Cloudinary import failed.');
    } finally {
      setImportingCloudinary(false);
    }
  }

  async function editResource(resource: ResourceSummary) {
    setMessage(null);
    const detail = await api.resource(resource.resourceUuid);
    const subjectUuid = subjects.find((subject) => subject.name === detail.subjectName)?.subjectUuid || '';
    setResourceMode(resourceModeForFileType(detail.fileType || resource.fileType));
    setEditingId(resource.resourceUuid);
    setForm({
      title: detail.title || '', description: detail.description || '', subjectUuid, categoryUuid: detail.categoryUuid || '',
      levelUuid: detail.levelUuid || '', englishSkillUuid: detail.englishSkillUuid || '', fileUrl: detail.fileUrl || '', fileName: detail.fileName || '',
      fileSizeBytes: detail.fileSizeBytes || undefined, fileType: detail.fileType || 'pdf', thumbnailUrl: detail.thumbnailUrl || '',
      storageProvider: detail.storageProvider, cloudinaryPublicId: detail.cloudinaryPublicId, cloudinaryResourceType: detail.cloudinaryResourceType,
      keywords: detail.keywords || '', isDownloadable: detail.isDownloadable ?? true, isActive: detail.isActive ?? resource.isActive ?? true,
      author: detail.author || '', language: detail.language || 'English',
      pageCount: detail.pageCount, format: detail.format || detail.fileType || 'PDF',
      duration: detail.duration || '', channelName: detail.channelName || '', source: detail.source || '',
      isFeatured: detail.isFeatured ?? false,
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setUploadError(null);
    if (isEnglishSubject && !form.categoryUuid) {
      setUploadError('Choose a resource type for English resources before saving.');
      return;
    }
    const mediaMetadata = supportsBookMetadata
      ? {
          author: form.author || undefined,
          language: form.language || undefined,
          pageCount: form.pageCount || undefined,
          format: form.format || undefined,
          duration: undefined,
          channelName: undefined,
          source: form.source || undefined,
          isFeatured: form.isFeatured ?? false,
        }
      : supportsVideoMetadata
        ? {
            author: undefined,
            language: form.language || 'English',
            pageCount: undefined,
            format: undefined,
            duration: form.duration || undefined,
            channelName: form.channelName || undefined,
            source: form.source || (resourceFileType === 'youtube' ? 'YouTube' : 'Video'),
            isFeatured: form.isFeatured ?? false,
          }
      : {
          author: undefined, language: undefined, pageCount: undefined,
          format: undefined, duration: undefined, channelName: undefined,
          source: form.source || undefined, isFeatured: false,
        };
    const payload = {
      ...form,
      ...mediaMetadata,
      levelUuid: form.levelUuid || undefined,
      categoryUuid: isEnglishSubject ? form.categoryUuid || undefined : undefined,
      englishSkillUuid: isEnglishSubject ? form.englishSkillUuid || undefined : undefined,
      fileSizeBytes: form.fileSizeBytes || undefined,
    };
    setSaving(true);
    try {
      if (editingId) await api.updateResource(editingId, payload);
      else await api.createResource(payload);
      setForm(resourceDefaults(blank, resourceMode));
      setEditingId(null);
      setMessage(editingId ? 'Resource updated.' : 'Resource created.');
      await load();
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Could not save resource.');
    } finally {
      setSaving(false);
    }
  }

  async function remove(uuid: string) {
    if (!confirm('Delete this resource?')) return;
    await api.deleteResource(uuid);
    await load();
  }

  return (
    <div className="content-stack">
      <section className="panel resource-mode-panel">
        <div>
          <span className="eyebrow">Resource management</span>
          <h2>{modeTitle}s</h2>
          <p>{modeDescription}</p>
        </div>
        <div className="resource-mode-switch" role="tablist" aria-label="Resource type">
          <button
            className={resourceMode === 'books' ? 'active' : ''}
            type="button"
            onClick={() => switchResourceMode('books')}
            role="tab"
            aria-selected={resourceMode === 'books'}
          >
            <BookOpen size={18} />
            <span>Books</span>
            <strong>{bookCount}</strong>
          </button>
          <button
            className={resourceMode === 'videos' ? 'active' : ''}
            type="button"
            onClick={() => switchResourceMode('videos')}
            role="tab"
            aria-selected={resourceMode === 'videos'}
          >
            <Video size={18} />
            <span>Videos</span>
            <strong>{videoCount}</strong>
          </button>
        </div>
      </section>
      {resourceMode === 'books' && (
        <>
      <section className="panel">
        <SectionHeader title="Import from Google Books" />
        <form className="import-search" onSubmit={searchGoogleBooks}>
          <label>
            <span>Book search</span>
            <input value={bookQuery} onChange={(e) => setBookQuery(e.target.value)} placeholder="Search by title, author, or subject" />
          </label>
          <button className="btn secondary" disabled={bookLoading}>{bookLoading ? 'Searching...' : 'Search Books'}</button>
        </form>
        {bookError && <div className="inline-error">{bookError}</div>}
        {bookResults.length > 0 && (
          <div className="book-import-grid">
            {bookResults.map((book) => (
              <article className="book-card" key={book.googleVolumeId}>
                {book.thumbnailUrl ? <img src={book.thumbnailUrl} alt="" /> : <div className="book-cover-placeholder">Book</div>}
                <div>
                  <strong>{book.title || 'Untitled book'}</strong>
                  <span>{book.authors?.length ? book.authors.join(', ') : 'Unknown author'}</span>
                  <small>{[book.language?.toUpperCase(), book.pageCount ? String(book.pageCount) + ' pages' : ''].filter(Boolean).join(' / ')}</small>
                  <button className="btn tiny" type="button" onClick={() => useGoogleBook(book)}>Use this book</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      <section className="panel">
        <SectionHeader title="Import from Open Library" />
        <form className="import-search" onSubmit={searchOpenLibraryBooks}>
          <label>
            <span>Book or ISBN search</span>
            <input value={openLibraryQuery} onChange={(e) => setOpenLibraryQuery(e.target.value)} placeholder="Search by title, author, topic, or ISBN" />
          </label>
          <button className="btn secondary" disabled={openLibraryLoading}>{openLibraryLoading ? 'Searching...' : 'Search Open Library'}</button>
        </form>
        {openLibraryError && <div className="inline-error">{openLibraryError}</div>}
        {openLibraryResults.length > 0 && (
          <div className="book-import-grid">
            {openLibraryResults.map((book, index) => (
              <article className="book-card" key={book.isbn || book.openLibraryKey || book.title || index}>
                {book.coverUrl ? <img src={book.coverUrl} alt="" /> : <div className="book-cover-placeholder">Book</div>}
                <div>
                  <strong>{book.title || 'Untitled book'}</strong>
                  <span>{book.author || 'Unknown author'}</span>
                  <small>{[book.publicationYear ? String(book.publicationYear) : '', book.pageCount ? String(book.pageCount) + ' pages' : '', book.isbn ? 'ISBN ' + book.isbn : ''].filter(Boolean).join(' / ')}</small>
                  {book.subject && <small>{book.subject}</small>}
                  <button className="btn tiny" type="button" onClick={() => useOpenLibraryBook(book)}>Use this book</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
        </>
      )}
      {resourceMode === 'videos' && (
      <section className="panel">
        <SectionHeader title="Import from YouTube" />
        <form className="import-search" onSubmit={searchYouTubeVideos}>
          <label>
            <span>Video search</span>
            <input value={videoQuery} onChange={(e) => setVideoQuery(e.target.value)} placeholder="Search lessons, explainers, or channels" />
          </label>
          <button className="btn secondary" disabled={videoLoading}>{videoLoading ? 'Searching...' : 'Search Videos'}</button>
        </form>
        {videoError && <div className="inline-error">{videoError}</div>}
        {videoResults.length > 0 && (
          <div className="video-import-grid">
            {videoResults.map((video) => (
              <article className="video-card" key={video.videoId}>
                {video.thumbnailUrl ? <img src={video.thumbnailUrl} alt="" /> : <div className="video-thumb-placeholder">Video</div>}
                <div>
                  <strong>{video.title || 'Untitled video'}</strong>
                  <span>{video.channelTitle || 'Unknown channel'}</span>
                  <small>{[video.duration, video.publishedAt ? 'Published ' + video.publishedAt.slice(0, 10) : 'YouTube video'].filter(Boolean).join(' / ')}</small>
                  <button className="btn tiny" type="button" onClick={() => useYouTubeVideo(video)}>Use this video</button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
      )}
      <section className="panel">
        <SectionHeader title={editingId ? `Edit ${modeTitle}` : `Add ${modeTitle}`} action={<button className="btn secondary" onClick={() => { setEditingId(null); setForm(resourceDefaults(blank, resourceMode)); }}>Reset</button>} />
        {message && <div className="success-note">{message}</div>}
        <div className="upload-strip">
          <div>
            <strong>Upload local file</strong>
            <span>PDF, image, and video files are stored by the backend and attached to this resource.</span>
          </div>
          <label className="file-upload-btn">
            <FileUp size={18} />
            {uploading ? 'Uploading...' : 'Choose file'}
            <input type="file" disabled={uploading} onChange={(e) => void uploadResourceFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="upload-strip">
          <div>
            <strong>Upload thumbnail</strong>
            <span>Cover and preview images are stored separately in the thumbnails folder.</span>
          </div>
          <label className="file-upload-btn">
            <FileUp size={18} />
            {uploadingThumbnail ? 'Uploading...' : 'Choose thumbnail'}
            <input type="file" accept="image/*" disabled={uploadingThumbnail} onChange={(e) => void uploadThumbnailFile(e.target.files?.[0] || null)} />
          </label>
        </div>
        <div className="upload-strip cloudinary-import">
          <div>
            <strong>Use existing Cloudinary file</strong>
            <span>Paste a Cloudinary URL or public ID. Use raw for PDFs, image for covers, and video for videos.</span>
          </div>
          <div className="cloudinary-import-controls">
            <select value={cloudinaryResourceType} onChange={(e) => setCloudinaryResourceType(e.target.value)}>
              <option value="raw">Raw / PDF</option>
              <option value="image">Image</option>
              <option value="video">Video</option>
            </select>
            <input
              value={cloudinaryInput}
              onChange={(e) => setCloudinaryInput(e.target.value)}
              placeholder="Cloudinary URL or public ID"
            />
            <button className="btn secondary" type="button" disabled={importingCloudinary} onClick={() => void importCloudinaryFile()}>
              {importingCloudinary ? 'Importing...' : 'Import'}
            </button>
          </div>
        </div>
        {uploadError && <div className="inline-error">{uploadError}</div>}
        {form.fileUrl && <div className="file-result"><strong>{form.fileName || 'Uploaded file'}</strong><span>{form.fileType || 'file'} / {formatBytes(form.fileSizeBytes)}{form.storageProvider ? ' / ' + form.storageProvider : ''}</span><small>{form.fileUrl}</small>{form.cloudinaryPublicId && <small>Cloudinary ID: {form.cloudinaryPublicId}</small>}</div>}
        <form onSubmit={submit} className="grid-form">
          <label><span>Title</span><input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} /></label>
          <label><span>File name</span><input required value={form.fileName} onChange={(e) => setForm({ ...form, fileName: e.target.value })} /></label>
          <label><span>Subject</span><select required value={form.subjectUuid} onChange={(e) => {
            const nextSubject = subjects.find((item) => item.subjectUuid === e.target.value);
            const nextIsEnglish = nextSubject?.name.trim().toLowerCase() === 'english';
            setForm({ ...form, subjectUuid: e.target.value, levelUuid: '', englishSkillUuid: nextIsEnglish ? form.englishSkillUuid : '', categoryUuid: nextIsEnglish ? form.categoryUuid : '' });
          }}><option value="">Choose subject</option>{subjects.map((item) => <option key={item.subjectUuid} value={item.subjectUuid}>{item.name}</option>)}</select></label>
          <label><span>Level</span><select value={form.levelUuid} onChange={(e) => setForm({ ...form, levelUuid: e.target.value })}><option value="">No level</option>{levelsForSelectedSubject.map((item) => <option key={item.levelUuid} value={item.levelUuid}>{item.name}</option>)}</select></label>
          {isEnglishSubject && <label><span>English skill</span><select value={form.englishSkillUuid || ''} onChange={(e) => setForm({ ...form, englishSkillUuid: e.target.value })}><option value="">No English skill</option>{englishSkills.map((item) => <option key={item.skillUuid} value={item.skillUuid}>{item.name} - {item.description}</option>)}</select></label>}
          {isEnglishSubject && <label><span>Resource type</span><select required value={form.categoryUuid || ''} onChange={(e) => setForm({ ...form, categoryUuid: e.target.value })}><option value="">Choose resource type</option>{categories.filter((item) => !SKILL_CATEGORY_NAMES.has(item.name.toLowerCase())).map((item) => <option key={item.categoryUuid} value={item.categoryUuid}>{item.name}</option>)}</select></label>}
          <label><span>{resourceMode === 'books' ? 'Book format' : 'Video type'}</span><select value={form.fileType} onChange={(e) => {
            const nextType = e.target.value;
            const normalized = nextType.trim().toLowerCase();
            setForm({
              ...form, fileType: nextType,
              ...(normalized === 'pdf' || normalized === 'book' ? {} : {
                author: '', pageCount: undefined, format: '',
              }),
              ...(['youtube', 'video', 'mp4', 'mov', 'mkv', 'webm'].includes(normalized)
                ? {
                    language: form.language || 'English',
                    source: form.source || (normalized === 'youtube' ? 'YouTube' : 'Video'),
                  }
                : {
                    duration: '',
                    channelName: '',
                  }),
            });
          }}>
            {(resourceMode === 'books' ? ['pdf', 'book', 'epub'] : ['youtube', 'video', 'mp4', 'mov', 'mkv', 'webm']).map((type) => (
              <option key={type} value={type}>{type.toUpperCase()}</option>
            ))}
          </select></label>
          <label className="wide"><span>File URL</span><input required value={form.fileUrl} onChange={(e) => setForm({ ...form, fileUrl: e.target.value })} /></label>
          <label className="wide"><span>Thumbnail URL</span><input value={form.thumbnailUrl} onChange={(e) => setForm({ ...form, thumbnailUrl: e.target.value })} /></label>
          <label><span>File size bytes</span><input type="number" value={form.fileSizeBytes ?? ''} onChange={(e) => setForm({ ...form, fileSizeBytes: e.target.value ? Number(e.target.value) : undefined })} /></label>
          <label><span>Keywords</span><input value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} /></label>
          {supportsBookMetadata ? (<>
            <label><span>Author</span><input value={form.author || ''} onChange={(e) => setForm({ ...form, author: e.target.value })} /></label>
            <label><span>Language</span><input value={form.language || ''} onChange={(e) => setForm({ ...form, language: e.target.value })} /></label>
            <label><span>Page count</span><input type="number" value={form.pageCount ?? ''} onChange={(e) => setForm({ ...form, pageCount: e.target.value ? Number(e.target.value) : undefined })} /></label>
            <label><span>Format</span><input value={form.format || ''} onChange={(e) => setForm({ ...form, format: e.target.value })} placeholder="PDF, EPUB, Book preview" /></label>
          </>) : supportsVideoMetadata ? (<>
            <label><span>Duration</span><input value={form.duration || ''} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="1h 45m, 12:30, or Not set" /></label>
            <label><span>Channel</span><input value={form.channelName || ''} onChange={(e) => setForm({ ...form, channelName: e.target.value })} placeholder="Channel name" /></label>
            <label><span>Language</span><input value={form.language || ''} onChange={(e) => setForm({ ...form, language: e.target.value })} placeholder="English" /></label>
            <label><span>Source</span><input value={form.source || ''} onChange={(e) => setForm({ ...form, source: e.target.value })} placeholder={resourceFileType === 'youtube' ? 'YouTube' : 'Video'} /></label>
          </>) : (
            <div className="metadata-note wide">Book metadata is only used for PDF/book resources. Videos, images, YouTube links, and web links keep their media details in title, description, thumbnail, URL, and keywords.</div>
          )}
          <label className="wide"><span>Description</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="check-row"><input type="checkbox" checked={form.isDownloadable} onChange={(e) => setForm({ ...form, isDownloadable: e.target.checked })} /> Downloadable</label>
          <label className="check-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
          {(supportsBookMetadata || supportsVideoMetadata) && <label className="check-row"><input type="checkbox" checked={form.isFeatured ?? false} onChange={(e) => setForm({ ...form, isFeatured: e.target.checked })} /> Featured resource</label>}
          {!editingId && <div className="wide notification-card">
            <label className="check-row"><input type="checkbox" checked={form.notifyStudents ?? true} onChange={(e) => setForm({ ...form, notifyStudents: e.target.checked })} /> Notify students after publishing this resource</label>
            <p>Students receive this in the app notification list and as a phone notification when push permissions are enabled.</p>
            <label><span>Notification title</span><input value={form.notificationTitle || ''} onChange={(e) => setForm({ ...form, notificationTitle: e.target.value })} placeholder="New resource available" disabled={form.notifyStudents === false} /></label>
            <label><span>Notification message</span><textarea value={form.notificationBody || ''} onChange={(e) => setForm({ ...form, notificationBody: e.target.value })} placeholder="Leave empty to use the resource title automatically." disabled={form.notifyStudents === false} /></label>
          </div>}
          <button className="btn primary" disabled={saving}><Save size={18} />{saving ? 'Saving...' : editingId ? 'Save Resource' : 'Create Resource'}</button>
        </form>
      </section>
      <section className="panel">
        <SectionHeader title={resourceMode === 'books' ? 'Book Library' : 'Video Library'} action={<button className="btn secondary" onClick={load}><RefreshCcw size={16} />Refresh</button>} />
        {resources.loading && <LoadingState label="Loading resources" />}
        {resources.error && <ErrorState message={resources.error} onRetry={load} />}
        {resources.data && visibleResources.length === 0 && (
          <EmptyState
            title={`No ${resourceMode === 'books' ? 'books' : 'videos'} yet`}
            body={`Create or import a ${resourceMode === 'books' ? 'book' : 'video'} resource and it will appear here.`}
          />
        )}
        {resources.data && visibleResources.length > 0 && <div className="table-wrap"><table><thead><tr><th>Title</th><th>Subject</th><th>Level</th><th>Skill</th><th>Type</th><th>Size</th><th>Status</th><th></th></tr></thead><tbody>{visibleResources.map((resource) => <tr key={resource.resourceUuid}><td><strong>{resource.title}</strong><small>{resource.categoryName}</small></td><td>{resource.subjectName || 'Not set'}</td><td>{resource.levelName || 'Not set'}</td><td>{resource.englishSkillName || 'Not set'}</td><td>{resource.fileType || 'file'}</td><td>{formatBytes(resource.fileSizeBytes)}</td><td><span className={resource.isActive === false ? 'badge muted' : 'badge'}>{resource.isActive === false ? 'Inactive' : 'Active'}</span></td><td className="row-actions"><button className="btn tiny" onClick={() => void editResource(resource)}>Edit</button><button className="icon-danger" onClick={() => void remove(resource.resourceUuid)} aria-label="Delete"><Trash2 size={17} /></button></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
}

function StudentsView() {
  const [state, setState] = useState<LoadState<AdminStudent[]>>(emptyLoad);
  const load = useCallback(async () => {
    setState({ loading: true, error: null, data: null });
    try { setState({ loading: false, error: null, data: (await api.students()).data }); }
    catch (err) { setState({ loading: false, error: err instanceof Error ? err.message : 'Students failed.', data: null }); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function toggle(uuid: string) { await api.toggleStudent(uuid); await load(); }
  if (state.loading) return <LoadingState label="Loading students" />;
  if (state.error) return <ErrorState message={state.error} onRetry={load} />;
  return <section className="panel"><SectionHeader title="Students" /><StudentTable students={state.data || []} onToggle={toggle} /></section>;
}

function StudentTable({ students, compact, onToggle }: { students: AdminStudent[]; compact?: boolean; onToggle?: (uuid: string) => void }) {
  if (!students.length) return <EmptyState title="No students yet" body="Students will appear here after registration." />;
  return <div className="table-wrap"><table><thead><tr><th>Name</th><th>Email</th><th>Role</th>{!compact && <th>Joined</th>}{onToggle && <th></th>}</tr></thead><tbody>{students.map((student) => <tr key={student.studentUuid}><td><strong>{student.displayName}</strong></td><td>{student.email}</td><td><span className="badge">{student.role}</span></td>{!compact && <td>{formatDate(student.createdAt)}</td>}{onToggle && <td className="row-actions"><button className="btn tiny" onClick={() => onToggle(student.studentUuid)}><Power size={16} />Toggle</button></td>}</tr>)}</tbody></table></div>;
}

function NotificationsView() {
  const [type, setType] = useState<NotificationType>('ANNOUNCEMENT');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const typeCopy: Record<NotificationType, { label: string; helper: string }> = {
    NEW_RESOURCE: {
      label: 'New resource',
      helper: 'Use this only for manual resource announcements. Normal resource creation can send this automatically.',
    },
    ANNOUNCEMENT: {
      label: 'Announcement',
      helper: 'School-wide news or learning updates. Opens the app notifications screen when tapped.',
    },
    SYSTEM: {
      label: 'System notice',
      helper: 'Maintenance, account, or service notices. Stored in the notifications list.',
    },
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(null);
    setError(null);
    const payload: SendNotificationPayload = {
      title: title.trim(),
      body: body.trim(),
      type,
      sendToAll: true,
      data: { type },
    };
    if (!payload.title || !payload.body) {
      setError('Title and message are required.');
      return;
    }
    setSending(true);
    try {
      await api.sendNotification(payload);
      setTitle('');
      setBody('');
      setMessage('Notification sent to active students.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send notification.');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="content-stack">
      <section className="panel notification-composer">
        <SectionHeader title="Send Notification" />
        <p className="section-copy">Send announcements and system notices to active students. Each message is saved in the app notification center and delivered by push notification when a device token exists.</p>
        {message && <div className="success-note">{message}</div>}
        {error && <div className="inline-error">{error}</div>}
        <form className="grid-form" onSubmit={submit}>
          <label>
            <span>Notification type</span>
            <select value={type} onChange={(event) => setType(event.target.value as NotificationType)}>
              {(Object.keys(typeCopy) as NotificationType[]).map((item) => (
                <option key={item} value={item}>{typeCopy[item].label}</option>
              ))}
            </select>
          </label>
          <div className="metadata-note"><strong>{typeCopy[type].label}</strong><span>{typeCopy[type].helper}</span></div>
          <label className="wide"><span>Title</span><input required value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Short title students can scan" /></label>
          <label className="wide"><span>Message</span><textarea required value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write the notification body" /></label>
          <button className="btn primary" disabled={sending}><Send size={18} />{sending ? 'Sending...' : 'Send Notification'}</button>
        </form>
      </section>
    </div>
  );
}

function SimpleManager({ type }: { type: 'subjects' | 'levels' }) {
  const [items, setItems] = useState<Array<Subject | Level>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', description: '', iconUrl: '', orderIndex: 0, isActive: true });
  const isLevel = type === 'levels';

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setItems(isLevel ? await api.levels() : await api.subjects()); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not load records.'); }
    finally { setLoading(false); }
  }, [isLevel]);
  useEffect(() => { void load(); }, [load]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (isLevel) {
      const payload = { name: form.name, description: form.description, orderIndex: Number(form.orderIndex), isActive: form.isActive };
      editingId ? await api.updateLevel(editingId, payload) : await api.createLevel(payload);
    } else {
      const payload = { name: form.name, description: form.description, iconUrl: form.iconUrl, isActive: form.isActive };
      editingId ? await api.updateSubject(editingId, payload) : await api.createSubject(payload);
    }
    setEditingId(null); setForm({ name: '', description: '', iconUrl: '', orderIndex: 0, isActive: true }); await load();
  }

  async function remove(item: Subject | Level) {
    const uuid = 'levelUuid' in item ? item.levelUuid : item.subjectUuid;
    if (!confirm(`Delete ${item.name}?`)) return;
    isLevel ? await api.deleteLevel(uuid) : await api.deleteSubject(uuid);
    await load();
  }

  return (
    <div className="content-stack">
      <section className="panel">
        <SectionHeader title={editingId ? `Edit ${isLevel ? 'Level' : 'Subject'}` : `Add ${isLevel ? 'Level' : 'Subject'}`} />
        <form className="grid-form compact-form" onSubmit={submit}>
          <label><span>Name</span><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          {isLevel ? <label><span>Order</span><input type="number" required value={form.orderIndex} onChange={(e) => setForm({ ...form, orderIndex: Number(e.target.value) })} /></label> : <label><span>Icon URL</span><input value={form.iconUrl} onChange={(e) => setForm({ ...form, iconUrl: e.target.value })} /></label>}
          <label className="wide"><span>Description</span><textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
          <label className="check-row"><input type="checkbox" checked={form.isActive} onChange={(e) => setForm({ ...form, isActive: e.target.checked })} /> Active</label>
          <button className="btn primary"><CheckCircle2 size={18} />Save</button>
        </form>
      </section>
      <section className="panel">
        <SectionHeader title={isLevel ? 'Levels' : 'Subjects'} />
        {loading && <LoadingState label={`Loading ${type}`} />}
        {error && <ErrorState message={error} onRetry={load} />}
        {!loading && !error && <div className="table-wrap"><table><thead><tr><th>Name</th><th>Description</th>{isLevel && <th>Order</th>}<th></th></tr></thead><tbody>{items.map((item) => { const uuid = 'levelUuid' in item ? item.levelUuid : item.subjectUuid; return <tr key={uuid}><td><strong>{item.name}</strong></td><td>{item.description || 'No description'}</td>{isLevel && <td>{(item as Level).orderIndex}</td>}<td className="row-actions"><button className="btn tiny" onClick={() => { setEditingId(uuid); setForm({ name: item.name, description: item.description || '', iconUrl: 'iconUrl' in item ? item.iconUrl || '' : '', orderIndex: 'orderIndex' in item ? item.orderIndex : 0, isActive: item.isActive ?? true }); }}>Edit</button><button className="icon-danger" onClick={() => void remove(item)}><Trash2 size={17} /></button></td></tr>; })}</tbody></table></div>}
      </section>
    </div>
  );
}

export default function App() {
  const [profile, setProfile] = useState<AuthResponse | null>(() => getProfile());
  const [view, setView] = useState<View>('dashboard');

  if (!profile) return <Login onLogin={setProfile} />;

  return (
    <Shell view={view} onViewChange={setView} profile={profile} onLogout={() => { clearSession(); setProfile(null); }}>
      {view === 'dashboard' && <DashboardView />}
      {view === 'resources' && <ResourcesView />}
      {view === 'students' && <StudentsView />}
      {view === 'subjects' && <SimpleManager type="subjects" />}
      {view === 'levels' && <SimpleManager type="levels" />}
      {view === 'notifications' && <NotificationsView />}
    </Shell>
  );
}



