import {
  ExamSettings,
  StudentExamSession,
  EssayRubricScore,
  StudentAnswer,
  TabViolation,
} from '../types/cbt';


// Mode Management (Operational vs Staging)
export function isStagingMode(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mode') === 'staging') return true;
      if (window.location.hash.includes('staging')) return true;
      if (sessionStorage.getItem('cbt_active_mode') === 'staging') return true;
    }
  } catch (_) {}
  return false;
}

export function setStagingMode(enabled: boolean) {
  try {
    if (enabled) {
      sessionStorage.setItem('cbt_active_mode', 'staging');
    } else {
      sessionStorage.removeItem('cbt_active_mode');
    }
  } catch (_) {}
}

export function getApiBase(): string {
  return isStagingMode() ? '/api/staging' : '/api';
}

// Teacher Operator Identity (For multi-teacher independent auditing)
let cachedTeacherOperator = 'Guru Pengawas';

export function setCachedTeacherOperator(operator: string) {
  cachedTeacherOperator = operator;
  try {
    sessionStorage.setItem('cbt_teacher_operator', operator);
  } catch (_) {}
}

export function getCachedTeacherOperator(): string {
  if (cachedTeacherOperator && cachedTeacherOperator !== 'Guru Pengawas') return cachedTeacherOperator;
  try {
    const stored = sessionStorage.getItem('cbt_teacher_operator');
    if (stored) {
      cachedTeacherOperator = stored;
      return stored;
    }
  } catch (_) {}
  return 'Guru Pengawas';
}


export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Stored Teacher PIN in memory or sessionStorage for authorized requests
let cachedTeacherPin = '';

export function setCachedTeacherPin(pin: string) {
  cachedTeacherPin = pin;
  try {
    sessionStorage.setItem('cbt_teacher_pin', pin);
  } catch (_) {}
}

export function getCachedTeacherPin(): string {
  if (cachedTeacherPin) return cachedTeacherPin;
  try {
    const stored = sessionStorage.getItem('cbt_teacher_pin');
    if (stored) {
      cachedTeacherPin = stored;
      return stored;
    }
  } catch (_) {}
  return '';
}

// Stored Student Session Token
export function saveStudentSessionToken(token: string) {
  try {
    localStorage.setItem('cbt_student_token', token);
  } catch (_) {}
}

export function getStudentSessionToken(): string {
  try {
    return localStorage.getItem('cbt_student_token') || '';
  } catch (_) {
    return '';
  }
}

export function clearStudentSessionToken() {
  try {
    localStorage.removeItem('cbt_student_token');
  } catch (_) {}
}

/**
 * Health check to verify server is reachable
 */
export async function apiHealthCheck(): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/health`, { method: 'GET' });
    return res.ok;
  } catch (_) {
    return false;
  }
}

/**
 * Fetch exam settings from server
 */
export async function apiGetSettings(): Promise<ExamSettings> {
  const res = await fetch(`${getApiBase()}/settings`, { method: 'GET' });
  if (!res.ok) {
    throw new ApiError('Gagal memuat pengaturan ujian dari server', res.status);
  }
  const data = await res.json();
  return data.settings;
}

/**
 * Save exam settings (Teacher)
 */
export async function apiSaveSettings(
  settings: ExamSettings,
  pin: string = getCachedTeacherPin()
): Promise<ExamSettings> {
  const res = await fetch(`${getApiBase()}/settings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-teacher-pin': pin,
      'x-teacher-operator': getCachedTeacherOperator(),
    },
    body: JSON.stringify(settings),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(data.error || 'Gagal menyimpan pengaturan ujian.', res.status);
  }
  return data.settings;
}

/**
 * Fetch all sessions from the shared database (Teacher)
 */
export async function apiGetAllSessions(
  pin: string = getCachedTeacherPin()
): Promise<StudentExamSession[]> {
  const res = await fetch(`${getApiBase()}/sessions`, {
    method: 'GET',
    headers: {
      'x-teacher-pin': pin,
    },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(
      data.error || 'Akses ditolak: PIN Pengawas tidak sesuai untuk memuat data murid.',
      res.status
    );
  }
  return data.sessions;
}

/**
 * Student starts or resumes an exam session
 */
export async function apiStartSession(info: {
  name: string;
  studentClass: string;
  participantNumber: string;
  examCode?: string;
}): Promise<{
  session: StudentExamSession;
  sessionToken: string;
  isResumed: boolean;
}> {
  const res = await fetch(`${getApiBase()}/sessions/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(info),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(data.error || 'Gagal memulai sesi ujian di server.', res.status);
  }
  if (data.sessionToken) {
    saveStudentSessionToken(data.sessionToken);
  }
  return data;
}

/**
 * Realtime progress save (answers, flags, violations)
 */
export async function apiSaveProgress(
  sessionId: string,
  payload: {
    answers?: Record<number, StudentAnswer>;
    reviewFlags?: Record<number, boolean>;
    tabViolations?: TabViolation[];
  },
  token: string = getStudentSessionToken()
): Promise<boolean> {
  try {
    const res = await fetch(`${getApiBase()}/sessions/${sessionId}/progress`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'x-session-token': token,
      },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.warn('Gagal menyinkronkan progress ke server, data tersimpan di offline storage:', err);
    return false;
  }
}

/**
 * Student Final Submit
 */
export async function apiSubmitSession(
  sessionId: string,
  payload: {
    answers: Record<number, StudentAnswer>;
    tabViolations: TabViolation[];
    status: 'submitted' | 'auto-time' | 'auto-tab-violation';
    statusReason?: string;
  },
  token: string = getStudentSessionToken()
): Promise<StudentExamSession> {
  const res = await fetch(`${getApiBase()}/sessions/${sessionId}/submit`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-session-token': token,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(data.error || 'Gagal mengirimkan jawaban ujian ke server.', res.status);
  }
  return data.session;
}

/**
 * Teacher updates essay rubric
 */
export async function apiUpdateRubric(
  sessionId: string,
  questionId: number,
  rubric: EssayRubricScore,
  pin: string = getCachedTeacherPin()
): Promise<StudentExamSession> {
  const res = await fetch(`${getApiBase()}/sessions/${sessionId}/rubric`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'x-teacher-pin': pin,
    },
    body: JSON.stringify({ questionId, rubric }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(data.error || 'Gagal menyimpan penilaian rubrik ke server.', res.status);
  }
  return data.session;
}

/**
 * Teacher resets a student's session for retake
 */
export async function apiResetStudent(
  participantNumber: string,
  pin: string = getCachedTeacherPin()
): Promise<boolean> {
  const res = await fetch(
    `${getApiBase()}/sessions/${encodeURIComponent(participantNumber)}/reset`,
    {
      method: 'POST',
      headers: {
        'x-teacher-pin': pin,
      },
    }
  );
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(data.error || 'Gagal mereset sesi murid di server.', res.status);
  }
  return true;
}

/**
 * Teacher clears all sessions
 */
export async function apiClearAllSessions(
  pin: string = getCachedTeacherPin()
): Promise<boolean> {
  const res = await fetch(`${getApiBase()}/sessions/clear-all`, {
    method: 'POST',
    headers: {
      'x-teacher-pin': pin,
    },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(data.error || 'Gagal menghapus seluruh data di server.', res.status);
  }
  return true;
}

/**
 * Teacher seeds demo data in the shared database
 */
export async function apiSeedDemo(
  pin: string = getCachedTeacherPin()
): Promise<StudentExamSession[]> {
  const res = await fetch(`${getApiBase()}/sessions/seed-demo`, {
    method: 'POST',
    headers: {
      'x-teacher-pin': pin,
    },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(data.error || 'Gagal memuat data simulasi ke server.', res.status);
  }
  return data.sessions;
}

/**
 * Teacher imports JSON backup to server
 */
export async function apiImportBackup(
  payload: { sessions: StudentExamSession[]; settings?: ExamSettings },
  pin: string = getCachedTeacherPin()
): Promise<{ sessions: StudentExamSession[]; settings: ExamSettings }> {
  const res = await fetch(`${getApiBase()}/sessions/import-backup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-teacher-pin': pin,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(data.error || 'Gagal mengimpor data cadangan ke server.', res.status);
  }
  return { sessions: data.sessions, settings: data.settings };
}


/**
 * Fetch current access control evaluation and server time
 */
export async function apiGetAccessControl(): Promise<{
  success: boolean;
  evaluation: {
    isAllowed: boolean;
    status: "open" | "scheduled" | "locked";
    reason: string;
    serverTime: string;
    serverTimeWita: string;
    isScheduleComplete?: boolean;
    windowStartWita?: string;
    windowEndWita?: string;
  };
  accessControl: any;
}> {
  const res = await fetch(`${getApiBase()}/access-control`, { method: "GET" });
  if (!res.ok) {
    throw new ApiError("Gagal memuat status kontrol akses dari server.", res.status);
  }
  return res.json();
}

/**
 * Teacher locks app manually
 */
export async function apiLockApp(
  reason: string,
  operator: string = "Guru Pengawas",
  pin: string = getCachedTeacherPin()
): Promise<any> {
  const res = await fetch(`${getApiBase()}/access-control/lock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-teacher-pin": pin,
    },
    body: JSON.stringify({ reason, operator }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(data.error || "Gagal mengunci akses aplikasi.", res.status);
  }
  return data;
}

/**
 * Teacher unlocks app manually
 */
export async function apiUnlockApp(
  operator: string = "Guru Pengawas",
  reason?: string,
  pin: string = getCachedTeacherPin()
): Promise<any> {
  const res = await fetch(`${getApiBase()}/access-control/unlock`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-teacher-pin": pin,
    },
    body: JSON.stringify({ operator, reason }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(data.error || "Gagal membuka akses aplikasi.", res.status);
  }
  return data;
}

/**
 * Teacher updates automated schedule
 */
export async function apiUpdateSchedule(
  schedule: any,
  operator: string = "Guru Pengawas",
  pin: string = getCachedTeacherPin()
): Promise<any> {
  const res = await fetch(`${getApiBase()}/access-control/schedule`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-teacher-pin": pin,
    },
    body: JSON.stringify({ schedule, operator }),
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(data.error || "Gagal memperbarui jadwal akses otomatis.", res.status);
  }
  return data;
}

/**
 * Teacher fetches access audit logs
 */
export async function apiGetAccessLogs(
  pin: string = getCachedTeacherPin()
): Promise<any[]> {
  const res = await fetch(`${getApiBase()}/access-control/logs`, {
    method: "GET",
    headers: {
      "x-teacher-pin": pin,
    },
  });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new ApiError(data.error || "Gagal mengambil riwayat kontrol akses.", res.status);
  }
  return data.logs || [];
}
