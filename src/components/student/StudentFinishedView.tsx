import React, { useEffect } from 'react';
import confetti from 'canvas-confetti';
import {
  CheckCircle,
  Clock,
  User,
  ShieldCheck,
  FileCheck,
  Award,
  ArrowRight,
  GraduationCap,
} from 'lucide-react';
import { StudentExamSession } from '../../types/cbt';
import { EXAM_METADATA } from '../../data/examData';

interface StudentFinishedViewProps {
  session: StudentExamSession;
  onReturnToHome: () => void;
  onOpenTeacherPortal: () => void;
}

export const StudentFinishedView: React.FC<StudentFinishedViewProps> = ({
  session,
  onReturnToHome,
  onOpenTeacherPortal,
}) => {
  useEffect(() => {
    // Only fire confetti if normal submission
    if (session.status === 'submitted') {
      try {
        confetti({
          particleCount: 80,
          spread: 60,
          origin: { y: 0.6 },
          colors: ['#A8D5BA', '#D8CCE8', '#E07A93', '#FCEEF2', '#5D4B8B'],
        });
      } catch (err) {
        // ignore if not supported
      }
    }
  }, [session.status]);

  const durationMins = session.durationSecondsUsed
    ? Math.round(session.durationSecondsUsed / 60)
    : 0;

  return (
    <div className="min-h-screen py-10 px-4 flex flex-col justify-center items-center relative z-10">
      <div className="max-w-xl w-full">
        <div className="bg-white/95 backdrop-blur-xs rounded-3xl p-6 md:p-8 shadow-2xl shadow-purple-950/10 border border-purple-100 text-center space-y-6">
          {/* Top Status Icon */}
          <div className="mx-auto w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-100 to-teal-50 border border-emerald-200 flex items-center justify-center text-emerald-600 shadow-md">
            <CheckCircle className="w-10 h-10" />
          </div>

          <div className="space-y-1.5">
            <h2 className="text-2xl md:text-3xl font-extrabold text-slate-800 font-serif">
              Ujian Berhasil Diselesaikan!
            </h2>
            <p className="text-sm text-slate-600">
              Terima kasih telah mengerjakan{' '}
              <strong>{EXAM_METADATA.title}</strong>
            </p>
          </div>

          {/* Student & Session Summary Card */}
          <div className="p-4 rounded-2xl bg-purple-50/50 border border-purple-100 text-left text-xs md:text-sm space-y-2.5">
            <div className="flex items-center justify-between pb-2 border-b border-purple-100/70">
              <span className="text-slate-500 font-medium">Nama Peserta:</span>
              <span className="font-bold text-slate-800">{session.studentName}</span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-purple-100/70">
              <span className="text-slate-500 font-medium">Kelas / No. Absen:</span>
              <span className="font-semibold text-slate-800">
                {session.studentClass} • No. {session.participantNumber}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-purple-100/70">
              <span className="text-slate-500 font-medium">Waktu Selesai:</span>
              <span className="font-semibold text-slate-800">
                {session.finishTime
                  ? new Date(session.finishTime).toLocaleTimeString('id-ID', {
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                    })
                  : '-'}
              </span>
            </div>
            <div className="flex items-center justify-between pb-2 border-b border-purple-100/70">
              <span className="text-slate-500 font-medium">Durasi Pengerjaan:</span>
              <span className="font-semibold text-purple-700">
                ± {durationMins} Menit
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Status Pengiriman:</span>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                  session.status === 'submitted'
                    ? 'bg-emerald-100 text-emerald-800'
                    : session.status === 'auto-time'
                    ? 'bg-amber-100 text-amber-800'
                    : 'bg-rose-100 text-rose-800'
                }`}
              >
                {session.status === 'submitted'
                  ? 'Selesai Dikirim'
                  : session.status === 'auto-time'
                  ? 'Selesai (Waktu Habis)'
                  : 'Selesai (Pelanggaran Tab)'}
              </span>
            </div>
          </div>

          {/* Secure Information Notice (No answer key shown) */}
          <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200/80 text-xs text-amber-900 leading-relaxed text-left flex items-start gap-2.5">
            <ShieldCheck className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <strong>Catatan Penilaian:</strong> Sesuai protokol CBT Sumatif resmi, kunci jawaban dan rubrik penilaian tidak ditampilkan pada layar murid. Lembar jawaban uraian Anda akan diperiksa dan dinilai oleh guru mata pelajaran menggunakan rubrik analitik sebelum pengumuman nilai akhir resmi.
            </div>
          </div>

          {/* Action Buttons (Clean, no teacher button visible to students) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={onReturnToHome}
              className="w-full py-3.5 px-6 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Halaman Utama</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
