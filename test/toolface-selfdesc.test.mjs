// V15-C/H-C3 常备门禁：org_mutate 工具「数值自述区间」与「域层合法区间」全等对账（G0/G2/I2）。
// 任务 id=mtn63ura-ldch（后端 node-2；口径源 = docs/OPS-V15-ARBITRATION-v1.md §5 V15-C / §7-C）。
//
// 缺陷回顾（DEF-EDGEKIND-1 同源第二例）：
//   lib/index.js org_mutate 的 maxTokens 参数自述曾硬编码「1..64000」，
//   而域层真值源 org.js LIMITS.maxTokens=1_000_000——自述上界窄于域层，
//   照自述理解上界的调用方被无谓劝退，且该数字是第二复制面（漂移温床）。
//   修复 = H-C1 org.js LIMITS 加 export（真值源单点）+ H-C2 index.js 自述改
//   `1..${LIMITS.maxTokens}` 模板串（消灭第二数字复制面），域层逻辑一字未动。
//
// 用例面 = 8 案：
//   G0  = 提取器自检（自写自验）：区间正则对标准/旧口径/无区间三类样张行为正确——
//         门禁自身失明的经典形态（正则匹配不到→断言空转恒绿）由本案封死。
//   G2a = 全等锚·下界合法侧：update(maxTokens=自述下界) 成功 + 磁盘回读对账。
//   G2b = 全等锚·上界合法侧：update(maxTokens=自述上界) 成功 + 磁盘回读对账
//         （自述若宽于域层，本案被域层拒绝即红）。
//   G2c = 越界必拒零落盘：update(自述上界+1) 与 update(自述下界-1) 均响亮抛错 + 盘字节零变动
//         （自述若窄于域层，上界+1 被域层静默接受并落盘即红——64000/1e6 口径差的直接显形）。
//   G2d = 自述区间下界声明必须 ≡ 1（与域层整数下限口径一致；拦「0..」类文案漂移）。
//   I2  = 隔离对账（自持基线写入，不依赖前案盘态）：全程只写 mkdtemp 重定向盘，
//         环境变量与 HOME 未被改写。
//
// 独立性纪律：本门禁 **不 import** org.js 的 LIMITS——判据「自述区间 ≡ 域层合法区间」
//   全靠 execute() 边界探针从运行时反推，门禁与实现不共享常量（同 edge-kind-lock R1
//   禁字面量复制的强化版；node-4 X1 实证漂移的机检固化）。
//
// 双向证据契约（同 QA-GATE1 / edge-kind-lock 口径）：本文件在 pre-fix 净树（HEAD=1e6319a，
//   schema 硬编码 1..64000）必红，预期红案恰为 {G2c}（64001 被域层 1..1_000_000 接受并落盘，
//   「上界+1 必抛」显形）；G0/G2a/G2b/G2d/I2 双侧同绿。fix 树必全绿。
//
// 隔离：DSH_AGENT_ORG_PATH 重定向 mkdtemp + HOME 双保险；桩节点含全量落盘字段（缺字段
//   成功路径 renderChart 抛错）。绝不触碰 ~/.dsh/agent-org 生产盘。
// 运行：npm test（= node --test）自动计入；同文件内顶层用例按声明顺序串行执行。
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------- 区间提取器（被检对象=G0；格式对旧口径同样可解析，漂移必须可见而非失明） ----------
function extractRange(text) {
  const m = typeof text === 'string' ? text.match(/(\d+)\.\.(\d+)/) : null;
  return m ? { lo: Number(m[1]), hi: Number(m[2]) } : null;
}

// ============ G0 提取器自检（自写自验，先于一切被检案） ============

test('G0a 提取器：标准样张 "integer 1..1000000 or null" → {lo:1,hi:1000000}', () => {
  assert.deepEqual(extractRange('op=update: integer 1..1000000 or null (= default).'), { lo: 1, hi: 1000000 });
});

test('G0b 提取器：旧口径样张 "1..64000" 同样可解析（漂移须可见，禁失明型假绿）', () => {
  assert.deepEqual(extractRange('op=update: integer 1..64000 or null (= default).'), { lo: 1, hi: 64000 });
});

test('G0c 提取器：无数值区间样张（含 "≤4000" 单值文案）→ null，不臆造区间', () => {
  assert.equal(extractRange('op=add: new node name.'), null);
  assert.equal(extractRange('message ≤4000 chars'), null);
  assert.equal(extractRange(undefined), null);
});

// ---------- 隔离盘 + 种子档（root + 单探针节点 u；全量落盘字段） ----------
const DIR = mkdtempSync(join(tmpdir(), 'qa-selfdesc-'));
const ORG_FILE = join(DIR, 'org.json');
process.env.DSH_AGENT_ORG_PATH = ORG_FILE;
process.env.HOME = DIR; // 双保险：即便重定向失效也碰不到真 ~/.dsh

const stub = (id, parentId, name, x) => ({
  id, parentId, name, title: '岗', model: null, systemPrompt: '',
  toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x, y: 150,
});
writeFileSync(ORG_FILE, JSON.stringify({
  schemaVersion: 2,
  orgs: [{
    id: 'org', name: '测试队', rootNodeId: 'lead',
    nodes: [stub('lead', null, '负责人', 60), stub('u-sd', 'lead', '探针', 100)],
    edges: [],
  }],
}, null, 2));
after(() => rmSync(DIR, { recursive: true, force: true }));

// ---------- 假 ctx 装载插件（与 edge-kind-lock / mount-selftest 同语义） ----------
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
const raw = () => readFileSync(ORG_FILE, 'utf8');
const diskNode = (id) => JSON.parse(raw()).orgs[0].nodes.find((n) => n.id === id);
async function expectThrows(promise, re, tag) {
  let err = null;
  try { await promise; } catch (e) { err = e; }
  assert.ok(err, `${tag}：预期抛错却静默成功`);
  assert.match(String(err?.message ?? err), re, `${tag}：报错文案不符：${err?.message ?? err}`);
  return err;
}

// 自述区间 = 注册 schema 实时文本经 G0 提取器所得；提取失败 = 硬红（禁空转恒绿）。
const descText = mutateTool.parameters?.properties?.maxTokens?.description;
const selfDesc = extractRange(descText);
assert.ok(selfDesc, `前置件：org_mutate.maxTokens 自述缺失或无法提取数值区间：${JSON.stringify(descText)}`);

// ============ G2 数值区间全等锚：自述声明区间 ≡ 域层合法区间（边界探针反推） ============

test(`G2d 自述下界声明 ≡ 1（域层整数下限口径）；实际自述="${descText}"`, () => {
  assert.equal(selfDesc.lo, 1, `自述下界非 1：${JSON.stringify(selfDesc)}`);
});

test(`G2a 自述下界合法：update(maxTokens=${selfDesc.lo}) 成功且磁盘回读一致`, async () => {
  await mutateTool.execute({ op: 'update', id: 'u-sd', maxTokens: selfDesc.lo });
  assert.equal(diskNode('u-sd').maxTokens, selfDesc.lo, '自述下界被域层拒绝或未落盘（自述宽于域层，硬红档）');
});

test(`G2b 自述上界合法：update(maxTokens=${selfDesc.hi}) 成功且磁盘回读一致`, async () => {
  await mutateTool.execute({ op: 'update', id: 'u-sd', maxTokens: selfDesc.hi });
  assert.equal(diskNode('u-sd').maxTokens, selfDesc.hi, '自述上界被域层拒绝或未落盘（自述宽于域层，硬红档）');
});

test(`G2c 越界必拒零落盘：update(${selfDesc.hi} + 1) 与 update(${selfDesc.lo} - 1) 均抛错（自述窄于域层在此显形）`, async () => {
  const before = raw();
  await expectThrows(mutateTool.execute({ op: 'update', id: 'u-sd', maxTokens: selfDesc.hi + 1 }),
    /maxTokens 必须是/, 'G2c-upper');
  assert.equal(raw(), before, `上界+1（${selfDesc.hi + 1}）被域层接受并落盘——域层合法上界高于自述，口径漂移`);
  await expectThrows(mutateTool.execute({ op: 'update', id: 'u-sd', maxTokens: selfDesc.lo - 1 }),
    /maxTokens 必须是/, 'G2c-lower');
  assert.equal(raw(), before, '下界-1 被域层接受并落盘');
});

// ============ I2 隔离终态对账 ============

test('I2 全程只写 mkdtemp 重定向盘；重定向与 HOME 未被改写；自持合法写入磁盘回读对账', async () => {
  assert.ok(ORG_FILE.startsWith(tmpdir()), `隔离目录未落在系统临时目录：${ORG_FILE}`);
  assert.equal(process.env.DSH_AGENT_ORG_PATH, ORG_FILE, '环境变量重定向被改写');
  assert.equal(process.env.HOME, DIR, 'HOME 隔离被改写');
  await mutateTool.execute({ op: 'update', id: 'u-sd', maxTokens: selfDesc.lo }); // 自持基线，不依赖前案盘态
  assert.equal(diskNode('u-sd').maxTokens, selfDesc.lo, '重定向盘写入-回读对账失败');
});
