// DEF-EDGEKIND-1 常备门禁：org_mutate 工具 schema 与 org.js 域面连线类型口径不一致的固化回归。
// 任务 id=mtn6q6e5-pgz5（后端 node-2 交测，架构师终裁采(a)·驳(b)，原子 commit = 单文件 2 行 + 本回归）。
//
// 缺陷回顾（DEF-EDGEKIND-1）：
//   lib/index.js org_mutate 的 kind 参数 schema 曾写 enum:['collab','dotted-subordinate']，
//   而域面 lib/org.js EDGE_KINDS=['collab','dotted']（:14）只认 'dotted'；
//   照 schema 传 'dotted-subordinate' 的调用方必被域面响亮拒绝——文档承诺值即运行时非法值。
//   修复 = 工具面两处改口 'dotted'（:558 自述括号片段 + :575 enum 及同行 description label），
//   org.js 一字未动，零数据迁移。
//
// 用例面 = 8 案，编号对齐终裁三案 + QA 常规面：
//   R1  = 静态锁：工具 schema kind.enum ≡ EDGE_KINDS（双向断言；EDGE_KINDS 从 org.js import，禁字面量复制）。
//   R1b = schema 自洽：kind.description 须提及 enum 的每个值（:575 同行 label 同步锁）。
//   R2  = 反模式文本锁：全部已注册工具的序列化文本（description + 参数描述 + enum，自由文本面）
//         不得再含 'dotted-subordinate'。该字面量在此仅作缺陷 token 出现，非合法值集合的复制。
//   R3a = 正常路径①：collab 两值之一 addEdge 成功 + 磁盘回读 kind='collab' + 返回文案 edge id 与盘上一致。
//   R3b = 正常路径②（边界：合法值集另一侧）：dotted addEdge 成功 + 磁盘回读 kind='dotted'。
//   E1  = 错误路径：旧值 'dotted-subordinate' 响亮抛错，报错文案指向合法值集合（由 EDGE_KINDS 推导），零落盘。
//   E2  = 结构边界：addEdge 域面拒父子对（org.js isParentPair）与重复对（pairKey 查重），零落盘
//         ——即 node-2 交件「坑位提示」：fixture 连线一律取同层兄弟节点对。
//   I1  = 隔离对账：全程只写 mkdtemp 重定向盘，磁盘终态恰为两条边、kind 集合与 EDGE_KINDS 一致。
//
// 双向证据契约（同 QA-GATE1 口径）：本文件在 pre-fix 净树（be816de，修复前 lib/index.js）必红，
//   预期红案恰为 {R1, R2}（schema 口径差与自由文本残留的直接显形）；R1b/R3a/R3b/E1/E2/I1 双侧同绿
//   （pre-fix 域面本就拒绝 'dotted-subordinate'，E1 在 pre-fix 亦绿——它锁的是修复后的报错指向，
//   非修复面本身）。fix 树（工作区 2 行修复）必全绿。
//
// 隔离（终裁 ADJ-2.3(a) 口径）：DSH_AGENT_ORG_PATH 重定向到 mkdtemp 临时文件 + HOME 一并指向该目录，
//   桩节点含全量落盘字段（id/parentId/name/title/model/systemPrompt/toolScope/maxTokens/layout/x/y），
//   否则成功路径的 renderChart 缺字段抛错。绝不触碰 ~/.dsh/agent-org 生产盘。
// 运行：npm test（= node --test）自动计入；同文件内顶层用例按声明顺序串行执行。
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EDGE_KINDS } from '../lib/org.js';

// 缺陷 token：唯一允许出现的字面量旧值，只用于「它不得再出现/必须被拒绝」两类断言。
const LEGACY_KIND = 'dotted-subordinate';

// ---------- 隔离盘 + 种子档（root=lead + 三个同层兄弟 qa-a/b/c；全量落盘字段） ----------
const DIR = mkdtempSync(join(tmpdir(), 'qa-edgekind-'));
const ORG_FILE = join(DIR, 'org.json');
process.env.DSH_AGENT_ORG_PATH = ORG_FILE;
process.env.HOME = DIR; // 双保险：即便重定向失效也碰不到真 ~/.dsh

const stub = (id, parentId, name, x) => ({
  id, parentId, name, title: '岗', model: null, systemPrompt: '',
  toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x, y: 150,
});
const SEED = {
  schemaVersion: 2,
  orgs: [{
    id: 'org', name: '测试队', rootNodeId: 'lead',
    nodes: [
      { id: 'lead', parentId: null, name: '负责人', title: '总体协调', model: null, systemPrompt: '', toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 60, y: 40 },
      stub('qa-a', 'lead', '甲', 20), stub('qa-b', 'lead', '乙', 100), stub('qa-c', 'lead', '丙', 180),
    ],
    edges: [],
  }],
};
writeFileSync(ORG_FILE, JSON.stringify(SEED, null, 2));
after(() => rmSync(DIR, { recursive: true, force: true }));

// ---------- 假 ctx 装载插件（与 mount-selftest / QA-GATE1 同语义，工具注册进内存表） ----------
const tools = new Map();
const ctx = {
  systemPrompt: { section: () => () => {} },
  effect: (fn) => { fn(); },
  reflect: {
    get: (service) => {
      if (service === 'tools') return { register: (t) => tools.set(t.name, t) };
      if (service === 'webServer') return { register: () => {} };
      return undefined;
    },
  },
  on: () => {},
};
const { apply } = await import('../lib/index.js');
apply(ctx, {});
const mutateTool = tools.get('org_mutate');
assert.ok(mutateTool, '前置件：org_mutate 工具未注册');

// ---------- 磁盘对账 helpers：一切以回读磁盘为准 ----------
const disk = () => JSON.parse(readFileSync(ORG_FILE, 'utf8'));
const diskEdges = () => disk().orgs[0].edges ?? [];
async function expectThrows(promise, re, tag) {
  let err = null;
  try { await promise; } catch (e) { err = e; }
  assert.ok(err, `${tag}：预期抛错却静默成功`);
  assert.match(String(err?.message ?? err), re, `${tag}：报错文案不符：${err?.message ?? err}`);
  return err;
}

// ============ R1 静态锁：schema enum ≡ EDGE_KINDS（双向） ============

test('R1 org_mutate.kind.enum 与 org.js EDGE_KINDS 集合相等（双向断言，禁字面量复制）', () => {
  const enumv = mutateTool.parameters?.properties?.kind?.enum;
  assert.ok(Array.isArray(enumv) && enumv.length > 0, 'kind.enum 缺失或为空');
  // 方向①：schema 承诺的每个值域面必须接受
  for (const k of enumv) assert.ok(EDGE_KINDS.includes(k), `schema 承诺了域面非法值：${k}`);
  // 方向②：域面接受的每个值 schema 必须承诺（排序后 deepEqual 兼拦重复项/缺项）
  assert.deepEqual([...enumv].sort(), [...EDGE_KINDS].sort(), 'kind.enum 与 EDGE_KINDS 集合不相等');
});

test('R1b kind.description 提及 enum 的每个值（:575 同行 label 同步锁）', () => {
  const kindSchema = mutateTool.parameters.properties.kind;
  for (const k of kindSchema.enum) {
    assert.ok(kindSchema.description?.includes(k), `description 未提及 enum 值：${k}`);
  }
});

// ============ R2 反模式文本锁 ============

test('R2 全部已注册工具序列化文本零残留 dotted-subordinate（自由文本面 grep 式断言）', () => {
  assert.ok(tools.size > 0, '前置件：无工具注册');
  for (const [name, t] of tools) {
    assert.ok(!JSON.stringify(t).includes(LEGACY_KIND), `工具 ${name} 的注册面（描述/参数/enum）残留缺陷 token`);
  }
});

// ============ R3 磁盘回读对账：两值 addEdge 均成功、回读 kind 一致（正常路径 + 边界值） ============

test('R3a addEdge kind=collab 成功，磁盘回读 kind=collab，返回文案 edge id 与盘上一致', async () => {
  const msg = await mutateTool.execute({ op: 'addEdge', from: 'qa-a', to: 'qa-b', kind: 'collab' });
  assert.match(String(msg), /已连线 qa-a ⇄ 协作 qa-b/, '返回文案不符');
  assert.equal(diskEdges().length, 1, 'collab 边未落盘');
  assert.equal(diskEdges()[0].kind, 'collab', '磁盘回读 kind 不符');
  assert.match(String(msg), new RegExp(`edge=${diskEdges()[0].id}`), '返回文案的 edge id 与盘上一致性断言失败');
});

test('R3b addEdge kind=dotted（合法值集另一侧边界）成功，磁盘回读 kind=dotted', async () => {
  const msg = await mutateTool.execute({ op: 'addEdge', from: 'qa-a', to: 'qa-c', kind: 'dotted' });
  assert.match(String(msg), /已连线 qa-a ┄ 虚线下级 qa-c/, '返回文案不符');
  assert.equal(diskEdges().length, 2, 'dotted 边未落盘');
  assert.equal(diskEdges()[1].kind, 'dotted', '磁盘回读 kind 不符');
});

// ============ E 错误路径与结构边界（均须零落盘） ============

test('E1 旧值 dotted-subordinate 响亮抛错且指向合法值集合，零落盘', async () => {
  const before = diskEdges().length;
  const err = await expectThrows(
    mutateTool.execute({ op: 'addEdge', from: 'qa-b', to: 'qa-c', kind: LEGACY_KIND }),
    /连线类型必须是/, 'E1',
  );
  for (const k of EDGE_KINDS) {
    assert.ok(err.message.includes(k), `报错文案未指向合法值 ${k}：${err.message}`);
  }
  assert.equal(diskEdges().length, before, '错误路径发生落盘');
});

test('E2 结构边界：父子对与重复对 addEdge 均被拒，零落盘（坑位提示固化）', async () => {
  const before = diskEdges().length;
  await expectThrows(mutateTool.execute({ op: 'addEdge', from: 'lead', to: 'qa-a', kind: 'collab' }),
    /已是上下级/, 'E2-parent');
  await expectThrows(mutateTool.execute({ op: 'addEdge', from: 'qa-a', to: 'qa-b', kind: 'dotted' }),
    /已有一条连线/, 'E2-dup');
  assert.equal(diskEdges().length, before, '错误路径发生落盘');
});

// ============ I1 隔离终态对账 ============

test('I1 全程只写 mkdtemp 重定向盘；磁盘终态恰两条边且 kind 集合 ≡ EDGE_KINDS', () => {
  assert.ok(ORG_FILE.startsWith(tmpdir()), `隔离目录未落在系统临时目录：${ORG_FILE}`);
  assert.equal(process.env.DSH_AGENT_ORG_PATH, ORG_FILE, '环境变量重定向被改写');
  assert.equal(process.env.HOME, DIR, 'HOME 隔离被改写');
  const kinds = diskEdges().map((e) => e.kind).sort();
  assert.deepEqual(kinds, [...EDGE_KINDS].sort(), '磁盘终态 kind 集合与 EDGE_KINDS 不一致');
});
