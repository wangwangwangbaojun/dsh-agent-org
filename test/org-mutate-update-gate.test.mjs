// BUG-V14 常备门禁：org_mutate op=update 静默 no-op 修复的固化回归（QA-GATE1；现 23 案，构成见下）。
// 任务 id=mtn0evgj-nb8i（BUG-V14 线 mtlluww2-kkws 尾单）；源脚本 /tmp/bugv14-verify/verify.mjs（不入库，本文件即其固化形态）。
//
// 缺陷回顾（BUG-V14，修复见 commit 6a6e8ae）：
//   lib/org.js 的 update 分支读嵌套 request.patch（`const patch = request.patch ?? {}`），
//   而工具面 lib/index.js org_mutate 构造的是平铺 request → patch 恒空 →
//   op=update 任何字段（name/title/systemPrompt/model/toolScope/maxTokens）都不落盘，却返回成功文案；
//   连带的 B1/B2 校验防线（toolScope 冲突、maxTokens 越界）也被一并绕过——不报错、不落盘、假成功。
//   修复 = op=update 时把平铺字段按需打包进 request.patch，其余 op 零改动。
//
// 用例面 = 23 案（S4 计数勘误，源=评审函 mtncm3m3-hyzg 建议④；口径=实测，与 node --test 计数一致；
//   旧注记「18 案，编号与源脚本一一对应」系 off-by-one——所列编号实 17 枚，A5 不在源脚本编号集内；
//   关票通告曾引「19 案」亦误，HEAD 实测恒为 18。实构成为：源脚本 17 案 + 评审补案 1 案 + V14B-FIX2 补案 5 案）：
//   源脚本 17 案（A1 A2 A3 A4 A4b B1 B2 B3 B4 C1 C2 C3 C4 C5 C6 C7 D1），
//   外加评审补案 A5（代码评审意见 mtlk6288-eanw，四象限(c) patch非replace 唯一缺口，后插于 A4b 之后，不在源脚本编号集内），
//   外加 V14B-FIX2 补案 5 案（评审函 mtncm3m3-hyzg 建议①②③：S1a/S1b/S1c/S2/S3，后插于 D1 之后）：
//   A 组 = update 落盘对账（本票修复面）；B 组 = 校验防线不被绕过 + 报错路径零落盘；
//   C 组 = 其余 op（add/move/addEdge/removeEdge/layoutAll/delete）零回归；D1 = 数据文件隔离；
//   S 组 = V14B-FIX2 补面（model 形状归一化 / maxTokens null 复位 / args.org 跨 org 定位）。
//   全部断言走「工具面调用 → 磁盘回读对账」，不信返回值文案。
//   A4 为固化时的真断言改造（lead 裁定③）：源脚本里 check(..., async () => {}) 恒真；
//   固化初期判「不抛错 + 返回成功前缀 + 磁盘逐字段零变化」；后经 lead 票 mtnb4jm0-td72 换钉
//   （并入 BUG-V14B-3）：空入参成功返回＝BUG-V14 失败签名「返回成功但无操作」，A4 翻为
//   「必抛 + 磁盘逐字段零变化」。双向证据契约随之增补：换钉后的 A4 在 pre-fix 树亦入红集
//   （静默成功恰是新钉要拦的形状），原红案集合 A1 A2 A4b B1 B2 B4 只增不减。
//
// 双向证据契约（lead 验收②）：本文件在 pre-fix 净树（c162805 及更早）必红——
//   预期红案 A1 A2 A4b B1 B2 B4（静默 no-op 与校验被绕过的直接显形）；在 fix 树必绿。
//   A5（评审补案，象限(c) patch非replace）：pre-fix/post-fix 同绿——pre-fix 静默 no-op 下平凡通过，
//   其价值是拦截未来「部分字段更新顺带清空其余字段」的 replace 化回归；pre-fix 必红集合不变。
//   A5 誊抄勘误（QA 实测，评审意见 mtlk6288-eanw 系）：评审原文 assert.equal(n.title,'资深执行')
//   是 A2 磁盘写入的前置回声（pre-fix 下盘上仍为 '执行'），实测 c162805 成第 7 个派生红案，违反上句契约；
//   已改为「自给基线 + 纯不变式」两形态（另：纯快照形态会被更早的 A3 部分 patch 预先清空基线而失明，QA 变异实测）。
//
// 口径钉版说明（lead 裁定②；V15-C/H-C2 已收口）：maxTokens 唯一真值源 = org.js LIMITS.maxTokens=1..1_000_000，
//   tool schema 自述现为 `1..${LIMITS.maxTokens}` 模板串（旧硬编码副本 1..64000 已消灭，数值全等锚
//   由 test/toolface-selfdesc.test.mjs G2 承载）；故 B2 仍取全域非法的 99_999_999 做越界断言，不在 1e6 边界钉版。
//
// 隔离（lead 验收④）：DSH_AGENT_ORG_PATH 重定向到 mkdtemp 临时目录，绝不触碰 ~/.dsh/agent-org 生产盘。
// 运行：npm test（= node --test）自动计入；同文件内顶层用例按声明顺序串行执行。
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------- 隔离盘 + 种子档（同源脚本：1 组织，root=lead，子节点 node-w） ----------
const DIR = mkdtempSync(join(tmpdir(), 'qa-gate1-bugv14-'));
const ORG_FILE = join(DIR, 'org.json');
process.env.DSH_AGENT_ORG_PATH = ORG_FILE;

const SEED = {
  schemaVersion: 2,
  orgs: [{
    id: 'org', name: '测试队', rootNodeId: 'lead',
    nodes: [
      { id: 'lead', parentId: null, name: '负责人', title: '总体协调', model: null, systemPrompt: '', toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 60, y: 40 },
      { id: 'node-w', parentId: 'lead', name: '工人', title: '执行', model: '', systemPrompt: 'old-p', toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 100, y: 150 },
    ],
    edges: [],
  }, {
    // S3 跨 org 种子（V14B-FIX2）：activeOrg 缺省命中 orgs[0]，org-b 的节点必须靠 args.org 才寻得回。
    id: 'org-b', name: '二队', rootNodeId: 'b-lead',
    nodes: [
      { id: 'b-lead', parentId: null, name: '负责人B', title: '协调B', model: null, systemPrompt: '', toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 60, y: 40 },
      { id: 'b-node', parentId: 'b-lead', name: '工人B', title: '执行B', model: null, systemPrompt: '', toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 100, y: 150 },
    ],
    edges: [],
  }],
};
writeFileSync(ORG_FILE, JSON.stringify(SEED, null, 2));
const SEED_NODE_W = SEED.orgs[0].nodes[1];

// ---------- 假 ctx 装载插件（探测路径注册工具，同 mount-selftest / 源脚本语义） ----------
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

// ---------- 磁盘对账helpers：一切以回读磁盘为准 ----------
const disk = () => JSON.parse(readFileSync(ORG_FILE, 'utf8'));
const diskNode = (id) => disk().orgs[0].nodes.find((n) => n.id === id);
const diskNodeByName = (name) => disk().orgs[0].nodes.find((n) => n.name === name);
const diskEdges = () => disk().orgs[0].edges ?? [];

/** 负向用例：await 后必须拿到异常且消息命中 re；未抛错 = BUG-V14 静默 no-op 复现（校验被绕过）。 */
async function expectThrows(promise, re, label) {
  let err;
  try { await promise; } catch (e) { err = e; }
  assert.ok(err, `${label}：调用未抛错 —— BUG-V14 静默 no-op 复现（校验防线被绕过，非法入参被吞）`);
  assert.match(err.message, re, `${label}：异常消息应命中 ${re}，实际：${err.message}`);
}

after(() => { rmSync(DIR, { recursive: true, force: true }); });

// 跨用例留痕（顺序执行契约）：A2 返回值给 A3 判文案；C 组新增节点 id 给后续 op 用。
let retA2;
let addedId;
let added2Id;

// ============ A. op=update 核心落盘对账（BUG-V14 修复面；pre-fix 必红组） ============

test('A1 update(toolScope) 磁盘回读 deny=["org_mutate"]（BUG-V14 主案：不落盘即红）', async () => {
  await mutateTool.execute({ op: 'update', id: 'node-w', toolScope: { allow: [], deny: ['org_mutate'] } });
  const n = diskNode('node-w');
  assert.deepEqual(n.toolScope.deny, ['org_mutate'], 'op=update toolScope 未落盘（静默 no-op，BUG-V14）');
  assert.deepEqual(n.toolScope.allow, []);
});

test('A2 update(title/model/systemPrompt/maxTokens/name) 磁盘逐字段一致（BUG-V14 主案：不落盘即红）', async () => {
  retA2 = await mutateTool.execute({
    op: 'update', id: 'node-w',
    title: '资深执行', model: { model: 'deepseek-x' }, systemPrompt: 'new-p', maxTokens: 4096, name: '工人B',
  });
  const n = diskNode('node-w');
  assert.equal(n.title, '资深执行', 'op=update title 未落盘（静默 no-op，BUG-V14）');
  assert.deepEqual(n.model, { model: 'deepseek-x' });
  assert.equal(n.systemPrompt, 'new-p');
  assert.equal(n.maxTokens, 4096);
  assert.equal(n.name, '工人B');
});

test('A3 update 返回值口径不变（「已更新节点 node-w」前缀 + 架构图随文案返回）', async () => {
  assert.ok(typeof retA2 === 'string' && retA2.startsWith('已更新节点 node-w'), String(retA2).slice(0, 40));
  assert.ok(retA2.includes('架构图') || retA2.includes('负责人'), '返回值应带 renderChart 输出');
  // 幂等复核：同值重写一次，返回契约不漂移
  const ret2 = await mutateTool.execute({ op: 'update', id: 'node-w', title: '资深执行' });
  assert.ok(ret2.startsWith('已更新节点 node-w'), ret2.slice(0, 40));
});

test('A4 update 空入参：必抛（BUG-V14B-3 · lead 票 mtnb4jm0-td72 换钉）+ 磁盘零变化（空入参成功返回=V14 失败签名，禁再回潮）', async () => {
  const before = diskNode('node-w');
  // 旧钉（lead 裁定③「空入参=成功前缀」）已由 lead 票 mtnb4jm0-td72 并入 BUG-V14B-3 换钉为零键必抛。
  await expectThrows(mutateTool.execute({ op: 'update', id: 'node-w' }), /未携带任何已知字段/, 'A4·空入参静默成功复现（换钉面）');
  assert.deepEqual(diskNode('node-w'), before, '空入参被拒后磁盘发生任何字段漂移即红（零变化契约，throw-before-write）');
});

test('A4b update 空入参后磁盘字段仍为 A1/A2 终值（零变化契约的显形对账）', async () => {
  const n = diskNode('node-w');
  assert.equal(n.title, '资深执行', '空入参竟回滚了 title（fix 语义下不可能）');
  assert.equal(n.name, '工人B');
  assert.equal(n.maxTokens, 4096);
});

test('A5 update 部分字段 patch 不得顺带清空未打补丁字段（patch 非 replace 语义）', async () => {
  // 自给基线：一次多字段 patch 写入可区分值——被 patch 的字段在任何 patch/replace 语义下都会落盘，
  // 故基线值对 clean 树与 replace 化树同样成立；pre-fix 全 no-op 下基线=盘上旧值，同样成立。
  // 不能只靠快照吃 A1/A2 终值：replace 化下任何先于本案的部分 patch（A3）已把目标字段清成默认值，快照失明（QA 变异实测）。
  await mutateTool.execute({ op: 'update', id: 'node-w', systemPrompt: 'a5-baseline-p', model: { model: 'a5-baseline-m' } });
  const before = diskNode('node-w');
  // 同值 title 单字段 patch（评审原案形态；title 不动，不破坏 B4 对 title 的下游断言）。
  await mutateTool.execute({ op: 'update', id: 'node-w', title: '资深执行' });
  const n = diskNode('node-w');
  // 评审原文首行为 assert.equal(n.title, '资深执行')——A2 写盘的前置回声，pre-fix 必红（见文件头勘误注记）。
  // 全案只判「相对 before 零位移」：pre-fix（全 no-op）平凡绿，clean 树（patch 语义）绿，replace 化回归必红。
  assert.equal(n.title, before.title, 'title 同值 patch 不得改动 title 自身');
  for (const f of ['name', 'systemPrompt', 'model', 'toolScope', 'maxTokens', 'x', 'y', 'layout', 'parentId', 'id']) {
    assert.deepEqual(n[f], before[f], `未打补丁字段 ${f} 在部分字段 patch 下变化 → patch 被实现成 replace`);
  }
});

// ============ B. 校验防线不被绕过（B1/B2 = BUG-V14 静默 no-op 缺陷案，lead 点名必含；pre-fix 必红） ============

test('B1 toolScope allow/deny 冲突仍报错（BUG-V14 缺陷案：pre-fix 被静默吞掉不抛错）', async () => {
  await expectThrows(
    mutateTool.execute({ op: 'update', id: 'node-w', toolScope: { allow: ['x'], deny: ['x'] } }),
    /冲突/, 'B1',
  );
});

test('B2 maxTokens 越界仍报错（BUG-V14 缺陷案：pre-fix 被静默吞掉不抛错；取两口径外值，边界不钉版）', async () => {
  await expectThrows(
    mutateTool.execute({ op: 'update', id: 'node-w', maxTokens: 99_999_999 }),
    /maxTokens/, 'B2',
  );
});

test('B3 节点不存在仍报错（update 路径未知 id 拒绝）', async () => {
  await expectThrows(
    mutateTool.execute({ op: 'update', id: 'no-such-node', title: 'x' }),
    /节点不存在/, 'B3',
  );
});

test('B4 报错路径零落盘（B1/B2/B3 后磁盘仍为 A1/A2 终值）', async () => {
  const n = diskNode('node-w');
  assert.equal(n.title, '资深执行');
  assert.equal(n.maxTokens, 4096);
  assert.deepEqual(n.toolScope.deny, ['org_mutate']);
});

// ============ C. 其余 op 零回归（add/move/addEdge/removeEdge/layoutAll/delete） ============

test('C1 add 落盘（平铺路径回归，修复未波及 add）', async () => {
  await mutateTool.execute({ op: 'add', parentId: 'lead', name: '新丁', title: '实习', systemPrompt: 'sp', toolScope: { allow: [], deny: ['org_delete'] } });
  const added = diskNodeByName('新丁');
  assert.ok(added, 'add 后磁盘无新节点');
  addedId = added.id;
  assert.deepEqual(added.toolScope.deny, ['org_delete']);
  assert.equal(added.parentId, 'lead');
});

test('C2 move 落盘', async () => {
  await mutateTool.execute({ op: 'move', id: 'node-w', newParentId: addedId });
  assert.equal(diskNode('node-w').parentId, addedId);
});

test('C3 addEdge 落盘', async () => {
  await mutateTool.execute({ op: 'add', parentId: 'lead', name: '新丁2' });
  const added2 = diskNodeByName('新丁2');
  assert.ok(added2);
  added2Id = added2.id;
  await mutateTool.execute({ op: 'addEdge', from: addedId, to: added2Id, kind: 'collab' });
  assert.equal(diskEdges().length, 1);
});

test('C4 removeEdge 落盘', async () => {
  const edgeId = diskEdges()[0].id;
  await mutateTool.execute({ op: 'removeEdge', id: edgeId });
  assert.equal(diskEdges().length, 0);
});

test('C5 layoutAll 成功返回且数据文件仍可解析', async () => {
  await mutateTool.execute({ op: 'layoutAll' });
  assert.ok(diskNode('lead'));
});

test('C6 delete 子树落盘（confirm:true，含被移入的 node-w）', async () => {
  await mutateTool.execute({ op: 'delete', id: addedId, confirm: true });
  assert.ok(!diskNode(addedId), '被删节点仍在盘上');
  assert.ok(!diskNode('node-w'), '子节点应随子树删除');
});

test('C7 delete 缺 confirm 仍拒绝（工具层显式确认护栏）', async () => {
  await expectThrows(mutateTool.execute({ op: 'delete', id: 'lead' }), /confirm/, 'C7');
});

// ============ D. 隔离面 ============

test('D1 全程数据文件只落在 mkdtemp 临时目录（生产盘零接触）', async () => {
  assert.ok(ORG_FILE.startsWith(tmpdir()), `隔离目录未落在系统临时目录：${ORG_FILE}`);
  assert.equal(process.env.DSH_AGENT_ORG_PATH, ORG_FILE, '环境变量重定向被改写');
  // 磁盘终态与 C6 后语义一致 → 所有写入都发生在重定向文件上
  // （C6 只删 新丁 子树：addedId 与随子树没掉的 node-w 必须消失；新丁2 挂 lead 下，按语义仍在盘上）
  const doc = disk();
  assert.ok(doc.orgs[0].nodes.some((n) => n.id === 'lead'));
  assert.ok(!doc.orgs[0].nodes.some((n) => n.id === addedId || n.id === 'node-w'), 'C6 子树删除未反映在隔离盘上');
  assert.ok(doc.orgs[0].nodes.some((n) => n.id === added2Id), '新丁2 不应被牵连删除');
  assert.deepEqual(doc.orgs[0].edges, []);
});

// ============ S. V14B-FIX2 补面（评审函 mtncm3m3-hyzg 建议①②③；team 票 v14b-fix2-impl） ============
// S1 = 工具边界 model 形状归一化：string→{model}、对象原样透传、undefined 零触碰（防 replace 化）；
// S2 = maxTokens 显式 null 复位承诺固化（schema「integer … or null (= default)」）；
// S3 = args.org 跨 org 定位：显式指定非 active org 的 update 落目标 org，默认 org 字节零漂移。
// 双向证据契约（lead 规格函 mto90y8p-8kmk 红绿契约）：修复前 HEAD 必红案=S1a——现 HEAD（f06d9d6）
//   上 string 入参经 sanitizeModel fail-fast 响亮抛（BUG-V14B-1 把旧「静默吞 {} 仍报成功」升格，
//   评审函记的「清空为 {} 返成功」系 6a6e8ae 时点形态），两种形态同违「归一化落盘」承诺，同判红；
//   S1b/S1c/S2/S3 系既有行为固化案，修复前后同绿。落 S1 归一化后 23/23 全绿。
// 目标节点=新丁2（added2Id，C6 后仍在盘）；S3 走 SEED 第二组织 org-b。磁盘回读口径，不信返回文案。

test('S1a update model:string 归一化落盘 → 盘上 {model:"deepseek-v3"}（V14B-FIX2·S1·修复前必红案）', async () => {
  await mutateTool.execute({ op: 'update', id: added2Id, model: 'deepseek-v3' });
  assert.deepEqual(diskNode(added2Id).model, { model: 'deepseek-v3' }, 'string model 未归一化为 {model:string}（修复前形态：sanitizeModel 抛/旧版静默吞 {}）');
});

test('S1b update model:object 三键（fallback:null）原样透传 → 盘上 {provider:"p",model:"m"}（V14B-FIX2·S1）', async () => {
  await mutateTool.execute({ op: 'update', id: added2Id, model: { provider: 'p', model: 'm', fallback: null } });
  // 「原样」= 工具边界不包裹不破坏对象（若被 string 分支误包裹，model 子键成对象必撞 subfield-lock 响亮抛）；
  // null 子键＝空面（沿用宿主默认），由域层 sanitizeModel 省略——test/bugv14b-model-subfield-lock 同源口径。
  assert.deepEqual(diskNode(added2Id).model, { provider: 'p', model: 'm' });
});

test('S1c update 不带 model（undefined）→ 盘上既有 model 零变动（V14B-FIX2·S1·防未来 replace 化）', async () => {
  const before = diskNode(added2Id).model;
  assert.deepEqual(before, { provider: 'p', model: 'm' }, '前置件：S1b 已写入可区分基线');
  await mutateTool.execute({ op: 'update', id: added2Id, title: 'S1c-title' });
  const n = diskNode(added2Id);
  assert.equal(n.title, 'S1c-title', 'title 未落盘（update 本体失效，model 不变式失明）');
  assert.deepEqual(n.model, before, 'model 在未携带 model 键的 patch 下漂移 → 打包层被 replace 化');
});

test('S2 update maxTokens 4096→回读 4096，再 null→盘上复位 null（V14B-FIX2·S2 锁 schema null 复位承诺）', async () => {
  await mutateTool.execute({ op: 'update', id: added2Id, maxTokens: 4096 });
  assert.equal(diskNode(added2Id).maxTokens, 4096, 'maxTokens=4096 未落盘');
  await mutateTool.execute({ op: 'update', id: added2Id, maxTokens: null });
  assert.equal(diskNode(added2Id).maxTokens, null, 'maxTokens 显式 null 复位未落盘（schema「or null (= default)」承诺被破坏）');
});

test('S3 args.org 显式指定非 active org 做 update → 目标 org 盘上生效、默认 org 字节零漂移（V14B-FIX2·S3）', async () => {
  const beforeDefault = JSON.stringify(disk().orgs[0]);
  // b-node 仅存在于 org-b：args.org 若被丢弃，activeOrg=orgs[0] 寻不回 → 「节点不存在」抛（红形态）
  await mutateTool.execute({ op: 'update', org: 'org-b', id: 'b-node', title: '跨org改' });
  const b = disk().orgs[1].nodes.find((n) => n.id === 'b-node');
  assert.equal(b.title, '跨org改', 'update 未落在 args.org 指定组织（跨 org 定位失效）');
  assert.equal(JSON.stringify(disk().orgs[0]), beforeDefault, '默认 org 发生字节级漂移（跨 org 定位零连带契约）');
});
