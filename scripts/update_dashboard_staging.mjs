import fs from 'fs';

let content = fs.readFileSync('src/components/teacher/TeacherDashboard.tsx', 'utf8');

// 1. Update imports
if (!content.includes('isStagingMode')) {
  content = content.replace(
    "import { mergeSessionLists } from '../../utils/storage';",
    "import { mergeSessionLists } from '../../utils/storage';\nimport { isStagingMode, setStagingMode, getCachedTeacherOperator, setCachedTeacherOperator } from '../../utils/api';"
  );
}

if (!content.includes('Cloud,')) {
  content = content.replace(
    "  FileText,\n} from 'lucide-react';",
    "  FileText,\n  Cloud,\n} from 'lucide-react';"
  );
}

// 2. Add state
const stagingStateBlock = `
  // Staging Mode & Operator Identity State
  const [isStaging, setIsStaging] = useState(isStagingMode());
  const [teacherOperator, setTeacherOperator] = useState(getCachedTeacherOperator());

  const handleToggleStagingMode = () => {
    const nextMode = !isStaging;
    setStagingMode(nextMode);
    setIsStaging(nextMode);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (nextMode) {
        url.searchParams.set('mode', 'staging');
      } else {
        url.searchParams.delete('mode');
      }
      window.history.replaceState({}, '', url.toString());
    }
    onRefreshSessions();
    fetchAccessControl();
  };

  const handleOperatorChange = (newOp: string) => {
    setTeacherOperator(newOp);
    setCachedTeacherOperator(newOp);
  };
`;

if (!content.includes('// Staging Mode & Operator Identity State')) {
  content = content.replace(
    '  // Settings form state',
    stagingStateBlock + '\n  // Settings form state'
  );
}

// 3. Inject Mode Switcher Banner and Header Badge
const headerStagingBar = `
        {/* Environment Staging Alert Banner (If in Staging Mode) */}
        {isStaging && (
          <div className="bg-emerald-600 text-white px-4 py-2 text-xs flex flex-wrap items-center justify-between gap-3 shadow-inner">
            <div className="flex items-center gap-2 font-medium">
              <Cloud className="w-4 h-4 animate-pulse shrink-0" />
              <span>
                <strong>MODE STAGING CLOUD FIRESTORE AKTIF:</strong> Data tersinkronisasi ke Google Cloud Firestore (namespace: <code>exams/test_staging_mat_xi_2026/</code>). Data operasional asli Ning & Lisa di cbt_database.json aman terlindungi.
              </span>
            </div>
            <button
              type="button"
              onClick={handleToggleStagingMode}
              className="px-2.5 py-1 rounded bg-white text-emerald-800 font-bold hover:bg-emerald-50 transition-colors cursor-pointer shrink-0"
            >
              Kembali ke Mode Operasional (Lokal)
            </button>
          </div>
        )}
`;

if (!content.includes('MODE STAGING CLOUD FIRESTORE AKTIF')) {
  content = content.replace('<header className="bg-white border-b border-purple-100 shadow-2xs sticky top-0 z-30">', '<header className="bg-white border-b border-purple-100 shadow-2xs sticky top-0 z-30">\n' + headerStagingBar);
}

// 4. Inject Staging Toggle & Operator input in Top Bar
const modeControls = `
            {/* Mode & Operator Identity Badges */}
            <div className="hidden lg:flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs bg-slate-50 border-slate-200">
                <span className="text-slate-500 font-medium">Identitas Guru:</span>
                <input
                  type="text"
                  value={teacherOperator}
                  onChange={(e) => handleOperatorChange(e.target.value)}
                  placeholder="Nama Guru Pengawas"
                  className="font-bold text-slate-800 bg-transparent border-none focus:outline-hidden max-w-[140px]"
                  title="Identitas independen guru yang tercatat pada audit log Firestore"
                />
              </div>

              <button
                type="button"
                onClick={handleToggleStagingMode}
                className={\`flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold border transition-colors cursor-pointer \${
                  isStaging
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800 hover:bg-emerald-100'
                    : 'bg-purple-50 border-purple-200 text-purple-800 hover:bg-purple-100'
                }\`}
                title="Beralih antara Mode Operasional (Lokal) dan Mode Staging (Cloud Firestore)"
              >
                <Cloud className="w-3.5 h-3.5" />
                <span>{isStaging ? 'Staging (Firestore)' : 'Operasional (Lokal)'}</span>
              </button>
            </div>
`;

if (!content.includes('Identitas independen guru yang tercatat')) {
  content = content.replace('{/* Quick Stats & Return Button */}\n            <div className="flex items-center gap-2 sm:gap-3">', '{/* Quick Stats & Return Button */}\n            <div className="flex items-center gap-2 sm:gap-3">\n' + modeControls);
}

fs.writeFileSync('src/components/teacher/TeacherDashboard.tsx', content, 'utf8');
console.log('TeacherDashboard.tsx updated with staging switcher and operator identity');
