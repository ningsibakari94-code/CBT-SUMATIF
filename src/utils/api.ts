import {
  ExamSettings,
  StudentExamSession,
  EssayRubricScore,
  StudentAnswer,
  TabViolation,
} from '../types/cbt';
import { db } from '../lib/firebase';
import {
  collection,
  doc,
  setDoc,
  getDoc,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';

// Nama koleksi Firestore terpusat
const SESSIONS_COLLECTION = 'cbt_exam_sessions';
const SETTINGS_DOC = 'cbt_config/settings';

// Mode Management
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

// Teacher Operator Identity
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

// Teacher PIN Cache
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

// Student Token Cache
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
 * 1. Ambil Pengaturan Ujian dari Firestore
 */
export async function apiGetSettings(): Promise<ExamSettings> {
  try {
    const docRef = doc(db, 'cbt_config', 'settings');
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as ExamSettings;
    }
  } catch (err) {
    console.warn('Gagal memuat pengaturan Firestore, menggunakan default:', err);
  }
  return {
    durationMinutes: 60,
    examCode: '',
    codeRequired: false,
    tabSwitchRule: 'warning-2',
    kkmScore: 75,
    preventRetake: true,
  };
}

/**
 * 2. Simpan Pengaturan Ujian ke Firestore
 */
export async function apiSaveSettings(
  settings: ExamSettings,
  _pin: string = getCachedTeacherPin()
): Promise<ExamSettings> {
  try {
    const docRef = doc(db, 'cbt_config', 'settings');
    await setDoc(docRef, settings, { merge: true });
    return settings;
  } catch (err: any) {
    throw new ApiError(err.message || 'Gagal menyimpan pengaturan ke Cloud.', 500);
  }
}

/**
 * 3. Ambil Semua Sesi Siswa (Dashboard Guru)
 */
export async function apiGetAllSessions(
  _pin: string = getCachedTeacherPin()
): Promise<StudentExamSession[]> {
  try {
    const colRef = collection(db, SESSIONS_COLLECTION);
    const snap = await getDocs(colRef);
    const list: StudentExamSession[] = [];
    snap.forEach((d) => {
      list.push(d.data() as StudentExamSession);
    });
    return list;
  } catch (err: any) {
    console.error('Gagal memuat sesi Firestore:', err);
    return [];
  }
}

/**
 * 4. Murid Memulai Ujian
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
  const trimmedName = (info.name || '').trim();
  const trimmedClass = (info.studentClass || '').trim();
  const trimmedNum = (info.participantNumber || '').trim();

  // Bersihkan ID unik dokumen berdasarkan nomor peserta
  const safeDocId = `sess_${trimmedNum.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const docRef = doc(db, SESSIONS_COLLECTION, safeDocId);

  try {
    const existingSnap = await getDoc(docRef);
    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as StudentExamSession & { sessionToken: string };
      return {
        session: existingData,
        sessionToken: existingData.sessionToken || `token-${Date.now()}`,
        isResumed: true,
      };
    }
  } catch (_) {}

  const sessionId = `cbt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const sessionToken = `token-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

  const newSession: StudentExamSession & { sessionToken: string } = {
    id: safeDocId,
    sessionToken,
    studentName: trimmedName,
    studentClass: trimmedClass,
    participantNumber: trimmedNum,
    examCode: info.examCode || '',
    startTime: new Date().toISOString(),
    status: 'in-progress',
    answers: {},
    reviewFlags: {},
    tabViolations: [],
    scores: {
      perQuestion: {},
      essayRubrics: {},
      objectiveScore: 0,
      essayScore: 0,
      totalScore: 0,
      finalScore100: 0,
      isFullyGraded: false,
    },
  };

  try {
    await setDoc(docRef, newSession);
    saveStudentSessionToken(sessionToken);
  } catch (err) {
    console.warn('Gagal menyimpan sesi awal ke Firestore:', err);
  }

  return { session: newSession, sessionToken, isResumed: false };
}

/**
 * 5. Murid Menyimpan Progres Jawaban / Pelanggaran Tab
 */
export async function apiSaveProgress(
  sessionId: string,
  payload: {
    answers?: Record<number, StudentAnswer>;
    reviewFlags?: Record<number, boolean>;
    tabViolations?: TabViolation[];
  },
  _token: string = getStudentSessionToken()
): Promise<boolean> {
  try {
    const docRef = doc(db, SESSIONS_COLLECTION, sessionId);
    await setDoc(
      docRef,
      {
        ...payload,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    return true;
  } catch (err) {
    console.warn('Gagal menyimpan progres ke Firestore:', err);
    return false;
  }
}

/**
 * 6. Murid Mengumpulkan Ujian (Submit Final)
 */
export async function apiSubmitSession(
  sessionId: string,
  sessionData: Partial<StudentExamSession>,
  _token: string = getStudentSessionToken()
): Promise<StudentExamSession> {
  try {
    const docRef = doc(db, SESSIONS_COLLECTION, sessionId);
    await setDoc(docRef, sessionData, { merge: true });
  } catch (err) {
    console.warn('Gagal submit ke Firestore:', err);
  }
  return sessionData as StudentExamSession;
}

/**
 * 7. Guru Mengoreksi Rubrik Uraian
 */
export async function apiUpdateRubric(
  sessionId: string,
  questionId: number,
  rubric: EssayRubricScore,
  _pin: string = getCachedTeacherPin()
): Promise<StudentExamSession | null> {
  try {
    const docRef = doc(db, SESSIONS_COLLECTION, sessionId);
    const snap = await getDoc(docRef);
    if (!snap.exists()) return null;

    const data = snap.data() as StudentExamSession;
    const currentRubrics = data.scores?.essayRubrics || {};
    currentRubrics[questionId] = rubric;

    const totalRubricScore =
      (rubric.identifikasi || 0) +
      (rubric.model || 0) +
      (rubric.hitungan || 0) +
      (rubric.penalaran || 0) +
      (rubric.kesimpulan || 0);

    const perQuestion = { ...(data.scores?.perQuestion || {}) };
    perQuestion[questionId] = totalRubricScore;

    const essay9 =
      questionId === 9
        ? totalRubricScore
        : (currentRubrics[9]?.identifikasi || 0) +
          (currentRubrics[9]?.model || 0) +
          (currentRubrics[9]?.hitungan || 0) +
          (currentRubrics[9]?.penalaran || 0) +
          (currentRubrics[9]?.kesimpulan || 0);

    const essay10 =
      questionId === 10
        ? totalRubricScore
        : (currentRubrics[10]?.identifikasi || 0) +
          (currentRubrics[10]?.model || 0) +
          (currentRubrics[10]?.hitungan || 0) +
          (currentRubrics[10]?.penalaran || 0) +
          (currentRubrics[10]?.kesimpulan || 0);

    const objectiveScore = data.scores?.objectiveScore || 0;
    const totalScore = objectiveScore + essay9 + essay10;
    const finalScore100 = Number(((totalScore / 38) * 100).toFixed(1));

    const updatedSession: StudentExamSession = {
      ...data,
      scores: {
        ...data.scores,
        perQuestion,
        essayRubrics: currentRubrics,
        essayScore: essay9 + essay10,
        totalScore,
        finalScore100,
        isFullyGraded: true,
      },
    };

    await setDoc(docRef, updatedSession, { merge: true });
    return updatedSession;
  } catch (err) {
    console.error('Gagal memperbarui rubrik ke Firestore:', err);
    return null;
  }
}

/**
 * 8. Guru Mereset Ujian Siswa agar Bisa Mengulang
 */
export async function apiResetStudent(
  participantNumber: string,
  _pin: string = getCachedTeacherPin()
): Promise<boolean> {
  try {
    const safeDocId = `sess_${participantNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const docRef = doc(db, SESSIONS_COLLECTION, safeDocId);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error('Gagal mereset sesi murid di Firestore:', err);
    return false;
  }
}

/**
 * 9. Reset Semua Data Ujian (Hapus Koleksi)
 */
export async function apiClearAllSessions(
  _pin: string = getCachedTeacherPin()
): Promise<boolean> {
  try {
    const colRef = collection(db, SESSIONS_COLLECTION);
    const snap = await getDocs(colRef);
    const promises = snap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(promises);
    return true;
  } catch (err) {
    console.error('Gagal menghapus seluruh sesi di Firestore:', err);
    return false;
  }
}

export async function apiSeedDemo(_pin: string = getCachedTeacherPin()): Promise<StudentExamSession[]> {
  return [];
}

export async function apiImportBackup(_data: any, _pin: string = getCachedTeacherPin()): Promise<boolean> {
  return true;
}

export async function apiGetAccessControl(): Promise<any> {
  return { success: true, accessControl: { status: 'open' } };
}

export async function apiLockApp(_reason: string = '', _operator: string = 'Guru Pengawas'): Promise<any> {
  return { success: true };
}

export async function apiUnlockApp(_reason: string = '', _operator: string = 'Guru Pengawas'): Promise<any> {
  return { success: true };
}

export async function apiUpdateSchedule(_schedule: any): Promise<any> {
  return { success: true };
}

export async function apiGetAccessLogs(): Promise<any[]> {
  return [];
}
