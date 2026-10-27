import React from 'react';
import { Question, StudentAnswer } from '../../types/cbt';
import { CheckCircle2, Bookmark, Circle, Send } from 'lucide-react';

interface QuestionNavigationProps {
  questions: Question[];
  currentQuestionIndex: number;
  answers: Record<number, StudentAnswer>;
  reviewFlags: Record<number, boolean>;
  onSelectQuestion: (index: number) => void;
  onRequestSubmit: () => void;
}

export const QuestionNavigation: React.FC<QuestionNavigationProps> = ({
  questions,
  currentQuestionIndex,
  answers,
  reviewFlags,
  onSelectQuestion,
  onRequestSubmit,
}) => {
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
    <div className="bg-white/95 backdrop-blur-xs rounded-2xl p-5 shadow-xl shadow-purple-950/5 border border-purple-100 flex flex-col gap-4">
      <div className="flex items-center justify-between border-b border-purple-100/80 pb-3">
        <h3 className="font-bold text-slate-800 text-sm tracking-wide">
          Navigasi Nomor Soal
        </h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
          {answeredCount}/{questions.length} Terjawab
        </span>
      </div>

      {/* Grid Palette 1 - 10 */}
      <div className="grid grid-cols-5 gap-2.5">
        {questions.map((q, idx) => {
          const isActive = currentQuestionIndex === idx;
          const isAnswered = isQuestionAnswered(q);
          const isFlagged = reviewFlags[q.id];

          let btnClass = 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50';
          if (isFlagged) {
            btnClass = 'bg-amber-100 border-amber-400 text-amber-900 font-bold';
          } else if (isAnswered) {
            btnClass = 'bg-emerald-600 border-emerald-700 text-white font-bold shadow-2xs';
          }

          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onSelectQuestion(idx)}
              className={`h-11 rounded-xl border flex flex-col items-center justify-center text-sm font-semibold relative transition-all cursor-pointer ${btnClass} ${
                isActive
                  ? 'ring-3 ring-purple-500 ring-offset-2 scale-105 z-10'
                  : ''
              }`}
              title={`Nomor ${q.number} (${
                isFlagged
                  ? 'Ragu-ragu'
                  : isAnswered
                  ? 'Sudah dijawab'
                  : 'Belum dijawab'
              })`}
            >
              <span>{q.number}</span>
              {isFlagged && (
                <span className="w-1.5 h-1.5 rounded-full bg-amber-600 absolute bottom-1.5" />
              )}
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="pt-2 border-t border-slate-100 space-y-1.5 text-xs text-slate-600">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-emerald-600 border border-emerald-700" />
            <span>Sudah Dijawab</span>
          </div>
          <span className="font-bold text-emerald-700">{answeredCount}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-amber-100 border border-amber-400" />
            <span>Ragu-ragu (Ditinjau)</span>
          </div>
          <span className="font-bold text-amber-700">{flaggedCount}</span>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-md bg-white border border-slate-300" />
            <span>Belum Dijawab</span>
          </div>
          <span className="font-bold text-slate-500">{unansweredCount}</span>
        </div>
      </div>

      {/* Finish Exam Button inside Navigation Panel */}
      <div className="pt-2">
        <button
          type="button"
          onClick={onRequestSubmit}
          className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-purple-700 to-indigo-700 hover:from-purple-800 hover:to-indigo-800 text-white font-bold text-xs md:text-sm shadow-md shadow-purple-900/15 flex items-center justify-center gap-2 cursor-pointer transition-all active:scale-[0.99]"
        >
          <Send className="w-4 h-4" />
          <span>Selesaikan & Kumpulkan</span>
        </button>
      </div>
    </div>
  );
};
