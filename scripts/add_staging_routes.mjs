import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

// Check if staging routes are already added
if (!content.includes('// ==================== STAGING FIRESTORE ROUTES ====================')) {
  const stagingRoutesCode = `
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
    const configSnap = await fGetDoc(fDoc(firestoreDb, \`\${STAGING_EXAM_PATH}/config/settings\`));
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
    await fSetDoc(fDoc(firestoreDb, \`\${STAGING_EXAM_PATH}/config/settings\`), newSettings, { merge: true });
    res.json({ success: true, settings: newSettings });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Get All Sessions (Teacher Dashboard in Staging)
app.get('/api/staging/sessions', async (req: Request, res: Response) => {
  if (!verifyTeacherPin(req)) {
    res.status(401).json({ success: false, error: 'Akses ditolak: PIN Pengawas diperlukan.' });
    return;
  }
  try {
    const colSnap = await fGetDocs(fCollection(firestoreDb, \`\${STAGING_EXAM_PATH}/sessions\`));
    const sessions = colSnap.docs.map((d) => d.data() as StudentExamSession);
    res.json({ success: true, sessions, mode: 'staging' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Staging Student Start Exam
app.post('/api/staging/sessions/start', async (req: Request, res: Response) => {
  try {
    // Check access control in staging
    const configSnap = await fGetDoc(fDoc(firestoreDb, \`\${STAGING_EXAM_PATH}/config/settings\`));
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

    const docId = \`sess_\${trimmedNum.replace(/[^a-zA-Z0-9_-]/g, '_')}\`;
    const docRef = fDoc(firestoreDb, \`\${STAGING_EXAM_PATH}/sessions/\${docId}\`);
    const existingSnap = await fGetDoc(docRef);

    if (existingSnap.exists()) {
      const existingData = existingSnap.data() as StudentExamSession & { sessionToken: string };
      if (settings.preventRetake && existingData.status !== 'in-progress') {
        res.status(403).json({
          success: false,
          error: \`Nomor peserta "\${trimmedNum}" sudah menyelesaikan ujian staging.\`,
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

    const sessionId = \`cbt-staging-\${Date.now()}-\${Math.random().toString(36).substring(2, 7)}\`;
    const sessionToken = \`token-staging-\${Date.now()}-\${Math.random().toString(36).substring(2, 10)}\`;
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
    const configSnap = await fGetDoc(fDoc(firestoreDb, \`\${STAGING_EXAM_PATH}/config/settings\`));
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
    const colSnap = await fGetDocs(fCollection(firestoreDb, \`\${STAGING_EXAM_PATH}/sessions\`));
    const targetDoc = colSnap.docs.find((d) => d.data().id === sessionId);
    if (!targetDoc) {
      res.status(404).json({ success: false, error: 'Sesi ujian staging tidak ditemukan.' });
      return;
    }

    const existingData = targetDoc.data();
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

    const colSnap = await fGetDocs(fCollection(firestoreDb, \`\${STAGING_EXAM_PATH}/sessions\`));
    const targetDoc = colSnap.docs.find((d) => d.data().id === sessionId);
    if (!targetDoc) {
      res.status(404).json({ success: false, error: 'Sesi ujian staging tidak ditemukan.' });
      return;
    }

    const existingData = targetDoc.data() as StudentExamSession;
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
    const configSnap = await fGetDoc(fDoc(firestoreDb, \`\${STAGING_EXAM_PATH}/config/settings\`));
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
    const configRef = fDoc(firestoreDb, \`\${STAGING_EXAM_PATH}/config/settings\`);
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
    const configRef = fDoc(firestoreDb, \`\${STAGING_EXAM_PATH}/config/settings\`);
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
    const docId = \`sess_\${num.replace(/[^a-zA-Z0-9_-]/g, '_')}\`;
    await fDeleteDoc(fDoc(firestoreDb, \`\${STAGING_EXAM_PATH}/sessions/\${docId}\`));
    res.json({ success: true, message: \`Sesi peserta staging "\${num}" berhasil direset.\` });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});
// ==================== END STAGING FIRESTORE ROUTES ====================
`;

  // Insert staging routes right before the Vite middleware / static frontend serving
  const insertIndex = content.indexOf('// -------------------------------------------------------------\n// Vite Middleware / Static Frontend Serving');
  if (insertIndex !== -1) {
    content = content.slice(0, insertIndex) + stagingRoutesCode + '\n' + content.slice(insertIndex);
    fs.writeFileSync('server.ts', content, 'utf8');
    console.log('server.ts updated with /api/staging routes');
  } else {
    console.error('Marker not found in server.ts');
  }
} else {
  console.log('Staging routes already exist in server.ts');
}
