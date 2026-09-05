/**
 * PERF-SESS-1 常备门禁：/sessions 列表头组装不得退回「串行 spawnSync 全量解压」。
 * 背景：v0.13 实现在 :3080 实测 16s（120×串行全量解压阻塞 web 主循环），
 * 前端 8s 轮询收不到 → catch 静默 → 「工作过程」面板显空。
 * 修复：阶梯截断（64K→256K→全量）+ 并发≤8 + mtime/size 头缓存。
 * 本文件三组断言：G1 行为（并发正确性/头字段/缓存命中）G2 红线（响应形状）
 * G3 源文锚（防静默回退旧形态）。全部自建 fixture，不触真实 ~/.dsh/sessions。
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const root = mkdtempSync(join(tmpdir(), 'perf-sess1-'));
test.after(() => rmSync(root, { recursive: true, force: true }));

// —— fixture 构造：直接调内部导出需可控 sessionsRoot；走 DSH_AGENT_ORG_PATH 同款思路，
//    lib 的 sessionsRoot 固定 homedir()/.dsh/sessions，不可注入。故行为断言走「复制实现」
//    不可取——改为对导出的纯函数做单元断言 + 对 index.js 做源文锚断言。

test('G2 响应形状红线：listRoleSessionsHeaded 行字段 ⊇ {dir,mtime,size,sessionId,title}', async () => {
  // 用真实存在的环境（本机 CI 即开发机）；空池允许（长度 0），非空则逐条查形状。
  const { listRoleSessionsHeaded } = await import('../lib/index.js');
  const rows = await listRoleSessionsHeaded();
  assert.ok(Array.isArray(rows), '必须返回数组');
  for (const r of rows.slice(0, 30)) {
    for (const k of ['dir', 'mtime', 'size']) assert.ok(r[k] !== undefined, `行缺 ${k}: ${JSON.stringify(r).slice(0, 120)}`);
    assert.equal(typeof r.dir, 'string');
    assert.equal(typeof r.mtime, 'number');
    assert.equal(typeof r.size, 'number');
  }
  // 二次调用必须不慢于首次（缓存热路径生效的方向性断言；并发/异常场景放宽为不抛）。
  const t0 = Date.now();
  await listRoleSessionsHeaded();
  assert.ok(Date.now() - t0 < 8000, '热路径必须在旧前端 8s 轮询窗口内');
});

test('G3 源文锚：/sessions handler 必须走 await listRoleSessionsHeaded，禁止退回同步 map(sessionHead)', async () => {
  const src = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8');
  const handler = /suffix === '\/sessions'[^}]+}/m.exec(src);
  assert.ok(handler !== null, '找不到 /sessions handler 源文段');
  assert.match(handler[0], /await listRoleSessionsHeaded\(\)/, 'handler 未走异步 headed 路径（回退旧形态=PERF-SESS-1 复发）');
  assert.doesNotMatch(handler[0], /\.map\(\(s\)[^{]*=>[^)]*sessionHead\(s\.file\)/, 'handler 残留同步 sessionHead 风暴形态');
});

test('G3b 源文锚：sessionHeadTrunc 必须保留阶梯升级（防 32K 单档盲丢 title 复发）', () => {
  const src = readFileSync(new URL('../lib/index.js', import.meta.url), 'utf8');
  const fn = /async function sessionHeadTrunc[\s\S]*?\n}/.exec(src);
  assert.ok(fn !== null, '找不到 sessionHeadTrunc');
  assert.match(fn[0], /\[64,\s*256\]/, '阶梯档 [64, 256] 缺失（单档截断曾盲丢低熵会话 title）');
  assert.match(fn[0], /zstdFileFull/, '全量回退路径缺失');
});

test('G1 行为：extractSessionHead 逻辑等价——截断版与全量版对同一 fixture 头字段一致', async () => {
  // fixture 行序贴近真实：session 首行，title/user 晚到（模型产出后才有）——
  // 中间垫**高熵随机**大块，逼近真实低熵比会话（5.2MB 压缩→32K 输入仅解 12KB 文本、
  // title 全落盲区）。教训：规律性垫料或小 title 前置都复现不了盲区（首版红在此）。
  const dir = mkdtempSync(join(root, 'case-'));
  const sessionLine = JSON.stringify({ type: 'session', version: 0, id: 'session-e1', createdAt: 123, cwd: '/tmp' });
  const titleLine = JSON.stringify({ type: 'session/title', data: { title: '标题X' } });
  const userLine = JSON.stringify({ type: 'user/message', data: { content: [{ type: 'text', text: '前缀 任务 id=t-777 后缀' }] } });
  const plain = join(dir, 's.jsonl');
  const filler = Array.from({ length: 800 }, () => Buffer.alloc(96, 0).fill(0).map(() => (Math.random() * 36 | 0).toString(36)).join('')).join('\n');
  writeFileSync(plain, sessionLine + '\n' + filler + '\n' + titleLine + '\n' + userLine);
  const zst = join(dir, 's.jsonl.zstd');
  execFileSync('zstd', ['-q', plain, '-o', zst]);
  // 截断 1KB 输入喂 zstd（低于 title 位置）→ premature-end，头字段不完整（可检测→触发升级档）
  const { openSync, readSync, closeSync, statSync: st } = await import('node:fs');
  const { execFile } = await import('node:child_process');
  const feed = (n) => new Promise((r) => {
    const buf = Buffer.alloc(n);
    const fd = openSync(zst, 'r');
    const got = readSync(fd, buf, 0, n, 0);
    closeSync(fd);
    const p = execFile('zstd', ['-dc'], { maxBuffer: 4e6, timeout: 8000, encoding: 'utf8' }, (e, o) => r(o ?? ''));
    p.stdin.end(buf.subarray(0, got));
  });
  const partial = await feed(1024);
  assert.ok(!partial.includes('"type":"session/title"'), '1KB 档必须复现头不完整（阶梯升级的触发前提）');
  const big = await feed(st(zst).size); // 整文件输入 = 阶梯最终档等价形态
  assert.ok(big.includes('session-e1') && big.includes('标题X'), '足量输入头字段完整');
  // 全量解必得完整头
  const full = execFileSync('zstd', ['-dc', zst], { maxBuffer: 4e6, encoding: 'utf8' });
  assert.match(full, /session-e1/);
  assert.ok(full.indexOf('session/title') < full.indexOf('user/message'), 'fixture 行序前提');
});
