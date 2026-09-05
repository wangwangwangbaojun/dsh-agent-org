// QA 固化票（mtnp23sr-qrno）：DEF-PATCHDROP-1 / BUG-V14B-4 工具面 org_mutate 未知键点名必拒门 固化回归（node-4）。
// 立案 = node-4 函 mtnlc4f0-q9n3；修复 = node-2 commit 0b83aaa（lib/index.js createTools 数组外裹门）；
// 源探针 /tmp/def-patchdrop1/probe.mjs（不入库，本文件即 E5/E6 现案 + 报备增补 E7 的固化形态，node-2 函明确"固化票入仓我不重复挂锚"）。
//
// 缺陷回顾（DEF-PATCHDROP-1，BUG-V14「返回成功但无操作」残签在 LLM 调用面的最后一面）：
//   schema 声明 additionalProperties:false 但已装 harness 运行时不校验工具入参（提示级不拦，QA 实测），
//   拼错/幻觉平铺键直达 execute；op=update 打包层按已知键白名单复制 → 未知键在抵达 org.js update
//   未知键门（org.js:350）之前即被吞：
//     混合形态（title + sytemPrompt）＝合法键落盘＋拼错键静默蒸发＋返回「已更新节点」假成功（E5）；
//     纯未知键形态退化为泛化「未携带任何已知字段」，点名丢失（E6，V14B-3 点名仅覆盖域层嵌套 patch 面）；
//     门若只挂 update，op=add 同形残面（拼错 sytemPrompt 静默建出空提示词节点仍返回成功）兜不住（E7，
//     node-2 修复实测增补、立案面之外的同形残面，本函报备并入固化）。
//   修法 = execute 入口对 args 平铺未知键点名必拒（knownKeys=Set(Object.keys(parameters.properties))，
//   schema 单一事实源），throw 先于 loadOrg/saveOrg＝盘字节级零变化；门置于 op 分发之前覆盖全部 op。
//
// 用例面（11 案）：
//   E5  混合拼错键点名必拒（BUG-V14 签名直接显形面；pre-fix 主红案）
//   E5z E5 形态盘字节级零变化（throw-before-write 契约）
//   E6  纯未知键点名不退化（点名 foo/bar + 禁泛化文案回潮）
//   E7  op=add 面同形收口（增补面；域层 add 无未知键概念，工具面是唯一防线）
//   E8  门先于 op 分发（未知 op + 未知键同现 → 点名键、域「未知操作」不得抢跑）
//   E9  op=addEdge 面同门（op 全覆盖抽第二样张：边不生成 + 盘零变化）
//   B1  原型名类 own key（toString）不被 knownKeys 免疫面漏网（Object.keys own-keys 语义锁）
//   E10 已知字段枚举 ≡ schema.properties 键集（单一事实源关系锁，防未来字段增减双写漂移；
//       依 node-2 交付函口径只锚关系不锚枚举字面全文——枚举串随 schema 演进会变）
//   E11 门对已知键面透明（未知 op 仍由域层「未知操作」报错＝门不越权抢报）
//   H1  金样：单已知键正常落盘零误伤
//   H2  金样：六已知键全带（Web client.js patchOf 同构面）零误伤
//
// 双向证据契约（lead 验收②同款）：本文件在 pre-fix 净树（4971add，其 lib/index.js 与 0b83aaa^ 逐字节
//   相同——0e1fe73 系纯报告件零代码面）必红，红集 = E5 E5z E6 E7 E8 E9 B1 E10（8 案，均为静默假成功/
//   泛化退化/漏网三形状的直接显形）；双树同绿 = H1 H2 E11（金样与透明面，pre-fix 下本就无回归）。
//   post-fix 树（≥0b83aaa）必全绿。
//
// 锚点纪律：全部走运行时工具面（execute 调用 + 磁盘回读对账），不碰源文自述面提取路——
//   test/org-toolface-enum-gate G0/G1a 按 name:→output: 源文段界定自述面，schema 声明位置搬移=其提取失明
//   （失明型假绿禁，G0 自检已按设计拦截过一次 schema 上提）；本文件因此对 schema 只取运行时对象反射（E10）。
// 隔离（lead 验收④）：DSH_AGENT_ORG_PATH 重定向 mkdtemp 临时盘，绝不触碰 ~/.dsh/agent-org 生产盘。
// 运行：npm test（= node --test）自动计入；单档回归 node --test test/bugv14b4-toolface-unknown-keys.test.mjs。
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------- 隔离盘 + 种子档（同立案探针：1 组织，root=lead，子节点 node-w） ----------
const DIR = mkdtempSync(join(tmpdir(), 'qa-dpd1-'));
const ORG_FILE = join(DIR, 'org.json');
process.env.DSH_AGENT_ORG_PATH = ORG_FILE;

const SEED = {
  schemaVersion: 2,
  orgs: [{
    id: 'org', name: '测试队', rootNodeId: 'lead',
    nodes: [
      { id: 'lead', parentId: null, name: '负责人', title: '总体协调', model: null, systemPrompt: '', toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 60, y: 40 },
      { id: 'node-w', parentId: 'lead', name: '工人', title: '执行', model: null, systemPrompt: 'OLD-PROMPT', toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 100, y: 150 },
    ],
    edges: [],
  }],
};
const writeSeed = () => writeFileSync(ORG_FILE, JSON.stringify(SEED, null, 2));
writeSeed();

// ---------- 假 ctx 装载插件（同 mount-selftest / org-mutate-update-gate 语义） ----------
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

// ---------- 磁盘对账 helpers：一切以回读磁盘为准，不信返回值文案 ----------
const disk = () => JSON.parse(readFileSync(ORG_FILE, 'utf8'));
const diskNode = (id) => disk().orgs[0].nodes.find((n) => n.id === id);
const diskNodeByName = (name) => disk().orgs[0].nodes.find((n) => n.name === name);
const diskEdges = () => disk().orgs[0].edges ?? [];
const bytes = () => createHash('sha256').update(readFileSync(ORG_FILE)).digest('hex');

/** 调用工具面，吞异常统一成 {err,res}，由各案自行定性。 */
async function runMutate(args) {
  try { return { res: await mutateTool.execute(args) }; } catch (e) { return { err: e }; }
}
/** 点名段 = 文案中「（已知字段：…）」之前的部分；对无该标记的泛化文案退化为整串（诚实红）。 */
const unknownPart = (msg) => msg.split('（已知字段')[0];

after(() => { rmSync(DIR, { recursive: true, force: true }); });

// ============ E 组：未知键门（post-fix 必抛；pre-fix 必红组） ============

test('E5 update 合法键+拼错键混合：必抛且点名 sytemPrompt（pre-fix=假成功 title 落盘+拼错键蒸发，BUG-V14 签名直接显形）', async () => {
  writeSeed();
  const { err, res } = await runMutate({ op: 'update', id: 'node-w', title: '资深执行', sytemPrompt: 'TYPO-PROMPT' });
  assert.ok(err, `E5：未抛错→"${String(res).split('\n')[0]}" —— DEF-PATCHDROP-1 静默假成功复现（合法键落盘+拼错键蒸发仍报成功）`);
  assert.match(err.message, /未知字段/, `E5：异常应命中点名判据 /未知字段/（node-2 交付函口径锚），实际：${err.message}`);
  const named = unknownPart(err.message);
  assert.ok(named.includes('sytemPrompt'), `E5：点名段应含拼错键 sytemPrompt，实际点名段：${named}`);
  assert.ok(!named.includes('title'), `E5：已知键 title 不得被列为未知字段，实际点名段：${named}`);
  const n = diskNode('node-w');
  assert.equal(n.systemPrompt, 'OLD-PROMPT', 'E5：被拒后 sysPrompt 发生任何改写即红');
  assert.equal(n.title, '执行', 'E5：被拒后 title 落盘漂移即红（pre-fix 形状=资深执行落盘）');
});

test('E5z E5 形态盘字节级零变化（throw 先于 loadOrg/saveOrg 的字节级契约）', async () => {
  writeSeed();
  const before = bytes();
  const { err } = await runMutate({ op: 'update', id: 'node-w', title: '资深执行', sytemPrompt: 'TYPO-PROMPT' });
  const after_ = bytes();
  assert.ok(err, 'E5z：未抛错即红（E5 同参必抛，门失效复现）');
  assert.equal(after_, before, 'E5z：未知键被拒后盘 sha256 必须与调用前全等（throw-before-write）');
});

test('E6 纯未知键点名 foo/bar 不退化（pre-fix=泛化「未携带任何已知字段」，点名退化面禁回潮）', async () => {
  writeSeed();
  const { err, res } = await runMutate({ op: 'update', id: 'node-w', foo: 1, bar: 2 });
  assert.ok(err, `E6：未抛错→"${String(res).split('\n')[0]}" —— 纯未知键静默通过复现`);
  assert.ok(!err.message.includes('未携带任何已知字段'), `E6：退化为泛化零键拒绝（点名丢失，V14B-3 仅覆盖域层 patch 的假绿锚复现），实际：${err.message}`);
  assert.match(err.message, /未知字段/, `E6：异常应命中 /未知字段/，实际：${err.message}`);
  const named = unknownPart(err.message);
  assert.ok(named.includes('foo') && named.includes('bar'), `E6：应逐一点名 foo/bar，实际点名段：${named}`);
  assert.equal(bytes(), bytesFromSeed(), 'E6：纯未知键被拒后盘须与种子档全等');
});
// 种子档 sha 基准（writeSeed 后固定串，E6 用）
function bytesFromSeed() {
  return createHash('sha256').update(JSON.stringify(SEED, null, 2)).digest('hex');
}

test('E7 op=add 拼错键同形收口（node-2 报备增补面：pre-fix 静默建出空提示词节点仍返回成功，域层 add 无未知键概念兜不住）', async () => {
  writeSeed();
  const before = bytes();
  const { err, res } = await runMutate({ op: 'add', parentId: 'lead', name: '受害者', sytemPrompt: 'TYPO-ADD' });
  assert.ok(err, `E7：未抛错→"${String(res).split('\n')[0]}" —— add 面同形残面复现（拼错键静默丢弃仍建节点报成功）`);
  assert.match(err.message, /未知字段/, `E7：异常应命中 /未知字段/，实际：${err.message}`);
  assert.ok(unknownPart(err.message).includes('sytemPrompt'), `E7：点名段应含 sytemPrompt，实际：${unknownPart(err.message)}`);
  assert.ok(!diskNodeByName('受害者'), 'E7：被拒后盘上不得留下「受害者」节点');
  assert.equal(bytes(), before, 'E7：add 面被拒后盘字节级零变化');
});

test('E8 门置于 op 分发之前：未知 op+未知键同现 → 点名键，域层「未知操作」不得抢跑（锁门位置，防未来把门下移回 op 分支）', async () => {
  writeSeed();
  const { err, res } = await runMutate({ op: 'frobnicate', bogusKey: 1 });
  assert.ok(err, `E8：未抛错→"${String(res).split('\n')[0]}" —— 门整体失效复现`);
  assert.ok(!err.message.includes('未知操作'), `E8：域层「未知操作」抢跑＝门未先于 op 分发（add/addEdge 等面会重新裸奔），实际：${err.message}`);
  assert.match(err.message, /未知字段/, `E8：应得工具面点名，实际：${err.message}`);
  assert.ok(unknownPart(err.message).includes('bogusKey'), `E8：点名段应含 bogusKey，实际：${unknownPart(err.message)}`);
});

test('E9 op=addEdge 面同门（op 全覆盖第二样张）：未知键必抛 + 边不生成 + 盘零变化', async () => {
  writeSeed();
  const before = bytes();
  const { err, res } = await runMutate({ op: 'addEdge', from: 'lead', to: 'node-w', kind: 'collab', knd: 'x' });
  assert.ok(err, `E9：未抛错→"${String(res).split('\n')[0]}" —— addEdge 面未知键被吞复现`);
  assert.match(err.message, /未知字段/, `E9：异常应命中 /未知字段/，实际：${err.message}`);
  assert.ok(unknownPart(err.message).includes('knd'), `E9：点名段应含 knd，实际：${unknownPart(err.message)}`);
  assert.equal(diskEdges().length, 0, 'E9：被拒后盘上不得留下边');
  assert.equal(bytes(), before, 'E9：addEdge 面被拒后盘字节级零变化');
});

test('B1 原型名类 own key（toString）必拒不退化为泛化（knownKeys 用 Object.keys own-keys 语义、入参含同名 own key 时不得经原型链漏网）', async () => {
  writeSeed();
  const { err, res } = await runMutate({ op: 'update', id: 'node-w', toString: 'evil' });
  assert.ok(err, `B1：未抛错→"${String(res).split('\n')[0]}" —— toString 类键经 knownKeys 漏网复现`);
  assert.match(err.message, /未知字段/, `B1：应得点名而非泛化，实际：${err.message}`);
  assert.ok(unknownPart(err.message).includes('toString'), `B1：点名段应含 toString，实际：${unknownPart(err.message)}`);
  assert.ok(!err.message.includes('未携带任何已知字段'), `B1：不得退化为泛化零键拒绝，实际：${err.message}`);
});

test('E10 点名文案的已知字段枚举 ≡ schema.properties 键集（单一事实源关系锁：schema 字段增减自动跟随，防双写漂移；不锚枚举字面全文）', async () => {
  writeSeed();
  const { err } = await runMutate({ op: 'update', id: 'node-w', zzz: 1 });
  assert.ok(err, 'E10：未知键 zzz 未抛 —— 门失效复现');
  const m = /（已知字段：([^）]*)）/.exec(err.message);
  assert.ok(m, `E10：文案应携带「（已知字段：…）」枚举段，实际：${err.message}`);
  assert.deepEqual(m[1].split('/'), Object.keys(mutateTool.parameters.properties),
    'E10：文案枚举与 schema.properties 键集不一致＝出现第二事实源（双写漂移），schema 演进将静默失控');
  assert.equal(mutateTool.parameters.additionalProperties, false, 'E10：schema additionalProperties:false 系既有声明，本门仅运行时兑现，声明不得移除');
});

test('E11 门对已知键面透明：未知 op 值仍由域层「未知操作」报错（门不越权抢报，其余域校验零回归）', async () => {
  writeSeed();
  const { err } = await runMutate({ op: 'frobnicate', id: 'node-w' });
  assert.ok(err, 'E11：未知 op 必须仍被拒（门透明≠放行）');
  assert.match(err.message, /未知操作/, `E11：纯已知键面应达域层「未知操作」，实际：${err.message}`);
});

// ============ H 组：金样零误伤（双树同绿；harness 正常调用面 + Web patchOf 同构面） ============

test('H1 金样：单已知键正常落盘（title→资深执行，sysPrompt 不动，成功前缀契约）', async () => {
  writeSeed();
  const { err, res } = await runMutate({ op: 'update', id: 'node-w', title: '资深执行' });
  assert.ok(!err, `H1：已知键正常调用被门误伤：${err?.message}`);
  assert.ok(String(res).startsWith('已更新节点 node-w'), `H1：成功文案前缀漂移：${String(res).slice(0, 40)}`);
  const n = diskNode('node-w');
  assert.equal(n.title, '资深执行');
  assert.equal(n.systemPrompt, 'OLD-PROMPT');
});

test('H2 金样：六已知键全带（Web client.js patchOf 同构面）零误伤 + 磁盘逐字段对账', async () => {
  writeSeed();
  const { err, res } = await runMutate({
    op: 'update', id: 'node-w',
    name: '工人B', title: 'T', systemPrompt: 'P',
    model: { provider: 'x' }, toolScope: { allow: ['a'], deny: [] }, maxTokens: 100,
  });
  assert.ok(!err, `H2：Web 六键全带面被门误伤：${err?.message}`);
  assert.ok(String(res).startsWith('已更新节点'), `H2：成功文案前缀漂移：${String(res).slice(0, 40)}`);
  const n = diskNode('node-w');
  assert.equal(n.name, '工人B');
  assert.equal(n.title, 'T');
  assert.equal(n.systemPrompt, 'P');
  assert.equal(n.model?.provider, 'x');
  assert.deepEqual(n.toolScope, { allow: ['a'], deny: [] });
  assert.equal(n.maxTokens, 100);
});
