#!/usr/bin/env bash
# verify-team.sh — V14 团队调度端到端发布面（BE-V14-B/mtn0evg7-iszm · §G 原槽 scripts/）
# 隔离纪律（REV-V14 B-10②/R3）：
#   1) 端口自检守卫——本脚本绝不与在跑实例同端口对话；端口有应答即拒绝执行（防误伤生产）。
#      默认探 ${DSH_PORT:-3080}；发布窗口内实例常在跑，可用 DSH_PORT=<空闲端口> 显式改探空口。
#   2) 组织面只在 /tmp：DSH_AGENT_ORG_PATH 指向 mktemp 假 org；HOME 同步隔离（不触 ~/.dsh）。
#   3) 零重启 / 零 kill 任何 dsh 服务；trap 清理临时目录，不留孤儿。
# 断言口径：错误码/文案锚全部取自 lib/team.js 现盘事实（fail('TEAM_*') 与 new OrgError(文案)），不臆造码名。
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PORT="${DSH_PORT:-3080}"
PASS=0; FAIL=0
ok()  { echo "  ok   $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL $1"; FAIL=$((FAIL+1)); }
chk() { if [ "$2" = "$3" ]; then ok "$1（$2）"; else bad "$1（期望 $3，实得 $2）"; fi; }

# —— 守卫①：端口自检（在跑实例存在 = 直接退出，不做任何写操作）
if command -v curl >/dev/null 2>&1 && curl -fsS -m 2 "http://127.0.0.1:${PORT}/api/org/team" >/dev/null 2>&1; then
  echo "ABORT：:${PORT} 有实例在跑（本脚本只做 /tmp 隔离验证，绝不对话在跑实例）。改探空闲口：DSH_PORT=3999 $0" >&2
  exit 90
fi
echo "guard 1/3 :${PORT} 无在跑实例应答 → 允许继续（只读探测，未发任何写请求）"

# —— 守卫②：临时家 + 假 org（schemaVersion 2＝现盘 loadOrg 唯一支持形状）
WORK="$(mktemp -d /tmp/bevb-verify-XXXXXX)"
export HOME="${WORK}/home"; mkdir -p "${HOME}"
export DSH_AGENT_ORG_PATH="${WORK}/org.json"
trap 'rm -rf "${WORK}"' EXIT
echo "guard 2/3 HOME=${HOME} DSH_AGENT_ORG_PATH=${DSH_AGENT_ORG_PATH}"
echo "guard 3/3 全程零 kill dsh 服务；trap 已挂临时目录清理"

cat > "${DSH_AGENT_ORG_PATH}" <<'JSON'
{ "schemaVersion": 2, "updatedAt": null, "orgs": [ { "id": "org", "name": "验证组织", "rootNodeId": "lead",
  "nodes": [ { "id": "lead", "name": "负责人", "title": "负责人", "parentId": null, "systemPrompt": "" },
             { "id": "worker", "name": "成员", "title": "成员", "parentId": "lead", "systemPrompt": "" } ] } ] }
JSON
: > "${WORK}/messages.jsonl"

VERIFY_REPO="${REPO}" node --input-type=module - "${WORK}" <<'JS'
import { pathToFileURL } from 'node:url';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
const repo = process.env.VERIFY_REPO;
const team = await import(pathToFileURL(join(repo, 'lib/team.js')).href);
const work = process.argv[2];
const orgPath = process.env.DSH_AGENT_ORG_PATH;
const out = [];
const eq = (name, got, want) => out.push(`${name}|${String(got)}|${String(want)}`);
const snap = () => team.readTeamSnapshot(orgPath);
const st = (id) => snap().team.tasks.find((x) => x.id === id).status;
const msgLines = () => readFileSync(join(work, 'messages.jsonl'), 'utf8').split('\n').filter(Boolean).length;
const teamLines = () => readFileSync(join(work, 'messages.jsonl'), 'utf8').split('\n').filter((l) => l.includes('[team:')).length;
// 边界锚：TEAM_* 走 fail() 注入的 e.code；其余为 new OrgError(文案)（其 code 恒为 'org-request-failed'）
// → 锚一律按 "code + 空格 + message" 拼接后的子串匹配，两种抛错形态同源，禁按码名臆造。
const expectThrow = (name, fn, want) => {
  try { fn(); out.push(`${name}|未抛错|${want}`); }
  catch (e) {
    const hay = `${String(e.code ?? '')} ${String(e.message ?? '')}`;
    out.push(`${name}|${hay.includes(want) ? want : hay}|${want}`);
  }
};

// 1) 立项 + 调度点 → 首任务 ready→running 恰一封（claim 先发后＝§C3②）
team.planTeam(orgPath, { objective: '端到端验证', tasks: [{ id: 'v1', title: '任务一', owner: 'worker', deps: [] }, { id: 'v2', title: '任务二', owner: 'worker', deps: ['v1'] }] });
eq('立项后未调度前零派发', teamLines(), 0);
eq('调度点返回值', team.recomputeAndDispatch(orgPath), 1);
eq('v1 状态', st('v1'), 'running');
eq('v2 依赖未满足', st('v2'), 'pending');
eq('派发邮件恰一封', teamLines(), 1);

// 2) 工具面完成 → 再调度级联下游（同一 recomputeAndDispatch 唯一实现点）
team.completeTask(orgPath, 'v1', 'v1 完成锚 sha=deadbeef');
eq('v1 done', st('v1'), 'done');
team.recomputeAndDispatch(orgPath);
eq('v2 级联 running', st('v2'), 'running');
eq('派发邮件两封', teamLines(), 2);

// 3) 回投 hook 原语（§C4 甲案）：按 dispatchMessageId 精确命中兜底，doneSource=reply
const t2 = snap().team.tasks.find((x) => x.id === 'v2');
if (typeof team.completeFromReply !== 'function') {
  out.push('hook 命中|completeFromReply 未导出|v2');
} else {
  const hit = team.completeFromReply(orgPath, t2.dispatchMessageId, { ok: true, summary: 'x'.repeat(400) });
  eq('hook 命中 taskId', hit && hit.taskId, 'v2');
  eq('hook 后状态', st('v2'), 'done');
  eq('hook doneSource', snap().team.tasks.find((x) => x.id === 'v2').doneSource, 'reply');
  eq('hook summary 截 300', [...snap().team.tasks.find((x) => x.id === 'v2').summary].length, 300);
  const rev = snap().team.rev;
  eq('hook 幂等（同 id 二次=skipped）', team.completeFromReply(orgPath, t2.dispatchMessageId, { ok: true, summary: 'again' }), 'skipped');
  eq('hook 不命中（陌生 id）=skipped', team.completeFromReply(orgPath, 'no-such-mail', { ok: true, summary: 'x' }), 'skipped');
  eq('skipped 面 rev 零增', snap().team.rev, rev);
}

// 4) 失败面 → failed → 下游 blocked（§C1 由 derive 自然导出）
team.planTeam(orgPath, { objective: '端到端验证', tasks: [
  { id: 'v3', title: '任务三', owner: 'worker', deps: [] },
  { id: 'v4', title: '任务四', owner: 'worker', deps: ['v3'] },
] });
team.recomputeAndDispatch(orgPath);
const t3 = snap().team.tasks.find((x) => x.id === 'v3');
if (typeof team.completeFromReply === 'function') {
  team.completeFromReply(orgPath, t3.dispatchMessageId, { ok: false, summary: '角色进程未成功收工' });
}
eq('失败面 failed', st('v3'), 'failed');
eq('失败面 doneSource=reply', snap().team.tasks.find((x) => x.id === 'v3').doneSource, 'reply');
team.recomputeAndDispatch(orgPath);
eq('failed 下游 blocked', st('v4'), 'blocked');

// 5) 边界清单（§G/B-10⑤）：码名/文案均按现盘事实
expectThrow('自依赖成环拒绝', () => team.planTeam(orgPath, { objective: 'x', tasks: [{ id: 's1', title: 'T', owner: 'worker', deps: ['s1'] }] }), 'TEAM_CYCLE_DETECTED');
expectThrow('三节点环拒绝', () => team.planTeam(orgPath, { objective: 'x', tasks: [{ id: 'c1', title: 'T', owner: 'worker', deps: ['c3'] }, { id: 'c2', title: 'T', owner: 'worker', deps: ['c1'] }, { id: 'c3', title: 'T', owner: 'worker', deps: ['c2'] }] }), 'TEAM_CYCLE_DETECTED');
expectThrow('未知依赖拒绝', () => team.planTeam(orgPath, { objective: 'x', tasks: [{ id: 'u1', title: 'T', owner: 'worker', deps: ['ghost'] }] }), 'TEAM_DEP_UNKNOWN');
expectThrow('未知 owner 拒绝', () => team.planTeam(orgPath, { objective: 'x', tasks: [{ id: 'o1', title: 'T', owner: 'ghost', deps: [] }] }), 'TEAM_UNKNOWN_OWNER');
expectThrow('同批重复 id 拒绝', () => team.planTeam(orgPath, { objective: 'x', tasks: [{ id: 'd1', title: 'T', owner: 'worker', deps: [] }, { id: 'd1', title: 'T2', owner: 'worker', deps: [] }] }), '同批 id 重复');
expectThrow('objective 超限拒绝', () => team.planTeam(orgPath, { objective: 'x'.repeat(2001), tasks: [{ id: 'z1', title: 'T', owner: 'worker', deps: [] }] }), 'objective 超过 2000 字');
expectThrow('空立项拒绝', () => team.planTeam(orgPath, { objective: 'x', tasks: [] }), 'TEAM_EMPTY');
// running 不可变 / 重复 done：自建确定性前置态，不依赖上游 hook 是否落位
team.planTeam(orgPath, { objective: '端到端验证', tasks: [{ id: 'r1', title: '占用中', owner: 'worker', deps: [] }] });
team.recomputeAndDispatch(orgPath);
expectThrow('running 面 upsert 不可变', () => team.planTeam(orgPath, { objective: 'x', tasks: [{ id: 'r1', title: '改标题', owner: 'worker', deps: [] }] }), 'TEAM_TASK_RUNNING_IMMUTABLE');
team.completeTask(orgPath, 'r1', '首完成');
expectThrow('重复 done 拒绝', () => team.completeTask(orgPath, 'r1', '再完成'), 'TEAM_BAD_TRANSITION');
expectThrow('taskId 不存在拒绝', () => team.completeTask(orgPath, 'ghost-task', 'x'), 'TEAM_TASKID_UNKNOWN');

writeFileSync(join(work, 'results.txt'), out.join('\n'));
JS

while IFS='|' read -r name got want; do
  chk "$name" "$got" "$want"
done < "${WORK}/results.txt"

# —— 团队面缺失全路径 no-op（§G 兼容红线：等 v0.13 行为）
rm -f "${WORK}/team.json"
if node --input-type=module -e "
import { pathToFileURL } from 'node:url';
const team = await import(pathToFileURL('${REPO}/lib/team.js').href);
const p = '${DSH_AGENT_ORG_PATH}';
if (team.tickTeam(p) !== false) process.exit(1); // tickTeam 返回 boolean（现盘事实），非计数
if (team.recomputeAndDispatch(p) !== 0) process.exit(3);
if (team.readTeamSnapshot(p).team !== null) process.exit(2);
if (team.completeFromReply(p, 'any-id', { ok: true, summary: 's' }) !== 'skipped') process.exit(4);
" ; then ok "team.json 缺失 → tick=0 / recompute=0 / snapshot=null / hook=skipped 零写盘"; else bad "team.json 缺失全路径 no-op"; fi
[ ! -e "${WORK}/team.json" ] && ok "零写盘＝team.json 未被创建" || bad "team.json 被意外创建"

echo "————————————————————"
echo "verify-team: PASS=${PASS} FAIL=${FAIL}"
[ "${FAIL}" -eq 0 ] || exit 1
