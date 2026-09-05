// team:sbb-fe 常备门禁（任务 mtnzwabl-h9hk；规格 = docs/FE-SBB-DESIGN-v1.md §5 A1/A3-A8，S1 语义）。
// 手法先例 = toolface-selfdesc / org-toolface-enum-gate：源文提取 + eval 真值表，提取器自检封死失明型假绿。
// 纪律：判据不硬编码 sbbVisible 实现常量——SBB_NEAR 值与函数体均从 lib/client.js 源文反推（门禁与实现不共享复制）。
// 用例 = 15：G0 提取器自检 ｜ A4 真值表 ×7（含恰 120 开区间、8px 溢出界、零高容器）｜ A6 常量+跟底字节锚 ×2
// ｜ A3 静态锚 ｜ A5 dshao- 门禁同构 ｜ A7 reduced-motion 双证 ｜ A8 泄漏红线 ｜ P 纯函数面 ｜ A1 语法门。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = readFileSync(join(ROOT, 'lib', 'client.js'), 'utf8');
const hits = (re) => (SRC.match(re) ?? []).length;

// ---------- 提取器（被检对象=G0；未命中→null，build 缺锚必抛，禁静默空转） ----------
const extractNear = (s) => s.match(/const SBB_NEAR = (\d+);/)?.[1] ?? null;
const extractFn = (s) => s.match(/const sbbVisible = \(el\) => [^\n]+;/)?.[0].replace(/;$/, '').slice('const sbbVisible = '.length) ?? null;
const build = () => {
  const k = Number(extractNear(SRC)); const f = extractFn(SRC);
  if (!Number.isFinite(k) || f === null) throw new Error('SBB 门禁失明：sbbVisible/SBB_NEAR 锚未命中');
  return { near: k, visible: new Function('SBB_NEAR', `return ${f}`)(k) };
};

test('G0 提取器自检：正常样张可解析；缺锚=null 不臆造；提取体无尾分号且以箭头起步', () => {
  assert.equal(extractNear('x const SBB_NEAR = 120; y'), '120');
  assert.equal(extractNear('nothing here'), null);
  const f = extractFn('pre const sbbVisible = (el) => el.a > 8; post');
  assert.ok(typeof f === 'string' && f.startsWith('(el) =>') && !f.endsWith(';'));
  assert.equal(extractFn('no fn'), null);
});

const { near, visible } = build();
const H = (scrollHeight, scrollTop, clientHeight) => ({ scrollHeight, scrollTop, clientHeight });
test('A4-1 无溢出（sh-ch=0）→ 隐藏', () => assert.equal(visible(H(500, 0, 500)), false));
test('A4-2 溢出+贴底（距底=0）→ 隐藏', () => assert.equal(visible(H(900, 500, 400)), false));
test('A4-3 溢出+距底=near+1(121) → 出现', () => assert.equal(visible(H(1000, 1000 - 400 - near - 1, 400)), true));
test('A4-4 溢出+距底恰=near(120) → 隐藏（开区间钉死）', () => assert.equal(visible(H(1000, 1000 - 400 - near, 400)), false));
test('A4-5 零高容器（sh=ch=st=0 隐藏面板）→ 隐藏', () => assert.equal(visible(H(0, 0, 0)), false));
test('A4-6 scrollTop=0 满溢（距底1600）→ 出现', () => assert.equal(visible(H(2000, 0, 400)), true));
test('A4-7 溢出界=8px 不算溢出（严格>8）→ 隐藏', () => assert.equal(visible(H(408, 0, 400)), false));

test('A6 SBB_NEAR 单点=120，与 C1 跟底阈值 <120 同值同向（两处内容锚对账）', () => {
  assert.equal(near, 120);
  assert.equal(hits(/const SBB_NEAR = 120;/g), 1);
  assert.equal(hits(/const nearBottom = el\.scrollHeight - el\.scrollTop - el\.clientHeight < 120;/g), 1);
});
test('A6b 跟底两行块逐字节锚在位（禁触清单：自动跟底段零改写、零 follow 标志位）', () => {
  const block = "const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;\n"
    + "        if (nearBottom) feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });";
  assert.ok(SRC.includes(block), '跟底块对基线漂移');
  assert.equal(hits(/sbbFollow|followRef/g), 0);
});

test('A3 静态锚：host 标记=2/选择器=1/h(SbbSlot) 挂载=2/slot CSS 在位/reduce 降级共两条', () => {
  assert.equal(hits(/'data-sbb-host': '1'/g), 2);
  assert.equal(hits(/closest\('\[data-sbb-host\]'\)/g), 1);
  assert.equal(hits(/h\(SbbSlot\)/g), 2);
  assert.ok(SRC.includes('.dshao-sbb-slot{position:sticky;bottom:10px;height:0'));
  assert.ok(SRC.includes('.dshao-sbb[data-show=0]{visibility:hidden;opacity:0;pointer-events:none}'));
  assert.equal(hits(/@media \(prefers-reduced-motion:reduce\)/g), 2); // team-card 既有 + sbb 新增
});

test('A5 门禁同构：EvIC1a 零命中/新增 SBB CSS 选择器全 .dshao-sbb 前缀（禁裸标签规则）', () => {
  assert.equal(hits(/EvIC1a/g), 0);
  // 切片锚=CSS 块首条规则 .dshao-sbb-slot{（唯一、位于注释之后；A3 同锚在位）。
  // 旧锚「SBB 悬浮…球」系 :131 注释内文本，indexOf 首命中落注释中段，注释残行绕过 /* 过滤冒充选择器→假「越scope」红（mto116qa/mtnwg86v-o1e2 双独立复现）。
  const a = SRC.indexOf('.dshao-sbb-slot{');
  const b = SRC.indexOf('@media (prefers-reduced-motion:reduce){.dshao-sbb');
  if (a < 0 || b <= a) throw new Error('SBB 门禁失明：A5 切片锚未命中');
  const seg = SRC.slice(a, b);
  const rules = seg.split('\n').map((l) => l.trim()).filter((l) => l !== '' && !l.startsWith('/*') && !l.startsWith('}'));
  assert.ok(rules.length >= 5);
  for (const rule of rules) assert.ok(rule.startsWith('.dshao-sbb{') || rule.startsWith('.dshao-sbb-') || rule.startsWith('.dshao-sbb:') || rule.startsWith('.dshao-sbb['), `越 scope 选择器: ${rule.slice(0, 40)}`);
});

test('A7 reduced-motion 双证：matchMedia 判定+behavior auto 分支+CSS transition:none', () => {
  assert.ok(SRC.includes("window.matchMedia('(prefers-reduced-motion: reduce)').matches"));
  assert.ok(SRC.includes("behavior: reduced ? 'auto' : 'smooth'"));
  assert.ok(SRC.includes('@media (prefers-reduced-motion:reduce){.dshao-sbb{transition:none}}'));
});

test('A8 泄漏红线：scroll passive 监听 + cleanup 内 scroll/resize 双路 removeEventListener', () => {
  assert.ok(SRC.includes("host.addEventListener('scroll', sync, { passive: true })"));
  assert.ok(SRC.includes("return () => { host.removeEventListener('scroll', sync); window.removeEventListener('resize', sync); };"));
});

test('P 纯函数面：sbbVisible 函数体零 window/document 引用（只认自身 scroller，嵌套 C1/C2 不串扰）', () => {
  const f = extractFn(SRC);
  assert.ok(!/\b(window|document)\b/.test(f ?? 'BLIND'));
});

test('A1 语法门：node --check lib/client.js exit 0', () => {
  const r = spawnSync(process.execPath, ['--check', join(ROOT, 'lib', 'client.js')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
});
