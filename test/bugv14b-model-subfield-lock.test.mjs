// BUG-V14B 余项锁（票 mtnbem7c-535k，node-2 后端）：model 三键的**值**若非 string，必须响亮抛错。
// 口径来源＝票面 动作1「字段出现非 string → throw（并入既有 text() 校验口径）」+ 架构师 ARCH-ADJ-V14B-MODEL ①
// 「非法形状响亮拒，禁止静默归一」的逐键面：外层形状（非空非对象）由 648cad8 的 sanitizeModel 门守，
// 逐键形状则复用既有 text() 的「必须是字符串」判据——两条门缺一即存在「半非法对象被静默修剪」的残留面。
// 双向证据注记：本锁**非缺陷复现件**——该子条款在缺陷树 6a6e8ae 亦为绿（text() 自始逐键校验），
// 故本件是「行为在库但无锁」的回归钉（green-on-both pin），不产出红集；红→绿双向证据见
// test/bugv14b-model-shape.test.mjs（外层形状面）与 test/bugv14b-update-gate.test.mjs（patch 闸面）。
// 跑法：node --test test/bugv14b-model-subfield-lock.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sand = mkdtempSync(join(tmpdir(), 'bugv14b4-'));
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

const BASE = { id: 'lead', parentId: null, name: '负责人', title: '', systemPrompt: '', model: {}, toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 60, y: 40 };
const seed = () => writeFileSync(process.env.DSH_AGENT_ORG_PATH, JSON.stringify({
  schemaVersion: 2,
  orgs: [{ id: 'o1', name: '一部', rootNodeId: 'lead', edges: [], nodes: [structuredClone(BASE)] }],
  updatedAt: '2026-09-05T00:00:00.000Z',
}));
seed();
const disk = () => readFileSync(process.env.DSH_AGENT_ORG_PATH, 'utf8');
const doc = () => loadOrg(process.env.DSH_AGENT_ORG_PATH);

// 逐键非 string 样张：数字/布尔/数组/对象（null 与 '' 是合法空位，另案锁定，不得混入本集）
const BAD_VALUES = [42, 0, true, false, ['deepseek-chat'], { k: 'v' }];
const KEY_NAMES = ['model.provider', 'model.model', 'model.fallback'];

test('锁1 逐键形状：三键各取非 string 值 → 必抛且文案点名是哪一键（禁静默修剪成合法子集）', () => {
  for (const [i, key] of ['provider', 'model', 'fallback'].entries()) {
    for (const bad of BAD_VALUES) {
      assert.throws(
        () => mutate(doc(), { op: 'update', id: 'lead', patch: { model: { [key]: bad } } }),
        (err) => err instanceof OrgError && new RegExp(`model\\.${key} 必须是字符串`).test(err.message),
        `patch.model.${key}=${JSON.stringify(bad)} 必须抛「${KEY_NAMES[i]} 必须是字符串」`,
      );
    }
  }
});

test('锁2 三面同口径：add / addOrg 亦逐键必抛（sanitizeModel 一处收口、三面受益无旁路）', () => {
  for (const bad of BAD_VALUES) {
    assert.throws(
      () => mutate(doc(), { op: 'add', parentId: 'lead', name: `坏值${JSON.stringify(bad)}`, model: { provider: bad } }),
      (err) => err instanceof OrgError && /model\.provider 必须是字符串/.test(err.message),
      `add 面 model.provider=${JSON.stringify(bad)} 必须抛`,
    );
    assert.throws(
      () => mutate(doc(), { op: 'addOrg', name: `坏模org${JSON.stringify(bad)}`, model: { fallback: bad } }),
      (err) => err instanceof OrgError && /model\.fallback 必须是字符串/.test(err.message),
      `addOrg 面 model.fallback=${JSON.stringify(bad)} 必须抛`,
    );
  }
});

test('锁3 工具面端到端：半非法对象（一合法键 + 一非 string 键）→ 抛且盘字节零变化（禁落合法半边）', async () => {
  const before = disk();
  for (const half of [{ provider: 'dp', model: 7 }, { model: 'gpt-x', fallback: {} }]) {
    await assert.rejects(
      () => mutateTool.execute({ op: 'update', id: 'lead', model: half }, ctx),
      (err) => err instanceof OrgError && /必须是字符串/.test(err.message),
      `半非法 model=${JSON.stringify(half)} 不得部分生效`,
    );
  }
  assert.equal(disk(), before, 'throw-before-write：半非法对象整单拒，盘字节零变化（合法键也不得落盘）');
  assert.deepEqual(doc().orgs[0].nodes[0].model, {}, 'doc 侧同样零改动（无半写）');
});

test('锁4 等旧边界：子键 null / 空串 / 缺省＝合法空位（省略该键＝宿主默认回退位），不得被锁1 误伤', () => {
  const d = doc();
  mutate(d, { op: 'update', id: 'lead', patch: { model: { provider: null, model: '', fallback: undefined } } });
  assert.deepEqual(d.orgs[0].nodes[0].model, {}, '三空位子键 → {}（ARCH-ADJ-V14B-MODEL ②：空面语义不变）');
  mutate(d, { op: 'update', id: 'lead', patch: { model: { provider: 'dp', model: null, fallback: '' } } });
  assert.deepEqual(d.orgs[0].nodes[0].model, { provider: 'dp' }, '非空子集只落非空键（Web 全键空表单＝合法清位）');
});

process.on('exit', () => rmSync(sand, { recursive: true, force: true }));
