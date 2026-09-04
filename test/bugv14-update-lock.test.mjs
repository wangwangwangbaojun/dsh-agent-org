// BUG-V14 工具面回归锁（QA-V14-R，任务 id=mtnbem77-bhq0，lead 派单）。
// 与 QA-GATE1（org-mutate-update-gate.test.mjs，18 案混编）的分工：本档 = 六字段逐字段锁死
//   （QA-GATE1 的 A2 为五字段合并案，缺单字段粒度——单字段回归漂移在合并案下可被掩盖），
//   外加 B1/B2 实抛+盘零写入逐案锁与双向证据契约。两档并存、零 import 交叉、互不引用。
//
// 缺陷回顾（BUG-V14，修复 commit 6a6e8ae，父树 c162805）：
//   lib/org.js update 分支读嵌套 request.patch（`request.patch ?? {}`），工具面 org_mutate
//   构造平铺 request → patch 恒空 → op=update 任何字段不落盘却返回成功；B1（toolScope
//   allow/deny 冲突）/ B2（maxTokens 越界）校验在工具面从未触发。
//
// 硬性口径（任务原文逐条落位）：
//   ① 唯一入口 = createTools() 的 org_mutate.execute()：经 apply(ctx) 探测路径注册后取
//      tools.get('org_mutate')，与 mount-selftest/QA-GATE1 同构；直调 lib/org.js mutate 不算数。
//      落盘断言 = DSH_AGENT_ORG_PATH 重定向 mkdtemp(/tmp) 隔离档，写后 readFileSync 回读对账。
//   ② 正向锁 = 本文件 P 组：name/title/systemPrompt/model/toolScope/maxTokens 六字段逐字段
//      各 ≥1 案（P1–P6）+ 六字段合并案（P8），全部断言真实落盘而非返回文案。
//   ③ B1 = E1/E2，B2 = G 组（参数化），execute() 实抛 + org.json 字节级零漂移。
//      ⚠ 64001 / 1e6 两值不锁：lead 裁定②（QA-GATE1 头注）与在库仲裁 docs/OPS-V15-ARBITRATION-v1.md
//      H-C1/H-C2 已钉死口径——LIMITS.maxTokens=1..1_000_000 为唯一真值源，schema 自述
//      「1..64000」系漂移副本（V15-C 将改为 1..${LIMITS.maxTokens} 模板串）。锁「64001 必抛」
//      = 锁定将被 V15-C 宣判为错值的旧口径，与本票第⑤条防红绿互撞原则同类；实测取证以一次性
//      探针脚本另行完成（不入本文件），结果随 QA-V14-R 报告投 lead。
//   ⑤ 禁锁面：空 patch / 未知键 patch 语义（BE-V14B 在途 + QA-GATE1 A4 冻结钉）——本文件
//      零用例、零注释锚，该面完全静默，候 QA-V14B 翻转票。
//
// 双向证据契约（lead 验收④）：本文件注入 6a6e8ae^（c162805）pristine 缺陷树同构运行——
//   预期红集 = 全部 update 面用例：P1–P9（显形为「返回成功但盘零写入」断言）+ E1/E2 + G 组
//   （显形为「校验被静默吞掉不抛错」断言）；预期绿集 = C1/C2/C3（add/delete/layoutAll 对照，
//   缺陷期即正常）+ I1（隔离自证）。fix 树（含 6a6e8ae 及其后续）全绿。
//
// 运行：npm test（node --test）自动计入；单档 = node --test test/bugv14-update-lock.test.mjs；
// 单案复现 = node --test --test-name-pattern='<案名前缀>' test/bugv14-update-lock.test.mjs。
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// ---------- 隔离盘 + 种子档（每案独立靶节点，用例间零顺序依赖） ----------
const DIR = mkdtempSync(join(tmpdir(), 'qa-v14r-lock-'));
const ORG_FILE = join(DIR, 'org.json');
process.env.DSH_AGENT_ORG_PATH = ORG_FILE;

const mkNode = (id, parentId, name, title, extra = {}) => ({
  id, parentId, name, title, model: {}, systemPrompt: '',
  toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 80, y: 140, ...extra,
});
const SEED = {
  schemaVersion: 2,
  orgs: [{
    id: 'org', name: '锁验队', rootNodeId: 'lead',
    nodes: [
      mkNode('lead', null, '负责人', '总体协调', { x: 60, y: 40 }),
      mkNode('u-name', 'lead', '改名靶', '靶职位'),
      mkNode('u-title', 'lead', '改职靶', '旧职位'),
      mkNode('u-sp', 'lead', '提示靶', '靶职位', { systemPrompt: 'old-p' }),
      mkNode('u-model', 'lead', '模型靶', '靶职位'),
      mkNode('u-scope', 'lead', '工具靶', '靶职位'),
      mkNode('u-mtok', 'lead', '额度靶', '靶职位'),
      mkNode('u-mtnull', 'lead', '清额靶', '靶职位', { maxTokens: null }),
      mkNode('u-mt1', 'lead', '下界靶', '靶职位'),
      mkNode('u-multi', 'lead', '合并靶', '旧职', { systemPrompt: 'old-p' }),
      mkNode('u-err', 'lead', '校验靶', '靶职位'),
    ],
    edges: [],
  }],
};
writeFileSync(ORG_FILE, JSON.stringify(SEED, null, 2));

// ---------- 假 ctx 装载插件，取 createTools() 注册的 org_mutate（唯一入口，任务口径①） ----------
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
assert.ok(mutateTool, '前置件：org_mutate 未注册，锁面失效');
const execute = (args) => mutateTool.execute(args);

// ---------- 磁盘对账 helpers（任务口径①：写后读回，不信返回文案） ----------
const disk = () => JSON.parse(readFileSync(ORG_FILE, 'utf8'));
const diskNode = (id) => disk().orgs[0].nodes.find((n) => n.id === id);
const diskBytes = () => readFileSync(ORG_FILE, 'utf8');

/** 负向原语：必须实抛且消息命中 re；未抛错 = BUG-V14 静默吞（校验防线被绕过）。 */
async function expectThrows(promise, re, label) {
  let err;
  try { await promise; } catch (e) { err = e; }
  assert.ok(err, `${label}：execute() 未抛错 —— BUG-V14 复现（非法入参被静默吞，校验防线未触发）`);
  assert.match(err.message, re, `${label}：异常消息应命中 ${re}，实际：${err.message}`);
}

after(() => { rmSync(DIR, { recursive: true, force: true }); });

// ============ P. 正向锁：op=update 逐字段真实落盘（缺陷期「返回成功×盘零写入」直接显形组） ============

test('P1 update(name) 单字段落盘：盘零写入即红（BUG-V14 主锁）', async () => {
  const ret = await execute({ op: 'update', id: 'u-name', name: 'QA改名落盘' });
  assert.match(String(ret), /^已更新节点 u-name/, '返回文案契约漂移');
  assert.equal(diskNode('u-name').name, 'QA改名落盘', 'BUG-V14 复现：update 返回成功但 name 盘零写入（静默 no-op）');
});

test('P2 update(title) 单字段落盘：盘零写入即红', async () => {
  await execute({ op: 'update', id: 'u-title', title: 'QA职衔落盘' });
  assert.equal(diskNode('u-title').title, 'QA职衔落盘', 'BUG-V14 复现：title 盘零写入（静默 no-op）');
});

test('P3 update(systemPrompt) 单字段落盘：盘零写入即红', async () => {
  await execute({ op: 'update', id: 'u-sp', systemPrompt: 'qa-v14r-prompt-落盘' });
  assert.equal(diskNode('u-sp').systemPrompt, 'qa-v14r-prompt-落盘', 'BUG-V14 复现：systemPrompt 盘零写入（静默 no-op）');
});

test('P4 update(model 三键对象) 单字段落盘：盘零写入即红', async () => {
  await execute({ op: 'update', id: 'u-model', model: { provider: 'provA', model: 'deepseek-chat', fallback: 'provB' } });
  assert.deepEqual(diskNode('u-model').model, { provider: 'provA', model: 'deepseek-chat', fallback: 'provB' },
    'BUG-V14 复现：model 盘零写入（静默 no-op）');
});

test('P5 update(toolScope 非冲突 allow/deny) 单字段落盘：盘零写入即红', async () => {
  await execute({ op: 'update', id: 'u-scope', toolScope: { allow: ['read', 'grep'], deny: ['subagent'] } });
  assert.deepEqual(diskNode('u-scope').toolScope, { allow: ['read', 'grep'], deny: ['subagent'] },
    'BUG-V14 复现：toolScope 盘零写入（静默 no-op）');
});

test('P6 update(maxTokens=64000 两口径公共合法值) 单字段落盘：盘零写入即红', async () => {
  await execute({ op: 'update', id: 'u-mtok', maxTokens: 64_000 });
  assert.equal(diskNode('u-mtok').maxTokens, 64_000, 'BUG-V14 复现：maxTokens 盘零写入（静默 no-op）');
});

test('P7 update(maxTokens=null) 清位落盘（自给基线：先写 4096 再清 null）', async () => {
  await execute({ op: 'update', id: 'u-mtnull', maxTokens: 4096 });
  assert.equal(diskNode('u-mtnull').maxTokens, 4096, 'BUG-V14 复现：基线写入 maxTokens=4096 盘零写入（静默 no-op）');
  await execute({ op: 'update', id: 'u-mtnull', maxTokens: null });
  const n = diskNode('u-mtnull');
  assert.equal(n.maxTokens, null, 'maxTokens=null 清位未落盘');
  assert.equal(n.title, '靶职位', 'null 清位顺带漂移未打补丁字段');
});

test('P8 update 六字段合并单调用：全部落盘 + 未打补丁字段零位移（patch 非 replace）', async () => {
  const before = diskNode('u-multi');
  await execute({
    op: 'update', id: 'u-multi',
    name: '合并改名', title: '合并改职', systemPrompt: 'multi-p',
    model: { model: 'merge-m' }, toolScope: { allow: ['read'], deny: ['bash'] }, maxTokens: 32_000,
  });
  const n = diskNode('u-multi');
  assert.equal(n.name, '合并改名', 'BUG-V14 复现：合并 update name 盘零写入');
  assert.equal(n.title, '合并改职', 'BUG-V14 复现：合并 update title 盘零写入');
  assert.equal(n.systemPrompt, 'multi-p', 'BUG-V14 复现：合并 update systemPrompt 盘零写入');
  assert.deepEqual(n.model, { model: 'merge-m' }, 'BUG-V14 复现：合并 update model 盘零写入');
  assert.deepEqual(n.toolScope, { allow: ['read'], deny: ['bash'] }, 'BUG-V14 复现：合并 update toolScope 盘零写入');
  assert.equal(n.maxTokens, 32_000, 'BUG-V14 复现：合并 update maxTokens 盘零写入');
  for (const f of ['id', 'parentId', 'x', 'y', 'layout']) {
    assert.deepEqual(n[f], before[f], `未打补丁字段 ${f} 在 update 下位移`);
  }
});

test('P9 update(maxTokens=1 合法下界) 边界落盘：盘零写入即红', async () => {
  await execute({ op: 'update', id: 'u-mt1', maxTokens: 1 });
  assert.equal(diskNode('u-mt1').maxTokens, 1, 'BUG-V14 复现：maxTokens=1 盘零写入（静默 no-op）');
});

// ============ E/G. 校验防线实抛锁（B1/B2 点名案；缺陷期校验被 patch 恒空绕过 = 必红组） ============

test('E1 B1 toolScope allow/deny 单点冲突 execute() 实抛 + 盘字节零写入', async () => {
  const before = diskBytes();
  await expectThrows(
    execute({ op: 'update', id: 'u-err', toolScope: { allow: ['org_chart'], deny: ['org_chart'] } }),
    /冲突/, 'E1/B1',
  );
  assert.equal(diskBytes(), before, 'B1 报错后 org.json 发生字节漂移（报错路径零写入契约违例）');
});

test('E2 B1 toolScope allow/deny 多点交集 execute() 实抛 + 盘字节零写入', async () => {
  const before = diskBytes();
  await expectThrows(
    execute({ op: 'update', id: 'u-err', toolScope: { allow: ['a', 'b', 'c'], deny: ['c', 'b', 'z'] } }),
    /冲突/, 'E2/B1',
  );
  assert.equal(diskBytes(), before, 'B1（多点交集）报错后 org.json 发生字节漂移');
});

// B2 值集 = 两口径（schema 旧自述 1..64000 与域层真值 1..1_000_000）之下皆非法之值，
// 任意口径演进下断言恒成立；64001/1e6 属口径争议面，见文件头注③，零锁。
const B2_BAD = [
  { label: '零值0', value: 0 },
  { label: '负值-7', value: -7 },
  { label: '非整数1.5', value: 1.5 },
  { label: '两口径外99999999', value: 99_999_999 },
  { label: '字符串1024', value: '1024' },
  { label: 'NaN', value: NaN },
];
for (const [i, c] of B2_BAD.entries()) {
  test(`G${i + 1} B2 maxTokens=${c.label} execute() 实抛 + 盘字节零写入`, async () => {
    const before = diskBytes();
    await expectThrows(execute({ op: 'update', id: 'u-err', maxTokens: c.value }), /maxTokens/, `G${i + 1}/B2`);
    assert.equal(diskBytes(), before, `B2（${c.label}）报错后 org.json 发生字节漂移（报错路径零写入契约违例）`);
  });
}

// ============ C. 非 update 对照（缺陷期即正常 → pristine 与 fix 双树同绿，证门禁非盲目全红） ============

test('C1 对照：op=add 平铺路径落盘（双树同绿）', async () => {
  await execute({ op: 'add', parentId: 'lead', name: '对照丁', title: '实习', toolScope: { allow: [], deny: ['org_delete'] } });
  const added = disk().orgs[0].nodes.find((n) => n.name === '对照丁');
  assert.ok(added, 'add 后盘上无新节点');
  assert.equal(added.parentId, 'lead');
  assert.deepEqual(added.toolScope.deny, ['org_delete']);
});

test('C2 对照：op=delete confirm 子树落盘（双树同绿）', async () => {
  const added = disk().orgs[0].nodes.find((n) => n.name === '对照丁');
  await execute({ op: 'delete', id: added.id, confirm: true });
  assert.ok(!diskNode(added.id), 'delete 后节点仍在盘上');
});

test('C3 对照：op=layoutAll 成功且盘仍可解析（双树同绿）', async () => {
  const ret = await execute({ op: 'layoutAll' });
  assert.match(String(ret), /^已自动排布架构/);
  assert.ok(diskNode('lead'));
});

// ============ I. 隔离自证 ============

test('I1 隔离：全程仅写 DSH_AGENT_ORG_PATH 指向的 mkdtemp 档，终态落 /tmp', async () => {
  assert.ok(DIR.startsWith(tmpdir()) && DIR.startsWith('/tmp'), `隔离目录未落 /tmp：${DIR}`);
  assert.equal(process.env.DSH_AGENT_ORG_PATH, ORG_FILE, '环境变量重定向被改写');
  const doc = disk(); // 终态可解析 = 全部写入收敛于隔离档
  assert.ok(doc.orgs[0].nodes.some((n) => n.id === 'lead'));
  assert.ok(!doc.orgs[0].nodes.some((n) => n.name === '对照丁'), 'C2 删除未反映于隔离盘（写入逃逸嫌疑）');
});
