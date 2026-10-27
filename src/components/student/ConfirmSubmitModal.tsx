import React from 'react';
import { AlertCircle, CheckCircle2, Bookmark, HelpCircle } from 'lucide-react';
import { Question, StudentAnswer } from '../../types/cbt';

interface ConfirmSubmitModalProps {
  isOpen: boolean;
  questions: Question[];
  answers: Record<number, StudentAnswer>;
  reviewFlags: Record<number, boolean>;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmSubmitModal: React.FC<ConfirmSubmitModalProps> = ({
  isOpen,
  questions,
  answers,
  reviewFlags,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  const isQuestionAnswered = (q: Question) => {
    const ans = answers[q.id];
    if (!ans) return false;
    if (q.type === 'pilihan_ganda') return Boolean(ans.singleChoice);
    if (q.type === 'pgk') return Boolean(ans.multiChoices && ans.multiChoices.length > 0);
    if (q.type === 'menjodohkan') {
      const matched = ans.matchedPairs || {};
      return Object.keys(matched).length > 0;
    }
    if (q.type === 'isian_singkat') return Boolean(ans.shortAnswer && ans.shortAnswer.trim());
    if (q.type === 'uraian') return Boolean(ans.essayText && ans.essayText.trim());
    return false;
  };

  const answeredCount = questions.filter((q) => isQuestionAnswered(q)).length;
  const flaggedCount = questions.filter((q) => reviewFlags[q.id]).length;
  const unansweredCount = questions.length - answeredCount;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-purple-100 space-y-5 animate-scaleUp">
        <div className="text-center space-y-1">
          <h3 className="text-xl font-bold text-slate-900">
            Konfirmasi Akhiri Ujian
          </h3>
          <p className="text-xs text-slate-500">
            Pastikan seluruh nomor telah diperiksa sebelum mengirim lembar jawaban.
          </p>
        </div>

        {/* Summary Badges */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-center">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 mx-auto mb-1" />
            <div className="text-lg font-extrabold text-emerald-800">
              {answeredCount}
            </div>
            <div className="text-[11px] font-semibold text-emerald-700">
              Terjawab
            </div>
          </div>

          <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-center">
            <Bookmark className="w-5 h-5 text-amber-600 mx-auto mb-1" />
            <div className="text-lg font-extrabold text-amber-800">
              {flaggedCount}
            </div>
            <div className="text-[11px] font-semibold text-amber-700">
              Ragu-ragu
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-100 border border-slate-200 text-center">
            <HelpCircle className="w-5 h-5 text-slate-500 mx-auto mb-1" />
            <div className="text-lg font-extrabold text-slate-700">
              {unansweredCount}
            </div>
            <div className="text-[11px] font-semibold text-slate-600">
              Kosong
            </div>
          </div>
        </div>

        {/* Unanswered or flagged warning */}
        {(unansweredCount > 0 || flaggedCount > 0) && (
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <div className="leading-relaxed">
              Peringatan: Terdapat{' '}
              {unansweredCount > 0 && <strong>{unansweredCount} butir belum dijawab</strong>}
              {unansweredCount > 0 && flaggedCount > 0 && ' dan '}
              {flaggedCount > 0 && <strong>{flaggedCount} butir masih ditandai ragu-ragu</strong>}
              . Jika Anda mengirim sekarang, nomor yang kosong akan bernilai 0.
            </div>
          </div>
        )}

        <div className="p-3 rounded-xl bg-purple-50 text-[11px] text-purple-900 border border-purple-100 leading-relaxed text-center">
          Setelah ujian diakhiri, Anda tidak dapat mengubah jawaban lagi. Hasil jawaban objektif dan uraian akan diserahkan kepada guru.
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-bold text-xs md:text-sm transition-colors cursor-pointer"
          >
            Periksa Kembali
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-3 px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs md:text-sm shadow-md transition-colors cursor-pointer"
          >
            Ya, Akhiri & Kirim
          </button>
        </div>
      </div>
    </div>
  );
};
