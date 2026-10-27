import React from 'react';
import { AlertTriangle, ShieldAlert, ArrowRight } from 'lucide-react';

interface TabSwitchWarningModalProps {
  isOpen: boolean;
  violationCount: number;
  maxViolationsAllowed: number;
  isFatal: boolean;
  onDismiss: () => void;
  onAutoSubmit: () => void;
}

export const TabSwitchWarningModal: React.FC<TabSwitchWarningModalProps> = ({
  isOpen,
  violationCount,
  maxViolationsAllowed,
  isFatal,
  onDismiss,
  onAutoSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-200 space-y-5 animate-scaleUp">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 leading-tight">
              {isFatal
                ? 'Ujian Dihentikan & Dikunci Otomatis'
                : 'Peringatan: Perpindahan Tab Terdeteksi!'}
            </h3>
            <p className="text-xs text-rose-700 font-semibold mt-0.5">
              Pelanggaran Ke-{violationCount} dari Batas {maxViolationsAllowed} Kali
            </p>
          </div>
        </div>

        <div className="p-4 rounded-xl bg-rose-50/80 border border-rose-200 text-xs text-slate-700 space-y-2 leading-relaxed">
          <p>
            Sistem mencatat bahwa jendela ujian kehilangan fokus atau Anda berpindah tab/aplikasi pada pukul{' '}
            <strong>{new Date().toLocaleTimeString('id-ID')}</strong>.
          </p>
          {isFatal ? (
            <p className="font-semibold text-rose-900">
              Batas toleransi perpindahan tab telah terlampaui. Seluruh jawaban yang telah Anda kerjakan saat ini akan dikirim dan dikunci otomatis ke server guru.
            </p>
          ) : (
            <p className="text-slate-600">
              Harap tetap berada pada halaman ujian ini hingga selesai. Jika Anda meninggalkan halaman lagi, ujian Anda akan langsung dihentikan dan dikunci secara otomatis.
            </p>
          )}
        </div>

        <div className="pt-2">
          {isFatal ? (
            <button
              type="button"
              onClick={onAutoSubmit}
              className="w-full py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-sm shadow-md transition-colors flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Kirim Jawaban & Kunci Ujian</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onDismiss}
              className="w-full py-3 px-4 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-sm shadow-md transition-colors cursor-pointer"
            >
              Saya Mengerti & Kembali Mengerjakan
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
