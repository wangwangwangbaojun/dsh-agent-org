#!/usr/bin/env node
// dsh-agent-org-role：常驻角色守护进程（角色 daemon）。
// 设计裁定（负责人/用户定调）：组织协同的唯一通道是邮件（messages.jsonl），
// 执行载体是**独立的 headless 一次性角色进程**——不使用任何平台 subagent。
// 本进程本身不调用模型，只做「看门 + 派工 + 回投」，因此零配置即可常驻。
//
// 循环语义（每轮）：
//   1. 读本节点收件箱的「未读」：游标存 runner-state.json（键 orgId/nodeId），
//      与 org_inbox 的游标相互独立——daemon 不动 state.json，Web 未读角标保持完整。
//   2. 取最早一条新邮件作为当前任务，其余留待下轮（一封一任务，简单可审计）。
//   3. 从 org.json 现读人设（systemPrompt/model），组装任务文本（含 hop 护栏）。
//   4. spawn `npx dsh --profile headless <任务文本>`（独立进程，邮件是唯一输入输出）。
//   5. 角色进程的 stdout（最终助手消息）= 结果，回投到发件人收件箱；
//      发件人若是组织内节点 → 以本节点名义 org_send；外部（external）→ 投负责人。
//   6. 无论成败失败都推进游标；失败也要回投一条错误摘要，绝不让任务静默蒸发。
//
// 用法：
//   org-role <nodeId> [--interval 秒] [--org 组织id] [--once]
//              [--profile headless] [--max-tasks 0=不限] [--timeout 秒]
//   停止：Ctrl+C（SIGINT/SIGTERM 干净退出）；或 kill <pid>。
//
// v0.13 新能力：
//   - 自我更新：空闲轮检测到插件源码指纹变化 → 自动 spawn 新代码进程并干净退出（换代无感，游标在盘上）。
//   - 灵感引擎（--inspire N）：空转满 N 分钟自动触发「自主选题干活」headless 任务；成员成果自动抄送负责人。

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------------------------------------------------------------- 配置与工具

/** 简易参数解析：positional[0]=nodeId，--key value / --flag，零依赖。 */
function parseArgs(argv) {
  const out = { _: [], flags: {} };
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token.startsWith('--')) {
      const key = token.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith('--')) { out.flags[key] = next; i += 1; }
      else out.flags[key] = true;
    } else out._.push(token);
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
if (args._.length === 0) {
  console.error('用法：org-role <nodeId> [--interval 秒] [--org 组织id] [--once] [--profile headless] [--max-tasks N] [--timeout 秒]');
  process.exit(2);
}
const SELF_ID = String(args._[0]);
const INTERVAL_S = Number(args.flags.interval ?? 20);
const ORG_FILTER = args.flags.org === true || args.flags.org === undefined ? undefined : String(args.flags.org);
const ONE_SHOT = args.flags.once === true;
const HEADLESS_PROFILE = String(args.flags.profile ?? 'headless');
const MAX_TASKS = Number(args.flags['max-tasks'] ?? 0);
const RUN_TIMEOUT_S = Number(args.flags.timeout ?? 900);
const INSPIRE_MIN = Number(args.flags.inspire ?? 0); // >0 = 灵感引擎：空转满 N 分钟自动构思课题（负责人专用）
const MAX_OUTPUT = 60000; // 角色进程 stdout 截断上限
const MAX_BODY = 6000;    // 单封邮件正文注入上限（防任务文本里塞垃圾撑爆 prompt）
const DEFAULT_HOPS = 6;   // 邮件乒乓护栏：任务默认最多转手次数
const ENV_TASK_ID = 'DSH_ORG_TASK_ID';
const ENV_NODE_ID = 'DSH_ORG_NODE_ID'; // headless 子进程身份：org_report 据此为 reports.jsonl 的 report 行补 from/fromName（谁交付了什么）

const SELF_SCRIPT = fileURLToPath(import.meta.url);

/** 代码指纹：本文件 + 插件 lib 全部源码；与启动时不一致且本角色空闲 → 自我换代。 */
function codeFingerprint() {
  const hash = createHash('sha256');
  const pluginRoot = dirname(dirname(SELF_SCRIPT));
  for (const dir of [join(pluginRoot, 'bin'), join(pluginRoot, 'lib')]) {
    let names = [];
    try { names = readdirSync(dir).filter((n) => n.endsWith('.js')).sort(); } catch { /* 目录缺失跳过 */ }
    for (const name of names) {
      try { hash.update(name).update(readFileSync(join(dir, name))); } catch { /* 半写状态跳过 */ }
    }
  }
  return hash.digest('hex').slice(0, 16);
}

const HOME = homedir();
const orgPath = () => process.env.DSH_AGENT_ORG_PATH || join(HOME, '.dsh', 'agent-org', 'org.json');
const messagesPath = () => join(dirname(orgPath()), 'messages.jsonl');
const reportsPath = () => join(dirname(orgPath()), 'reports.jsonl');
const runnerStatePath = () => join(dirname(orgPath()), 'runner-state.json');
const rolesPath = () => join(dirname(orgPath()), 'roles.json');

/** 心跳：把本角色 daemon 的运行状态原子写进 roles.json（Web「角色工作台」数据源）。 */
function writeHeartbeat(patch) {
  try {
    const key = `${selfOrgId()}/${SELF_ID}`;
    let doc = {};
    try { if (existsSync(rolesPath())) doc = JSON.parse(readFileSync(rolesPath(), 'utf8')) ?? {}; } catch { doc = {}; }
    doc[key] = { ...(doc[key] ?? {}), ...patch, lastBeat: now(), pid: process.pid };
    atomicWriteJson(rolesPath(), doc);
  } catch { /* 心跳尽力而为，不阻塞主循环 */ }
}
let selfOrgIdCache = 'org';
const selfOrgId = () => selfOrgIdCache;

const now = () => new Date().toISOString();
const log = (...parts) => console.log(`[${now()}]`, ...parts);

/** 读 jsonl（容忍半行：最后一行解析失败则丢弃，不影响其余）。 */
function loadJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter((entry) => entry !== null);
}

function atomicWriteJson(path, value) {
  const tmp = `${path}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmp, JSON.stringify(value, null, 2) + '\n');
  renameSync(tmp, path);
}

function loadRunnerState() {
  try {
    if (!existsSync(runnerStatePath())) return {};
    const parsed = JSON.parse(readFileSync(runnerStatePath(), 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch { return {}; }
}

/** 追加消息（语义与插件 appendMessage 对齐：id/ts 生成、字段透传；appendFile 原子追加，与 web 实例并发写安全）。 */
function appendMessage(record) {
  const path = messagesPath();
  mkdirSync(dirname(path), { recursive: true });
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const message = { id, ts: now(), ...record };
  appendFileSync(path, `${JSON.stringify(message)}\n`);
  return message;
}

function appendReport(record) {
  const path = reportsPath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify({ ts: now(), ...record })}\n`);
}

// ---------------------------------------------------------------- 组织解析

/** 找到 SELF_ID 所在组织与节点；找不到抛错（daemon 立即退出，不空转）。 */
function resolveSelf() {
  const doc = JSON.parse(readFileSync(orgPath(), 'utf8'));
  for (const org of doc.orgs ?? []) {
    const node = (org.nodes ?? []).find((entry) => entry.id === SELF_ID);
    if (node !== undefined) {
      if (ORG_FILTER !== undefined && org.id !== ORG_FILTER) continue;
      return { doc, org, node };
    }
  }
  const where = ORG_FILTER === undefined ? '' : `（org=${ORG_FILTER}）`;
  throw new Error(`节点 ${SELF_ID} 不存在${where}，先用 org_chart 核对 id`);
}

// ---------------------------------------------------------------- 任务执行

/** spawn headless 一次性角色进程；返回 {ok, text}。邮件是该进程唯一的输入输出通道。 */
function runHeadless(taskText) {
  return new Promise((resolve) => {
    // detached：npx→sh→dsh 整棵子进程树自成一组分；杀组不留孤儿子进程，
    // 孤儿继承的 stdio 管道也随组终结，daemon 不会被"管道不 close"吊死。
    const child = spawn('npx', ['dsh', '--profile', HEADLESS_PROFILE, taskText], {
      stdio: ['ignore', 'pipe', 'pipe'],
      // 身份注入：本次执行代表 SELF_ID（收件箱任务与灵感任务同构生效），工具端消费见 lib/index.js org_report
      env: { ...process.env, [ENV_NODE_ID]: SELF_ID },
      detached: true,
    });
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (value) => { if (!settled) { settled = true; try { process.kill(-child.pid, 'SIGKILL'); } catch { /* 组已没了 */ } resolve(value); } };
    const timer = setTimeout(() => {
      // 兜底双保险：组杀 + 即便 fd 泄漏让 close 永远不来，结果也已定死
      try { process.kill(-child.pid, 'SIGKILL'); } catch { /* 已退出 */ }
      try { child.kill('SIGKILL'); } catch { /* 已退出 */ }
      finish({ ok: false, output: `角色进程超时（${RUN_TIMEOUT_S}s）已强杀（组级）；stderr 摘要：${stderr.slice(-800)}` });
    }, RUN_TIMEOUT_S * 1000);
    child.stdout.on('data', (chunk) => { stdout += chunk; if (stdout.length > MAX_OUTPUT) finish({ ok: false, output: `输出超上限（${MAX_OUTPUT} 字符）已强杀：${stdout.slice(0, 4000)}` }); });
    child.stderr.on('data', (chunk) => { stderr += chunk; });
    child.on('error', (cause) => { clearTimeout(timer); finish({ ok: false, output: `无法启动角色进程：${cause.message}` }); });
    child.on('close', (code) => {
      clearTimeout(timer);
      if (stdout.trim() === '') finish({ ok: false, output: `角色进程退出码 ${code}，无输出；stderr 摘要：${stderr.slice(-800)}` });
      else finish({ ok: true, output: stdout.trim() });
    });
  });
}

/** 组装注入给 headless 角色的任务文本：人设 + 协作纪律 + 邮件原文。 */
function buildTaskText({ selfNode, org, message, hopLimit }) {
  const persona = String(selfNode.systemPrompt ?? '').trim();
  const senderLabel = message.from === 'external' ? '外部指令方' : `节点 ${message.fromName ?? message.from}`;
  const body = String(message.content ?? '');
  // 结果回传通知：不是新任务。若无需推进，角色回 [系统确认] 开头，daemon 抑制回投，链路就此收束。
  const isNotice = body.startsWith('[任务完成') || body.startsWith('[任务失败');
  const noticeLine = isNotice
    ? '- ⚠️ 这是你此前任务的结果回传通知，**不是新任务**。若无需进一步动作：最终回复以 [系统确认] 开头、一行「收到」即可（daemon 检测到该前缀不会再回投）；若需要推进（汇总/验收/继续派单）则正常处理。'
    : '';
  const replyLine = message.from === 'external'
    ? '- 结果请调用 org_report（to="lead" 或本组织负责人节点 id）留痕，一句话总结；同时你的最终回复正文会被 daemon 自动回投外部通道。'
    : `- 结果通过 org_send 回给发件人：to="${message.from}"，content 为结论或交付物（daemon 也会把你的最终回复自动回投一封，勿重复长篇）。`;
  return [
    persona === '' ? '你是团队的一名成员角色，按任务要求完成工作。' : persona,
    '',
    '——————',
    '【当前任务（来自你的收件箱）】',
    `发件人：${senderLabel}；任务 id=${message.id}`,
    `任务正文（原样投递）：`,
    '"""',
    body.slice(0, MAX_BODY),
    '"""',
    noticeLine,
    '',
    '【协作纪律（角色 daemon 规约，必须遵守）】',
    '- 你运行在无头一次性进程中，组织协同**只允许**通过 org_* 工具：org_inbox 查件、org_send 沟通、org_delegate 登记委派、org_report 留痕、org_chart/org_node_get 查组织。',
    '- **禁止**使用 subagent / task / workflow / ralph 等平台派生 agent 的工具——成员协同只能用邮件（这是本组织的硬性裁定）。',
    '- 需要成员干活：把任务用 org_send 投给目标节点（其 daemon 会自动唤醒处理），不要自己幻想成员过程。',
    replyLine,
    `- 转手护栏：本任务剩余 hop=${hopLimit}。转手（org_send 派活）时请在 content 末尾附「[hop:N]」（N=剩余-1）；收到含 [hop:0] 的任务必须停止转手、就地收尾汇报。`,
    '- 文件操作遵守任务里的边界；不要重启任何 dsh 服务；不要修改 ~/.dsh/agent-org 下非工具产生的文件。',
    '- 你的最终回复 = 任务结果正文（daemon 据此回投），请自包含、可被发件人直接使用。',
  ].join('\n');
}

/** 从邮件正文提取 [hop:N]；缺省用默认额度。 */
function readHop(content) {
  const matches = String(content ?? '').match(/\[hop:(\d+)\]/g);
  if (matches === null || matches.length === 0) return DEFAULT_HOPS;
  const last = matches[matches.length - 1].match(/(\d+)/);
  return Math.max(0, Number(last?.[1] ?? DEFAULT_HOPS));
}

// ---------------------------------------------------------------- 灵感引擎

/** 空转时的自主课题任务文本：让角色自己找灵感、自己立项干活。 */
function buildInspireText({ selfNode, org }) {
  const persona = String(selfNode.systemPrompt ?? '').trim();
  const isLead = org.rootNodeId === SELF_ID;
  return [
    persona === '' ? '你是团队的一名成员角色。' : persona,
    '',
    '——————',
    '【自主灵感时段（无新邮件，daemon 触发）】',
    '现在没有人给你派活。你的任务是**自己找灵感、自己立项、自己干活**，让团队的存在产生真实价值。本轮要求：',
    '1. 观察与构思：结合你的角色职责，审视本机环境与团队现状（可用只读命令/工具调研），提出一个**小而完整**、一两小时内能看到东西的课题（工具、脚本、文档、实验、对团队自身的改进皆可）；',
    '2. 立项留痕：用 org_report 向负责人（to="' + org.rootNodeId + '"）提交一句话课题立项；',
    isLead
      ? '3. 你是负责人：把可分派的工作用 org_send 拆给合适成员（附 [hop:5]），需要调整团队（加角色/改人设/改连线）时用 org_mutate 自助编排，不要自己写业务代码；'
      : '3. 干活：就地完成课题（写代码/文档到 ~/workspace/项目/自主灵感/' + SELF_ID + '/ 下，文件即交付物），过程中需要成员配合可用 org_send 投递（附 [hop:4]）；',
    '4. 收尾：完成后用 org_report 留痕一句话成果（做了啥、放在哪、下一步）。',
    '纪律：不做破坏性操作（不删他人文件、不重启服务、不改 ~/.dsh/agent-org 手工数据）；课题要具体，禁止空转汇报「已思考」。',
    '灵感方向参考（可自由发挥）：给团队补一个缺失角色 / 优化你们协作的邮件协议 / 给 org-doctor 交付物补测试 / 写一份本机环境体检工具 / 复盘 reports.jsonl 里的协作效率。',
  ].join('\n');
}

// ---------------------------------------------------------------- 主循环

async function main() {
  let self = resolveSelf();
  selfOrgIdCache = self.org.id;
  // 首发游标：--from-now=false 才追旧信；默认从当前末尾起（旧unread 不算新任务，防止历史工单重放）
  if (args.flags['from-now'] !== 'false') {
    const bootstrap = loadJsonl(messagesPath()).filter((m) => m.to === SELF_ID && m.from !== SELF_ID);
    if (bootstrap.length > 0) {
      const st = loadRunnerState();
      st[`${self.org.id}/${SELF_ID}`] = bootstrap[bootstrap.length - 1].id;
      atomicWriteJson(runnerStatePath(), st);
      log(`首发游标定位到当前末尾（${bootstrap.length} 封历史未读不追，除非 --from-now=false）`);
    }
  }
  writeHeartbeat({ name: self.node.name, orgName: self.org.name, intervalS: INTERVAL_S, status: 'idle', busy: null, tasksDone: 0 });
  log(`角色 daemon 启动：${self.org.name}·${self.node.name}（${SELF_ID}）｜轮询 ${INTERVAL_S}s｜headless profile=${HEADLESS_PROFILE}｜pid=${process.pid}`);
  let processed = 0;
  let stopping = false;
  let startFingerprint = codeFingerprint();
  let lastActiveAt = Date.now();
  const selfRestart = () => {
    appendReport({ type: 'run', to: SELF_ID, toOrg: selfOrgId(), from: 'system', node: SELF_ID, action: 'upgrade', summary: `⚙ 检测到插件代码更新（${startFingerprint}→${codeFingerprint()}），空闲换代重启` });
    log('检测到插件代码更新，空闲自我换代：spawn 新进程后干净退出');
    const child = spawn(process.execPath, [SELF_SCRIPT, ...process.argv.slice(2)], { detached: true, stdio: 'inherit', cwd: dirname(SELF_SCRIPT) });
    child.unref();
    writeHeartbeat({ status: 'stopped' });
    process.exit(0);
  };
  const stop = (sig) => { if (!stopping) { stopping = true; log(`收到 ${sig}，本任务完成后退出`); } };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop('SIGTERM'));

  while (!stopping) {
    let snapshot;
    try {
      snapshot = readFileSync(messagesPath(), 'utf8');
    } catch { snapshot = ''; }
    const inbox = loadJsonl(messagesPath()).filter((message) => message.to === SELF_ID && message.from !== SELF_ID);
    const state = loadRunnerState();
    const key = `${self.org.id}/${SELF_ID}`;
    const cursor = state[key];
    const fresh = cursor === undefined ? inbox : inbox.slice(inbox.findIndex((message) => message.id === cursor) + 1);
    // 半行竞态：daemon 刚回投后立刻再读，最后一行可能未刷完——找不到游标 id 时本轮跳过，下轮再试
    if (cursor !== undefined && inbox.findIndex((message) => message.id === cursor) === -1) log('游标未命中（可能半行竞态），本轮跳过');
    else if (fresh.length > 0) {
      const message = fresh[0];
      processed += 1;
      const hopLimit = readHop(message.content);
      log(`任务开始 ${message.id} ← ${message.fromName ?? message.from}（hop=${hopLimit}，第 ${processed} 单）`);
      writeHeartbeat({ status: 'busy', busy: message.id });
      appendReport({ type: 'run', to: SELF_ID, toOrg: self.org.id, from: message.from, fromName: message.fromName, fromOrg: message.fromOrg, node: SELF_ID, taskId: message.id, action: 'start', summary: `⚙ 开工：接 ${message.fromName ?? message.from} 任务 ${message.id}` });
      let result;
      // 任务执行期间维持心跳（否则长任务会被 Web 工作台误判失联）
      const keepBeat = setInterval(() => writeHeartbeat({ status: 'busy', busy: message.id }), 10000);
      keepBeat.unref?.();
      try {
        result = await runHeadless(buildTaskText({ selfNode: self.node, org: self.org, message, hopLimit }));
      } catch (cause) {
        result = { ok: false, output: `daemon 执行异常：${cause?.message ?? cause}` };
      } finally {
        clearInterval(keepBeat);
      }
      // 回投：组织内节点→以本节点名义；外部→投负责人（外部没有收件箱语义，负责人是默认落点）
      // [系统确认] 开头的纯确认不投——防两角色对结果通知互相回投成环
      const suppressed = result.output.trimStart().startsWith('[系统确认]');
      const externalReply = message.from === 'external';
      const target = externalReply
        ? (() => { const lead = self.org.nodes.find((entry) => entry.id === self.org.rootNodeId); return lead ?? self.node; })()
        : (self.org.nodes.find((entry) => entry.id === message.from) ?? null);
      if (target !== null && target !== undefined && !suppressed) {
        const body = `[任务${result.ok ? '完成' : '失败'} ${message.id}] 来自 ${self.node.name}：\n${result.output.slice(0, 8000)}`;
        appendMessage({
          from: SELF_ID, fromName: self.node.name, fromOrg: self.org.id,
          to: target.id, toName: target.name, toOrg: self.org.id, content: body,
        });
      }
      appendReport({ type: 'run', to: SELF_ID, toOrg: self.org.id, from: message.from, fromOrg: message.fromOrg, node: SELF_ID, taskId: message.id, action: result.ok ? 'done' : 'error', ok: result.ok, summary: `⚙ ${result.ok ? '完工' : '出错'}：任务 ${message.id}${suppressed ? '（确认类，未回投）' : target !== null && target !== undefined ? ` → 回投${target.name}` : ''}` });
      const next = { ...loadRunnerState(), [key]: message.id };
      atomicWriteJson(runnerStatePath(), next);
      writeHeartbeat({ status: 'idle', busy: null, tasksDone: processed, lastTask: message.id });
      lastActiveAt = Date.now(); // 灵感计时从最后一次真实活动起算
      log(`任务结束 ${message.id}（ok=${result.ok}，${suppressed ? '[系统确认] 已抑制回投' : target !== null && target !== undefined ? `已回投→${target.name}` : '无有效回投目标'}）`);
      if (MAX_TASKS > 0 && processed >= MAX_TASKS) { log(`达到 max-tasks=${MAX_TASKS}，退出`); break; }
      continue;
    }
    if (ONE_SHOT) break;
    // 自我更新：代码变了且此刻空闲 → 换代 re-exec（任务执行中永远不换）
    if (codeFingerprint() !== startFingerprint) selfRestart();
    // 灵感引擎：空转满 N 分钟 → 自主构思课题开工（执行/回投/心跳与收件箱任务同构）
    if (INSPIRE_MIN > 0 && Date.now() - lastActiveAt >= INSPIRE_MIN * 60000) {
      lastActiveAt = Date.now();
      processed += 1;
      const inspireId = `inspire-${Date.now().toString(36)}`;
      log(`灵感引擎触发（空转满 ${INSPIRE_MIN} 分钟，第 ${processed} 单）`);
      writeHeartbeat({ status: 'busy', busy: '灵感时段' });
      appendReport({ type: 'run', to: SELF_ID, toOrg: self.org.id, from: 'system', node: SELF_ID, taskId: inspireId, action: 'start', summary: `💡 灵感时段开工：自主选题干活` });
      const keepBeat = setInterval(() => writeHeartbeat({ status: 'busy', busy: '灵感时段' }), 10000);
      keepBeat.unref?.();
      let result;
      try { result = await runHeadless(buildInspireText({ selfNode: self.node, org: self.org })); }
      catch (cause) { result = { ok: false, output: `daemon 执行异常：${cause?.message ?? cause}` }; }
      finally { clearInterval(keepBeat); }
      const lead = self.org.nodes.find((entry) => entry.id === self.org.rootNodeId) ?? self.node;
      if (SELF_ID !== self.org.rootNodeId) {
        appendMessage({ from: SELF_ID, fromName: self.node.name, fromOrg: self.org.id, to: lead.id, toName: lead.name, toOrg: self.org.id, content: `[灵感成果 ${inspireId}] 来自 ${self.node.name}：\n${result.output.slice(0, 6000)}` });
      }
      appendReport({ type: 'run', to: SELF_ID, toOrg: self.org.id, from: 'system', node: SELF_ID, taskId: inspireId, action: result.ok ? 'done' : 'error', ok: result.ok, summary: `💡 灵感时段${result.ok ? '收工' : '出错'}：${result.output.replace(/\s+/g, ' ').slice(0, 90)}` });
      writeHeartbeat({ status: 'idle', busy: null, tasksDone: processed, lastTask: inspireId });
      if (MAX_TASKS > 0 && processed >= MAX_TASKS) { log(`达到 max-tasks=${MAX_TASKS}，退出`); break; }
      continue;
    }
    writeHeartbeat({ status: 'idle' });
    // 可中断 sleep：轮询间隙收到停止信号立即退出
    const deadline = Date.now() + INTERVAL_S * 1000;
    while (!stopping && Date.now() < deadline) await new Promise((done) => setTimeout(done, Math.min(500, deadline - Date.now())));
    // 人设/组织可能改了：每轮开头重读（轻量 json 读，保证 daemon 与组织树同源）
    try { self = resolveSelf(); } catch (cause) { log(`组织重解析失败（继续用旧人设）：${cause.message}`); }
  }
  log('角色 daemon 已退出');
  writeHeartbeat({ status: 'stopped' });
  process.exit(0);
}

main().catch((cause) => { console.error('daemon 启动失败：', cause?.message ?? cause); process.exit(1); });
