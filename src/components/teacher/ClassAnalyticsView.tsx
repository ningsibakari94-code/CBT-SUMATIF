import React, { useMemo } from 'react';
import {
  StudentExamSession,
  ExamSettings,
} from '../../types/cbt';
import {
  QUESTIONS_DATA,
  ANSWER_KEYS_DATA,
  RUBRIC_ANALYTIC_ASPECTS,
  EXAM_METADATA,
} from '../../data/examData';
import {
  TrendingUp,
  BarChart3,
  Award,
  Users,
  Target,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Compass,
} from 'lucide-react';

interface ClassAnalyticsViewProps {
  sessions: StudentExamSession[];
  settings: ExamSettings;
  selectedClassFilter: string;
}

export const ClassAnalyticsView: React.FC<ClassAnalyticsViewProps> = ({
  sessions,
  settings,
  selectedClassFilter,
}) => {
  // Filter sessions if class filter selected
  const filteredSessions = useMemo(() => {
    if (selectedClassFilter === 'all') return sessions;
    return sessions.filter((s) => s.studentClass === selectedClassFilter);
  }, [sessions, selectedClassFilter]);

  const completedSessions = useMemo(
    () => filteredSessions.filter((s) => s.status !== 'in-progress'),
    [filteredSessions]
  );

  const n = completedSessions.length;

  // Basic stats calculation
  const stats = useMemo(() => {
    if (n === 0) {
      return {
        highest: 0,
        lowest: 0,
        average: 0,
        median: 0,
        passRate: 0,
        passCount: 0,
      };
    }

    const scores = completedSessions
      .map((s) => s.scores.finalScore100)
      .sort((a, b) => a - b);

    const highest = Math.max(...scores);
    const lowest = Math.min(...scores);
    const sum = scores.reduce((acc, v) => acc + v, 0);
    const average = Number((sum / n).toFixed(1));

    // Median
    let median = 0;
    const mid = Math.floor(scores.length / 2);
    if (scores.length % 2 === 0) {
      median = Number(((scores[mid - 1] + scores[mid]) / 2).toFixed(1));
    } else {
      median = scores[mid];
    }

    const passCount = completedSessions.filter(
      (s) => s.scores.finalScore100 >= settings.kkmScore
    ).length;
    const passRate = Number(((passCount / n) * 100).toFixed(1));

    return { highest, lowest, average, median, passRate, passCount };
  }, [completedSessions, n, settings.kkmScore]);

  // Score distribution brackets
  const distribution = useMemo(() => {
    const buckets = [
      { label: '< 60', count: 0, color: 'bg-rose-400' },
      { label: '60 – 69', count: 0, color: 'bg-amber-400' },
      { label: '70 – 79', count: 0, color: 'bg-blue-400' },
      { label: '80 – 89', count: 0, color: 'bg-indigo-500' },
      { label: '90 – 100', count: 0, color: 'bg-emerald-500' },
    ];

    completedSessions.forEach((s) => {
      const score = s.scores.finalScore100;
      if (score < 60) buckets[0].count++;
      else if (score < 70) buckets[1].count++;
      else if (score < 80) buckets[2].count++;
      else if (score < 90) buckets[3].count++;
      else buckets[4].count++;
    });

    return buckets;
  }, [completedSessions]);

  // Item Analysis (Tingkat Kesulitan Empiris P, Daya Pembeda, dan Distraktor)
  const itemAnalysis = useMemo(() => {
    if (n === 0) return [];

    return QUESTIONS_DATA.map((q) => {
      const maxSc = q.maxScore;
      const isObjective = q.type !== 'uraian';

      let totalPointsEarned = 0;
      let fullCorrectCount = 0;
      const choiceCounts: Record<string, number> = {};

      completedSessions.forEach((s) => {
        const sc = s.scores.perQuestion[q.id] ?? 0;
        totalPointsEarned += sc;
        if (sc === maxSc) {
          fullCorrectCount++;
        }

        const ans = s.answers[q.id];
        if (q.type === 'pilihan_ganda' && ans?.singleChoice) {
          choiceCounts[ans.singleChoice] =
            (choiceCounts[ans.singleChoice] || 0) + 1;
        } else if (q.type === 'pgk' && ans?.multiChoices) {
          const combo = ans.multiChoices.join(',');
          if (combo) {
            choiceCounts[combo] = (choiceCounts[combo] || 0) + 1;
          }
        }
      });

      // P (Empirical Difficulty Index)
      // For objective questions, proportion of correct answers
      const pValue = Number((fullCorrectCount / n).toFixed(2));
      let difficultyCategory = 'Sedang';
      if (pValue < 0.3) difficultyCategory = 'Sukar';
      else if (pValue > 0.7) difficultyCategory = 'Mudah';

      // Most frequent distractor (jawaban salah paling sering)
      let mostCommonDistractor = '-';
      const key = ANSWER_KEYS_DATA[q.id];
      if (q.type === 'pilihan_ganda') {
        const distractors = Object.entries(choiceCounts).filter(
          ([ch]) => ch !== key?.correctChoice
        );
        distractors.sort((a, b) => b[1] - a[1]);
        if (distractors.length > 0 && distractors[0][1] > 0) {
          mostCommonDistractor = `Opsi ${distractors[0][0]} (${distractors[0][1]} murid)`;
        }
      }

      const meanScore = Number((totalPointsEarned / n).toFixed(2));
      const achievementRate = Number(((meanScore / maxSc) * 100).toFixed(1));

      return {
        question: q,
        isObjective,
        fullCorrectCount,
        pValue,
        difficultyCategory,
        meanScore,
        achievementRate,
        mostCommonDistractor,
      };
    });
  }, [completedSessions, n]);

  // Analytic Rubric Breakdown for Essay 9 & 10
  const essayRubricStats = useMemo(() => {
    if (n === 0) return null;

    const stats = {
      9: { identifikasi: 0, model: 0, hitungan: 0, penalaran: 0, kesimpulan: 0 },
      10: { identifikasi: 0, model: 0, hitungan: 0, penalaran: 0, kesimpulan: 0 },
    };

    completedSessions.forEach((s) => {
      const r9 = s.scores.essayRubrics?.[9];
      const r10 = s.scores.essayRubrics?.[10];

      if (r9) {
        stats[9].identifikasi += r9.identifikasi;
        stats[9].model += r9.model;
        stats[9].hitungan += r9.hitungan;
        stats[9].penalaran += r9.penalaran;
        stats[9].kesimpulan += r9.kesimpulan;
      }
      if (r10) {
        stats[10].identifikasi += r10.identifikasi;
        stats[10].model += r10.model;
        stats[10].hitungan += r10.hitungan;
        stats[10].penalaran += r10.penalaran;
        stats[10].kesimpulan += r10.kesimpulan;
      }
    });

    return {
      q9: {
        identifikasi: Number((stats[9].identifikasi / n).toFixed(2)),
        model: Number((stats[9].model / n).toFixed(2)),
        hitungan: Number((stats[9].hitungan / n).toFixed(2)),
        penalaran: Number((stats[9].penalaran / n).toFixed(2)),
        kesimpulan: Number((stats[9].kesimpulan / n).toFixed(2)),
      },
      q10: {
        identifikasi: Number((stats[10].identifikasi / n).toFixed(2)),
        model: Number((stats[10].model / n).toFixed(2)),
        hitungan: Number((stats[10].hitungan / n).toFixed(2)),
        penalaran: Number((stats[10].penalaran / n).toFixed(2)),
        kesimpulan: Number((stats[10].kesimpulan / n).toFixed(2)),
      },
    };
  }, [completedSessions, n]);

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Sample Size Warning if N is small */}
      {n < 10 && (
        <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed">
            <strong>Catatan Keterbatasan Interpretasi Statistik:</strong> Jumlah data yang telah selesai saat ini baru berjumlah <strong>{n} peserta</strong>. Analisis psikometrik (tingkat kesulitan empiris P, median, dan daya beda) membutuhkan minimal 15–30 peserta agar representatif dan stabil secara statistik. Anda dapat mencoba tombol <em>"Muat Data Simulasi 15 Murid"</em> pada tab Pengaturan untuk menguji visualisasi data kelas penuh.
          </div>
        </div>
      )}

      {/* Top 4 KPI Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-5 rounded-2xl bg-white border border-purple-100 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Rata-rata Kelas</span>
            <TrendingUp className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-slate-800 font-mono">
            {stats.average}
          </div>
          <div className="text-[11px] text-slate-500">
            Median: <strong className="text-purple-700">{stats.median}</strong>
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-purple-100 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Ketuntasan (KKTP {settings.kkmScore})</span>
            <Target className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-emerald-700 font-mono">
            {stats.passRate}%
          </div>
          <div className="text-[11px] text-slate-500">
            {stats.passCount} dari {n} murid tuntas
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-purple-100 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Nilai Tertinggi</span>
            <Award className="w-4 h-4 text-amber-500" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-purple-900 font-mono">
            {stats.highest}
          </div>
          <div className="text-[11px] text-slate-500">
            Skor puncak dari 100
          </div>
        </div>

        <div className="p-5 rounded-2xl bg-white border border-purple-100 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
            <span>Nilai Terendah</span>
            <HelpCircle className="w-4 h-4 text-rose-500" />
          </div>
          <div className="text-2xl md:text-3xl font-extrabold text-rose-800 font-mono">
            {stats.lowest}
          </div>
          <div className="text-[11px] text-slate-500">
            Rentang nilai: {stats.highest - stats.lowest} poin
          </div>
        </div>
      </div>

      {/* Score Distribution Histogram */}
      <div className="p-6 rounded-2xl bg-white border border-purple-100 shadow-xs space-y-4">
        <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-purple-600" />
          Distribusi Sebaran Nilai Akhir Peserta
        </h4>

        <div className="space-y-3 pt-2">
          {distribution.map((d) => {
            const pct = n > 0 ? Math.round((d.count / n) * 100) : 0;
            return (
              <div key={d.label} className="space-y-1">
                <div className="flex items-center justify-between text-xs text-slate-700">
                  <span className="font-semibold w-20">{d.label}</span>
                  <span className="text-slate-500">
                    {d.count} murid ({pct}%)
                  </span>
                </div>
                <div className="h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div
                    className={`h-full ${d.color} transition-all duration-500`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Item Analysis & Empirical Difficulty (Kisi-kisi alignment) */}
      <div className="p-6 rounded-2xl bg-white border border-purple-100 shadow-xs space-y-4">
        <div>
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Compass className="w-4 h-4 text-purple-600" />
            Analisis Butir Soal & Ketercapaian Indikator Pembelajaran
          </h4>
          <p className="text-xs text-slate-500 mt-1">
            Menghubungkan tingkat kesulitan empiris proporsi benar (P) dengan Kisi-kisi Kurikulum dan telaah pengecoh (distraktor).
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-bold">
                <th className="py-2.5 px-3">No</th>
                <th className="py-2.5 px-3">Bentuk</th>
                <th className="py-2.5 px-3">Indikator Pembelajaran</th>
                <th className="py-2.5 px-3 text-center">Level</th>
                <th className="py-2.5 px-3 text-center">Tingkat Kesulitan (P)</th>
                <th className="py-2.5 px-3 text-center">Ketercapaian</th>
                <th className="py-2.5 px-3">Distraktor Tersering</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {itemAnalysis.map((item) => (
                <tr key={item.question.id} className="hover:bg-purple-50/30 transition-colors">
                  <td className="py-2.5 px-3 font-bold text-slate-900">
                    {item.question.number}
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="px-2 py-0.5 rounded-md bg-purple-50 text-purple-800 font-medium">
                      {item.question.type.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700 max-w-xs leading-snug font-medium">
                    {item.question.learningIndicator}
                  </td>
                  <td className="py-2.5 px-3 text-center text-slate-600">
                    {item.question.cognitiveLevel.split('–')[0]}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {item.isObjective ? (
                      <div>
                        <span
                          className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${
                            item.difficultyCategory === 'Sukar'
                              ? 'bg-rose-100 text-rose-800'
                              : item.difficultyCategory === 'Sedang'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {item.difficultyCategory} (P = {item.pValue})
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-400 italic">Rubrik Uraian</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-center font-bold text-purple-900">
                    {item.achievementRate}%
                  </td>
                  <td className="py-2.5 px-3 text-slate-600">
                    {item.mostCommonDistractor}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Rekap Aspek Rubrik Uraian (Soal 9 & 10) */}
      {essayRubricStats && (
        <div className="p-6 rounded-2xl bg-white border border-purple-100 shadow-xs space-y-4">
          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
            <Award className="w-4 h-4 text-purple-600" />
            Rekap Kinerja Aspek Rubrik Analitik Uraian (Soal 9 & 10)
          </h4>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Soal 9 */}
            <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 space-y-3">
              <div className="font-bold text-slate-800 text-xs border-b border-purple-100 pb-2">
                Soal 9 — Model Biaya Perjalanan & Komposisi Fungsi
              </div>
              <div className="space-y-2 text-xs">
                {RUBRIC_ANALYTIC_ASPECTS.map((asp) => {
                  let val = 0;
                  if (asp.aspect.includes('Identifikasi')) val = essayRubricStats.q9.identifikasi;
                  else if (asp.aspect.includes('model')) val = essayRubricStats.q9.model;
                  else if (asp.aspect.includes('perhitungan')) val = essayRubricStats.q9.hitungan;
                  else if (asp.aspect.includes('Penalaran')) val = essayRubricStats.q9.penalaran;
                  else if (asp.aspect.includes('Kesimpulan')) val = essayRubricStats.q9.kesimpulan;

                  const pct = Math.round((val / asp.maxScore) * 100);
                  return (
                    <div key={asp.aspect} className="space-y-1">
                      <div className="flex justify-between text-slate-700">
                        <span>{asp.aspect}</span>
                        <span className="font-semibold">
                          {val} / {asp.maxScore} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Soal 10 */}
            <div className="p-4 rounded-xl bg-purple-50/50 border border-purple-100 space-y-3">
              <div className="font-bold text-slate-800 text-xs border-b border-purple-100 pb-2">
                Soal 10 — Model Eksponensial, Invers Logaritma & Periode Bulat
              </div>
              <div className="space-y-2 text-xs">
                {RUBRIC_ANALYTIC_ASPECTS.map((asp) => {
                  let val = 0;
                  if (asp.aspect.includes('Identifikasi')) val = essayRubricStats.q10.identifikasi;
                  else if (asp.aspect.includes('model')) val = essayRubricStats.q10.model;
                  else if (asp.aspect.includes('perhitungan')) val = essayRubricStats.q10.hitungan;
                  else if (asp.aspect.includes('Penalaran')) val = essayRubricStats.q10.penalaran;
                  else if (asp.aspect.includes('Kesimpulan')) val = essayRubricStats.q10.kesimpulan;

                  const pct = Math.round((val / asp.maxScore) * 100);
                  return (
                    <div key={asp.aspect} className="space-y-1">
                      <div className="flex justify-between text-slate-700">
                        <span>{asp.aspect}</span>
                        <span className="font-semibold">
                          {val} / {asp.maxScore} ({pct}%)
                        </span>
                      </div>
                      <div className="h-2 w-full bg-slate-200/70 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-indigo-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
