// 导入前端双防线 · 常驻行为回归门。
// 出身：mtk2wxn9-s1rr 的一次性验证脚本（原居 /tmp，重启即失）；按评审备案 mtk3rbw4-kknw 落库：
//   ① 移入仓库 test/，转 node:test 风格，npm test（node --test）自动收集；
//   ② 抽取窗口由魔数 slice(start, start+22) 收紧为两锚点之间（"形状预检"注释 → confirm 块尾的 setBusy）；
//   ③ 钉死措辞口径：client.js confirm 与 README 的「只搬迁组织配置，不含沟通留痕」逐字一致（含逗号，评审备案 #1）。
// 方法：抽取 lib/client.js 里形状预检 + 版本早退 + confirm 的**真实代码段**，桩函数执行，
// 断言各 payload 走哪条分支——测的是文件真实代码，非复刻。
// 单独运行：node --test test/org-import-gate.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const lines = readFileSync(join(repoRoot, 'lib/client.js'), 'utf8').split('\n');

// 锚定抽取：起点「形状预检」注释行；终点紧随 confirm 块之后的 setBusy(true) 行（不含）。
// 锚点缺失或窗口越界都直接抛错——宁可误报"代码搬家"，不可静默测旧段。
const start = lines.findIndex((l) => l.includes('形状预检：v2 为'));
const end = lines.findIndex((l, i) => i > start && l.includes('setBusy(true);'));
assert.ok(start >= 0 && end > start, '锚点缺失：client.js 导入预检块已搬家，请同步本测试');
const body = lines.slice(start, end).join('\n');
assert.ok(
  body.includes('不像组织配置') && body.includes('sv > 2') && body.includes('window.confirm'),
  '抽取范围不对：未完整覆盖 形状预检/版本早退/confirm 三道闸',
);
assert.ok(!body.includes('setBusy') && !body.includes('fetch('), '抽取范围越界：混入了 confirm 之后的执行段');

/** 在桩环境里执行抽出的真实代码段，返回它命中的状态序列（confirm 桩模拟用户取消，不走网络）。 */
function run(payload) {
  const statuses = [];
  const setStatus = (s) => statuses.push(s);
  const window = {
    confirm: (msg) => { statuses.push({ kind: '__confirm__', text: msg }); return false; },
  };
  const fn = new Function('payload', 'setStatus', 'window', body + '\nreturn "fell-through-past-confirm";');
  try { return { fell: fn(payload, setStatus, window), statuses }; }
  catch (e) { return { error: String(e), statuses }; }
}

/** 归类：gate=版本早退拦截；confirm=走到强确认；shape=形状预检拦截；其余 other。gate 必须早于 confirm。 */
function classify(r) {
  const hitGate = r.statuses.some((s) => s.kind === 'error' && s.text.includes('高于本插件支持范围'));
  const hitConfirm = r.statuses.some((s) => s.kind === '__confirm__');
  const hitShape = r.statuses.some((s) => s.kind === 'error' && s.text.includes('不像组织配置'));
  return { got: hitGate ? 'gate' : hitConfirm ? 'confirm' : hitShape ? 'shape' : 'other', hitGate, hitConfirm };
}

// 边界口径：仅"数字且 > 2"前端早退（与 lib/org.js:12 SCHEMA_VERSION=2 同步点）；
// 非数字/缺失/null 等畸形形态一律放行交后端 prepareDoc 权威判定（双防线定位）。
const cases = [
  ['v2 正常档 schemaVersion=2 → confirm', { schemaVersion: 2, orgs: [{ id: 'org' }] }, 'confirm'],
  ['无 schemaVersion 的 orgs 档（交后端判） → confirm', { orgs: [{ id: 'org' }] }, 'confirm'],
  ['v1 旧档 schemaVersion=1 → confirm', { schemaVersion: 1, organization: { name: 'x' }, nodes: [] }, 'confirm'],
  ['schemaVersion=3 带 orgs（评审场景） → gate', { schemaVersion: 3, orgs: [{ id: 'org' }] }, 'gate'],
  ['schemaVersion=2.5（非整数也高于 2） → gate', { schemaVersion: 2.5, orgs: [] }, 'gate'],
  ['schemaVersion="3"（字符串非数字→交后端） → confirm', { schemaVersion: '3', orgs: [] }, 'confirm'],
  ['schemaVersion=null（非数字→交后端） → confirm', { schemaVersion: null, orgs: [] }, 'confirm'],
  ['不像组织配置（无 orgs 非 v1） → shape', { foo: 1 }, 'shape'],
];

for (const [name, payload, want] of cases) {
  test(name, () => {
    const r = run(payload);
    assert.equal(r.error, undefined, `桩执行抛错：${r.error}`);
    const { got, hitGate, hitConfirm } = classify(r);
    assert.equal(got, want);
    if (hitGate) assert.ok(!hitConfirm, 'gate 必须早于 confirm：拦下后不得再弹覆盖确认');
  });
}

test('披露口径逐字一致：confirm 与 README 均含「只搬迁组织配置，不含沟通留痕」（评审备案 #1 的标点钉死）', () => {
  const confirmMsg = run({ schemaVersion: 2, orgs: [] }).statuses.find((s) => s.kind === '__confirm__')?.text ?? '';
  const readme = readFileSync(join(repoRoot, 'README.md'), 'utf8');
  const SCOPE = '只搬迁组织配置，不含沟通留痕';
  assert.ok(confirmMsg.includes(SCOPE), `confirm 文案缺口径：${confirmMsg}`);
  assert.ok(readme.includes(SCOPE), 'README 缺「只搬迁组织配置，不含沟通留痕」口径');
});
