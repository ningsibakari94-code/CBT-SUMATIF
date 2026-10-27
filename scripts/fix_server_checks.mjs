import fs from 'fs';

let content = fs.readFileSync('server.ts', 'utf8');

const targetStart = "app.post('/api/sessions/start', (req: Request, res: Response) => {";
const replacementStart = `app.post('/api/sessions/start', (req: Request, res: Response) => {
  const access = evaluateServerAccess(dbCache.settings.accessControl);
  if (!access.isAllowed) {
    res.status(403).json({
      success: false,
      code: 'ACCESS_LOCKED',
      error: access.reason,
      serverTimeWita: access.serverTimeWita,
      windowStartWita: access.windowStartWita,
      windowEndWita: access.windowEndWita,
    });
    return;
  }`;

content = content.replace(targetStart, replacementStart);

const targetProgress = "app.put('/api/sessions/:id/progress', (req: Request, res: Response) => {";
const replacementProgress = `app.put('/api/sessions/:id/progress', (req: Request, res: Response) => {
  const access = evaluateServerAccess(dbCache.settings.accessControl);
  if (!access.isAllowed) {
    res.status(403).json({
      success: false,
      code: 'ACCESS_LOCKED',
      error: access.reason,
      serverTimeWita: access.serverTimeWita,
    });
    return;
  }`;

content = content.replace(targetProgress, replacementProgress);

fs.writeFileSync('server.ts', content, 'utf8');
console.log('server.ts updated with access enforcement in start and progress');
