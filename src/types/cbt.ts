export type QuestionType =
  | 'pilihan_ganda'
  | 'pgk'
  | 'menjodohkan'
  | 'isian_singkat'
  | 'uraian';

export type CognitiveLevel = 'L2 – Aplikasi' | 'L3 – Penalaran';

export interface OptionItem {
  key: string;
  text: string;
}

export interface MatchingItem {
  id: string;
  label: string;
  text: string;
}

export interface EssaySubQuestion {
  id: string;
  label: string;
  prompt: string;
}

export interface Question {
  id: number;
  number: number;
  type: QuestionType;
  title: string;
  stimulusTitle: string;
  stimulus: string;
  questionText: string;
  options?: OptionItem[];
  matchingData?: {
    columnI: MatchingItem[];
    columnII: MatchingItem[];
  };
  shortAnswerPlaceholder?: string;
  shortAnswerUnit?: string;
  essaySubQuestions?: EssaySubQuestion[];
  cognitiveLevel: CognitiveLevel;
  learningIndicator: string;
  questionIndicator: string;
  sourceContext: string;
  maxScore: number;
}

export interface QuestionAnswerKey {
  questionId: number;
  correctChoice?: string;
  correctChoices?: string[];
  correctPairs?: Record<string, string>;
  shortAnswerCanonical?: string;
  shortAnswerAcceptable?: string[];
  shortAnswerNumeric?: {
    value: number;
    tolerance: number;
  };
  explanation: string;
  scoringGuide: string;
}

export interface StudentAnswer {
  singleChoice?: string;
  multiChoices?: string[];
  matchedPairs?: Record<string, string>;
  shortAnswer?: string;
  essayText?: string;
  essayParts?: Record<string, string>;
}

export interface EssayRubricScore {
  identifikasi: number; // max 2
  model: number; // max 2
  hitungan: number; // max 3
  penalaran: number; // max 2
  kesimpulan: number; // max 1
  feedback?: string;
}

export interface TabViolation {
  timestamp: string;
  type: 'visibility_hidden' | 'window_blur';
  description: string;
}

export interface ExamSessionScores {
  perQuestion: Record<number, number>;
  essayRubrics: Record<number, EssayRubricScore>;
  objectiveScore: number;
  essayScore: number;
  totalScore: number;
  finalScore100: number;
  isFullyGraded: boolean;
}

export interface StudentExamSession {
  id: string;
  studentName: string;
  studentClass: string;
  participantNumber: string;
  examCode: string;
  startTime: string;
  finishTime?: string;
  durationSecondsUsed?: number;
  status: 'in-progress' | 'submitted' | 'auto-time' | 'auto-tab-violation';
  statusReason?: string;
  answers: Record<number, StudentAnswer>;
  reviewFlags: Record<number, boolean>;
  tabViolations: TabViolation[];
  scores: ExamSessionScores;
}

export type AccessStatus = 'open' | 'scheduled' | 'locked';

export interface AccessLogItem {
  timestamp: string;
  action: 'lock' | 'unlock' | 'schedule_update';
  operator: string;
  reason?: string;
  details?: string;
}

export interface AccessControlSchedule {
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  endDate: string;   // YYYY-MM-DD
  endTime: string;   // HH:mm
  timezone: string;  // e.g. 'Asia/Makassar'
  isScheduleEnabled: boolean;
}

export interface AppAccessControl {
  status: AccessStatus;
  lockReason: string;
  schedule: AccessControlSchedule;
  logs: AccessLogItem[];
}

export interface ExamSettings {
  durationMinutes: number;
  examCode: string;
  codeRequired: boolean;
  tabSwitchRule: 'instant' | 'warning-2' | 'warning-3' | 'disabled';
  kkmScore: number;
  preventRetake: boolean;
  accessControl?: AppAccessControl;
}

export interface RubricCriteriaAspect {
  aspect: string;
  criteria: string;
  maxScore: number;
}

