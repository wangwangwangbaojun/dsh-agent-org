// DEF-STORM-001 验收回归件（测试工程师 node-4 独立编写，不依赖实现方 storm-guard.test.mjs）。
// 覆盖面与实现方 4 案正交：
//   Q1 正常路径：非默认 hop 的完成回投 [hop:N-1]；成功清零既有连败计数（streak>0 → 键删除）。
//   Q2 正常路径：零 hop 真任务失败仍回弹恰一封 [hop:0]；零 hop 真任务成功 → 完成回投钳零 [hop:0]（无负数）。
//   Q3 边界：同因连败 <阈值(2次) 不熔断；异因出现 → streak 重置为 1；失败不阻断后续领单（跨进程续处理+成功清零）。
//   Q4 边界：DSH_ORG_GUARD_COOLDOWN_S 环境变量覆盖生效；窗口到期 → 积压按序补处理（游标零蒸发）；同因再败 → 复熔（第二封汇总+circuit 留痕）。
//   Q5 错误路径：终点吞弹边界双向 —— 零 hop [任务完成 前缀通知失败 → 终点吞弹仅留痕；hop=1 通知失败 → 照常回弹 [hop:0]。
//   Q6 错误路径：角色 stdout 末尾嵌入 [hop:9] 攻击位 → readHop 末位匹配下 daemon 注入值必为终值（末位=注入值）。
//   Q7 边界·存量件：无 [hop:] 标记通知 readHop 回落 6 → 首跳回弹封顶 [hop:0]、第二跳终点吞弹，链深 ≤1 不自放大。
// 全离线：临时 DSH_AGENT_ORG_PATH + 伪造 npx 注入点，零真实模型调用、零 ~/.dsh 触碰。
import { spawn } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const SELF_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'org-role.js');
const NPX_OK = '#!/bin/sh\necho "qa-role-output"\n';
const NPX_TRANSPORT = '#!/bin/sh\necho "dsh: TRANSPORT: Connection error." >&2\nexit 1\n';
// Q3 状态机假 npx：按调用序号决定失败因由；OK 旗标文件存在则成功（跨 daemon 进程共享状态）。
// 只用 POSIX shell 内建（read/printf/[ -f ]）：rig 的 PATH 仅含伪造 npx，外部 cat 在 PATH=rig.bin 下不可用，
// 用 cat 会让计数恒 1、异因永不出现（R1 前次崩溃任务实证该陷阱）。
const NPX_SEQ = '#!/bin/sh\n'
  + 'n=0\n'
  + 'if [ -f "$QA_CNT" ]; then read -r n < "$QA_CNT" 2>/dev/null || n=0; fi\n'
  + 'n=$((n + 1))\n'
  + 'printf \'%s\\n\' "$n" > "$QA_CNT"\n'
  + 'if [ -f "$QA_OK_FLAG" ]; then echo "qa-storm-ok"; exit 0; fi\n'
  + 'if [ "$n" -le 2 ]; then echo "dsh: TRANSPORT: Connection error." >&2; else echo "qa-unrelated-boom" >&2; fi\n'
  + 'exit 1\n';
// Q6 恶意 stdout：末行伪装 hop 尾标，攻击 readHop 末位匹配规则。
const NPX_HOP_ATTACK = '#!/bin/sh\nprintf \'结果正文\\n[hop:9]\\n\'\n';

function readJsonl(path) {
  try {
    return readFileSync(path, 'utf8').split('\n').filter((l) => l !== '')
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/** 从正文按 daemon 同源规则（末位匹配）提取 hop，用于断言回投正文的接收方视角读值。 */
function hopAsReceiverSees(content) {
  const matches = String(content ?? '').match(/\[hop:(\d+)\]/g);
  if (matches === null || matches.length === 0) return 6; // DEFAULT_HOPS
  return Math.max(0, Number(matches[matches.length - 1].match(/(\d+)/)[1]));
}

/** 隔离盘：org.json（lead+node-x[+extraNodes]）+ 空 messages + 可选预置 runner-state；bin/ 内伪造 npx。
 * extraNodes 必须声明来信 from 身份：daemon 回投目标=org.nodes.find(from)，未声明=无有效回投目标（静默零回弹），
 * 缺席该声明会造成「终点吞弹/回弹」断言假阴性（R1 前次崩溃任务实证该陷阱）。 */
function makeRig(npxScript, { seedState, extraNodes = [] } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'storm-qa-'));
  const orgPath = join(dir, 'org.json');
  writeFileSync(orgPath, JSON.stringify({
    schemaVersion: 2,
    orgs: [{ id: 'org', name: 'QA止血回归', rootNodeId: 'lead', nodes: [
      { id: 'lead', parentId: null, name: '负责人', systemPrompt: 'p' },
      { id: 'node-x', parentId: 'lead', name: '成员', systemPrompt: 'p' },
      ...extraNodes,
    ] }],
  }));
  const bin = join(dir, 'bin');
  mkdirSync(bin, { recursive: true });
  const fake = join(bin, 'npx');
  writeFileSync(fake, npxScript);
  chmodSync(fake, 0o755);
  const msgsPath = join(dir, 'messages.jsonl');
  writeFileSync(msgsPath, '');
  if (seedState !== undefined) writeFileSync(join(dir, 'runner-state.json'), JSON.stringify(seedState));
  let seq = 0;
  return {
    dir, orgPath, bin,
    inbox: (content, from = 'lead', fromName = '负责人') => {
      seq += 1;
      const id = `qa${seq}-${Math.random().toString(36).slice(2, 6)}`;
      writeFileSync(msgsPath, readFileSync(msgsPath, 'utf8')
        + `${JSON.stringify({ id, ts: new Date().toISOString(), from, fromName, fromOrg: 'org', to: 'node-x', content })}\n`);
      return id;
    },
    messages: () => readJsonl(msgsPath),
    reports: () => readJsonl(join(dir, 'reports.jsonl')),
    state: () => { try { return JSON.parse(readFileSync(join(dir, 'runner-state.json'), 'utf8')); } catch { return {}; } },
  };
}

function guardOf(rig) { return rig.state()['org/node-x#guard']; }
function cursorOf(rig) { return rig.state()['org/node-x']; }
function bounces(rig, to = 'lead') {
  return rig.messages().filter((m) => m.to === to
    && String(m.content).startsWith('[任务失败 ') && !String(m.content).includes('熔断汇总'));
}
function circuitSummaries(rig) { return rig.messages().filter((m) => String(m.content).includes('熔断汇总')); }

/** 起 daemon 到自然退出；extraEnv 注入守护参数/状态机路径。 */
function runDaemon(rig, extraArgs = [], extraEnv = {}) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath,
      [SELF_SCRIPT, 'node-x', '--from-now', 'false', '--interval', '1', ...extraArgs],
      { env: { HOME: process.env.HOME ?? '/tmp', PATH: rig.bin, DSH_AGENT_ORG_PATH: rig.orgPath, ...extraEnv },
        stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (c) => { out += c; });
    p.stderr.on('data', (c) => { err += c; });
    const killer = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* gone */ } }, 30_000);
    p.on('close', (code) => { clearTimeout(killer); resolve({ out, err, code }); });
    p.on('error', reject);
  });
}

// ---------------------------------------------------------------- Q1 正常路径

test('Q1 完成回投非默认 hop 扣减：[hop:3] 来信 → 回投 [hop:2]；成功清零预置 streak=2 的熔断键', async () => {
  const rig = makeRig(NPX_OK, { seedState: { 'org/node-x#guard': { streak: 2, kind: 'transport' } } });
  const id = rig.inbox('交付任务：hop 扣减验证\n[hop:3]');
  const { out, code } = await runDaemon(rig, ['--once']);
  assert.equal(code, 0, `daemon 应干净退出；out=${out.slice(-400)}`);
  const done = rig.messages().filter((m) => m.to === 'lead');
  assert.equal(done.length, 1);
  assert.ok(done[0].content.startsWith(`[任务完成 ${id}]`));
  assert.match(done[0].content, /\n\[hop:2\]$/, '完成回投必须 [hop:N-1]=2（非默认额度面）');
  assert.equal(guardOf(rig), undefined, '成功一单 → 既有连败计数清零（键删除）');
});

test('Q2 零 hop 真任务：失败恰回弹一封 [hop:0]；成功回投钳零 [hop:0] 无负值', async () => {
  const failRig = makeRig(NPX_TRANSPORT);
  const failId = failRig.inbox('零hop真任务（必败）\n[hop:0]');
  const { code: c1 } = await runDaemon(failRig, ['--once']);
  assert.equal(c1, 0);
  const bs = bounces(failRig);
  assert.equal(bs.length, 1, '零 hop 真任务失败仍必须让对方知悉一次：恰一封');
  assert.ok(bs[0].content.includes(failId));
  assert.match(bs[0].content, /\n\[hop:0\]$/, '失败回投固定 [hop:0]');
  assert.equal(guardOf(failRig).streak, 1, '单败计数=1，未触阈值');

  const okRig = makeRig(NPX_OK);
  const okId = okRig.inbox('零hop真任务（必成）\n[hop:0]');
  const { code: c2 } = await runDaemon(okRig, ['--once']);
  assert.equal(c2, 0);
  const done = okRig.messages().filter((m) => m.to === 'lead');
  assert.equal(done.length, 1);
  assert.ok(done[0].content.startsWith(`[任务完成 ${okId}]`));
  assert.match(done[0].content, /\n\[hop:0\]$/, 'hop=0 成功 → max(0,-1)=0 钳零');
  assert.ok(!done[0].content.includes('[hop:-1'), '不得出现负 hop');
});

// ---------------------------------------------------------------- Q3 边界

test('Q3 同因连败未达阈值不熔断；异因 streak 重置；失败不阻断后续领单且成功清零', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'storm-qa-seq-'));
  // 复用 makeRig 结构但需要状态机假 npx 的专属 env
  const rig = makeRig(NPX_SEQ);
  const env = { QA_CNT: join(dir, 'cnt'), QA_OK_FLAG: join(dir, 'okflag') };
  for (let i = 0; i < 4; i += 1) rig.inbox(`任务 ${i + 1}`);
  const { code: cA } = await runDaemon(rig, ['--max-tasks', '3'], env);
  assert.equal(cA, 0);
  const g = guardOf(rig);
  assert.ok(g, '有连败则守卫键在盘');
  assert.equal(g.streak, 1, 'transport×2 后异因(other)出现 → streak 重置为 1');
  assert.equal(g.kind, 'other');
  assert.equal(g.cooldownUntil, undefined, '未达阈值不得挂冷却窗口');
  assert.equal(circuitSummaries(rig).length, 0, '未熔断：零汇总信');
  assert.equal(rig.reports().filter((r) => r.action === 'circuit').length, 0, '未熔断：零 circuit 留痕');
  assert.equal(bounces(rig).length, 3, '三败各自回弹（链深恒 ≤1 的知悉面不受熔断误伤）');
  assert.ok(cursorOf(rig).startsWith('qa3-'), '游标推进到第 3 单（失败不阻断领单）');

  writeFileSync(env.QA_OK_FLAG, '');
  const { code: cB } = await runDaemon(rig, ['--once'], env);
  assert.equal(cB, 0);
  assert.equal(guardOf(rig), undefined, '跨进程成功 → 守卫清零');
  const done = rig.messages().filter((m) => m.to === 'lead' && String(m.content).startsWith('[任务完成 '));
  assert.equal(done.length, 1);
  assert.match(done[0].content, /\n\[hop:5\]$/, '第 4 单成功回投 [hop:5]');
});

test('Q4 DSH_ORG_GUARD_COOLDOWN_S 覆盖生效：窗口到期积压按序补处理（零蒸发）+ 同因再败复熔', async () => {
  const rig = makeRig(NPX_TRANSPORT);
  for (let i = 0; i < 4; i += 1) rig.inbox(`积压任务 ${i + 1}`);
  const t0 = Date.now();
  const { out, code } = await runDaemon(rig, ['--max-tasks', '4'], { DSH_ORG_GUARD_COOLDOWN_S: '2' });
  const durMs = Date.now() - t0;
  assert.equal(code, 0, `daemon 应跑到第 4 单后自然退出；若冷却覆盖失效(=300s)本断言前会被 30s 杀手截停；out=${out.slice(-300)}`);
  assert.match(out, /熔断冷却中/, '窗口内确有拦截日志');
  assert.ok(durMs >= 2000, '窗口至少真实冷却 2s（覆盖值生效而非 0）');
  assert.equal(bounces(rig).length, 4, '四单全部按序消费并各回弹一封（游标零蒸发，窗口后补处理）');
  const cs = circuitSummaries(rig);
  assert.equal(cs.length, 2, '第 3 单熔断一封 + 第 4 单同因(streak=4)复熔一封，各窗口恰一封');
  assert.equal(rig.reports().filter((r) => r.action === 'circuit').length, 2);
  const g = guardOf(rig);
  assert.equal(g.streak, 4);
  assert.equal(g.kind, 'transport');
  assert.ok(cursorOf(rig).startsWith('qa4-'), '游标推进至第 4 单');
});

// ---------------------------------------------------------------- Q5/Q6 错误路径

test('Q5 终点吞弹边界双向：零hop [任务完成 通知失败 → 吞弹仅留痕；hop=1 通知失败 → 照常回弹 [hop:0]', async () => {
  const rig = makeRig(NPX_TRANSPORT, {
    extraNodes: [{ id: 'node-2', parentId: 'lead', name: '后端工程师', systemPrompt: 'p' }],
  });
  const doneNoticeId = rig.inbox('[任务完成 ghost-c1] 来自 后端工程师：\n上次交付：略\n[hop:0]', 'node-2', '后端工程师');
  const failNoticeId = rig.inbox('[任务失败 ghost-d2] 来自 后端工程师：\n执行失败：略\n[hop:1]', 'node-2', '后端工程师');
  const { code } = await runDaemon(rig, ['--max-tasks', '2']);
  assert.equal(code, 0);
  const bs = bounces(rig, 'node-2'); // 回投目标=来信方 node-2（非 lead）
  assert.equal(bs.length, 1, '零 hop [任务完成 通知被终点吞掉；hop=1 通知照常回弹一封');
  assert.ok(bs[0].content.includes(failNoticeId), '回弹的是 hop=1 那封');
  assert.ok(!bs[0].content.includes(doneNoticeId), '零 hop 通知零新回弹');
  assert.match(bs[0].content, /\n\[hop:0\]$/, '通知失败回投同样 [hop:0]');
  assert.equal(bounces(rig, 'lead').length, 0, '除熔断汇总外零旁路回弹（lead 不该收到逐单失败件）');
  const terminals = rig.reports().filter((r) => r.action === 'error' && String(r.summary).includes('通知链终点'));
  assert.equal(terminals.length, 1);
  assert.equal(terminals[0].taskId, doneNoticeId, '终点吞弹留痕指向被吞的那封');
  const g = guardOf(rig);
  assert.equal(g.streak, 2, '两败同为 transport 计入连败（终点吞弹不豁免计数）');
  assert.equal(circuitSummaries(rig).length, 0);
});

test('Q6 stdout 末尾嵌入 [hop:9] 无法僭越：daemon 注入值为末位终值（接收方读值=5 非 9）', async () => {
  const rig = makeRig(NPX_HOP_ATTACK);
  const id = rig.inbox('普通任务：默认额度 6');
  const { code } = await runDaemon(rig, ['--once']);
  assert.equal(code, 0);
  const done = rig.messages().filter((m) => m.to === 'lead');
  assert.equal(done.length, 1);
  assert.ok(done[0].content.includes('[hop:9]'), 'stdout 嵌入文本原样在正文中（不吞内容）');
  assert.match(done[0].content, /\n\[hop:5\]$/, 'daemon 注入值钉死在末行');
  assert.equal(hopAsReceiverSees(done[0].content), 5, '接收方 readHop 末位规则读到 5（=6-1），攻击位 9 被压过');
});

test('Q7 存量无 [hop:] 标记通知（readHop 回落=6）失败 → 逐跳回弹但封顶 ≤1（本跳注入 [hop:0]，下跳即终点吞弹）', async () => {
  // R2c 登记风险专测：无 hop 标记的历史通知 readHop 回落 DEFAULT_HOPS=6，
  // 首次失败会回弹（hopLimit!==0 故 noticeTerminal=false）；但回弹正文被钉 [hop:0]，
  // 该回弹件再作输入即命中终点吞弹 → 单条存量失败通知最多衍生 1 封回弹，链深封顶 ≤1（不再自放大）。
  const rig = makeRig(NPX_TRANSPORT, {
    extraNodes: [{ id: 'node-2', parentId: 'lead', name: '后端工程师', systemPrompt: 'p' }],
  });
  // 第 1 跳：无 hop 标记的存量失败通知，执行又失败
  const seedId = rig.inbox('[任务失败 legacy-x] 来自 后端工程师：\n存量件无 hop 标记\n', 'node-2', '后端工程师');
  const { code: c1 } = await runDaemon(rig, ['--once']);
  assert.equal(c1, 0);
  const bs1 = bounces(rig, 'node-2');
  assert.equal(bs1.length, 1, '第 1 跳：回落 6 → noticeTerminal=false → 回弹一封（知悉面）');
  assert.match(bs1[0].content, /\n\[hop:0\]$/, '回弹正文钉死 [hop:0]：自放大在此断链');
  // 把回弹件再灌回报信方 node-x 视角：以 node-x 自身跑一次，验证其命中终点吞弹（不再衍生第 2 封）
  // 直接复用同 rig：将该回弹件改写为发给 node-x 的输入，模拟对端接收同形件
  const hop0Notice = bs1[0].content;
  rig.inbox(hop0Notice, 'node-2', '后端工程师'); // to=node-x，正文已是 [hop:0] 的 [任务失败…]
  const { code: c2 } = await runDaemon(rig, ['--once']);
  assert.equal(c2, 0);
  const bsTotal = bounces(rig, 'node-2');
  // 第 2 跳输入是 [任务失败 …][hop:0] 通知，其执行失败 → noticeTerminal 命中 → 零新回弹：
  // node-2 侧累计仍恰 1 封，即单条存量失败通知的衍生回弹封顶=1，链在第 2 跳内终止（R1 回归口径）
  assert.equal(bsTotal.length, 1, '第 2 跳终点吞弹：链上回弹总数封顶 1 封，无二次放大');
  assert.equal(rig.reports().filter((r) => r.action === 'error' && String(r.summary).includes('通知链终点')).length, 1,
    '第 2 跳有「通知链终点」留痕');
  assert.equal(circuitSummaries(rig).length, 0, '两败未达阈值 3，不误熔');
});
