// BUG-V14B-2/3 金样：org_mutate op=update 的 patch 防线——未知键必抛 + 零有效已知键必抛（禁「返回成功但什么都没写」）。
// 「零有效键必抛」曾系票面可选项，与 QA-GATE1 A4 旧钉（lead 裁定③：空入参=成功+盘零变化）冲突而不落地；
// lead 票 mtnb4jm0-td72 裁定并入 BUG-V14B＝A4 换钉兑现，本件 2b 由「锁等旧」翻为「锁必抛」
//（org.js 恢复点注释同步收口；test/org-mutate-update-gate.test.mjs A4 同步换钉）。
// 已知键集（内核 update 分支白名单）：name/title/model/systemPrompt/toolScope/maxTokens。
// Web 面 client.js patchOf 恰发这 6 键 → 零键门不可能误伤 Web 更新路径；本件同时静态锚定 patchOf 键集，防前端未来加键悄悄失联。
// 跑法：node --test test/bugv14b-update-gate.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const sand = mkdtempSync(join(tmpdir(), 'bugv14b2-'));
process.env.DSH_AGENT_ORG_PATH = join(sand, 'org.json');
const { apply } = await import('../lib/index.js');
const { mutate, loadOrg, OrgError } = await import('../lib/org.js');

const KNOWN = ['name', 'title', 'model', 'systemPrompt', 'toolScope', 'maxTokens'];

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

test('V14B-2a：patch 含未知键 → OrgError 点名未知键，doc 零改动', () => {
  const doc = loadOrg(process.env.DSH_AGENT_ORG_PATH);
  for (const patch of [{ name: 'n', bogus: 1 }, { colour: 'red' }, { max_token: 100 }]) {
    assert.throws(
      () => mutate(structuredClone(doc), { op: 'update', id: 'lead', patch }),
      (err) => err instanceof OrgError && /未知字段/.test(err.message),
      `patch=${JSON.stringify(patch)} 必须整单拒`,
    );
  }
  // 混合形态（合法键 + 未知键）同样整单拒——禁部分生效
  const d2 = structuredClone(doc);
  assert.throws(() => mutate(d2, { op: 'update', id: 'lead', patch: { title: 't', typo: '' } }), OrgError);
  assert.equal(d2.orgs[0].nodes[0].title, baseNode.title, '整单拒=合法键也不得生效');
});

test('空 patch 必抛（BUG-V14B-3 · lead 票 mtnb4jm0-td72＝A4 换钉兑现）：mutate 直调+工具面两径均抛、盘字节零变化', async () => {
  const before = readFileSync(process.env.DSH_AGENT_ORG_PATH, 'utf8');
  // 旧「空入参=成功前缀」钉（QA-GATE1 A4 · lead 裁定③）已由 lead 票 mtnb4jm0-td72 换钉：
  // 空 patch 成功返回正是 BUG-V14 失败签名「返回成功但无操作」。throw 先于 saveOrg → 盘字节级零变化（含 updatedAt）。
  assert.throws(
    () => mutate(loadOrg(process.env.DSH_AGENT_ORG_PATH), { op: 'update', id: 'lead', patch: {} }),
    (err) => err instanceof OrgError && /未携带任何已知字段/.test(err.message),
    'mutate 直调空 patch 必抛（零有效已知键）',
  );
  await assert.rejects(
    mutateTool.execute({ op: 'update', id: 'lead' }, ctx),
    (err) => err instanceof OrgError && /未携带任何已知字段/.test(err.message),
    '工具面零可更新字段必抛（适配层打包出空 patch）',
  );
  assert.equal(readFileSync(process.env.DSH_AGENT_ORG_PATH, 'utf8'), before, '必抛路径盘字节零变化（throw-before-write，含 updatedAt 簿记也不许漂）');
});

test('等旧红线：Web patchOf 全 6 键形态整单通过且逐字段落盘（含 maxTokens:null 合法值）', async () => {
  await mutateTool.execute({ op: 'update', id: 'lead', name: '负责人B', title: 'TL', model: { provider: 'p1', model: 'm1', fallback: '' }, systemPrompt: 'sp', toolScope: { allow: ['bash'], deny: [] }, maxTokens: 8000 }, ctx);
  const node = loadOrg(process.env.DSH_AGENT_ORG_PATH).orgs[0].nodes[0];
  assert.deepEqual([node.name, node.title, node.model, node.systemPrompt, node.toolScope.allow, node.maxTokens],
    ['负责人B', 'TL', { provider: 'p1', model: 'm1' }, 'sp', ['bash'], 8000]);
  // 真·Web 形态：六键全在（maxTokens null＝回默认，合法已知值，不得被零有效键门误杀）
  const webPatch = { name: '负责人C', title: '', model: { provider: '', model: '', fallback: '' }, systemPrompt: '', toolScope: { allow: [], deny: [] }, maxTokens: null };
  const doc = loadOrg(process.env.DSH_AGENT_ORG_PATH);
  mutate(doc, { op: 'update', id: 'lead', patch: webPatch });
  const n2 = doc.orgs[0].nodes[0];
  assert.deepEqual([n2.name, n2.model, n2.maxTokens], ['负责人C', {}, null], 'Web 全键空表单=合法清位操作');
});

test('单字段工具更新等旧（action-1 前既有行为零回归）', async () => {
  seed();
  await mutateTool.execute({ op: 'update', id: 'lead', title: '只改职位' }, ctx);
  const node = loadOrg(process.env.DSH_AGENT_ORG_PATH).orgs[0].nodes[0];
  assert.equal(node.title, '只改职位');
  assert.equal(node.name, baseNode.name);
});

test('静态锚·client.js patchOf 键集＝内核已知 6 键（前端加键必红，逼同步扩门）', () => {
  const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8');
  const start = src.indexOf('function patchOf(form)');
  assert.ok(start >= 0, 'patchOf 必须存在（BUG-V14 平铺→patch 适配锚）');
  const body = src.slice(start, src.indexOf('\n    }', start));
  const keys = [...body.matchAll(/^ {8}(\w+):/gm)].map((m) => m[1]);
  assert.deepEqual(keys.sort(), [...KNOWN].sort(), `patchOf 键集漂移：${keys.join(',')} —— 扩键必须同步 org.js update 白名单`);
});

process.on('exit', () => rmSync(sand, { recursive: true, force: true }));
