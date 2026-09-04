/**
 * dsh-agent-org host half（多组织版）：
 * - 多棵 agent 组织树的 JSON 持久化（~/.dsh/agent-org/org.json，DSH_AGENT_ORG_PATH 可覆盖；v1 自动迁移）
 * - HTTP 管理 API（/dsh-agent-org/v1，供 Web 设置页调用，同源/回环防护）
 * - agent 工具：org_chart / org_node_get / org_delegate / org_report / org_task / org_send / org_inbox / org_create / org_delete / org_mutate
 *   + v0.14 团队调度四工具：org_team_plan / org_team_status / org_team_talk / org_team_done（lib/team.js 内核）
 * - 角色工作过程只读视图（/sessions、/session）：解析 headless 会话 zstd 转录，Web「工作过程」Tab 主对话式渲染思考/工具流
 * - systemPrompt 使用指引小节
 */
import { appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { OrgError, backupOrg, byId, chainOf, loadOrg, mutate, orgOfNode, prepareDoc, renderChart, saveOrg } from './org.js';
import { completeTask, planTeam, readTeamSnapshot, recomputeAndDispatch, statusText, teamPathFor, zeroStats } from './team.js';

export const name = 'dsh-agent-org';
export const inject = ['systemPrompt'];

const API_ROOT = '/dsh-agent-org/v1';
const GUIDE_ORDER = 60;

function orgPath() {
  return process.env.DSH_AGENT_ORG_PATH || join(homedir(), '.dsh', 'agent-org', 'org.json');
}

function reportsPath() {
  return join(dirname(orgPath()), 'reports.jsonl');
}

function messagesPath() {
  return join(dirname(orgPath()), 'messages.jsonl');
}

function statePath() {
  return join(dirname(orgPath()), 'state.json');
}

function rolesPath() {
  return join(dirname(orgPath()), 'roles.json');
}

/** 角色 daemon 心跳（缺失/损坏 = 空对象，绝不影响 feed 主数据）。 */
function loadRoles() {
  try {
    if (!existsSync(rolesPath())) return {};
    const parsed = JSON.parse(readFileSync(rolesPath(), 'utf8'));
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch { return {}; }
}

// ———— 角色工作过程（session transcripts）：headless 角色进程完整执行流的只读视图 ————
// DSH 把每个会话落盘为 ~/.dsh/sessions/<cwd-slug>/session-<uuid>/session.jsonl.zstd；
// 这里只读解析（zstd -dc），把 reasoning/text/tool 事件归一化给前端渲染成主对话样式。
function sessionsRoot() {
  return join(homedir(), '.dsh', 'sessions');
}

export function listRoleSessions() {
  const out = [];
  let domains = [];
  try { domains = readdirSync(sessionsRoot()); } catch { return out; }
  for (const domain of domains) {
    let dirs = [];
    try { dirs = readdirSync(join(sessionsRoot(), domain)); } catch { continue; }
    for (const dir of dirs) {
      if (!dir.startsWith('session-')) continue;
      const file = join(sessionsRoot(), domain, dir, 'session.jsonl.zstd');
      if (!existsSync(file)) continue;
      let stat;
      try { stat = statSync(file); } catch { continue; }
      out.push({ dir, domain, file, mtime: stat.mtimeMs, size: stat.size });
    }
  }
  out.sort((a, b) => b.mtime - a.mtime);
  return out.slice(0, 120);
}

/** 会话头摘要：解前 24KB 拿 createdAt/标题/任务 id（列表用，快）。 */
export function sessionHead(file) {
  try {
    const r = spawnSync('zstd', ['-dc', file], { maxBuffer: 64 * 1024 * 1024, timeout: 15000, encoding: 'utf8' });
    const text = r.stdout ?? '';
    const head = {};
    for (const line of text.slice(0, 24000).split('\n')) {
      let m; try { m = JSON.parse(line); } catch { continue; }
      if (m.type === 'session') { head.sessionId = m.id; head.createdAt = m.createdAt; head.cwd = m.cwd; }
      else if (m.type === 'session/title' && head.title === undefined) head.title = m.data?.title;
      else if (m.type === 'user/message' && head.taskId === undefined) {
        const t = (m.data?.content ?? []).map((b) => b?.text ?? '').join(' ');
        const hit = /任务\s*id=([\w-]+)/.exec(t);
        if (hit) head.taskId = hit[1];
        if (head.title === undefined) head.title = (m.data?.title ?? t.slice(0, 60));
        if (t.includes('【当前任务（来自你的收件箱）】') || t.includes('任务正文')) head.isRoleTask = true;
      }
      if (head.sessionId !== undefined && head.title !== undefined && head.taskId !== undefined) break;
    }
    return head;
  } catch { return {}; }
}

/** 完整解析：把 jsonl 归一化成 events（reasoning/text/tool/result + 实时的裸 chunks）。 */
export function parseSessionTranscript(file) {
  const r = spawnSync('zstd', ['-dc', file], { maxBuffer: 128 * 1024 * 1024, timeout: 30000, encoding: 'utf8' });
  if (r.status !== 0 && (r.stdout === undefined || r.stdout === '')) throw new OrgError(`解压缩失败：${(r.stderr ?? 'zstd 不可用').slice(0, 200)}`);
  const events = [];
  const chunkText = new Map(); // `${step}:${index}` → {kind, text}（assistant/message 落定后清除；未落定 = 进行中流）
  const cap = (s, n) => (s.length > n ? `${s.slice(0, n)}\n…[截断，共 ${s.length} 字符]` : s);
  for (const line of r.stdout.split('\n')) {
    let m; try { m = JSON.parse(line); } catch { continue; }
    const d = m.data ?? {};
    if (m.type === 'user/message') {
      const text = (d.content ?? []).map((b) => b?.text ?? '').join('\n');
      if (text !== '') events.push({ kind: 'user', text: cap(text, 20000) });
    } else if (m.type === 'assistant/message') {
      for (const block of d.message?.content ?? []) {
        if (block?.type === 'reasoning' && block.text) events.push({ kind: 'reasoning', text: cap(block.text, 12000), step: d.step });
        else if (block?.type === 'text' && block.text) events.push({ kind: 'text', text: cap(block.text, 20000), step: d.step });
      }
      for (const key of [...chunkText.keys()]) if (key.startsWith(`${d.step}:`)) chunkText.delete(key);
    } else if (m.type === 'tool/call') {
      events.push({ kind: 'tool', name: d.name, args: cap(String(d.arguments ?? ''), 3000), step: d.step });
    } else if (m.type === 'tool/result') {
      const text = (d.message?.content ?? []).map((c) => c?.content?.map?.((x) => x?.text ?? '').join('\n') ?? '').join('\n');
      events.push({ kind: 'result', text: cap(text, 4000), step: d.step });
    } else if (m.type === 'reasoning-chunks' || m.type === 'text-chunks' || m.type === 'tool-call-chunks') {
      const key = `${d.step}:${d.index ?? 0}`;
      const kind = m.type === 'reasoning-chunks' ? 'reasoning-live' : m.type === 'text-chunks' ? 'text-live' : 'tool-live';
      const cur = chunkText.get(key);
      const texts = Array.isArray(d.data?.texts) ? d.data.texts.join('') : (Array.isArray(d.texts) ? d.texts.join('') : '');
      if (cur === undefined || cur.kind !== kind) chunkText.set(key, { kind, text: cap(texts, 8000) });
      else cur.text = cap(cur.text + texts, 8000);
    }
  }
  for (const v of chunkText.values()) events.push({ kind: v.kind, text: v.text, live: true });
  return events;
}

function loadJsonl(path) {
  if (!existsSync(path)) return [];
  return readFileSync(path, 'utf8')
    .split('\n')
    .filter((line) => line.trim() !== '')
    .map((line) => { try { return JSON.parse(line); } catch { return null; } })
    .filter((entry) => entry !== null);
}

function loadCursors() {
  try {
    if (!existsSync(statePath())) return {};
    const parsed = JSON.parse(readFileSync(statePath(), 'utf8'));
    return typeof parsed.cursors === 'object' && parsed.cursors !== null ? parsed.cursors : {};
  } catch {
    return {};
  }
}

function saveCursor(key, msgId) {
  const cursors = loadCursors();
  cursors[key] = msgId;
  mkdirSync(dirname(statePath()), { recursive: true });
  writeFileSync(statePath(), `${JSON.stringify({ cursors }, null, 2)}\n`);
}

function appendMessage(record) {
  const path = messagesPath();
  mkdirSync(dirname(path), { recursive: true });
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const message = { id, ts: new Date().toISOString(), ...record };
  appendFileSync(path, `${JSON.stringify(message)}\n`);
  return message;
}

function inboxOf(nodeId) {
  return loadJsonl(messagesPath()).filter((message) => message.to === nodeId);
}

function unreadCount(inbox, cursor) {
  if (cursor === undefined) return inbox.length;
  const index = inbox.findIndex((message) => message.id === cursor);
  return index === -1 ? inbox.length : inbox.length - index - 1;
}

function unreadByNode(doc) {
  const cursors = loadCursors();
  const unread = {};
  for (const org of doc.orgs) {
    for (const node of org.nodes) {
      unread[`${org.id}/${node.id}`] = unreadCount(inboxOf(node.id), cursors[`${org.id}/${node.id}`]);
    }
  }
  return unread;
}

function json(res, status, value) {
  const body = `${JSON.stringify(value)}\n`;
  res.writeHead(status, {
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
    'content-type': 'application/json; charset=utf-8',
  });
  res.end(body);
}

function error(res, status, code, message, detail) {
  json(res, status, { ok: false, error: { code, message, ...detail } });
}

function trustedRequest(req) {
  const host = req.headers.host;
  if (typeof host !== 'string' || host === '') return false;
  const hostname = host.replace(/:\d+$/, '').toLowerCase();
  const loopback = hostname === 'localhost' || hostname === '::1' || hostname === '127.0.0.1' || hostname.startsWith('127.');
  if (req.headers['sec-fetch-site'] === 'cross-site') return false;
  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin !== '') {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  return loopback;
}

/**
 * /mutate 与 /import 共用的 JSON 请求体读取（S1）：
 * 超过 maxBytes → OrgError('请求体过大')；其余非 OrgError 异常（JSON.parse 的 SyntaxError 等）
 * 统一包成 OrgError，使路由外层 catch 的 OrgError→400 语义全覆盖（解析失败不再逃逸为 500）。
 */
async function readJsonBody(req, maxBytes = 4 * 1024 * 1024) {
  try {
    const parts = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > maxBytes) throw new OrgError('请求体过大');
      parts.push(chunk);
    }
    const text = Buffer.concat(parts).toString('utf8');
    return JSON.parse(text === '' ? '{}' : text);
  } catch (cause) {
    if (cause instanceof OrgError) throw cause;
    throw new OrgError(`请求体不是合法 JSON：${cause instanceof Error ? cause.message : String(cause)}`);
  }
}

const GUIDE_TEXT = [
  '你所在的 DSH 实例装配了层级 agent 组织（dsh-agent-org），可含多个组织；Web 设置页「Agent 组织」有架构图、多组织切换与「沟通·留痕」面板。',
  '- org_chart：查看全部组织树（上下级、各节点的模型/提示词/工具策略配置）。',
  '- org_node_get：读取某个节点的完整配置（含系统提示词全文），准备把任务委派给该角色时使用。',
  '- org_delegate：登记一次委派——返回目标节点的完整角色配置与指挥链。目标若运行着角色 daemon（dsh-agent-org-role），随后用 org_send 投任务信即可（其 daemon 自动唤醒执行并回投）；无 daemon 时才以返回的 systemPrompt 注入临时执行体兜底。',
  '- org_report：任务完成后向目标节点汇报一句话结论（reports.jsonl 留痕）。',
  '- org_task：单一入口把任务交给组织负责人——一次调用写入负责人收件箱 + task 留痕 + 返回负责人完整运行包；负责人 daemon（dsh-agent-org-role lead）在轮询间隔内自动开工，成员协同全部走邮件；未起 daemon 时按返回的运行包起临时执行体兜底。',
  '- org_send：以某节点名义给另一节点发消息；from 与 to 可以属于不同组织（组织间对话），Web 架构图上有未读角标。',
  '- org_inbox：读取某节点收到的沟通消息（默认只列未读并标记已读）。',
  '- org_create / org_delete：新建组织（自动创建根节点）/ 删除整个组织（需 confirm:true，且至少保留一个组织）。',
  '- org_mutate：自我编排组织——像 Web 画布一样程序化改结构：add（挂新节点）/ update（改角色提示词、模型、工具策略）/ move（改上下级）/ delete（删子树，需 confirm:true）/ addEdge / removeEdge（协作·虚线关系）/ renameOrg / layoutAll。先用 org_chart 拿 id。',
  '图表连线有三种：实线=上下级（汇报线），虚线=协作，点线=虚线下级（from 为虚线上级，带箭头）。org_node_get 的 edges 字段列出该节点的相关连线。',
  '规则：只向组织内的节点委派（先 org_chart 确认目标存在）；委派时不要替目标执行其专长任务；模型字段为空表示沿用宿主默认模型；跨组织协作优先用 org_send 通信，重要结论用 org_report/org_send 留痕。',
].join('\n');

function nodeView(doc, id) {
  const org = orgOfNode(doc, id);
  if (org === undefined) throw new OrgError(`节点不存在：${id}`);
  const node = byId(doc, id);
  const parent = node.parentId === null ? undefined : byId(doc, node.parentId);
  const children = org.nodes.filter((entry) => entry.parentId === node.id).map((entry) => ({ id: entry.id, name: entry.name }));
  const edges = (org.edges ?? []).filter((edge) => edge.from === id || edge.to === id).map((edge) => {
    const otherId = edge.from === id ? edge.to : edge.from;
    const other = org.nodes.find((entry) => entry.id === otherId);
    return { id: edge.id, kind: edge.kind, from: edge.from, to: edge.to, other: other === undefined ? null : { id: other.id, name: other.name } };
  });
  return {
    org: { id: org.id, name: org.name },
    node,
    parent: parent === undefined ? null : { id: parent.id, name: parent.name },
    children,
    chain: chainOf(org, id),
    edges,
  };
}

function appendReport(record) {
  const path = reportsPath();
  mkdirSync(dirname(path), { recursive: true });
  appendFileSync(path, `${JSON.stringify({ ts: new Date().toISOString(), ...record })}\n`);
}

/** 团队级联触发备注（§C2(a)：plan/done 提交后同进程即时级联；抢锁失败不吞已成功的主写入，tick/回投兜底）。 */
function cascadeNote() {
  try {
    const n = recomputeAndDispatch(orgPath());
    return `级联派发：本次发出 ${n} 封派发邮件。`;
  } catch (err) {
    if (err instanceof OrgError) return `主写入已成功，级联触发失败（${err.code}）：${err.message}——由空闲轮 tick / 回投 hook 兜底。`;
    throw err;
  }
}

/**
 * §F roster 构建：域 = org 树全部节点 ∪ roles.json 全部心跳键 ∪ team.tasks 全体 owner
 * （ARCH-ADJ-3 Q2：owner 必有泳道；有 org 无心跳=offline）。
 * 十字段定版（Q1）：nodeId,name,orgId,status,busy,lastBeat,pid,tasksDone,lastTask,intervalS——
 * intervalS 必须透传，否则 FE beatAlive 退化 ??20 对 10/12 间隔成员阈值虚宽。
 */
function buildRoster(orgDoc, teamDoc) {
  const roles = loadRoles();
  const roster = [];
  const seen = new Set();
  const entry = (nodeId, name, orgId, hb) => ({
    nodeId,
    name,
    orgId,
    status: hb?.status ?? 'offline',
    busy: hb?.busy ?? null,
    lastBeat: hb?.lastBeat ?? null,
    pid: hb?.pid ?? null,
    tasksDone: hb?.tasksDone ?? null,
    lastTask: hb?.lastTask ?? null,
    intervalS: hb?.intervalS ?? null,
  });
  for (const org of orgDoc.orgs ?? []) {
    for (const node of org.nodes ?? []) {
      seen.add(`${org.id}/${node.id}`);
      roster.push(entry(node.id, node.name, org.id, roles[`${org.id}/${node.id}`]));
    }
  }
  for (const [key, hb] of Object.entries(roles)) {
    const slash = key.indexOf('/');
    if (slash < 0 || seen.has(key)) continue;
    const orgId = key.slice(0, slash);
    const nodeId = key.slice(slash + 1);
    seen.add(key);
    const node = byId(orgDoc, nodeId);
    roster.push(entry(nodeId, node?.name ?? hb?.name ?? nodeId, orgOfNode(orgDoc, nodeId)?.id ?? orgId, hb));
  }
  for (const task of teamDoc?.tasks ?? []) {
    if (roster.some((r) => r.nodeId === task.owner)) continue;
    const node = byId(orgDoc, task.owner);
    roster.push(entry(task.owner, node?.name ?? task.owner, orgOfNode(orgDoc, task.owner)?.id ?? null, undefined));
  }
  return roster;
}

function createTools() {
  const stringOut = {
    schema: { type: 'string', description: 'Model-facing result text.' },
    render: (args, value) => [{ type: 'text', text: String(value) }],
  };
  return [
    {
      name: 'org_chart',
      description: 'List the hierarchical agent organization of this DSH instance: tree of roles with each node\u2019s model/provider, system-prompt size and tool policy. Call before delegating to see who exists and who reports to whom.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: stringOut,
      async execute() {
        return renderChart(loadOrg(orgPath()));
      },
    },
    {
      name: 'org_node_get',
      description: 'Read the full configuration of one organization node by id: system prompt text, model/provider/fallback, tool allow/deny lists, maxTokens, parent/children and reporting chain. Use before dispatching work to that role so the sub-agent inherits its persona.',
      parameters: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Organization node id (from org_chart).' } },
        required: ['id'],
        additionalProperties: false,
      },
      output: stringOut,
      async execute(args) {
        return JSON.stringify(nodeView(loadOrg(orgPath()), String(args?.id ?? '')), null, 2);
      },
    },
    {
      name: 'org_delegate',
      description: 'Register a delegation to an organization node and receive the target\u2019s full role config (system prompt, model, tool policy, reporting chain). If the target runs a role daemon (dsh-agent-org-role), follow up with org_send carrying the task brief — its daemon auto-wakes, executes and replies by mail; only fall back to an ad-hoc executor with the returned systemPrompt injected when no daemon is running. Logs the delegation.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Target node id (from org_chart).' },
          task: { type: 'string', description: 'One-paragraph task brief for the target.' },
          from: { type: 'string', description: 'Optional: delegating node id, to check the chain of command.' },
        },
        required: ['to', 'task'],
        additionalProperties: false,
      },
      output: stringOut,
      async execute(args) {
        const doc = loadOrg(orgPath());
        const view = nodeView(doc, String(args?.to ?? ''));
        const from = args?.from === undefined ? undefined : byId(doc, String(args.from));
        const fromOrg = from === undefined ? undefined : orgOfNode(doc, from.id);
        const task = String(args?.task ?? '').trim();
        if (task === '') throw new OrgError('task 不能为空');
        appendReport({
          type: 'delegate', to: view.node.id, toOrg: view.org.id,
          from: from?.id ?? null, fromOrg: fromOrg?.id ?? null, task,
        });
        return JSON.stringify({
          delegation: 'registered',
          target: view,
          note: '用平台 subagent/task 工具派发：prompt 以 target.node.systemPrompt 开头（若非空），模型偏好 target.node.model，空字段表示用宿主默认模型。跨组织请优先用 org_send 沟通。',
        }, null, 2);
      },
    },
    {
      name: 'org_report',
      description: 'File a one-line completion report to an organization node (append to reports.jsonl). Use after finishing delegated work so the chain of command has a trace.',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Node id receiving the report (usually the delegator).' },
          summary: { type: 'string', description: 'One-line result summary.' },
        },
        required: ['to', 'summary'],
        additionalProperties: false,
      },
      output: stringOut,
      async execute(args) {
        const doc = loadOrg(orgPath());
        const target = byId(doc, String(args?.to ?? ''));
        if (target === undefined) throw new OrgError(`节点不存在：${args?.to}`);
        const summary = String(args?.summary ?? '').trim();
        if (summary === '') throw new OrgError('summary 不能为空');
        // 发件人归属：daemon spawn headless 时注入 DSH_ORG_NODE_ID（执行者身份由进程上下文决定，非模型自报，防漂移/伪造）。
        // env 缺失（交互/Web 会话）或节点已不存在 → 三个 from* 字段原子组整体省略，行形态与历史老行一致（消费端已容错缺字段）。
        // schema 定版见架构师裁定 mtxm1ljy-ygz7：{ts,type,to,toOrg,summary,from?,fromName?,fromOrg?}；归属键恒用 from。
        const selfNode = byId(doc, String(process.env.DSH_ORG_NODE_ID ?? ''));
        appendReport({
          type: 'report', to: target.id, toOrg: orgOfNode(doc, target.id).id, summary,
          ...(selfNode === undefined ? {} : { from: selfNode.id, fromName: selfNode.name, fromOrg: orgOfNode(doc, selfNode.id).id }),
        });
        return `已记录汇报 → ${target.name}`;
      },
    },
    {
      name: 'org_task',
      description: 'Single-entry dispatch: hand a task to the organization leader in one call — the objective is appended to the leader\u2019s inbox (unread badge on the Web org chart), a task trace is logged to reports.jsonl, and the leader\u2019s full run package (system prompt, model, tool policy, reporting chain) is returned. When the leader runs a role daemon (dsh-agent-org-role lead), it polls the inbox and starts autonomously within its interval — all member coordination happens by mail between role daemons; the returned run package is only a fallback for spawning an ad-hoc executor when no daemon is running.',
      parameters: {
        type: 'object',
        properties: {
          objective: { type: 'string', description: 'Task objective delivered verbatim to the leader (trimmed non-empty, max 4000 chars).' },
          org: { type: 'string', description: 'Organization id. Required when this instance has multiple orgs; defaults to the only org otherwise.' },
          from: { type: 'string', description: 'Optional originating node id, used as the inbox message sender (defaults to an external sender).' },
        },
        required: ['objective'],
        additionalProperties: false,
      },
      output: stringOut,
      async execute(args) {
        // L3 预留：自动唤醒负责人分身需宿主提供会话唤醒服务（尚不存在）。
        // 当前语义 = 只投递收件箱消息 + task 留痕 + 发运行包，进程由调用方用平台 subagent/task 工具派生。
        const doc = loadOrg(orgPath());
        const objective = String(args?.objective ?? '').trim();
        if (objective === '') throw new OrgError('objective 不能为空');
        if (objective.length > 4000) throw new OrgError('objective 超过 4000 字');
        let org;
        if (args?.org === undefined || args.org === null || args.org === '') {
          if (doc.orgs.length > 1) {
            throw new OrgError(`多组织实例需指定 org 参数（可选：${doc.orgs.map((entry) => `${entry.id}（${entry.name}）`).join('、')}）`);
          }
          org = doc.orgs[0];
        } else {
          org = doc.orgs.find((entry) => entry.id === String(args.org));
          if (org === undefined) throw new OrgError(`组织不存在：${args.org}`);
        }
        const leader = byId(doc, org.rootNodeId);
        if (leader === undefined) throw new OrgError(`组织缺根节点：${org.name}（rootNodeId=${String(org.rootNodeId)}）`);
        const fromNode = args?.from === undefined ? undefined : byId(doc, String(args.from));
        if (args?.from !== undefined && fromNode === undefined) throw new OrgError(`发件节点不存在：${args.from}`);
        const fromOrg = fromNode === undefined ? undefined : orgOfNode(doc, fromNode.id);
        appendMessage({
          from: fromNode?.id ?? 'external', fromName: fromNode?.name ?? '外部', fromOrg: fromOrg?.id ?? null,
          to: leader.id, toName: leader.name, toOrg: org.id, content: objective, // 内容原样投递，不加前缀
        });
        appendReport({
          type: 'task', to: leader.id, toOrg: org.id,
          from: fromNode?.id ?? null, fromOrg: fromOrg?.id ?? null, objective,
        });
        return JSON.stringify({
          dispatched_to: { orgId: org.id, orgName: org.name, leaderId: leader.id, leaderName: leader.name },
          inbox: '已入收件箱（Web 架构图 ● 角标可见）',
          leader: nodeView(doc, leader.id),
          how_to_run: [
            '用平台 subagent/task 工具新建子代理：prompt 开头注入 leader.node.systemPrompt（空则跳过），随后原样给出 objective。',
            '模型偏好 leader.node.model：provider/model 非空则透传给子代理，空字段沿用宿主默认模型。',
            '分身拆票：用 org_delegate 取成员人设后再用 subagent 派发，完成后 org_report 留痕；组织内沟通用 org_send / org_inbox。',
            '多轮续跑：对分身续发消息时，在 prompt 中带上「先 org_inbox(node=负责人id) 查收收件箱」，确保收到期间新到的消息。',
            '本工具只投递任务与运行包，不生成进程、不自动唤醒；负责人分身由调用方派生执行。',
          ],
        }, null, 2);
      },
    },
    {
      name: 'org_team_plan',
      description: 'Create or upsert-merge the instance-level team plan (team.json): objective (<=2000 chars) + tasks [{id,title<=200,owner,deps:[]}]. Re-running merges instead of replacing (terminal ids skip into skipped[]; running tasks are immutable; pending/ready upsert). Cycle check runs on the merged whole graph and rejects the batch with zero writes, naming the cycle path (t1→t3→t2→t1). Success immediately triggers dependency-aware dispatch (dispatch emails from the org root). Error codes: TEAM_EMPTY / TEAM_DEP_UNKNOWN / TEAM_UNKNOWN_OWNER / TEAM_CYCLE_DETECTED / TEAM_TASK_RUNNING_IMMUTABLE / TEAM_LOCK_BUSY / TEAM_SCHEMA_CORRUPT / TEAM_SCHEMA_TOO_NEW.',
      parameters: {
        type: 'object',
        properties: {
          objective: { type: 'string', description: '团队目标（<=2000 字）；省略则复用既有 objective，提供即覆盖。' },
          tasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                id: { type: 'string', description: '团队内唯一幂等键 /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/（用户命名）。' },
                title: { type: 'string', description: '任务标题（<=200 字）。' },
                owner: { type: 'string', description: '负责节点全局 id（允许跨 org，与 org_send 同义）。' },
                deps: { type: 'array', items: { type: 'string' }, description: '上游 task id 列表；全部 done 后才派发本任务。' },
              },
              required: ['id', 'title', 'owner'],
              additionalProperties: false,
            },
          },
        },
        required: ['tasks'],
        additionalProperties: false,
      },
      output: stringOut,
      async execute(args) {
        const path = orgPath();
        const r = planTeam(path, args);
        const snap = readTeamSnapshot(path);
        return [
          `立项成功 rev=${r.doc.rev}｜objective: ${r.doc.objective.slice(0, 100)}`,
          `新增 ${r.added.length}：${r.added.join(', ') || '（无）'}`,
          `更新 ${r.updated.length}：${r.updated.join(', ') || '（无）'}`,
          `跳过 ${r.skipped.length}（终态 id 再现防覆盖历史）：${r.skipped.join(', ') || '（无）'}`,
          `stats: ${Object.entries(snap.stats).map(([k, v]) => `${k}=${v}`).join(' ')}`,
          cascadeNote(),
        ].join('\n');
      },
    },
    {
      name: 'org_team_status',
      description: 'Read-only snapshot of the team plan: rev/objective, per-task lines (id·status·attempt·owner·title·summary-40), six-state stats, ready queue, blocked tasks with upstream causes. Pure read — never locks, never dispatches (GET /team is the machine-readable twin).',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: stringOut,
      async execute() {
        return statusText(orgPath());
      },
    },
    {
      name: 'org_team_talk',
      description: 'Controlled follow-up message to a team member — a thin org_send wrapper with team-facing error codes (message non-empty <=4000, unknown target → TEAM_TARGET_NOT_FOUND, from defaults to external). Touches neither team.json nor the mail protocol (no team markers); the actual follow-up context comes from the daemon-side §D injection, not from this tool.',
      parameters: {
        type: 'object',
        properties: {
          nodeId: { type: 'string', description: '收件节点 id。' },
          message: { type: 'string', description: '消息正文（非空 ≤4000 字）。' },
          from: { type: 'string', description: '可选发件节点 id（缺省 external）。' },
        },
        required: ['nodeId', 'message'],
        additionalProperties: false,
      },
      output: stringOut,
      async execute(args) {
        const doc = loadOrg(orgPath());
        const to = byId(doc, String(args?.nodeId ?? ''));
        if (to === undefined) throw new OrgError(`目标节点不存在：${args?.nodeId}`, { code: 'TEAM_TARGET_NOT_FOUND' });
        const toOrg = orgOfNode(doc, to.id);
        const fromNode = args?.from === undefined ? undefined : byId(doc, String(args.from));
        if (args?.from !== undefined && fromNode === undefined) throw new OrgError(`发件节点不存在：${args.from}`);
        const fromOrg = fromNode === undefined ? undefined : orgOfNode(doc, fromNode.id);
        const content = String(args?.message ?? '').trim();
        if (content === '') throw new OrgError('message 不能为空');
        if (content.length > 4000) throw new OrgError('message 超过 4000 字');
        const message = appendMessage({
          from: fromNode?.id ?? 'external', fromName: fromNode?.name ?? '外部', fromOrg: fromOrg?.id ?? null,
          to: to.id, toName: to.name, toOrg: toOrg.id, content, // 与 org_send 同构记录；[team:] 标记严禁混入（邮件协议纯净）
        });
        return `org_team_talk：已送达 ${to.name}（${to.id}）${fromNode === undefined ? '（外部名义）' : `，来自 ${fromNode.name}（${fromNode.id}）`}，message id=${message.id}。续聊上下文将在其下次唤醒时经 §D 注入生效。`;
      },
    },
    {
      name: 'org_team_done',
      description: 'Report task completion — legal only while status=running (otherwise TEAM_BAD_TRANSITION; unknown id → TEAM_TASKID_UNKNOWN; a repeated done hitting BAD_TRANSITION is the second executor\u2019s double-dispatch self-check signal: run org_team_status then exit with [系统确认]). Writes done + finishedAt + summary(<=2000) + doneSource=tool, then immediately recomputes and cascade-dispatches downstream.',
      parameters: {
        type: 'object',
        properties: {
          taskId: { type: 'string', description: 'task id（org_team_plan 立项时命名）。' },
          summary: { type: 'string', description: '成果摘要（<=2000 字，进 team.json 供续聊注入 D3 引用）。' },
        },
        required: ['taskId'],
        additionalProperties: false,
      },
      output: stringOut,
      async execute(args) {
        const t = completeTask(orgPath(), String(args?.taskId ?? ''), args?.summary);
        return `任务 ${t.id} 已 done（doneSource=tool，attempt=${t.attempt}）。${cascadeNote()}`;
      },
    },
    {
      name: 'org_send',
      description: 'Send a message from one organization node to another. from and to may live in DIFFERENT organizations (cross-org communication) — the UI shows a cross-org badge. Appended to messages.jsonl, visible with unread badges on the org charts. Use for questions down the chain, answers back up, and inter-org negotiation.',
      parameters: {
        type: 'object',
        properties: {
          from: { type: 'string', description: 'Sending node id (optional; defaults to an external sender).' },
          to: { type: 'string', description: 'Receiving node id.' },
          content: { type: 'string', description: 'Message text.' },
        },
        required: ['to', 'content'],
        additionalProperties: false,
      },
      output: stringOut,
      async execute(args) {
        const doc = loadOrg(orgPath());
        const to = byId(doc, String(args?.to ?? ''));
        if (to === undefined) throw new OrgError(`收件节点不存在：${args?.to}`);
        const toOrg = orgOfNode(doc, to.id);
        const fromNode = args?.from === undefined ? undefined : byId(doc, String(args.from));
        if (args?.from !== undefined && fromNode === undefined) throw new OrgError(`发件节点不存在：${args.from}`);
        const fromOrg = fromNode === undefined ? undefined : orgOfNode(doc, fromNode.id);
        const content = String(args?.content ?? '').trim();
        if (content === '') throw new OrgError('content 不能为空');
        if (content.length > 4000) throw new OrgError('content 超过 4000 字');
        appendMessage({
          from: fromNode?.id ?? 'external', fromName: fromNode?.name ?? '外部', fromOrg: fromOrg?.id ?? null,
          to: to.id, toName: to.name, toOrg: toOrg.id, content,
        });
        const cross = fromOrg !== undefined && fromOrg.id !== toOrg.id
          ? `（跨组织：${fromOrg.name} → ${toOrg.name}）` : '';
        return `已发送 → ${toOrg.name}·${to.name}${cross}`;
      },
    },
    {
      name: 'org_inbox',
      description: 'Read messages received by an organization node (from org_send, including cross-org messages). Lists unread messages by default and marks them as read; pass includeRead=true to list the full history. Pair with org_send to hold a conversation down/up the chain or between organizations.',
      parameters: {
        type: 'object',
        properties: {
          node: { type: 'string', description: 'Node id whose inbox to read.' },
          includeRead: { type: 'boolean', description: 'Include already-read history (default false = unread only).' },
        },
        required: ['node'],
        additionalProperties: false,
      },
      output: stringOut,
      async execute(args) {
        const doc = loadOrg(orgPath());
        const node = byId(doc, String(args?.node ?? ''));
        if (node === undefined) throw new OrgError(`节点不存在：${args?.node}`);
        const org = orgOfNode(doc, node.id);
        const key = `${org.id}/${node.id}`;
        const inbox = inboxOf(node.id);
        const cursor = loadCursors()[key];
        const unread = cursor === undefined ? inbox : inbox.slice(inbox.findIndex((message) => message.id === cursor) + 1);
        const list = args?.includeRead === true ? inbox : unread;
        if (inbox.length > 0) saveCursor(key, inbox[inbox.length - 1].id);
        if (list.length === 0) return `${node.name} 的收件箱没有${args?.includeRead === true ? '' : '未读'}消息`;
        const orgNameById = (id) => {
          for (const entry of doc.orgs) { if (entry.id === id) return entry.name; }
          return undefined;
        };
        return list.map((message) => {
          const tag = message.fromOrg !== undefined && message.fromOrg !== null && message.fromOrg !== org.id
            ? `[${orgNameById(message.fromOrg) ?? message.fromOrg}]` : '';
          return `【沟通】${message.ts.slice(11, 16)} ${tag}${message.fromName ?? message.from} → ${node.name}：${message.content}`;
        }).join('\n');
      },
    },
    {
      name: 'org_create',
      description: 'Create a new top-level agent organization with a root node (e.g. a second team/dept). Returns the new org id. Then add members via the Web UI or mutate API, and cross-org talk happens through org_send between any two nodes.',
      parameters: {
        type: 'object',
        properties: {
          name: { type: 'string', description: 'Organization display name, e.g. 研究院.' },
          rootName: { type: 'string', description: 'Root node name (default 负责人).' },
          rootTitle: { type: 'string', description: 'Root node title.' },
          rootPrompt: { type: 'string', description: 'Root node system prompt.' },
        },
        required: ['name'],
        additionalProperties: false,
      },
      output: stringOut,
      async execute(args) {
        const doc = loadOrg(orgPath());
        const request = {
          op: 'addOrg',
          name: String(args?.name ?? ''),
          rootName: args?.rootName, rootTitle: args?.rootTitle, rootPrompt: args?.rootPrompt,
        };
        mutate(doc, request);
        saveOrg(orgPath(), doc);
        return `已创建组织「${request.name}」（id=${request.resultId}，根节点 id=${doc.orgs[doc.orgs.length - 1].rootNodeId}）`;
      },
    },
    {
      name: 'org_delete',
      description: 'Delete an entire organization (all its nodes) by org id. Requires confirm:true. Refuses when it is the last remaining organization.',
      parameters: {
        type: 'object',
        properties: {
          org: { type: 'string', description: 'Organization id to delete.' },
          confirm: { type: 'boolean', description: 'Must be true to actually delete.' },
        },
        required: ['org', 'confirm'],
        additionalProperties: false,
      },
      output: stringOut,
      async execute(args) {
        if (args?.confirm !== true) throw new OrgError('删除组织需显式 confirm:true');
        const doc = loadOrg(orgPath());
        const request = { op: 'removeOrg', org: String(args?.org ?? '') };
        mutate(doc, request);
        saveOrg(orgPath(), doc);
        return `已删除组织 ${request.removedOrg}`;
      },
    },
    {
      name: 'org_mutate',
      description: 'Self-orchestration: restructure an organization programmatically (the agent equivalent of the Web architecture canvas). Ops: add (new node under parentId, with name/title/systemPrompt/model/toolScope), update (patch node fields), move (re-parent node under newParentId), delete (remove node + whole subtree; needs confirm:true), addEdge (kind=collab|dotted between from/to), removeEdge (by edge id), renameOrg (needs confirm:true), layoutAll (auto-tidy tree layout). org = organization id (default = first org). Returns the resulting chart; call org_chart first to learn node/edge ids.',
      parameters: {
        type: 'object',
        properties: {
          org: { type: 'string', description: 'Organization id (default = the only/first org).' },
          op: { type: 'string', enum: ['add', 'update', 'move', 'delete', 'addEdge', 'removeEdge', 'renameOrg', 'layoutAll'], description: 'Structural operation to apply.' },
          parentId: { type: 'string', description: 'op=add: parent (superior) node id.' },
          name: { type: 'string', description: 'op=add: new node name; op=renameOrg: new org name.' },
          title: { type: 'string', description: 'op=add/update: role title, e.g. 后端工程师.' },
          systemPrompt: { type: 'string', description: 'op=add/update: the role system prompt.' },
          model: { type: ['object', 'null'], description: 'op=add/update: 模型覆盖 {provider?,model?,fallback?}（留空=沿用宿主默认）。BUG-V14B-1：不再接受字符串——形状即 Web 面板 model 三键（patchOf 同构）。', properties: { provider: { type: 'string' }, model: { type: 'string' }, fallback: { type: 'string' } }, additionalProperties: false },
          toolScope: { type: 'object', description: 'op=add/update: { allow: string[], deny: string[] } tool names (empty = unrestricted).', properties: { allow: { type: 'array', items: { type: 'string' } }, deny: { type: 'array', items: { type: 'string' } } }, additionalProperties: false },
          maxTokens: { description: 'op=update: integer 1..64000 or null (= default).' },
          id: { type: 'string', description: 'op=update/delete/move: node id; op=removeEdge: edge id.' },
          newParentId: { type: 'string', description: 'op=move: new superior node id.' },
          from: { type: 'string', description: 'op=addEdge: edge source node id.' },
          to: { type: 'string', description: 'op=addEdge: edge target node id.' },
          kind: { type: 'string', enum: ['collab', 'dotted'], description: 'op=addEdge: collab=协作(虚线), dotted=虚线下级(点线).' },
          confirm: { type: 'boolean', description: 'Must be true for delete / renameOrg.' },
        },
        required: ['op'],
        additionalProperties: false,
      },
      output: stringOut,
      async execute(args) {
        const op = String(args?.op ?? '');
        if ((op === 'delete' || op === 'renameOrg') && args?.confirm !== true) throw new OrgError(`操作 ${op} 需显式 confirm:true`);
        const doc = loadOrg(orgPath());
        const request = {
          op,
          ...(args?.org !== undefined ? { org: args.org } : {}),
          ...(args?.parentId !== undefined ? { parentId: args.parentId } : {}),
          ...(args?.name !== undefined ? { name: args.name } : {}),
          ...(args?.title !== undefined ? { title: args.title } : {}),
          ...(args?.systemPrompt !== undefined ? { systemPrompt: args.systemPrompt } : {}),
          ...(args?.model !== undefined ? { model: args.model } : {}),
          ...(args?.toolScope !== undefined ? { toolScope: args.toolScope } : {}),
          ...(args?.maxTokens !== undefined ? { maxTokens: args.maxTokens } : {}),
          ...(args?.id !== undefined ? { id: args.id } : {}),
          ...(args?.newParentId !== undefined ? { newParentId: args.newParentId } : {}),
          ...(args?.from !== undefined ? { from: args.from } : {}),
          ...(args?.to !== undefined ? { to: args.to } : {}),
          ...(args?.kind !== undefined ? { kind: args.kind } : {}),
        };
        // BUG-V14：org.js 的 update 分支读嵌套 request.patch（`const patch = request.patch ?? {}`），
        // 而工具侧构造的是平铺 request → patch 恒为空对象，op=update 任何字段都不落盘却返回成功。
        // op=update 时把可更新字段按需打包进 request.patch；其余 op 行为零改动。
        if (op === 'update') {
          request.patch = {
            ...(args?.name !== undefined ? { name: args.name } : {}),
            ...(args?.title !== undefined ? { title: args.title } : {}),
            ...(args?.systemPrompt !== undefined ? { systemPrompt: args.systemPrompt } : {}),
            ...(args?.model !== undefined ? { model: args.model } : {}),
            ...(args?.toolScope !== undefined ? { toolScope: args.toolScope } : {}),
            ...(args?.maxTokens !== undefined ? { maxTokens: args.maxTokens } : {}),
          };
        }
        mutate(doc, request);
        saveOrg(orgPath(), doc);
        const done = {
          add: `已新增节点 ${request.resultId}（${args?.name}）`,
          update: `已更新节点 ${args?.id}`,
          move: `已把 ${args?.id} 移到 ${args?.newParentId} 之下`,
          delete: `已删除节点 ${args?.id} 及其子树（共 ${request.removed} 个节点）`,
          addEdge: `已连线 ${args?.from} ${args?.kind === 'collab' ? '⇄ 协作' : '┄ 虚线下级'} ${args?.to}（edge=${request.resultId}）`,
          removeEdge: `已删除连线 ${args?.id}`,
          renameOrg: '已重命名组织',
          layoutAll: '已自动排布架构',
        }[op];
        return `${done}。\n${renderChart(doc)}`;
      },
    },
  ];
}

export function apply(ctx, config = {}) {

  ctx.effect(
    () => ctx.systemPrompt.section({
      name: 'agent-org:guide',
      order: GUIDE_ORDER,
      text: GUIDE_TEXT,
    }),
    'dsh-agent-org: systemPrompt guide',
  );

  const registerTools = (tools) => {
    for (const tool of createTools()) {
      try { tools.register(tool); } catch { /* 已有同名工具则跳过 */ }
    }
  };
  const probed = ctx.reflect.get('tools', false);
  if (probed !== false && probed !== undefined && typeof probed.register === 'function') registerTools(probed);
  // internal/service 载荷经 cordis 4.0.1 实测与事件表核对 = (name, value) 位置参数，非对象；
  // 早前 ({service, operation}) 解构永远得 undefined，补挂实为死代码（web 靠探测侥幸成功，headless 必失）。
  ctx.on('internal/service', (name) => {
    if (name !== 'tools') return;
    const tools = ctx.reflect.get('tools', false);
    if (tools !== false && tools !== undefined && typeof tools.register === 'function') registerTools(tools);
  });

  const route = async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://internal');
    const suffix = url.pathname.slice(API_ROOT.length);
    const path = orgPath();
    try {
      if (!trustedRequest(req)) {
        error(res, 403, 'cross-site', 'this endpoint only accepts same-origin or loopback requests');
        return;
      }
      if (req.method === 'GET' && suffix === '/health') {
        json(res, 200, { ok: true, plugin: 'dsh-agent-org', protocol: 1 });
        return;
      }
      if (req.method === 'GET' && suffix === '/org') {
        json(res, 200, { ok: true, path, org: loadOrg(path) });
        return;
      }
      if (req.method === 'GET' && (suffix === '/team' || suffix === '/team/')) {
        // §F：只读幂等零副作用；不加锁（rename 原子保证整文件可见）；恒 200（ADJ-3 Q5，
        // 路由属性不随状态退化）；error⊥team（Q4：error 在场→team:null+stats 全 0+roster 照常全量）。
        let body;
        try {
          const snap = readTeamSnapshot(path);
          const orgDoc = loadOrg(path);
          body = {
            ok: true,
            path: teamPathFor(path),
            team: snap.team,
            ...(snap.error === undefined ? {} : { error: snap.error }),
            roster: buildRoster(orgDoc, snap.team),
            stats: snap.stats,
            now: new Date().toISOString(),
          };
        } catch (err) {
          body = {
            ok: true, path: teamPathFor(path), team: null,
            error: err instanceof OrgError ? String(err.code) : String(err?.message ?? err),
            roster: [], stats: zeroStats(), now: new Date().toISOString(),
          };
        }
        json(res, 200, body);
        return;
      }
      if (req.method === 'GET' && suffix === '/chart') {
        json(res, 200, { ok: true, chart: renderChart(loadOrg(path)) });
        return;
      }
      if (req.method === 'GET' && suffix === '/feed') {
        const id = url.searchParams.get('id');
        const orgFilter = url.searchParams.get('org');
        const current = loadOrg(path);
        const messages = loadJsonl(messagesPath());
        const reports = loadJsonl(reportsPath());
        const nodeBound = id !== null && id !== '' && current.orgs.some((entry) => entry.nodes.some((n) => n.id === id));
        const orgBound = orgFilter !== null && orgFilter !== '' && current.orgs.some((entry) => entry.id === orgFilter);
        const touchesOrg = (entry) => entry.toOrg === orgFilter || entry.fromOrg === orgFilter
          || orgOfNode(current, entry.to)?.id === orgFilter || orgOfNode(current, entry.from)?.id === orgFilter;
        json(res, 200, {
          ok: true,
          messages: nodeBound
            ? messages.filter((entry) => entry.to === id || entry.from === id)
            : orgBound
              ? messages.filter(touchesOrg)
              : messages.slice(-80),
          reports: nodeBound
            ? reports.filter((entry) => entry.to === id || entry.from === id).slice(-50)
            : orgBound
              ? reports.filter(touchesOrg).slice(-50)
              : reports.slice(-50),
          cursors: loadCursors(),
          unread: unreadByNode(current),
          roles: loadRoles(),
        });
        return;
      }
      if (req.method === 'GET' && suffix === '/sessions') {
        json(res, 200, { ok: true, sessions: listRoleSessions().map((s) => ({ dir: s.dir, mtime: s.mtime, size: s.size, ...sessionHead(s.file) })) });
        return;
      }
      if (req.method === 'GET' && suffix === '/session') {
        const dir = url.searchParams.get('dir') ?? '';
        if (!/^session-[0-9a-f-]{36}$/.test(dir)) throw new OrgError('非法的会话目录名');
        const hit = listRoleSessions().find((s) => s.dir === dir);
        if (hit === undefined) throw new OrgError(`会话不存在或已被清理：${dir}`);
        json(res, 200, { ok: true, ...sessionHead(hit.file), events: parseSessionTranscript(hit.file) });
        return;
      }
      if (req.method === 'POST' && suffix === '/mutate') {
        const request = await readJsonBody(req);
        if (typeof request?.op !== 'string') throw new OrgError('缺少 op');
        if (config.lockName === true && (request.op === 'setName' || request.op === 'renameOrg')) throw new OrgError('实例配置禁改组织名称');
        const doc = loadOrg(path);
        mutate(doc, request);
        // S16：落盘临界区（loadOrg→mutate→saveOrg）全同步 fs、禁止插入 await（同进程互斥不变量）。
        saveOrg(path, doc);
        json(res, 200, {
          ok: true, org: doc,
          ...(request.resultId !== undefined ? { createdId: request.resultId } : {}),
          ...(request.removed !== undefined ? { removed: request.removed } : {}),
          ...(request.removedOrg !== undefined ? { removedOrg: request.removedOrg } : {}),
        });
        return;
      }
      if (req.method === 'POST' && suffix === '/import') {
        // 整 doc 导入（请求体 = GET /org 响应里 org 字段的同构文档）：整单校验，任一失败整单拒绝（此时零写入）。
        let request;
        try {
          request = await readJsonBody(req, 16 * 1024 * 1024); // B5：导入体容量放宽到 16MB（整树导出 JSON 远大于 op 请求）
        } catch (cause) {
          if (cause instanceof OrgError && cause.message.includes('请求体过大')) {
            error(res, 413, 'too-large', cause.message); // 超容量单独给 413，前端可区分「太大」与「不合法」
            return;
          }
          throw cause; // 其余 OrgError（含非法 JSON 包装）走外层 catch → 400
        }
        const doc = prepareDoc(request); // 版本防线 + v1 迁移 + normalize + validate，与 loadOrg 同一管线
        if (config.lockName === true) {
          // B4：lockName 下导入同样不得改已有组织名（对齐 /mutate 的 setName/renameOrg 防线）。
          // 只比对同 id 组织（新增 id 不算改名）；在备份之前抛出 → 保持零写入。
          const current = loadOrg(path);
          const renamed = [];
          for (const org of doc.orgs) {
            const existing = current.orgs.find((entry) => entry.id === org.id);
            if (existing !== undefined && existing.name !== org.name) {
              renamed.push(`${org.id}（${existing.name} → ${org.name}）`);
            }
          }
          if (renamed.length > 0) throw new OrgError(`实例配置禁改组织名称：${renamed.join('；')}`);
        }
        // S16：落盘临界区（备份→盖时间戳→saveOrg）全同步 fs、禁止插入 await（同进程互斥不变量）。
        const backedUp = backupOrg(path); // 校验全过才落盘：先把当前 org.json 原子轮转为 org.json.bak.<时间戳>
        doc.updatedAt = new Date().toISOString();
        saveOrg(path, doc);              // 复用 saveOrg 的 tmp+rename 原子替换
        json(res, 200, { ok: true, path, org: doc, backedUp }); // S2：回显数据文件路径与是否生成了备份
        return;
      }
      error(res, 404, 'not-found', 'unknown endpoint');
    } catch (cause) {
      if (cause instanceof OrgError) {
        // E（裁定 mth2w93x）：OrgError 自带 code/status/detail，客户端按 code 机器判因，不再匹配中文文案。
        error(res, cause.status ?? 400, cause.code ?? 'org-request-failed', cause.message, cause.detail);
      } else {
        error(res, 500, 'internal', cause instanceof Error ? cause.message : String(cause));
      }
    }
  };

  // webServer 挂载 = 探测 + 补挂（对齐上方 tools 的既有模式）：headless 宿主无 webServer 服务，
  // 静态 inject 含 webServer 会让本插件永远 pending 直接崩，故 inject 只留 systemPrompt，此处探测。
  // 幂等：路由重复注册会抛（不像 tools 可用 try-catch 吞掉同名冲突），用 mounted 布尔守卫只挂一次，
  // 不用 catch 掩盖真实注册错误。
  let routeMounted = false;
  const mountRoute = (webServer) => {
    if (routeMounted) return;
    routeMounted = true;
    webServer.register({ kind: 'prefix', path: API_ROOT, handler: route });
    // §G 挂载面 1→2：/team 独立前缀注册（handler 复用 route，按 suffix 分派——最长前缀优先
    // 与先注册优先两种宿主语义下 /team 均可达；重复注册仍由 routeMounted 布尔守卫幂等）。
    webServer.register({ kind: 'prefix', path: `${API_ROOT}/team`, handler: route });
  };
  const probedWebServer = ctx.reflect.get('webServer', false);
  if (probedWebServer !== false && probedWebServer !== undefined && typeof probedWebServer.register === 'function') mountRoute(probedWebServer);
  ctx.on('internal/service', (name) => {
    if (name !== 'webServer') return;
    const webServer = ctx.reflect.get('webServer', false);
    if (webServer !== false && webServer !== undefined && typeof webServer.register === 'function') mountRoute(webServer);
  });
}
