import React, { useState } from 'react';
import {
  Question,
  StudentAnswer,
} from '../../types/cbt';
import {
  Bookmark,
  CheckCircle2,
  Check,
  GripVertical,
  HelpCircle,
  Sparkles,
  Layers,
  ArrowRight,
  RefreshCw,
  BookOpen,
} from 'lucide-react';

interface QuestionViewProps {
  question: Question;
  studentAnswer?: StudentAnswer;
  isFlaggedForReview: boolean;
  fontSizeLevel: 'normal' | 'large' | 'xlarge';
  onAnswerChange: (answer: StudentAnswer) => void;
  onToggleReviewFlag: () => void;
  onPrevQuestion: () => void;
  onNextQuestion: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export const QuestionView: React.FC<QuestionViewProps> = ({
  question,
  studentAnswer,
  isFlaggedForReview,
  fontSizeLevel,
  onAnswerChange,
  onToggleReviewFlag,
  onPrevQuestion,
  onNextQuestion,
  isFirst,
  isLast,
}) => {
  // State for dragging item in Menjodohkan
  const [draggedOptionId, setDraggedOptionId] = useState<string | null>(null);
  const [hoveredDropZoneId, setHoveredDropZoneId] = useState<string | null>(null);
  const [selectedSourceCardId, setSelectedSourceCardId] = useState<string | null>(null);

  // Dynamic text size classes
  const textSizeClass =
    fontSizeLevel === 'xlarge'
      ? 'text-lg md:text-xl'
      : fontSizeLevel === 'large'
      ? 'text-base md:text-lg'
      : 'text-sm md:text-base';

  const stimulusTextSizeClass =
    fontSizeLevel === 'xlarge'
      ? 'text-base md:text-lg'
      : fontSizeLevel === 'large'
      ? 'text-sm md:text-base'
      : 'text-xs md:text-sm';

  // --- Handlers for each question type ---
  const handleSingleChoiceSelect = (key: string) => {
    onAnswerChange({
      ...studentAnswer,
      singleChoice: key,
    });
  };

  const handlePgkToggle = (key: string) => {
    const current = studentAnswer?.multiChoices || [];
    const updated = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key].sort();
    onAnswerChange({
      ...studentAnswer,
      multiChoices: updated,
    });
  };

  const handlePairMatch = (colIId: string, colIIId: string) => {
    const currentPairs = { ...(studentAnswer?.matchedPairs || {}) };
    if (!colIIId) {
      delete currentPairs[colIId];
    } else {
      currentPairs[colIId] = colIIId;
    }
    onAnswerChange({
      ...studentAnswer,
      matchedPairs: currentPairs,
    });
  };

  const handleShortAnswerChange = (val: string) => {
    onAnswerChange({
      ...studentAnswer,
      shortAnswer: val,
    });
  };

  const insertSymbolToShortAnswer = (sym: string) => {
    const cur = studentAnswer?.shortAnswer || '';
    handleShortAnswerChange(cur + sym);
  };

  const handleEssayChange = (text: string) => {
    onAnswerChange({
      ...studentAnswer,
      essayText: text,
    });
  };

  const insertSymbolToEssay = (sym: string) => {
    const cur = studentAnswer?.essayText || '';
    handleEssayChange(cur + sym);
  };

  return (
    <div className="bg-white/95 backdrop-blur-xs rounded-2xl shadow-xl shadow-purple-950/5 border border-purple-100 flex flex-col overflow-hidden">
      {/* Question Header Bar */}
      <div className="px-5 py-3.5 bg-gradient-to-r from-purple-50/90 via-rose-50/70 to-emerald-50/70 border-b border-purple-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2.5 py-1 rounded-lg bg-purple-700 text-white font-bold text-xs tracking-wide shadow-2xs">
            SOAL NO. {question.number}
          </span>
          <span className="text-xs font-semibold text-purple-900 bg-purple-100/70 px-2.5 py-0.5 rounded-md">
            {question.type === 'pilihan_ganda'
              ? 'Pilihan Ganda'
              : question.type === 'pgk'
              ? 'Pilihan Ganda Kompleks'
              : question.type === 'menjodohkan'
              ? 'Menjodohkan'
              : question.type === 'isian_singkat'
              ? 'Isian Singkat'
              : 'Uraian'}
          </span>
          <span className="text-[11px] font-medium text-emerald-800 bg-emerald-100/70 px-2 py-0.5 rounded-md hidden sm:inline">
            Bobot: {question.maxScore} Poin
          </span>
        </div>

        {/* Flag for Review */}
        <button
          type="button"
          onClick={onToggleReviewFlag}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-bold transition-all border cursor-pointer ${
            isFlaggedForReview
              ? 'bg-amber-100 border-amber-300 text-amber-900 shadow-2xs'
              : 'bg-white/80 border-slate-200 text-slate-600 hover:text-amber-800 hover:bg-amber-50'
          }`}
          title="Tandai nomor ini untuk ditinjau kembali sebelum mengakhiri ujian"
        >
          <Bookmark
            className={`w-3.5 h-3.5 ${
              isFlaggedForReview ? 'fill-amber-500 text-amber-600' : ''
            }`}
          />
          <span>{isFlaggedForReview ? 'Ragu-ragu (Ditinjau)' : 'Ragu-ragu'}</span>
        </button>
      </div>

      {/* Main Content Area */}
      <div className="p-5 md:p-7 space-y-6">
        {/* Stimulus Context Box */}
        <div className="rounded-xl p-4 md:p-5 bg-gradient-to-br from-[#FAF7FD] to-[#F5F2FC] border border-purple-100/90 shadow-2xs space-y-2.5 relative">
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-purple-600 shrink-0" />
            <h3 className="font-bold text-slate-900 text-xs md:text-sm tracking-wide">
              {question.stimulusTitle}
            </h3>
          </div>
          <div
            className={`text-slate-700 leading-relaxed font-sans ${stimulusTextSizeClass}`}
          >
            {question.stimulus}
          </div>
        </div>

        {/* Question Prompt */}
        <div className="space-y-2">
          <p className={`font-semibold text-slate-900 leading-relaxed ${textSizeClass}`}>
            {question.questionText}
          </p>
        </div>

        {/* --- QUESTION TYPE RENDERING --- */}

        {/* 1. Pilihan Ganda (Single Choice) */}
        {question.type === 'pilihan_ganda' && question.options && (
          <div className="space-y-3 pt-1">
            {question.options.map((opt) => {
              const isSelected = studentAnswer?.singleChoice === opt.key;
              return (
                <label
                  key={opt.key}
                  onClick={() => handleSingleChoiceSelect(opt.key)}
                  className={`flex items-start gap-3.5 p-3.5 md:p-4 rounded-xl border transition-all cursor-pointer select-none ${
                    isSelected
                      ? 'bg-purple-50/90 border-purple-500 shadow-xs ring-1 ring-purple-400'
                      : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50/30'
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs shrink-0 mt-0.5 transition-colors ${
                      isSelected
                        ? 'bg-purple-600 text-white'
                        : 'bg-slate-100 text-slate-700 border border-slate-300'
                    }`}
                  >
                    {opt.key}
                  </div>
                  <div
                    className={`text-slate-800 leading-relaxed ${textSizeClass} ${
                      isSelected ? 'font-medium text-purple-950' : ''
                    }`}
                  >
                    {opt.text}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* 2. Pilihan Ganda Kompleks (PGK: Multi-select without option letters A to E) */}
        {question.type === 'pgk' && question.options && (
          <div className="space-y-3 pt-1">
            <div className="p-2.5 rounded-lg bg-purple-50/60 border border-purple-100 text-xs text-purple-800 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
              <span>
                <strong>Petunjuk PGK:</strong> Berikan tanda centang pada semua pernyataan yang Anda anggap benar.
              </span>
            </div>
            {question.options.map((opt) => {
              const isChecked = (studentAnswer?.multiChoices || []).includes(
                opt.key
              );
              return (
                <label
                  key={opt.key}
                  onClick={() => handlePgkToggle(opt.key)}
                  className={`flex items-start gap-3.5 p-3.5 md:p-4 rounded-xl border transition-all cursor-pointer select-none group ${
                    isChecked
                      ? 'bg-purple-50/90 border-purple-500 shadow-xs ring-1 ring-purple-400'
                      : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-purple-50/30'
                  }`}
                >
                  <div
                    className={`w-5 h-5 rounded-md flex items-center justify-center text-xs shrink-0 mt-0.5 transition-all ${
                      isChecked
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'bg-white border-2 border-slate-300 group-hover:border-purple-400'
                    }`}
                  >
                    {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                  </div>
                  <div
                    className={`text-slate-800 leading-relaxed ${textSizeClass} ${
                      isChecked ? 'font-medium text-purple-950' : ''
                    }`}
                  >
                    {opt.text}
                  </div>
                </label>
              );
            })}
          </div>
        )}

        {/* 3. Menjodohkan (Interactive Drag and Drop) */}
        {question.type === 'menjodohkan' && question.matchingData && (
          <div className="space-y-5 pt-1">
            <div className="p-3 rounded-lg bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Petunjuk Drag & Drop:</strong> Tarik kartu pilihan dari <strong>Kolom II</strong> dan lepaskan pada kotak pasangan di <strong>Kolom I</strong> (atau klik kartu pilihan lalu klik kotak pasangan yang dituju).
              </span>
            </div>

            {/* Draggable Source Pills (Kolom II) */}
            <div className="p-4 rounded-xl bg-purple-50/40 border border-purple-100 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-purple-950 block">
                  Kolom II — Pilihan Model Matematika:
                </span>
                <span className="text-[11px] text-purple-700 italic">
                  Tarik kartu ke bawah atau klik kartu untuk memilih
                </span>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {question.matchingData.columnII.map((colII) => {
                  const isUsed = Object.values(
                    studentAnswer?.matchedPairs || {}
                  ).includes(colII.id);
                  const isSelected = selectedSourceCardId === colII.id;

                  return (
                    <div
                      key={colII.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedOptionId(colII.id);
                        e.dataTransfer.setData('text/plain', colII.id);
                      }}
                      onDragEnd={() => {
                        setDraggedOptionId(null);
                        setHoveredDropZoneId(null);
                      }}
                      onClick={() => {
                        if (selectedSourceCardId === colII.id) {
                          setSelectedSourceCardId(null);
                        } else {
                          setSelectedSourceCardId(colII.id);
                        }
                      }}
                      className={`px-3.5 py-2.5 rounded-xl text-xs md:text-sm font-semibold border transition-all select-none flex items-center gap-2.5 cursor-grab active:cursor-grabbing shadow-2xs ${
                        isSelected
                          ? 'bg-purple-700 text-white border-purple-800 ring-2 ring-purple-400 scale-105'
                          : isUsed
                          ? 'bg-purple-100/70 border-purple-300 text-purple-900 opacity-75'
                          : 'bg-white border-purple-200 text-purple-900 hover:border-purple-400 hover:shadow-xs'
                      }`}
                    >
                      <GripVertical className="w-3.5 h-3.5 text-purple-400" />
                      <span className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center text-[11px] font-bold shrink-0">
                        {colII.label}
                      </span>
                      <span>{colII.text}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Target Situations & Drop Zones (Kolom I) */}
            <div className="space-y-4">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-700 block">
                Kolom I — Situasi Kontekstual & Tempat Menempelkan Pasangan:
              </span>

              {question.matchingData.columnI.map((itemI) => {
                const currentMatchedId =
                  studentAnswer?.matchedPairs?.[itemI.id];
                const currentMatchedItem = question.matchingData?.columnII.find(
                  (c) => c.id === currentMatchedId
                );
                const isHovered = hoveredDropZoneId === itemI.id;

                const handleDropOnSlot = (optionId: string) => {
                  handlePairMatch(itemI.id, optionId);
                  setDraggedOptionId(null);
                  setHoveredDropZoneId(null);
                  setSelectedSourceCardId(null);
                };

                return (
                  <div
                    key={itemI.id}
                    className={`p-4 rounded-2xl border transition-all ${
                      isHovered
                        ? 'border-purple-500 bg-purple-100/40 ring-2 ring-purple-300'
                        : currentMatchedItem
                        ? 'bg-purple-50/40 border-purple-200'
                        : 'bg-white border-slate-200'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Statement description */}
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {itemI.label}
                        </span>
                        <p className={`text-slate-800 leading-relaxed font-medium ${textSizeClass}`}>
                          {itemI.text}
                        </p>
                      </div>

                      {/* Designated Drag-and-Drop Slot */}
                      <div
                        onDragOver={(e) => {
                          e.preventDefault();
                          setHoveredDropZoneId(itemI.id);
                        }}
                        onDragLeave={() => {
                          if (hoveredDropZoneId === itemI.id) {
                            setHoveredDropZoneId(null);
                          }
                        }}
                        onDrop={(e) => {
                          e.preventDefault();
                          const optId =
                            draggedOptionId || e.dataTransfer.getData('text/plain');
                          if (optId) {
                            handleDropOnSlot(optId);
                          }
                        }}
                        onClick={() => {
                          if (selectedSourceCardId) {
                            handleDropOnSlot(selectedSourceCardId);
                          }
                        }}
                        className={`p-3 rounded-xl border-2 transition-all flex items-center justify-between gap-3 ${
                          currentMatchedItem
                            ? 'border-solid border-purple-300 bg-white shadow-2xs'
                            : isHovered
                            ? 'border-dashed border-purple-600 bg-purple-100/80 scale-[1.01]'
                            : selectedSourceCardId
                            ? 'border-dashed border-purple-400 bg-purple-50/50 cursor-pointer animate-pulse'
                            : 'border-dashed border-slate-300 bg-slate-50/70 hover:border-purple-300 hover:bg-purple-50/30'
                        }`}
                      >
                        {currentMatchedItem ? (
                          <div className="flex items-center justify-between w-full">
                            <div className="flex items-center gap-2.5">
                              <span className="w-5 h-5 rounded-md bg-purple-600 text-white flex items-center justify-center text-[11px] font-bold">
                                {currentMatchedItem.label}
                              </span>
                              <span className="font-semibold text-purple-950 text-xs md:text-sm">
                                {currentMatchedItem.text}
                              </span>
                              <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200 hidden sm:inline">
                                ✓ Terpasang
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePairMatch(itemI.id, '');
                              }}
                              className="px-2.5 py-1 text-xs text-rose-600 hover:bg-rose-50 border border-rose-200 rounded-lg transition-colors cursor-pointer shrink-0 font-medium"
                              title="Lepas pasangan kartu ini"
                            >
                              Lepas ✕
                            </button>
                          </div>
                        ) : (
                          <div className="w-full text-center py-1 text-xs text-slate-500 font-medium">
                            {selectedSourceCardId ? (
                              <span className="text-purple-700 font-bold">
                                Klik di sini untuk menempelkan kartu yang dipilih
                              </span>
                            ) : (
                              <span>
                                Tarik & lepaskan kartu model ke sini
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 4. Isian Singkat */}
        {question.type === 'isian_singkat' && (
          <div className="space-y-4 pt-1">
            {/* Quick Math Symbols palette */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                Simbol Cepat:
              </span>
              {['x', '+', '-', '×', '÷', '^', '²', '√', 'g(x)', 'log', ',', '.'].map(
                (sym) => (
                  <button
                    key={sym}
                    type="button"
                    onClick={() => insertSymbolToShortAnswer(sym)}
                    className="px-2.5 py-1 bg-white hover:bg-purple-50 hover:text-purple-700 border border-slate-200 rounded-md font-mono font-medium shadow-2xs transition-colors cursor-pointer"
                  >
                    {sym}
                  </button>
                )
              )}
            </div>

            <div className="flex items-center gap-3 max-w-lg">
              <input
                type="text"
                value={studentAnswer?.shortAnswer || ''}
                onChange={(e) => handleShortAnswerChange(e.target.value)}
                placeholder={
                  question.shortAnswerPlaceholder || 'Ketikkan jawaban Anda...'
                }
                className={`w-full px-4 py-3 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 bg-white font-mono text-slate-900 ${textSizeClass}`}
              />
              {question.shortAnswerUnit && (
                <span className="text-sm font-semibold text-slate-600 whitespace-nowrap bg-slate-100 px-3 py-3 rounded-xl border border-slate-200">
                  {question.shortAnswerUnit}
                </span>
              )}
            </div>

            <p className="text-xs text-slate-500 italic">
              *Tuliskan rumus matematika atau nilai angka sesuai instruksi soal.
            </p>
          </div>
        )}

        {/* 5. Uraian */}
        {question.type === 'uraian' && (
          <div className="space-y-4 pt-1">
            {/* Sub-question guide breakdown */}
            {question.essaySubQuestions && (
              <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 space-y-2">
                <span className="text-xs font-bold text-purple-900 uppercase tracking-wider block">
                  Rincian Aspek yang Harus Dijawab:
                </span>
                <div className="space-y-1.5 text-xs text-slate-700">
                  {question.essaySubQuestions.map((sub) => (
                    <div key={sub.id} className="flex items-start gap-2">
                      <span className="font-bold text-purple-700 uppercase">
                        {sub.label}.
                      </span>
                      <span>{sub.prompt}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Quick Math Symbols palette for essay */}
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded-lg bg-slate-50 border border-slate-200 text-xs">
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
                Bantuan Notasi Matematika:
              </span>
              {[
                'f(x)',
                'g(x)',
                'S(t)',
                '∘',
                '⁻¹',
                '=',
                '≈',
                '≥',
                '≤',
                '²',
                '√',
                '1,05^t',
                'log()',
                'Rp',
              ].map((sym) => (
                <button
                  key={sym}
                  type="button"
                  onClick={() => insertSymbolToEssay(sym + ' ')}
                  className="px-2.5 py-1 bg-white hover:bg-purple-50 hover:text-purple-700 border border-slate-200 rounded-md font-mono text-xs shadow-2xs transition-colors cursor-pointer"
                >
                  {sym}
                </button>
              ))}
            </div>

            <textarea
              rows={10}
              value={studentAnswer?.essayText || ''}
              onChange={(e) => handleEssayChange(e.target.value)}
              placeholder="Tuliskan jawaban Anda secara terstruktur (model matematika, substitusi langkah hitungan, alasan logis, dan kesimpulan akhir)..."
              className={`w-full p-4 rounded-xl border border-slate-300 focus:border-purple-600 focus:ring-2 focus:ring-purple-200 bg-white font-sans text-slate-800 leading-relaxed ${textSizeClass}`}
            />

            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>
                Jumlah karakter: {(studentAnswer?.essayText || '').length}
              </span>
              <span className="text-emerald-700 font-medium">
                ✓ Otomatis tersimpan secara realtime
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation Bar */}
      <div className="p-4 md:p-5 bg-slate-50/80 border-t border-slate-200/80 flex items-center justify-between gap-3">
        <button
          type="button"
          disabled={isFirst}
          onClick={onPrevQuestion}
          className={`px-4 py-2 rounded-xl text-xs md:text-sm font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
            isFirst
              ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border-slate-200'
              : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 hover:border-slate-400 shadow-2xs'
          }`}
        >
          <span>← Sebelumnya</span>
        </button>

        <div className="text-xs font-semibold text-slate-500">
          Soal {question.number} dari 10
        </div>

        <button
          type="button"
          disabled={isLast}
          onClick={onNextQuestion}
          className={`px-5 py-2 rounded-xl text-xs md:text-sm font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
            isLast
              ? 'opacity-40 cursor-not-allowed bg-slate-100 text-slate-400 border border-slate-200'
              : 'bg-purple-700 hover:bg-purple-800 text-white shadow-xs shadow-purple-900/10'
          }`}
        >
          <span>Berikutnya →</span>
        </button>
      </div>
    </div>
  );
};
