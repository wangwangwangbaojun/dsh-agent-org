// QA-GATE 候选（§G 工具面自述契约案，DEF-EDGEKIND-1 裁定 ②③ 的固化形态；随票挂载，票号占位待 lead 开票）：
// 「工具面自述（description + parameters.enum）中一切枚举参数，其值集合必须 ⊆ 域层合法值集合；
//   同一字段的工具面与域层应共享常量源，或以静态断言钉死。」
//
// 双向证据契约：本文件在 DEF-EDGEKIND-1 pre-fix 树（HEAD≤be816de 的 kind enum=
//   ['collab','dotted-subordinate']，:558/:575 形态）必红（G1a+G1b 双红：enum 面与 description 面各钉一刀）；
//   在收敛修复树（enum/token 均 ∈ EDGE_KINDS）必绿。
// G2（数值区间自述，裁定③泛化面）在 maxTokens description=1..64000 现状必红——
//   域层 LIMITS.maxTokens=1_000_000（org.js），实测界内值 64001 可写、1000001 拒且报错文案为
//   「1..1000000」（QA 探针 /tmp/qa-v15/probe-maxtokens.mjs）。挂载本文件时须同票收编 index.js
//   maxTokens description（改值或改为引用域层常量源），否则 npm test 恒红——这正是本门禁的钳制语义。
//   （口径差本体系 lead 裁定② 明示不入 v0.14 的已知项，本门禁不新增口径，仅禁止口径双写继续漂移。）
//
// 卫生规约：零行号锚。G1 锚在「import 进来的域层常量」与「schema/文案内容」；G2 锚在
//   description 文案正则与 org.js LIMITS 字面量解析，均不锚行号，锚漂免疫。
// 零依赖：仅 node 内置 + 被测包自身。QA_LIB_ROOT 可覆盖 lib 根（QA 双树互证用；入库默认走相对路径）。
//
// ————— 挂载注记（OPS3-CLOSE C2｜执行 node-2｜任务件 mtn7mzt5-se2t｜lead 拍板 = node-4 三选一之 (b)「挂而不闸」）—————
// G2 翻转条件（原文照录，到达即转正式）：「maxTokens description 修复票到达即转正式（lead 裁定：
//   口径差不入 v0.14，与 §G 冻结面冲突故采 (b) 不采 (a)）」。
// G0/G1a/G1b 自本 commit 起正式生效；G2 以 test.skip 挂账，断言体逐字未改。
// 挂载时点实测（@HEAD=0544f98，node-2 复跑）：G0/G1a/G1b 3/3 绿；G2 红，且红项已自票面预期
//   「自述 64000 ≠ 域层 LIMITS.maxTokens=1000000」位移为「G2 提取器自检：0 处数值区间自述」——
//   因 417e97e（[BE-V15-C/mtn63ura-ldch]）已把 index.js maxTokens 自述改为 `1..${LIMITS.maxTokens}`
//   模板串（引用域层常量源、双写面消灭），工具面已无单引号字面量数字区间自述可解析。
//   即：翻转条件的字面对象（maxTokens description 修复票）已到达，但本门禁 G2 提取器只解析单引号
//   字面量，照票面维持 skip 并留痕；转正式需 node-4 先出 G2 提取器补丁（本票不改他人门禁逻辑）。
// ————— 翻转注记（node-4｜DEF-EDGEKIND-1 回归票 mtnhz0ow-m7gr｜2026-09-05）—————
// 翻转条件已到达（417e97e maxTokens 自述修复已入仓），随本票出承诺的 G2 提取器补丁并转正式：
//   ① 提取器双形态——单引号数字区间旧形（漂移样张必须仍可见，防修复回退隐身）+ 反引号模板引用形
//     （`1..${LIMITS.KEY}`，现形态；引用必须命中域层 LIMITS 真实键，悬空引用即红）；
//   ② 提取器自检对（旧形样张+新形样张各须解析到 1 处）——G2 正是被旧提取器单形态失明打下线的，
//     失明型假绿禁止（手法与 toolface-selfdesc.test.mjs G0a/b/c 同源）；
//   ③ 旧字面量上界比对判据逐字保留；G2 由 test.skip 转 test 正式闸。
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const LIB = process.env.QA_LIB_ROOT ?? join(dirname(fileURLToPath(import.meta.url)), '..', 'lib');
const srcIndex = readFileSync(join(LIB, 'index.js'), 'utf8');
const srcOrg = readFileSync(join(LIB, 'org.js'), 'utf8');
const { EDGE_KINDS } = await import(join(LIB, 'org.js'));

// org_mutate 的「自述面」= name/description/parameters 区段（schema 止于 output:，不含 execute 实现体）
const selfFace = (() => {
  const start = srcIndex.indexOf("name: 'org_mutate'");
  assert.ok(start >= 0, 'org_mutate 工具定义存在');
  const end = srcIndex.indexOf('output:', start);
  assert.ok(end > start, 'org_mutate schema 段（output: 之前）可界定');
  return srcIndex.slice(start, end);
})();

// 契约表：字段 → 域层合法值集（导出常量）。新增枚举字段时在此加行，即为「以静态断言钉死」。
const ENUM_CONTRACTS = [{ field: 'kind', domainValues: EDGE_KINDS, tokenRes: /\b(?:collab|dotted[a-zA-Z-]*)\b/g }];

// 从自述面提取 `<field>: { ... enum: [ ... ] ... }` 形态的工具面枚举声明
function toolEnums(face) {
  const out = new Map();
  const re = /(\w+):\s*\{[^{}]*?\benum:\s*\[([^\]]*)\]/g;
  for (const m of face.matchAll(re)) out.set(m[1], [...m[2].matchAll(/'([^']*)'/g)].map((x) => x[1]));
  return out;
}

// G0 提取器自检：防「正则失明 → 恒真好门禁」的元缺陷
test('G0 提取器自检（enum 提取与自述面界定非空）', () => {
  const enums = toolEnums(selfFace);
  assert.ok(enums.size >= 2, `自述面应至少含 op/kind 两个 enum，实测 ${enums.size}：${[...enums.keys()]}`);
  assert.ok(enums.has('kind'), 'kind.enum 可提取');
});

// G1a §G 条款主断言：契约表内字段的工具面 enum ⊆ 域层合法值集
test('G1a 工具面 parameters.enum ⊆ 域层合法值集（§G 枚举子集条款）', () => {
  const enums = toolEnums(selfFace);
  for (const { field, domainValues } of ENUM_CONTRACTS) {
    const declared = enums.get(field);
    assert.ok(declared, `契约字段 ${field} 在工具面应存在且为 enum 形态`);
    for (const v of declared) assert.ok(domainValues.includes(v), `${field}.enum 值 '${v}' ∉ 域层合法集 ${JSON.stringify(domainValues)}（按自述调用必被域层拒绝）`);
  }
});

// G1b description 文案面同钉：DEF-EDGEKIND-1 的 :558 半案在 enum 之外独立显形
test('G1b 工具面 description 文案中的域层枚举 token ⊆ 域层合法值集', () => {
  for (const { field, domainValues, tokenRes } of ENUM_CONTRACTS) {
    const toks = [...new Set(selfFace.match(tokenRes) ?? [])];
    for (const t of toks) assert.ok(domainValues.includes(t), `description 文案 token '${t}' ∉ 域层合法集（自述-域层双写漂移）`);
  }
});

// —— G2 数值区间自述（裁定③泛化面）——
// 从 org.js 解析 LIMITS 字面量（const LIMITS 未导出，锚内容而非行号）
function parseLimits(orgSrc) {
  const i = orgSrc.indexOf('const LIMITS = {');
  assert.ok(i >= 0, 'org.js LIMITS 定义存在');
  let depth = 0, j = orgSrc.indexOf('{', i);
  const startIdx = j;
  for (; j < orgSrc.length; j++) {
    if (orgSrc[j] === '{') depth++;
    else if (orgSrc[j] === '}') { depth--; if (depth === 0) break; }
  }
  const body = orgSrc.slice(startIdx + 1, j).replace(/\/\/[^\n]*/g, '');
  const out = new Map();
  for (const m of body.matchAll(/(\w+):\s*([\d][\d_]*)/g)) out.set(m[1], Number(m[2].replaceAll('_', '')));
  return out;
}

test('G2 工具面数值区间自述与域层 LIMITS 一致（§G 泛化：禁止界值双写漂移）【OPS3-CLOSE C2 已翻转转正式：判据见文件头翻转注记】', () => {
  const limits = parseLimits(srcOrg);
  assert.ok(limits.size >= 4, `LIMITS 解析自检非空，实测 ${limits.size}`);
  // 旧形：单引号自述里的数字区间（漂移必可见）；新形：反引号模板引用 1..${LIMITS.KEY}（同源即正确）
  const reLiteral = /(\w+):\s*\{\s*description:\s*'[^']*?(\d+)\.\.(\d+)[^']*'/g;
  const reRef = /(\w+):\s*\{\s*description:\s*`[^`]*?(\d+)\.\.\$\{LIMITS\.(\w+)\}[^`]*`/g;
  // 提取器自检：两种形态各须解析到样张（缺任一形态=失明=本门禁作废）
  const refToken = '$' + '{LIMITS.maxTokens}';
  const sample = `foo: { description: 'n 1..64000 x' },\nbar: { description: \`n 1..${refToken} y\` },`;
  assert.equal([...sample.matchAll(reLiteral)].length, 1, 'G2 提取器自检：单引号数字区间样张必须可解析（旧口径漂移必可见）');
  assert.equal([...sample.matchAll(reRef)].length, 1, 'G2 提取器自检：模板引用区间样张必须可解析（新口径不可见即假绿）');
  const literal = [...srcIndex.matchAll(reLiteral)].map((m) => ({ field: m[1], lo: Number(m[2]), hi: Number(m[3]) }));
  const refs = [...srcIndex.matchAll(reRef)].map((m) => ({ field: m[1], lo: Number(m[2]), refKey: m[3] }));
  assert.ok(literal.length + refs.length >= 1, `G2 提取器自检：工具面应至少解析到 1 处数值区间自述，实测 literal=${literal.length} ref=${refs.length}`);
  for (const { field, hi } of literal) {
    if (!limits.has(field)) continue; // 非 LIMITS 管辖的区间：信息级跳过
    assert.equal(hi, limits.get(field), `${field} 自述上界 ${hi} ≠ 域层 LIMITS.${field}=${limits.get(field)}（工具面与域层双写漂移，§G 同源缺陷族）`);
  }
  for (const { field, refKey } of refs) {
    assert.ok(limits.has(refKey), `${field} 自述模板引用 LIMITS.${refKey}，但域层 LIMITS 无此键（悬空引用，自述失去真值源）`);
  }
});
