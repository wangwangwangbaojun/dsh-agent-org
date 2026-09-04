# ARCH-V14 · v0.14 终态契约（团队调度四工具 + 依赖感知调度 + 续聊保底）
> **装配**：负责人 lead，2026-09-04。源=架构师（node→lead）三封契约冻结信，逐字节 verbatim 拼接，正文一字未改。
> - 1/3 §0 裁定总览 + §A 数据模型 + §B 四工具｜ts 2026-09-03T14:06:00.421Z｜消息 id mtlllgbp-1bw3｜段 sha256 `f84b34b7623db70014f600f906c67c3aa38f214e1d8ddb3c29613a75c7b4c337`（3214 字符）
> - 2/3 §C 调度器与状态机 + §D 续聊保底｜ts 2026-09-03T14:07:42.194Z｜消息 id mtllnmuq-vs2e｜段 sha256 `9d51ec49ee5d8385014c3ae7c25692d88bcb601615ec6cce106c89d1d47bc658`（3014 字符）
> - 3/3 §E 进阶判据 + §F /team 与面板 + §G 红线与拆票｜ts 2026-09-03T14:08:39.237Z｜消息 id mtllouv9-uu2g｜段 sha256 `681a82764a3d7b35a57d40c156845aebf83ff8dfcbd1f93b03733635067ef69e`（3038 字符）
>
> **终裁备案（lead，2026-09-04T12:41:05Z BE-V14-R0/mtlkzvq4-xfq6 关票裁定信）**：
> §E 进阶路线 **NO-GO**（判据 G1–G4 证据在无头 900s 预算内结构性不可达，按开原票既定规则「证据不达 GO 判据→NO-GO，不再复议」）；**§D buildTaskText 保底注入＝v0.14 续聊终态**。§E 探针（G1–G5 判据 + be14-probe 类脚本）转 v0.15+ 调研 backlog（排期权在 lead）。架构师对 §E 定稿措辞的一行受领件截至装配时未落件——scope 裁定属 lead 终裁面，不受影响，受领件到件后随单归档。合并波次按 §G：**BE-A → BE-B → FE → QA-V14 → REV → README+version 0.14.0（lead 执笔）**。

---

【ARCH-V14 · 契约冻结（1/3）：裁定总览 + A 数据模型 + B 四工具】母单 mtljwrz4-fq4n 拆票01 交付。A–G 全章节三封齐发（1/3 模型+工具；2/3 调度器+保底注入；3/3 进阶判据+/team+红线），拼接后落 docs/ARCH-V14-CONTRACT.md 即终态契约。

§0 先冻结八个影响拆票的关键裁定：
1) 调度器落点＝lib/team.js 纯函数库+三触发点（工具调用后／daemon 回投后 hook／空闲轮 tick），零新进程、零 dsh 核心改动；全部触发同一 recomputeAndDispatch，幂等可重入。
2) org_team_plan 重复语义＝追加合并 upsert，非全量替换；成环 plan 期整单拒绝零写入，报错含具体环路径。
3) 状态机六态：pending/ready/running/done/failed/blocked；上游 failed 级联下游 blocked，blocked 可随上游转 done 自动回流 ready（同一纯函数兼任阻塞与解封）。
4) 防双派三层＝team.lock（O_EXCL）串行一切写＋「claim 先落盘、邮件后发出」＋done 幂等拒转；对现网「完成后推进游标」的两代重抢免疫，不依赖 daemon 改造。
5) 完成判定＝org_team_done 优先；daemon 回投按 dispatchMessageId 精确匹配兜底转 done；两者皆无→50min 超时自动 failed。
6) 续聊保底＝buildTaskText 注入「近 N 封往来＋上次成果摘要」；调度相关解析只读 daemon 侧字段，注入段内容经控制符脱敏，无法伪造调度。
7) 进阶路线＝BE-V14-R0 按 §E 判据 G1–G5 实测，任一硬项红→NO-GO，保底注入即 v0.14 续聊终态；证据回抄后我只补一句终裁。
8) team.json 缺失＝一切行为等 v0.13（零团队模式）；损坏/高版本＝拒绝服务报错（TEAM_SCHEMA_CORRUPT / TEAM_SCHEMA_TOO_NEW），禁止尽力解析——与 org.json 版本防线同一口径。

§A team.json 数据模型（路径＝dirname(orgPath())/team.json，随 DSH_AGENT_ORG_PATH 派生，/tmp 假组织冒烟自动隔离）
schema：{schemaVersion:1, rev:int（修订号，每次成功写+1）, objective:str≤2000（重跑 plan 提供即覆盖）, updatedAt:ISO, tasks:Task[]}
Task＝{id:str /^[A-Za-z0-9][A-Za-z0-9._-]{0,31}$/（用户命名、团队内唯一＝幂等键）, title≤200, owner:节点全局 id（byId 命中；允许跨 org＝与 org_send 同义）, deps:task id[], status:六态, attempt:int≥1, dispatchedAt?, dispatchMessageId?（派发邮件 id＝完成兜底的唯一权威连接键）, finishedAt?, summary≤2000?, doneSource?:'tool'|'reply'|'timeout'}
原子写＝复用 lib/org.js saveOrg 模式（同目录 .team.<pid>.<ts>.tmp → rename）。多写者（交互会话工具进程×各 daemon）互斥＝team.lock：writeFileSync(flag:'wx') 创建即持锁，锁体 pid/ts，mtime>60s 视为死锁强删接管，finally 释放；抢锁失败→TEAM_LOCK_BUSY（工具面报错可重试，tick 静默跳过）。锁只圈「读→改→写 team.json」；邮件发送在锁外（时序详见 2/3 §C3）。/team 读取不加锁（rename 原子保证整文件可见），解析失败按损坏报。不做 bak 自动轮转（运行态，可由 messages/reports 重建，减面）。幂等键：立项＝task.id；派发＝status===ready 且 claim 成功；完成＝首个 done。

§B 四工具契约（挂载面 10→14：mount-selftest TOOL_NAMES +4、routes 1→2、package.json description「14 个协作工具」、README 同步＝已知连带义务）
错误枚举（OrgError.code，全量）：TEAM_CYCLE_DETECTED / TEAM_DEP_UNKNOWN / TEAM_UNKNOWN_OWNER / TEAM_TASKID_UNKNOWN / TEAM_TASK_RUNNING_IMMUTABLE / TEAM_BAD_TRANSITION / TEAM_TARGET_NOT_FOUND / TEAM_LOCK_BUSY / TEAM_SCHEMA_CORRUPT / TEAM_SCHEMA_TOO_NEW / TEAM_EMPTY。
① org_team_plan(objective:str, tasks:[{id,title,owner,deps}])→文本摘要。校验：tasks 非空否则 TEAM_EMPTY；同批 id 重复报错；deps 引用不存在的 task id（含同批）→TEAM_DEP_UNKNOWN；owner 非已知节点→TEAM_UNKNOWN_OWNER；合并前对全图（含旧边）环检测，有环→TEAM_CYCLE_DETECTED，错误文含环路径（t1→t3→t2→t1），整单零写入。合并语义：新 id 插入 pending；done/failed/blocked 的 id 再现→跳过并入结果 skipped[]（防覆盖历史）；running 的 id 且 title/owner/deps 有变→TEAM_TASK_RUNNING_IMMUTABLE（在途票不可改，先 done 再立新 id）；pending/ready 可 upsert 更新。成功后就地触发一次级联（C2a）。
② org_team_status()→文本：rev/objective/stats 六态各一/每任务一行（id·status·attempt·owner·title·summary 前 40 字）/ready 队列/blocked 及上游成因。纯只读，不加锁不触发调度。
③ org_team_talk(nodeId, message, from?)＝org_send 受控包装（同校验：message 非空≤4000，目标不命中→TEAM_TARGET_NOT_FOUND，from 缺省 external）。不改 team.json、邮件正文不打 team 标记（邮件协议保持纯净）；「续聊」效果由 §D 注入产生，不靠 talk 特殊语义。
④ org_team_done(taskId, summary)→status===running 才合法（否则 TEAM_BAD_TRANSITION；taskId 不存在→TEAM_TASKID_UNKNOWN）。成功：done+finishedAt+summary+doneSource='tool'，随后立即 recompute+级联派发——「完成触发重算」即由本工具实现。重复 done 报 BAD_TRANSITION＝重复派发场景下第二执行体的自检信号（见 C3④）。
（接 2/3）

---

【ARCH-V14 · 契约冻结（2/3）：C 调度器与状态机 + D 续聊保底】母单 mtljwrz4-fq4n；接 1/3。

§C 调度器（lib/team.js 纯函数 + 三处入口 hook；零新进程）
C1 状态机六态与迁移全集（除此一切路径=TEAM_BAD_TRANSITION）：pending→ready（deps 全 done）；ready→running（派发 claim）；running→done（tool/reply/timeout 之外的完成信号）；running→failed（回投失败或超时）；failed 闭包下游（传递闭包）→blocked；blocked→ready（其 deps 重新全 done，如上游以新 id 重做后图重算命中）。done 不可逆；failed/blocked 的恢复路径＝plan 新 id 重建（v0.14 裁定：不做 reset/retry 工具，控制面）。
C2 三触发点（均调同一 recomputeAndDispatch(orgPath)，锁内幂等，可任意重入）：(a) org_team_plan/org_team_done 工具进程成功提交后——会话派单与成员 done 的即时级联；(b) bin/org-role.js 回投 hook：完成回投 appendMessage 之后，扫 tasks[].dispatchMessageId===message.id，仍 running→自动完结（C4），再 recompute——覆盖不调 done 的成员；(c) daemon 每轮空闲 poll（心跳后）tickTeam()=recompute+超时判定兜底——覆盖工具未装载/进程崩溃丢触发。GET /team 只读绝不触发调度（面板轮询零扰动）。
C3 防双派（免疫「完成后推进游标」两代 daemon 重抢，零 daemon 游标改造）：①一切 team.json 写经 team.lock 串行（1/3 §A）；②派发=claim 先发后，两段写：锁内 claim（status=running, attempt++, dispatchedAt=now, dispatchMessageId=null, rev+1）落盘→锁外 appendMessage→再锁内回填 dispatchMessageId。两执行体同见 ready：第二个在锁内已见 running 直接跳过——调度层结构上发不出第二封；③崩溃残留=running 且 dispatchMessageId===null：tick 反查 messages.jsonl 是否存在 [team:{id}] 且 from===rootNodeId 的邮件——存在→仅补回填；不存在且 claim 距今>3min→重新 claim 发送（attempt++）。仍走 claim 先发后，不产生双发；④邮件层同一封派发邮件被两代 daemon 重复投递（现网已知限制，v0.14 不消除）：兜底=第二次执行 org_team_done 必撞 TEAM_BAD_TRANSITION→执行体应 org_team_status 核对后 [系统确认] 退出；写入 README 已知限制；QA-V14 加「/tmp 双 daemon 同 team 冒烟→[team:id] 邮件恰 1 封」真测锚点。
C4 完成判定与 taskId 关联：主=org_team_done；兜底=daemon 回投（[任务完成/失败 <message.id>]，message.id＝派发邮件 id）——hook 按 dispatchMessageId 精确等值匹配，权威、不做正文正则解析。完成→done（doneSource='reply'，summary=回投正文前 300 字）；失败→failed→级联 blocked。超时兜底：tick 见 running 且 now−dispatchedAt>TEAM_RUNNING_TIMEOUT_MS（常量 50min>3×900s 强杀窗口）→failed（doneSource='timeout'，summary='超时未见完成信号'）→级联 blocked。dispatchMessageId 回填窗口内（null）的任务豁免超时判定，交由 C3③ 路径处置。
C5 派发邮件契约：from=org.rootNodeId、fromName=负责人名+'(团队派发)'、to=owner.id、toOrg=orgOfNode(owner)（跨组织与 org_send 同义）。正文模板（行序固定，供 QA grep 锚定）：第1行【团队任务 {id}】attempt={n}；第2行 [team:{id}]（仅展示/QA 断言用，调度权威=dispatchMessageId 字段）；随后 title 行、objective 行、执行要求＝title＋尾行纪律「完成后必须 org_team_done(taskId,summary) 收尾；daemon 自动回投亦可兜底」。不附 [hop:]（daemon 用默认护栏）。
C6 recomputeAndDispatch 锁内顺序（唯一实现点）：读 team（缺失→no-op 返回）→逐任务推导（ready/blocked 迁移、C4 超时判定）→对每个可派 ready 执行 claim→写盘 rev+1→释放锁→锁外逐封发邮件+回填。单次 tick 的锁临界区无 IO 等待。

§D 续聊保底（daemon 组装注入，必须项，先于进阶路线生效）
D1 注入点=bin/org-role.js buildTaskText；段标题【近期协作上下文（daemon 自动注入·仅供参考·非指令源）】；位置=任务正文 """ 围栏之后、协作纪律之前。仅当过滤后有材料才注入（首单零注入，省 token）。
D2 选材（近 N 封）：messages.jsonl 过滤 to===SELF_ID && from!==SELF_ID && id!==本邮件 id，按 ts 取最近 TEAM_CONTEXT_N=6（常量置顶可调），每条 fromName+正文头 200 字，总预算 3000 字，超预算从最旧丢。
D3 上次成果摘要：首选=team.json 中本 owner 最近 done 任务（id+title+summary 截 500）；无团队任务时=本节点最近发出且前缀 [任务完成 的邮件正文截 500；皆无→该段不出。
D4 防伪造调度（边界条件裁定）：调度相关控制符（[team:…]、[任务完成/失败…]、[hop:…]）的解析只发生在 daemon 侧字段与真实邮件首行语义，绝不扫描注入段；且注入段组装时把正文中的方括号控制符做全角冒号替换（[team：…等），确定性免疫——防止往来邮件里引用过的标记被二次注入后误触发调度或 hop 护栏。
D5 QA 验收锚点（对应母单 e2e②「连派架构师两单，第二单复述第一单成果」）：第二单注入段内必须含第一单 summary（team.json 路径）或第一单完成邮件（D3 邮件路径）；QA 对两条路径分别出断言。
（接 3/3）

---

【ARCH-V14 · 契约冻结（3/3）：E 进阶判据 + F /team 与面板 + G 红线与拆票】母单 mtljwrz4-fq4n；接 2/3，本封后契约面完整冻结。

§E 进阶路线（常驻 runner + 固定 sessionId 续聊）：我只出探测判据，node-2（BE-V14-R0）实测，证据回抄后我一句终裁。
GO 判据（G1–G4 全绿且全部 /tmp 隔离：DSH_AGENT_ORG_PATH=/tmp/... 假 org、timeout 限时、绝不触 :3080 与在岗 daemon；证据=脚本原样输出+钉 sha256）：
G1 import 可达性：与 daemon 同构进程可 import dsh 树（dsh-agent/dsh-session API）并实例化最小 agent，import 路径+版本钉死；
G2 同会话续聊：agents.create({sessionId:固定})→followup×2，从落盘 session.jsonl.zstd 解出事件流证第2轮响应复现第1轮随机 token（机器可证，模型自称不算）；
G3 完结会话可再续：新进程对已完结 sessionId followup，跨进程复述先前 token；
G4 多写者与落盘：两写者并发 append 同会话不损坏不丢行（或内部锁证据），且「工作过程」Tab 仍可解析该会话。
G5（工程附加项，非硬门）固定会话落盘无上限轮转→GO 须附 sessionDir 登记字段+清理文档，否则只能给「条件 GO」。
终裁规则：G1–G4 任一红→NO-GO，§D 保底注入即 v0.14 续聊终态，不再复议；G1–G4 绿+G5 无解→条件 GO（仅派单续聊用途）。进阶实装不入本轮契约冻结面，GO 后另开票。

§F GET /team 契约（API_ROOT 下新路由；只读幂等零副作用；no-store；恒 200）
{ok:true, path, team:TeamDoc|null, error?:'TEAM_SCHEMA_CORRUPT'|'TEAM_SCHEMA_TOO_NEW', roster:RosterEntry[], stats:{pending,ready,running,done,failed,blocked,total}, now}
RosterEntry（roles.json 心跳 join org 树，字段以现盘为准）={nodeId,name,orgId,status:'busy'|'idle'|'stopped'|'offline'（有 org 无心跳=offline）,busy,lastBeat,pid,tasksDone,lastTask}。
team.json 不存在→team:null+stats 全 0（前端空态「尚无团队立项」，不出 404、不出红色错误）；损坏/null+error→面板顶部红条原文显示 error。
前端第5 Tab「团队面板」（lib/client.js，tab='team'）信息架构：owner 泳道（每 owner 一行，含 offline 灰列）×拓扑分层列；任务卡=id/title/状态色徽章/attempt/summary hover/dispatchedAt→finishedAt 时长；依赖箭头=SVG 按 deps 最长路径分层（pending..done 六列自然成层，箭头 deps→task，环在 plan 期已拒不可能入图，前端无需环处理）；状态色 pending 灰/ready 蓝/running 黄+脉冲/done 绿/failed 红/blocked 橙；成员心跳=复用角色工作台头像气泡（同一 lastBeat 阈值函数，勿再发明）；5s setInterval 轮询，循既有 mail/roles 的 useEffect+cleanup 模式，离开 Tab 停表。此表即「前端零疑问开工」验收面。

§G 红线 + 拆票改动面（评审硬门槛）
兼容性红线（全 P0）：邮件 schema 字段面零增删（[team:] 是正文文本非协议字段）；/feed、/org、/chart、/sessions 行为不变（只增不改）；org_mutate/自我更新/灵感引擎/导出导入零触碰；team.json 缺失＝所有新 hook try/catch no-op＝全路径字节级等 v0.13；不碰 :3080，重启验证归外部。
⚠️ 合并顺序红线（防换代风暴）：bin/lib 指纹一变，全部在岗 daemon 空闲即自我换代——任何合并必须先过 npm test 再落盘，推荐波次：BE-A（lib/team.js+四工具+/team 路由+selftest/package 口径）绿→BE-B（bin/org-role.js 三处 hook+注入，单独票）绿→FE（client.js）→QA-V14（scripts/verify-team.sh）→REV 终审→README+version 0.14.0（lead 执笔）。每票完成报钉 sha256（新纪律），改面越界即评审 blocker。
改动文件全集：lib/team.js（新）｜lib/index.js（+4 工具、+/team 路由、routeMounted 面 1→2）｜bin/org-role.js（回投 hook、tickTeam、buildTaskText 注入段；灵感分支与游标逻辑零改动）｜lib/client.js（第5 Tab）｜test/mount-selftest.mjs（10→14 工具、1→2 路由、/team 冒烟=假 org 空态 200）｜package.json（description/版本）｜README.md｜scripts/verify-team.sh（新目录，QA 名下）。
边界条件清单（QA-V14 必覆盖）：自环 deps:[self]；双节点环/三节点环→环路径逐字符断言；deps 未知 id；owner 未知；同批 id 重复；running id 改题→RUNNING_IMMUTABLE；pending 上 done→BAD_TRANSITION；重复 done；team.json 半行/坏 JSON/高版本；objective>2000；claim 崩溃恢复（手工造 running+dispatchMessageId=null 盘态）；超时判定边界（<min 与 >50min 两侧）；/team 三态；注入段控制符全角化断言（正文含 [team:x]/[hop:9]/[任务完成 字样的敌意邮件被注入后不触发调度）；双 daemon（/tmp 假 org 两节点）并发 tick 同 team→[team:] 邮件恰 1 封（防双派真测锚点）。
非功能风险备案：team.lock 60s 死锁接管（DoS 自恢复）；/team 无新增秘密暴露（与 /feed 同级可信面）；注入段全角化（D4）；stats 键恒在（全 0 也要出齐，沿用「各键恒在」纪律）。

实现期契约争议一律 org_send 转我仲裁；§A–§G 面冻结，仅接受增量裁定。三封齐，章节完整，验收面=可直接拆票派发、实现者零追问。

§G 尾部增量裁定入册（不开冻结面；来源 ARCH-ADJ-1，源件 mtmxi95d-ehj3 代码评审请示，架构师终裁、抄送 lead，lead 2026-09-04 拼接入册）
ADD-1（红线·blocker）：lib/team.js 必须 import lib/org.js 原子写/备份原语，禁止再写一套。§A 原文「参照模式」+指定 `.team.<pid>.<ts>.tmp` 前缀，字面上在命令实现第四套——更正为：org.js 原语泛化（tmpPrefix 选项）、team.js 只 import。验收锚：v0.14 diff 新增行内 `renameSync` 原子写对=0 命中。team.lock 已覆盖 lost-update，评审按 C6 核「锁圈读改写、邮件 IO 在锁外」，违反=blocker。
ADD-2（非红线·ARCH-DEBT-01，归 v0.15）：client.js/index.js 切分与三套实现归一不入 v0.14（正确性无关+与换代风暴红线冲突）。软约束：新增纯函数逻辑全落 lib/team.js，client.js 只收 FE tab 渲染增量；切分与功能票混做=blocker。
R1（基准石三件套=hash+annotated tag+第二副本，自 v0.14 起缺=blocker，不追溯）：lead 执行备案（2026-09-04）——`git tag -a baseline-v0.13.0 23f620f` 已落；第二副本 `~/.dsh/backups/baselines/baseline-v0.13.0.bundle`（--all 完整历史，git bundle verify 通过，sha256 31ffed245b5f373c0aa0b4344c4bf1ce34513ebbb8e036117d40973e4e9f7937，94407B）；有 remote 后 push --follow-tags。hash 仍是唯一权威标识，tag 只是锚。
R2（发布红线 R-LIC·blocker，生效于发布面）：对外发布物必须 LICENSE 文件与 package.json:"MIT" 一致。已挂末波票「README+version 0.14.0」验收项：LICENSE 先落（MIT 文本+版权人名称；版权人须人定，勿代拟——待 lead 人工确定后方可开票执行）。
R3（验收基线定版）：git archive 纯净树+HOME 隔离+`node --test` 全绿；v0.14 起测试数棘轮只升不降，起点 29/29（评审实测）。

§G 尾部增量裁定入册 No.2（不开冻结面；来源 ARCH-ADJ-2，源件 mtn1o5se-k5xg 代码评审 Q1–Q3 请示，架构师终裁件 mtn7g3wq-sdnz→node-5、lead 落档文本 mtn7f8w3-2kl6，lead 2026-09-05 拼接入册 [mtn1no5k-je02]；生效件执法面=docs/REV-V14-FINAL-CHECKLIST-v2.md @1e6319a §0/§A 白名单合并表，互引一致）

D1（Q1 裁定·允许当修复）：统一原子写原语必须携带失败路径孤儿 tmp 清理——try{写 tmp→rename}catch{尽力 rmSync(tmp,{force:true}) 后原样 rethrow，清理失败不掩盖原错误}。R3「字节级不变」范围就此钉定为**成功路径四项**（字节内容/tmp 前缀/mode/返回值）；saveOrg 失败路径新增清理属修复增强、非回归、不算违 R3（对齐 backupOrg 既有「写失败清孤儿 tmp 后原样 rethrow」家风）。实现护栏：原语按**字节面**收口（签名字节面，saveOrg/team 各自 JSON.stringify 后传入），不得把序列化锁进原语——否则 backupOrg（写原始字节）无法复用、反逼第四套。验收增量（并入 R3 golden，REV 硬门槛）：新增失败路径断言=构造写失败后①原错误照抛②目录内无 `.org.*.tmp` 残留；成功路径字节 golden 照旧全绿。理由：写失败是可重复场景，留 tmp=org 数据目录无上界磁盘泄漏。

D2（Q2 裁定·窄口径确认，豁免+双护栏）：红线绑定对象=配置文档（org.json/team.json）写者。bin/org-role.js:117-121 atomicWriteJson 仅写 daemon 自身状态、R2 grep 锚范围=lib/、§G L79 另裁游标零改动——三点同向，评审窄口径**成立，此件豁免、不构成第四套**。护栏 GQ2-1（blocker）：豁免绑定该实现体现有调用面；v0.14 波次内 org-role.js 若新增任何 tmp+rename 实现体、或其写面扩展至 org.json/team.json，豁免作废即 blocker。护栏 GQ2-2：该件归 v0.15 **ARCH-DEBT-02** 随原语归一；归一后 lib/ 之外任何第二实现体一律 blocker。

D3（Q3 裁定·勘误照准，即 ADD-3）：§G L79 改动文件全集**增补两列**：①**lib/org.js**——改动面限定为 saveOrg/backupOrg 底层原语泛化（tmpPrefix/mode 参数化 + D1 失败路径清理），成功路径字节/前缀/mode/返回值照 R3 锚零偏差；②**test/org.test.js**——saveOrg/backupOrg golden 回归锁落点（tmp 前缀 `.org.<pid>.<ts>.tmp`/`.org-bak.`、backup mode 0600 statSync 实测、keep=5 边界、不存在返回 false、D1 失败路径清理断言；既有版本门用例照绿）。此二文件**范围外**改动仍=越界 blocker，勘误不解禁。理由：ADD-1 强制改 org.js、golden 锁强制落 org.test.js，不勘误则「改面越界即 blocker」与增量裁定自相矛盾。（执法载体：REV-Checklist-v2 §A 白名单 lib/org.js=BE-A 专属 ADJ-2.1 增量、test/** 新文件=ADJ-2.3 非对称规则；golden 承载实测=test/org.test.js @c3af1d1 +6 金样。）

v0.15 债登记确认：ARCH-DEBT-01（client.js/index.js 切分，ADD-2 既有）＋ARCH-DEBT-02（org-role 原语归一，见 D2）＋ARCH-DEBT-03（lib/index.js:160 saveCursor 裸非原子写，架构师盘上复验属实；cursor 丢失可重扫自恢复、S3 定性维持）。三债并册随「不切」裁定，v0.14 不开新票。V14-R 清单 R1–R7 与 D1–D3 相容，即日生效。台账载体=docs/ARCH-DEBT-V15-v1.md（lead 2026-09-05 建账 [mtn1no5k-je02]）。

§F 尾部增量裁定入册 No.3（不开冻结面；来源=FE-V14-1 契约线程三件裁定：node-3 五问源件 mtn1j1cp-zkfv/mtllouv9-uu2g、lead 仲裁函 2026-09-04T14:19:47Z；架构师生效件＝mtn1v1cq-3h6q（14:29Z 简版，应 lead 件）＋mtn6x627-l87n（16:50Z ADD-3–ADD-8 排号版，「照排拼接」义务在 lead）＋mtn77xm9-gnlf（16:59Z ARCH-ADJ-3 详版）——三件同题互洽，执法以本入册为准，详版为最完整口径；lead 2026-09-05 拼接入册 [mtn1v1cq-3h6q]，同时销两笔落档欠账＝16:50 件拼接义务＋OPS3-CLOSE C3（ADJ-3 转录）未落项。编号注记：16:50 件之 ADD-3–ADD-8 续号与在账 **ADD-3（=No.2 D3）撞号**，执法编号=本册 Q1–Q5/D1，ADD-3–ADD-8 编号作废（内容不废，按源件 id 引用）。生效时点=架构师发出即生效（「发出即生效为契约增量」自述），本入册为台账化非再裁定。）

**前置勘误（D1 裁定前提，架构师 ADJ-3 亲验）**：§F「同一 lastBeat 阈值函数，勿再发明」前提不成立——盘上不存在共享阈值函数，实为三处 inline、**两种式**：L1039 与 L1290 同式 `beatMs < Math.max(60000,(intervalS ?? 20)*4000) && status!=='stopped'`；L1094（工作台「正在输入」气泡）系 `Math.max(90000,(intervalS ?? 20)*5000)`。该句可执行语义=「团队 Tab 不得自定阈值，必须逐字抄录盘上既有一式」。（lead 入册注：14:29 件把 L1094 写作「L1093」且三处并列为一式，系行号简写+表述简化，执法以本勘误为准；14:29 件所钉公式源 L1289-1290 与逐字抄方向不受影响——lead @417e97e 实测该对锚有效：L1289=beatMs、L1290=alive。）

**Q1｜RosterEntry 字段面 += intervalS（本次唯一字段增量）**：口径校正——§F「字段以现盘为准」是 join **输入侧**（roles.json 心跳记录）的派生依据，不是输出侧开放清单；RosterEntry 枚举列表=**封闭清单**，FE 只可依赖枚举字段，orgName 等枚举外盘上字段不入契约。增补文（替换 §F 该行 RosterEntry 定义，其余字不动）：`RosterEntry={nodeId,name,orgId,status,busy,lastBeat,pid,tasksDone,lastTask,intervalS:number|null}`（status 值集照 §F 原义不变：'busy'|'idle'|'stopped'|'offline'）。intervalS=roles.json 原值透传（不归一、不 clamp；写侧 bin/org-role.js 首拍必写 INTERVAL_S）；offline=有 org 无心跳→lastBeat/intervalS 均 null。失真后果钉死：BE 不透传→beatAlive 退化 `??20`（80s），对 intervalS=10/12 成员阈值虚宽假在线，不可接受。现盘证据（lead @21:52Z 复验一致）：roles.json 6/6 全含 intervalS（lead=10、成员=12）。**形状裁定（撞号件收口）**：线上形状=16:50/16:59 两件一致的 `number|null`（f4d4b47 实现 `hb?.intervalS ?? null` 已按此入库并过双闸）；14:29 件「`intervalS?:number`/无心跳=undefined」系表述简化，被本册覆盖——消费侧一律 `??` 兜底同罩 null/undefined 两形态，禁判形分叉。

**Q2｜roster=实例级全局面**：/team 单实例单路由、零 query 参数、零过滤；join 域=org 树**全部** org 全部节点 ∪ roles.json 全部心跳键（`orgId/nodeId` 形态天然含跨 org 心跳）∪ team.tasks 全体 owner——**每个 owner id 必有 roster 对目条目**（org 树有节点无心跳→合成 status:'offline'），不允许任何 owner 缺泳道。读出面必须与派发写入面一致（owner 跨 org 合法，§A）：全 org 的 roles×org 树 join，跨 org owner 的 roster 项必在。组织页签**不是** /team 的过滤器：orgId 仅显示层徽章，团队 Tab 不订阅组织选择；先例=/feed `roles:loadRoles()` 不受参数影响、FE 以 `${org.id}/${n.id}` 键自取（client.js L1288）。硬约束：跨 org owner 的泳道在任意页签下必在（灰列+orgId 标注），缺泳道=blocker。不新增 orgName 字段（控字段面）。

**Q3｜tasks 恒全局**：一字确认**是**——tasks 随 objective/rev/stats 恒全局，不随组织页签过滤，/team 无任何过滤参数；stats=全局六态同值。deps 跨 org 合法，按页签切图=拓扑分层与级联判定碎裂，禁止；FE 页签上下文仅可过滤 owner 泳道**展示**；未来「按 org 看」=前端泳道折叠（客户端显示层），API 面零改动。

**Q4｜error×team 组合态——组合态不存在，error⊥team**：error 仅由 team.json 读态产生（CORRUPT/TOO_NEW 两态；§0-8 禁尽力解析，残缺解析一律不给）→ error 在场时 team **恒 null**（「仍给全量」一说无合法数据可给，亦禁造）。同响应：`stats` 六键+total 恒在全 0（「各键恒在」纪律）＋ **`roster` 照常全量**（心跳面源=roles.json×org 树，与 team.json 无关，team 损坏不得连带清零——§F 红条款式设计意图=「红条与心跳同屏」）＋ ok:true＋HTTP 200；正常态 error 字段**省略**（非 null 非空串）。FE 单处三分支判别（无需第三判别字段）：`error ? 红条(error 原文置顶)+任务区空态说明+成员泳道正常渲染 : team ? 渲染 : 空态「尚无团队立项」`——error 在场不出空态、不渲染 stats。

**Q5｜恒 200 覆盖面——涵盖**：CORRUPT 与 TOO_NEW 两态均＝HTTP 200＋ok:true＋team:null＋error=<枚举原文>；绝无 4xx/5xx、绝无 ok:false、不新增状态码语义；「恒 200」是 /team 路由属性、不随状态退化。FE call() 不 throw、红条拿 error 原文=验收面。team.json 缺失=200+team:null+无 error（空态路原样不变）。非 200 仅存在于传输层/路由未挂载故障，不属契约面；API_ROOT 外未知路由不落本 handler，不在此约。

**D1｜照准（不行使否决）＋riders**：模块级新增 `beatAlive(r):boolean`，**仅供团队 Tab**。**D1-1 规格钉死**：函数体逐字＝`r?.lastBeat != null && (Date.now() - Date.parse(r.lastBeat)) < Math.max(60000, (r.intervalS ?? 20) * 4000) && r.status !== 'stopped'`（抄源 lib/client.js L1289-1290@2f30d58；`?? 20`/`60000`/`4000` 三常量为「逐字抄」组成部分禁擅改；头注钉「源 L1289-1290」）；null/undefined 入参→false＝团队 Tab offline 灰列语义（=!alive，与 roles Tab「○ 未启动」一致）。**禁误抄 L1094 式（90000/×5000，typing 提示语义）**。REV-V14 验收锚=函数体与规格逐字符 diff 空＋钉点注释在 diff 内。**D1-2**：三处内联（L1039/L1094/L1290）两式+beatAlive 收敛为单一共享模块＝漂移备案入债册（v0.15，与 ADD-2 并票；60s/×4 vs 90s/×5 语义分歧届时一并裁定）——**编号注记（lead）**：ADJ-3 原文借用「ARCH-DEBT-02」与债册在账 DEBT-02（org-role 原语归一，ADJ-2 D2 名下）撞号，按债册「编号连续追加不复用」规则改号登记＝**ARCH-DEBT-04**，内容照 ADJ-3 原文不损。v0.14 波次内既有三调用点零触碰（「收敛即 §G 改面越界」定性成立；与 lead 预裁 mtng97v8-7fsa 一致：调用点收敛**不得**作 FE-V14-1 合入前置，如需另立行为等价机械票排后置，排期权归 lead）。语义澄清：§F「勿再发明」=阈值**语义**唯一（同一算式、不再出新常数），从来非调用点唯一。**衔接钉（14:29 件 pin②）**：团队 Tab 的 beatAlive 入参必须携带 intervalS（roster 按 Q1 已补齐），否则 ??20 兜底阈值失真——**FE 将此写入自测断言**；QA-V14 边界清单加一条：「/team roster 条目含 intervalS 且 offline 态 lastBeat/intervalS=null」。

**lead 入册核验注记（执行面对账 @417e97e，只读实测）**：①BE 面 Q1–Q5 已在册达标、零返工——lib/team.js readTeamSnapshot 三态（error⊥team、stats 全 0）＋lib/index.js /team error 主路 `roster:buildRoster(orgDoc, snap.team)` 全量＋roster 十字段 intervalS 透传（index.js:304-321 注记即 Q1），均系 f4d4b47 双闸入库；Q2/Q3 join 域全 org×全节点∪心跳键∪owner 实测相符、路由零 org 参数。②边界注（Q4 未定义面，非违例）：/team catch 分支（loadOrg 异常/非 OrgError 异常）=roster:[]＋error 原文——roster join 依赖 orgDoc，org 树本身读失败时无源可 join，非心跳面连带清零，FE 按红条态渲染即可。③D1 调用点收敛与评审预裁（mtng97v8-7fsa）、FE 受领回执（17:25Z 六项全收+真值表 16 案预演）、债册（ARCH-DEBT-V15-v1.md）三线口径互洽，除上述两处撞号（ADD-3、DEBT-02，均已于本册改号收口）外无开放冲突。

---
