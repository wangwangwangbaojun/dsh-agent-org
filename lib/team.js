/**
 * dsh-agent-org — v0.14 团队调度（ARCH-V14 契约 §A 数据模型 / §B 语义内核 / §C 调度器）。
 * 纯函数库 + 同步落盘：零新进程、零 dsh 核心改动；调度唯一实现点=recomputeAndDispatch（§C6）。
 * 兼容红线（§G）：team.json 缺失＝一切行为等 v0.13；邮件 schema 字段面零增删——派发邮件
 * 只是普通消息记录，[team:] 是正文文本非协议字段。
 * ADD-1（红线）：原子写只 import lib/org.js 泛化原语 atomicWrite（tmpPrefix 'team'），
 * 本文件零 renameSync、零第二套 tmp→rename 原子写对。
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { OrgError, atomicWrite, byId, loadOrg, orgOfNode } from './org.js';

// ———— §A/§C4 常量（置顶可调，R3 棘轮：只增不减） ————
export const TEAM_SCHEMA_VERSION = 1;
export const TEAM_OBJECTIVE_MAX = 2000;
export const TEAM_TITLE_MAX = 200;
export const TEAM_SUMMARY_MAX = 2000;
export const TEAM_TASKS_CAP = 512; // 非契约防御帽：环检测 DFS 递归深度与文件规模的硬上界
export const TEAM_RUNNING_TIMEOUT_MS = 50 * 60 * 1000; // §C4：50min > 3×900s 强杀窗口
export const TEAM_LOCK_STALE_MS = 60 * 1000;            // §A：mtime>60s 视为死锁强删接管
export const TEAM_RESIDUE_RECLAIM_MS = 3 * 60 * 1000;   // §C3③：claim 距今>3min 的残留重新 claim
export const TASK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/;
export const TEAM_STATUSES = ['pending', 'ready', 'running', 'done', 'failed', 'blocked'];
const TERMINAL_STATUSES = ['done', 'failed', 'blocked']; // done 不可逆；failed/blocked 恢复=plan 新 id（§C1）

// ———— 路径派生（§A：随 DSH_AGENT_ORG_PATH 派生，/tmp 假组织冒烟自动隔离） ————
export function teamPathFor(orgPath) { return join(dirname(orgPath), 'team.json'); }
export function teamLockPathFor(orgPath) { return join(dirname(orgPath), 'team.lock'); }

const fail = (code, message) => { throw new OrgError(message, { code }); };

// ———— 读取与版本防线（§0.8：缺失=null＝零团队模式；损坏/高版本=报错，禁止尽力解析） ————
export function loadTeamDoc(orgPath) {
  const path = teamPathFor(orgPath);
  if (!existsSync(path)) return null;
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    fail('TEAM_SCHEMA_CORRUPT', `team.json 损坏，不是合法 JSON：${path}`);
  }
  return validateTeamShape(parsed, path);
}

function validateTeamShape(parsed, path) {
  const corrupt = (why) => fail('TEAM_SCHEMA_CORRUPT', `team.json 结构非法（${why}）：${path}`);
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) corrupt('根须为对象');
  if (typeof parsed.schemaVersion !== 'number' || !Number.isInteger(parsed.schemaVersion)) corrupt('schemaVersion 须为整数');
  if (parsed.schemaVersion > TEAM_SCHEMA_VERSION) {
    fail('TEAM_SCHEMA_TOO_NEW', `team.json 版本过新：schemaVersion=${parsed.schemaVersion}，本版本支持 1..${TEAM_SCHEMA_VERSION}`);
  }
  if (parsed.schemaVersion < TEAM_SCHEMA_VERSION) corrupt(`schemaVersion 只支持 ${TEAM_SCHEMA_VERSION}`);
  if (!Number.isInteger(parsed.rev)) corrupt('rev 须为整数');
  if (typeof parsed.objective !== 'string') corrupt('objective 须为字符串');
  if (!Array.isArray(parsed.tasks)) corrupt('tasks 须为数组');
  if (parsed.tasks.length > TEAM_TASKS_CAP) corrupt(`tasks 超过 ${TEAM_TASKS_CAP}`);
  const ids = new Set();
  for (const t of parsed.tasks) {
    if (typeof t !== 'object' || t === null) corrupt('任务须为对象');
    if (typeof t.id !== 'string' || !TASK_ID_RE.test(t.id)) corrupt(`任务 id 非法：${JSON.stringify(t.id)}`);
    if (ids.has(t.id)) corrupt(`任务 id 重复：${t.id}`);
    ids.add(t.id);
    if (!TEAM_STATUSES.includes(t.status)) corrupt(`任务 ${t.id} status 非法：${JSON.stringify(t.status)}`);
    if (!Number.isInteger(t.attempt) || t.attempt < 1) corrupt(`任务 ${t.id} attempt 须为 ≥1 整数`);
    if (!Array.isArray(t.deps) || t.deps.some((d) => typeof d !== 'string' || d === '')) corrupt(`任务 ${t.id} deps 非法`);
  }
  return parsed;
}

// ———— §A team.lock：O_EXCL 创建即持锁；锁体 pid/ts；mtime>60s 死锁强删接管；finally 释放 ————
function withTeamLock(orgPath, fn) {
  const lockPath = teamLockPathFor(orgPath);
  const acquire = () => {
    try {
      writeFileSync(lockPath, `${JSON.stringify({ pid: process.pid, ts: Date.now() })}\n`, { flag: 'wx' });
      return true;
    } catch (err) {
      if (err.code === 'EEXIST') return false;
      throw err;
    }
  };
  mkdirSync(dirname(lockPath), { recursive: true });
  let acquired = acquire();
  let tookOver = false;
  if (!acquired) {
    let stale = false;
    try { stale = Date.now() - statSync(lockPath).mtimeMs > TEAM_LOCK_STALE_MS; } catch { stale = false; }
    if (stale) {
      try { rmSync(lockPath, { force: true }); } catch { /* 强删尽力 */ }
      tookOver = true;
      acquired = acquire();
    }
    if (!acquired) {
      fail('TEAM_LOCK_BUSY', `team.lock 被另一写者占用，本次未写入，可重试${tookOver ? '（死锁接管后仍抢占失败）' : ''}`);
    }
  }
  try { return fn(); } finally {
    try { rmSync(lockPath, { force: true }); } catch { /* 释放尽力 */ }
  }
}
// 锁用 O_EXCL（'wx'）创建，非原子写对（无 rename）——ADD-1 验收锚不受影响。

function saveTeamDoc(orgPath, doc) {
  atomicWrite(teamPathFor(orgPath), `${JSON.stringify(doc, null, 2)}\n`, { tmpPrefix: 'team' });
}

// ———— 邮件/留痕 append（与 lib/index.js 同构记录：字段面零增删，§G 邮件 schema 红线） ————
function appendMessageLocal(orgPath, record) {
  const path = join(dirname(orgPath), 'messages.jsonl');
  mkdirSync(dirname(path), { recursive: true });
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const message = { id, ts: new Date().toISOString(), ...record };
  appendFileSync(path, `${JSON.stringify(message)}\n`);
  return message;
}
function appendReportLocal(orgPath, record) {
  try {
    const path = join(dirname(orgPath), 'reports.jsonl');
    mkdirSync(dirname(path), { recursive: true });
    appendFileSync(path, `${JSON.stringify({ ts: new Date().toISOString(), ...record })}\n`);
  } catch { /* 留痕失败绝不影响调度主路径 */ }
}
function scanMessages(orgPath) {
  const path = join(dirname(orgPath), 'messages.jsonl');
  if (!existsSync(path)) return [];
  const out = [];
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    if (line.trim() === '') continue;
    try { out.push(JSON.parse(line)); } catch { /* 半行容忍：读侧过滤，与 loadJsonl 同口径 */ }
  }
  return out;
}

// ———— 纯推导辅助 ————
const depsAllDone = (task, byIdMap) =>
  (task.deps ?? []).every((dep) => byIdMap.get(dep)?.status === 'done');
const sameDeps = (a, b) => {
  const sa = [...new Set(a ?? [])].sort();
  const sb = [...new Set(b ?? [])].sort();
  return sa.length === sb.length && sa.every((d, i) => d === sb[i]);
};

/** DFS 环检测（deps 方向）；有环返回环路径文本 a→b→…→a（逐字符契约格式），无环 null。 */
export function findCycleText(depMap) {
  const color = new Map(); // 0/缺省=WHITE 1=GRAY 2=BLACK
  const stack = [];
  let found = null;
  const visit = (id) => {
    if (found !== null) return;
    color.set(id, 1);
    stack.push(id);
    for (const dep of depMap.get(id) ?? []) {
      if (found !== null) break;
      const c = color.get(dep) ?? 0;
      if (c === 1) {
        const at = stack.indexOf(dep);
        found = [...stack.slice(at >= 0 ? at : 0), dep].join('→');
        break;
      }
      if (c === 0 && depMap.has(dep)) visit(dep);
    }
    stack.pop();
    color.set(id, 2);
  };
  for (const id of depMap.keys()) {
    if ((color.get(id) ?? 0) === 0) visit(id);
    if (found !== null) return found;
  }
  return null;
}

// ———— §B① org_team_plan 内核：校验→全图环检测（整单零写入）→锁内 upsert 合并落盘 ————
export function planTeam(orgPath, args) {
  const tasksIn = Array.isArray(args?.tasks) ? args.tasks : [];
  if (tasksIn.length === 0) fail('TEAM_EMPTY', 'org_team_plan：tasks 须为非空数组（至少立项一个任务）');
  if (tasksIn.length > TEAM_TASKS_CAP) throw new OrgError(`org_team_plan：单批 tasks 超过 ${TEAM_TASKS_CAP} 上限`);
  let objectiveGiven = false;
  let objectiveText = '';
  if (args?.objective !== undefined && args.objective !== null) {
    objectiveGiven = true;
    objectiveText = String(args.objective).trim();
    if (objectiveText.length > TEAM_OBJECTIVE_MAX) throw new OrgError(`objective 超过 ${TEAM_OBJECTIVE_MAX} 字`);
  }
  const orgDoc = loadOrg(orgPath);
  const incoming = [];
  const batchIds = new Set();
  for (const raw of tasksIn) {
    if (typeof raw !== 'object' || raw === null) throw new OrgError('tasks 每一项须为对象 {id,title,owner,deps?}');
    const id = String(raw.id ?? '');
    if (!TASK_ID_RE.test(id)) throw new OrgError(`非法 task id（须匹配 /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/）：${JSON.stringify(raw.id)}`);
    if (batchIds.has(id)) throw new OrgError(`同批 id 重复：${id}（幂等键须批内唯一）`);
    batchIds.add(id);
    const title = String(raw.title ?? '').trim();
    if (title === '') throw new OrgError(`任务 ${id}：title 不能为空`);
    if (title.length > TEAM_TITLE_MAX) throw new OrgError(`任务 ${id}：title 超过 ${TEAM_TITLE_MAX} 字`);
    const owner = String(raw.owner ?? '');
    if (byId(orgDoc, owner) === undefined) fail('TEAM_UNKNOWN_OWNER', `owner 非已知节点：${JSON.stringify(raw.owner)}`);
    const deps = raw.deps === undefined || raw.deps === null ? [] : raw.deps;
    if (!Array.isArray(deps) || deps.some((d) => typeof d !== 'string' || d === '')) throw new OrgError(`任务 ${id}：deps 须为非空字符串数组`);
    incoming.push({ id, title, owner, deps: [...deps] });
  }
  return withTeamLock(orgPath, () => {
    const doc = loadTeamDoc(orgPath); // 锁内权威重读（§0.4 一切写经锁串行）
    const tasks = doc === null ? [] : doc.tasks.map((t) => ({ ...t }));
    const by = new Map(tasks.map((t) => [t.id, t]));
    // deps 引用校验（含同批）——对合并后全量 id 集
    const knownIds = () => new Set([...by.keys(), ...incoming.map((t) => t.id)]);
    for (const t of incoming) {
      const known = knownIds();
      for (const dep of t.deps) {
        if (!known.has(dep)) fail('TEAM_DEP_UNKNOWN', `任务 ${t.id} 的 deps 引用不存在的 task id：${dep}`);
      }
    }
    // 合并语义（§B①）：终态再现→skipped；running 有变→RUNNING_IMMUTABLE；pending/ready upsert；新 id pending
    const added = [];
    const updated = [];
    const skipped = [];
    for (const t of incoming) {
      const ex = by.get(t.id);
      if (ex === undefined) {
        const task = { id: t.id, title: t.title, owner: t.owner, deps: t.deps, status: 'pending', attempt: 1 };
        tasks.push(task);
        by.set(t.id, task);
        added.push(t.id);
        continue;
      }
      if (TERMINAL_STATUSES.includes(ex.status)) { skipped.push(t.id); continue; } // 防覆盖历史
      if (ex.status === 'running') {
        if (t.title !== ex.title || t.owner !== ex.owner || !sameDeps(t.deps, ex.deps)) {
          fail('TEAM_TASK_RUNNING_IMMUTABLE', `在途任务 ${t.id}（status=running）的 title/owner/deps 不可改；先 done 再以新 id 立项`);
        }
        continue; // 同值重发＝幂等 no-op
      }
      ex.title = t.title; ex.owner = t.owner; ex.deps = t.deps; // pending/ready 可 upsert（status/attempt 不动）
      updated.push(t.id);
    }
    if (tasks.length > TEAM_TASKS_CAP) throw new OrgError(`合并后 tasks 超过 ${TEAM_TASKS_CAP} 上限`);
    // 环检测＝合并前对全图（含旧边）；有环整单零写入，错误文含环路径（t1→t3→t2→t1）
    const depMap = new Map(tasks.map((t) => [t.id, (t.deps ?? []).filter((d) => by.has(d))]));
    const cycle = findCycleText(depMap);
    if (cycle !== null) fail('TEAM_CYCLE_DETECTED', `依赖图成环，整单拒绝零写入：${cycle}`);
    const objective = objectiveGiven ? objectiveText : (doc?.objective ?? '');
    if (doc === null && objective === '') throw new OrgError('首次立项必须提供 objective');
    const next = {
      schemaVersion: TEAM_SCHEMA_VERSION,
      rev: (doc?.rev ?? 0) + 1,
      objective,
      updatedAt: new Date().toISOString(),
      tasks,
    };
    saveTeamDoc(orgPath, next);
    return { doc: next, added, updated, skipped };
  });
}

// ———— §C2b/C3③/C4 推导（recomputeAndDispatch 锁内唯一实现点的纯前半段） ————
function derive(doc, orgPath, nowMs) {
  const by = new Map(doc.tasks.map((t) => [t.id, t]));
  const events = [];
  let changed = false;
  // C3③ 崩溃残留：running 且 dispatchMessageId===null——按 [team:{id}] + from===rootNodeId 反查补回填；
  //         查无且 claim 距今>3min → 回 ready 交本轮重新 claim（attempt++ 由 claim 步执行）。
  const isUnset = (v) => v === null || v === undefined;
  const residues = doc.tasks.filter((t) => t.status === 'running' && (t.dispatchMessageId === null || t.dispatchMessageId === undefined) && t.dispatchedAt !== undefined);
  if (residues.length > 0) {
    const messages = scanMessages(orgPath); // 扫一次（§C3③ tick 反查 messages.jsonl）
    let orgDoc = null; // 惰性取 rootNodeId；org.json 坏了≠团队盘坏，降级为外部发件不参与反查
    for (const t of residues) {
      if (orgDoc === null) {
        try { orgDoc = loadOrg(orgPath); } catch { orgDoc = undefined; }
      }
      const rootId = orgDoc === undefined ? undefined : orgOfNode(orgDoc, t.owner)?.rootNodeId;
      const hit = messages.find((m) => m?.from === rootId && typeof m?.content === 'string' && m.content.includes(`[team:${t.id}]`));
      if (hit !== undefined) {
        t.dispatchMessageId = hit.id; // 仅补回填，不重发
        changed = true;
        events.push({ type: 'team', action: 'rescue-backfill', task: t.id, summary: `残留补回填 dispatchMessageId=${hit.id}（锁外窗口崩溃自愈）` });
      } else if (nowMs - Date.parse(t.dispatchedAt) > TEAM_RESIDUE_RECLAIM_MS) {
        t.status = 'ready';
        changed = true;
        events.push({ type: 'team', action: 'rescue-reclaim', task: t.id, summary: `claim 残留超 ${TEAM_RESIDUE_RECLAIM_MS / 60000}min 无邮件，回 ready 重新 claim（attempt 将 ++）` });
      }
    }
  }
  // C4 超时判定：running 且已有 dispatchMessageId（回填窗口 null 豁免，交 C3③）且 now−dispatchedAt>50min
  for (const t of doc.tasks) {
    if (t.status !== 'running' || isUnset(t.dispatchMessageId)) continue;
    const at = t.dispatchedAt === undefined ? Number.NaN : Date.parse(t.dispatchedAt);
    if (Number.isFinite(at) && nowMs - at > TEAM_RUNNING_TIMEOUT_MS) {
      t.status = 'failed';
      t.finishedAt = new Date(nowMs).toISOString();
      t.doneSource = 'timeout';
      t.summary = '超时未见完成信号';
      changed = true;
      events.push({ type: 'team', action: 'timeout', task: t.id, ok: false, summary: `running 超时（>${TEAM_RUNNING_TIMEOUT_MS / 60000}min）自动 failed，级联 blocked` });
    }
  }
  // 级联与推导至不动点：failed 传递闭包下游→blocked；pending/blocked deps 全 done→ready
  const byNow = () => { by.clear(); for (const t of doc.tasks) by.set(t.id, t); };
  byNow();
  for (let round = 0; round < doc.tasks.length + 2; round += 1) {
    let moved = false;
    for (const t of doc.tasks) {
      if (t.status === 'pending' || t.status === 'ready' || t.status === 'blocked') {
        const badDep = (t.deps ?? []).find((d) => {
          const s = by.get(d)?.status;
          return s === 'failed' || s === 'blocked';
        });
        if (badDep !== undefined && t.status !== 'blocked') {
          t.status = 'blocked';
          changed = moved = true;
          events.push({ type: 'team', action: 'cascade-block', task: t.id, summary: `上游 ${badDep} failed/blocked，级联 blocked` });
          continue;
        }
      }
      if ((t.status === 'pending' || t.status === 'blocked') && depsAllDone(t, by)) {
        t.status = 'ready';
        changed = moved = true;
        events.push({ type: 'team', action: 'ready', task: t.id, summary: 'deps 全 done，进入 ready 待派发' });
      }
    }
    if (!moved) break;
  }
  return { changed, events };
}

// ———— §C6 recomputeAndDispatch：锁内 读→推导→claim→写盘 rev+1→释放；锁外逐封邮件+回填 ————
export function recomputeAndDispatch(orgPath) {
  const path = teamPathFor(orgPath);
  if (!existsSync(path)) return 0; // §0.8 缺失=no-op
  const claims = [];
  let objective = '';
  withTeamLock(orgPath, () => {
    const doc = loadTeamDoc(orgPath);
    if (doc === null) return;
    objective = doc.objective;
    const { changed, events } = derive(doc, orgPath, Date.now());
    const by = new Map(doc.tasks.map((t) => [t.id, t]));
    for (const t of doc.tasks) {
      if (t.status === 'ready' && depsAllDone(t, by)) {
        // §C3② claim 先发后：running / attempt++ / dispatchedAt / dispatchMessageId=null 落盘
        t.status = 'running';
        t.attempt = (t.attempt ?? 0) + 1;
        t.dispatchedAt = new Date().toISOString();
        t.dispatchMessageId = null;
        claims.push({ id: t.id, owner: t.owner, title: t.title, attempt: t.attempt, dispatchedAt: t.dispatchedAt });
      }
    }
    if (changed || claims.length > 0) {
      doc.rev += 1;
      doc.updatedAt = new Date().toISOString();
      saveTeamDoc(orgPath, doc);
    }
    for (const ev of events) appendReportLocal(orgPath, ev);
  });
  if (claims.length === 0) return 0;
  // 锁外发送（§A：邮件发送在锁外；§C5 契约模板，行序固定供 QA grep 锚定）
  const orgDoc = loadOrg(orgPath);
  const sent = [];
  for (const c of claims) {
    try {
      const owner = byId(orgDoc, c.owner);
      const org = owner === undefined ? undefined : orgOfNode(orgDoc, owner.id);
      const root = org === undefined ? undefined : byId(orgDoc, org.rootNodeId);
      const message = appendMessageLocal(orgPath, {
        from: root?.id ?? 'external',
        fromName: `${root?.name ?? '外部'}(团队派发)`,
        fromOrg: org?.id ?? null,
        to: c.owner,
        toName: owner?.name ?? c.owner,
        toOrg: org?.id ?? null,
        content: [
          `【团队任务 ${c.id}】attempt=${c.attempt}`,
          `[team:${c.id}]`,
          c.title,
          objective,
          `执行要求：${c.title}`,
          // C5 契约尾行逐字（QA grep 锚点；禁空格/句号漂移）：
          '完成后必须 org_team_done(taskId,summary) 收尾；daemon 自动回投亦可兜底',
        ].join('\n'),
      });
      sent.push({ id: c.id, dispatchedAt: c.dispatchedAt, messageId: message.id });
    } catch (err) {
      appendReportLocal(orgPath, { type: 'team', action: 'error', task: c.id, ok: false, summary: `派发邮件发送失败（claim 残留由 C3③ 处置）：${err instanceof Error ? err.message : String(err)}` });
    }
  }
  if (sent.length === 0) return 0;
  // 再锁内回填 dispatchMessageId（仅动本次 claim 的窗口：running 且仍 null 且 dispatchedAt 匹配）
  withTeamLock(orgPath, () => {
    const doc = loadTeamDoc(orgPath);
    if (doc === null) return;
    let touched = false;
    for (const s of sent) {
      const t = doc.tasks.find((x) => x.id === s.id);
      if (t !== undefined && t.status === 'running' && (t.dispatchMessageId === null || t.dispatchMessageId === undefined) && t.dispatchedAt === s.dispatchedAt) {
        t.dispatchMessageId = s.messageId;
        touched = true;
      }
    }
    if (touched) {
      doc.rev += 1;
      doc.updatedAt = new Date().toISOString();
      saveTeamDoc(orgPath, doc);
    }
  });
  return sent.length;
}

// ———— §C2(c) tick：一切异常静默兜底（抢锁失败=静默跳过；绝不向 daemon 调用方抛错） ————
export function tickTeam(orgPath) {
  try {
    if (!existsSync(teamPathFor(orgPath))) return false;
    return recomputeAndDispatch(orgPath) > 0;
  } catch { return false; }
}

// ———— §B④ org_team_done 内核：锁内校验+迁移（done 幂等拒转＝C3④ 自检信号），返回后由调用方触发级联 ————
export function completeTask(orgPath, taskId, summary) {
  return withTeamLock(orgPath, () => {
    const doc = loadTeamDoc(orgPath);
    if (doc === null) fail('TEAM_TASKID_UNKNOWN', 'team.json 不存在（尚无团队立项），taskId 无从匹配');
    const t = doc.tasks.find((x) => x.id === taskId);
    if (t === undefined) fail('TEAM_TASKID_UNKNOWN', `taskId 不存在：${JSON.stringify(taskId)}`);
    if (t.status !== 'running') {
      fail('TEAM_BAD_TRANSITION', `org_team_done 仅对 status=running 合法，当前 ${t.status}${t.status === 'done' ? '（重复 done＝双派场景第二执行体的自检信号：org_team_status 核对后 [系统确认] 退出）' : ''}`);
    }
    const text = summary === undefined || summary === null ? '' : String(summary).trim();
    if (text.length > TEAM_SUMMARY_MAX) throw new OrgError(`summary 超过 ${TEAM_SUMMARY_MAX} 字`);
    t.status = 'done';
    t.finishedAt = new Date().toISOString();
    t.doneSource = 'tool';
    if (text !== '') t.summary = text;
    doc.rev += 1;
    doc.updatedAt = new Date().toISOString();
    saveTeamDoc(orgPath, doc);
    return { ...t };
  });
}

// ———— §B② org_team_status 文本（纯只读，不加锁不触发调度） ————
export function statusText(orgPath) {
  const doc = loadTeamDoc(orgPath); // 损坏/高版本照报错＝拒绝服务口径
  if (doc === null) return '尚无团队立项（team.json 不存在）。org_team_plan(objective, tasks) 立项。';
  const by = new Map(doc.tasks.map((t) => [t.id, t]));
  const stats = Object.fromEntries(TEAM_STATUSES.map((s) => [s, 0]));
  for (const t of doc.tasks) stats[t.status] += 1;
  const lines = doc.tasks.map((t) => {
    const head = `- ${t.id}·${t.status}·attempt=${t.attempt}·owner=${t.owner}·${t.title}`;
    return t.summary ? `${head}·「${t.summary.slice(0, 40)}」` : head;
  });
  const readyQueue = doc.tasks.filter((t) => t.status === 'ready').map((t) => t.id);
  const blocked = doc.tasks.filter((t) => t.status === 'blocked').map((t) => {
    const causes = (t.deps ?? []).filter((d) => by.get(d)?.status === 'failed' || by.get(d)?.status === 'blocked');
    return `- ${t.id}←${causes.length > 0 ? causes.join(',') : '上游含 failed/blocked'}`;
  });
  return [
    `rev=${doc.rev}｜objective: ${doc.objective}`,
    `stats: ${TEAM_STATUSES.map((s) => `${s}=${stats[s]}`).join(' ')}`,
    ...lines,
    `ready 队列: ${readyQueue.length > 0 ? readyQueue.join(', ') : '（空）'}`,
    blocked.length > 0 ? `blocked（成因）:\n${blocked.join('\n')}` : 'blocked: （无）',
  ].join('\n');
}

// ———— §F 只读快照（/team 路由用；不加锁、零副作用；三态=缺失/corrupt|too-new/正常） ————
export const zeroStats = () => ({ pending: 0, ready: 0, running: 0, done: 0, failed: 0, blocked: 0, total: 0 });

export function readTeamSnapshot(orgPath) {
  const path = teamPathFor(orgPath);
  if (!existsSync(path)) return { team: null, stats: zeroStats() };
  try {
    const doc = loadTeamDoc(orgPath);
    if (doc === null) return { team: null, stats: zeroStats() };
    const stats = zeroStats();
    for (const t of doc.tasks) stats[t.status] += 1;
    stats.total = doc.tasks.length;
    return { team: doc, stats };
  } catch (err) {
    if (err instanceof OrgError && (err.code === 'TEAM_SCHEMA_CORRUPT' || err.code === 'TEAM_SCHEMA_TOO_NEW')) {
      return { team: null, error: err.code, stats: zeroStats() }; // Q4：error⊥team；stats 键恒在全 0
    }
    throw err;
  }
}
