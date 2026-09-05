// DEF-STORM-001（失败通知风暴止血）自测：通知链 hop 消耗、零 hop 通知终点、同因连败熔断与窗口拦截。
// 全离线：临时 DSH_AGENT_ORG_PATH + 伪造 npx（角色进程注入点），零真实模型调用。
import { spawn } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import assert from 'node:assert/strict';

const SELF_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'bin', 'org-role.js');
const NPX_OK = '#!/bin/sh\necho "storm-guard-role-output"\n';
const NPX_TRANSPORT = '#!/bin/sh\necho "dsh: TRANSPORT: Connection error." >&2\nexit 1\n';
const NO_PATH = '/nonexistent-storm-guard-path';

function readJsonl(path) {
  try {
    return readFileSync(path, 'utf8').split('\n').filter((l) => l !== '')
      .map((l) => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

/** 隔离盘：org.json（lead+node-x）+ 预置收件；bin/ 内伪造 npx。返回句柄与断言读取器。 */
function makeRig(npxScript) {
  const dir = mkdtempSync(join(tmpdir(), 'storm-guard-'));
  const orgPath = join(dir, 'org.json');
  writeFileSync(orgPath, JSON.stringify({
    schemaVersion: 2,
    orgs: [{ id: 'org', name: '止血测试', rootNodeId: 'lead', nodes: [
      { id: 'lead', parentId: null, name: '负责人', systemPrompt: 'p' },
      { id: 'node-x', parentId: 'lead', name: '成员', systemPrompt: 'p' },
    ] }],
  }));
  let path = NO_PATH;
  if (npxScript !== undefined) {
    const bin = join(dir, 'bin');
    mkdirSync(bin, { recursive: true });
    const fake = join(bin, 'npx');
    writeFileSync(fake, npxScript);
    chmodSync(fake, 0o755);
    path = bin;
  }
  const msgsPath = join(dir, 'messages.jsonl');
  writeFileSync(msgsPath, '');
  let seq = 0;
  return {
    dir, orgPath, path,
    inbox: (content) => {
      seq += 1;
      const id = `t${seq}-${Math.random().toString(36).slice(2, 6)}`;
      writeFileSync(msgsPath, readFileSync(msgsPath, 'utf8')
        + `${JSON.stringify({ id, ts: new Date().toISOString(), from: 'lead', fromName: '负责人', fromOrg: 'org', to: 'node-x', content })}\n`);
      return id;
    },
    messages: () => readJsonl(msgsPath),
    reports: () => readJsonl(join(dir, 'reports.jsonl')),
    state: () => { try { return JSON.parse(readFileSync(join(dir, 'runner-state.json'), 'utf8')); } catch { return {}; } },
    msgsRaw: () => { try { return readFileSync(msgsPath, 'utf8'); } catch { return ''; } },
  };
}

/** 起 daemon 跑到自然退出（--from-now false=追历史未读），返回 {out, code}。 */
function runDaemon(rig, extraArgs = []) {
  return new Promise((resolve, reject) => {
    const p = spawn(process.execPath,
      [SELF_SCRIPT, 'node-x', '--from-now', 'false', '--interval', '1', ...extraArgs],
      { env: { HOME: process.env.HOME ?? '/tmp', PATH: rig.path, DSH_AGENT_ORG_PATH: rig.orgPath }, stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (c) => { out += c; });
    p.stderr.on('data', (c) => { err += c; });
    const killer = setTimeout(() => { try { p.kill('SIGKILL'); } catch { /* gone */ } }, 30_000);
    p.on('close', (code) => { clearTimeout(killer); resolve({ out, err, code }); });
    p.on('error', reject);
  });
}

test('T1 失败回投固定 [hop:0] + 同因连败熔断：一封汇总、circuit 留痕、游标保留', async () => {
  const rig = makeRig(NPX_TRANSPORT); // 角色进程=TRANSPORT 断连形态（exit1 无 stdout）
  for (let i = 0; i < 4; i += 1) rig.inbox(`真实任务 ${i + 1}：做点事`);
  const { out, code } = await runDaemon(rig, ['--max-tasks', '3']);
  assert.equal(code, 0, `daemon 应干净退出；out=${out.slice(-400)}`);
  const bounces = rig.messages().filter((m) => m.to === 'lead'
    && String(m.content).startsWith('[任务失败 ') && !String(m.content).includes('熔断汇总'));
  assert.equal(bounces.length, 3, '三个失败任务各回投一封');
  for (const b of bounces) assert.match(b.content, /\n\[hop:0\]$/, '失败回投必须固定携带 [hop:0]');
  const trips = rig.messages().filter((m) => String(m.content).includes('熔断汇总'));
  assert.equal(trips.length, 1, '熔断汇总恰好一封（发给负责人）');
  assert.equal(trips[0].to, 'lead');
  assert.match(trips[0].content, /因由=transport/);
  const circuits = rig.reports().filter((r) => r.action === 'circuit');
  assert.equal(circuits.length, 1);
  assert.equal(circuits[0].ok, false);
  const guard = rig.state()['org/node-x#guard'];
  assert.equal(guard.streak, 3);
  assert.equal(guard.kind, 'transport');
  assert.ok(guard.cooldownUntil * 1000 > Date.now() - 5000, '冷却窗口已挂表');
  // 第 4 封积压未消费（游标保留在第 3 单）
  const cursor = rig.state()['org/node-x'];
  assert.ok(cursor && !cursor.startsWith('t4-'), '游标停在第 3 单，第 4 封积压在盘不蒸发');
});

test('T2 熔断窗口拦截新 daemon 进程：不 spawn、不消费、游标与邮件零变化', async () => {
  const rig = makeRig(NPX_TRANSPORT);
  for (let i = 0; i < 3; i += 1) rig.inbox(`任务 ${i + 1}`);
  await runDaemon(rig, ['--max-tasks', '3']); // 熔断开启（guard 持久化）
  const before = { msgs: rig.msgsRaw(), state: JSON.stringify(rig.state()) };
  const { out, code } = await runDaemon(rig, ['--once']);
  assert.equal(code, 0);
  assert.match(out, /熔断冷却中/);
  assert.equal(rig.msgsRaw(), before.msgs, '窗口内零新邮件');
  assert.equal(JSON.stringify(rig.state()), before.state, '窗口内游标/熔断键零变化');
});

test('T3 完成回投 hop 逐跳扣减：默认 6 → 回投携带 [hop:5]，且成功清零熔断键', async () => {
  const rig = makeRig(NPX_OK); // 伪造角色进程正常产出 stdout
  const id = rig.inbox('交付任务：跑通即赢');
  const { code } = await runDaemon(rig, ['--once']);
  assert.equal(code, 0);
  const done = rig.messages().filter((m) => m.to === 'lead');
  assert.equal(done.length, 1);
  assert.ok(done[0].content.startsWith(`[任务完成 ${id}]`));
  assert.match(done[0].content, /\n\[hop:5\]$/, '完成回投携带 [hop:N-1]');
  assert.equal(rig.state()['org/node-x#guard'], undefined, '无连败则不落熔断键');
});

test('T4 通知链终点：零 hop 通知执行失败 → 就地收束不再回弹（零 hop 真任务失败仍回弹一封）', async () => {
  const rig = makeRig(NPX_TRANSPORT);
  const taskId = rig.inbox('零 hop 真任务：失败也要让对方知道\n[hop:0]');
  rig.inbox(`[任务失败 ghost-0001] 来自 测试工程师：\n角色进程退出码 1，无输出；stderr 摘要：dsh: TRANSPORT: Connection error.\n[hop:0]`);
  const { code } = await runDaemon(rig, ['--max-tasks', '2']);
  assert.equal(code, 0);
  const bounces = rig.messages().filter((m) => m.to === 'lead' && String(m.content).startsWith('[任务失败 '));
  assert.equal(bounces.length, 1, '仅真任务回弹一封；零 hop 通知失败被终点吞掉');
  assert.ok(bounces[0].content.includes(taskId), '回弹的是真任务而非通知');
  const terminal = rig.reports().filter((r) => r.action === 'error' && String(r.summary).includes('通知链终点'));
  assert.equal(terminal.length, 1, '通知终点在 reports.jsonl 留痕可审计');
});
