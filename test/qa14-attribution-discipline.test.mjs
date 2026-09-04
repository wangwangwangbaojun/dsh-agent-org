// QA-V14 归属断言纪律门禁测试（任务 mtnae36o-bawk，依据架构师裁定 ARCH-ADJ-R1 的 G1/G2/G3 + 错误路径）。
// 纪律口径（ARCH-ADJ-R1，落笔前必读，全文经 mtn34ils-jpfv 知会件裁定）：
//   G1 沙盒隔离：DSH_AGENT_ORG_PATH 重定向 mkdtemp 沙盒，只断言本件自写行，零历史依赖、绝不读 ~/.dsh/agent-org；
//   G2 形态锁：断言「三键全齐 ⇔ 三键全缺」等价类；禁「report 行必有 from」存在性断言（外部/Web 会话无
//      DSH_ORG_NODE_ID 时持续合法产无键行，存在性断言必假红）；
//   G3 类型隔离：三键尺只量 type=="report"；run/delegate/task 行形态各异，混量必假红；
//   G4 生产文件只读：涉及历史账面的核查一律走 /tmp 只读扫描（另附报告），不进本门禁。
// 单点写入不变量（lib/index.js org_report 单点 spread）由本件回归锁死：任何未来写点产生半态（如
// from+fromName 缺 fromOrg，即 node-3 实测的 14 行旧半态形态）都会让 TC-1 变红。
// 运行：npm test（= node --test）。
import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { apply } from '../lib/index.js';

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

function makeSandbox() {
  const dir = mkdtempSync(join(tmpdir(), 'qa14-attr-'));
  writeFileSync(join(dir, 'org.json'), JSON.stringify(ORG_DOC()));
  return { path: join(dir, 'org.json'), reports: join(dir, 'reports.jsonl') };
}

/** G3 尺子：只量 type=="report" 的行，返回三键形态等价值类的违例行。 */
function g3Violations(lines) {
  return lines
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter((r) => r !== null && r.type === 'report')
    .filter((r) => {
      const s = ['from', 'fromName', 'fromOrg'].filter((k) => k in r).sort().join('+');
      return !(s === '' || s === 'from+fromName+fromOrg'); // G2 等价类：全齐 ⇔ 全缺
    });
}

const readLines = (p) => { try { return readFileSync(p, 'utf8').trimEnd().split('\n').filter(Boolean); } catch { return []; } };

async function fileReport(sb, report, { nodeId, to = 'lead', summary = 'QA-V14 自写行' }) {
  process.env.DSH_AGENT_ORG_PATH = sb.path;
  try {
    if (nodeId === undefined) delete process.env.DSH_ORG_NODE_ID;
    else process.env.DSH_ORG_NODE_ID = nodeId;
    return await report.execute({ to, summary });
  } finally {
    delete process.env.DSH_AGENT_ORG_PATH;
    delete process.env.DSH_ORG_NODE_ID;
  }
}

// TC-1（正常路径 · G1+G2）：同一沙盒批量自写 3 条带身份 + 2 条无 env + 1 条幽灵节点，
// 本件自写行全体满足「三键全齐 ⇔ 三键全缺」等价类，半态=0；且两类非空（防真空通过）。
test('QA14-TC1 G1沙盒+G2等价类：自写行 三键全齐⇔三键全缺，半态(旧14行形态)=0', async () => {
  const sb = makeSandbox();
  const report = mountTools().org_report;
  for (let i = 0; i < 3; i++) await fileReport(sb, report, { nodeId: 'node-2', summary: `带身份 ${i}` });
  for (let i = 0; i < 2; i++) await fileReport(sb, report, { nodeId: undefined, summary: `无env ${i}` });
  await fileReport(sb, report, { nodeId: 'ghost-node', summary: '幽灵节点' });

  const rows = readLines(sb.reports).map((l) => JSON.parse(l));
  assert.equal(rows.length, 6, '沙盒应恰含本件自写 6 行（G1 隔离）');
  assert.deepEqual(g3Violations(rows), [], '等价类违例必须为 0（出现 from+fromName 无 fromOrg = node-3 旧半态回归）');
  const shape = (r) => ['from', 'fromName', 'fromOrg'].filter((k) => k in r).sort().join('+');
  const full = rows.filter((r) => shape(r) === 'from+fromName+fromOrg');
  const none = rows.filter((r) => shape(r) === '');
  assert.equal(full.length, 3, '带身份类必须全齐三键');
  assert.equal(none.length, 3, '无env + 幽灵节点必须整体省略（无 null 污染）');
  assert.ok(full.every((r) => r.from === 'node-2' && r.fromName === '后端工程师' && r.fromOrg === 'o'));
});

// TC-2（边界 · G3）：沙盒内混入 run(仅from)/run(from+fromOrg)/delegate(双键)/task(双键) 合成行，
// report-only 尺子违例=0（类型隔离成立）；去掉 type 过滤的同尺违例>0（证明过滤器真实承重、尺非真空）。
test('QA14-TC2 G3类型隔离：run/delegate/task 混存时 report-only 三键尺零违例、混量尺必红', async () => {
  const sb = makeSandbox();
  const report = mountTools().org_report;
  await fileReport(sb, report, { nodeId: 'node-2' });
  await fileReport(sb, report, { nodeId: undefined });
  // 合成行 = 生产实测三形态的镜像（org-role.js start 行三键 / done 行有意省 fromName / delegate 双键）
  const synth = [
    { ts: '2000-01-01T00:00:00.000Z', type: 'run', to: 'node-2', from: 'system', node: 'node-2', action: 'upgrade' },
    { ts: '2000-01-01T00:00:01.000Z', type: 'run', to: 'node-2', from: 'lead', fromOrg: 'o', action: 'done' },
    { ts: '2000-01-01T00:00:02.000Z', type: 'run', to: 'node-2', from: 'lead', fromName: '负责人', fromOrg: 'o', action: 'start' },
    { ts: '2000-01-01T00:00:03.000Z', type: 'delegate', to: 'node-2', from: 'lead', fromOrg: 'o' },
    { ts: '2000-01-01T00:00:04.000Z', type: 'task', to: 'lead', from: 'external', fromOrg: null },
  ];
  appendFileSync(sb.reports, synth.map((r) => JSON.stringify(r)).join('\n') + '\n');
  const lines = readLines(sb.reports);
  assert.equal(lines.length, 7);
  assert.deepEqual(g3Violations(lines), [], 'G3：尺子只量 report 行，混存形态不得计分');
  const mixed = g3Violations(lines.map((l) => l.replace('"type":"run"', '"type":"report"')
    .replace('"type":"delegate"', '"type":"report"').replace('"type":"task"', '"type":"report"')));
  assert.ok(mixed.length >= 3, '对照：混量（假 report 化）必产生违例，证明 G3 过滤器非真空');
});

// TC-3（错误路径）：to 不存在 / summary 空白 → 写入前抛错，reports.jsonl 零字节增行（不落半态）。
test('QA14-TC3 错误路径：非法入参抛错且 reports.jsonl 零落行（错误不产半态）', async () => {
  const sb = makeSandbox();
  const report = mountTools().org_report;
  await assert.rejects(() => fileReport(sb, report, { nodeId: 'node-2', to: 'ghost-target' }), /节点不存在/);
  await assert.rejects(() => fileReport(sb, report, { nodeId: 'node-2', summary: '   ' }), /summary 不能为空/);
  assert.deepEqual(readLines(sb.reports), [], '错误路径必须零落行');
  // 恢复性：错误调用后正常路径仍工作且形态合法
  await fileReport(sb, report, { nodeId: 'node-2', summary: '错误后恢复' });
  const rows = readLines(sb.reports).map((l) => JSON.parse(l));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].from, 'node-2');
  assert.deepEqual(g3Violations(rows), []);
});
