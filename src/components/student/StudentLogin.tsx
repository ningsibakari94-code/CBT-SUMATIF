import React, { useState } from 'react';
import {
  Clock,
  BookOpen,
  AlertTriangle,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  GraduationCap,
  Info,
  CheckCircle2,
} from 'lucide-react';
import { ExamSettings } from '../../types/cbt';
import { EXAM_METADATA } from '../../data/examData';
import { loadAllSessions } from '../../utils/storage';
import { apiGetAccessControl, isStagingMode } from '../../utils/api';
import { Lock } from 'lucide-react';

interface StudentLoginProps {
  settings: ExamSettings;
  onStartExam: (studentInfo: {
    name: string;
    studentClass: string;
    participantNumber: string;
    examCode: string;
  }) => Promise<void> | void;
  onOpenTeacherPortal: () => void;
}

export const StudentLogin: React.FC<StudentLoginProps> = ({
  settings,
  onStartExam,
  onOpenTeacherPortal,
}) => {
  const [name, setName] = useState('');
  const [studentClass, setStudentClass] = useState('XI.1');
  const [customClass, setCustomClass] = useState('');
  const [participantNumber, setParticipantNumber] = useState('');
  const [agreedGuidelines, setAgreedGuidelines] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [accessEvaluation, setAccessEvaluation] = useState<any>(null);

  React.useEffect(() => {
    apiGetAccessControl()
      .then((res) => {
        if (res?.evaluation) {
          setAccessEvaluation(res.evaluation);
        }
      })
      .catch((err) => {
        console.warn('Could not fetch access control on student login:', err);
      });
  }, []);

  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedName = name.trim();
    const finalClass = studentClass === 'Lainnya' ? customClass.trim() : studentClass;
    const trimmedNum = participantNumber.trim();

    if (!trimmedName) {
      setError('Harap masukkan nama lengkap Anda.');
      return;
    }
    if (!finalClass) {
      setError('Harap pilih atau tuliskan kelas Anda.');
      return;
    }
    if (!trimmedNum) {
      setError('Harap masukkan nomor peserta atau nomor absen.');
      return;
    }

    // Check prevention of duplicate retake
    if (settings.preventRetake) {
      const allSessions = loadAllSessions();
      const duplicate = allSessions.find(
        (s) =>
          s.participantNumber.toLowerCase() === trimmedNum.toLowerCase() &&
          s.status !== 'in-progress'
      );
      if (duplicate) {
        setError(
          `Nomor peserta "${trimmedNum}" (${duplicate.studentName}) sudah pernah menyelesaikan ujian ini. Jika perlu ujian ulang, silakan hubungi guru untuk membuka izin.`
        );
        return;
      }
    }

        if (accessEvaluation && !accessEvaluation.isAllowed) {
      setError(accessEvaluation.reason || 'Akses ujian sedang ditutup oleh guru pengawas.');
      return;
    }
    if (!agreedGuidelines) {
      setError('Harap centang konfirmasi kesiapan dan petunjuk pengerjaan.');
      return;
    }

      setIsLoading(true);
      try {
        await onStartExam({
          name: trimmedName,
          studentClass: finalClass,
          participantNumber: trimmedNum,
          examCode: '',
        });
      } catch (err: any) {
        setError(err.message || 'Gagal memulai ujian. Periksa koneksi internet Anda.');
      } finally {
        setIsLoading(false);
      }
    };

  const [teacherTapCount, setTeacherTapCount] = useState(0);

  const handleDiscreetTeacherTap = () => {
    const next = teacherTapCount + 1;
    if (next >= 3) {
      setTeacherTapCount(0);
      onOpenTeacherPortal();
    } else {
      setTeacherTapCount(next);
      setTimeout(() => setTeacherTapCount(0), 3000);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 flex flex-col justify-between items-center relative z-10">
      <div className="w-full max-w-3xl my-auto">
        {/* Header Title with Floral Pastel Aesthetic */}
        <div className="text-center mb-8">
          <div
            onClick={handleDiscreetTeacherTap}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-100/80 border border-purple-200/80 text-purple-800 text-xs font-semibold tracking-wider uppercase mb-3 shadow-xs select-none cursor-default"
            title=""
          >
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            Sumatif Akhir Materi Matematika Fase F
          </div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-slate-800 tracking-tight font-serif">
            {EXAM_METADATA.title}
          </h1>
          <p className="text-base md:text-lg text-slate-600 mt-2 font-medium">
            Topik: <span className="text-purple-700 font-semibold">{EXAM_METADATA.topic}</span>
          </p>
        </div>

        {/* Main Card */}
        <div className="bg-white/95 backdrop-blur-xs rounded-2xl shadow-xl shadow-purple-950/5 border border-purple-100 overflow-hidden">
          {/* Card Top Banner */}
          <div className="bg-gradient-to-r from-purple-50 via-rose-50 to-emerald-50 px-6 py-4 border-b border-purple-100/70 flex flex-wrap items-center justify-between gap-3 text-sm text-slate-700">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-purple-600" />
              <span>Durasi: <strong className="text-slate-900">{settings.durationMinutes} Menit</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              <span>Jumlah: <strong className="text-slate-900">{EXAM_METADATA.totalQuestions} Butir Soal</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-rose-600" />
              <span>Skor Maks: <strong className="text-slate-900">{EXAM_METADATA.maxTotalScore} Poin</strong></span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-6 md:p-8 space-y-6">
                                    {/* Staging Mode Notification Banner */}
            {isStagingMode() && (
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-600 animate-ping shrink-0" />
                <span className="font-semibold">
                  Mode Staging Terhubung ke Cloud Firestore: Sesi ini berjalan di lingkungan uji coba terisolasi.
                </span>
              </div>
            )}

            {/* Access Control Closed Banner */}
            {accessEvaluation && !accessEvaluation.isAllowed && (
              <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 text-rose-900 flex items-start gap-3.5 shadow-xs">
                <div className="w-10 h-10 rounded-xl bg-rose-200/80 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Lock className="w-5 h-5" />
                </div>
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-rose-900">
                    Akses Aplikasi Ditutup / Terkunci
                  </h4>
                  <p className="text-xs text-rose-800 leading-relaxed">
                    {accessEvaluation.reason}
                  </p>
                  <p className="text-[11px] text-rose-700 font-mono">
                    Waktu Server Acuan: <strong>{accessEvaluation.serverTimeWita}</strong>
                  </p>
                </div>
              </div>
            )}
            {error && (
              <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 flex items-start gap-3 text-sm animate-shake">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div className="leading-relaxed">{error}</div>
              </div>
            )}

            {/* Inputs Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {/* Nama Lengkap */}
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nama Lengkap Murid <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Contoh: Aditya Pratama"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all text-slate-800 placeholder:text-slate-400 text-sm font-medium"
                />
              </div>

              {/* Kelas */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Kelas <span className="text-rose-500">*</span>
                </label>
                <select
                  value={studentClass}
                  onChange={(e) => setStudentClass(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all text-slate-800 text-sm font-medium"
                >
                  <option value="XI.1">XI.1</option>
                  <option value="XI.2">XI.2</option>
                  <option value="XI.3">XI.3</option>
                  <option value="XI.4">XI.4</option>
                  <option value="XI.5">XI.5</option>
                  <option value="XI.6">XI.6</option>
                  <option value="XI.7">XI.7</option>
                  <option value="XI.8">XI.8</option>
                  <option value="XI.9">XI.9</option>
                  <option value="XI.10">XI.10</option>
                  <option value="XI.11">XI.11</option>
                  <option value="Lainnya">Lainnya (Ketik Manual)</option>
                </select>
                {studentClass === 'Lainnya' && (
                  <input
                    type="text"
                    value={customClass}
                    onChange={(e) => setCustomClass(e.target.value)}
                    placeholder="Masukkan nama kelas Anda"
                    className="mt-2 w-full px-4 py-2 rounded-xl border border-slate-200 bg-white focus:border-purple-500 text-sm"
                  />
                )}
              </div>

              {/* Nomor Peserta / Absen */}
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                  Nomor Peserta / Absen <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={participantNumber}
                  onChange={(e) => setParticipantNumber(e.target.value)}
                  placeholder="Contoh: 1101 atau 07"
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50/50 focus:bg-white focus:border-purple-500 focus:ring-2 focus:ring-purple-200 transition-all text-slate-800 placeholder:text-slate-400 text-sm font-medium"
                />
              </div>
            </div>

            {/* Petunjuk & Aturan CBT Box */}
            <div className="p-4 md:p-5 rounded-xl bg-purple-50/40 border border-purple-100/90 text-xs text-slate-700 space-y-2.5">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-sm">
                <Info className="w-4 h-4 text-purple-600" />
                Petunjuk Pengerjaan & Aturan Keamanan Ujian:
              </div>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed text-slate-600">
                <li>
                  Soal terdiri dari <strong>10 butir</strong> (2 Pilihan Ganda, 2 Pilihan Ganda Kompleks, 2 Menjodohkan, 2 Isian Singkat, dan 2 Uraian).
                </li>
                <li>
                  Jawaban Anda otomatis tersimpan setiap kali dipilih atau diketik, sehingga aman jika koneksi terputus sesaat.
                </li>
                <li>
                  <strong>Aturan Perpindahan Tab:</strong> Sistem mendeteksi ketika Anda membuka tab baru, memperkecil jendela, atau meninggalkan halaman ujian.
                  {settings.tabSwitchRule === 'instant' && (
                    <span className="text-rose-700 font-semibold block mt-0.5">
                      ⚠️ Pelanggaran pertama akan otomatis mengakhiri dan mengunci ujian Anda!
                    </span>
                  )}
                  {settings.tabSwitchRule === 'warning-2' && (
                    <span className="text-amber-800 font-semibold block mt-0.5">
                      ⚠️ Anda diberi batas maksimal 2 kali peringatan sebelum ujian otomatis diakhiri.
                    </span>
                  )}
                </li>
                <li>
                  Gunakan tombol <strong>Akhiri Ujian</strong> hanya setelah memastikan semua nomor selesai diperiksa.
                </li>
              </ul>
            </div>

            {/* Checkbox Agreement */}
            <label className="flex items-start gap-3 cursor-pointer select-none group">
              <input
                type="checkbox"
                checked={agreedGuidelines}
                onChange={(e) => setAgreedGuidelines(e.target.checked)}
                className="mt-1 w-4 h-4 rounded text-purple-600 border-slate-300 focus:ring-purple-500 accent-purple-600"
              />
              <span className="text-xs md:text-sm text-slate-700 group-hover:text-slate-900 leading-snug">
                Saya memahami petunjuk pengerjaan di atas, berjanji mengerjakan dengan jujur, dan siap memulai ujian sekarang.
              </span>
            </label>

            {/* Action Buttons */}
            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoading || Boolean(accessEvaluation && !accessEvaluation.isAllowed)}
                className="w-full py-3.5 px-6 rounded-xl bg-gradient-to-r from-purple-700 via-indigo-700 to-purple-800 hover:from-purple-800 hover:to-indigo-800 disabled:opacity-70 text-white font-bold text-base shadow-md shadow-purple-900/20 hover:shadow-lg hover:shadow-purple-900/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {isLoading ? (
                  <>
                    <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Menghubungkan ke Server CBT...</span>
                  </>
                ) : (
                  <>
                    <span>Mulai Ujian Sekarang</span>
                    <ArrowRight className="w-5 h-5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>

        {/* Footer info (Clean, no teacher button visible on student phones) */}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-2 px-2">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Platform CBT Terstandar SMA Fase F</span>
          </div>
          <div className="text-slate-400">
            Kurikulum Merdeka • Kelas XI
          </div>
        </div>
      </div>
    </div>
  );
};
