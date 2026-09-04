// DEF-EDGEKIND-1 契约回归案 R1–R3（终裁：采(a)驳(b)——工具面自述向域层 canonical 收敛，域层 EDGE_KINDS 唯一执法面不动）。
// 任务 id=DEF-EDGEKIND-1（QA 线 mtn4l1c6-v2fy 承载契约裁定）；依据：架构师终裁函（采(a)·驳(b)·放行当日可动）+ ADJ-2.3(a)：node --test + test/** 白名单。
//
// 缺陷回顾（修复见本 commit lib/index.js 2 hunk）：
//   工具自述面 org_mutate 的 :558 description 与 :575 kind.enum 声明 'dotted-subordinate'，
//   而域层 lib/org.js EDGE_KINDS=['collab','dotted']（:374 校验）——自述与执法倒置：
//   合法路径下 dotted 边按自述拼值必抛、零落盘，唯一可落盘值 'dotted' 反不在 enum 内（P1）。
//   修复=自述收敛（enum 与 description 同 hunk 改 'dotted'）；(b) 兼容归一被终裁驳回（零存量、增第三值静默漂移面、违 fail-fast）。
//
// 用例面 = 终裁回归案三件，编号与终裁原文一一对应：
//   R1 静态锁：kind.enum 与 EDGE_KINDS 集合相等（双向断言——既防 enum 超发也防漏发；EDGE_KINDS 从 org.js import，禁字面量复制）；
//   R2 反模式断言：工具自述面（description + parameters 全量序列化文本）不得再含 'dotted-subordinate'——自由文本面 enum 断言覆盖不到，即本缺陷藏身处；
//   R3 磁盘回读对账：隔离假 org 内域层 canonical 每值 addEdge 均成功、回读 kind 一致且确发生写入（防域层 canonical 值回归的独立护栏）。
//
// 双向证据契约：pre-fix（HEAD=be816de，enum 含 dotted-subordinate）本文件必红——预期红案 R1 R2；
//   R3 pre/post 同绿（缺陷期域层即接受 canonical 两值，其价值在拦截未来域层 canonical 漂移）；fix 树必全绿。
//   QA 独立旁证（不入库，node-4 承载）：/tmp/qa-bugv14-round2/regress-edgekind.mjs（N1 N2 N3 B1 E1 G1）、
//   /tmp/qa-bugv14-close/regress-edgekind1.mjs——与本文件互旁。
//
// 隔离（同 org-mutate-update-gate 口径）：DSH_AGENT_ORG_PATH 重定向 mkdtemp + HOME 隔离双保险，绝不触碰生产盘；
//   同文件内顶层用例按声明顺序串行执行（env 重定向为进程级）。
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { EDGE_KINDS } from '../lib/org.js';

// ---------- 隔离盘（每用例独立 org.json；HOME 假目录=零真盘双保险） ----------
const DIR = mkdtempSync(join(tmpdir(), 'qa-edgekind-contract-'));
const HOME_DIR = mkdtempSync(join(tmpdir(), 'qa-edgekind-home-'));
const PREV_ENV = { org: process.env.DSH_AGENT_ORG_PATH, home: process.env.HOME };
let seq = 0;

after(() => {
  if (PREV_ENV.org === undefined) delete process.env.DSH_AGENT_ORG_PATH;
  else process.env.DSH_AGENT_ORG_PATH = PREV_ENV.org;
  if (PREV_ENV.home === undefined) delete process.env.HOME;
  else process.env.HOME = PREV_ENV.home;
  rmSync(DIR, { recursive: true, force: true });
  rmSync(HOME_DIR, { recursive: true, force: true });
});

// 种子档：1 组织，root=r，同层兄弟 a/c —— addEdge 域面拒父子对（org.js:383）与重复对（:385），
// 故 R3 各 kind 各用一个全新 file（edges 恒空起步），连线对选同层兄弟。
function seedOrg(file) {
  const n = (id, parentId, name) => ({
    id, parentId, name, title: 't', model: null, systemPrompt: '',
    toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 50, y: 50,
  });
  writeFileSync(file, JSON.stringify({
    schemaVersion: 2,
    orgs: [{ id: 'o', name: 'R', rootNodeId: 'r', nodes: [n('r', null, '根'), n('a', 'r', 'A'), n('c', 'r', 'C')], edges: [] }],
  }, null, 2));
}

async function sandbox() {
  const file = join(DIR, `org-${seq++}.json`);
  seedOrg(file);
  process.env.DSH_AGENT_ORG_PATH = file;
  process.env.HOME = HOME_DIR; // DSH_AGENT_ORG_PATH 已优先，此为重定向失效时的双保险
  const tools = new Map();
  const ctx = {
    systemPrompt: { section: () => () => {} },
    effect: (f) => f(),
    reflect: { get: (s) => (s === 'tools' ? { register: (t) => tools.set(t.name, t) } : (s === 'webServer' ? { register: () => {} } : undefined)) },
    on: () => {},
  };
  const { apply } = await import(new URL('../lib/index.js', import.meta.url).href);
  apply(ctx, {});
  return { file, tool: tools.get('org_mutate'), read: () => readFileSync(file, 'utf8') };
}

// ---------- R1 静态锁：enum 与 EDGE_KINDS 集合相等（双向） ----------
test('R1 静态锁：org_mutate kind.enum 与 org.js EDGE_KINDS 集合相等（防超发+防漏发）', async () => {
  const { tool } = await sandbox();
  const enumVals = tool.parameters?.properties?.kind?.enum;
  assert.ok(Array.isArray(enumVals) && enumVals.length > 0, 'kind.enum 必须存在且非空');
  const 漏发 = EDGE_KINDS.filter((v) => !enumVals.includes(v)); // 域层合法值未声明 → 合法路径不可建
  const 超发 = enumVals.filter((v) => !EDGE_KINDS.includes(v)); // 声明域层不容值 → 自述即缺陷（本缺陷藏身形态）
  assert.deepEqual({ 漏发, 超发 }, { 漏发: [], 超发: [] },
    `enum=${JSON.stringify(enumVals)} vs EDGE_KINDS=${JSON.stringify(EDGE_KINDS)}`);
});

// ---------- R2 反模式断言：自述面零残留（自由文本面，enum 断言覆盖不到处） ----------
test('R2 反模式断言：org_mutate 自述面（description+parameters 序列化全量）不含 dotted-subordinate', async () => {
  const { tool } = await sandbox();
  const selfText = JSON.stringify({ description: tool.description, parameters: tool.parameters });
  assert.ok(!selfText.includes('dotted-subordinate'),
    '工具自述面再现被驳值 dotted-subordinate（终裁采(a)驳(b)，该值不应存在于任何自述文本）');
});

// ---------- R3 磁盘回读对账：域层 canonical 每值 addEdge 成功 + 回读一致 + 确发生写入 ----------
test('R3 磁盘回读对账：EDGE_KINDS 每值经工具 addEdge 成功、盘上回读 kind 一致', async (t) => {
  for (const kind of EDGE_KINDS) {
    await t.test(`kind=${kind}`, async () => {
      const { tool, read } = await sandbox();
      const before = read();
      await tool.execute({ op: 'addEdge', kind, from: 'a', to: 'c' });
      const after = read();
      const edges = JSON.parse(after).orgs[0].edges;
      assert.equal(edges.length, 1, `盘上应恰 1 条边，实为 ${JSON.stringify(edges)}`);
      assert.equal(edges[0].kind, kind, '回读 kind 应与调用值一致（canonical 落盘口径）');
      assert.notEqual(after, before, '确发生落盘（防假成功）');
    });
  }
});
