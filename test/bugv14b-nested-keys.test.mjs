// BUG-V14B-5 金样（ADJ-V14B-NESTED@5c36db7 终裁）：org_mutate 嵌套对象未知键残域门。
// 缺陷态：schema 对 model/toolScope 申报 additionalProperties:false 但装载层申报不执法（空头承诺），
// model:{provder} 静默产 {}=沿用宿主默认仍成功（BUG-V14B-1 同款病深一层）；toolScope:{alow} 静默产
// {allow:[],deny:[]}＝受限意图被放开为不限工具面（安全暴露）。修复=域层两白名单 MODEL_KEYS/SCOPE_KEYS，
// 非子集整单 OrgError 点名，throw 先于 saveOrg；add/update/addOrg 三面经 sanitizeModel/sanitizeScope 收口。
// 验收映射：案1=A1（三面必抛+盘级零写入）；案2=A2（混合形态整单拒·合法键不部分生效）；
// 案3=A3（toolScope 非 allow/deny 键点名必抛·工具面不静默放开）；案4/5=A4（等旧形态与正路径零回归·
// Web patchOf 同构零误杀）。A5=本件与 bugv14b-model-shape/bugv14b-update-gate/org-mutate-update-gate 共跑
// （npm test）+棘轮只增，由全量闸承载。
// 跑法：node --test test/bugv14b-nested-keys.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sand = mkdtempSync(join(tmpdir(), 'bugv14b5-'));
process.env.DSH_AGENT_ORG_PATH = join(sand, 'org.json');
const { apply } = await import('../lib/index.js');
const { mutate, loadOrg, OrgError } = await import('../lib/org.js');

const tools = [];
const ctx = {
  systemPrompt: { section: () => () => {} },
  effect: (fn) => fn(),
  reflect: { get: (s) => (s === 'tools' ? { register: (t) => { if (!tools.some((x) => x.name === t.name)) tools.push(t); } } : undefined) },
  on: () => {},
};
apply(ctx, {});
const mutateTool = tools.find((t) => t.name === 'org_mutate');

const baseNode = { id: 'lead', parentId: null, name: '负责人', title: '', systemPrompt: '', model: {}, toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 60, y: 40 };
const seed = () => writeFileSync(process.env.DSH_AGENT_ORG_PATH, JSON.stringify({
  schemaVersion: 2,
  orgs: [{ id: 'o1', name: '一部', rootNodeId: 'lead', edges: [], nodes: [structuredClone(baseNode)] }],
  updatedAt: '2026-09-05T00:00:00.000Z',
}));
seed();

test('A1：嵌套未知键 add/update/addOrg 三面必抛（整单点名拼错键）＋盘字节零写入（throw-before-write）', async () => {
  const before = readFileSync(process.env.DSH_AGENT_ORG_PATH, 'utf8');
  // add 面：model:{provder} —— 缺陷态=静默产 {} 仍返回成功
  await assert.rejects(
    mutateTool.execute({ op: 'add', parentId: 'lead', name: '坏模甲', model: { provder: 'deepseek' } }, ctx),
    (err) => err instanceof OrgError && /model 含未知字段：provder/.test(err.message) && /已知字段：provider\/model\/fallback/.test(err.message),
    'add 面 model 嵌套未知键必点名必抛',
  );
  // update 面：patch.model 同款（工具面平铺打包 → patch.model）
  await assert.rejects(
    mutateTool.execute({ op: 'update', id: 'lead', model: { model: 'ok', fallbackx: '' } }, ctx),
    (err) => err instanceof OrgError && /model 含未知字段：fallbackx/.test(err.message),
    'update 面 model 嵌套未知键必点名必抛',
  );
  // addOrg 面：根节点 model 同函数（sanitizeModel）收口
  await assert.rejects(
    mutateTool.execute({ op: 'addOrg', name: '坏模org', model: { provider: 'p', typo: 'y' } }, ctx),
    (err) => err instanceof OrgError && /model 含未知字段：typo/.test(err.message),
    'addOrg 面 model 嵌套未知键必点名必抛',
  );
  assert.equal(readFileSync(process.env.DSH_AGENT_ORG_PATH, 'utf8'), before,
    '三面必抛路径盘字节零变化（throw 先于 saveOrg，含 updatedAt 簿记零漂）');
});

test('A2：混合形态 {provider,typo} 整单拒——合法键不部分生效、节点不落盘', async () => {
  const before = readFileSync(process.env.DSH_AGENT_ORG_PATH, 'utf8');
  await assert.rejects(
    mutateTool.execute({ op: 'add', parentId: 'lead', name: '混形', model: { provider: 'deepseek', typoo: 'x' } }, ctx),
    (err) => err instanceof OrgError && /typoo/.test(err.message),
    '混合形态整单拒（6baecd0 update-gate 同形）',
  );
  const doc = loadOrg(process.env.DSH_AGENT_ORG_PATH);
  assert.equal(doc.orgs[0].nodes.some((n) => n.name === '混形'), false, '整单拒=节点整体不落盘');
  assert.equal(doc.orgs[0].nodes[0].model.provider, undefined, '合法 provider 不得部分生效');
  assert.equal(readFileSync(process.env.DSH_AGENT_ORG_PATH, 'utf8'), before);
});

test('A3：toolScope 非 allow/deny 键点名必抛——受限意图禁被静默放开为不限工具面', async () => {
  const before = readFileSync(process.env.DSH_AGENT_ORG_PATH, 'utf8');
  // 缺陷态核心案型：{alow:[…]} 拼错 → 旧行为静默产 {allow:[],deny:[]}＝不限工具面（安全暴露）
  await assert.rejects(
    mutateTool.execute({ op: 'add', parentId: 'lead', name: '坏scope', toolScope: { alow: ['bash'] } }, ctx),
    (err) => err instanceof OrgError && /toolScope 含未知字段：alow/.test(err.message) && /已知字段：allow\/deny/.test(err.message),
    'add 面 toolScope 拼错键必点名必抛（禁静默放开）',
  );
  // update 面混合形态：合法键在位、嵌套多一杂键 → 整单拒
  await assert.rejects(
    mutateTool.execute({ op: 'update', id: 'lead', toolScope: { allow: ['read'], deny: [], extraKey: 1 } }, ctx),
    (err) => err instanceof OrgError && /toolScope 含未知字段：extraKey/.test(err.message),
    'update 面 toolScope 未知键整单拒（allow 不部分生效）',
  );
  const node = loadOrg(process.env.DSH_AGENT_ORG_PATH).orgs[0].nodes[0];
  assert.deepEqual(node.toolScope, { allow: [], deny: [] }, '必抛后原 toolScope 逐字段不动（未被覆盖也未被清空）');
  assert.equal(readFileSync(process.env.DSH_AGENT_ORG_PATH, 'utf8'), before, '盘字节零写入');
});

test('A4：等旧红线——model 四空形态仍 {}；合法嵌套正路径逐字段修剪零回归', () => {
  const doc = loadOrg(process.env.DSH_AGENT_ORG_PATH);
  mutate(doc, { op: 'add', parentId: 'lead', name: '甲' });
  mutate(doc, { op: 'add', parentId: 'lead', name: '乙', model: null });
  mutate(doc, { op: 'add', parentId: 'lead', name: '丙', model: '' });
  mutate(doc, { op: 'add', parentId: 'lead', name: '丁', model: {} });
  for (const n of ['甲', '乙', '丙', '丁'])
    assert.deepEqual(doc.orgs[0].nodes.find((x) => x.name === n).model, {}, `${n}：缺省/null/空串/{} 四形态等旧＝宿主默认标记`);
  // 正路径：三合法键逐字段修剪（trim、空串省略）照旧
  mutate(doc, { op: 'add', parentId: 'lead', name: '正形', model: { provider: ' dp ', model: 'deepseek-chat', fallback: '' } });
  assert.deepEqual(doc.orgs[0].nodes.find((x) => x.name === '正形').model, { provider: 'dp', model: 'deepseek-chat' });
  // toolScope 合法三形态：全键 / 半键 / null —— 门不误伤，产出等旧
  mutate(doc, { op: 'add', parentId: 'lead', name: 'scope全', toolScope: { allow: ['bash'], deny: ['write'] } });
  mutate(doc, { op: 'add', parentId: 'lead', name: 'scope半', toolScope: { deny: ['edit'] } });
  mutate(doc, { op: 'add', parentId: 'lead', name: 'scope空', toolScope: null });
  assert.deepEqual(doc.orgs[0].nodes.find((x) => x.name === 'scope全').toolScope, { allow: ['bash'], deny: ['write'] });
  assert.deepEqual(doc.orgs[0].nodes.find((x) => x.name === 'scope半').toolScope, { allow: [], deny: ['edit'] });
  assert.deepEqual(doc.orgs[0].nodes.find((x) => x.name === 'scope空').toolScope, { allow: [], deny: [] }, 'toolScope:null 等旧走空面');
});

test('A4b：Web patchOf 同构六键整单通过（前端零误杀面）＋doc 级 throw-before-append 零半成品', async () => {
  seed();
  const webPatch = { name: '负责人W', title: 'TL', model: { provider: 'p1', model: 'm1', fallback: '' }, systemPrompt: 'sp', toolScope: { allow: ['bash'], deny: [] }, maxTokens: null };
  await mutateTool.execute({ op: 'update', id: 'lead', ...webPatch }, ctx);
  const node = loadOrg(process.env.DSH_AGENT_ORG_PATH).orgs[0].nodes[0];
  assert.deepEqual([node.name, node.model, node.toolScope.allow, node.maxTokens], ['负责人W', { provider: 'p1', model: 'm1' }, ['bash'], null],
    'client.js patchOf 恰发已知键，两门零误杀（v14b-fix2 终态 model 三键对象照旧通过）');
  // doc 级：抛错早于数组 append——同 doc 快照零改动（不依赖落盘）
  const doc = loadOrg(process.env.DSH_AGENT_ORG_PATH);
  const snapshot = JSON.stringify(doc);
  assert.throws(() => mutate(doc, { op: 'add', parentId: 'lead', name: '残域', model: { modelx: 'z' } }), OrgError);
  assert.equal(JSON.stringify(doc), snapshot, 'model 门在节点字面量构造期抛出=doc 零改动');
});

process.on('exit', () => rmSync(sand, { recursive: true, force: true }));
