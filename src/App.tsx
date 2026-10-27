/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StudentExamSession,
  ExamSettings,
  StudentAnswer,
  TabViolation,
} from './types/cbt';
import { QUESTIONS_DATA, EXAM_METADATA } from './data/examData';
import {
  loadSettings,
  saveSettings,
  loadCurrentSession,
  saveCurrentSession,
  clearCurrentSession,
  loadAllSessions,
  saveAllSessions,
  commitStudentSubmission,
  resetStudentSessionForRetake,
  mergeSessionLists,
} from './utils/storage';
import { calculateExamScores } from './utils/scoring';
import {
  apiGetSettings,
  apiGetAllSessions,
  apiStartSession,
  apiSaveProgress,
  apiSubmitSession,
  setCachedTeacherPin,
  getCachedTeacherPin,
} from './utils/api';
import { FloralDecorations } from './components/FloralDecorations';
import { StudentLogin } from './components/student/StudentLogin';
import { CbtExamHeader } from './components/student/CbtExamHeader';
import { QuestionView } from './components/student/QuestionView';
import { QuestionNavigation } from './components/student/QuestionNavigation';
import { ConfirmSubmitModal } from './components/student/ConfirmSubmitModal';
import { TabSwitchWarningModal } from './components/student/TabSwitchWarningModal';
import { StudentFinishedView } from './components/student/StudentFinishedView';
import { TeacherDashboard } from './components/teacher/TeacherDashboard';
import { Lock, GraduationCap, X, AlertTriangle } from 'lucide-react';

export default function App() {
  const [settings, setSettings] = useState<ExamSettings>(() => loadSettings());
  const [allSessions, setAllSessions] = useState<StudentExamSession[]>(() =>
    loadAllSessions()
  );
  const [currentSession, setCurrentSession] =
    useState<StudentExamSession | null>(() => loadCurrentSession());

  // Navigation views: 'student-login' | 'student-cbt' | 'student-finished' | 'teacher-dashboard'
  const [view, setView] = useState<
    'student-login' | 'student-cbt' | 'student-finished' | 'teacher-dashboard'
  >(() => {
    try {
      if (typeof window !== 'undefined') {
        const activeView = sessionStorage.getItem('cbt_active_view');
        if (activeView === 'teacher-dashboard') {
          return 'teacher-dashboard';
        }
      }
    } catch (_) {}
    const existing = loadCurrentSession();
    if (existing) {
      if (existing.status === 'in-progress') return 'student-cbt';
      return 'student-finished';
    }
    return 'student-login';
  });

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [fontSizeLevel, setFontSizeLevel] = useState<
    'normal' | 'large' | 'xlarge'
  >('normal');
  const [syncStatus, setSyncStatus] = useState<'saved' | 'saving' | 'offline'>('saved');
  const progressDebounceTimerRef = useRef<any>(null);

  // Modals
  const [isConfirmSubmitOpen, setIsConfirmSubmitOpen] = useState(false);
  const [isTabModalOpen, setIsTabModalOpen] = useState(false);
  const [isTabFatal, setIsTabFatal] = useState(false);

  // Teacher PIN modal
  const [isTeacherPinOpen, setIsTeacherPinOpen] = useState(false);
  const [teacherPin, setTeacherPin] = useState('');
  const [teacherPinError, setTeacherPinError] = useState<string | null>(null);

  // Time remaining in seconds
  const [timeRemainingSeconds, setTimeRemainingSeconds] = useState(
    settings.durationMinutes * 60
  );

  // Submission lock mutex to prevent race conditions
  const isSubmittingRef = useRef(false);

  // Persist current view in sessionStorage so refreshing (F5) doesn't kick teacher out
  useEffect(() => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('cbt_active_view', view);
      }
    } catch (_) {}
  }, [view]);

  // Initial fetch of server sessions if teacher view is active on reload
  useEffect(() => {
    if (view === 'teacher-dashboard') {
      const pin = getCachedTeacherPin();
      apiGetAllSessions(pin)
        .then((remoteSessions) => {
          const cachedSessions = loadAllSessions();
          const merged = mergeSessionLists(remoteSessions, cachedSessions);
          setAllSessions(merged);
          saveAllSessions(merged);
        })
        .catch(() => {
          setAllSessions(loadAllSessions());
        });
    }
  }, [view]);

  // Initial fetch of server settings
  useEffect(() => {
    apiGetSettings()
      .then((s) => {
        setSettings(s);
        saveSettings(s);
      })
      .catch((err) => {
        console.warn('Loaded settings from local storage cache:', err);
      });
  }, []);

  // Discreet teacher trigger via shortcut (Alt + G or Ctrl + Shift + G) or URL hash (#guru / ?guru=true)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        (e.altKey && e.key.toLowerCase() === 'g') ||
        (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'g')
      ) {
        e.preventDefault();
        setIsTeacherPinOpen(true);
        setTeacherPinError(null);
      }
    };

    const checkHashOrQuery = () => {
      if (
        window.location.hash === '#guru' ||
        window.location.search.includes('guru=true')
      ) {
        setIsTeacherPinOpen(true);
        setTeacherPinError(null);
      }
    };

    checkHashOrQuery();
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('hashchange', checkHashOrQuery);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('hashchange', checkHashOrQuery);
    };
  }, []);

  // Re-calculate remaining seconds when in CBT
  useEffect(() => {
    if (view !== 'student-cbt' || !currentSession) return;

    const calculateRemaining = () => {
      const start = new Date(currentSession.startTime).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - start) / 1000);
      const totalAllowed = settings.durationMinutes * 60;
      return Math.max(0, totalAllowed - elapsedSeconds);
    };

    setTimeRemainingSeconds(calculateRemaining());

    const interval = setInterval(() => {
      const remaining = calculateRemaining();
      setTimeRemainingSeconds(remaining);

      // Auto-submit when time expires
      if (remaining <= 0 && !isSubmittingRef.current) {
        handleFinalSubmit('auto-time', 'Waktu Ujian Habis');
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [view, currentSession, settings.durationMinutes]);

  // Tab switching and page visibility detection
  useEffect(() => {
    if (view !== 'student-cbt' || !currentSession) return;

    const handleViolation = (type: 'visibility_hidden' | 'window_blur') => {
      if (isSubmittingRef.current) return;

      const desc =
        type === 'visibility_hidden'
          ? 'Murid berpindah tab atau meminimalkan jendela browser.'
          : 'Jendela ujian kehilangan fokus kursor/layar.';

      const newViolation: TabViolation = {
        timestamp: new Date().toISOString(),
        type,
        description: desc,
      };

      const updatedViolations = [
        ...(currentSession.tabViolations || []),
        newViolation,
      ];
      const count = updatedViolations.length;

      const updatedSession: StudentExamSession = {
        ...currentSession,
        tabViolations: updatedViolations,
      };

      setCurrentSession(updatedSession);
      saveCurrentSession(updatedSession);

      // Realtime violation sync to server
      apiSaveProgress(updatedSession.id, {
        answers: updatedSession.answers,
        reviewFlags: updatedSession.reviewFlags,
        tabViolations: updatedViolations,
      }).catch(() => {});

      // Evaluate according to settings.tabSwitchRule
      const rule = settings.tabSwitchRule;
      if (rule === 'disabled') return;

      const fatalThreshold =
        rule === 'instant' ? 1 : rule === 'warning-2' ? 3 : 4;

      if (count >= fatalThreshold) {
        setIsTabFatal(true);
        setIsTabModalOpen(true);
      } else {
        setIsTabFatal(false);
        setIsTabModalOpen(true);
      }
    };

    const onVisibilityChange = () => {
      if (document.hidden) {
        handleViolation('visibility_hidden');
      }
    };

    const onBlur = () => {
      handleViolation('window_blur');
    };

    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onBlur);

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onBlur);
    };
  }, [view, currentSession, settings.tabSwitchRule]);

  // Handle student answering a question with realtime server sync
  const handleAnswerChange = useCallback(
    (newAnswer: StudentAnswer) => {
      if (!currentSession) return;
      const qId = QUESTIONS_DATA[currentQuestionIndex].id;
      const updatedAnswers = {
        ...currentSession.answers,
        [qId]: newAnswer,
      };

      const updatedSession: StudentExamSession = {
        ...currentSession,
        answers: updatedAnswers,
      };

      setCurrentSession(updatedSession);
      saveCurrentSession(updatedSession);

      // Debounced realtime sync to server
      setSyncStatus('saving');
      if (progressDebounceTimerRef.current) {
        clearTimeout(progressDebounceTimerRef.current);
      }
      progressDebounceTimerRef.current = setTimeout(async () => {
        try {
          const success = await apiSaveProgress(updatedSession.id, {
            answers: updatedAnswers,
            reviewFlags: updatedSession.reviewFlags,
            tabViolations: updatedSession.tabViolations,
          });
          setSyncStatus(success ? 'saved' : 'offline');
        } catch (_) {
          setSyncStatus('offline');
        }
      }, 700);
    },
    [currentSession, currentQuestionIndex]
  );

  // Toggle review flag
  const handleToggleReviewFlag = useCallback(() => {
    if (!currentSession) return;
    const qId = QUESTIONS_DATA[currentQuestionIndex].id;
    const currentFlag = Boolean(currentSession.reviewFlags[qId]);
    const updatedFlags = {
      ...currentSession.reviewFlags,
      [qId]: !currentFlag,
    };

    const updatedSession: StudentExamSession = {
      ...currentSession,
      reviewFlags: updatedFlags,
    };

    setCurrentSession(updatedSession);
    saveCurrentSession(updatedSession);

    // Sync flags to server
    apiSaveProgress(updatedSession.id, {
      answers: updatedSession.answers,
      reviewFlags: updatedFlags,
      tabViolations: updatedSession.tabViolations,
    }).catch(() => {});
  }, [currentSession, currentQuestionIndex]);

  // Start Exam on Server Database (with local storage fallback)
  const handleStartExam = async (info: {
    name: string;
    studentClass: string;
    participantNumber: string;
    examCode: string;
  }) => {
    try {
      const { session } = await apiStartSession(info);
      setCurrentSession(session);
      saveCurrentSession(session);
      setCurrentQuestionIndex(0);
      setTimeRemainingSeconds(settings.durationMinutes * 60);
      isSubmittingRef.current = false;
      setSyncStatus('saved');
      setView('student-cbt');
    } catch (err: any) {
      if (err.status === 403 || (err.message && err.message.toLowerCase().includes('sudah'))) {
        throw err;
      }
      console.warn('apiStartSession offline fallback:', err);
      const newSession: StudentExamSession = {
        id: `cbt-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        studentName: info.name,
        studentClass: info.studentClass,
        participantNumber: info.participantNumber,
        examCode: info.examCode,
        startTime: new Date().toISOString(),
        status: 'in-progress',
        answers: {},
        reviewFlags: {},
        tabViolations: [],
        scores: calculateExamScores({}),
      };

      setCurrentSession(newSession);
      saveCurrentSession(newSession);
      setCurrentQuestionIndex(0);
      setTimeRemainingSeconds(settings.durationMinutes * 60);
      isSubmittingRef.current = false;
      setSyncStatus('offline');
      setView('student-cbt');
    }
  };

  // Submit Exam (Manual, Timeout, or Tab Violation)
  const handleFinalSubmit = useCallback(
    async (
      status: 'submitted' | 'auto-time' | 'auto-tab-violation',
      reason?: string
    ) => {
      if (isSubmittingRef.current || !currentSession) return;
      isSubmittingRef.current = true;

      const finishTime = new Date().toISOString();
      const startMs = new Date(currentSession.startTime).getTime();
      const finishMs = new Date(finishTime).getTime();
      const usedSeconds = Math.max(0, Math.floor((finishMs - startMs) / 1000));

      const scores = calculateExamScores(
        currentSession.answers,
        currentSession.scores?.essayRubrics
      );

      const finalSession: StudentExamSession = {
        ...currentSession,
        finishTime,
        durationSecondsUsed: usedSeconds,
        status,
        statusReason: reason,
        scores,
      };

      // Commit to local archive
      commitStudentSubmission(finalSession);
      setCurrentSession(finalSession);

      // Close all dialogs first so student UI is immediate
      setIsConfirmSubmitOpen(false);
      setIsTabModalOpen(false);
      setView('student-finished');

      // Sync submission to server database
      try {
        const remoteSession = await apiSubmitSession(finalSession.id, {
          answers: finalSession.answers,
          tabViolations: finalSession.tabViolations || [],
          status,
          statusReason: reason,
        });
        if (remoteSession) {
          setCurrentSession(remoteSession);
          saveCurrentSession(remoteSession);
        }
      } catch (err) {
        console.warn('Submitted locally, server sync error:', err);
      }
    },
    [currentSession]
  );

  // Teacher PIN check & server session fetch
  const handleVerifyTeacherPin = async (e: React.FormEvent) => {
    e.preventDefault();
    setTeacherPinError(null);
    const pin = teacherPin.trim();
    const upperPin = pin.toUpperCase();

    // Default PIN: GURU2026 or 1234
    if (upperPin === 'GURU2026' || upperPin === '1234' || upperPin === 'GURU') {
      setCachedTeacherPin(upperPin);
      setIsTeacherPinOpen(false);
      setTeacherPin('');
      try {
        const remoteSessions = await apiGetAllSessions(upperPin);
        const cachedSessions = loadAllSessions();
        const merged = mergeSessionLists(remoteSessions, cachedSessions);
        setAllSessions(merged);
        saveAllSessions(merged);
      } catch (err) {
        console.warn('Could not load remote sessions, using local storage cache:', err);
        setAllSessions(loadAllSessions());
      }
      setView('teacher-dashboard');
    } else {
      setTeacherPinError(
        'PIN Pengawas salah. Gunakan PIN default: GURU2026 atau 1234.'
      );
    }
  };

  const currentQ = QUESTIONS_DATA[currentQuestionIndex];

  return (
    <div className="min-h-screen bg-[#FAF8F5] text-slate-800 flex flex-col font-sans relative selection:bg-purple-200">
      {/* Background Floral Aesthetics */}
      <FloralDecorations variant="all" />

      {/* VIEW 1: STUDENT LOGIN / IDENTITY */}
      {view === 'student-login' && (
        <StudentLogin
          settings={settings}
          onStartExam={handleStartExam}
          onOpenTeacherPortal={() => {
            setIsTeacherPinOpen(true);
            setTeacherPinError(null);
          }}
        />
      )}

      {/* VIEW 2: CBT EXAM ACTIVE */}
      {view === 'student-cbt' && currentSession && (
        <div className="flex-1 flex flex-col relative z-10 pb-10">
          <CbtExamHeader
            session={currentSession}
            timeRemainingSeconds={timeRemainingSeconds}
            fontSizeLevel={fontSizeLevel}
            syncStatus={syncStatus}
            onChangeFontSize={setFontSizeLevel}
            onRequestSubmit={() => setIsConfirmSubmitOpen(true)}
          />

          <main className="max-w-7xl mx-auto px-4 pt-5 w-full flex-1">
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
              {/* Left/Center: Active Question Card (3 cols) */}
              <div className="lg:col-span-3">
                <QuestionView
                  question={currentQ}
                  studentAnswer={currentSession.answers[currentQ.id]}
                  isFlaggedForReview={Boolean(
                    currentSession.reviewFlags[currentQ.id]
                  )}
                  fontSizeLevel={fontSizeLevel}
                  onAnswerChange={handleAnswerChange}
                  onToggleReviewFlag={handleToggleReviewFlag}
                  onPrevQuestion={() =>
                    setCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
                  }
                  onNextQuestion={() =>
                    setCurrentQuestionIndex((prev) =>
                      Math.min(QUESTIONS_DATA.length - 1, prev + 1)
                    )
                  }
                  isFirst={currentQuestionIndex === 0}
                  isLast={currentQuestionIndex === QUESTIONS_DATA.length - 1}
                />
              </div>

              {/* Right: Question Navigation & Legend (1 col) */}
              <div className="lg:col-span-1 lg:sticky lg:top-20">
                <QuestionNavigation
                  questions={QUESTIONS_DATA}
                  currentQuestionIndex={currentQuestionIndex}
                  answers={currentSession.answers}
                  reviewFlags={currentSession.reviewFlags}
                  onSelectQuestion={(idx) => setCurrentQuestionIndex(idx)}
                  onRequestSubmit={() => setIsConfirmSubmitOpen(true)}
                />
              </div>
            </div>
          </main>

          {/* Confirm Submit Dialog */}
          <ConfirmSubmitModal
            isOpen={isConfirmSubmitOpen}
            questions={QUESTIONS_DATA}
            answers={currentSession.answers}
            reviewFlags={currentSession.reviewFlags}
            onConfirm={() =>
              handleFinalSubmit('submitted', 'Diselesaikan secara mandiri oleh murid')
            }
            onCancel={() => setIsConfirmSubmitOpen(false)}
          />

          {/* Tab Switch Warning Modal */}
          <TabSwitchWarningModal
            isOpen={isTabModalOpen}
            violationCount={currentSession.tabViolations?.length || 1}
            maxViolationsAllowed={
              settings.tabSwitchRule === 'instant'
                ? 1
                : settings.tabSwitchRule === 'warning-2'
                ? 2
                : 3
            }
            isFatal={isTabFatal}
            onDismiss={() => setIsTabModalOpen(false)}
            onAutoSubmit={() =>
              handleFinalSubmit(
                'auto-tab-violation',
                'Ujian dikunci otomatis karena melanggar batas perpindahan tab'
              )
            }
          />
        </div>
      )}

      {/* VIEW 3: STUDENT FINISHED (NO ANSWER KEYS REVEALED) */}
      {view === 'student-finished' && currentSession && (
        <StudentFinishedView
          session={currentSession}
          onReturnToHome={() => {
            clearCurrentSession();
            setCurrentSession(null);
            setView('student-login');
          }}
          onOpenTeacherPortal={() => {
            setIsTeacherPinOpen(true);
            setTeacherPinError(null);
          }}
        />
      )}

      {/* VIEW 4: TEACHER DASHBOARD */}
      {view === 'teacher-dashboard' && (
        <TeacherDashboard
          sessions={allSessions}
          settings={settings}
          onUpdateSettings={(newSettings) => {
            setSettings(newSettings);
            saveSettings(newSettings);
          }}
          onRefreshSessions={async () => {
            try {
              const fresh = await apiGetAllSessions(getCachedTeacherPin());
              const cachedSessions = loadAllSessions();
              const merged = mergeSessionLists(fresh, cachedSessions);
              setAllSessions(merged);
              saveAllSessions(merged);
            } catch (err) {
              console.warn('Refresh from server notice:', err);
              setAllSessions(loadAllSessions());
            }
          }}
          onReturnToCbt={() => {
            try {
              if (typeof window !== 'undefined') {
                sessionStorage.removeItem('cbt_active_view');
              }
            } catch (_) {}
            const cur = loadCurrentSession();
            if (cur && cur.status === 'in-progress') {
              setView('student-cbt');
            } else if (cur) {
              setView('student-finished');
            } else {
              setView('student-login');
            }
          }}
        />
      )}

      {/* TEACHER ACCESS PIN MODAL */}
      {isTeacherPinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-purple-100 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Lock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-sm">
                    Akses Portal Guru
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Masukkan PIN Pengawas Ujian
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsTeacherPinOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {teacherPinError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {teacherPinError}
              </div>
            )}

            <form onSubmit={handleVerifyTeacherPin} className="space-y-4">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  PIN Pengawas (Default: <code>GURU2026</code>)
                </label>
                <input
                  type="password"
                  autoFocus
                  required
                  value={teacherPin}
                  onChange={(e) => setTeacherPin(e.target.value)}
                  placeholder="Ketik PIN guru..."
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-300 text-sm text-center font-mono tracking-widest focus:border-purple-600 focus:ring-2 focus:ring-purple-200"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsTeacherPinOpen(false)}
                  className="flex-1 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-xs cursor-pointer"
                >
                  Masuk Portal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
