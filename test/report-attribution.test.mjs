// org_report 归属字段契约测试（任务 mtllnrp2-g5rr，前端 collab-retro 复盘页按成员归属"报告"列的数据源修复）。
// 钉死口径（后端→架构师确认信 2026-09-04）：
//   ① 写入侧唯一改动点 = lib/index.js org_report（type:"report" 行并非 daemon 写，daemon 只写 type:"run"）；
//   ② 身份来源 = daemon spawn headless 注入的 env DSH_ORG_NODE_ID（进程上下文决定，非模型自报）；
//   ③ 参数签名不变（to,summary，additionalProperties:false），前端与调用方零改动；
//   ④ env 缺失或节点查不到 → from/fromName/fromOrg 三字段原子组整体省略（与历史老行同形态，禁止写 null 污染）；
//   ⑤ from 恒为合法节点 id；归属键恒用 from（fromName 仅展示，可随改名漂移）。
// 三字段原子组 schema 定版 = 架构师裁定 mtxm1ljy-ygz7：{ts,type:'report',to,toOrg,summary,from?,fromName?,fromOrg?}。
// 运行：npm test（= node --test）。落盘路径经 DSH_AGENT_ORG_PATH 重定向到临时目录，绝不碰 ~/.dsh/agent-org。
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply } from '../lib/index.js';

const HERE = dirname(fileURLToPath(import.meta.url));
const ORG_DOC = () => ({
  schemaVersion: 2,
  orgs: [{
    id: 'o', name: '测试组织', rootNodeId: 'lead',
    nodes: [
      { id: 'lead', parentId: null, name: '负责人' },
      { id: 'node-2', parentId: 'lead', name: '后端工程师' },
    ],
  }],
});

/** 假 ctx 装载工具（探测路径，同 mount-selftest A2 语义），返回按名索引的工具表。 */
function mountTools() {
  const seen = [];
  const ctx = {
    systemPrompt: { section: () => () => {} },
    effect: (fn) => { fn(); },
    reflect: { get: (svc) => (svc === 'tools'
      ? { register: (t) => { if (!seen.some((x) => x.name === t.name)) seen.push(t); } }
      : undefined) },
    on: () => {},
  };
  apply(ctx);
  return Object.fromEntries(seen.map((t) => [t.name, t]));
}

/** 临时数据目录（org.json + reports.jsonl 同目录，reportsPath=dirname(orgPath) 推导）。 */
function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'org-report-attr-'));
  writeFileSync(join(dir, 'org.json'), JSON.stringify(ORG_DOC()));
  return { path: join(dir, 'org.json'), reports: join(dir, 'reports.jsonl') };
}

const lastReportLine = (p) => readFileSync(p, 'utf8').trimEnd().split('\n').pop();

async function fileReport({ nodeId }) {
  const sb = makeSandbox();
  process.env.DSH_AGENT_ORG_PATH = sb.path;
  try {
    if (nodeId === undefined) delete process.env.DSH_ORG_NODE_ID;
    else process.env.DSH_ORG_NODE_ID = nodeId;
    const report = mountTools().org_report;
    const out = await report.execute({ to: 'lead', summary: '交付了 X' });
    assert.match(out, /已记录汇报 → 负责人/);
    return JSON.parse(lastReportLine(sb.reports));
  } finally {
    delete process.env.DSH_AGENT_ORG_PATH;
    delete process.env.DSH_ORG_NODE_ID;
  }
}

// —— ②⑤ daemon 身份在场：from/fromName/fromOrg 三字段原子组正确归属，原有字段不受影响 ——
test('env DSH_ORG_NODE_ID=node-2 → report 行带 from=node-2 / fromName=后端工程师 / fromOrg=o', async () => {
  const row = await fileReport({ nodeId: 'node-2' });
  assert.equal(row.type, 'report');
  assert.equal(row.to, 'lead');
  assert.equal(row.toOrg, 'o');
  assert.equal(row.summary, '交付了 X');
  assert.equal(typeof row.ts, 'string');
  assert.equal(row.from, 'node-2');
  assert.equal(row.fromName, '后端工程师');
  assert.equal(row.fromOrg, 'o');
});

// —— ④ 交互/Web 会话（无 env）：三 from* 键原子组整体省略，形态与历史老行一致，不写 null ——
test('env 缺失 → from/fromName/fromOrg 三键均不存在（向后兼容，非 null 污染）', async () => {
  const row = await fileReport({ nodeId: undefined });
  assert.ok(!('from' in row), `不应有 from 键：${JSON.stringify(row)}`);
  assert.ok(!('fromName' in row), `不应有 fromName 键：${JSON.stringify(row)}`);
  assert.ok(!('fromOrg' in row), `不应有 fromOrg 键：${JSON.stringify(row)}`);
  assert.equal(row.type, 'report'); // 基础字段不受影响
});

// —— ④ 防御：env 指向已删除/伪造节点 → 三字段同样整体省略，from 恒为合法节点 id ——
test('env 指向不存在节点 → 三字段省略（from 永不携带非法 id）', async () => {
  const row = await fileReport({ nodeId: 'ghost-node' });
  assert.ok(!('from' in row) && !('fromName' in row) && !('fromOrg' in row), JSON.stringify(row));
});

// —— ③ 参数签名钉死：前端与既有调用方零改动的前提 ——
test('org_report 参数签名不变：required=[to,summary]，无新增入参', () => {
  const report = mountTools().org_report;
  assert.deepEqual(report.parameters.required, ['to', 'summary']);
  assert.deepEqual(Object.keys(report.parameters.properties).sort(), ['summary', 'to']);
  assert.equal(report.parameters.additionalProperties, false);
});

// —— daemon 侧端到端：runHeadless spawn 出的子进程 env 必须携带 DSH_ORG_NODE_ID=SELF_ID ——
test('daemon spawn headless 子进程注入 DSH_ORG_NODE_ID=自身节点 id（stub npx 端到端）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'org-role-env-'));
  const stubDir = join(dir, 'stub');
  writeFileSync(join(dir, 'org.json'), JSON.stringify(ORG_DOC()));
  writeFileSync(join(dir, 'messages.jsonl'), JSON.stringify({
    id: 't1', ts: new Date().toISOString(), from: 'lead', fromName: '负责人', to: 'node-2', toName: '后端工程师', content: '测试任务',
  }) + '\n');
  mkdirSync(stubDir, { recursive: true });
  // 假 npx：不启动真 dsh，只把看到的身份 env 打到 stdout（stdout 即角色结果，会被 daemon 回投进 messages.jsonl）
  const stub = join(stubDir, 'npx');
  writeFileSync(stub, '#!/bin/sh\necho "NODE=[${DSH_ORG_NODE_ID}]"\n');
  chmodSync(stub, 0o755);
  const run = spawnSync(process.execPath,
    [join(HERE, '..', 'bin', 'org-role.js'), 'node-2', '--org', 'o', '--once', '--from-now', 'false', '--interval', '1', '--timeout', '30'],
    {
      env: { ...process.env, DSH_AGENT_ORG_PATH: join(dir, 'org.json'), PATH: `${stubDir}:${process.env.PATH}` },
      encoding: 'utf8', timeout: 30000,
    });
  try {
    assert.equal(run.status, 0, `daemon 退出码异常：${run.status}\n${run.stderr}`);
    const msgs = readFileSync(join(dir, 'messages.jsonl'), 'utf8').trimEnd().split('\n').map((l) => JSON.parse(l));
    const reply = msgs[msgs.length - 1];
    assert.equal(reply.from, 'node-2');
    assert.match(reply.content, /任务完成 t1/);
    assert.match(reply.content, /NODE=\[node-2\]/, '子进程未看到注入的身份 env');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
