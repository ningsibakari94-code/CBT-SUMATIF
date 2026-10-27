import fs from 'fs';

let content = fs.readFileSync('src/utils/api.ts', 'utf8');

// Replace const API_BASE = '/api'; with dynamic getter
if (!content.includes('export function isStagingMode()')) {
  const modeHelpers = `
// Mode Management (Operational vs Staging)
export function isStagingMode(): boolean {
  try {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('mode') === 'staging') return true;
      if (window.location.hash.includes('staging')) return true;
      if (sessionStorage.getItem('cbt_active_mode') === 'staging') return true;
    }
  } catch (_) {}
  return false;
}

export function setStagingMode(enabled: boolean) {
  try {
    if (enabled) {
      sessionStorage.setItem('cbt_active_mode', 'staging');
    } else {
      sessionStorage.removeItem('cbt_active_mode');
    }
  } catch (_) {}
}

export function getApiBase(): string {
  return isStagingMode() ? '/api/staging' : '/api';
}

// Teacher Operator Identity (For multi-teacher independent auditing)
let cachedTeacherOperator = 'Guru Pengawas';

export function setCachedTeacherOperator(operator: string) {
  cachedTeacherOperator = operator;
  try {
    sessionStorage.setItem('cbt_teacher_operator', operator);
  } catch (_) {}
}

export function getCachedTeacherOperator(): string {
  if (cachedTeacherOperator && cachedTeacherOperator !== 'Guru Pengawas') return cachedTeacherOperator;
  try {
    const stored = sessionStorage.getItem('cbt_teacher_operator');
    if (stored) {
      cachedTeacherOperator = stored;
      return stored;
    }
  } catch (_) {}
  return 'Guru Pengawas';
}
`;

  content = content.replace("const API_BASE = '/api';", modeHelpers);
}

// Replace all instances of `${API_BASE}` with `${getApiBase()}`
content = content.replaceAll('${API_BASE}', '${getApiBase()}');

// In apiGetAllSessions, apiLockApp, apiUnlockApp, apiUpdateSchedule, include 'x-teacher-operator': getCachedTeacherOperator()
content = content.replace(
  "'x-teacher-pin': pin,",
  "'x-teacher-pin': pin,\n      'x-teacher-operator': getCachedTeacherOperator(),"
);

fs.writeFileSync('src/utils/api.ts', content, 'utf8');
console.log('src/utils/api.ts updated with dynamic staging routing and operator tracking');
