// 导入版本防线契约测试（评审改判 E/F；依据=架构师裁定全文 mth2w93x + 摘要 mth2x7h1）。
// 钉死验收要点：② 拒收走 4xx + 结构化错误体 {code:"UNSUPPORTED_SCHEMA_VERSION", found, supported_max}；
// ③ 「文件损坏/不匹配」与「版本过新」分错误码（ORG_FILE_CORRUPT vs UNSUPPORTED_SCHEMA_VERSION）；
// ⑤ 版本口径测试与 README 的「支持 1..2」互为锚点（/1\.\.2/）。
// 运行：npm test（= node --test）。所有落盘路径经 DSH_AGENT_ORG_PATH 重定向到临时目录，绝不碰 ~/.dsh/agent-org。
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { OrgError, SCHEMA_VERSION, loadOrg, prepareDoc } from '../lib/org.js';

// —— ① 版本白名单：白名单外一切形态拒收，错误码稳定、文案写明支持范围（评审给的钉死口径，原样保留）——
const good = () => ({ schemaVersion: 2, orgs: [{ id: 'o', name: 'n', rootNodeId: 'a', nodes: [{ id: 'a', parentId: null, name: 'A' }] }] });
for (const bad of [3, 2.5, '3', null, -1, NaN, undefined]) {
  test(`版本 ${String(bad)} → 拒收 UNSUPPORTED_SCHEMA_VERSION`, () => {
    const d = good();
    if (bad === undefined) delete d.schemaVersion; else d.schemaVersion = bad;
    assert.throws(() => prepareDoc(d), (err) => err.code === 'UNSUPPORTED_SCHEMA_VERSION' && /1\.\.2/.test(err.message));
  });
}

// —— ②（验收②）拒收错误体结构化：status=422 + detail={found, supported_max}，客户端无需匹配中文文案 ——
test('拒收错误携带 422 + {found, supported_max}（机器可判因）', () => {
  const d = good();
  d.schemaVersion = 3;
  let err;
  try { prepareDoc(d); } catch (e) { err = e; }
  assert.ok(err instanceof OrgError, '应为 OrgError');
  assert.equal(err.code, 'UNSUPPORTED_SCHEMA_VERSION');
  assert.equal(err.status, 422);
  assert.deepEqual(err.detail, { found: 3, supported_max: SCHEMA_VERSION });
});

test('早拒发生在任何原地 mutation 之前（抛错后入参未被 normalize 污染）', () => {
  const d = good();
  d.schemaVersion = 99;
  const snapshot = JSON.stringify(d);
  assert.throws(() => prepareDoc(d), (err) => err.code === 'UNSUPPORTED_SCHEMA_VERSION');
  assert.equal(JSON.stringify(d), snapshot, '拒收路径不得原地改写入参');
});

// —— ②（验收⑤·迁移）v1 合法单组织档 → 迁移产出合法 v2，节点原始 id 逐字节保留（外键不变量）——
test('v1 合法单组织档 → 迁移产出合法 v2 且节点原 id 逐字节保留', () => {
  const v1 = {
    schemaVersion: 1,
    organization: { id: 'org', name: '我的 AI 团队', rootNodeId: 'lead' },
    nodes: [
      { id: 'lead', parentId: null, name: '负责人', title: '总体协调' },
      { id: 'arch-01／张', parentId: 'lead', name: '架构师' }, // 全角斜杠 + 汉字：逐字节保留的强样本
      { id: 'be 02', parentId: 'arch-01／张', name: '后端' },
    ],
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
  const before = v1.nodes.map((n) => n.id);
  const doc = prepareDoc(v1); // 内部已 validate：产出非法 v2 会直接抛，等价断言「合法」
  assert.equal(doc.schemaVersion, 2);
  assert.equal(doc.orgs.length, 1);
  assert.equal(doc.orgs[0].rootNodeId, 'lead');
  const after = doc.orgs[0].nodes.map((n) => n.id);
  assert.deepEqual(after, before, 'id 序列与内容须逐字节一致');
  assert.deepEqual(Buffer.from(after.join('\u0000'), 'utf8'), Buffer.from(before.join('\u0000'), 'utf8'));
});

// —— ③（验收⑤·直通）v2 合法档 → 原样通过 ——
test('v2 合法档 → 原样通过', () => {
  const d = good();
  const doc = prepareDoc(d);
  assert.equal(doc.schemaVersion, 2);
  assert.equal(doc.orgs[0].id, 'o');
  assert.deepEqual(doc.orgs[0].nodes.map((n) => n.id), ['a']);
});

// —— ③（验收③）「文件损坏」与「版本过新」分错误码（loadOrg 单元层）——
test('磁盘 JSON 损坏 → ORG_FILE_CORRUPT（与 UNSUPPORTED_SCHEMA_VERSION 分码）', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-org-test-'));
  const p = join(dir, 'org.json');
  writeFileSync(p, '{ not valid json');
  let err;
  try { loadOrg(p); } catch (e) { err = e; }
  assert.ok(err instanceof OrgError, '应为 OrgError');
  assert.equal(err.code, 'ORG_FILE_CORRUPT');
  assert.notEqual(err.code, 'UNSUPPORTED_SCHEMA_VERSION');
});

// —— 验收②③ 的 HTTP 落点：真实 route handler（假 ctx 装载，DSH_AGENT_ORG_PATH 重定向到临时目录，零真实写入面）——
const bootRoute = async () => {
  const { apply } = await import('../lib/index.js');
  const routes = [];
  const ctx = {
    systemPrompt: { section: () => () => {} },
    effect: (fn) => { fn(); },
    reflect: { get: (service) => (service === 'webServer' ? { register: (r) => routes.push(r) } : undefined) },
    on: () => {},
  };
  apply(ctx, {});
  return routes[0].handler;
};
const fakeRes = () => ({ statusCode: 0, body: '', writeHead(status) { this.statusCode = status; }, end(b) { this.body = b; } });
const fakeReq = (method, suffix, body) => {
  const req = { method, url: `/dsh-agent-org/v1${suffix}`, headers: { host: 'localhost:5399', 'content-type': 'application/json' } };
  if (body !== undefined) req[Symbol.asyncIterator] = async function * () { yield Buffer.from(JSON.stringify(body)); };
  return req;
};

test('HTTP：POST /import schemaVersion=3 → 422 + 结构化错误体（不再只有中文文案可匹配）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-org-http-'));
  process.env.DSH_AGENT_ORG_PATH = join(dir, 'org.json'); // 拒收先于一切落盘，重定向是双保险
  try {
    const handler = await bootRoute();
    const res = fakeRes();
    await handler(fakeReq('POST', '/import', { ...good(), schemaVersion: 3 }), res);
    assert.equal(res.statusCode, 422);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.ok, false);
    assert.equal(parsed.error.code, 'UNSUPPORTED_SCHEMA_VERSION');
    assert.equal(parsed.error.found, 3);
    assert.equal(parsed.error.supported_max, SCHEMA_VERSION);
    assert.match(parsed.error.message, /1\.\.2/);
  } finally {
    delete process.env.DSH_AGENT_ORG_PATH;
  }
});

test('HTTP：GET /org 遇损坏文件 → 400 + ORG_FILE_CORRUPT（与过新分码）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-org-http-'));
  const p = join(dir, 'org.json');
  writeFileSync(p, '{ broken');
  process.env.DSH_AGENT_ORG_PATH = p;
  try {
    const handler = await bootRoute();
    const res = fakeRes();
    await handler(fakeReq('GET', '/org'), res);
    assert.equal(res.statusCode, 400);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.error.code, 'ORG_FILE_CORRUPT');
  } finally {
    delete process.env.DSH_AGENT_ORG_PATH;
  }
});

test('HTTP：正常 v2 档经 /import 仍 200 落盘（同管线零回归，写向临时目录）', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dsh-org-http-'));
  process.env.DSH_AGENT_ORG_PATH = join(dir, 'org.json');
  try {
    const handler = await bootRoute();
    const res = fakeRes();
    await handler(fakeReq('POST', '/import', good()), res);
    assert.equal(res.statusCode, 200);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.ok, true);
    assert.equal(parsed.org.orgs[0].nodes[0].id, 'a');
  } finally {
    delete process.env.DSH_AGENT_ORG_PATH;
  }
});

// ============================================================================
// 导入强确认框文案防线（架构师顺手项 b；源自导入终审 mthwmglk / mtk3j8f4 跟进单）
// 背景：覆盖导入是不可逆的 P0 风险面——替换全部组织（含位置与连线）、本机历史消息按节点 id
// 挂靠到导入节点、未读/daemon 游标错位，全部安全交底只压在 lib/client.js 这一句
// window.confirm('覆盖导入…') 上；而全库此前对该文案零断言（grep -rn "游标|挂到导入节点|
// 归档重置|覆盖导入" test/ 无命中），存在被静默回改的风险。
// 口径：先定位该 confirm 的字符串字面量，再用一条整体正则按语义顺序锁定
// 「覆盖导入 … 游标 … 按节点 id … 归档重置 … 继续？」，三关键词缺一即红（防只改其一的部分回退）；
// 并以变异自检验证这条防线真的会咬人，而非空跑通过。纯测试代码，不触碰业务实现。
// ============================================================================

const CLIENT_URL = new URL('../lib/client.js', import.meta.url);

// 提取所有 window.confirm(<字符串字面量>) 的字面量正文；容忍 ' / " / ` 三种引号与换行缩进写法。
const confirmLiterals = (src) => {
  const re = /window\.confirm\(\s*(['"`])((?:(?!\1)[\s\S])*)\1\s*\)/g;
  return [...src.matchAll(re)].map((m) => m[2]);
};
// 覆盖导入确认框的唯一识别子（按文案首词，不按行号——行号会随手改漂移）。
const importConfirm = (src) => confirmLiterals(src).filter((t) => t.includes('覆盖导入'));
// 整体锁定正则：三关键词按语义顺序锁进同一段文案，回改任意一处即整体失配。
const RISK_PHRASE = /覆盖导入[\s\S]*?游标[\s\S]*?按节点\s*id[\s\S]*?归档重置[\s\S]*?继续？/;
const RISK_KEYWORDS = ['游标', '按节点 id', '归档重置'];

// —— 用例 1（正常路径）：真源文件中该 confirm 文案段唯一、三关键词齐备、整体正则命中 ——
test('源码文案防线：覆盖导入 confirm 同时含「游标 / 按节点 id / 归档重置」', async () => {
  const src = await readFile(CLIENT_URL, 'utf8');
  const all = confirmLiterals(src);
  assert.ok(all.length > 1, '前提：client.js 应存在多条 confirm（用于验证提取特异性）');
  const imp = importConfirm(src);
  assert.equal(imp.length, 1, `应恰好定位到 1 条覆盖导入 confirm，实测 ${imp.length} 条`);
  const seg = imp[0];
  for (const k of RISK_KEYWORDS) {
    assert.ok(seg.includes(k), `覆盖导入 confirm 缺少风险交底关键词「${k}」；实测文案：${seg}`);
  }
  assert.match(seg, RISK_PHRASE);
});

// —— 用例 2（边界）：提取器对引号风格/换行缩进容忍，且不把其他 confirm 误判为导入框 ——
test('边界：confirm 文案提取器容忍引号与换行写法，且不误取非导入确认框', () => {
  const text = '覆盖导入将替换全部组织，不含未读/daemon 游标——历史消息按节点 id 挂靠，请先归档重置。继续？';
  const variants = [
    `if (!window.confirm('${text}')) return;`,
    `if (!window.confirm("${text}")) return;`,
    'if (!window.confirm(`' + text + '`)) return;',
    'if (!window.confirm(\n        \'' + text + '\'\n      )) return;',
  ];
  for (const [i, v] of variants.entries()) {
    const imp = importConfirm(v);
    assert.equal(imp.length, 1, `变体 ${i} 应提取到 1 条导入 confirm`);
    assert.match(imp[0], RISK_PHRASE, `变体 ${i} 文案段整体正则应命中`);
  }
  // 特异性：删除类/排布类 confirm 不得被当成导入框（否则防线会挂错对象上、真导入框漏测）
  const others = [
    "if (!window.confirm('按上下级层级重新排布全部节点？手动拖动的位置会被覆盖。')) return;",
    "if (window.confirm(`删除组织「${'x'}」及其全部 3 个节点？此操作不可撤销。`)) return;",
  ].join('\n');
  assert.deepEqual(importConfirm(others), [], '非导入 confirm 不得命中识别子');
});

// —— 用例 3（错误路径·变异自检）：三关键词任一被静默回改，防线必须变红（拒绝 vacuous pass）——
test('错误路径：三关键词任一被回改即判红，且提取不到导入框不得被当作通过', async () => {
  const src = await readFile(CLIENT_URL, 'utf8');
  const seg = importConfirm(src)[0];
  assert.ok(seg, '用例 1 应已保证导入框存在');
  const mutants = [
    ['「游标」被删（沟通留痕 / 未读 daemon 游标语义丢失）', seg.replace('游标', '')],
    ['「按节点 id」写成「按节点ID」（挂靠外键口径变形、不可检索）', seg.replace(/按节点\s*id/, '按节点ID')],
    ['「归档重置」指引被删（有历史留痕实例失去补救路径）', seg.replace('归档重置', '备份')],
  ];
  for (const [why, m] of mutants) {
    assert.notEqual(m, seg, `变异样本失效（源文案已漂移，请同步变异样本）：${why}`);
    assert.doesNotMatch(m, RISK_PHRASE, `变异体本应判红却通过：${why}`);
  }
  // 提取不到导入框 = 防线失去对象，必须显式判红而非静默通过
  assert.equal(importConfirm('const a = 1;').length, 0);
  assert.equal(importConfirm("window.confirm('确定删除？')").length, 0);
});

// —— 用例 4（边界·时序）：强确认必须发生在 /import 请求发出之前（点完确认才可能落盘）——
test('边界：覆盖导入 confirm 位于 fetch(/import) 之前，确认框仍是写入前的闸', async () => {
  const src = await readFile(CLIENT_URL, 'utf8');
  const at = src.indexOf("window.confirm('覆盖导入");
  const fetchAt = src.indexOf("fetch(API + '/import'");
  assert.ok(at >= 0, '未找到覆盖导入 confirm');
  assert.ok(fetchAt >= 0, "未找到 fetch(API + '/import' 调用点");
  assert.ok(at < fetchAt, `确认框须先于导入请求：confirm@${at} vs fetch@${fetchAt}`);
});
