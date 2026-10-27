import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import fs from 'fs';
import { calculateExamScores } from './src/utils/scoring.ts';
import { DEFAULT_SETTINGS, DEFAULT_ACCESS_CONTROL, seedRealisticDemoSubmissions } from './src/utils/storage.ts';
import { ExamSettings, StudentExamSession, EssayRubricScore, AppAccessControl, AccessStatus, AccessLogItem } from './src/types/cbt.ts';

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProd = process.env.NODE_ENV === 'production';

// Ensure data directory exists
const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'cbt_database.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

interface DatabaseState {
  settings: ExamSettings;
  sessions: (StudentExamSession & { sessionToken?: string })[];
}

function loadDatabase(): DatabaseState {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}), accessControl: { ...DEFAULT_ACCESS_CONTROL, ...(parsed.settings?.accessControl || {}) } },
        sessions: Array.isArray(parsed.sessions) ? parsed.sessions : [],
      };
    }
  } catch (err) {
    console.error('Error reading database file, initializing default:', err);
  }
  return {
    settings: { ...DEFAULT_SETTINGS },
    sessions: [],
  };
}

let dbCache: DatabaseState = loadDatabase();

function saveDatabase(): void {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(dbCache, null, 2), 'utf-8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Error saving database file:', err);
  }
}


function getTimezoneOffsetStr(tz: string): string {
  if (tz === "Asia/Jakarta") return "+07:00";
  if (tz === "Asia/Jayapura") return "+09:00";
  return "+08:00"; // Asia/Makassar (WITA)
}

function evaluateServerAccess(ac?: AppAccessControl): {
  isAllowed: boolean;
  status: "open" | "scheduled" | "locked";
  reason: string;
  serverTime: string;
  serverTimeWita: string;
  isScheduleComplete?: boolean;
  windowStartWita?: string;
  windowEndWita?: string;
} {
  const now = new Date();
  const serverTime = now.toISOString();
  const serverTimeWita =
    now.toLocaleString("id-ID", {
      timeZone: "Asia/Makassar",
      dateStyle: "full",
      timeStyle: "medium",
    }) + " WITA";

  const ctrl: AppAccessControl = ac || DEFAULT_ACCESS_CONTROL;

  if (ctrl.status === "locked") {
    return {
      isAllowed: false,
      status: "locked",
      reason: ctrl.lockReason || "Akses aplikasi sedang dikunci oleh guru pengawas.",
      serverTime,
      serverTimeWita,
    };
  }

  if (ctrl.status === "scheduled") {
    const s = ctrl.schedule || {};
    if (!s.startDate || !s.startTime || !s.endDate || !s.endTime) {
      return {
        isAllowed: false,
        status: "scheduled",
        isScheduleComplete: false,
        reason: "Jadwal akses otomatis belum lengkap (tanggal & jam mulai serta berakhir wajib diisi).",
        serverTime,
        serverTimeWita,
      };
    }

    const tz = s.timezone || "Asia/Makassar";
    const offset = getTimezoneOffsetStr(tz);
    const startIso = `${s.startDate}T${s.startTime}:00${offset}`;
    const endIso = `${s.endDate}T${s.endTime}:00${offset}`;
    const startMs = new Date(startIso).getTime();
    const endMs = new Date(endIso).getTime();
    const nowMs = now.getTime();

    const windowStartWita =
      new Date(startMs).toLocaleString("id-ID", {
        timeZone: tz,
        dateStyle: "medium",
        timeStyle: "short",
      }) + ` (${tz.replace("Asia/", "")})`;

    const windowEndWita =
      new Date(endMs).toLocaleString("id-ID", {
        timeZone: tz,
        dateStyle: "medium",
        timeStyle: "short",
      }) + ` (${tz.replace("Asia/", "")})`;

    if (nowMs < startMs) {
      return {
        isAllowed: false,
        status: "scheduled",
        isScheduleComplete: true,
        reason: `Akses ujian belum dibuka. Jadwal ujian dimulai pada ${windowStartWita}.`,
        serverTime,
        serverTimeWita,
        windowStartWita,
        windowEndWita,
      };
    }

    if (nowMs > endMs) {
      return {
        isAllowed: false,
        status: "scheduled",
        isScheduleComplete: true,
        reason: `Waktu ujian telah berakhir pada ${windowEndWita}. Pengerjaan baru atau perubahan jawaban ditutup.`,
        serverTime,
        serverTimeWita,
        windowStartWita,
        windowEndWita,
      };
    }

    return {
      isAllowed: true,
      status: "open",
      isScheduleComplete: true,
      reason: `Akses ujian terbuka sesuai jadwal (${windowStartWita} s.d. ${windowEndWita}).`,
      serverTime,
      serverTimeWita,
      windowStartWita,
      windowEndWita,
    };
  }

  return {
    isAllowed: true,
    status: "open",
    reason: "Akses ujian terbuka.",
    serverTime,
    serverTimeWita,
  };
}

// Teacher PIN verification with Rate Limiting & Environment Config
interface FailedPinAttempt {
  count: number;
  firstAttempt: number;
  blockedUntil: number;
}
const pinAttemptsMap = new Map<string, FailedPinAttempt>();

export function checkPinRateLimit(req: Request): { isBlocked: boolean; retryAfterSeconds: number } {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = pinAttemptsMap.get(clientIp);
  if (!record) return { isBlocked: false, retryAfterSeconds: 0 };
  if (record.blockedUntil > now) {
    return { isBlocked: true, retryAfterSeconds: Math.ceil((record.blockedUntil - now) / 1000) };
  }
  if (now - record.firstAttempt > 60000) {
    pinAttemptsMap.delete(clientIp);
    return { isBlocked: false, retryAfterSeconds: 0 };
  }
  return { isBlocked: false, retryAfterSeconds: 0 };
}

export function recordFailedPinAttempt(req: Request): void {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const record = pinAttemptsMap.get(clientIp) || { count: 0, firstAttempt: now, blockedUntil: 0 };
  record.count += 1;
  if (record.count >= 5) {
    record.blockedUntil = now + 60000; // 60s block after 5 failed attempts
  }
  pinAttemptsMap.set(clientIp, record);
}

export function resetPinAttempts(req: Request): void {
  const clientIp = (req.headers['x-forwarded-for'] as string) || req.ip || req.socket.remoteAddress || 'unknown';
  pinAttemptsMap.delete(clientIp);
}

function verifyTeacherPin(req: Request, res?: Response): boolean {
  const rateCheck = checkPinRateLimit(req);
  if (rateCheck.isBlocked) {
    if (res) {
      res.status(429).json({
        success: false,
        error: `Terlalu banyak percobaan PIN gagal. Coba lagi dalam ${rateCheck.retryAfterSeconds} detik.`,
      });
    }
    return false;
  }

  const pinHeader = req.headers['x-teacher-pin'];
  const pinQuery = req.query.pin;
  const pin = (typeof pinHeader === 'string' ? pinHeader : typeof pinQuery === 'string' ? pinQuery : '').trim().toUpperCase();

  const configuredPin = (process.env.STAGING_TEACHER_PIN || process.env.TEACHER_PIN || 'GURU2026').trim().toUpperCase();
  const validPins = [configuredPin];

  if (!pin || !validPins.includes(pin)) {
    recordFailedPinAttempt(req);
    if (res) {
      res.status(401).json({ success: false, error: 'Akses ditolak: PIN Pengawas tidak valid.' });
    }
    return false;
  }

  resetPinAttempts(req);
  return true;
}

app.use(express.json({ limit: '10mb' }));

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Health check
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    serverTime: new Date().toISOString(),
    totalSessions: dbCache.sessions.length,
  });
});

// GET Settings
app.get('/api/settings', (_req: Request, res: Response) => {
  res.json({
    success: true,
    settings: dbCache.settings,
  });
});

// POST Settings (Teacher only)
app.post('/api/settings', (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: 'Akses ditolak: PIN Pengawas diperlukan.' });
    return;
  }
  const newSettings = req.body;
  if (!newSettings || typeof newSettings !== 'object') {
    res.status(400).json({ success: false, error: 'Format pengaturan tidak valid.' });
    return;
  }
  dbCache.settings = {
    ...dbCache.settings,
    ...newSettings,
  };
  saveDatabase();
  res.json({ success: true, settings: dbCache.settings });
});

// GET All Sessions (Teacher only)
app.get('/api/sessions', (req: Request, res: Response) => {
  if (!verifyTeacherPin(req, res)) {
    return;
  }
  // Return all sessions with latest calculation
  const sanitizedOperational = dbCache.sessions.map(({ sessionToken, ...rest }) => rest);
  res.json({
    success: true,
    sessions: sanitizedOperational,
  });
});

// POST Student Start Exam Session
app.post('/api/sessions/start', (req: Request, res: Response) => {
  const access = evaluateServerAccess(dbCache.settings.accessControl);
  if (!access.isAllowed) {
    res.status(403).json({
      success: false,
      code: 'ACCESS_LOCKED',
      error: access.reason,
      serverTimeWita: access.serverTimeWita,
      windowStartWita: access.windowStartWita,
      windowEndWita: access.windowEndWita,
    });
    return;
  }
  const { name, studentClass, participantNumber, examCode } = req.body || {};
  const trimmedName = (name || '').trim();
  const trimmedClass = (studentClass || '').trim();
  const trimmedNum = (participantNumber || '').trim();

  if (!trimmedName || !trimmedClass || !trimmedNum) {
    res.status(400).json({ success: false, error: 'Nama lengkap, kelas, dan nomor peserta wajib diisi.' });
    return;
  }

  // Check preventRetake
  if (dbCache.settings.preventRetake) {
    const existingCompleted = dbCache.sessions.find(
      (s) => s.participantNumber.toLowerCase() === trimmedNum.toLowerCase() && s.status !== 'in-progress'
    );
    if (existingCompleted) {
      res.status(403).json({
        success: false,
        error: `Nomor peserta "${trimmedNum}" (${existingCompleted.studentName}) sudah menyelesaikan ujian. Silakan hubungi guru pengawas jika perlu ujian susulan/ulang.`,
      });
      return;
    }
  }

  // Check if there is an in-progress session for this student to resume
  const existingInProgress = dbCache.sessions.find(
    (s) => s.participantNumber.toLowerCase() === trimmedNum.toLowerCase() && s.status === 'in-progress'
  );

  if (existingInProgress) {
    res.json({
      success: true,
      isResumed: true,
      session: existingInProgress,
      sessionToken: existingInProgress.sessionToken,
    });
    return;
  }

  // Generate new session & secret session token
  const sessionId = `cbt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  const sessionToken = `token-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

  const newSession: StudentExamSession & { sessionToken: string } = {
    id: sessionId,
    sessionToken,
    studentName: trimmedName,
    studentClass: trimmedClass,
    participantNumber: trimmedNum,
    examCode: examCode || '',
    startTime: new Date().toISOString(),
    status: 'in-progress',
    answers: {},
    reviewFlags: {},
    tabViolations: [],
    scores: calculateExamScores({}),
  };

  dbCache.sessions.push(newSession);
  saveDatabase();

  res.json({
    success: true,
    isResumed: false,
    session: newSession,
    sessionToken,
  });
});

// PUT Student Save Progress (Realtime Auto-save)
app.put('/api/sessions/:id/progress', (req: Request, res: Response) => {
  const access = evaluateServerAccess(dbCache.settings.accessControl);
  if (!access.isAllowed) {
    res.status(403).json({
      success: false,
      code: 'ACCESS_LOCKED',
      error: access.reason,
      serverTimeWita: access.serverTimeWita,
    });
    return;
  }
  const { id } = req.params;
  const token = req.headers['x-session-token'] || req.body?.sessionToken;

  const session = dbCache.sessions.find((s) => s.id === id);
  if (!session) {
    res.status(404).json({ success: false, error: 'Sesi ujian tidak ditemukan.' });
    return;
  }

  // Verify ownership
  if (session.sessionToken && session.sessionToken !== token) {
    res.status(403).json({ success: false, error: 'Akses ditolak: token sesi tidak valid.' });
    return;
  }

  // Do not overwrite if already submitted
  if (session.status !== 'in-progress') {
    res.json({ success: true, message: 'Sesi telah diserahkan sebelumnya.', session });
    return;
  }

  const { answers, reviewFlags, tabViolations } = req.body || {};
  if (answers) session.answers = answers;
  if (reviewFlags) session.reviewFlags = reviewFlags;
  if (tabViolations) session.tabViolations = tabViolations;

  saveDatabase();
  res.json({ success: true, savedAt: new Date().toISOString() });
});

// POST Student Final Submit
app.post('/api/sessions/:id/submit', (req: Request, res: Response) => {
  const { id } = req.params;
  const token = req.headers['x-session-token'] || req.body?.sessionToken;

  const session = dbCache.sessions.find((s) => s.id === id);
  if (!session) {
    res.status(404).json({ success: false, error: 'Sesi ujian tidak ditemukan.' });
    return;
  }

  if (session.sessionToken && session.sessionToken !== token) {
    res.status(403).json({ success: false, error: 'Akses ditolak: token sesi tidak valid.' });
    return;
  }

  const { answers, tabViolations, status = 'submitted', statusReason } = req.body || {};
  if (answers) session.answers = answers;
  if (tabViolations) session.tabViolations = tabViolations;

  const finishTime = new Date().toISOString();
  const startMs = new Date(session.startTime).getTime();
  const finishMs = new Date(finishTime).getTime();
  const usedSeconds = Math.max(0, Math.floor((finishMs - startMs) / 1000));

  // Compute final scores
  const calculatedScores = calculateExamScores(
    session.answers,
    session.scores?.essayRubrics
  );

  session.finishTime = finishTime;
  session.durationSecondsUsed = usedSeconds;
  session.status = status;
  session.statusReason = statusReason || (status === 'submitted' ? 'Diselesaikan secara mandiri oleh murid' : statusReason);
  session.scores = calculatedScores;

  saveDatabase();

  res.json({
    success: true,
    session,
  });
});

// GET Student Single Session (Student with token, or Teacher with PIN)
app.get('/api/sessions/:id', (req: Request, res: Response) => {
  const { id } = req.params;
  const session = dbCache.sessions.find((s) => s.id === id);
  if (!session) {
    res.status(404).json({ success: false, error: 'Sesi tidak ditemukan.' });
    return;
  }

  const isTeacher = verifyTeacherPin(req);
  const token = req.headers['x-session-token'];
  const isOwner = session.sessionToken && session.sessionToken === token;

  if (!isTeacher && !isOwner) {
    res.status(403).json({ success: false, error: 'Akses ditolak.' });
    return;
  }

  res.json({ success: true, session });
});

// PUT Teacher Update Essay Rubric
app.put('/api/sessions/:id/rubric', (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: 'Akses ditolak: PIN Pengawas diperlukan.' });
    return;
  }

  const { id } = req.params;
  const { questionId, rubric } = req.body || {};
  const qId = parseInt(questionId, 10);

  const session = dbCache.sessions.find((s) => s.id === id);
  if (!session) {
    res.status(404).json({ success: false, error: 'Sesi tidak ditemukan.' });
    return;
  }

  if (qId !== 9 && qId !== 10) {
    res.status(400).json({ success: false, error: 'Hanya soal uraian 9 dan 10 yang dapat dinilai menggunakan rubrik ini.' });
    return;
  }

  const currentRubrics = session.scores.essayRubrics || {
    9: { identifikasi: 0, model: 0, hitungan: 0, penalaran: 0, kesimpulan: 0 },
    10: { identifikasi: 0, model: 0, hitungan: 0, penalaran: 0, kesimpulan: 0 },
  };

  currentRubrics[qId] = rubric as EssayRubricScore;
  session.scores = calculateExamScores(session.answers, currentRubrics);

  saveDatabase();

  res.json({
    success: true,
    session,
  });
});

// POST Teacher Reset Student Session for Retake
app.post('/api/sessions/:participantNumber/reset', (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: 'Akses ditolak: PIN Pengawas diperlukan.' });
    return;
  }

  const { participantNumber } = req.params;
  const initialCount = dbCache.sessions.length;
  dbCache.sessions = dbCache.sessions.filter(
    (s) => s.participantNumber.toLowerCase() !== participantNumber.toLowerCase()
  );

  saveDatabase();

  res.json({
    success: true,
    removedCount: initialCount - dbCache.sessions.length,
    message: `Sesi murid dengan nomor peserta ${participantNumber} berhasil direset.`,
  });
});

// POST Teacher Clear All Data
app.post('/api/sessions/clear-all', (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: 'Akses ditolak: PIN Pengawas diperlukan.' });
    return;
  }

  dbCache.sessions = [];
  saveDatabase();

  res.json({
    success: true,
    message: 'Semua data sesi ujian berhasil dibersihkan.',
  });
});

// POST Teacher Seed Demo Submissions
app.post('/api/sessions/seed-demo', (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: 'Akses ditolak: PIN Pengawas diperlukan.' });
    return;
  }

  const demoSessions = seedRealisticDemoSubmissions();
  dbCache.sessions = demoSessions;
  saveDatabase();

  res.json({
    success: true,
    count: demoSessions.length,
    sessions: demoSessions,
  });
});

// POST Teacher Import Backup JSON
app.post('/api/sessions/import-backup', (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: 'Akses ditolak: PIN Pengawas diperlukan.' });
    return;
  }

  const { sessions, settings } = req.body || {};
  if (!Array.isArray(sessions)) {
    res.status(400).json({ success: false, error: 'Format data backup tidak valid.' });
    return;
  }

  dbCache.sessions = sessions;
  if (settings) {
    dbCache.settings = { ...DEFAULT_SETTINGS, ...settings };
  }
  saveDatabase();

  res.json({
    success: true,
    count: sessions.length,
    sessions: dbCache.sessions,
    settings: dbCache.settings,
  });
});


// -------------------------------------------------------------
// Access Control Endpoints
// -------------------------------------------------------------

// GET Access Control status & server evaluation
app.get("/api/access-control", (_req: Request, res: Response) => {
  const evaluation = evaluateServerAccess(dbCache.settings.accessControl);
  res.json({
    success: true,
    evaluation,
    accessControl: dbCache.settings.accessControl || DEFAULT_ACCESS_CONTROL,
  });
});

// POST Lock App Manually (Teacher only)
app.post("/api/access-control/lock", (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: "Akses ditolak: PIN Pengawas diperlukan." });
    return;
  }
  const { reason = "Akses dikunci secara manual oleh guru pengawas.", operator = "Guru Pengawas" } = req.body || {};
  if (!dbCache.settings.accessControl) {
    dbCache.settings.accessControl = { ...DEFAULT_ACCESS_CONTROL };
  }
  dbCache.settings.accessControl.status = "locked";
  dbCache.settings.accessControl.lockReason = reason;
  if (!Array.isArray(dbCache.settings.accessControl.logs)) {
    dbCache.settings.accessControl.logs = [];
  }
  dbCache.settings.accessControl.logs.unshift({
    timestamp: new Date().toISOString(),
    action: "lock",
    operator,
    reason,
    details: "Penguncian manual aplikasi web",
  });
  saveDatabase();
  const evaluation = evaluateServerAccess(dbCache.settings.accessControl);
  res.json({
    success: true,
    message: "Aplikasi berhasil dikunci. Siswa tidak dapat memulai atau mengubah jawaban.",
    evaluation,
    accessControl: dbCache.settings.accessControl,
  });
});

// POST Unlock App Manually (Teacher only)
app.post("/api/access-control/unlock", (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: "Akses ditolak: PIN Pengawas diperlukan." });
    return;
  }
  const { reason = "Akses dibuka kembali secara manual.", operator = "Guru Pengawas" } = req.body || {};
  if (!dbCache.settings.accessControl) {
    dbCache.settings.accessControl = { ...DEFAULT_ACCESS_CONTROL };
  }
  dbCache.settings.accessControl.status = "open";
  dbCache.settings.accessControl.lockReason = "";
  if (dbCache.settings.accessControl.schedule) { dbCache.settings.accessControl.schedule.isScheduleEnabled = false; }
  if (!Array.isArray(dbCache.settings.accessControl.logs)) {
    dbCache.settings.accessControl.logs = [];
  }
  dbCache.settings.accessControl.logs.unshift({
    timestamp: new Date().toISOString(),
    action: "unlock",
    operator,
    reason,
    details: "Pembukaan kembali akses aplikasi secara manual",
  });
  saveDatabase();
  const evaluation = evaluateServerAccess(dbCache.settings.accessControl);
  res.json({
    success: true,
    message: "Akses aplikasi berhasil dibuka kembali.",
    evaluation,
    accessControl: dbCache.settings.accessControl,
  });
});

// POST Update Automated Schedule (Teacher only)
app.post("/api/access-control/schedule", (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: "Akses ditolak: PIN Pengawas diperlukan." });
    return;
  }
  const { schedule, operator = "Guru Pengawas" } = req.body || {};
  if (!schedule) {
    res.status(400).json({ success: false, error: "Format jadwal tidak valid." });
    return;
  }
  if (!dbCache.settings.accessControl) {
    dbCache.settings.accessControl = { ...DEFAULT_ACCESS_CONTROL };
  }
  dbCache.settings.accessControl.schedule = {
    ...dbCache.settings.accessControl.schedule,
    ...schedule,
    isScheduleEnabled: Boolean(schedule.isScheduleEnabled ?? true),
  };
  dbCache.settings.accessControl.status = "scheduled";
  if (!Array.isArray(dbCache.settings.accessControl.logs)) {
    dbCache.settings.accessControl.logs = [];
  }
  dbCache.settings.accessControl.logs.unshift({
    timestamp: new Date().toISOString(),
    action: "schedule_update",
    operator,
    details: `Jadwal: ${schedule.startDate} ${schedule.startTime} s.d. ${schedule.endDate} ${schedule.endTime} (${schedule.timezone || "Asia/Makassar"})`,
  });
  saveDatabase();
  const evaluation = evaluateServerAccess(dbCache.settings.accessControl);
  res.json({
    success: true,
    message: "Jadwal akses otomatis berhasil diperbarui dan diterapkan.",
    evaluation,
    accessControl: dbCache.settings.accessControl,
  });
});

// GET Access Control Audit Logs (Teacher only)
app.get("/api/access-control/logs", (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: "Akses ditolak: PIN Pengawas diperlukan." });
    return;
  }
  res.json({
    success: true,
    logs: dbCache.settings.accessControl?.logs || [],
  });
});


// ==================== STAGING FIRESTORE ROUTES ====================
// These routes explicitly connect to Google Cloud Firestore under namespace:
// exams/test_staging_mat_xi_2026/
// The operational routes below remain 100% untouched and backed by data/cbt_database.json.

import { db as firestoreDb } from './src/lib/firebase.ts';
import {
  doc as fDoc,
  getDoc as fGetDoc,
  setDoc as fSetDoc,
  collection as fCollection,
  getDocs as fGetDocs,
  deleteDoc as fDeleteDoc,
} from 'firebase/firestore';

const STAGING_EXAM_PATH = 'exams/test_staging_mat_xi_2026';

// Staging Health
app.get('/api/staging/health', async (_req: Request, res: Response) => {
  try {
    const now = new Date();
    res.json({
      status: 'ok',
      mode: 'staging',
      database: 'Google Cloud Firestore',
      stagingNamespace: STAGING_EXAM_PATH,
      serverTime: now.toISOString(),
      serverTimeWita:
        now.toLocaleString('id-ID', {
          timeZone: 'Asia/Makassar',
          dateStyle: 'full',
          timeStyle: 'medium',
        }) + ' WITA',
    });
  } catch (err: any) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Staging Get Settings
app.get('/api/staging/settings', async (_req: Request, res: Response) => {
  try {
    const configSnap = await fGetDoc(fDoc(firestoreDb, `${STAGING_EXAM_PATH}/config/settings`));
    if (configSnap.exists()) {
      res.json({ success: true, settings: configSnap.data() });
    } else {
      res.json({ success: true, settings: DEFAULT_SETTINGS });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Save Settings
app.post('/api/staging/settings', async (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: 'Akses ditolak: PIN Pengawas diperlukan.' });
    return;
  }
  try {
    const newSettings = req.body || {};
    await fSetDoc(fDoc(firestoreDb, `${STAGING_EXAM_PATH}/config/settings`), newSettings, { merge: true });
    res.json({ success: true, settings: newSettings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Get All Sessions (Teacher Dashboard in Staging)
app.get('/api/staging/sessions', async (req: Request, res: Response) => {
  if (!verifyTeacherPin(req, res)) {
    return;
  }
  try {
    const colSnap = await fGetDocs(fCollection(firestoreDb, `${STAGING_EXAM_PATH}/sessions`));
    const sessions = colSnap.docs.map((d) => d.data() as StudentExamSession & { sessionToken?: string });
    const sanitizedStaging = sessions.map(({ sessionToken, ...rest }) => rest);
    res.json({ success: true, sessions: sanitizedStaging, mode: 'staging' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Student Start Exam
app.post('/api/staging/sessions/start', async (req: Request, res: Response) => {
  try {
    // Check access control in staging
    const configSnap = await fGetDoc(fDoc(firestoreDb, `${STAGING_EXAM_PATH}/config/settings`));
    const settings = configSnap.exists() ? (configSnap.data() as ExamSettings) : DEFAULT_SETTINGS;
    const access = evaluateServerAccess(settings.accessControl);
    if (!access.isAllowed) {
      res.status(403).json({
        success: false,
        code: 'ACCESS_LOCKED',
        error: access.reason,
        serverTimeWita: access.serverTimeWita,
      });
      return;
    }

    const { name, studentClass, participantNumber, examCode } = req.body || {};
    const trimmedName = (name || '').trim();
    const trimmedClass = (studentClass || '').trim();
    const trimmedNum = (participantNumber || '').trim();
    if (!trimmedName || !trimmedClass || !trimmedNum) {
      res.status(400).json({ success: false, error: 'Nama lengkap, kelas, dan nomor peserta wajib diisi.' });
      return;
    }

    const docId = `sess_${trimmedNum.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    const docRef = fDoc(firestoreDb, `${STAGING_EXAM_PATH}/sessions/${docId}`);
    const existingSnap = await fGetDoc(docRef);

    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as StudentExamSession & { sessionToken: string };
      if (settings.preventRetake && existingData.status !== 'in-progress') {
        res.status(403).json({
          success: false,
          error: `Nomor peserta "${trimmedNum}" sudah menyelesaikan ujian staging.`,
        });
        return;
      }
      res.json({
        success: true,
        isResumed: true,
        session: existingData,
        sessionToken: existingData.sessionToken,
      });
      return;
    }

    const sessionId = `cbt-staging-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const sessionToken = `token-staging-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
    const newSession: StudentExamSession & { sessionToken: string } = {
      id: sessionId,
      sessionToken,
      studentName: trimmedName,
      studentClass: trimmedClass,
      participantNumber: trimmedNum,
      examCode: examCode || '',
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

    await fSetDoc(docRef, newSession);
    res.json({ success: true, session: newSession, sessionToken });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Student Save Progress
app.put('/api/staging/sessions/:id/progress', async (req: Request, res: Response) => {
  try {
    const configSnap = await fGetDoc(fDoc(firestoreDb, `${STAGING_EXAM_PATH}/config/settings`));
    const settings = configSnap.exists() ? (configSnap.data() as ExamSettings) : DEFAULT_SETTINGS;
    const access = evaluateServerAccess(settings.accessControl);
    if (!access.isAllowed) {
      res.status(403).json({
        success: false,
        code: 'ACCESS_LOCKED',
        error: access.reason,
        serverTimeWita: access.serverTimeWita,
      });
      return;
    }

    const sessionId = req.params.id;
    const { answers, reviewFlags, tabViolations } = req.body || {};

    // Find document by id in staging
    const colSnap = await fGetDocs(fCollection(firestoreDb, `${STAGING_EXAM_PATH}/sessions`));
    const targetDoc = colSnap.docs.find((d) => d.data().id === sessionId);
    if (!targetDoc) {
      res.status(404).json({ success: false, error: 'Sesi ujian staging tidak ditemukan.' });
      return;
    }

    const existingData = targetDoc.data() as StudentExamSession & { sessionToken?: string };
    const token = req.headers['x-session-token'] || req.body?.sessionToken;
    if (!token || !existingData.sessionToken || existingData.sessionToken !== token) {
      res.status(403).json({ success: false, error: 'Akses ditolak: token sesi murid tidak valid atau tidak disertakan.' });
      return;
    }
    if (existingData.status !== 'in-progress') {
      res.json({ success: true, message: 'Sesi telah diserahkan sebelumnya.' });
      return;
    }
    const updatedAnswers = { ...(existingData.answers || {}), ...(answers || {}) };
    const updatedFlags = { ...(existingData.reviewFlags || {}), ...(reviewFlags || {}) };
    const updatedViolations = Array.isArray(tabViolations) ? tabViolations : existingData.tabViolations;

    await fSetDoc(
      targetDoc.ref,
      {
        answers: updatedAnswers,
        reviewFlags: updatedFlags,
        tabViolations: updatedViolations,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    res.json({ success: true, message: 'Progres tersimpan di Cloud Firestore Staging.' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Student Submit Exam
app.post('/api/staging/sessions/:id/submit', async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const { answers, tabViolations, status = 'submitted', statusReason } = req.body || {};

    const colSnap = await fGetDocs(fCollection(firestoreDb, `${STAGING_EXAM_PATH}/sessions`));
    const targetDoc = colSnap.docs.find((d) => d.data().id === sessionId);
    if (!targetDoc) {
      res.status(404).json({ success: false, error: 'Sesi ujian staging tidak ditemukan.' });
      return;
    }

    const existingData = targetDoc.data() as StudentExamSession & { sessionToken?: string };
    const token = req.headers['x-session-token'] || req.body?.sessionToken;
    if (!token || !existingData.sessionToken || existingData.sessionToken !== token) {
      res.status(403).json({ success: false, error: 'Akses ditolak: token sesi murid tidak valid atau tidak disertakan.' });
      return;
    }
    const finalAnswers = { ...(existingData.answers || {}), ...(answers || {}) };
    const finalScores = calculateExamScores(finalAnswers, existingData.scores?.essayRubrics || {});

    const now = new Date();
    const startTime = new Date(existingData.startTime).getTime();
    const durationSecondsUsed = Math.max(1, Math.floor((now.getTime() - startTime) / 1000));

    const submittedSession: StudentExamSession = {
      ...existingData,
      status: status as any,
      statusReason: statusReason || 'Diselesaikan secara mandiri oleh murid (Staging)',
      finishTime: now.toISOString(),
      durationSecondsUsed,
      answers: finalAnswers,
      tabViolations: Array.isArray(tabViolations) ? tabViolations : existingData.tabViolations,
      scores: finalScores,
    };

    await fSetDoc(targetDoc.ref, submittedSession, { merge: true });
    res.json({ success: true, session: submittedSession });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Access Control Status
app.get('/api/staging/access-control', async (_req: Request, res: Response) => {
  try {
    const configSnap = await fGetDoc(fDoc(firestoreDb, `${STAGING_EXAM_PATH}/config/settings`));
    const settings = configSnap.exists() ? (configSnap.data() as ExamSettings) : DEFAULT_SETTINGS;
    const evaluation = evaluateServerAccess(settings.accessControl);
    res.json({
      success: true,
      mode: 'staging',
      evaluation,
      accessControl: settings.accessControl || DEFAULT_ACCESS_CONTROL,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Lock App (Teacher)
app.post('/api/staging/access-control/lock', async (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: 'Akses ditolak: PIN Pengawas diperlukan.' });
    return;
  }
  try {
    const { reason = 'Penguncian manual akses staging.', operator = 'Guru Pengawas' } = req.body || {};
    const configRef = fDoc(firestoreDb, `${STAGING_EXAM_PATH}/config/settings`);
    const configSnap = await fGetDoc(configRef);
    const settings = configSnap.exists() ? (configSnap.data() as ExamSettings) : { ...DEFAULT_SETTINGS };
    const ac = settings.accessControl || { ...DEFAULT_ACCESS_CONTROL };
    ac.status = 'locked';
    ac.lockReason = reason;
    if (!Array.isArray(ac.logs)) ac.logs = [];
    ac.logs.unshift({
      timestamp: new Date().toISOString(),
      action: 'lock',
      operator,
      reason,
      details: 'Penguncian manual aplikasi di lingkungan Staging Firestore',
    });
    settings.accessControl = ac;
    await fSetDoc(configRef, settings, { merge: true });
    const evaluation = evaluateServerAccess(ac);
    res.json({ success: true, message: 'Aplikasi Staging berhasil dikunci di Firestore.', evaluation, accessControl: ac });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Unlock App (Teacher)
app.post('/api/staging/access-control/unlock', async (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: 'Akses ditolak: PIN Pengawas diperlukan.' });
    return;
  }
  try {
    const { reason = 'Pembukaan kembali akses staging.', operator = 'Guru Pengawas' } = req.body || {};
    const configRef = fDoc(firestoreDb, `${STAGING_EXAM_PATH}/config/settings`);
    const configSnap = await fGetDoc(configRef);
    const settings = configSnap.exists() ? (configSnap.data() as ExamSettings) : { ...DEFAULT_SETTINGS };
    const ac = settings.accessControl || { ...DEFAULT_ACCESS_CONTROL };
    ac.status = 'open';
    ac.lockReason = '';
    if (ac.schedule) ac.schedule.isScheduleEnabled = false;
    if (!Array.isArray(ac.logs)) ac.logs = [];
    ac.logs.unshift({
      timestamp: new Date().toISOString(),
      action: 'unlock',
      operator,
      reason,
      details: 'Pembukaan kembali akses aplikasi di lingkungan Staging Firestore',
    });
    settings.accessControl = ac;
    await fSetDoc(configRef, settings, { merge: true });
    const evaluation = evaluateServerAccess(ac);
    res.json({ success: true, message: 'Akses aplikasi Staging berhasil dibuka kembali di Firestore.', evaluation, accessControl: ac });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Reset Student Session
app.post('/api/staging/sessions/:participantNumber/reset', async (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: 'Akses ditolak: PIN Pengawas diperlukan.' });
    return;
  }
  try {
    const num = req.params.participantNumber;
    const docId = `sess_${num.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
    await fDeleteDoc(fDoc(firestoreDb, `${STAGING_EXAM_PATH}/sessions/${docId}`));
    res.json({ success: true, message: `Sesi peserta staging "${num}" berhasil direset.` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Update Essay Rubric (Teacher only)
app.put('/api/staging/sessions/:id/rubric', async (req: Request, res: Response) => {
  if (!verifyTeacherPin(req, res)) {
    return;
  }
  try {
    const sessionId = req.params.id;
    const { questionId, rubric } = req.body || {};
    const qNum = parseInt(questionId, 10);
    if (!qNum || !rubric) {
      res.status(400).json({ success: false, error: 'Nomor soal dan objek rubrik wajib diisi.' });
      return;
    }

    const colSnap = await fGetDocs(fCollection(firestoreDb, `${STAGING_EXAM_PATH}/sessions`));
    const targetDoc = colSnap.docs.find((d) => d.data().id === sessionId);
    if (!targetDoc) {
      res.status(404).json({ success: false, error: 'Sesi ujian staging tidak ditemukan.' });
      return;
    }

    const existingData = targetDoc.data() as StudentExamSession;
    const currentRubrics = existingData.scores?.essayRubrics || {
      9: { identifikasi: 0, model: 0, hitungan: 0, penalaran: 0, kesimpulan: 0 },
      10: { identifikasi: 0, model: 0, hitungan: 0, penalaran: 0, kesimpulan: 0 },
    };
    currentRubrics[qNum] = rubric;

    const recalculatedScores = calculateExamScores(existingData.answers || {}, currentRubrics);
    const updatedScores = {
      ...recalculatedScores,
      isFullyGraded: true,
    };

    await fSetDoc(
      targetDoc.ref,
      {
        scores: updatedScores,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    res.json({
      success: true,
      session: {
        ...existingData,
        scores: updatedScores,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Update Automated Schedule (Teacher only)
app.post('/api/staging/access-control/schedule', async (req: Request, res: Response) => {
  if (!verifyTeacherPin(req, res)) {
    return;
  }
  try {
    const { schedule, operator = 'Guru Pengawas' } = req.body || {};
    if (!schedule) {
      res.status(400).json({ success: false, error: 'Data jadwal wajib disertakan.' });
      return;
    }

    const configRef = fDoc(firestoreDb, `${STAGING_EXAM_PATH}/config/settings`);
    const configSnap = await fGetDoc(configRef);
    const settings = configSnap.exists() ? (configSnap.data() as ExamSettings) : { ...DEFAULT_SETTINGS };

    const ac = settings.accessControl || { ...DEFAULT_ACCESS_CONTROL };
    ac.status = 'scheduled';
    ac.schedule = {
      startDate: schedule.startDate || '',
      startTime: schedule.startTime || '',
      endDate: schedule.endDate || '',
      endTime: schedule.endTime || '',
      timezone: schedule.timezone || 'Asia/Makassar',
      isScheduleEnabled: true,
    };

    if (!Array.isArray(ac.logs)) ac.logs = [];
    ac.logs.unshift({
      timestamp: new Date().toISOString(),
      action: 'schedule_update',
      operator,
      details: `Jadwal Staging: ${ac.schedule.startDate} ${ac.schedule.startTime} s.d. ${ac.schedule.endDate} ${ac.schedule.endTime} (${ac.schedule.timezone})`,
    });

    settings.accessControl = ac;
    await fSetDoc(configRef, settings, { merge: true });

    const evaluation = evaluateServerAccess(ac);
    res.json({
      success: true,
      message: 'Jadwal akses otomatis berhasil diterapkan pada Cloud Firestore Staging.',
      evaluation,
      accessControl: ac,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Get Access Control Audit Logs (Teacher only)
app.get('/api/staging/access-control/logs', async (req: Request, res: Response) => {
  if (!verifyTeacherPin(req, res)) {
    return;
  }
  try {
    const configRef = fDoc(firestoreDb, `${STAGING_EXAM_PATH}/config/settings`);
    const configSnap = await fGetDoc(configRef);
    const settings = configSnap.exists() ? (configSnap.data() as ExamSettings) : DEFAULT_SETTINGS;
    res.json({
      success: true,
      logs: settings.accessControl?.logs || [],
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// ==================== END STAGING FIRESTORE ROUTES ====================

// -------------------------------------------------------------
// Vite Middleware / Static Frontend Serving
// -------------------------------------------------------------

async function startServer() {
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 CBT Server running on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
  });
}

startServer();
