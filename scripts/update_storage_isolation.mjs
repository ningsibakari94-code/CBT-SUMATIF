import fs from 'fs';

let content = fs.readFileSync('src/utils/storage.ts', 'utf8');

// Import isStagingMode
if (!content.includes('isStagingMode')) {
  content = content.replace(
    "import { calculateExamScores } from './scoring';",
    "import { calculateExamScores } from './scoring';\nimport { isStagingMode } from './api';"
  );
}

// Add dynamic cache key function
const keyFunction = `
export function getAllSessionsStorageKey(): string {
  return isStagingMode() ? 'cbt_staging_sessions_v1' : 'cbt_all_student_sessions_v1';
}
`;

if (!content.includes('getAllSessionsStorageKey')) {
  content = content.replace(
    "const STORAGE_KEYS = {",
    keyFunction + "\nconst STORAGE_KEYS = {"
  );
}

// Replace STORAGE_KEYS.ALL_SESSIONS in loadAllSessions and saveAllSessions
content = content.replace(
  "const raw = localStorage.getItem(STORAGE_KEYS.ALL_SESSIONS);",
  "const raw = localStorage.getItem(getAllSessionsStorageKey());"
);

content = content.replace(
  "localStorage.setItem(STORAGE_KEYS.ALL_SESSIONS, JSON.stringify(safe));",
  "localStorage.setItem(getAllSessionsStorageKey(), JSON.stringify(safe));"
);

fs.writeFileSync('src/utils/storage.ts', content, 'utf8');
console.log('src/utils/storage.ts updated with isolated storage keys for operational and staging');
