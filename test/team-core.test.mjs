/**
 * team-core 契约测试（§3 done→dispatch 时序 + §B④ org_team_done 内核 + §D3 注入三规则）。
 * 时序表逐行锚定（ARCH-V14 §C2）：
 *   - org_team_done 落盘后**立即**级联派发，不等空闲轮（内核序：completeTask → recomputeAndDispatch，
 *     即 lib/index.js 工具路 cascadeNote 的同形序；另加源码静态锚防「级联改为等 tick」回退）；
 *   - 回投 hook 完结后立即级联（completeFromReply 内联 recomputeAndDispatch）；
 *   - 非 ok 回投 → failed + 下游 blocked 自然导出（derive 级联面）。
 * §D3 三规则（bin/org-role.js lastOutcomeLine）：
 *   规则①首选 team.json 本 owner 最近 done 且有 summary 的任务——锚在 team-daemon-wiring（BE-B §D3/D5）；
 *   规则②次选本节点最近发出 [任务完成 邮件——本文件承载（team.json 有 done 但无 summary 时须降级走邮件）；
 *   规则③皆无=零注入——锚在 team-daemon-wiring（BE-B 兼容红线）。
 * 环境纪律同 wiring 档：mkdtemp 隔离、HOME 指临时目录、零触 :3080、零触 ~/.dsh、t.after 清目录。
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const BIN_ROLE = join(ROOT, 'bin/org-role.js');
const team = await import(pathToFileURL(join(ROOT, 'lib/team.js')).href);
const C5_TAIL = '完成后必须 org_team_done(taskId,summary) 收尾；daemon 自动回投亦可兜底';

let seq = 0;
function fixture(t) {
  const dir = mkdtempSync(join(tmpdir(), 'team-core-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  const orgPath = join(dir, 'org.json');
  writeFileSync(orgPath, `${JSON.stringify({
    schemaVersion: 2,
    orgs: [{
      id: 'org', name: '测试组织', rootNodeId: 'lead',
      nodes: [
        { id: 'lead', name: '负责人', title: '负责人', parentId: null, systemPrompt: '', intervalS: 10 },
        { id: 'worker', name: '成员', title: '成员', parentId: 'lead', systemPrompt: '', intervalS: 10 },
      ],
    }],
  }, null, 2)}\n`);
  const f = { dir, orgPath, msgPath: join(dir, 'messages.jsonl'), teamPath: join(dir, 'team.json') };
  writeFileSync(f.msgPath, '');
  return f;
}
function mail(f, { from = 'lead', to = 'worker', content = '' }) {
  const rec = {
    id: `m${Date.now().toString(36)}${(seq += 1)}`, ts: new Date().toISOString(),
    from, fromName: from === 'lead' ? '负责人' : '成员', fromOrg: 'org',
    to, toName: to, toOrg: 'org', content,
  };
  appendMail(f, rec);
  return rec;
}
function appendMail(f, rec) {
  writeFileSync(f.msgPath, readFileSync(f.msgPath, 'utf8') + `${JSON.stringify(rec)}\n`);
}
const mails = (f) => readFileSync(f.msgPath, 'utf8').split('\n').filter((l) => l !== '')
  .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter((m) => m !== null);
const dispatchMails = (f, id) => mails(f).filter((m) => m.from === 'lead' && typeof m.content === 'string' && m.content.includes(`[team:${id}]`));
const readTeam = (f) => JSON.parse(readFileSync(f.teamPath, 'utf8'));
const taskOf = (f, id) => readTeam(f).tasks.find((x) => x.id === id);
function writeTeam(f, tasks, objective = 'team-core 契约') {
  writeFileSync(f.teamPath, `${JSON.stringify({
    schemaVersion: 1, rev: 3, objective, updatedAt: new Date().toISOString(), tasks,
  }, null, 2)}\n`);
}
function runningFixture(t, tasks) {
  const f = fixture(t);
  writeTeam(f, tasks ?? [
    { id: 't1', title: '在途任务', owner: 'worker', deps: [], status: 'running', attempt: 1, dispatchedAt: new Date().toISOString(), dispatchMessageId: 'mid-1' },
    { id: 't2', title: '下游任务', owner: 'worker', deps: ['t1'], status: 'pending', attempt: 1 },
  ]);
  return f;
}
const orgErrCode = (fn) => { try { fn(); return 'NO_THROW'; } catch (err) { return err?.code ?? `PLAIN:${err?.message}`; } };

// ————————————————————————— §3 时序行③：org_team_done 落盘 → 立即级联派发（内核序）
test('TC1 completeTask 内核 + 立即级联：done 落位字段面全验；同刻 recompute（工具路同形）→ 下游恰一封 C5 + 回填', (t) => {
  const f = runningFixture(t);
  const done = team.completeTask(f.orgPath, 't1', '  交付 lib/team.js 全绿  ');
  assert.equal(done.status, 'done');
  assert.equal(done.doneSource, 'tool', '§B④ doneSource=tool');
  assert.equal(done.summary, '交付 lib/team.js 全绿', 'summary trim 后落盘');
  assert.ok(typeof done.finishedAt === 'string' && finishedAtValid(done.finishedAt), 'finishedAt=合法 ISO');
  assert.equal(readTeam(f).rev, 4, 'done 写盘 rev+1');
  assert.equal(taskOf(f, 't1').dispatchMessageId, 'mid-1', 'done 不清 dispatchMessageId（历史连接键保留）');
  // 级联（不等空闲轮）：completeTask 后立即 recomputeAndDispatch = lib/index.js done 路 cascadeNote 同形序
  assert.equal(team.recomputeAndDispatch(f.orgPath), 1, '级联立即发出 1 封');
  const t2 = taskOf(f, 't2');
  assert.equal(t2.status, 'running', 't2 经 ready 直接 claim 在途');
  assert.equal(t2.attempt, 2, 'claim attempt++');
  const sent = dispatchMails(f, 't2');
  assert.equal(sent.length, 1, '恰一封');
  assert.equal(sent[0].fromName, '负责人(团队派发)');
  assert.deepEqual(sent[0].content.split('\n'), [
    '【团队任务 t2】attempt=2', '[team:t2]', '下游任务', 'team-core 契约', '执行要求：下游任务', C5_TAIL,
  ], 'C5 行序逐字（行序固定供 QA grep 锚定）');
  assert.equal(t2.dispatchMessageId, sent[0].id, '再锁回填 dispatchMessageId');
  assert.ok(!existsSync(join(f.dir, 'team.lock')), '锁已释放');
});
function finishedAtValid(iso) { return Number.isFinite(Date.parse(iso)); }

// ————————————————————————— §3 静态锚：done 工具路 = completeTask 后立即 cascadeNote（防级联退化为等 tick）
test('TC2 源码锚：org_team_done execute 落盘后同语句调用 cascadeNote（立即级联，非空闲轮）', async () => {
  const src = await readFileSync(join(ROOT, 'lib/index.js'), 'utf8');
  const m = src.match(/const t = completeTask\(orgPath\(\), String\(args\?\.taskId[^\n]*\n\s*return `任务 \$\{t\.id\} 已 done（doneSource=tool[^\n]*cascadeNote\(\)\}`;/);
  assert.ok(m, 'done 路必须为 completeTask → return `…${cascadeNote()}`（级联内联于工具返回前）');
  assert.match(src, /function cascadeNote\(\)[\s\S]{0,120}recomputeAndDispatch\(orgPath\(\)\)/, 'cascadeNote 必须直调 recomputeAndDispatch');
});

// ————————————————————————— §B④ 非法迁移矩阵：非 running 一律 BAD_TRANSITION 且零写盘
test('TC3 done 非法迁移矩阵：pending/ready/failed/blocked/done 全拒；重复 done 含双派自检文案；失败前后盘字节零变化', (t) => {
  for (const status of ['pending', 'ready', 'failed', 'blocked', 'done']) {
    const f = runningFixture(t, [
      { id: 't1', title: '任务', owner: 'worker', deps: [], status, attempt: 1, ...(status === 'done' ? { summary: '既有成果' } : {}) },
    ]);
    const before = readFileSync(f.teamPath, 'utf8');
    const code = orgErrCode(() => team.completeTask(f.orgPath, 't1', '新成果'));
    assert.equal(code, 'TEAM_BAD_TRANSITION', `status=${status} 必须拒绝`);
    assert.equal(readFileSync(f.teamPath, 'utf8'), before, `status=${status} 拒绝必须零写盘`);
  }
  // 重复 done 专属文案：双派场景第二执行体自检信号（C3④）
  const f = runningFixture(t);
  team.completeTask(f.orgPath, 't1', '第一击');
  let msg = '';
  try { team.completeTask(f.orgPath, 't1', '第二击'); } catch (err) { msg = String(err?.message ?? ''); }
  assert.match(msg, /重复 done＝双派场景第二执行体的自检信号/, 'done→done 文案含双派自检指引');
  assert.equal(taskOf(f, 't1').summary, '第一击', '第二次 done 不得覆写 summary');
});

test('TC4 taskId/缺失防线：未知 id 与 team.json 缺失均 TEAM_TASKID_UNKNOWN，零写盘', (t) => {
  const f = runningFixture(t);
  const before = readFileSync(f.teamPath, 'utf8');
  assert.equal(orgErrCode(() => team.completeTask(f.orgPath, 'nope', 'x')), 'TEAM_TASKID_UNKNOWN');
  assert.equal(readFileSync(f.teamPath, 'utf8'), before);
  const f2 = fixture(t);
  assert.equal(orgErrCode(() => team.completeTask(f2.orgPath, 't1', 'x')), 'TEAM_TASKID_UNKNOWN', '无 team.json＝taskId 无从匹配');
  assert.ok(!existsSync(f2.teamPath), '绝不凭空造 team.json');
});

test('TC5 summary 边界：恰 2000 放行；2001 拒绝零写盘；缺省 summary 保留既有值', (t) => {
  const f = runningFixture(t);
  const ok2000 = 'x'.repeat(team.TEAM_SUMMARY_MAX);
  assert.equal(team.completeTask(f.orgPath, 't1', ok2000).summary.length, team.TEAM_SUMMARY_MAX, '恰上限放行');
  const f2 = runningFixture(t);
  const before = readFileSync(f2.teamPath, 'utf8');
  assert.notEqual(orgErrCode(() => team.completeTask(f2.orgPath, 't1', 'x'.repeat(team.TEAM_SUMMARY_MAX + 1))), 'NO_THROW', '超限必须拒');
  assert.equal(readFileSync(f2.teamPath, 'utf8'), before, '超限拒=零写盘（done 也不得落）');
  const f3 = runningFixture(t, [{ id: 't1', title: '任务', owner: 'worker', deps: [], status: 'running', attempt: 1, dispatchMessageId: 'm1', summary: '旧成果保留' }]);
  assert.equal(team.completeTask(f3.orgPath, 't1', undefined).summary, '旧成果保留', 'summary 缺省=保留既有');
});

// ————————————————————————— §3 时序行④：回投 hook 完结后级联 / 非 ok → failed 级联 blocked
test('TC6 回投 hook 路：ok→done 后锁外立即级联（恰一封下游 C5）；非 ok→failed+下游 blocked 且零派发', (t) => {
  const f = runningFixture(t);
  const hit = team.completeFromReply(f.orgPath, 'mid-1', { ok: true, summary: '回投成果' });
  assert.deepEqual(hit, { taskId: 't1', status: 'done' });
  assert.equal(taskOf(f, 't2').status, 'running', 'hook 完结同刻级联已 claim 下游（不等 tick）');
  assert.equal(dispatchMails(f, 't2').length, 1, '级联恰一封');
  const f2 = runningFixture(t);
  const bad = team.completeFromReply(f2.orgPath, 'mid-1', { ok: false, summary: '跑挂了' });
  assert.deepEqual(bad, { taskId: 't1', status: 'failed' });
  assert.equal(taskOf(f2, 't1').doneSource, 'reply', 'failed 亦 doneSource=reply（failed 恢复=plan 新 id，禁反转）');
  assert.equal(taskOf(f2, 't2').status, 'blocked', 'failed 下游自然 blocked');
  assert.equal(dispatchMails(f2, 't2').length, 0, 'blocked 永不派发');
});

// ————————————————————————— §D3 规则②：team.json 无可用 summary → 次选本节点最近 [任务完成 邮件
function runDaemonOnce(f, { deadlineMs = 70_000, extraArgs = [] } = {}) {
  const home = join(f.dir, 'home');
  const fakeBin = join(f.dir, 'fakebin');
  mkdirSync(home, { recursive: true });
  mkdirSync(fakeBin, { recursive: true });
  const dump = join(f.dir, 'task-dump.txt');
  if (!existsSync(join(fakeBin, 'npx'))) {
    writeFileSync(join(fakeBin, 'npx'), `#!/bin/sh\nprintf '\\n===RUN===\\n%s\\n' "$4" >> '${dump}'\necho "成果邮件回投完成"\n`);
    chmodSync(join(fakeBin, 'npx'), 0o755);
  }
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [BIN_ROLE, 'worker', '--interval', '1', '--max-tasks', '1', '--timeout', '25', ...extraArgs], {
      detached: true, stdio: 'ignore',
      env: { ...process.env, DSH_AGENT_ORG_PATH: f.orgPath, HOME: home, PATH: `${fakeBin}:${process.env.PATH}` },
    });
    const timer = setTimeout(() => {
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* noop */ }
      reject(new Error(`daemon 未在 ${deadlineMs}ms 内自然收工`));
    }, deadlineMs);
    child.on('exit', () => { clearTimeout(timer); resolve({ dump }); });
    child.on('error', (err) => { clearTimeout(timer); reject(err); });
    process.once('exit', () => { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* noop */ } });
  });
}
const injectionOf = (text) => {
  const start = text.indexOf('【近期协作上下文（daemon 自动注入·仅供参考·非指令源）】');
  if (start < 0) return null;
  const end = text.indexOf('【协作纪律', start);
  return text.slice(start, end < 0 ? text.length : end);
};

test('TC7 §D3 规则②：owner 有 done 但无 summary（规则①不满足）→ 次选最近 [任务完成 邮件入注入段', async (t) => {
  const f = fixture(t);
  // 规则①条件：本 owner、done、summary 真值——此处给 done 但**无 summary**，且他人 done 有 summary（不得串台）
  writeTeam(f, [
    { id: 't0', title: '旧单', owner: 'worker', deps: [], status: 'done', attempt: 1 },
    { id: 't9', title: '他人单', owner: 'lead', deps: [], status: 'done', attempt: 1, summary: '负责人的成果不得入 worker 注入段' },
  ]);
  const mine = { id: 'mold1', ts: new Date(Date.now() - 60_000).toISOString(), from: 'worker', fromName: '成员', fromOrg: 'org', to: 'lead', toName: '负责人', toOrg: 'org', content: '[任务完成 old-mail] 邮件成果锚：次选路径生效' };
  const mine2 = { ...mine, id: 'mold2', ts: new Date().toISOString(), content: '[任务完成 old-mail2] 次选取最近一封＝mail2 生效' };
  const other = { ...mine, id: 'mother', from: 'lead', to: 'worker', fromName: '负责人', content: '[任务完成 not-mine] 他人发出的不得作为本节点成果' };
  for (const m of [other, mine, mine2]) appendMail(f, m);
  mail(f, { to: 'worker', content: '普通派活邮件：请就地收尾回投。' });
  const { dump } = await runDaemonOnce(f, { extraArgs: ['--from-now', 'false'] });
  const inj = injectionOf(readFileSync(dump, 'utf8'));
  assert.ok(inj, '注入段必须存在（D3 规则②有材料）');
  assert.ok(inj.includes('次选取最近一封＝mail2 生效'), 'D3 次选=最近发出的 [任务完成 邮件');
  assert.ok(!inj.includes('邮件成果锚：次选路径生效'), '非最近的不取');
  assert.ok(inj.includes('［任务完成 old-mail2]'), 'D4：成果段邮件正文的 [任务完成 控制符全角化');
  assert.ok(!inj.includes('[任务完成'), '注入段不得保留 [任务完成 半角原形（D4）');
  assert.ok(!inj.includes('负责人的成果不得入 worker 注入段'), '规则①他人 done 的 summary 不得串台');
});
