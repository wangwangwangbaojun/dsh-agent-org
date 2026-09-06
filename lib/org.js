/**
 * dsh-agent-org — 多组织层级 agent 的纯逻辑层（除 load/save 外无 IO 副作用）。
 * 持久化为一个可 diff 的 JSON 文件，默认 ~/.dsh/agent-org/org.json。
 * schemaVersion 2：{ orgs: [{ id, name, rootNodeId, nodes: [...] }, ...] }
 * schemaVersion 1（单组织 { organization, nodes }）在 loadOrg 时自动迁移。
 * v0.5：节点带画布坐标 x/y（自由画布，任意拖动）；新 op movePos。
 * v0.8：新 op layoutAll（按上下级层级一键 tidy-tree 自动排布全部节点坐标）。
 */
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';

export const SCHEMA_VERSION = 2;
/** 连线类型：collab=协作（虚线，双向），dotted=虚线下级（点线带箭头，from 为虚线上级）。 */
export const EDGE_KINDS = ['collab', 'dotted'];
export const EDGE_KIND_NAMES = { collab: '协作', dotted: '虚线下级' };

export const LIMITS = {
  name: 120, title: 200, provider: 200, model: 200,
  systemPrompt: 50_000, maxTokens: 1_000_000, scopeEntries: 64, scopeEntry: 200,
  orgName: 120, orgs: 16, edges: 128, pos: 3000,
  // 全 doc 节点总数上限：placeNode/layoutTree/subtreeIds/validateTree 均为递归实现，
  // 深链畸形文件会以 RangeError（爆栈）逃逸 OrgError 语义，入口限流消除可达面。
  totalNodes: 2000,
};

export class OrgError extends Error {
  constructor(message, { code = 'org-request-failed', status = 400, detail } = {}) {
    super(message);
    this.code = code; this.status = status; this.detail = detail;
  }
}

function defaultOrgEntry() {
  return {
    id: 'org',
    name: '我的 AI 团队',
    rootNodeId: 'lead',
    nodes: [
      {
        id: 'lead', parentId: null, name: '负责人', title: '总体协调',
        model: {}, systemPrompt: '', toolScope: { allow: [], deny: [] },
        maxTokens: null, layout: null, x: 60, y: 40,
      },
    ],
    edges: [],
  };
}

export function defaultDoc() {
  return { schemaVersion: SCHEMA_VERSION, orgs: [defaultOrgEntry()], updatedAt: null };
}

/** 无序节点对 key：v0.7 起一条连线的唯一性按「这一对节点」判定，与连线类型无关（两个节点之间最多一条线）。 */
function pairKey(from, to) {
  return from < to ? `${from}|${to}` : `${to}|${from}`;
}

/** 上下级实线由 parentId 推导、始终绘制；父子节点对不该再有存储边（会叠在实线上无法点选）。 */
function isParentPair(parentOf, from, to) {
  return parentOf.get(from) === to || parentOf.get(to) === from;
}

/**
 * 补齐可选字段 + 旧数据迁移（原地修改）：
 * - 旧 v2 文件没有 edges 时补空数组；v0.5 前没有画布坐标 x/y 的节点自动放置。
 * - 「两个节点之间最多一条线」迁移：同对节点的第 2+ 条存储边丢弃（保留最先一条）；
 *   父子节点间的存储边丢弃（与推导实线完全重叠，历史上是点不中的隐形线）。
 */
export function normalizeDoc(doc) {
  for (const org of doc.orgs ?? []) {
    if (!Array.isArray(org.edges)) org.edges = [];
    const parentOf = new Map(org.nodes.map((node) => [node.id, node.parentId]));
    const keptPairs = new Set();
    org.edges = org.edges.filter((edge) => {
      if (typeof edge?.from !== 'string' || typeof edge?.to !== 'string' || edge.from === edge.to) return false;
      if (isParentPair(parentOf, edge.from, edge.to)) return false;
      const key = pairKey(edge.from, edge.to);
      if (keptPairs.has(key)) return false;
      keptPairs.add(key);
      return true;
    });
    const root = org.nodes.find((node) => node.parentId === null) ?? org.nodes[0];
    if (root !== undefined) placeNode(org, root);
  }
  return doc;
}

/** 缺坐标的节点自动放置：根 (60,40)；子节点在父节点下方、同父兄弟水平错开。已有的坐标不动。 */
function placeNode(org, node) {
  if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) {
    if (node.parentId === null) {
      node.x = 60;
      node.y = 40;
    } else {
      const parent = org.nodes.find((entry) => entry.id === node.parentId);
      const siblings = org.nodes.filter((entry) => entry.parentId === node.parentId);
      const index = Math.max(0, siblings.indexOf(node));
      node.x = (Number.isFinite(parent?.x) ? parent.x : 60) + 24 + index * 10;
      node.y = (Number.isFinite(parent?.y) ? parent.y : 40) + 110;
    }
  }
  for (const child of org.nodes) {
    if (child.parentId === node.id) placeNode(org, child);
  }
}

function posNumber(value, field) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 0 || n > LIMITS.pos) {
    throw new OrgError(`${field} 必须是 0..${LIMITS.pos} 的整数`);
  }
  return n;
}

/** 自动排布参数：盒宽/列距与前端 BOX_W 对齐；行距容纳「名称+职位+徽章」全高；坐标吸附 20px 网格。 */
const LAYOUT = { marginX: 60, marginY: 40, boxW: 152, gapX: 28, pitchY: 150, grid: 20 };

/**
 * 一键 tidy-tree（自上而下、每层一行）：叶子按遍历顺序从左往右排，
 * 父节点水平居中于首末子节点；原地覆盖全组织节点 x/y（前端仍可再手动拖动微调）。
 */
function layoutTree(org) {
  const children = new Map();
  for (const node of org.nodes) {
    if (!children.has(node.parentId)) children.set(node.parentId, []);
    children.get(node.parentId).push(node);
  }
  const root = org.nodes.find((node) => node.parentId === null) ?? org.nodes[0];
  if (root === undefined) return;
  const snap = (value) => Math.max(0, Math.min(LIMITS.pos, Math.round(value / LAYOUT.grid) * LAYOUT.grid));
  const step = LAYOUT.boxW + LAYOUT.gapX;
  let cursor = LAYOUT.marginX;
  const walk = (node, depth) => {
    node.y = snap(LAYOUT.marginY + depth * LAYOUT.pitchY);
    const kids = children.get(node.id) ?? [];
    if (kids.length === 0) {
      node.x = snap(cursor);
      cursor += step;
      return;
    }
    for (const kid of kids) walk(kid, depth + 1);
    node.x = snap((kids[0].x + kids[kids.length - 1].x) / 2);
  };
  walk(root, 0);
}

/** 兼容旧称：单组织时代的 defaultOrg()。 */
export const defaultOrg = defaultDoc;

export function allNodes(doc) {
  return doc.orgs.flatMap((org) => org.nodes);
}

export function orgById(doc, id) {
  return doc.orgs.find((org) => org.id === id);
}

export function byId(doc, id) {
  for (const org of doc.orgs) {
    const node = org.nodes.find((entry) => entry.id === id);
    if (node !== undefined) return node;
  }
  return undefined;
}

export function orgOfNode(doc, id) {
  return doc.orgs.find((org) => org.nodes.some((entry) => entry.id === id));
}

export function activeOrg(doc, request) {
  const org = request?.org === undefined || request.org === null || request.org === ''
    ? doc.orgs[0]
    : orgById(doc, String(request.org));
  if (org === undefined) throw new OrgError(`组织不存在：${request.org}`);
  return org;
}

export function childrenOf(org, id) {
  return org.nodes.filter((node) => node.parentId === id);
}

export function isDescendant(org, ancestorId, id) {
  let current = org.nodes.find((node) => node.id === id);
  while (current !== undefined && current.parentId !== null) {
    if (current.parentId === ancestorId) return true;
    current = org.nodes.find((node) => node.id === current.parentId);
  }
  return false;
}

export function subtreeIds(org, id) {
  const ids = [id];
  const walk = (parent) => {
    for (const child of childrenOf(org, parent)) {
      ids.push(child.id);
      walk(child.id);
    }
  };
  walk(id);
  return ids;
}

export function chainOf(org, id) {
  const chain = [];
  let current = org.nodes.find((node) => node.id === id);
  while (current !== undefined) {
    chain.unshift(current);
    current = current.parentId === null ? undefined : org.nodes.find((node) => node.id === current.parentId);
  }
  return chain.map((node) => node.name);
}

function text(value, limit, field, required) {
  if (value === undefined || value === null || value === '') {
    if (required) throw new OrgError(`${field} 不能为空`);
    return '';
  }
  if (typeof value !== 'string') throw new OrgError(`${field} 必须是字符串`);
  const trimmed = value.trim();
  if (required && trimmed === '') throw new OrgError(`${field} 不能为空`);
  if (trimmed.length > limit) throw new OrgError(`${field} 超过 ${limit} 字`);
  return trimmed;
}

function scopeList(value, field) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value) || value.length > LIMITS.scopeEntries) {
    throw new OrgError(`${field} 必须是数组且不超过 ${LIMITS.scopeEntries} 条`);
  }
  return value.map((item) => text(item, LIMITS.scopeEntry, `${field} 条目`, true));
}

// BUG-V14B-5（ADJ-V14B-NESTED）：toolScope 嵌套门面——先过 SCOPE_KEYS 白名单（非 allow/deny 键
// 整单点名必抛，禁 {alow:[…]} 静默放开为不限工具面），再逐字段等旧修剪。非纯对象输入等旧走
// 既有空面路径（scopeList(undefined)→[]），本门不扩大打击面。
function sanitizeScope(raw, field) {
  if (raw !== undefined && raw !== null && typeof raw === 'object' && !Array.isArray(raw)) {
    checkKnownKeys(raw, SCOPE_KEYS, field);
  }
  return { allow: scopeList(raw?.allow, `${field}.allow`), deny: scopeList(raw?.deny, `${field}.deny`) };
}

function slug(value) {
  const ascii = value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  return ascii === '' ? '' : ascii.slice(0, 40);
}

function newNodeId(doc, name) {
  const base = slug(name) || 'node';
  let id = base;
  let n = 2;
  while (byId(doc, id) !== undefined) id = `${base}-${n++}`;
  return id;
}

function newOrgId(doc, name) {
  const base = slug(name) || 'org';
  let id = base;
  let n = 2;
  while (orgById(doc, id) !== undefined) id = `${base}-${n++}`;
  return id;
}

function newEdgeId(doc) {
  let id = 'edge';
  let n = 2;
  while (doc.orgs.some((org) => org.edges?.some((edge) => edge.id === id))) id = `edge-${n++}`;
  return id;
}

// BUG-V14B-5（ADJ-V14B-NESTED@5c36db7 终裁）：嵌套对象未知键白名单门——schema 对 model/toolScope 两
// 嵌套对象申报 additionalProperties:false，但装载层申报不执法（index.js:895 注释实锤＋_meta 实证），
// BUG-V14B-4 工具面门仅覆顶层 args 键——嵌套层申报=空头承诺。model:{provder} 静默产 {}（沿用宿主
// 默认）与 toolScope:{alow} 静默产 {allow:[],deny:[]}（受限意图被放开为不限工具面＝安全暴露）同病，
// 域层响亮拒（对齐 BUG-V14B-1/2/4 三裁哲学）。门位=域层非工具面：E8 门位反证锁与 E10 关系锁
// （knownKeys≡schema properties 单层语义）零涉；泛化遍历器案已驳（两白名单≈6 行，投机抽象禁止）。
const MODEL_KEYS = ['provider', 'model', 'fallback'];
const SCOPE_KEYS = ['allow', 'deny'];

function checkKnownKeys(raw, known, field) {
  const unknown = Object.keys(raw).filter((key) => !known.includes(key));
  if (unknown.length > 0) {
    throw new OrgError(`${field} 含未知字段：${unknown.join(', ')}（已知字段：${known.join('/')}），拒绝静默丢弃未知键并返回成功`);
  }
}

function sanitizeModel(raw) {
  // BUG-V14B-1（QA-V14 实测 2026-09-05，BUG-V14 同款病）：非空非对象输入（字符串/数组/数字/布尔）
  // 必须 fail-fast——旧行为把 model:'deepseek-chat' 之类静默吞成 {} 且工具返回成功，正是 BUG-V14 明令
  // 杜绝的静默形状不匹配。空面（undefined/null/''）＝沿用宿主默认，等旧产出 {}。
  if (raw === undefined || raw === null || raw === '') return {};
  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new OrgError('model 必须是对象 {provider?,model?,fallback?}（留空=沿用宿主默认）；不接受字符串/数组等形状');
  }
  const model = raw;
  // BUG-V14B-5：嵌套未知键整单点名必抛（等旧四形态在上方已早退，零翻转）。
  checkKnownKeys(model, MODEL_KEYS, 'model');
  const out = {};
  const provider = text(model.provider, LIMITS.provider, 'model.provider', false);
  const name = text(model.model, LIMITS.model, 'model.model', false);
  const fallback = text(model.fallback, LIMITS.model, 'model.fallback', false);
  if (provider !== '') out.provider = provider;
  if (name !== '') out.model = name;
  if (fallback !== '') out.fallback = fallback;
  return out;
}

// op=update 的 patch 已知键白名单（唯一权威面；client.js patchOf 与之同构，金样静态锚定防漂移）。
const UPDATE_PATCH_KEYS = ['name', 'title', 'model', 'systemPrompt', 'toolScope', 'maxTokens'];

/** 应用一次变更；返回变更后的 doc（调用方负责保存）。request.resultId / request.removed 为回传元数据。 */
export function mutate(doc, request) {
  const op = request?.op;
  if (op === 'addOrg') {
    if (doc.orgs.length >= LIMITS.orgs) throw new OrgError(`最多 ${LIMITS.orgs} 个组织`);
    const rootName = text(request.rootName ?? '负责人', LIMITS.name, '根节点名称', true);
    const org = {
      id: newOrgId(doc, text(request.name, LIMITS.orgName, '组织名称', true)),
      name: text(request.name, LIMITS.orgName, '组织名称', true),
      rootNodeId: '',
      nodes: [],
    };
    const root = {
      id: newNodeId(doc, rootName), parentId: null, name: rootName,
      title: text(request.rootTitle ?? '', LIMITS.title, '职位', false),
      model: sanitizeModel(request.model),
      systemPrompt: text(request.rootPrompt ?? '', LIMITS.systemPrompt, '系统提示词', false),
      toolScope: { allow: [], deny: [] }, maxTokens: null, layout: null, x: 60, y: 40,
    };
    org.rootNodeId = root.id;
    org.nodes.push(root);
    org.edges = [];
    doc.orgs.push(org);
    request.resultId = org.id;
  } else if (op === 'removeOrg') {
    const org = activeOrg(doc, request);
    if (doc.orgs.length <= 1) throw new OrgError('至少保留一个组织；删除前请先新建其他组织');
    doc.orgs = doc.orgs.filter((entry) => entry.id !== org.id);
    request.removedOrg = org.id;
  } else if (op === 'renameOrg' || op === 'setName') {
    const org = activeOrg(doc, request);
    org.name = text(request.name, LIMITS.orgName, '组织名称', true);
  } else {
    const org = activeOrg(doc, request);
    if (op === 'add') {
      const parent = org.nodes.find((entry) => entry.id === request.parentId);
      if (parent === undefined) throw new OrgError(`上级节点不存在：${request.parentId}`);
      const siblingCount = childrenOf(org, parent.id).length;
      const node = {
        id: newNodeId(doc, text(request.name, LIMITS.name, '节点名称', true)),
        parentId: parent.id,
        name: text(request.name, LIMITS.name, '节点名称', true),
        title: text(request.title, LIMITS.title, '职位', false),
        model: sanitizeModel(request.model),
        systemPrompt: text(request.systemPrompt ?? '', LIMITS.systemPrompt, '系统提示词', false),
        toolScope: sanitizeScope(request.toolScope, 'toolScope'),
        maxTokens: null,
        layout: null,
        x: (Number.isFinite(parent.x) ? parent.x : 60) + 24 + siblingCount * 10,
        y: (Number.isFinite(parent.y) ? parent.y : 40) + 110,
      };
      org.nodes.push(node);
      request.resultId = node.id;
    } else if (op === 'update') {
      const node = org.nodes.find((entry) => entry.id === request.id);
      if (node === undefined) throw new OrgError(`节点不存在：${request.id}`);
      // BUG-V14B-3 两层 fail-fast（QA-V14 实测 2026-09-05）：
      // ① patch 未知键整层被无视＝静默假成功，必拒（@6baecd0 已落，未知键检查保持在先——
      //    纯未知键 patch 亦须得「未知字段」点名，不得退化为泛化的零键拒绝）；
      // ② 有效已知键为 0（含空 patch）＝「返回成功但无操作」，正是 BUG-V14 失败签名，同样必拒。
      //    此项曾为票面可选项、与 QA-GATE1 A4 旧钉（lead 裁定③：空入参=成功）冲突而不落地；
      //    lead 票 mtnb4jm0-td72 裁定并入 BUG-V14B＝此处预告的「A4 换钉」兑现，恢复点落地。
      //    同步换钉：test/bugv14b-update-gate.test.mjs 2b（锁等旧→锁必抛）、
      //    test/org-mutate-update-gate.test.mjs A4（成功前缀→必抛）。Web 面 client.js patchOf
      //    恰发 6 已知键（金样静态锚定），零键门不可能误伤 Web 更新路径。
      const patch = request.patch ?? {};
      const unknownKeys = Object.keys(patch).filter((key) => !UPDATE_PATCH_KEYS.includes(key));
      if (unknownKeys.length > 0) throw new OrgError(`update patch 含未知字段：${unknownKeys.join(', ')}（已知字段：${UPDATE_PATCH_KEYS.join('/')}）`);
      if (Object.keys(patch).length === 0) {
        throw new OrgError(`update patch 未携带任何已知字段（${UPDATE_PATCH_KEYS.join('/')} 至少其一），拒绝对空 patch 返回成功但无操作`);
      }
      if (patch.name !== undefined) node.name = text(patch.name, LIMITS.name, '节点名称', true);
      if (patch.title !== undefined) node.title = text(patch.title, LIMITS.title, '职位', false);
      if (patch.model !== undefined) node.model = sanitizeModel(patch.model);
      if (patch.systemPrompt !== undefined) node.systemPrompt = text(patch.systemPrompt, LIMITS.systemPrompt, '系统提示词', false);
      if (patch.toolScope !== undefined) {
        const { allow, deny } = sanitizeScope(patch.toolScope, 'toolScope');
        const overlap = allow.filter((entry) => deny.includes(entry));
        if (overlap.length > 0) throw new OrgError(`toolScope allow/deny 存在冲突条目：${overlap.join(', ')}`);
        node.toolScope = { allow, deny };
      }
      if (patch.maxTokens !== undefined) {
        const value = patch.maxTokens;
        if (value !== null && (!Number.isSafeInteger(value) || value < 1 || value > LIMITS.maxTokens)) {
          throw new OrgError(`maxTokens 必须是 1..${LIMITS.maxTokens} 的整数或 null`);
        }
        node.maxTokens = value;
      }
    } else if (op === 'move') {
      const node = org.nodes.find((entry) => entry.id === request.id);
      if (node === undefined) throw new OrgError(`节点不存在：${request.id}`);
      if (node.parentId === null) throw new OrgError('根节点不能移动');
      const target = org.nodes.find((entry) => entry.id === request.newParentId);
      if (target === undefined) throw new OrgError(`新上级不存在：${request.newParentId}`);
      if (target.id === node.id) throw new OrgError('不能把节点移动到自身之下');
      if (isDescendant(org, node.id, target.id)) throw new OrgError('不能把节点移动到自己的下级之下（会形成环）');
      node.parentId = target.id;
    } else if (op === 'movePos') {
      const node = org.nodes.find((entry) => entry.id === request.id);
      if (node === undefined) throw new OrgError(`节点不存在：${request.id}`);
      node.x = posNumber(request.x, 'x');
      node.y = posNumber(request.y, 'y');
    } else if (op === 'layoutAll') {
      layoutTree(org);
    } else if (op === 'delete') {
      const node = org.nodes.find((entry) => entry.id === request.id);
      if (node === undefined) throw new OrgError(`节点不存在：${request.id}`);
      if (node.parentId === null) throw new OrgError('根节点不能删除');
      const doomed = new Set(subtreeIds(org, node.id));
      org.nodes = org.nodes.filter((entry) => !doomed.has(entry.id));
      org.edges = org.edges.filter((edge) => !doomed.has(edge.from) && !doomed.has(edge.to));
      request.removed = doomed.size;
    } else if (op === 'addEdge') {
      const kind = String(request.kind ?? '');
      if (!EDGE_KINDS.includes(kind)) throw new OrgError(`连线类型必须是 ${EDGE_KINDS.join(' / ')}`);
      const from = org.nodes.find((entry) => entry.id === request.from);
      const to = org.nodes.find((entry) => entry.id === request.to);
      if (from === undefined) throw new OrgError(`连线起点不存在：${request.from}`);
      if (to === undefined) throw new OrgError(`连线终点不存在：${request.to}`);
      if (from.id === to.id) throw new OrgError('不能给节点连一条线到自己');
      if (org.edges.length >= LIMITS.edges) throw new OrgError(`一个组织的连线最多 ${LIMITS.edges} 条`);
      const parentOf = new Map(org.nodes.map((entry) => [entry.id, entry.parentId]));
      if (isParentPair(parentOf, from.id, to.id)) throw new OrgError('这两个节点已是上下级（实线相连），两个节点之间最多一条连线');
      const exists = org.edges.some((edge) => pairKey(edge.from, edge.to) === pairKey(from.id, to.id));
      if (exists) throw new OrgError('这两个节点之间已有一条连线（两个节点之间最多一条线）');
      org.edges.push({ id: newEdgeId(doc), from: from.id, to: to.id, kind });
      request.resultId = org.edges[org.edges.length - 1].id;
    } else if (op === 'removeEdge') {
      const before = org.edges.length;
      org.edges = org.edges.filter((edge) => edge.id !== request.id);
      if (org.edges.length === before) throw new OrgError(`连线不存在：${request.id}`);
    } else {
      throw new OrgError(`未知操作：${String(op)}`);
    }
  }
  validate(doc);
  doc.updatedAt = new Date().toISOString();
  return doc;
}

function validateTree(org) {
  if (typeof org?.id !== 'string' || org.id === '') throw new OrgError('组织 id 非法');
  if (typeof org?.name !== 'string' || org.name.trim() === '') throw new OrgError(`组织 ${org?.id} 缺少名称`);
  if (!Array.isArray(org.nodes) || org.nodes.length === 0) throw new OrgError(`组织 ${org.id} 的 nodes 不能为空（至少需要一个节点作为根节点；v1 文件空 nodes 时无法推断根，已拒收）`);
  const ids = new Set();
  for (const node of org.nodes) {
    if (typeof node?.id !== 'string' || node.id === '' || ids.has(node.id)) throw new OrgError(`节点 id 非法或重复：${node?.id}`);
    ids.add(node.id);
  }
  const roots = org.nodes.filter((node) => node.parentId === null);
  if (roots.length !== 1) throw new OrgError(`组织「${org.name}」必须恰好一个根节点，当前 ${roots.length} 个`);
  if (roots[0].id !== org.rootNodeId) throw new OrgError(`组织「${org.name}」rootNodeId（${String(org.rootNodeId)}）与实际根节点 ${roots[0].id}（parentId===null）不一致`);
  for (const node of org.nodes) {
    if (node.parentId !== null && !ids.has(node.parentId)) throw new OrgError(`节点 ${node.id} 的上级 ${node.parentId} 不存在`);
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) throw new OrgError(`节点 ${node.id} 缺少画布坐标 x/y`);
  }
  const seen = new Set();
  const walk = (id) => {
    if (seen.has(id)) throw new OrgError(`检测到环：节点 ${id}`);
    seen.add(id);
    for (const child of childrenOf(org, id)) walk(child.id);
  };
  walk(roots[0].id);
  if (seen.size !== org.nodes.length) {
    const orphan = org.nodes.find((node) => !seen.has(node.id));
    throw new OrgError(`存在游离节点：${orphan.id}`);
  }
  if (org.edges.length > LIMITS.edges) throw new OrgError(`组织「${org.name}」连线过多（≤${LIMITS.edges}）`);
  const edgeIds = new Set();
  for (const edge of org.edges) {
    if (typeof edge?.id !== 'string' || edge.id === '' || edgeIds.has(edge.id)) throw new OrgError(`连线 id 非法或重复：${edge?.id}`);
    edgeIds.add(edge.id);
    if (!EDGE_KINDS.includes(edge.kind)) throw new OrgError(`连线 ${edge.id} 类型非法：${String(edge.kind)}`);
    if (edge.from === edge.to) throw new OrgError(`连线 ${edge.id} 指向自身`);
    if (!ids.has(edge.from) || !ids.has(edge.to)) throw new OrgError(`连线 ${edge.id} 端点不存在`);
  }
  const seenPairs = new Set();
  const parentOf = new Map(org.nodes.map((node) => [node.id, node.parentId]));
  for (const edge of org.edges) {
    if (isParentPair(parentOf, edge.from, edge.to)) throw new OrgError(`连线 ${edge.id} 与上下级实线重复（父子节点间不再画第二条线）`);
    const key = pairKey(edge.from, edge.to);
    if (seenPairs.has(key)) throw new OrgError(`连线重复：${edge.id}（两个节点之间最多一条线）`);
    seenPairs.add(key);
  }
}

export function validate(doc) {
  if (doc?.schemaVersion !== SCHEMA_VERSION) throw new OrgError('schemaVersion 不受支持');
  if (!Array.isArray(doc.orgs) || doc.orgs.length === 0 || doc.orgs.length > LIMITS.orgs) {
    throw new OrgError(`orgs 必须是 1..${LIMITS.orgs} 个组织的数组`);
  }
  const orgIds = new Set();
  for (const org of doc.orgs) {
    if (orgIds.has(org.id)) throw new OrgError(`组织 id 重复：${org.id}`);
    orgIds.add(org.id);
    validateTree(org);
  }
  const nodeIds = new Set();
  for (const node of allNodes(doc)) {
    if (nodeIds.has(node.id)) throw new OrgError(`节点 id 跨组织重复：${node.id}`);
    nodeIds.add(node.id);
  }
}

/**
 * 把「已解析的配置文档」跑完整入库管线：版本防线 + v1→v2 迁移 + normalize + validate。
 * loadOrg 与 /import 端点共用本函数，保证磁盘加载与整 doc 导入的校验语义完全一致。
 * - schemaVersion ∉ {1, SCHEMA_VERSION}（缺失/类型错/更高版本等一切白名单外形态）→ 在任何原地
 *   mutation 前直接拒收（422 + UNSUPPORTED_SCHEMA_VERSION，报错写明支持范围），不做尽力解析；
 * - schemaVersion 为 1 的旧单组织格式走既有迁移路径；
 * - 全程保留节点原始 id：node id 是五类本机数据的外键——messages.jsonl / reports.jsonl（按 nodeId）、
 *   state.json 与 runner-state.json 游标及 roles.json 运行时状态（按 orgId/nodeId）；
 *   本管线（含 normalizeDoc 的补字段/迁边）不对任何 id 做重放或改名。
 * - prepareDoc 就地 normalize 入参（补 edges/补坐标等原地修改），抛错后入参不得复用。
 */
export function prepareDoc(parsed) {
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new OrgError('配置文档必须是 JSON 对象');
  }
  const sv = parsed.schemaVersion;
  if (sv !== 1 && sv !== SCHEMA_VERSION) {
    throw new OrgError(
      `schemaVersion ${JSON.stringify(sv) ?? 'undefined'} 不在本插件支持范围（支持 1..${SCHEMA_VERSION}），请升级插件后再导入`,
      { code: 'UNSUPPORTED_SCHEMA_VERSION', status: 422, detail: { found: sv ?? null, supported_max: SCHEMA_VERSION } },
    );
  }
  const v1OrgMeta = parsed.organization;
  const v1MetaOk = v1OrgMeta !== null && typeof v1OrgMeta === 'object' && !Array.isArray(v1OrgMeta);
  if (parsed?.schemaVersion === 1 && parsed.organization !== undefined && v1MetaOk && Array.isArray(parsed.nodes)) {
    const nodes = parsed.nodes;
    // v1 根节点取值优先级（架构师裁定口径）：
    // ① organization.rootNodeId 是字符串且能在 nodes 里对上 id → 用声明值（有此声明时行为与旧版完全一致）；
    // ② 否则按 normalizeDoc/layoutTree 同款推断兜底：parentId===null 的节点，否则 nodes[0]；
    // ③ 空 nodes 推不出根 → rootNodeId 留 undefined，交给 validate 拒收并给清晰报错（不静默产出非法 v2 doc）。
    // 旧版直接透传 organization.rootNodeId：早期快照缺该字段时 rootNodeId=undefined，validate 抛
    // 「rootNodeId 与实际根节点不一致」，loadOrg 期即崩（启动死锁），故此处补兜底。
    const declared = typeof parsed.organization.rootNodeId === 'string' ? parsed.organization.rootNodeId : undefined;
    const declaredUsable = declared !== undefined && nodes.some((node) => node?.id === declared);
    const inferred = declaredUsable ? undefined : (nodes.find((node) => node?.parentId === null) ?? nodes[0]);
    // 推断出的名义根若自身还挂着上级（整棵树没有 parentId===null 的节点），就地挂成真正的根：
    // 否则迁移产物永远过不了 validate 的单根检查（0 个根），仍会在 loadOrg 期崩——正是本兜底要消除的点。
    // 只在「无可用声明根且无结构根」时触发，此前这类 v1 文件 100% 直接崩，不存在被改变的正常行为。
    // 升根只拷贝被升根的那一个节点（其余条目保持引用），不写回入参节点对象——入参零污染。
    const promoteRoot = inferred !== undefined && inferred.parentId !== null;
    const migratedNodes = promoteRoot
      ? nodes.map((node) => (node === inferred ? { ...node, parentId: null } : node))
      : nodes;
    parsed = {
      schemaVersion: SCHEMA_VERSION,
      orgs: [{
        id: typeof parsed.organization.id === 'string' && parsed.organization.id !== '' ? parsed.organization.id : 'org',
        name: parsed.organization.name ?? '我的 AI 团队',
        rootNodeId: declaredUsable ? declared : inferred?.id,
        nodes: migratedNodes,
      }],
      updatedAt: parsed.updatedAt ?? null,
    };
  }
  // —— v2 信封守卫（进 normalizeDoc 之前）：normalizeDoc/placeNode 假定 org 与 node 均为对象、
  // nodes 非空数组；缺这层守卫时畸形导入会抛裸 TypeError（甚至递归爆栈），绕过 OrgError 语义。
  if (!Array.isArray(parsed.orgs) || parsed.orgs.length === 0) {
    throw new OrgError('orgs 必须是非空数组（若导入的是 v1 单组织文件，需同时带 organization 与 nodes 字段）');
  }
  for (const org of parsed.orgs) {
    if (org === null || typeof org !== 'object' || Array.isArray(org)) {
      throw new OrgError('orgs 条目必须是组织对象');
    }
    if (!Array.isArray(org.nodes) || org.nodes.length === 0) {
      throw new OrgError(`组织 ${String(org.id)} 的 nodes 必须是非空数组`);
    }
    for (const node of org.nodes) {
      if (node === null || typeof node !== 'object' || Array.isArray(node)) {
        throw new OrgError(`组织 ${String(org.id)} 的 nodes 条目必须是节点对象`);
      }
    }
  }
  // 全 doc 节点总数上限（S11）：结构合法但体量畸形的深链文件在此挡住，消除递归爆栈可达面。
  const totalNodes = parsed.orgs.reduce((sum, org) => sum + org.nodes.length, 0);
  if (totalNodes > LIMITS.totalNodes) {
    throw new OrgError(`全组织节点总数超过上限 ${LIMITS.totalNodes}（当前 ${totalNodes} 个）`);
  }
  normalizeDoc(parsed);
  validate(parsed);
  return parsed;
}

/** 读取并把 v1 单组织格式自动迁移为 v2 多组织。 */
export function loadOrg(path) {
  if (!existsSync(path)) return defaultDoc();
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    throw new OrgError(`组织文件损坏，不是合法 JSON：${path}`, { code: 'ORG_FILE_CORRUPT' });
  }
  return prepareDoc(parsed);
}

/**
 * 字节面原子写原语（ARCH-ADJ-2/ADD-3·D1）：序列化不进原语——调用方各自 JSON.stringify 后传字节/字符串。
 * tmp 前缀参数化：缺省 'org' = 既有 `.org.<pid>.<ts>.tmp` 逐字节等旧行为（R3 四项成功路径锚：
 * 字节内容 / tmp 前缀 / mode / 返回值，零偏差）。tmpPrefix 字符集白名单 [a-z0-9-]{1,16}——
 * 不含 '.' 与 '/'，'/' 和 '..' 结构性不可表达＝防路径逃逸硬红线；非法前缀=写前 throw。
 * tmp 恒落目标同目录（dirname(path)），rename 同盘原子。失败路径清孤儿 tmp 后原样 rethrow（D1）。
 */
export const TMP_PREFIX_RE = /^[a-z0-9-]{1,16}$/;

/** tmp 命名式单独出函数：golden 锁「`.org.<pid>.<ts>.tmp` / `.team.<pid>.<ts>.tmp`」逐字符格式用。 */
export function tmpNameFor(path, tmpPrefix = 'org') {
  if (!TMP_PREFIX_RE.test(tmpPrefix)) {
    throw new OrgError(`非法 tmpPrefix（白名单 [a-z0-9-]{1,16}，禁 '.'/'/'/'..'）：${JSON.stringify(String(tmpPrefix))}`);
  }
  return join(dirname(path), `.${tmpPrefix}.${process.pid}.${Date.now()}.tmp`);
}

export function atomicWrite(path, data, opts = {}) {
  const tmp = tmpNameFor(path, opts.tmpPrefix ?? 'org');
  mkdirSync(dirname(path), { recursive: true });
  try {
    writeFileSync(tmp, data, opts.mode === undefined ? undefined : { mode: opts.mode });
    renameSync(tmp, path);
  } catch (err) {
    try { rmSync(tmp, { force: true }); } catch { /* 孤儿 tmp 尽力清理，失败不掩盖原错误 */ }
    throw err;
  }
}

export function saveOrg(path, doc, opts = {}) {
  validate(doc);
  atomicWrite(path, `${JSON.stringify(doc, null, 2)}\n`, opts);
}

/**
 * 整 doc 导入前的整文件备份轮转：当前 org.json 原样落为同目录
 * org.json.bak.<ISO时间戳（冒号/点替换为 -，定宽字典序即时间序）>。
 * 读原始字节 → 同目录 tmp（mode 0600）→ rename 原子落位；写失败清孤儿 tmp 后原样 rethrow。
 * 完成后按名排序删除超出最近 keep（默认 5）份的旧备份，轮转清理失败静默（不影响备份本身成功）。
 * org.json 不存在（首次导入）则跳过，返回是否生成了备份。
 */
export function backupOrg(path, keep = 5) {
  if (!existsSync(path)) return false;
  const data = readFileSync(path);
  const bak = `${path}.bak.${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const tmp = join(dirname(bak), `.org-bak.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(tmp, data, { mode: 0o600 });
    renameSync(tmp, bak);
  } catch (err) {
    try { rmSync(tmp, { force: true }); } catch { /* 孤儿 tmp 尽力清理，失败不掩盖原错误 */ }
    throw err;
  }
  try {
    const prefix = `${basename(path)}.bak.`;
    const baks = readdirSync(dirname(path)).filter((name) => name.startsWith(prefix)).sort();
    for (const name of baks.slice(0, Math.max(0, baks.length - keep))) {
      try { rmSync(join(dirname(path), name), { force: true }); } catch { /* 单条删失败跳过 */ }
    }
  } catch { /* 轮转清理失败静默 */ }
  return true;
}

function renderOrgLines(org, lines) {
  const walk = (id, depth) => {
    const node = org.nodes.find((entry) => entry.id === id);
    const model = node.model?.model !== undefined
      ? `${node.model.provider !== undefined ? `${node.model.provider}/` : ''}${node.model.model}`
      : '默认模型';
    const bits = [`[${model}]`];
    if (node.systemPrompt !== '') bits.push(`提示词 ${node.systemPrompt.length} 字`);
    if (node.toolScope?.allow?.length > 0) bits.push(`仅允许工具 ${node.toolScope.allow.length} 项`);
    if (node.toolScope?.deny?.length > 0) bits.push(`禁用工具 ${node.toolScope.deny.length} 项`);
    if (node.maxTokens !== null && node.maxTokens !== undefined) bits.push(`maxTokens=${node.maxTokens}`);
    lines.push(`${'  '.repeat(depth)}${depth > 0 ? '└─ ' : ''}${node.name}${node.title !== '' ? `（${node.title}）` : ''} ${bits.join('，')}`);
    for (const child of childrenOf(org, id)) walk(child.id, depth + 1);
  };
  walk(org.rootNodeId, 0);
}

export function renderChart(doc) {
  const lines = [`${doc.orgs.length} 个组织（数据文件见插件 README；更新于 ${doc.updatedAt ?? '未保存'}）`];
  for (const org of doc.orgs) {
    lines.push('', `◆ 组织「${org.name}」（id=${org.id}，${org.nodes.length} 个节点）`);
    renderOrgLines(org, lines);
    if (org.edges.length > 0) {
      const nameOf = (id) => org.nodes.find((entry) => entry.id === id)?.name ?? id;
      for (const edge of org.edges) {
        lines.push(edge.kind === 'collab'
          ? `  连接：${nameOf(edge.from)} ⇄ ${nameOf(edge.to)}（协作·虚线）`
          : `  连接：${nameOf(edge.from)} ⇢ ${nameOf(edge.to)}（虚线下级·点线）`);
      }
    }
  }
  return lines.join('\n');
}
