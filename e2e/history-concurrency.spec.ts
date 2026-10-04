import { test, expect } from '@playwright/test';
import ts from 'typescript';
import { readFile } from 'node:fs/promises';
// Exercise the actual persistence module with native IndexedDB in two same-origin tabs.
async function script() {
  const pure = await readFile('src/lib/play-history.ts', 'utf8');
  const storage = (await readFile('src/lib/history-store.ts', 'utf8')).replace(
    /^import[\s\S]*?from ['"]\.\/play-history['"];\n/,
    '',
  );
  return (
    '(() => {' +
    ts
      .transpileModule(
        pure +
          '\n' +
          storage +
          '\nObject.assign(window, {updateHistory, readHistory, addResult, resetSolo});',
        { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } },
      )
      .outputText.replace(/^export /gm, '') +
    '})();'
  );
}
test('native history transactions serialize tabs, migrate once and reset in order', async ({
  context,
}) => {
  const a = await context.newPage(),
    b = await context.newPage();
  await a.goto('/');
  await b.goto('/');
  const source = await script();
  await a.addScriptTag({ content: source });
  await b.addScriptTag({ content: source });
  const add = (id: string) => {
    const w = window as any;
    return w.updateHistory((h: any) =>
      w.addResult(h, {
        id,
        mode: 'single',
        opponent: '토끼',
        me: 0,
        result: { winner: 0, reason: 'STOP', points: 7, score: null, sidePoints: [0, 0] },
      }),
    );
  };
  await Promise.all([a.evaluate(add, 'a'), b.evaluate(add, 'b')]);
  const read = () => (window as any).readHistory();
  expect((await a.evaluate(read)).solo).toMatchObject({ wins: 2, points: 14 });
  await a.evaluate(() => (window as any).updateHistory((window as any).resetSolo));
  await b.evaluate(add, 'c');
  expect((await a.evaluate(read)).solo).toMatchObject({ wins: 1, points: 7 });
  // A stale legacy cache must never be imported a second time.
  await a.evaluate(() => localStorage.setItem('toki.play-history.v1', '{}'));
  expect((await b.evaluate(read)).solo.wins).toBe(1);
});
