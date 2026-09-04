// BUG-V14B-1 金样：org_mutate 的 model 契约面对齐——schema 申报 object{provider,model,fallback}，
// 内核 sanitizeModel 对「非对象非空」输入（字符串/数组/数字/布尔）fail-fast 抛 OrgError（期望形状入文案），
// 与 BUG-V14 精神一致：杜绝静默形状不匹配写入（缺陷态：字符串 model 被 sanitizeModel 吞成 {} 仍返回成功）。
// 空/null/缺省＝沿用宿主默认（{}），语义零改动。跑法：node --test test/bugv14b-model-shape.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sand = mkdtempSync(join(tmpdir(), 'bugv14b1-'));
process.env.DSH_AGENT_ORG_PATH = join(sand, 'org.json');
const { apply } = await import('../lib/index.js');
const { mutate, loadOrg, saveOrg, OrgError } = await import('../lib/org.js');

const tools = [];
const ctx = {
  systemPrompt: { section: () => () => {} },
  effect: (fn) => fn(),
  reflect: { get: (s) => (s === 'tools' ? { register: (t) => { if (!tools.some((x) => x.name === t.name)) tools.push(t); } } : undefined) },
  on: () => {},
};
apply(ctx, {});
const mutateTool = tools.find((t) => t.name === 'org_mutate');

const seed = () => {
  writeFileSync(process.env.DSH_AGENT_ORG_PATH, JSON.stringify({
    schemaVersion: 2,
    orgs: [{ id: 'o1', name: '一部', rootNodeId: 'lead', edges: [], nodes: [
      { id: 'lead', parentId: null, name: '负责人', title: '', systemPrompt: '', model: {}, toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 60, y: 40 },
    ] }],
    updatedAt: '2026-09-05T00:00:00.000Z',
  }));
};
seed();

test('schema 防线：org_mutate 的 model 申报 object（含 null），不再 string——LLM 面与内核面对齐', () => {
  const m = mutateTool.parameters.properties.model;
  const types = Array.isArray(m.type) ? m.type : [m.type];
  assert.ok(types.includes('object'), `model.type 必须含 object：${JSON.stringify(m.type)}`);
  assert.ok(!types.includes('string'), 'string 申报必须移除（缺陷态=LLM 按申报传字符串被静默吞）');
  assert.deepEqual(Object.keys(m.properties ?? {}).sort(), ['fallback', 'model', 'provider'], '形状=Web 面板 model 三键（client.js patchOf 同构）');
});

test('正路径：object model 经工具 add/update 均落盘（sanitize 修剪逐字段）', async () => {
  await mutateTool.execute({ op: 'add', parentId: 'lead', name: '前端', model: { provider: ' dp ', model: 'deepseek-chat', fallback: '' } }, ctx);
  let node = loadOrg(process.env.DSH_AGENT_ORG_PATH).orgs[0].nodes.find((n) => n.name === '前端');
  assert.deepEqual(node.model, { provider: 'dp', model: 'deepseek-chat' }, '空串字段省略=宿主默认回退位');
  await mutateTool.execute({ op: 'update', id: node.id, model: { model: 'gpt-x' } }, ctx);
  node = loadOrg(process.env.DSH_AGENT_ORG_PATH).orgs[0].nodes.find((n) => n.name === '前端');
  assert.deepEqual(node.model, { model: 'gpt-x' });
});

test('V14B-1 核心：非空非对象 model → OrgError fail-fast（禁静默吞成 {}），且盘零写入', async () => {
  const before = readFileSync(process.env.DSH_AGENT_ORG_PATH, 'utf8');
  for (const bad of ['deepseek-chat', 42, true, ['a']]) {
    await assert.rejects(
      () => mutateTool.execute({ op: 'add', parentId: 'lead', name: `坏形${String(bad)}`, model: bad }, ctx),
      (err) => err instanceof OrgError && /model/.test(err.message) && /对象|object/.test(err.message),
      `非对象 model=${JSON.stringify(bad)} 必须抛 OrgError 且文案含期望形状`,
    );
  }
  assert.equal(readFileSync(process.env.DSH_AGENT_ORG_PATH, 'utf8'), before, '抛错必须早于写盘（throw 在 mutate 内、saveOrg 前）');
});

test('update 面同款：patch.model 字符串 → 抛，节点 model 原值不动', async () => {
  const doc = loadOrg(process.env.DSH_AGENT_ORG_PATH);
  const target = doc.orgs[0].nodes.find((n) => n.name === '前端');
  assert.deepEqual(target.model, { model: 'gpt-x' });
  assert.throws(() => mutate(doc, { op: 'update', id: target.id, patch: { model: 'some-string' } }), (err) => err instanceof OrgError && /model/.test(err.message));
  assert.throws(() => mutate(doc, { op: 'update', id: target.id, patch: { model: ['x'] } }), OrgError, '数组也非法形状（非纯对象）');
  assert.deepEqual(target.model, { model: 'gpt-x' }, '抛错后 doc 零改动');
});

test('等旧红线：缺省/null/空串/{} 四形态仍＝沿用宿主默认（{}），正常路径零回归', () => {
  const doc = loadOrg(process.env.DSH_AGENT_ORG_PATH);
  mutate(doc, { op: 'add', parentId: 'lead', name: '默认甲' });
  mutate(doc, { op: 'add', parentId: 'lead', name: '默认乙', model: null });
  mutate(doc, { op: 'add', parentId: 'lead', name: '默认丙', model: '' });
  mutate(doc, { op: 'add', parentId: 'lead', name: '默认丁', model: {} });
  for (const n of ['默认甲', '默认乙', '默认丙', '默认丁'])
    assert.deepEqual(doc.orgs[0].nodes.find((x) => x.name === n).model, {}, `${n}：空/null/{} 必须产出 {}（宿主默认标记）`);
});

test('addOrg 根节点同款防线：request.model 字符串 → 抛（同函数一处收口两面受益）', () => {
  const doc = loadOrg(process.env.DSH_AGENT_ORG_PATH);
  assert.throws(() => mutate(doc, { op: 'addOrg', name: '坏模org', model: 'gpt' }), (err) => err instanceof OrgError && /model/.test(err.message));
});

process.on('exit', () => rmSync(sand, { recursive: true, force: true }));
