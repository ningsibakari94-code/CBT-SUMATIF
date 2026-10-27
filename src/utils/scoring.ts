import {
  ANSWER_KEYS_DATA,
  EXAM_METADATA,
  QUESTIONS_DATA,
} from '../data/examData';
import {
  EssayRubricScore,
  ExamSessionScores,
  StudentAnswer,
} from '../types/cbt';

/**
 * Normalizes an algebraic expression for comparison
 */
function normalizeMathExpression(expr: string): string {
  return expr
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/\*/g, '')
    .replace(/,/g, '.')
    .trim();
}

/**
 * Evaluates Question 1 & 2 (Pilihan Ganda)
 */
export function scorePilihanGanda(
  questionId: number,
  answer?: StudentAnswer
): { score: number; isCorrect: boolean } {
  const key = ANSWER_KEYS_DATA[questionId];
  if (!key || !answer?.singleChoice) {
    return { score: 0, isCorrect: false };
  }
  const isCorrect = answer.singleChoice === key.correctChoice;
  return {
    score: isCorrect ? 1 : 0,
    isCorrect,
  };
}

/**
 * Evaluates Question 3 & 4 (PGK) according to exact scoring rules
 */
export function scorePGK(
  questionId: number,
  answer?: StudentAnswer
): { score: number; status: 'penuh' | 'parsial' | 'salah' | 'kosong' } {
  const key = ANSWER_KEYS_DATA[questionId];
  const chosen = (answer?.multiChoices || []).sort();
  if (chosen.length === 0) return { score: 0, status: 'kosong' };

  if (questionId === 3) {
    // Kunci: B, C, D (Salah: A, E)
    // 2 poin jika tepat B, C, D
    // 1 poin jika memilih dua dari tiga jawaban benar tanpa memilih salah
    // 0 poin selain itu
    const hasWrong = chosen.includes('A') || chosen.includes('E');
    const correctChosen = chosen.filter((c) => ['B', 'C', 'D'].includes(c));

    if (!hasWrong && correctChosen.length === 3 && chosen.length === 3) {
      return { score: 2, status: 'penuh' };
    }
    if (!hasWrong && correctChosen.length === 2 && chosen.length === 2) {
      return { score: 1, status: 'parsial' };
    }
    return { score: 0, status: 'salah' };
  }

  if (questionId === 4) {
    // Kunci: A, B, C, D (Salah: E)
    // 2 poin jika tepat A, B, C, D
    // 1 poin jika memilih tiga jawaban benar tanpa memilih E
    // 0 poin selain itu
    const hasWrong = chosen.includes('E');
    const correctChosen = chosen.filter((c) =>
      ['A', 'B', 'C', 'D'].includes(c)
    );

    if (!hasWrong && correctChosen.length === 4 && chosen.length === 4) {
      return { score: 2, status: 'penuh' };
    }
    if (!hasWrong && correctChosen.length === 3 && chosen.length === 3) {
      return { score: 1, status: 'parsial' };
    }
    return { score: 0, status: 'salah' };
  }

  return { score: 0, status: 'salah' };
}

/**
 * Evaluates Question 5 & 6 (Menjodohkan)
 * 1 point for each correctly matched pair
 */
export function scoreMenjodohkan(
  questionId: number,
  answer?: StudentAnswer
): { score: number; correctCount: number; detail: Record<string, boolean> } {
  const key = ANSWER_KEYS_DATA[questionId];
  const correctPairs = key?.correctPairs || {};
  const studentPairs = answer?.matchedPairs || {};

  let score = 0;
  const detail: Record<string, boolean> = {};

  for (const [colIId, correctColII] of Object.entries(correctPairs)) {
    const studentChoice = studentPairs[colIId];
    if (studentChoice && studentChoice === correctColII) {
      score += 1;
      detail[colIId] = true;
    } else {
      detail[colIId] = false;
    }
  }

  return {
    score,
    correctCount: score,
    detail,
  };
}

/**
 * Evaluates Question 7 & 8 (Isian Singkat)
 */
export function scoreIsianSingkat(
  questionId: number,
  answer?: StudentAnswer
): { score: number; feedback: string } {
  const text = (answer?.shortAnswer || '').trim();
  if (!text) {
    return { score: 0, feedback: 'Kosong / Belum dijawab' };
  }

  if (questionId === 7) {
    // Kunci: g(x) = 2x + 5
    const norm = normalizeMathExpression(text);
    if (
      norm === 'g(x)=2x+5' ||
      norm === '2x+5' ||
      norm === '5+2x' ||
      norm === 'g(x)=5+2x' ||
      norm === 'y=2x+5'
    ) {
      return { score: 2, feedback: 'Jawaban tepat sempurna (2 poin)' };
    }
    // Partial: includes 2x and 5 or minor algebraic slip
    if (
      norm.includes('2x') ||
      norm.includes('2u+5') ||
      norm.includes('(4x+11-3)/2') ||
      norm.includes('2x+3')
    ) {
      return {
        score: 1,
        feedback:
          'Sebagian benar atau terdapat kesalahan aljabar kecil (1 poin)',
      };
    }
    return { score: 0, feedback: 'Jawaban belum tepat (0 poin)' };
  }

  if (questionId === 8) {
    // Kunci: t ≈ 8,31 (toleransi ±0,01: 8.30 - 8.32)
    // Parse numeric value from text (replacing comma with dot)
    const cleaned = text.replace(/,/g, '.').replace(/[^\d.-]/g, '');
    const num = parseFloat(cleaned);

    if (!isNaN(num)) {
      if (num >= 8.3 && num <= 8.32) {
        return {
          score: 2,
          feedback:
            'Tepat dalam rentang toleransi 8,30 – 8,32 periode (2 poin)',
        };
      }
      if (num === 8 || num === 9 || num === 8.3) {
        return {
          score: 1,
          feedback: 'Mendekati pembulatan bilangan bulat/periode (1 poin)',
        };
      }
    }

    return { score: 0, feedback: 'Tidak memenuhi toleransi (0 poin)' };
  }

  return { score: 0, feedback: 'Belum dinilai' };
}

/**
 * Computes entire exam scores including objective and subjective (essay) components
 */
export function calculateExamScores(
  answers: Record<number, StudentAnswer>,
  existingEssayRubrics?: Record<number, EssayRubricScore>
): ExamSessionScores {
  const perQuestion: Record<number, number> = {};
  let objectiveScore = 0;

  // 1. Soal 1 (PG)
  const q1 = scorePilihanGanda(1, answers[1]);
  perQuestion[1] = q1.score;
  objectiveScore += q1.score;

  // 2. Soal 2 (PG)
  const q2 = scorePilihanGanda(2, answers[2]);
  perQuestion[2] = q2.score;
  objectiveScore += q2.score;

  // 3. Soal 3 (PGK)
  const q3 = scorePGK(3, answers[3]);
  perQuestion[3] = q3.score;
  objectiveScore += q3.score;

  // 4. Soal 4 (PGK)
  const q4 = scorePGK(4, answers[4]);
  perQuestion[4] = q4.score;
  objectiveScore += q4.score;

  // 5. Soal 5 (Menjodohkan)
  const q5 = scoreMenjodohkan(5, answers[5]);
  perQuestion[5] = q5.score;
  objectiveScore += q5.score;

  // 6. Soal 6 (Menjodohkan)
  const q6 = scoreMenjodohkan(6, answers[6]);
  perQuestion[6] = q6.score;
  objectiveScore += q6.score;

  // 7. Soal 7 (Isian Singkat)
  const q7 = scoreIsianSingkat(7, answers[7]);
  perQuestion[7] = q7.score;
  objectiveScore += q7.score;

  // 8. Soal 8 (Isian Singkat)
  const q8 = scoreIsianSingkat(8, answers[8]);
  perQuestion[8] = q8.score;
  objectiveScore += q8.score;

  // 9 & 10. Uraian
  const essayRubrics: Record<number, EssayRubricScore> = existingEssayRubrics || {
    9: { identifikasi: 0, model: 0, hitungan: 0, penalaran: 0, kesimpulan: 0 },
    10: { identifikasi: 0, model: 0, hitungan: 0, penalaran: 0, kesimpulan: 0 },
  };

  const scoreEssay9 =
    (essayRubrics[9]?.identifikasi || 0) +
    (essayRubrics[9]?.model || 0) +
    (essayRubrics[9]?.hitungan || 0) +
    (essayRubrics[9]?.penalaran || 0) +
    (essayRubrics[9]?.kesimpulan || 0);

  const scoreEssay10 =
    (essayRubrics[10]?.identifikasi || 0) +
    (essayRubrics[10]?.model || 0) +
    (essayRubrics[10]?.hitungan || 0) +
    (essayRubrics[10]?.penalaran || 0) +
    (essayRubrics[10]?.kesimpulan || 0);

  perQuestion[9] = scoreEssay9;
  perQuestion[10] = scoreEssay10;

  const essayScore = scoreEssay9 + scoreEssay10;
  const totalScore = objectiveScore + essayScore;

  // Formula: Nilai akhir = (skor perolehan ÷ 38) × 100
  const finalScore100 = Number(
    ((totalScore / EXAM_METADATA.maxTotalScore) * 100).toFixed(1)
  );

  // Check if teacher has reviewed both essays (or if student left them blank and 0 was explicitly validated)
  const isFullyGraded = Boolean(
    existingEssayRubrics &&
      existingEssayRubrics[9] !== undefined &&
      existingEssayRubrics[10] !== undefined
  );

  return {
    perQuestion,
    essayRubrics,
    objectiveScore,
    essayScore,
    totalScore,
    finalScore100,
    isFullyGraded,
  };
}
