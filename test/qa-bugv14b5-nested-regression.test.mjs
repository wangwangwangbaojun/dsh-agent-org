// QA-V14B5 回归（测试工程师独立复核，源任务 mtofpc37-gsky｜裁决 ADJ-V14B-NESTED@5c36db7·修复 BUG-V14B-5@c2f62aa）
// 本件≠实现方金样 bugv14b-nested-keys.test.mjs 的复读，独立覆盖验收 A1-A5 的差异化视角：
//  · A1 逐面盘级零写入（实现方为三面合并比对，本件逐面 byte 比对＋结构计数）；
//  · A2 双未知键同文案全点名＋合法键不部分生效（model 面）；
//  · A3 安全锚＝节点既有受限面 {allow:['read']} 在 {alow} 拼错下必抛且限制不放开（实现方仅覆盖空面案型）；
//  · A4 等旧补钉＝addOrg 成功路径（实现方金样零涉 addOrg 正路径）、update 面 model 整单替换语义、
//    sanitizeScope 重构后 allow/deny 冲突门不破、非纯对象 toolScope 空面零误杀（裁定明令零扩大打击面）；
//  · 边界门据=键非值（{provder:undefined} 必抛）、大小写敏感（{Provider} 必抛）。
// 分类：QA-P*=正常路径；QA-B*=边界；QA-E*=错误路径。跑法：node --test test/qa-bugv14b5-nested-regression.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sand = mkdtempSync(join(tmpdir(), 'qa-v14b5-'));
process.env.DSH_AGENT_ORG_PATH = join(sand, 'org.json');
const { apply } = await import('../lib/index.js');
const { loadOrg, mutate, OrgError } = await import('../lib/org.js');

const tools = [];
const ctx = {
  systemPrompt: { section: () => () => {} },
  effect: (fn) => fn(),
  reflect: { get: (s) => (s === 'tools' ? { register: (t) => { if (!tools.some((x) => x.name === t.name)) tools.push(t); } } : undefined) },
  on: () => {},
};
apply(ctx, {});
const mutateTool = tools.find((t) => t.name === 'org_mutate');

const lead = { id: 'lead', parentId: null, name: '负责人', title: '', systemPrompt: '', model: {}, toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 60, y: 40 };
// w1 携带既有受限工具面＝A3 安全锚载体：静默放开路径下 {allow:['read']} 会被抹成 {allow:[],deny:[]}＝不限工具面
const w1 = { id: 'w1', parentId: 'lead', name: '工人一', title: '', systemPrompt: '', model: {}, toolScope: { allow: ['read'], deny: [] }, maxTokens: null, layout: null, x: 120, y: 120 };
const seed = () => writeFileSync(process.env.DSH_AGENT_ORG_PATH, JSON.stringify({
  schemaVersion: 2,
  orgs: [{ id: 'o1', name: '一部', rootNodeId: 'lead', edges: [], nodes: [structuredClone(lead), structuredClone(w1)] }],
  updatedAt: '2026-09-05T00:00:00.000Z',
}));
seed();
const disk = () => readFileSync(process.env.DSH_AGENT_ORG_PATH, 'utf8');
const doc = () => loadOrg(process.env.DSH_AGENT_ORG_PATH);
const nodeOf = (id) => doc().orgs[0].nodes.find((n) => n.id === id);

// ───────────────────────── 正常路径（A4 正路径零回归） ─────────────────────────
test('QA-P01 正常：add 面合法三键 model＋全键 toolScope——逐字段修剪落盘（trim／空 fallback 省略）', async () => {
  seed();
  await mutateTool.execute({ op: 'add', parentId: 'lead', name: '正甲', model: { provider: ' dp ', model: 'deepseek-chat', fallback: '' }, toolScope: { allow: ['bash'], deny: ['write'] } }, ctx);
  const n = doc().orgs[0].nodes.find((x) => x.name === '正甲');
  assert.deepEqual(n.model, { provider: 'dp', model: 'deepseek-chat' }, 'trim＋空串省略＝等旧逐字段修剪');
  assert.deepEqual(n.toolScope, { allow: ['bash'], deny: ['write'] }, '合法两键键名原样落盘');
});

test('QA-P02 正常：update 面 model 整单替换语义等旧（非 merge）＋半键 toolScope 修剪', async () => {
  seed();
  await mutateTool.execute({ op: 'update', id: 'w1', model: { provider: 'p1', model: 'm1' } }, ctx);
  await mutateTool.execute({ op: 'update', id: 'w1', model: { model: 'm2' } }, ctx);
  assert.deepEqual(nodeOf('w1').model, { model: 'm2' }, 'update 面整单替换（provider 不残留）＝v14b-fix2 终态语义等旧');
  await mutateTool.execute({ op: 'update', id: 'w1', toolScope: { deny: ['edit'] } }, ctx);
  assert.deepEqual(nodeOf('w1').toolScope, { allow: [], deny: ['edit'] }, '半键修剪等旧：缺 allow＝空面');
});

test('QA-P03 正常：addOrg 合法 model 成功路径（实现方金样未覆盖的正路径）', async () => {
  seed();
  const before = disk();
  await mutateTool.execute({ op: 'addOrg', name: '二部', model: { provider: 'pv', fallback: 'fb' } }, ctx);
  const d = doc();
  assert.equal(d.orgs.length, 2, 'addOrg 正路径必成功');
  const root = d.orgs[1].nodes.find((n) => n.parentId === null);
  assert.deepEqual(root.model, { provider: 'pv', fallback: 'fb' }, 'addOrg 根 model 同函数修剪落盘');
  assert.notEqual(disk(), before, '正路径必落盘（与必抛面盘零写入互证门位同点）');
});

// ───────────────────────── 边界（门不误伤＋门据=键非值） ─────────────────────────
test('QA-B01 边界：model 等旧四形态（缺省/null/空串/{}）仍产出 {} 宿主默认标记', () => {
  seed();
  const d = doc();
  mutate(d, { op: 'add', parentId: 'lead', name: 'b1' });
  mutate(d, { op: 'add', parentId: 'lead', name: 'b2', model: null });
  mutate(d, { op: 'add', parentId: 'lead', name: 'b3', model: '' });
  mutate(d, { op: 'add', parentId: 'lead', name: 'b4', model: {} });
  for (const nm of ['b1', 'b2', 'b3', 'b4'])
    assert.deepEqual(d.orgs[0].nodes.find((x) => x.name === nm).model, {}, `${nm} 四形态等旧={}`);
});

test('QA-B02 边界：门据=键非值——未知键值为 undefined 仍必抛（禁 undefined 值逃逸白名单）', async () => {
  seed();
  const before = disk();
  await assert.rejects(
    mutateTool.execute({ op: 'update', id: 'w1', model: { provder: undefined } }, ctx),
    (e) => e instanceof OrgError && /provder/.test(e.message),
    '{provder:undefined} Object.keys 在列＝必抛（键集判定不因值缺席软化）',
  );
  assert.equal(disk(), before);
});

test('QA-B03 边界：白名单大小写严格——{Provider} 必抛（禁 case-insensitive 宽容复活静默面）', async () => {
  seed();
  const before = disk();
  await assert.rejects(
    mutateTool.execute({ op: 'add', parentId: 'lead', name: '大写甲', model: { Provider: 'x' } }, ctx),
    (e) => e instanceof OrgError && /Provider/.test(e.message),
  );
  assert.equal(disk(), before, '必抛路径盘零写入');
});

test('QA-B04 边界：非纯对象 toolScope（字符串/数组）等旧走空面——门零扩大打击面（终裁明令）', async () => {
  seed();
  await mutateTool.execute({ op: 'add', parentId: 'lead', name: '串scope', toolScope: 'read' }, ctx);
  await mutateTool.execute({ op: 'add', parentId: 'lead', name: '组scope', toolScope: ['read'] }, ctx);
  for (const nm of ['串scope', '组scope'])
    assert.deepEqual(doc().orgs[0].nodes.find((x) => x.name === nm).toolScope, { allow: [], deny: [] },
      `${nm}：非纯对象不进 SCOPE_KEYS 门、等旧空面（BUG-V14B-1 形状域之外，禁顺带扩权打击）`);
});

// ───────────────────────── 错误路径（A1/A2/A3 响亮拒） ─────────────────────────
test('QA-E01 A1：add 面 model 嵌套未知键——点名 OrgError＋本面盘字节零写入＋节点计数零增', async () => {
  seed();
  const before = disk();
  await assert.rejects(
    mutateTool.execute({ op: 'add', parentId: 'lead', name: '残甲', model: { provder: 'deepseek' } }, ctx),
    (e) => e instanceof OrgError && /model 含未知字段：provder/.test(e.message) && /已知字段：provider\/model\/fallback/.test(e.message),
    '文案风格对齐 B2/B4＝字段名+已知清单',
  );
  assert.equal(disk(), before, 'A1 逐面比对：add 面 throw-before-write 盘级实证');
  assert.equal(doc().orgs[0].nodes.length, 2, '结构计数零增（禁半成品 append）');
});

test('QA-E02 A1：update 面嵌套未知键——必抛＋盘上 node.model 不被部分刷新＋盘零写入', async () => {
  seed();
  await mutateTool.execute({ op: 'update', id: 'w1', model: { provider: 'p9' } }, ctx); // 先落合法基线
  const before = disk();
  await assert.rejects(
    mutateTool.execute({ op: 'update', id: 'w1', model: { provider: 'pX', modelld: 'm' } }, ctx),
    (e) => e instanceof OrgError && /modelld/.test(e.message),
  );
  assert.equal(disk(), before, 'A1 逐面比对：update 面盘字节零变化');
  assert.deepEqual(nodeOf('w1').model, { provider: 'p9' }, '新值（含合法 provider）一律不落，基线 provider=p9 原样');
});

test('QA-E03 A1：addOrg 面嵌套未知键——必抛＋orgs 计数零增＋盘零写入（三面收口之第三面独立实证）', async () => {
  seed();
  const before = disk();
  await assert.rejects(
    mutateTool.execute({ op: 'addOrg', name: '残域org', model: { fallbackk: 'z' } }, ctx),
    (e) => e instanceof OrgError && /fallbackk/.test(e.message),
  );
  assert.equal(doc().orgs.length, 1, '组织不产出＝整单拒非半成品');
  assert.equal(disk(), before, 'A1 逐面比对：addOrg 面盘字节零变化');
});

test('QA-E04 A2：混合形态双未知键同文案全点名＋合法键不部分生效（model 面）', async () => {
  seed();
  const before = disk();
  await assert.rejects(
    mutateTool.execute({ op: 'add', parentId: 'lead', name: '混乙', model: { provider: 'ok', provdr: 'a', modle: 'b' } }, ctx),
    (e) => e instanceof OrgError && /provdr/.test(e.message) && /modle/.test(e.message),
    '多未知键必须一次全点名（禁挤牙膏式逐键报错诱导重试漂移）',
  );
  assert.equal(doc().orgs[0].nodes.some((n) => n.name === '混乙'), false, '整单拒＝节点不存在');
  assert.equal(doc().orgs[0].nodes.some((n) => n.model?.provider === 'ok'), false, '合法 provider=ok 不部分生效（全盘扫描）');
  assert.equal(disk(), before);
});

test('QA-E05 A3 安全锚：既有受限面 {allow:[read]} 遇 toolScope:{alow} ——必抛且限制绝不放开', async () => {
  seed();
  const before = disk();
  await assert.rejects(
    mutateTool.execute({ op: 'update', id: 'w1', toolScope: { alow: ['bash'] } }, ctx),
    (e) => e instanceof OrgError && /toolScope 含未知字段：alow/.test(e.message) && /已知字段：allow\/deny/.test(e.message),
    '缺陷态=受限意图静默放开为不限工具面，安全暴露必响亮拒',
  );
  assert.deepEqual(nodeOf('w1').toolScope, { allow: ['read'], deny: [] }, '权限锚：必抛后限制原样在位（未抹平亦未扩面）');
  assert.equal(disk(), before, '盘字节零写入');
});

test('QA-E06 A4 等旧钉：sanitizeScope 重构后 allow/deny 冲突门不破——冲突条目仍点名必抛', async () => {
  seed();
  const before = disk();
  await assert.rejects(
    mutateTool.execute({ op: 'update', id: 'w1', toolScope: { allow: ['bash'], deny: ['bash'] } }, ctx),
    (e) => e instanceof OrgError && /冲突条目：bash/.test(e.message),
    '重构门面不得吞掉既有 overlap 门',
  );
  assert.equal(disk(), before);
});

process.on('exit', () => rmSync(sand, { recursive: true, force: true }));
