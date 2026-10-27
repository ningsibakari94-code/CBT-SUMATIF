import React, { useState, useMemo, useEffect } from 'react';
import {
  StudentExamSession,
  ExamSettings,
} from '../../types/cbt';
import {
  EXAM_METADATA,
  QUESTIONS_DATA,
  ANSWER_KEYS_DATA,
  RUBRIC_ANALYTIC_ASPECTS,
} from '../../data/examData';
import {
  generateStudentResultsCSV,
  saveSettings,
  saveAllSessions,
  seedRealisticDemoSubmissions,
  clearCurrentSession,
} from '../../utils/storage';
import {
  apiSeedDemo,
  apiClearAllSessions,
  apiImportBackup,
  apiSaveSettings,
  getCachedTeacherPin,
  apiGetAccessControl,
  apiLockApp,
  apiUnlockApp,
  apiUpdateSchedule,
  apiGetAccessLogs,
} from '../../utils/api';
import { mergeSessionLists } from '../../utils/storage';
import { isStagingMode, setStagingMode, getCachedTeacherOperator, setCachedTeacherOperator } from '../../utils/api';
import { ClassAnalyticsView } from './ClassAnalyticsView';
import { StudentGradingModal } from './StudentGradingModal';
import {
  Users,
  BarChart3,
  BookOpen,
  Settings,
  Download,
  Trash2,
  Sparkles,
  ArrowLeft,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  ShieldAlert,
  Edit3,
  FileSpreadsheet,
  RefreshCw,
  AlertTriangle,
  Upload,
  Database,
  QrCode,
  Share2,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Unlock,
  Calendar,
  AlertCircle,
  Eye,
  FileText,
  Cloud,
} from 'lucide-react';

interface TeacherDashboardProps {
  sessions: StudentExamSession[];
  settings: ExamSettings;
  onUpdateSettings: (newSettings: ExamSettings) => void;
  onRefreshSessions: () => void;
  onReturnToCbt: () => void;
}

export const TeacherDashboard: React.FC<TeacherDashboardProps> = ({
  sessions,
  settings,
  onUpdateSettings,
  onRefreshSessions,
  onReturnToCbt,
}) => {
  const [activeTab, setActiveTab] = useState<
    'peserta' | 'analisis' | 'kisi_kisi' | 'pengaturan'
  >('peserta');

  const [searchQuery, setSearchQuery] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Currently inspected student modal
  const [selectedStudent, setSelectedStudent] =
    useState<StudentExamSession | null>(null);


  // Staging Mode & Operator Identity State
  const [isStaging, setIsStaging] = useState(isStagingMode());
  const [teacherOperator, setTeacherOperator] = useState(getCachedTeacherOperator());

  const handleToggleStagingMode = () => {
    const nextMode = !isStaging;
    setStagingMode(nextMode);
    setIsStaging(nextMode);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (nextMode) {
        url.searchParams.set('mode', 'staging');
      } else {
        url.searchParams.delete('mode');
      }
      window.history.replaceState({}, '', url.toString());
    }
    onRefreshSessions();
    fetchAccessControl();
  };

  const handleOperatorChange = (newOp: string) => {
    setTeacherOperator(newOp);
    setCachedTeacherOperator(newOp);
  };

  // Settings form state
  const [localSettings, setLocalSettings] = useState<ExamSettings>(settings);
  // Access Control & Scheduling State
  const [accessControl, setAccessControl] = useState<any>(null);
  const [accessEvaluation, setAccessEvaluation] = useState<any>(null);
  const [isLockModalOpen, setIsLockModalOpen] = useState(false);
  const [lockReasonInput, setLockReasonInput] = useState('Waktu mengajar / ujian telah selesai.');
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const [unlockReasonInput, setUnlockReasonInput] = useState('');
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);
  const [scheduleForm, setScheduleForm] = useState({
    startDate: '',
    startTime: '',
    endDate: '',
    endTime: '',
    timezone: 'Asia/Makassar',
    isScheduleEnabled: false,
  });
  const [accessActionMessage, setAccessActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [accessLogs, setAccessLogs] = useState<any[]>([]);

  // Backup Import Preview Modal State
  const [backupPreview, setBackupPreview] = useState<{
    isOpen: boolean;
    fileName: string;
    sessions: any[];
    settings?: any;
    studentNames: string[];
  } | null>(null);

  const fetchAccessControl = async () => {
    try {
      const res = await apiGetAccessControl();
      if (res?.accessControl) {
        setAccessControl(res.accessControl);
        setAccessEvaluation(res.evaluation);
        if (res.accessControl.schedule) {
          setScheduleForm({
            startDate: res.accessControl.schedule.startDate || '',
            startTime: res.accessControl.schedule.startTime || '',
            endDate: res.accessControl.schedule.endDate || '',
            endTime: res.accessControl.schedule.endTime || '',
            timezone: res.accessControl.schedule.timezone || 'Asia/Makassar',
            isScheduleEnabled: Boolean(res.accessControl.schedule.isScheduleEnabled),
          });
        }
        setAccessLogs(res.accessControl.logs || []);
      }
    } catch (err) {
      console.warn('Could not fetch access control on dashboard:', err);
    }
  };

  useEffect(() => {
    fetchAccessControl();
  }, []);

  const [settingsSavedAlert, setSettingsSavedAlert] = useState(false);

  // Share & QR Modal state
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [isLiveSyncActive, setIsLiveSyncActive] = useState(true);
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date>(new Date());
  const [isRefreshingManual, setIsRefreshingManual] = useState(false);

  // Live Auto-Refresh Polling from Server Database
  useEffect(() => {
    if (!isLiveSyncActive) return;
    const interval = setInterval(() => {
      onRefreshSessions();
      setLastRefreshedAt(new Date());
    }, 4000);
    return () => clearInterval(interval);
  }, [isLiveSyncActive, onRefreshSessions]);

  const handleManualRefresh = async () => {
    setIsRefreshingManual(true);
    try {
      await onRefreshSessions();
      setLastRefreshedAt(new Date());
    } finally {
      setTimeout(() => setIsRefreshingManual(false), 500);
    }
  };

  // Distinct classes for filter: standard XI.1 to XI.11 plus any existing
  const classOptions = useMemo(() => {
    const defaultClasses = [
      'XI.1',
      'XI.2',
      'XI.3',
      'XI.4',
      'XI.5',
      'XI.6',
      'XI.7',
      'XI.8',
      'XI.9',
      'XI.10',
      'XI.11',
    ];
    const set = new Set<string>(defaultClasses);
    sessions.forEach((s) => set.add(s.studentClass));
    return Array.from(set);
  }, [sessions]);

  // Filtered sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      const matchSearch =
        s.studentName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.participantNumber.toLowerCase().includes(searchQuery.toLowerCase());

      const matchClass =
        classFilter === 'all' || s.studentClass === classFilter;

      const matchStatus =
        statusFilter === 'all' ||
        (statusFilter === 'tuntas' && s.scores.finalScore100 >= settings.kkmScore) ||
        (statusFilter === 'belum_tuntas' && s.scores.finalScore100 < settings.kkmScore) ||
        (statusFilter === 'pelanggaran' && (s.tabViolations?.length || 0) > 0);

      return matchSearch && matchClass && matchStatus;
    });
  }, [sessions, searchQuery, classFilter, statusFilter, settings.kkmScore]);

  const handleDownloadCSV = () => {
    const csvContent = generateStudentResultsCSV(sessions);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Hasil_CBT_Sumatif_Matematika_XI_${new Date().toISOString().slice(0, 10)}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleBackupJSON = () => {
    const backupData = {
      exportDate: new Date().toISOString(),
      settings: localSettings,
      sessions,
    };
    const blob = new Blob([JSON.stringify(backupData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute(
      'download',
      `Backup_CBT_Matematika_XI_${new Date().toISOString().slice(0, 10)}.json`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportJSON = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed && Array.isArray(parsed.sessions)) {
          const names = parsed.sessions.map((s: any) => `${s.studentName || 'Tanpa Nama'} (${s.studentClass || '-'} No. ${s.participantNumber || '-'})`);
          setBackupPreview({
            isOpen: true,
            fileName: file.name,
            sessions: parsed.sessions,
            settings: parsed.settings,
            studentNames: names,
          });
        } else {
          alert('Format file cadangan tidak valid (wajib memiliki array sessions).');
        }
      } catch (err) {
        alert('Gagal membaca file JSON cadangan.');
      }
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleConfirmBackupMerge = async () => {
    if (!backupPreview) return;
    try {
      // Fail-Safe Merge incoming backup sessions with existing sessions without overwriting
      const mergedSessions = mergeSessionLists(backupPreview.sessions, sessions);
      saveAllSessions(mergedSessions);
      if (backupPreview.settings) {
        saveSettings(backupPreview.settings);
        onUpdateSettings(backupPreview.settings);
      }
      try {
        await apiImportBackup({
          sessions: mergedSessions,
          settings: backupPreview.settings,
        });
      } catch (err) {
        console.warn('Backup imported locally, server sync notice:', err);
      }
      await onRefreshSessions();
      alert(`Berhasil memulihkan cadangan! ${backupPreview.sessions.length} sesi digabungkan secara aman tanpa menimpa data yang ada.`);
      setBackupPreview(null);
    } catch (err: any) {
      alert('Gagal menerapkan pemulihan cadangan: ' + err.message);
    }
  };


  const handleLockNow = async () => {
    try {
      const res = await apiLockApp(lockReasonInput, 'Guru Pengawas');
      setIsLockModalOpen(false);
      setAccessActionMessage({
        type: 'success',
        text: 'Aplikasi web berhasil dikunci segera. Siswa baru atau pengubahan jawaban ditolak oleh server.',
      });
      await fetchAccessControl();
      setTimeout(() => setAccessActionMessage(null), 5000);
    } catch (err: any) {
      setAccessActionMessage({ type: 'error', text: err.message || 'Gagal mengunci aplikasi.' });
    }
  };

  const handleUnlockNow = async () => {
    try {
      const res = await apiUnlockApp('Guru Pengawas', unlockReasonInput);
      setIsUnlockModalOpen(false);
      setAccessActionMessage({
        type: 'success',
        text: 'Akses aplikasi berhasil dibuka kembali untuk murid.',
      });
      await fetchAccessControl();
      setTimeout(() => setAccessActionMessage(null), 5000);
    } catch (err: any) {
      setAccessActionMessage({ type: 'error', text: err.message || 'Gagal membuka akses aplikasi.' });
    }
  };

  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsScheduleLoading(true);
    try {
      await apiUpdateSchedule(scheduleForm, 'Guru Pengawas');
      setAccessActionMessage({
        type: 'success',
        text: 'Jadwal akses otomatis berhasil diterapkan pada server.',
      });
      await fetchAccessControl();
      setTimeout(() => setAccessActionMessage(null), 5000);
    } catch (err: any) {
      setAccessActionMessage({ type: 'error', text: err.message || 'Gagal memperbarui jadwal.' });
    } finally {
      setIsScheduleLoading(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    saveSettings(localSettings);
    onUpdateSettings(localSettings);
    try {
      await apiSaveSettings(localSettings);
    } catch (err) {
      console.warn('Settings saved locally, could not reach server immediately:', err);
    }
    setSettingsSavedAlert(true);
    setTimeout(() => setSettingsSavedAlert(false), 2500);
  };

  const handleLoadDemoData = async () => {
    if (
      window.confirm(
        'Muat 15 data murid simulasi ke server? (Data ini akan disimpan di basis data bersama untuk menguji fitur analisis kelas dan pemeriksaan guru dari berbagai perangkat).'
      )
    ) {
      try {
        await apiSeedDemo();
      } catch (err) {
        seedRealisticDemoSubmissions();
      }
      await onRefreshSessions();
    }
  };

  const handleClearAllData = async () => {
    if (
      window.confirm(
        'PERINGATAN: Apakah Anda yakin ingin MENGHAPUS SEMUA DATA hasil ujian seluruh murid di server? Tindakan ini tidak dapat dibatalkan.'
      )
    ) {
      try {
        await apiClearAllSessions();
      } catch (err) {
        console.warn('Clear server sessions notice:', err);
      }
      saveAllSessions([]);
      clearCurrentSession();
      await onRefreshSessions();
    }
  };

  return (
    <div className="min-h-screen bg-[#FAF8F5] pb-12 relative z-10 text-slate-800">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-purple-100 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onReturnToCbt}
              className="p-2 rounded-xl border border-slate-200 hover:bg-purple-50 hover:text-purple-700 transition-colors cursor-pointer"
              title="Kembali ke Tampilan Murid"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <h1 className="text-base md:text-lg font-extrabold text-slate-800">
                  Dashboard Guru & Pengawas
                </h1>
                <span className="px-2 py-0.5 rounded-md bg-purple-100 text-purple-800 text-xs font-bold">
                  Kelas XI
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Sumatif Matematika • Fungsi Komposisi & Invers
              </p>
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex items-center gap-2">
            {/* Live Sync Status indicator */}
            <div className="hidden lg:flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-[11px] font-semibold text-emerald-800">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Server Sync</span>
            </div>

            {/* Manual Refresh button */}
            <button
              type="button"
              onClick={handleManualRefresh}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-colors cursor-pointer ${
                isRefreshingManual ? 'opacity-70' : ''
              }`}
              title="Segarkan data terbaru dari basis data server"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-purple-700 ${isRefreshingManual ? 'animate-spin' : ''}`} />
              <span>Segarkan</span>
            </button>

            <button
              type="button"
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-900 border border-purple-200 text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <QrCode className="w-3.5 h-3.5 text-purple-700" />
              <span>Bagi Link / QR Siswa</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>Ekspor CSV</span>
            </button>
            <button
              type="button"
              onClick={onReturnToCbt}
              className="px-3.5 py-1.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold shadow-2xs transition-colors cursor-pointer"
            >
              Mode Ujian Murid
            </button>
          </div>
        </div>

        {/* Dashboard Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex items-center gap-1 border-t border-slate-100 overflow-x-auto text-xs md:text-sm font-bold">
          <button
            type="button"
            onClick={() => setActiveTab('peserta')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'peserta'
                ? 'border-purple-600 text-purple-800 bg-purple-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Daftar Peserta & Penilaian ({sessions.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('analisis')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'analisis'
                ? 'border-purple-600 text-purple-800 bg-purple-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Analisis Hasil & Psikometrik</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('kisi_kisi')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'kisi_kisi'
                ? 'border-purple-600 text-purple-800 bg-purple-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Kisi-kisi & Kunci Jawaban</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('pengaturan')}
            className={`py-3 px-4 border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer transition-colors ${
              activeTab === 'pengaturan'
                ? 'border-purple-600 text-purple-800 bg-purple-50/50'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>Pengaturan Ujian & Cadangan</span>
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 pt-6">
        {/* ================= TAB 1: DAFTAR PESERTA & PENILAIAN ================= */}
        {activeTab === 'peserta' && (
          <div className="space-y-5 animate-fadeIn">
            {/* Filter & Search Bar */}
            <div className="p-4 rounded-2xl bg-white border border-purple-100 shadow-2xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3 flex-1">
                {/* Search input */}
                <div className="relative min-w-[220px] flex-1 max-w-xs">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Cari nama atau no. absen..."
                    className="w-full pl-9 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-purple-500 text-slate-800"
                  />
                </div>

                {/* Filter Kelas */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <Filter className="w-3.5 h-3.5 text-slate-400" />
                  <span>Kelas:</span>
                  <select
                    value={classFilter}
                    onChange={(e) => setClassFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium"
                  >
                    <option value="all">Semua Kelas</option>
                    {classOptions.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Filter Status */}
                <div className="flex items-center gap-1.5 text-xs text-slate-600">
                  <span>Status:</span>
                  <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-medium"
                  >
                    <option value="all">Semua Status</option>
                    <option value="tuntas">Tuntas (≥ {settings.kkmScore})</option>
                    <option value="belum_tuntas">Belum Tuntas (&lt; {settings.kkmScore})</option>
                    <option value="pelanggaran">Ada Catatan Tab</option>
                  </select>
                </div>
              </div>

              {sessions.length === 0 && (
                <button
                  type="button"
                  onClick={handleLoadDemoData}
                  className="px-3 py-1.5 rounded-xl bg-purple-100 hover:bg-purple-200 text-purple-800 font-bold text-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-600" />
                  <span>Muat 15 Data Simulasi</span>
                </button>
              )}
            </div>

            {/* Student Table */}
            <div className="rounded-2xl bg-white border border-purple-100 shadow-2xs overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">No. Absen</th>
                      <th className="py-3 px-4">Nama Lengkap</th>
                      <th className="py-3 px-4">Kelas</th>
                      <th className="py-3 px-4">Waktu Pengerjaan</th>
                      <th className="py-3 px-4 text-center">Status & Tab</th>
                      <th className="py-3 px-4 text-center">Skor Objektif (18)</th>
                      <th className="py-3 px-4 text-center">Skor Uraian (20)</th>
                      <th className="py-3 px-4 text-center">Nilai Akhir</th>
                      <th className="py-3 px-4 text-center">Kelulusan</th>
                      <th className="py-3 px-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredSessions.length === 0 ? (
                      <tr>
                        <td
                          colSpan={10}
                          className="py-12 text-center text-slate-500"
                        >
                          Belum ada data murid yang sesuai.
                          {sessions.length === 0 && (
                            <div className="mt-3">
                              <button
                                type="button"
                                onClick={handleLoadDemoData}
                                className="px-4 py-2 bg-purple-700 text-white rounded-xl font-bold text-xs shadow-xs hover:bg-purple-800 cursor-pointer"
                              >
                                Muat Contoh 15 Murid Simulasi
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ) : (
                      filteredSessions.map((session) => {
                        const isPassed =
                          session.scores.finalScore100 >= settings.kkmScore;
                        const tabCount = session.tabViolations?.length || 0;

                        return (
                          <tr
                            key={session.id}
                            className="hover:bg-purple-50/30 transition-colors"
                          >
                            <td className="py-3 px-4 font-mono font-bold text-slate-900">
                              {session.participantNumber}
                            </td>
                            <td className="py-3 px-4 font-bold text-slate-900">
                              {session.studentName}
                            </td>
                            <td className="py-3 px-4 text-slate-700 font-medium">
                              {session.studentClass}
                            </td>
                            <td className="py-3 px-4 text-slate-500 text-[11px]">
                              <div>
                                {new Date(session.startTime).toLocaleTimeString(
                                  'id-ID'
                                )}
                              </div>
                              <div className="text-[10px] text-slate-400">
                                Durasi:{' '}
                                {session.durationSecondsUsed
                                  ? Math.round(
                                      session.durationSecondsUsed / 60
                                    )
                                  : '-'}{' '}
                                mnt
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <div className="flex flex-col items-center gap-1">
                                <span
                                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                    session.status === 'submitted'
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-rose-100 text-rose-800'
                                  }`}
                                >
                                  {session.status === 'submitted'
                                    ? 'Selesai'
                                    : 'Pelanggaran Tab'}
                                </span>
                                {tabCount > 0 && (
                                  <span className="text-[10px] text-rose-700 font-semibold flex items-center gap-0.5">
                                    <ShieldAlert className="w-3 h-3" />
                                    {tabCount}x Tab
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-semibold text-slate-800">
                              {session.scores.objectiveScore} / 18
                            </td>
                            <td className="py-3 px-4 text-center font-mono font-semibold text-purple-700">
                              {session.scores.essayScore} / 20
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span className="font-mono font-extrabold text-sm text-slate-900">
                                {session.scores.finalScore100}
                              </span>
                              <div className="text-[10px] text-slate-400">
                                ({session.scores.totalScore}/38 pt)
                              </div>
                            </td>
                            <td className="py-3 px-4 text-center">
                              <span
                                className={`px-2 py-0.5 rounded-md font-bold text-[11px] ${
                                  isPassed
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-800'
                                }`}
                              >
                                {isPassed ? 'TUNTAS' : 'REMIDI'}
                              </span>
                            </td>
                            <td className="py-3 px-4 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedStudent(session)}
                                className="px-3 py-1.5 rounded-xl bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-bold text-xs inline-flex items-center gap-1 transition-colors cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Koreksi Uraian</span>
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 2: ANALISIS HASIL SUMATIF ================= */}
        {activeTab === 'analisis' && (
          <ClassAnalyticsView
            sessions={sessions}
            settings={settings}
            selectedClassFilter={classFilter}
          />
        )}

        {/* ================= TAB 3: KISI-KISI & KUNCI JAWABAN (DOKUMEN RESMI) ================= */}
        {activeTab === 'kisi_kisi' && (
          <div className="space-y-8 animate-fadeIn">
            {/* Header / Discrepancy Verification Banner */}
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <div className="leading-relaxed">
                <strong>Verifikasi Naskah & Kunci Jawaban:</strong> Seluruh 10 butir soal, stimulus orisinal kontekstual, opsi pilihan, dan pedoman penskoran telah dipetakan secara eksak dari dokumen Word <em>Paket_Sumatif_Fungsi_Komposisi_Invers_Kelas_XI.docx</em>. Tidak ditemukan ketidaksesuaian kunci atau anomali rumus. Skor maksimum keseluruhan adalah <strong>38 poin</strong>.
              </div>
            </div>

            {/* Kisi-kisi Table */}
            <div className="p-6 rounded-2xl bg-white border border-purple-100 shadow-2xs space-y-4">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2 font-serif">
                <BookOpen className="w-5 h-5 text-purple-600" />
                Kisi-kisi Soal Sumatif Matematika Kelas XI
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-2.5 px-3">No</th>
                      <th className="py-2.5 px-3">Indikator Pembelajaran</th>
                      <th className="py-2.5 px-3">Indikator Soal</th>
                      <th className="py-2.5 px-3 text-center">Level</th>
                      <th className="py-2.5 px-3">Bentuk</th>
                      <th className="py-2.5 px-3">Sumber Soal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {QUESTIONS_DATA.map((q) => (
                      <tr key={q.id} className="hover:bg-slate-50/60">
                        <td className="py-2.5 px-3 font-bold text-purple-800">
                          {q.number}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-800">
                          {q.learningIndicator}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {q.questionIndicator}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded bg-slate-100 font-semibold text-slate-700">
                            {q.cognitiveLevel}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-semibold text-slate-700">
                          {q.type.replace('_', ' ')}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                          {q.sourceContext}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Naskah Soal & Kunci Jawaban Lengkap */}
            <div className="space-y-4">
              <h3 className="font-extrabold text-slate-800 text-base font-serif">
                Daftar Butir Soal, Kunci Jawaban, dan Pembahasan Lengkap
              </h3>

              <div className="grid grid-cols-1 gap-4">
                {QUESTIONS_DATA.map((q) => {
                  const key = ANSWER_KEYS_DATA[q.id];
                  return (
                    <div
                      key={q.id}
                      className="p-5 rounded-2xl bg-white border border-slate-200 shadow-2xs space-y-3"
                    >
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                        <span className="font-bold text-slate-900 text-sm">
                          Soal {q.number} — {q.title}
                        </span>
                        <span className="text-xs font-semibold px-2.5 py-0.5 rounded-md bg-purple-100 text-purple-800">
                          Bobot {q.maxScore} Poin
                        </span>
                      </div>

                      <div className="text-xs text-purple-900 bg-purple-50/50 p-3 rounded-xl border border-purple-100">
                        <strong>{q.stimulusTitle}:</strong> {q.stimulus}
                      </div>

                      <div className="text-xs md:text-sm text-slate-800 font-medium">
                        {q.questionText}
                      </div>

                      {q.options && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5 pt-1 text-xs text-slate-700 pl-2">
                          {q.options.map((opt) => (
                            <div key={opt.key}>
                              <strong>{opt.key}.</strong> {opt.text}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 space-y-1">
                        <div className="font-bold flex items-center justify-between">
                          <span>Kunci & Ketentuan Penskoran:</span>
                          <span className="text-[11px] text-emerald-800 font-semibold">
                            {key?.scoringGuide}
                          </span>
                        </div>
                        <p className="whitespace-pre-wrap leading-relaxed text-slate-700">
                          {key?.explanation}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Rubrik Analitik Uraian */}
            <div className="p-6 rounded-2xl bg-white border border-purple-100 shadow-2xs space-y-4">
              <h3 className="font-extrabold text-slate-800 text-base font-serif">
                Pedoman Rubrik Analitik untuk Soal 9 dan 10 (Maks 10 Poin Tiap Soal)
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-700 font-bold">
                      <th className="py-2.5 px-3">Aspek Penilaian</th>
                      <th className="py-2.5 px-3">Kriteria Pemenuhan</th>
                      <th className="py-2.5 px-3 text-center">Skor Maksimal</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {RUBRIC_ANALYTIC_ASPECTS.map((asp) => (
                      <tr key={asp.aspect}>
                        <td className="py-2.5 px-3 font-bold text-slate-800">
                          {asp.aspect}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600">
                          {asp.criteria}
                        </td>
                        <td className="py-2.5 px-3 text-center font-bold text-purple-700">
                          {asp.maxScore} Poin
                        </td>
                      </tr>
                    ))}
                    <tr className="bg-purple-50 font-bold text-purple-950">
                      <td className="py-2.5 px-3" colSpan={2}>
                        TOTAL SKOR PER BUTIR URAIAN
                      </td>
                      <td className="py-2.5 px-3 text-center">10 Poin</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 4: PENGATURAN UJIAN & DATA ================= */}
        {activeTab === 'pengaturan' && (
          <div className="space-y-6 animate-fadeIn max-w-4xl">
            
            {/* ================= SECTION: KONTROL AKSES APLIKASI WEB ================= */}
            <div className="p-6 rounded-2xl bg-white border border-purple-100 shadow-2xs space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-extrabold text-slate-800 text-base font-serif">
                      Kontrol Akses Aplikasi Web
                    </h3>
                    <p className="text-xs text-slate-500">
                      Kendalikan pembukaan dan penguncian aplikasi ujian bagi murid secara manual maupun terjadwal.
                    </p>
                  </div>
                </div>

                {/* Status Badge */}
                <div className="flex items-center gap-2">
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-extrabold flex items-center gap-1.5 ${
                      accessEvaluation?.status === 'locked'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : accessEvaluation?.status === 'scheduled'
                        ? 'bg-indigo-100 text-indigo-900 border border-indigo-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        accessEvaluation?.status === 'locked'
                          ? 'bg-rose-600'
                          : accessEvaluation?.status === 'scheduled'
                          ? 'bg-indigo-600'
                          : 'bg-emerald-600 animate-pulse'
                      }`}
                    />
                    <span>
                      {accessEvaluation?.status === 'locked'
                        ? 'Akses Terkunci'
                        : accessEvaluation?.status === 'scheduled'
                        ? 'Akses Terjadwal'
                        : 'Akses Terbuka'}
                    </span>
                  </span>
                </div>
              </div>

              {/* Notification Message */}
              {accessActionMessage && (
                <div
                  className={`p-3.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                    accessActionMessage.type === 'success'
                      ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                      : 'bg-rose-50 border-rose-200 text-rose-800'
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{accessActionMessage.text}</span>
                </div>
              )}

              {/* Server Clock & Info Box */}
              <div className="p-4 rounded-xl bg-purple-50/40 border border-purple-100 text-xs text-slate-700 flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <div className="text-[11px] font-bold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-purple-700" />
                    <span>Waktu Server Acuan Utama (Asia/Makassar):</span>
                  </div>
                  <div className="text-sm font-extrabold text-slate-900 font-mono">
                    {accessEvaluation?.serverTimeWita || 'Memuat waktu server...'}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    *Semua pembukaan dan penutupan akses dihitung berdasarkan jam server, bukan jam HP/laptop murid.
                  </p>
                </div>

                <div className="text-right">
                  <div className="text-[11px] font-bold text-slate-500 uppercase">Kondisi Akses:</div>
                  <div className="text-xs font-semibold text-purple-900 mt-0.5 max-w-xs text-left md:text-right">
                    {accessEvaluation?.reason || 'Akses aktif.'}
                  </div>
                </div>
              </div>

              {/* Manual Control Buttons */}
              <div className="space-y-3">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Kontrol Manual Langsung:
                </label>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsLockModalOpen(true)}
                    className="py-2.5 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Lock className="w-4 h-4" />
                    <span>Kunci Aplikasi Sekarang</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsUnlockModalOpen(true)}
                    className="py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center gap-2 shadow-xs transition-colors cursor-pointer"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>Buka Akses</span>
                  </button>
                </div>
                <p className="text-[11px] text-slate-500">
                  Saat dikunci, murid baru tidak dapat memulai ujian dan murid yang sedang mengerjakan tidak dapat mengirimkan perubahan jawaban baru.
                </p>
              </div>

              {/* Automated Schedule Form */}
              <form onSubmit={handleSaveSchedule} className="pt-4 border-t border-slate-100 space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span>Jadwal Akses Otomatis:</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs font-semibold text-purple-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scheduleForm.isScheduleEnabled}
                      onChange={(e) =>
                        setScheduleForm({
                          ...scheduleForm,
                          isScheduleEnabled: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-purple-600 accent-purple-600"
                    />
                    <span>Aktifkan Pembatasan Jadwal Otomatis</span>
                  </label>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Start Date & Time */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-purple-950 block">Mulai Akses Ujian:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">
                          Tanggal
                        </label>
                        <input
                          type="date"
                          value={scheduleForm.startDate}
                          onChange={(e) =>
                            setScheduleForm({ ...scheduleForm, startDate: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">
                          Jam
                        </label>
                        <input
                          type="time"
                          value={scheduleForm.startTime}
                          onChange={(e) =>
                            setScheduleForm({ ...scheduleForm, startTime: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                        />
                      </div>
                    </div>
                  </div>

                  {/* End Date & Time */}
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <span className="text-xs font-bold text-purple-950 block">Berakhirnya Akses:</span>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">
                          Tanggal
                        </label>
                        <input
                          type="date"
                          value={scheduleForm.endDate}
                          onChange={(e) =>
                            setScheduleForm({ ...scheduleForm, endDate: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-slate-500 uppercase font-semibold mb-1">
                          Jam
                        </label>
                        <input
                          type="time"
                          value={scheduleForm.endTime}
                          onChange={(e) =>
                            setScheduleForm({ ...scheduleForm, endTime: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Timezone selection */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-700">Zona Waktu:</span>
                    <select
                      value={scheduleForm.timezone}
                      onChange={(e) => setScheduleForm({ ...scheduleForm, timezone: e.target.value })}
                      className="px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold"
                    >
                      <option value="Asia/Makassar">WITA (Asia/Makassar - UTC+8)</option>
                      <option value="Asia/Jakarta">WIB (Asia/Jakarta - UTC+7)</option>
                      <option value="Asia/Jayapura">WIT (Asia/Jayapura - UTC+9)</option>
                    </select>
                  </div>

                  <button
                    type="submit"
                    disabled={isScheduleLoading}
                    className="py-2.5 px-5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-xs transition-colors cursor-pointer"
                  >
                    {isScheduleLoading ? 'Menerapkan...' : 'Simpan & Terapkan Jadwal Akses'}
                  </button>
                </div>
              </form>

              {/* Audit Logs History */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <span>Riwayat Tindakan Kontrol Akses (Audit Log):</span>
                </h4>
                {accessLogs.length === 0 ? (
                  <p className="text-xs text-slate-500 italic">Belum ada catatan riwayat perubahan akses.</p>
                ) : (
                  <div className="overflow-x-auto max-h-48 overflow-y-auto rounded-xl border border-slate-200">
                    <table className="w-full text-left text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold">
                          <th className="py-2 px-3">Waktu</th>
                          <th className="py-2 px-3">Tindakan</th>
                          <th className="py-2 px-3">Operator</th>
                          <th className="py-2 px-3">Keterangan / Alasan</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {accessLogs.map((log: any, idx: number) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-slate-500 font-mono whitespace-nowrap">
                              {new Date(log.timestamp).toLocaleString('id-ID', {
                                timeZone: 'Asia/Makassar',
                                dateStyle: 'short',
                                timeStyle: 'medium',
                              })}{' '}
                              WITA
                            </td>
                            <td className="py-2 px-3">
                              <span
                                className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                  log.action === 'lock'
                                    ? 'bg-rose-100 text-rose-800'
                                    : log.action === 'unlock'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-indigo-100 text-indigo-800'
                                }`}
                              >
                                {log.action === 'lock'
                                  ? 'Kunci'
                                  : log.action === 'unlock'
                                  ? 'Buka'
                                  : 'Ubah Jadwal'}
                              </span>
                            </td>
                            <td className="py-2 px-3 font-semibold text-slate-700">{log.operator}</td>
                            <td className="py-2 px-3 text-slate-600">
                              {log.reason || log.details || '-'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* Settings Form */}
            <div className="p-6 rounded-2xl bg-white border border-purple-100 shadow-2xs space-y-6">
              <h3 className="font-extrabold text-slate-800 text-base font-serif">
                Pengaturan Pelaksanaan CBT
              </h3>

              {settingsSavedAlert && (
                <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>Pengaturan berhasil disimpan dan aktif segera!</span>
                </div>
              )}

              <form onSubmit={handleSaveSettings} className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  {/* Durasi Ujian */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Durasi Ujian (Menit)
                    </label>
                    <input
                      type="number"
                      min={5}
                      max={180}
                      value={localSettings.durationMinutes}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          durationMinutes: parseInt(e.target.value) || 60,
                        })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Waktu hitung mundur otomatis dimulai saat murid menekan Mulai Ujian.
                    </p>
                  </div>

                  {/* KKM / KKTP */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Batas Ketuntasan (KKTP / KKM)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={localSettings.kkmScore}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          kkmScore: parseInt(e.target.value) || 75,
                        })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold bg-slate-50 focus:bg-white"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Standar nilai kelulusan sumatif (skala 0 - 100).
                    </p>
                  </div>

                  {/* Aturan Perpindahan Tab */}
                  <div>
                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                      Aturan Perpindahan Tab / Jendela
                    </label>
                    <select
                      value={localSettings.tabSwitchRule}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          tabSwitchRule: e.target.value as any,
                        })
                      }
                      className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-slate-50 focus:bg-white"
                    >
                      <option value="warning-2">
                        Beri 2x Peringatan, Pelanggaran Ke-3 Otomatis Kunci (Rekomendasi)
                      </option>
                      <option value="warning-3">
                        Beri 3x Peringatan, Pelanggaran Ke-4 Otomatis Kunci
                      </option>
                      <option value="instant">
                        Ketat: Pelanggaran Pertama Langsung Mengakhiri & Mengunci Ujian
                      </option>
                      <option value="disabled">
                        Nonaktif / Mode Uji Coba (Hanya Catat Log Tanpa Penguncian)
                      </option>
                    </select>
                  </div>
                </div>

                {/* Toggles */}
                <div className="space-y-3 pt-2">

                  <label className="flex items-center gap-2.5 text-xs text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={localSettings.preventRetake}
                      onChange={(e) =>
                        setLocalSettings({
                          ...localSettings,
                          preventRetake: e.target.checked,
                        })
                      }
                      className="w-4 h-4 rounded text-purple-600 accent-purple-600"
                    />
                    <span>Cegah nomor peserta yang sama mengerjakan ujian berkali-kali</span>
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    className="py-2.5 px-6 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs md:text-sm shadow-sm cursor-pointer"
                  >
                    Simpan Perubahan Pengaturan
                  </button>
                </div>
              </form>
            </div>

            {/* Data Management & Simulation */}
            <div className="p-6 rounded-2xl bg-white border border-purple-100 shadow-2xs space-y-5">
              <h3 className="font-extrabold text-slate-800 text-base font-serif flex items-center gap-2">
                <Database className="w-5 h-5 text-purple-600" />
                Manajemen Data & Simulasi Kelas
              </h3>

              <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 text-xs text-slate-700 leading-relaxed space-y-2">
                <p>
                  <strong>Penyimpanan Browser Lokal (Offline First):</strong> Hasil ujian saat ini disimpan secara aman pada memori peramban browser perangkat ini. Untuk mencadangkan data agar tidak hilang, gunakan tombol <strong>Unduh Cadangan JSON</strong> atau <strong>Ekspor CSV</strong> di bawah.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {/* Seed Demo Data */}
                <button
                  type="button"
                  onClick={handleLoadDemoData}
                  className="p-4 rounded-xl border border-purple-200 bg-purple-50/70 hover:bg-purple-100 text-purple-900 text-xs font-bold text-left transition-colors cursor-pointer flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-purple-600" />
                    <span>Muat 15 Data Murid Demo</span>
                  </div>
                  <span className="text-[11px] font-normal text-purple-700">
                    Mengisi data kelas untuk menguji analisis dan rubrik seketika.
                  </span>
                </button>

                {/* Backup JSON */}
                <button
                  type="button"
                  onClick={handleBackupJSON}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold text-left transition-colors cursor-pointer flex flex-col justify-between gap-2"
                >
                  <div className="flex items-center gap-2">
                    <Download className="w-4 h-4 text-slate-600" />
                    <span>Unduh Cadangan (JSON)</span>
                  </div>
                  <span className="text-[11px] font-normal text-slate-500">
                    Simpan file cadangan lengkap seluruh sesi dan pengaturan.
                  </span>
                </button>

                {/* Restore JSON */}
                <label className="p-4 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-800 text-xs font-bold text-left transition-colors cursor-pointer flex flex-col justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Upload className="w-4 h-4 text-slate-600" />
                    <span>Pulihkan Cadangan (JSON)</span>
                  </div>
                  <span className="text-[11px] font-normal text-slate-500">
                    Unggah kembali file JSON hasil cadangan sebelumnya.
                  </span>
                  <input
                    type="file"
                    accept=".json"
                    onChange={handleImportJSON}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Danger Zone: Clear Data */}
              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <h4 className="font-bold text-rose-900 text-xs">
                    Zona Bahaya: Reset Data Ujian
                  </h4>
                  <p className="text-[11px] text-slate-500">
                    Menghapus seluruh daftar ujian murid yang tersimpan saat ini.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleClearAllData}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Hapus Semua Data</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Student Grading Modal if one is opened */}
      {selectedStudent && (
        <StudentGradingModal
          session={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onSaved={(updated) => {
            setSelectedStudent(updated);
            onRefreshSessions();
          }}
          onResetStudentForRetake={() => {
            onRefreshSessions();
          }}
        />
      )}

      {/* Share & QR Code Modal */}
      {isShareModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-purple-100 space-y-5 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    Bagikan Ujian ke Murid
                  </h3>
                  <p className="text-xs text-slate-500">
                    Tautan langsung & kode akses pengerjaan CBT
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-xl hover:bg-slate-100 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-2xl border border-purple-100 space-y-3">
              <div className="bg-white p-3 rounded-2xl shadow-xs border border-slate-200">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&data=${encodeURIComponent(
                    typeof window !== 'undefined'
                      ? window.location.origin + window.location.pathname
                      : ''
                  )}`}
                  alt="QR Code Ujian CBT"
                  className="w-48 h-48 rounded-xl object-contain"
                />
              </div>
              <p className="text-[11px] text-slate-600 font-medium text-center max-w-xs">
                Siswa dapat langsung memindai (*scan*) QR code ini menggunakan kamera HP mereka di layar proyektor kelas.
              </p>
            </div>

            {/* Link & Token Details */}
            <div className="space-y-3 text-xs">
              {/* Tautan Ujian */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Tautan Ujian (Shared Link):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={
                      typeof window !== 'undefined'
                        ? window.location.origin + window.location.pathname
                        : ''
                    }
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 font-mono text-slate-800 text-[11px] select-all"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== 'undefined') {
                        navigator.clipboard.writeText(
                          window.location.origin + window.location.pathname
                        );
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold shrink-0 flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    {copiedLink ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Salin Link</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsShareModalOpen(false)}
                className="w-full py-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    
      {/* MODAL 1: KONFIRMASI KUNCI APLIKASI SEKARANG */}
      {isLockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                <Lock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Kunci Akses Web App Sekarang?
                </h3>
                <p className="text-xs text-rose-700 font-semibold">
                  Tindakan Penutupan Sesi Ujian
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Setelah dikunci, murid baru <strong>tidak dapat memulai ujian</strong> dan permintaan penyimpanan jawaban baru akan <strong>ditolak oleh server</strong>. Semua jawaban yang telah tersimpan sebelumnya tetap aman dan tidak akan hilang.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Alasan / Catatan Penguncian (Opsional):
              </label>
              <textarea
                rows={2}
                value={lockReasonInput}
                onChange={(e) => setLockReasonInput(e.target.value)}
                placeholder="Contoh: Waktu mengajar jam ke-4 telah selesai."
                className="w-full p-2.5 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-rose-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsLockModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleLockNow}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                Ya, Kunci Sekarang
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: KONFIRMASI BUKA AKSES */}
      {isUnlockModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-emerald-200 space-y-4 animate-scaleUp">
            <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
              <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <Unlock className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Buka Kembali Akses Web App?
                </h3>
                <p className="text-xs text-emerald-700 font-semibold">
                  Membuka pengerjaan untuk murid
                </p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed">
              Membuka kembali akses aplikasi memungkinkan murid untuk mulai mengerjakan ujian dan menyimpan jawaban mereka ke server. Seluruh riwayat sesi sebelumnya tetap utuh.
            </p>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                Catatan Pembukaan (Opsional):
              </label>
              <input
                type="text"
                value={unlockReasonInput}
                onChange={(e) => setUnlockReasonInput(e.target.value)}
                placeholder="Contoh: Pembukaan akses sesi susulan."
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs bg-slate-50 focus:bg-white focus:border-emerald-500"
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsUnlockModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleUnlockNow}
                className="flex-1 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                Ya, Buka Akses
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: PRATINJAU CADANGAN SEBELUM PEMULIHAN (FAIL-SAFE MERGE) */}
      {backupPreview && backupPreview.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-purple-100 space-y-4 animate-scaleUp">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-purple-100 text-purple-700 flex items-center justify-center">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-800 text-base">
                    Pratinjau Berkas Cadangan JSON
                  </h3>
                  <p className="text-xs text-slate-500">
                    Periksa isi cadangan sebelum diterapkan ke aplikasi
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setBackupPreview(null)}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-xl bg-purple-50/50 border border-purple-100 space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500">Nama Berkas:</span>
                  <span className="font-mono font-bold text-purple-950">{backupPreview.fileName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Sesi di Cadangan:</span>
                  <span className="font-bold text-emerald-700">{backupPreview.sessions.length} Murid</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Total Sesi Saat Ini:</span>
                  <span className="font-bold text-slate-800">{sessions.length} Murid</span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Daftar Peserta di Dalam Cadangan:
                </label>
                <div className="max-h-40 overflow-y-auto p-3 rounded-xl border border-slate-200 bg-slate-50 space-y-1">
                  {backupPreview.studentNames.map((name, i) => (
                    <div key={i} className="flex items-center gap-2 text-slate-700">
                      <span className="w-4 h-4 rounded-full bg-purple-200 text-purple-800 text-[10px] font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-medium truncate">{name}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 leading-relaxed text-[11px]">
                <strong>Mekanisme Perlindungan Fail-Safe Merge:</strong> Pemulihan ini <em>tidak akan menghapus</em> data murid yang sedang ada. Sesi baru akan ditambahkan dan jawaban dari peserta yang sama akan digabungkan secara aman tanpa duplikasi.
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setBackupPreview(null)}
                className="flex-1 py-2.5 rounded-xl border border-slate-200 text-slate-700 font-semibold text-xs hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmBackupMerge}
                className="flex-1 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs shadow-md transition-colors cursor-pointer"
              >
                Terapkan Fail-Safe Merge
              </button>
            </div>
          </div>
        </div>
      )}

</div>
  );
};
