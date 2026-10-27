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

// JALUR DATABASE RESMI SESUAI FIRESTORE.RULES (DIJAMIN MEMILIKI IZIN WRITE & READ)
const FIRESTORE_PATH = 'exams/test_staging_mat_xi_2026';

// Mode Management
export function isStagingMode(): boolean {
  return false;
}
export function setStagingMode(_enabled: boolean) {}
export function getApiBase(): string {
  return '/api';
}

// Teacher Operator Identity
let cachedTeacherOperator = 'Guru Pengawas';
export function setCachedTeacherOperator(operator: string) {
  cachedTeacherOperator = operator;
}
export function getCachedTeacherOperator(): string {
  return cachedTeacherOperator;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number = 500) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

let cachedTeacherPin = 'GURU2026';
export function setCachedTeacherPin(pin: string) {
  cachedTeacherPin = pin;
}
export function getCachedTeacherPin(): string {
  return cachedTeacherPin || 'GURU2026';
}

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
 * 1. Ambil Pengaturan Ujian
 */
export async function apiGetSettings(): Promise<ExamSettings> {
  try {
    const docRef = doc(db, `${FIRESTORE_PATH}/config/settings`);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      return snap.data() as ExamSettings;
    }
  } catch (err) {
    console.warn('Gagal ambil settings:', err);
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
 * 2. Simpan Pengaturan Ujian
 */
export async function apiSaveSettings(settings: ExamSettings): Promise<ExamSettings> {
  try {
    const docRef = doc(db, `${FIRESTORE_PATH}/config/settings`);
    await setDoc(docRef, settings, { merge: true });
  } catch (err) {
    console.warn('Gagal simpan settings:', err);
  }
  return settings;
}

/**
 * 3. Ambil Semua Sesi (Dashboard Guru Membaca Ini)
 */
export async function apiGetAllSessions(): Promise<StudentExamSession[]> {
  try {
    const colRef = collection(db, `${FIRESTORE_PATH}/sessions`);
    const snap = await getDocs(colRef);
    const list: StudentExamSession[] = [];
    snap.forEach((d) => {
      const data = d.data() as StudentExamSession;
      list.push(data);
    });
    return list;
  } catch (err) {
    console.error('Gagal memuat sesi dari Firestore:', err);
    return [];
  }
}

/**
 * 4. Murid Mulai Ujian
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

  const docId = `sess_${trimmedNum.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const docRef = doc(db, `${FIRESTORE_PATH}/sessions/${docId}`);

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
    id: sessionId,
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
    console.warn('Gagal simpan sesi awal:', err);
  }

  return { session: newSession, sessionToken, isResumed: false };
}

/**
 * 5. Simpan Progres / Pelanggaran Tab
 */
export async function apiSaveProgress(
  sessionId: string,
  payload: {
    answers?: Record<number, StudentAnswer>;
    reviewFlags?: Record<number, boolean>;
    tabViolations?: TabViolation[];
  }
): Promise<boolean> {
  try {
    const colRef = collection(db, `${FIRESTORE_PATH}/sessions`);
    const snap = await getDocs(colRef);
    const target = snap.docs.find((d) => d.data().id === sessionId || d.id === sessionId);
    if (target) {
      await setDoc(target.ref, { ...payload, updatedAt: new Date().toISOString() }, { merge: true });
      return true;
    }
  } catch (err) {
    console.warn('Gagal simpan progres:', err);
  }
  return false;
}

/**
 * 6. Murid Mengumpulkan Ujian (Submit Final)
 */
export async function apiSubmitSession(
  sessionId: string,
  sessionData: Partial<StudentExamSession>
): Promise<StudentExamSession> {
  try {
    const colRef = collection(db, `${FIRESTORE_PATH}/sessions`);
    const snap = await getDocs(colRef);
    const target = snap.docs.find((d) => d.data().id === sessionId || d.id === sessionId);
    if (target) {
      await setDoc(target.ref, sessionData, { merge: true });
    }
  } catch (err) {
    console.warn('Gagal submit final:', err);
  }
  return sessionData as StudentExamSession;
}

/**
 * 7. Koreksi Rubrik Uraian Guru
 */
export async function apiUpdateRubric(
  sessionId: string,
  questionId: number,
  rubric: EssayRubricScore
): Promise<StudentExamSession | null> {
  try {
    const colRef = collection(db, `${FIRESTORE_PATH}/sessions`);
    const snap = await getDocs(colRef);
    const target = snap.docs.find((d) => d.data().id === sessionId || d.id === sessionId);
    if (!target) return null;

    const data = target.data() as StudentExamSession;
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

    await setDoc(target.ref, updatedSession, { merge: true });
    return updatedSession;
  } catch (err) {
    console.error('Gagal update rubrik:', err);
    return null;
  }
}

/**
 * 8. Izinkan Ujian Ulang (Reset Murid)
 */
export async function apiResetStudent(participantNumber: string): Promise<boolean> {
  try {
    const docId = `sess_${participantNumber.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const docRef = doc(db, `${FIRESTORE_PATH}/sessions/${docId}`);
    await deleteDoc(docRef);
    return true;
  } catch (err) {
    console.error('Gagal reset murid:', err);
    return false;
  }
}

/**
 * 9. Hapus Semua Data
 */
export async function apiClearAllSessions(): Promise<boolean> {
  try {
    const colRef = collection(db, `${FIRESTORE_PATH}/sessions`);
    const snap = await getDocs(colRef);
    const promises = snap.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(promises);
    return true;
  } catch (err) {
    console.error('Gagal hapus semua sesi:', err);
    return false;
  }
}

export async function apiSeedDemo(): Promise<StudentExamSession[]> {
  return [];
}
export async function apiImportBackup(_data: any): Promise<boolean> {
  return true;
}
export async function apiGetAccessControl(): Promise<any> {
  return { success: true, accessControl: { status: 'open' } };
}
export async function apiLockApp(): Promise<any> {
  return { success: true };
}
export async function apiUnlockApp(): Promise<any> {
  return { success: true };
}
export async function apiUpdateSchedule(): Promise<any> {
  return { success: true };
}
export async function apiGetAccessLogs(): Promise<any[]> {
  return [];
}
