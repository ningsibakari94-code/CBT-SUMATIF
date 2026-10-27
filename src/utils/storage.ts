import {
  ExamSettings,
  StudentExamSession,
  EssayRubricScore,
  StudentAnswer,
  TabViolation,
  AppAccessControl,
} from '../types/cbt';
import { calculateExamScores } from './scoring';
import {
  apiGetSettings,
  apiSaveSettings,
  apiGetAllSessions,
  apiSubmitSession,
  apiUpdateRubric,
  apiResetStudent,
  apiClearAllSessions,
  apiSeedDemo,
  getCachedTeacherPin,
  clearStudentSessionToken,
  isStagingMode,
} from './api';

export function getAllSessionsStorageKey(): string {
  return isStagingMode() ? 'cbt_staging_sessions_v1' : 'cbt_all_student_sessions_v1';
}

const STORAGE_KEYS = {
  CURRENT_SESSION: 'cbt_current_session_v1',
  SETTINGS: 'cbt_exam_settings_v1',
};

export const DEFAULT_ACCESS_CONTROL: AppAccessControl = {
  status: 'open',
  lockReason: '',
  schedule: {
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    timezone: 'Asia/Makassar',
    isScheduleEnabled: false,
  },
  logs: [],
};

export const DEFAULT_SETTINGS: ExamSettings = {
  durationMinutes: 60,
  examCode: '',
  codeRequired: false,
  tabSwitchRule: 'warning-2', // 'instant' | 'warning-2' | 'warning-3' | 'disabled'
  kkmScore: 75,
  preventRetake: true,
  accessControl: DEFAULT_ACCESS_CONTROL,
};

function isStorageAvailable(): boolean {
  try {
    return typeof window !== 'undefined' && typeof localStorage !== 'undefined';
  } catch (_) {
    return false;
  }
}

export function loadSettings(): ExamSettings {
  try {
    if (isStorageAvailable()) {
      const raw = localStorage.getItem(STORAGE_KEYS.SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        return { ...DEFAULT_SETTINGS, ...parsed, codeRequired: false, accessControl: { ...DEFAULT_ACCESS_CONTROL, ...(parsed.accessControl || {}) } };
      }
    }
  } catch (err) {
    console.error('Failed to load settings from storage', err);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: ExamSettings): void {
  try {
    if (isStorageAvailable()) {
      localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    }
    // Asynchronously sync to server
    apiSaveSettings(settings, getCachedTeacherPin()).catch((err) => {
      console.warn('Could not sync settings to server:', err);
    });
  } catch (err) {
    console.error('Failed to save settings', err);
  }
}

export function loadCurrentSession(): StudentExamSession | null {
  try {
    if (isStorageAvailable()) {
      const raw = localStorage.getItem(STORAGE_KEYS.CURRENT_SESSION);
      if (raw) {
        return JSON.parse(raw);
      }
    }
  } catch (err) {
    console.error('Failed to load current session', err);
  }
  return null;
}

export function saveCurrentSession(session: StudentExamSession): void {
  try {
    if (isStorageAvailable()) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_SESSION, JSON.stringify(session));
    }
  } catch (err) {
    console.error('Failed to save current session', err);
  }
}

export function clearCurrentSession(): void {
  try {
    if (isStorageAvailable()) {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_SESSION);
    }
    clearStudentSessionToken();
  } catch (err) {
    console.error('Failed to clear current session', err);
  }
}

export function loadAllSessions(): StudentExamSession[] {
  try {
    if (isStorageAvailable()) {
      const raw = localStorage.getItem(getAllSessionsStorageKey());
      if (raw) {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    }
  } catch (err) {
    console.error('Failed to load all sessions', err);
  }
  return [];
}

export function saveAllSessions(sessions: StudentExamSession[]): void {
  try {
    if (isStorageAvailable()) {
      localStorage.setItem(getAllSessionsStorageKey(), JSON.stringify(sessions));
    }
  } catch (err) {
    console.error('Failed to save sessions list', err);
  }
}

/**
 * Merges two versions of a single student session, preserving all answered questions,
 * finished status, rubric scores, and tab violations without loss of data.
 */
export function mergeSingleSession(
  primary: StudentExamSession,
  secondary: StudentExamSession
): StudentExamSession {
  const isSecondaryFinished = secondary.status !== 'in-progress';
  const isPrimaryFinished = primary.status !== 'in-progress';

  // Base selection: if one is finished and the other is still in-progress, prefer finished
  const base = isSecondaryFinished && !isPrimaryFinished ? secondary : primary;
  const other = base === primary ? secondary : primary;

  // Merge answers: union of questions, keeping whichever answer has substantive content
  const mergedAnswers: Record<number, StudentAnswer> = { ...(other.answers || {}) };
  for (const [qIdStr, ans] of Object.entries(base.answers || {})) {
    const qId = Number(qIdStr);
    const existing = mergedAnswers[qId];
    if (!existing) {
      mergedAnswers[qId] = ans;
    } else {
      mergedAnswers[qId] = {
        singleChoice: ans.singleChoice || existing.singleChoice,
        multiChoices:
          ans.multiChoices && ans.multiChoices.length > 0
            ? ans.multiChoices
            : existing.multiChoices,
        matchedPairs: {
          ...(existing.matchedPairs || {}),
          ...(ans.matchedPairs || {}),
        },
        shortAnswer:
          ans.shortAnswer && ans.shortAnswer.trim()
            ? ans.shortAnswer
            : existing.shortAnswer,
        essayText:
          ans.essayText &&
          ans.essayText.trim().length >= (existing.essayText?.trim().length || 0)
            ? ans.essayText
            : existing.essayText || ans.essayText,
      };
    }
  }

  // Merge review flags
  const mergedReviewFlags = {
    ...(other.reviewFlags || {}),
    ...(base.reviewFlags || {}),
  };

  // Merge tab violations (deduplicating by timestamp + type)
  const violationMap = new Map<string, TabViolation>();
  [...(other.tabViolations || []), ...(base.tabViolations || [])].forEach((v) => {
    if (v && v.timestamp) {
      const key = `${v.timestamp}_${v.type}`;
      if (!violationMap.has(key)) {
        violationMap.set(key, v);
      }
    }
  });
  const mergedViolations = Array.from(violationMap.values());

  // Merge essay rubrics if evaluated
  const baseRubrics = base.scores?.essayRubrics || {};
  const otherRubrics = other.scores?.essayRubrics || {};
  const mergedEssayRubrics = { ...otherRubrics, ...baseRubrics };

  // Recalculate scores with combined answers and rubrics
  const recalculatedScores = calculateExamScores(mergedAnswers, mergedEssayRubrics);

  return {
    ...base,
    studentName: base.studentName || other.studentName,
    studentClass: base.studentClass || other.studentClass,
    participantNumber: base.participantNumber || other.participantNumber,
    startTime: base.startTime || other.startTime,
    finishTime: base.finishTime || other.finishTime,
    durationSecondsUsed: Math.max(
      base.durationSecondsUsed || 0,
      other.durationSecondsUsed || 0
    ),
    status:
      isPrimaryFinished || isSecondaryFinished
        ? base.status !== 'in-progress'
          ? base.status
          : other.status
        : 'in-progress',
    statusReason: base.statusReason || other.statusReason,
    answers: mergedAnswers,
    reviewFlags: mergedReviewFlags,
    tabViolations: mergedViolations,
    scores: recalculatedScores,
  };
}

/**
 * Fail-Safe Merging of two session lists without creating duplicates.
 * Matches sessions by unique ID or participantNumber.
 * Never allows an empty response to wipe out existing data.
 */
export function mergeSessionLists(
  incomingList: StudentExamSession[],
  existingList: StudentExamSession[]
): StudentExamSession[] {
  const safeIncoming = Array.isArray(incomingList) ? incomingList : [];
  const safeExisting = Array.isArray(existingList) ? existingList : [];

  if (safeIncoming.length === 0) {
    return safeExisting;
  }
  if (safeExisting.length === 0) {
    return safeIncoming;
  }

  const resultMap = new Map<string, StudentExamSession>();

  const getSessionKey = (s: StudentExamSession): string => {
    if (s.participantNumber && s.participantNumber.trim()) {
      return `num_${s.participantNumber.trim().toLowerCase()}`;
    }
    return `id_${s.id}`;
  };

  for (const session of safeExisting) {
    if (!session || !session.id) continue;
    const key = getSessionKey(session);
    resultMap.set(key, session);
  }

  for (const session of safeIncoming) {
    if (!session || !session.id) continue;
    const key = getSessionKey(session);
    const existing = resultMap.get(key);
    if (!existing) {
      resultMap.set(key, session);
    } else {
      const merged = mergeSingleSession(session, existing);
      resultMap.set(key, merged);
    }
  }

  return Array.from(resultMap.values());
}

/**
 * Commits a submitted session to the permanent archive with fail-safe merging.
 * Guard against duplicate submissions by checking existing ID or participantNumber.
 */
export function commitStudentSubmission(session: StudentExamSession): boolean {
  try {
    const all = loadAllSessions();

    // Calculate updated scores if not already done
    const updatedScores = calculateExamScores(
      session.answers,
      session.scores?.essayRubrics
    );
    const finalSession: StudentExamSession = {
      ...session,
      scores: updatedScores,
    };

    // Use fail-safe list merging to prevent duplicate rows for the same participant
    const mergedList = mergeSessionLists([finalSession], all);

    saveAllSessions(mergedList);
    saveCurrentSession(finalSession);

    // Asynchronously submit to server
    apiSubmitSession(finalSession.id, {
      answers: finalSession.answers,
      tabViolations: finalSession.tabViolations || [],
      status: finalSession.status === 'in-progress' ? 'submitted' : finalSession.status,
      statusReason: finalSession.statusReason,
    }).catch((err) => {
      console.warn('Offline backup: submitted locally, server sync error:', err);
    });

    return true;
  } catch (err) {
    console.error('Failed to commit student submission', err);
    return false;
  }
}

export function updateSessionEssayRubric(
  sessionId: string,
  questionId: number,
  rubric: EssayRubricScore
): StudentExamSession | null {
  try {
    const all = loadAllSessions();
    const target = all.find((s) => s.id === sessionId);
    if (!target) return null;

    const currentRubrics = target.scores.essayRubrics || {
      9: { identifikasi: 0, model: 0, hitungan: 0, penalaran: 0, kesimpulan: 0 },
      10: { identifikasi: 0, model: 0, hitungan: 0, penalaran: 0, kesimpulan: 0 },
    };

    currentRubrics[questionId] = rubric;

    const recalculated = calculateExamScores(target.answers, currentRubrics);
    target.scores = recalculated;

    saveAllSessions(all);

    // Also update currentSession if it's the same student active
    const cur = loadCurrentSession();
    if (cur && cur.id === sessionId) {
      cur.scores = recalculated;
      saveCurrentSession(cur);
    }

    // Sync with server
    apiUpdateRubric(sessionId, questionId, rubric).catch((err) => {
      console.warn('Could not sync rubric to server:', err);
    });

    return target;
  } catch (err) {
    console.error('Failed to update rubric score', err);
    return null;
  }
}

export function deleteSession(sessionId: string): void {
  const all = loadAllSessions().filter((s) => s.id !== sessionId);
  saveAllSessions(all);
}

export function resetStudentSessionForRetake(participantNumber: string): void {
  const all = loadAllSessions().filter(
    (s) => s.participantNumber !== participantNumber
  );
  saveAllSessions(all);
  const cur = loadCurrentSession();
  if (cur && cur.participantNumber === participantNumber) {
    clearCurrentSession();
  }

  // Sync to server
  apiResetStudent(participantNumber).catch((err) => {
    console.warn('Could not reset student on server:', err);
  });
}

/**
 * Generates realistic seed data for classroom demonstrations
 */
export function seedRealisticDemoSubmissions(): StudentExamSession[] {
  const sampleNames = [
    { name: 'Aditya Pratama', class: 'XI.1', num: '1101' },
    { name: 'Alya Ramadhani', class: 'XI.1', num: '1102' },
    { name: 'Bima Satria', class: 'XI.1', num: '1103' },
    { name: 'Cantika Putri', class: 'XI.1', num: '1104' },
    { name: 'Dafa Alfarizi', class: 'XI.1', num: '1105' },
    { name: 'Dewi Lestari', class: 'XI.2', num: '1106' },
    { name: 'Farhan Maulana', class: 'XI.2', num: '1107' },
    { name: 'Gita Maharani', class: 'XI.2', num: '1108' },
    { name: 'Ilham Hidayat', class: 'XI.2', num: '1109' },
    { name: 'Keisha Anindya', class: 'XI.2', num: '1110' },
    { name: 'Muhammad Rizky', class: 'XI.3', num: '1111' },
    { name: 'Nabila Zahra', class: 'XI.3', num: '1112' },
    { name: 'Rafi Kurniawan', class: 'XI.3', num: '1113' },
    { name: 'Siti Nurhaliza', class: 'XI.1', num: '1114' },
    { name: 'Yusuf Maulana', class: 'XI.2', num: '1115' },
  ];

  const now = new Date();

  const generated: StudentExamSession[] = sampleNames.map((s, idx) => {
    const isHighScorer = idx < 5;
    const isMidScorer = idx >= 5 && idx < 11;

    // Build answers
    const answers: StudentExamSession['answers'] = {
      1: { singleChoice: isHighScorer || isMidScorer ? 'C' : 'B' },
      2: { singleChoice: isHighScorer ? 'B' : idx % 2 === 0 ? 'B' : 'A' },
      3: {
        multiChoices: isHighScorer
          ? ['B', 'C', 'D']
          : isMidScorer
          ? ['B', 'C']
          : ['A', 'B'],
      },
      4: {
        multiChoices: isHighScorer
          ? ['A', 'B', 'C', 'D']
          : isMidScorer
          ? ['A', 'B', 'C']
          : ['A', 'D'],
      },
      5: {
        matchedPairs: isHighScorer
          ? { '1': 'D', '2': 'B', '3': 'C', '4': 'A' }
          : { '1': 'D', '2': 'B', '3': 'C', '4': 'E' },
      },
      6: {
        matchedPairs: isHighScorer
          ? { '1': 'A', '2': 'B', '3': 'C', '4': 'D' }
          : { '1': 'A', '2': 'B', '3': 'E', '4': 'D' },
      },
      7: {
        shortAnswer: isHighScorer
          ? 'g(x) = 2x + 5'
          : isMidScorer
          ? '2x + 5'
          : '2x + 3',
      },
      8: {
        shortAnswer: isHighScorer ? '8,31' : isMidScorer ? '8.31' : '8',
      },
      9: {
        essayText:
          'a. Variabel x = jarak tempuh dalam km. Model biaya sebelum tambahan: f(x) = 4.000x + 7.000.\nb. Tambahan layanan 15% dari seluruh biaya: g(u) = 1,15u. Urutan proses adalah f(x) dihitung dahulu kemudian dikenakan g(u), sehingga komposisinya adalah (g ∘ f)(x) = 1,15(4.000x + 7.000) = 4.600x + 8.050.\nc. Untuk jarak 8 km: (g ∘ f)(8) = 4.600(8) + 8.050 = 36.800 + 8.050 = Rp44.850.\nd. Model usulan petugas: h(x) = 1,15(4.000x) + 7.000 = 4.600x + 7.000. Untuk 8 km: h(8) = 4.600(8) + 7.000 = 36.800 + 7.000 = Rp43.800.\ne. Selisih biaya kedua cara adalah Rp44.850 - Rp43.800 = Rp1.050. Ketentuan perusahaan lebih tepat secara konteks perjanjian awal karena biaya tambahan 15% dinyatakan berlaku atas seluruh biaya sebelum penanganan.',
      },
      10: {
        essayText:
          'a. Model pertumbuhan saldo: S(t) = 200.000(1,05)^t karena saldo awal Rp200.000 dan bertambah 5% setiap periode (faktor pengali 1 + 0,05 = 1,05).\nb. Fungsi invers untuk menentukan waktu berdasarkan saldo x:\nx = 200.000(1,05)^t\n(1,05)^t = x / 200.000\nt = S⁻¹(x) = log(x / 200.000) / log(1,05)\nc. Menghitung waktu untuk target saldo Rp300.000:\nt = log(300.000 / 200.000) / log(1,05) = log(1,5) / log(1,05) ≈ 0,17609 / 0,021189 ≈ 8,31 periode.\nd. Karena waktu menabung harus berupa bilangan bulat, maka periode minimum adalah pembulatan ke atas yaitu 9 periode.\ne. Uji saldo:\nPada periode ke-8: S(8) = 200.000(1,05)^8 ≈ Rp295.492 (kurang dari Rp300.000)\nPada periode ke-9: S(9) = 200.000(1,05)^9 ≈ Rp310.266 (melampaui target Rp300.000)\nKesimpulan: Murid harus menabung minimal 9 periode penuh agar kebutuhan tabungan pendidikan tercapai.',
      },
    };

    const essayRubrics: Record<number, EssayRubricScore> = isHighScorer
      ? {
          9: {
            identifikasi: 2,
            model: 2,
            hitungan: 3,
            penalaran: 2,
            kesimpulan: 1,
            feedback: 'Sangat rapi, model dan perhitungan runtut dan tepat.',
          },
          10: {
            identifikasi: 2,
            model: 2,
            hitungan: 3,
            penalaran: 2,
            kesimpulan: 1,
            feedback: 'Invers logaritma dan penafsiran periode bulat sempurna.',
          },
        }
      : isMidScorer
      ? {
          9: {
            identifikasi: 2,
            model: 2,
            hitungan: 2,
            penalaran: 2,
            kesimpulan: 1,
            feedback: 'Model sudah baik, ada sedikit ketelitian di hitungan.',
          },
          10: {
            identifikasi: 2,
            model: 1,
            hitungan: 2,
            penalaran: 2,
            kesimpulan: 1,
            feedback: 'Pembalikan invers logaritma sudah dipahami.',
          },
        }
      : {
          9: {
            identifikasi: 1,
            model: 1,
            hitungan: 2,
            penalaran: 1,
            kesimpulan: 1,
            feedback: 'Perlu latihan lebih lanjut pada perumusan fungsi komposisi.',
          },
          10: {
            identifikasi: 1,
            model: 1,
            hitungan: 1,
            penalaran: 1,
            kesimpulan: 1,
            feedback: 'Perhatikan sifat basis logaritma dan pembulatan periode.',
          },
        };

    const scores = calculateExamScores(answers, essayRubrics);

    const startMinutesAgo = 60 + idx * 5;
    const durationMins = 42 + (idx % 15);
    const start = new Date(now.getTime() - startMinutesAgo * 60000);
    const finish = new Date(start.getTime() + durationMins * 60000);

    // Mock tab violation for a couple students to demonstrate audit
    const tabViolations =
      idx === 3
        ? [
            {
              timestamp: new Date(start.getTime() + 15 * 60000).toISOString(),
              type: 'visibility_hidden' as const,
              description: 'Murid berpindah ke jendela / tab lain saat ujian berlangsung.',
            },
          ]
        : idx === 12
        ? [
            {
              timestamp: new Date(start.getTime() + 10 * 60000).toISOString(),
              type: 'window_blur' as const,
              description: 'Jendela ujian kehilangan fokus kursor.',
            },
            {
              timestamp: new Date(start.getTime() + 12 * 60000).toISOString(),
              type: 'visibility_hidden' as const,
              description: 'Tab browser disembunyikan/berpindah aplikasi.',
            },
          ]
        : [];

    return {
      id: `session-demo-${s.num}`,
      studentName: s.name,
      studentClass: s.class,
      participantNumber: s.num,
      examCode: 'MAT11-SUMATIF',
      startTime: start.toISOString(),
      finishTime: finish.toISOString(),
      durationSecondsUsed: durationMins * 60,
      status: 'submitted',
      answers,
      reviewFlags: {},
      tabViolations,
      scores,
    };
  });

  saveAllSessions(generated);
  return generated;
}

/**
 * Exports all student results to CSV
 */
export function generateStudentResultsCSV(sessions: StudentExamSession[]): string {
  const headers = [
    'No Peserta',
    'Nama Lengkap',
    'Kelas',
    'Status Ujian',
    'Waktu Mulai',
    'Waktu Selesai',
    'Durasi (Menit)',
    'Pelanggaran Tab',
    'Skor Q1',
    'Skor Q2',
    'Skor Q3',
    'Skor Q4',
    'Skor Q5',
    'Skor Q6',
    'Skor Q7',
    'Skor Q8',
    'Skor Q9 (Uraian)',
    'Skor Q10 (Uraian)',
    'Total Skor (Maks 38)',
    'Nilai Akhir (Skala 100)',
    'Status Kelulusan KKTP (75)',
  ];

  const rows = sessions.map((s) => {
    const q = s.scores?.perQuestion || {};
    const durationMins = s.durationSecondsUsed
      ? Math.round(s.durationSecondsUsed / 60)
      : '-';
    const finalScore = s.scores?.finalScore100 ?? 0;
    const isPassed = finalScore >= 75 ? 'Tuntas' : 'Belum Tuntas';
    return [
      `"${s.participantNumber}"`,
      `"${s.studentName}"`,
      `"${s.studentClass}"`,
      `"${s.status}"`,
      `"${new Date(s.startTime).toLocaleString('id-ID')}"`,
      `"${s.finishTime ? new Date(s.finishTime).toLocaleString('id-ID') : '-'}"`,
      durationMins,
      s.tabViolations?.length || 0,
      q[1] ?? 0,
      q[2] ?? 0,
      q[3] ?? 0,
      q[4] ?? 0,
      q[5] ?? 0,
      q[6] ?? 0,
      q[7] ?? 0,
      q[8] ?? 0,
      q[9] ?? 0,
      q[10] ?? 0,
      s.scores?.totalScore ?? 0,
      finalScore,
      `"${isPassed}"`,
    ].join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}
