import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

// 1. Update Teacher PIN Verification with Rate Limiting and Env Config
const newTeacherPinHelper = `
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
        error: \`Terlalu banyak percobaan PIN gagal. Coba lagi dalam \${rateCheck.retryAfterSeconds} detik.\`,
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
`;

content = content.replace(
  /\/\/ Teacher PIN verification helper\nfunction verifyTeacherPin\(req: Request\): boolean \{[\s\S]*?return validPins\.includes\(pin\);\n\}/,
  newTeacherPinHelper.trim()
);

// 2. Strip sessionToken from GET /api/sessions and GET /api/staging/sessions
content = content.replace(
  "res.json({\n    success: true,\n    sessions: dbCache.sessions,\n  });",
  "const sanitizedOperational = dbCache.sessions.map(({ sessionToken, ...rest }) => rest);\n  res.json({\n    success: true,\n    sessions: sanitizedOperational,\n  });"
);

content = content.replace(
  "const sessions = colSnap.docs.map((d) => d.data() as StudentExamSession);\n    res.json({ success: true, sessions, mode: 'staging' });",
  "const sessions = colSnap.docs.map((d) => d.data() as StudentExamSession & { sessionToken?: string });\n    const sanitizedStaging = sessions.map(({ sessionToken, ...rest }) => rest);\n    res.json({ success: true, sessions: sanitizedStaging, mode: 'staging' });"
);

// 3. Add token validation to PUT /api/staging/sessions/:id/progress
const stagingProgressTarget = `    const existingData = targetDoc.data();
    const updatedAnswers = { ...(existingData.answers || {}), ...(answers || {}) };`;

const stagingProgressReplacement = `    const existingData = targetDoc.data() as StudentExamSession & { sessionToken?: string };
    const token = req.headers['x-session-token'] || req.body?.sessionToken;
    if (!token || !existingData.sessionToken || existingData.sessionToken !== token) {
      res.status(403).json({ success: false, error: 'Akses ditolak: token sesi murid tidak valid atau tidak disertakan.' });
      return;
    }
    if (existingData.status !== 'in-progress') {
      res.json({ success: true, message: 'Sesi telah diserahkan sebelumnya.' });
      return;
    }
    const updatedAnswers = { ...(existingData.answers || {}), ...(answers || {}) };`;

content = content.replace(stagingProgressTarget, stagingProgressReplacement);

// 4. Add token validation to POST /api/staging/sessions/:id/submit
const stagingSubmitTarget = `    const existingData = targetDoc.data() as StudentExamSession;
    const finalAnswers = { ...(existingData.answers || {}), ...(answers || {}) };`;

const stagingSubmitReplacement = `    const existingData = targetDoc.data() as StudentExamSession & { sessionToken?: string };
    const token = req.headers['x-session-token'] || req.body?.sessionToken;
    if (!token || !existingData.sessionToken || existingData.sessionToken !== token) {
      res.status(403).json({ success: false, error: 'Akses ditolak: token sesi murid tidak valid atau tidak disertakan.' });
      return;
    }
    const finalAnswers = { ...(existingData.answers || {}), ...(answers || {}) };`;

content = content.replace(stagingSubmitTarget, stagingSubmitReplacement);

// 5. Add Missing Staging Endpoints: /rubric, /schedule, /logs
const missingStagingEndpoints = `
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

    const colSnap = await fGetDocs(fCollection(firestoreDb, \`\${STAGING_EXAM_PATH}/sessions\`));
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

    const configRef = fDoc(firestoreDb, \`\${STAGING_EXAM_PATH}/config/settings\`);
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
      details: \`Jadwal Staging: \${ac.schedule.startDate} \${ac.schedule.startTime} s.d. \${ac.schedule.endDate} \${ac.schedule.endTime} (\${ac.schedule.timezone})\`,
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
    const configRef = fDoc(firestoreDb, \`\${STAGING_EXAM_PATH}/config/settings\`);
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
`;

if (!content.includes('/api/staging/sessions/:id/rubric')) {
  content = content.replace(
    '// ==================== END STAGING FIRESTORE ROUTES ====================',
    missingStagingEndpoints + '\n// ==================== END STAGING FIRESTORE ROUTES ===================='
  );
}

fs.writeFileSync('server.ts', content, 'utf8');
console.log('server.ts updated with rate limiting, token enforcement, session sanitization, and missing staging routes');
