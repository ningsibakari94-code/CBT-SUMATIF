import React, { useState } from 'react';
import {
  StudentExamSession,
  EssayRubricScore,
} from '../../types/cbt';
import {
  QUESTIONS_DATA,
  ANSWER_KEYS_DATA,
  RUBRIC_ANALYTIC_ASPECTS,
  EXAM_METADATA,
} from '../../data/examData';
import { updateSessionEssayRubric } from '../../utils/storage';
import {
  X,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Award,
  Save,
  RotateCcw,
  Clock,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface StudentGradingModalProps {
  session: StudentExamSession;
  onClose: () => void;
  onSaved: (updatedSession: StudentExamSession) => void;
  onResetStudentForRetake: (participantNumber: string) => void;
}

export const StudentGradingModal: React.FC<StudentGradingModalProps> = ({
  session,
  onClose,
  onSaved,
  onResetStudentForRetake,
}) => {
  const [rubric9, setRubric9] = useState<EssayRubricScore>(
    session.scores.essayRubrics?.[9] || {
      identifikasi: 0,
      model: 0,
      hitungan: 0,
      penalaran: 0,
      kesimpulan: 0,
      feedback: '',
    }
  );

  const [rubric10, setRubric10] = useState<EssayRubricScore>(
    session.scores.essayRubrics?.[10] || {
      identifikasi: 0,
      model: 0,
      hitungan: 0,
      penalaran: 0,
      kesimpulan: 0,
      feedback: '',
    }
  );

  const [activeTab, setActiveTab] = useState<'soal' | 'pelanggaran'>('soal');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const totalEssay9 =
    rubric9.identifikasi +
    rubric9.model +
    rubric9.hitungan +
    rubric9.penalaran +
    rubric9.kesimpulan;

  const totalEssay10 =
    rubric10.identifikasi +
    rubric10.model +
    rubric10.hitungan +
    rubric10.penalaran +
    rubric10.kesimpulan;

  const totalScoreLive =
    session.scores.objectiveScore + totalEssay9 + totalEssay10;

  const finalScore100Live = Number(
    ((totalScoreLive / EXAM_METADATA.maxTotalScore) * 100).toFixed(1)
  );

  const handleSave = () => {
    // Update question 9
    updateSessionEssayRubric(session.id, 9, rubric9);
    // Update question 10
    const final = updateSessionEssayRubric(session.id, 10, rubric10);
    if (final) {
      onSaved(final);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-2xl border border-purple-100 overflow-hidden">
        {/* Modal Top Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-50 via-rose-50 to-emerald-50 border-b border-purple-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-purple-700 text-white flex items-center justify-center font-bold text-sm shadow-xs">
              {session.studentClass.replace(/[^0-9]/g, '') || 'XI'}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-extrabold text-slate-800 text-base md:text-lg">
                  {session.studentName}
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-purple-100 text-purple-800">
                  {session.studentClass} • No. {session.participantNumber}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Mulai: {new Date(session.startTime).toLocaleTimeString('id-ID')} • Selesai: {session.finishTime ? new Date(session.finishTime).toLocaleTimeString('id-ID') : '-'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Score pill */}
            <div className="text-right">
              <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                Nilai Akhir
              </div>
              <div className="text-xl md:text-2xl font-black text-purple-800 font-mono">
                {finalScore100Live}{' '}
                <span className="text-xs font-normal text-slate-500">
                  ({totalScoreLive}/38)
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs inside modal */}
        <div className="px-6 border-b border-slate-200 bg-slate-50/70 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('soal')}
              className={`py-3 px-3 text-xs md:text-sm font-bold border-b-2 cursor-pointer transition-colors ${
                activeTab === 'soal'
                  ? 'border-purple-600 text-purple-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              Lembar Jawaban & Penilaian (10 Soal)
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('pelanggaran')}
              className={`py-3 px-3 text-xs md:text-sm font-bold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                activeTab === 'pelanggaran'
                  ? 'border-purple-600 text-purple-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>Log Tab ({session.tabViolations?.length || 0})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => {
              if (
                window.confirm(
                  `Apakah Anda yakin ingin mereset ujian murid "${session.studentName}" agar dapat mengerjakan ulang?`
                )
              ) {
                onResetStudentForRetake(session.participantNumber);
                onClose();
              }
            }}
            className="text-xs text-rose-600 hover:text-rose-800 hover:underline flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Izinkan Ujian Ulang</span>
          </button>
        </div>

        {/* Scrollable Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {activeTab === 'pelanggaran' ? (
            <div className="space-y-4">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <ShieldAlert className="w-4 h-4 text-rose-600" />
                Catatan Kejadian Pengawasan & Perpindahan Tab
              </h4>
              {(!session.tabViolations || session.tabViolations.length === 0) ? (
                <div className="p-8 rounded-2xl bg-emerald-50 border border-emerald-200 text-center text-emerald-800 text-sm">
                  <CheckCircle className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                  <strong>Tertib & Aman:</strong> Tidak ada catatan perpindahan tab atau kehilangan fokus selama ujian berlangsung.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {session.tabViolations.map((v, i) => (
                    <div
                      key={i}
                      className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-3"
                    >
                      <span className="w-5 h-5 rounded-full bg-rose-200 text-rose-800 font-bold flex items-center justify-center shrink-0">
                        {i + 1}
                      </span>
                      <div>
                        <div className="font-bold">
                          {new Date(v.timestamp).toLocaleTimeString('id-ID', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}{' '}
                          — {v.type === 'visibility_hidden' ? 'Perpindahan Tab / Minimize' : 'Kehilangan Fokus Jendela'}
                        </div>
                        <p className="mt-0.5 text-rose-700">{v.description}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-6">
              {QUESTIONS_DATA.map((q) => {
                const key = ANSWER_KEYS_DATA[q.id];
                const ans = session.answers[q.id];
                const score = session.scores.perQuestion[q.id] ?? 0;
                const isEssay = q.type === 'uraian';

                return (
                  <div
                    key={q.id}
                    className="p-5 rounded-2xl border border-slate-200 bg-white shadow-2xs space-y-4"
                  >
                    {/* Item Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="px-2.5 py-0.5 rounded-lg bg-slate-800 text-white font-bold text-xs">
                          No. {q.number}
                        </span>
                        <span className="text-xs font-semibold text-purple-700 bg-purple-50 px-2 py-0.5 rounded-md">
                          {q.type.replace('_', ' ').toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-500 hidden sm:inline">
                          ({q.cognitiveLevel})
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-slate-700">
                          Skor:{' '}
                          <strong className="text-purple-700 font-mono text-sm">
                            {isEssay
                              ? q.id === 9
                                ? totalEssay9
                                : totalEssay10
                              : score}
                          </strong>{' '}
                          / {q.maxScore}
                        </span>
                      </div>
                    </div>

                    {/* Question text snippet */}
                    <div className="text-xs md:text-sm text-slate-700 leading-relaxed font-medium">
                      {q.questionText}
                    </div>

                    {/* Student's answer display */}
                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-2">
                      <div className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                        Jawaban Murid:
                      </div>

                      {q.type === 'pilihan_ganda' && (
                        <div className="font-mono text-sm text-slate-900 font-bold">
                          {ans?.singleChoice ? `Opsi ${ans.singleChoice}` : 'Kosong / Tidak dijawab'}
                        </div>
                      )}

                      {q.type === 'pgk' && (
                        <div className="font-mono text-sm text-slate-900 font-bold">
                          {ans?.multiChoices && ans.multiChoices.length > 0
                            ? `Pilihan: ${ans.multiChoices.join(', ')}`
                            : 'Kosong / Tidak dijawab'}
                        </div>
                      )}

                      {q.type === 'menjodohkan' && (
                        <div className="space-y-1 text-slate-800">
                          {q.matchingData?.columnI.map((item) => (
                            <div key={item.id} className="flex items-center gap-2">
                              <span className="font-semibold text-slate-700">
                                Butir {item.label}:
                              </span>
                              <span className="font-mono font-bold text-purple-800">
                                {ans?.matchedPairs?.[item.id] || 'Belum dipasangkan'}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {q.type === 'isian_singkat' && (
                        <div className="font-mono text-sm text-slate-900 font-bold">
                          {ans?.shortAnswer || 'Kosong / Tidak dijawab'}
                        </div>
                      )}

                      {q.type === 'uraian' && (
                        <div className="p-3 rounded-lg bg-white border border-slate-200 text-slate-800 whitespace-pre-wrap leading-relaxed max-h-60 overflow-y-auto font-sans">
                          {ans?.essayText || '(Murid tidak menuliskan uraian)'}
                        </div>
                      )}
                    </div>

                    {/* Key & Discussion info */}
                    <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-100 text-xs text-slate-700 space-y-1.5">
                      <div className="font-bold text-purple-900 flex items-center justify-between">
                        <span>Kunci & Pedoman Penskoran:</span>
                        <span className="text-[11px] font-medium text-purple-700">
                          {key?.scoringGuide}
                        </span>
                      </div>
                      <p className="whitespace-pre-wrap text-slate-600 leading-relaxed">
                        {key?.explanation}
                      </p>
                    </div>

                    {/* --- If Essay: Interactive Rubric Scoring --- */}
                    {isEssay && (
                      <div className="p-4 rounded-2xl bg-gradient-to-br from-purple-50/70 to-indigo-50/40 border border-purple-200 space-y-3.5">
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-purple-900 text-xs md:text-sm flex items-center gap-1.5">
                            <Award className="w-4 h-4 text-purple-600" />
                            Rubrik Penilaian Analitik Guru (Maks 10 Poin)
                          </h5>
                          <span className="text-xs font-extrabold text-purple-800 bg-purple-100 px-2.5 py-1 rounded-lg">
                            Subtotal: {q.id === 9 ? totalEssay9 : totalEssay10} / 10 Poin
                          </span>
                        </div>

                        {/* 5 Aspects Score Pickers */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5">
                          {RUBRIC_ANALYTIC_ASPECTS.map((asp) => {
                            const curRubric = q.id === 9 ? rubric9 : rubric10;
                            const setCurRubric = q.id === 9 ? setRubric9 : setRubric10;

                            let aspectKey: keyof EssayRubricScore = 'identifikasi';
                            if (asp.aspect.includes('Identifikasi')) aspectKey = 'identifikasi';
                            else if (asp.aspect.includes('model')) aspectKey = 'model';
                            else if (asp.aspect.includes('perhitungan')) aspectKey = 'hitungan';
                            else if (asp.aspect.includes('Penalaran')) aspectKey = 'penalaran';
                            else if (asp.aspect.includes('Kesimpulan')) aspectKey = 'kesimpulan';

                            const val = (curRubric[aspectKey] as number) || 0;

                            return (
                              <div
                                key={asp.aspect}
                                className="p-2.5 rounded-xl bg-white border border-purple-100 text-xs space-y-1.5 shadow-2xs"
                              >
                                <div className="font-bold text-slate-800 leading-tight">
                                  {asp.aspect}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                  Maks {asp.maxScore} poin
                                </div>
                                <div className="flex items-center gap-1 pt-1">
                                  {Array.from(
                                    { length: asp.maxScore + 1 },
                                    (_, num) => (
                                      <button
                                        key={num}
                                        type="button"
                                        onClick={() =>
                                          setCurRubric({
                                            ...curRubric,
                                            [aspectKey]: num,
                                          })
                                        }
                                        className={`flex-1 py-1 rounded-md font-mono text-xs font-bold transition-all cursor-pointer ${
                                          val === num
                                            ? 'bg-purple-700 text-white shadow-2xs'
                                            : 'bg-slate-100 hover:bg-purple-100 text-slate-700'
                                        }`}
                                      >
                                        {num}
                                      </button>
                                    )
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>

                        {/* Teacher Feedback Note for this Essay */}
                        <div>
                          <label className="block text-[11px] font-bold text-purple-900 uppercase tracking-wider mb-1">
                            Catatan / Umpan Balik Guru (Opsional):
                          </label>
                          <input
                            type="text"
                            value={
                              (q.id === 9
                                ? rubric9.feedback
                                : rubric10.feedback) || ''
                            }
                            onChange={(e) => {
                              if (q.id === 9) {
                                setRubric9({ ...rubric9, feedback: e.target.value });
                              } else {
                                setRubric10({ ...rubric10, feedback: e.target.value });
                              }
                            }}
                            placeholder="Tuliskan catatan evaluasi atau alasan pemberian skor..."
                            className="w-full px-3 py-1.5 rounded-xl border border-purple-200 text-xs bg-white focus:border-purple-500"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Modal Bottom Sticky Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-4">
          <div className="text-xs text-slate-600">
            {saveSuccess ? (
              <span className="text-emerald-700 font-bold flex items-center gap-1.5">
                <CheckCircle className="w-4 h-4 text-emerald-600" />
                Skor rubrik berhasil disimpan & nilai akhir diperbarui!
              </span>
            ) : (
              <span>
                Total skor objektif ({session.scores.objectiveScore}) + uraian (
                {totalEssay9 + totalEssay10}) ={' '}
                <strong className="text-purple-800 font-bold">
                  {totalScoreLive} / 38 poin
                </strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-100 text-slate-700 font-semibold text-xs md:text-sm cursor-pointer"
            >
              Tutup
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="py-2.5 px-5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-bold text-xs md:text-sm shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Penilaian Uraian</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
