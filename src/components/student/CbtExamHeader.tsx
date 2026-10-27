import React, { useState, useEffect } from 'react';
import {
  Clock,
  User,
  Maximize2,
  Minimize2,
  Type,
  AlertCircle,
  LogOut,
  Sparkles,
} from 'lucide-react';
import { StudentExamSession } from '../../types/cbt';

interface CbtExamHeaderProps {
  session: StudentExamSession;
  timeRemainingSeconds: number;
  fontSizeLevel: 'normal' | 'large' | 'xlarge';
  syncStatus?: 'saved' | 'saving' | 'offline';
  onChangeFontSize: (level: 'normal' | 'large' | 'xlarge') => void;
  onRequestSubmit: () => void;
}

export const CbtExamHeader: React.FC<CbtExamHeaderProps> = ({
  session,
  timeRemainingSeconds,
  fontSizeLevel,
  syncStatus = 'saved',
  onChangeFontSize,
  onRequestSubmit,
}) => {
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () =>
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const hours = Math.floor(timeRemainingSeconds / 3600);
  const minutes = Math.floor((timeRemainingSeconds % 3600) / 60);
  const seconds = timeRemainingSeconds % 60;

  const formattedTime = `${hours > 0 ? `${hours.toString().padStart(2, '0')}:` : ''}${minutes
    .toString()
    .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  const isLowTime = timeRemainingSeconds <= 300; // <= 5 mins
  const isUrgent = timeRemainingSeconds <= 60; // <= 1 min

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-purple-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex items-center justify-between gap-3">
        {/* Left: App Title & Student Info */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white flex items-center justify-center font-bold text-sm shadow-xs shrink-0">
            XI
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold text-slate-800 leading-tight">
              CBT Sumatif Matematika
            </h1>
            <p className="text-xs text-purple-700 font-medium">
              Fungsi Komposisi & Invers
            </p>
          </div>

          <div className="h-6 w-px bg-slate-200 hidden md:block mx-1" />

          {/* Student Badge */}
          <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-purple-50/80 border border-purple-100 text-xs text-slate-700">
            <User className="w-3.5 h-3.5 text-purple-600 shrink-0" />
            <span className="font-semibold text-slate-900 truncate max-w-[130px] md:max-w-[180px]">
              {session.studentName}
            </span>
            <span className="text-purple-600 font-medium hidden md:inline">
              ({session.studentClass} • {session.participantNumber})
            </span>
          </div>

          {/* Cloud Sync Status Badge */}
          <div
            className={`hidden lg:flex items-center gap-1.5 px-2 py-1 rounded-lg text-[11px] font-medium border ${
              syncStatus === 'saved'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : syncStatus === 'saving'
                ? 'bg-purple-50 border-purple-200 text-purple-800 animate-pulse'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
            title={
              syncStatus === 'saved'
                ? 'Semua jawaban tersimpan aman di server CBT'
                : syncStatus === 'saving'
                ? 'Sedang menyinkronkan jawaban ke server...'
                : 'Koneksi terputus: jawaban tersimpan aman di memori lokal'
            }
          >
            <span
              className={`w-2 h-2 rounded-full ${
                syncStatus === 'saved'
                  ? 'bg-emerald-500'
                  : syncStatus === 'saving'
                  ? 'bg-purple-500 animate-ping'
                  : 'bg-amber-500'
              }`}
            />
            <span>
              {syncStatus === 'saved'
                ? 'Tersimpan'
                : syncStatus === 'saving'
                ? 'Menyimpan...'
                : 'Offline (Cadangan)'}
            </span>
          </div>
        </div>

        {/* Center: Countdown Timer */}
        <div className="flex items-center">
          <div
            className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border font-mono text-sm md:text-base font-bold transition-all shadow-2xs ${
              isUrgent
                ? 'bg-rose-100 border-rose-300 text-rose-800 animate-pulse'
                : isLowTime
                ? 'bg-amber-50 border-amber-300 text-amber-900'
                : 'bg-purple-50 border-purple-200 text-purple-900'
            }`}
            title="Sisa waktu ujian"
          >
            <Clock
              className={`w-4 h-4 ${
                isUrgent
                  ? 'text-rose-600 animate-spin'
                  : isLowTime
                  ? 'text-amber-600'
                  : 'text-purple-600'
              }`}
            />
            <span>{formattedTime}</span>
            {isLowTime && (
              <span className="hidden lg:inline text-[10px] font-sans font-semibold uppercase tracking-wider text-rose-700 ml-1">
                Sisa Waktu
              </span>
            )}
          </div>
        </div>

        {/* Right: Controls & End Exam */}
        <div className="flex items-center gap-2">
          {/* Font Size Toggle */}
          <div className="hidden sm:flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => onChangeFontSize('normal')}
              className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                fontSizeLevel === 'normal'
                  ? 'bg-white shadow-2xs text-purple-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ukuran teks normal"
            >
              A
            </button>
            <button
              type="button"
              onClick={() => onChangeFontSize('large')}
              className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                fontSizeLevel === 'large'
                  ? 'bg-white shadow-2xs text-purple-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ukuran teks besar"
            >
              A+
            </button>
            <button
              type="button"
              onClick={() => onChangeFontSize('xlarge')}
              className={`px-2 py-1 rounded-md font-semibold transition-colors cursor-pointer ${
                fontSizeLevel === 'xlarge'
                  ? 'bg-white shadow-2xs text-purple-700 font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Ukuran teks sangat besar"
            >
              A++
            </button>
          </div>

          {/* Fullscreen Toggle */}
          <button
            type="button"
            onClick={toggleFullscreen}
            className="p-2 rounded-lg text-slate-500 hover:text-purple-700 hover:bg-purple-50 transition-colors hidden md:flex items-center justify-center cursor-pointer"
            title={isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh (F11)'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-4 h-4" />
            ) : (
              <Maximize2 className="w-4 h-4" />
            )}
          </button>

          {/* End Exam Button */}
          <button
            type="button"
            onClick={onRequestSubmit}
            className="flex items-center gap-1.5 px-3 md:px-4 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs md:text-sm font-bold shadow-xs hover:shadow transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 md:w-4 md:h-4" />
            <span>Akhiri Ujian</span>
          </button>
        </div>
      </div>
    </header>
  );
};
