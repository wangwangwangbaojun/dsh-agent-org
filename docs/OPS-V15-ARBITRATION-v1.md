# OPS-V15 设计仲裁书 v1（设计仲裁票 mtn2utlr-nd8l 交付物）

> 作者=架构师 node；日期=2026-09-05。纯设计不落码：本书不写 bin/org-role.js、不解锁实施；实施票由 lead 依本书另开。
> 认版锚（我发信时点实测，发信即失效按新规重取）：HEAD=`6c9a8a6`；冻结面零漂移——`bin/org-role.js` 盘≡HEAD blob `a4ae657`，sha256=`0088de60e8f5…27674fd7`、388 行，docs/、test/ 零变更；porcelain=**BE-A1 在途两件**（`M lib/org.js`、`?? lib/team.js`，v0.14 线合法在途，非漂移，本书发信时点正在发生）；`npm test` 地板=65/65@净树（R3 棘轮起点，在途件未合前以最近净树数为准）。
> 本文行号一律为 **@6c9a8a6 锚定行号**；BE-V14-B 入库会推移行号，实施票落票时改用「语义锚」（各 hunk 附 grep 式），行号仅作导引。

---

## §1 裁定总览

| # | 争点 | 裁定 |
|---|---|---|
| R-B1 | 重抢治理路线 | **采 in-flight claim 标记**（+启动单实例守卫+恢复幂等回查+毒邮件熔断）；**驳回游标前置**。游标与灵感分支零改动纪律保持（书§3） |
| R-A | 层A吸收 | 四处逻辑改动（4 hunk 区）**全部「原样吸收」**，零重做；一处**增补**（A1 finish 内 clearTimeout）另立 hunk，不属重做（书§4） |
| R-C1 | 900s 根因 | 四候选 RC-1..4 分型＋取证仪表化；取证零代码子项**可即刻与 v0.14 波并行**；无数据不落地任何优化（书§5-D） |
| R-T1 | 时序 | OPS-V15 与 BE-V14-B **同文件严格串行，禁并行**：BE-V14-B（v0.14 波内）先，OPS-V15 后；OPS-V15 内部 V15-A→V15-B 串行、V15-C 可并行（书§8） |
| R-T2 | 发布窗口 | V15-A 入库前的历次 bin 合入（含 BE-V14-B）换代有**吞信窗口**（bootstrap 尾锚覆盖游标）→ 发布窗口纪律入 BE-V14-B 验收增补：全员 unread=0∧idle 时合入，或人工尾水位对账（书§8.3） |
| R-F | 冻结解除 | F1∧F2∧F3∧F4 成立方解除；F5 逐票把关（书§9） |
| R-C2 | AC-A4 残余面 | kind 面在仓门禁（edge-kind-lock/edgekind-contract）已覆盖 G1a/G1b，**不再搬运 node-4 /tmp 版重复门禁**；V15-C 仅补 G0 提取器自检+G2 数值区间案与 maxTokens 共源修复（书§5-C） |
| R-B2 | runner-state 多写者 | 现存 RMW 竞态记**残余风险**，本波不扩面；ARCH-DEBT 挂 v0.15（书§10-①） |

---

## §2 输入对账（三输入收讫确认）

- **输入①（OPS-1B 审计，node-2 mtn0gvoq-nn6r/mtn0i090-mxhd）**：file:line 证据链全核属实——读/过滤 `:305-306`、认领点 `:309-310` 零前置锁/标记（busy 心跳 `:314/:318` 纯展示、认领路径从不读取；全文件无单实例互斥）、runHeadless `:321`（窗长 ≤900s）、回投 `:331-337`、游标推进 `:342-343` 在执行与回投**之后**。三后果成立：①窗内崩溃 fresh[0] 重跑；②双实例同读同认领双跑（含已修事故 mtlkzvq9/mtlkzvpy 复现）；③回投落盘后、游标未进时崩溃→重跑+双回投。`--from-now` 尾锚 bootstrap（`:271-277`）只钉历史尾部、不改变窗中重抢；灵感分支 `:354-375` 从不写游标。→ 设计见 §3。
- **输入②（层A）**：票面「工作区 diff 8+/4-」= 层B 前基线时点快照；层B 先行入库（`4294c1b`，恰两 hunk）后层A 以 2f30d58 落盘（对当时 HEAD=org-role.js 11+/3- + .gitignore 2+），amend 树差=删一行死代码零行为变化；**两值各自时点皆真、内容逐字节复合等价**（node-5 mtn79h7i §二-1 亲证），本书采用入库锚 blob `a4ae657`/sha `0088de60…`/388 行。吸收裁定见 §4。
- **输入③（900s 实样）**：票窗三样本在盘核验：`mtn23gj6`（node-4, 14:35:40Z）、`mtn2madu`（node-3, 14:50:19Z）、`mtn2mqzv`（node-4, 14:50:40Z），均「已强杀（组级）」且 daemon 存活=层A 组杀防线实证；**三样本 stderr 摘要均为空**——超时取证饥饿的直接实证（现形超时只带 stderr 尾 800 字，stdout 全弃），列根因项取证面（§5-D）。另：当日另有 12:03/14:02/14:07/15:55/17:55 等 ≥5 起同形态样本，根因取证样本集应取全日 ≥8 起而非仅票窗 3 起。

---

## §3 B1 仲裁：in-flight claim 机制（核心设计）

### 3.1 路线裁定与理由
**采 in-flight claim 标记；驳回游标前置。** 理由：
1. 游标前置把邮件语义从 at-least-once 降为 at-most-once：前置后、答复前崩溃=邮件**永失**——邮件是本系统唯一投送通道，丢失比重复更不可接受；
2. 游标前置即改变游标语义（「已达终态」→「已认领」），**票面「游标语义零改动纪律」自斥该选项**；且破坏 `:306/:310` 半行竞态的「cursor miss 跳过」防线语义；
3. 前置不解决双实例：两实例同读旧值、各自前置、照样双跑——锁问题原封未动；
4. claim＋崩溃后按已发信箱回查去重，与 ARCH-V14 §C3③（dispatchMessageId 回查邮件）同型，组织内已有先例可审。

### 3.2 数据形状（runner-state.json，纯增量）
- 游标键值**不动**：`st[orgId/nodeId] = 消息id`（string），语义仍=「最后一条已达终态的邮件 id」；终态集合扩展为 {已回投, 恢复判已回投, 熔断弃} ——存值形状与位置语义不变。
- claim=兄弟键：`st[orgId/nodeId + "#claim"] = { messageId, pid, ts, attempt }`。`fresh` 过滤（`:306`）只读游标键，天然无视兄弟键，零干扰。
- 写路径全部复用既有 `atomicWriteJson`（`:118-121`，同步 RMW）。**终态推进=单原子写**：`{游标=messageId, claim=删除}` 同笔落盘，消灭「游标进了 claim 没清」中间态。

### 3.3 主流程（邮件分支，灵感分支零触碰）
1. **轮首恢复检查**（在 `:309` 认领判定之前，基于已加载的 inbox 数组，零额外 IO）：
   - 无 claim → 正常。
   - 有 claim 且 `messageId ≤ 游标` → 陈旧 claim，GC（随下次原子写清）。
   - 有 claim 且 `pid` 存活（`process.kill(pid,0)`：ESRCH=死，EPERM=活）且非本代 → **他实例在办：本轮跳过、不推进**（双实例运行期防线）。
   - 有 claim 且 `pid` 死或超 `TTL = RUN_TIMEOUT_S + 120s` → 崩溃残留，走恢复：
     a. **回投去重（封后果③）**：inbox 数组反查 `from===SELF_ID && /^\[任务(完成|失败) ${messageId}\]/` 命中 → 判已办 → 直接终态推进（游标=messageId、清 claim、report `type:'claim',action:'deduped'`），不重跑不二次回投。
     b. 未命中且 `attempt ≤ CAP(=2)` → **重认领**：claim={messageId, pid:本代, ts:now, attempt+1}，进入执行（at-least-once 重跑，封后果①），report `action:'recovered'`。
     c. `attempt > CAP` → **毒邮件熔断**：终态推进（弃）+ 向发件人回投错误摘要 + report `action:'abandoned'`——绝不让一封毒邮件永久卡队列。
2. **认领**：`:310` 选出 `fresh[0]` 后、心跳/执行**之前**，原子写 claim（attempt=1）。写失败视同认领失败，本轮弃（fail-fast）。
3. **终态**：回投块（`:331-340`）之后，把 `:342-343` 的游标推进扩展为上述**单原子写**（游标进+claim 清）。
4. 灵感分支 `:354-375`：零 claim、零游标、零改动——纪律不破，验收 grep 锁（§7-A6/A7）。

### 3.4 双实例根因封（封后果②）——启动单实例守卫
claim 的「检查→写」之间存在同步竞态窗（OS 级抢占），需启动面守卫补死：
- daemon 启动时读本节点 `roles.json` 心跳 `{pid, ts}`：pid 死 → 接管；pid 活 → 等待至多 5s（selfRestart 交接窗，旧代 `:384` 写 stopped 后即退）→ 仍活 → **exit(3) 响亮拒启**（不静默双跑）。
- selfRestart（`:233-238`）逻辑本身零改动；交接窗容差即覆盖换代重叠。
- claim TTL 保留为运行期兜底（守卫漏网/外部并发起进程时仍收敛）。

### 3.5 丢失面修复（B2 drain 的前置）——bootstrap 保游标
现 `:271-277` 的 bootstrap 在**已有持久游标时仍覆写为文件尾**：换代/重启瞬间「游标与尾之间」的未达邮件被静默吞——这是与重抢对偶的**丢失面**，不修它则 drain 名存实亡。裁定：**仅当无持久游标（首启）才尾锚；有游标即跳过 bootstrap，积压按序消费**。`--from-now false` 分支行为不变。

---

## §4 层A hunk 级吸收裁定表（票面义务：逐 hunk 标注）

锚：evidence patch `.evidence/org-role-layerA-0088de60.patch`（blob `b214647`→`a4ae657`，@@ -165,20 +165,25）；三源对账已由 node-3/node-4/node-5 三方互证（sha `0088de60…`/388 行/零漂移），我 17:24Z 复核链在册。

| hunk | 内容 | 裁定 | 注 |
|---|---|---|---|
| H-A1 | `spawn detached:true` + 动机注释（2+1 行） | **原样吸收** | 组杀前提；输入③三实样实证生效 |
| H-A2 | `finish()` 体内组杀 `process.kill(-child.pid,'SIGKILL')` | **原样吸收** | **增补 A1 另行**：finish 内 `settled=true` 后加 `clearTimeout(timer)`。现 MAX_OUTPUT→finish 路径 timer 滞留至 900s 期满，届时对 `-pid` 补刀有低概率高危的 PID 复用面 + 事件循环多持 900s。此为 OPS-V15 新 hunk（§5-H4），**非层A 重做** |
| H-A3 | 超时 timer 组杀双保险 + 报文「（组级）」标记 | **原样吸收** | 「（组级）」字样为在验收 grep 锚（§7-B5），禁删 |
| H-A4 | MAX_OUTPUT 越限改走 `finish()`（截断即定性回投，不吊 close） | **原样吸收** | 语义正确；stdout 头部 4000 字保留口径不动 |
| （卫生） | `.gitignore` +2（package-lock） | 已随 2f30d58 入库 | 不重复处置 |

**结论：层A 零重做。**「吸收」至此 = 设计基线并入 + 上述锚定表入册；实施票对层A 面**零动作**（2f30d58 已承载），后续仅按 §5 新 hunk 施工。

---

## §5 OPS-V15 子票划分 + 新行为 hunk 清单

> 拆票原则：单票单文件域、票内 hunk 级拆分入库、实现+回归同 commit、票号入 message、`-A/-a` 禁、**整文件独立 commit 禁令（终裁A）持续适用于每一票**。行号@6c9a8a6 + 语义锚。

### V15-A｜daemon 认领与恢复核心（文件域：bin/org-role.js + test/ 新文件）
- **H-A1c**（语义锚：`const message = fresh\[0\]`）：认领前写 claim（§3.3-2）。≈3 行。
- **H-A1r**（锚：`const fresh = \(Array.isArray` 前、轮首）：恢复块=去重回查/重认领/熔断（§3.3-1）。≈25 行。
- **H-A1f**（锚：`const next = { ...st, \[key\]: message.id };`）：终态单原子写（游标+claim 清）。≈2 行。
- **H-A1g**（锚：`if (!isStr(st\[key\])` bootstrap 块）：保游标 bootstrap（§3.5）。≈3 行。
- **H-A1s**（锚：`main().catch` 前 / 启动区）：单实例守卫（§3.4）。≈10 行。
- **H-A1p**（锚：`:67` ENV_NODE_ID 注释）：滞后注释顺修（node-5 §三 裁定；验收锚 `grep -c '补 from/fromName（' bin/org-role.js`=0 且含 fromOrg）。
- 测试：`test/claim-recovery.test.mjs`（stub npx 计数 + `DSH_AGENT_ORG_PATH` 假组织 + kill -9 沙盘；stub-spawn 先例=test/report-attribution.test.mjs:118）——案集见 §7-A。

### V15-B｜超时治理与清理（文件域：bin/org-role.js + test/ 新文件；V15-A 之后串行）
- **H-B1**（锚：`const finish = (value) =>`）：finish 内 `clearTimeout(timer)`（A1）。1 行。
- **H-B2**（锚：`child.kill('SIGKILL')` 两处）：pid 守卫——`detached` 且 `Number.isInteger(child.pid)` 才组杀；`child.pid` undefined（spawn 同步失败）只走子体守卫。≈3 行。
- **H-B3**（锚：`let child`→模块级 `let activeChild`；`process.exit(0)` 前注册 `process.on('exit', …)`）：**外部信号/异常退出路径组杀**（A2 补全，node-5 mtn6v8u8 项①）——daemon 经 `main().catch`/exit 死亡而子代在飞时，exit 钩子同步组杀 activeChild（detached 子树已独立成组，现形会成孤儿组）。≈5 行。
- **H-B4** 超时取证强化：超时回投/报告行改携 `elapsed=…s; stdout=…B; silence=…s; tail=「stdout 尾 ≤1000 字」; stderr 摘要：…`（保留「（组级）」字样锚）；新增 70% 软警 report 行（`type:'run', action:'timeout-warn'`）。≈10 行。**RUN_TIMEOUT_S 默认 900 不改**。
- 测试：`test/timeout-forensics.test.mjs`（短超时 stub：断言 finish 后 timer 回调不再触发 kill（spy）、ENOENT stub 无 `kill(-undefined)`、退出钩子后 stub 子组消亡、超时报文含三取证字段）。

### V15-C｜工具面自述门禁补全（AC-A4 残余面；文件域：lib/org.js + lib/index.js + test/；与 V15-A/B **零文件交集，可并行**）
- **H-C1**：`lib/org.js:19` `LIMITS` 加 `export`（additive 一词，零逻辑改动）——真值源单点（ADD-1 红线同源纪律）。
- **H-C2**：`lib/index.js:570` 自述 `1..64000` → `1..${LIMITS.maxTokens}` 模板串（消灭第二数字复制面；node-4 X1 实证漂移：域层实值 1..1_000_000）。
- **H-C3**：`test/toolface-selfdesc.test.mjs` 新档=G0 提取器自检（自写自验）+ G2 数值区间案（判据：自述声明区间 **≡** 域层合法区间；node-4「超出=硬红/窄于=软红」分档留作日后泛化条款，本案修复后取全等最严锚）。
- **H-C4**：`test/org-mutate-update-gate.test.mjs:112` 注释 `1..64000` 锚随动（1 hunk，列入本票票面，防门禁注释自漂）。
- **不再引入** node-4 /tmp/qa-v15 的 G1a/G1b 重复门禁：kind 面已由在仓 `test/edge-kind-lock.test.mjs`（R1/R1b/R2/R3a/R3b/E1/E2/I1）+ `test/edgekind-contract.test.mjs` 覆盖；/tmp 版视为草稿不作收货（载体灭失史两起在前）。

### V15-D｜900s 根因调查（零代码、只读；**不受冻结门禁用、可即刻与 v0.14 波并行**）
RC 分型与取证映射：
- **RC-1 任务体量超窗**：reports.jsonl 起止行全量分布（当日 ≥8 样本+成功任务对照集）→ 若主因：lead 窗口纪律/拆单指令（非代码）。
- **RC-2 模型侧/上游静默挂起**：现三样本 stderr 全空=与静默挂起自洽；确证需 V15-B silence 字段——先手工拆 reports 时序（开工→失败回投间隔是否恰=900s±ε）。
- **RC-3 启动链耗时（npx 解析/冷启动）**：隔离计时实验（npx dsh vs 直调 node，node-4 沙盘，timeout 限时）。阈值判据：中位 >60s 方准开优化票（候选方案=路径解析直调+npx 回退），**无数据不落码**。
- **RC-4 子组残留/管道不 close**：已由层A 闭合——继续监控「超时后 daemon 死亡/吊死」事件（预期零；实样三起 daemon 全活即现役证据）。
交付=`.evidence/ops15/rc-1435-ledger.md`（样本×RC 分类+结论）；验收见 §7-D。

---

## §6 文件边界清单

**OPS-V15 全域允许写**：`bin/org-role.js`（仅 V15-A/B，且仅 §5 所列语义锚邻域）；`lib/org.js`（仅 V15-C：export 一词）；`lib/index.js`（仅 V15-C：:570 一行）；`test/` 新增两档 + `org-mutate-update-gate.test.mjs` 注释一行（V15-C 票面）；`.evidence/ops15/`（取证，git-ignored）。

**全域禁碰（OPS-V15 各票一律）**：
- `messages.jsonl/reports.jsonl` 字段面＝**R-1 红线**：appendMessage 调用点、from/fromName/fromOrg 原子组、`[任务完成/失败 id]` 报文前缀格式零改动（恢复去重**依赖**该前缀格式，动它=自毁去重键）；
- `state.json`（Web 游标通道）零触；runner-state 键/值形状零改动（claim 兄弟键除外）；
- 灵感分支代码区 `:354-375`、hop 护栏（extractHops/DEFAULT_HOPS）、`MAX_BODY/MAX_OUTPUT/RUN_TIMEOUT_S` 常量值、`:174` ENV 注入行（层B 面）、`:3080` 服务面；
- `lib/team.js`/`lib/client.js`/`README.md`/`package.json`（v0.14 线与 lead 执笔面）；
- 既有 test 四锁版件（mount-selftest 等，锁版纪律）。

**数据面**：runner-state/team/org 三态文件**零迁移**；claim 兄弟键为纯增量、旧版 daemon 读到即忽略（回滚安全：旧代码只认 `isStr` 游标）。

---

## §7 验收 checklist（全部机检锚）

**V15-A**
- A1 双实例：假组织双 daemon 同节点并起 → 后起者 exit(3) 响亮拒启；绕过守卫强双开 → 同一邮件 `action:'claimed'` 恰一次、stub npx 调用计数恰 1。
- A2 崩溃重抢：stub sleep 中 `kill -9` daemon → 重启 → 该邮件恰一轮重跑（attempt=2）、无旁信被吞。
- A3 回投去重：预植 SELF_ID 名义 `[任务完成 X]` 信 + 盘态 claim{X,pid:死} → 重启 → 游标直接推进、stub npx 零调用、无二次回投（`action:'deduped'` 在册）。
- A4 毒邮件熔断：同 messageId attempt=3 现盘 → 弃+错误回投+队列续行。
- A5 游标语义锁：runner-state 键格式正则锁；游标值恒 `isStr(id)`；claim 键恒 `#claim` 后缀；state.json 全文件 diff=0。
- A6 灵感零改动：`git diff -U0 base..HEAD -- bin/org-role.js` 的 ±行落点不命灵感代码区（按代码区起止符号锚定）；inspire 触发轮盘态无新 claim 键。
- A7 bootstrap 保游标：有持久游标+积压 2 封 → 重启 → 两封按序执行（零吞）；无游标首启 → 尾锚行为不变。
- A8 ENV 注释锚：`grep -c '补 from/fromName（' bin/org-role.js` = 0 且该行含 `fromOrg`。

**V15-B**
- B1 finish 后 timer 灭：MAX_OUTPUT 路径注入短超时 → 超时时刻 stub 断言 timer 回调零触发（kill 零调用）。
- B2 pid 守卫：ENOENT stub 令 spawn 同步失败 → spy 断言从不出现 `process.kill(-undefined)`/`kill(-NaN)`。
- B3 exit 钩子：子代 stub 存活中令 daemon 走非 SIGKILL 异常退出 → 子组整体消亡（pgrep -g 零）。
- B4 取证强化：超时回投含 elapsed/stdout 字节数/silence/tail 四要素；70% 软警行在 reports 可检出；`RUN_TIMEOUT_S` 默认值 900 未变。
- B5 「（组级）」锚仍在：`grep -c '（组级）' bin/org-role.js` ≥ 1。

**V15-C**
- C1 `grep -n 'export const LIMITS' lib/org.js` 命中；`grep -n '64000' lib/index.js` = 0。
- C2 门禁案全绿：G0 自检 + G2 全等锚（注册 schema 自述数值区间 ≡ 域层探针区间）。
- C3 `test/org-mutate-update-gate.test.mjs:112` 注释 ≡ 新值；`npm test` 全绿。

**V15-D**
- D1 `.evidence/ops15/rc-1435-ledger.md` 在册：票窗 3 样本+全日 ≥8 样本全分类；RC-1..4 至少各得「证实/排除/待 V15-B 字段」三态之一。
- D2 RC-3 计时实验数据在档（npx 冷/热中位数）；若有优化建议必附数据。

**通用（每票）**
- G1 `npm test` pass 数棘轮 ≥65 只升不降（R3）；`node test/mount-selftest.mjs` exit 0。
- G2 每 commit=单票面域、实现+测试同 commit、message 含票号与 `[test-sha=]` 钉版；白名单 add、`-A/-a` 禁、整文件独立 commit 禁（终裁A）。
- G3 完成报附名下全部资产 sha256+行数（钉版三纪律）；盘≡HEAD。
- G4 合入后换代自测：6 daemon 空闲换代、游标续跑零重放、roles.json 心跳全数恢复。

---

## §8 时序关系（v0.14 合并波次 × BE-V14-B × OPS-V15）

### 8.1 波次图（§G 定版 + lead 17:29 版门禁）
```
v0.14 线：BE-A1(lib/team.js,在途) → BE-A2(lib/index.js 挂载+/team) ─gate=BE-A 绿→
  BE-V14-B(bin/org-role.js 三触发点 hook + buildTaskText 注入) → FE-V14(client.js/第5 Tab)
  → QA-V14(scripts/verify-team.sh) → REV 终审(node-5) → README+LICENSE+version 0.14.0(lead 执笔)
──────【F1 达成 = README 收尾入库 ∧ REV 绿】──────
OPS-V15：V15-D 根因调查(零代码，即刻可并行启动，不受门禁) ；
  V15-A(bin/test) → V15-B(bin/test) 〔串行〕
  V15-C(lib/test) 〔与 V15-A/B 零文件交集可并行；但其 lib/index.js 面须待 BE-A2/FE/QA 波入库后，防同文件对撞〕
```

### 8.2 BE-V14-B 接口与对撞点裁定
- BE-V14-B 三触发点落点（@本锚推算）：①回投 hook=`appendMessage` 块（`:334-337`）之后、`:342` 之前；②`tickTeam()`=空闲轮心跳（`:376`）邻域；③`buildTaskText`（`:210-231`）注入段。OPS-V15 落点：`:166-195`（V15-B）、`:269-278`/`:305-315`/`:342-343`（V15-A）。**`:340-343` 窗两侧都有落点 → git 文本 hunk 必对撞 → 严格串行是唯一解**（R-T1）。
- BE-V14-B 红线维持：其票内**游标逻辑/claim 面零改动**（OPS-V15 是其入库后唯一有权改认领/游标写形的指定票）；回投 hook 必须 try/catch no-op、失败不得阻断回投与游标推进（否则 V15-A 的恢复/熔断语义会被 hook 异常伪装触发）。
- V15-A/B 实施基线=BE-V14-B 入库后的文件形态：施工按 §5 语义锚重导行号，完成报对**BE-V14-B 入库后的新基线**计算 diff，禁止拿本书单证行号硬套。
- `buildTaskText` 注入段（BE-B 面）与 claim 机制零耦合，无接口。

### 8.3 发布窗口纪律（V15-A 入库前对所有 bin 合入生效，含 BE-V14-B 自己）
bootstrap 尾锚覆盖游标 → 每次合入触发的六 daemon 空闲换代都存在**吞信窗**（游标与尾之间未达邮件被钉死）。V15-A 的 H-A1g 入库前，以运维纪律封窗：**合入时点全员 `unread===0` ∧ 心跳 idle**（roles 回读可机检），或合入前人工尾水位快照、起代后逐节点对账补投。此条建议 lead 直接追加为 **BE-V14-B 验收增补项**（不改其设计面）。

---

## §9 bin/org-role.js 冻结解除条件（合取式，缺一不放）

- **F1**：v0.14 合并线关账——BE-A1/A2 绿 + **BE-V14-B 入库且其换代自测过** + FE-V14 + QA-V14 + REV 终审绿 + README/version 0.14.0（含 R-LIC LICENSE）入库。即 lead 17:29 版口径「README 收尾入库 ∧ REV 通过」。
- **F2**：本仲裁书 lead 入册定版（docs/，sha 钉版；条款有异议先回我裁定后改书，不得边施工边改设计）。
- **F3**：lead 正式 org_delegate 签发实施票（收件人 node-2），票面直引本书 §5 子票边界 + §6 + §7；**本票（设计票）不解锁任何施工**。
- **F4**：开工时点盘态 gate：porcelain 空 @派票时重钉的 HEAD；`bin/org-role.js` 无其他在途票/无第四方改动（串行纪律）。
- **F5**（把关，非解锁条件）：每票 node-5 hunk 级评审，R3 零评审继承禁入。

冻结语义精确化：冻结=「除 v0.14 波指定件外无人可触」；**BE-V14-B 不受本冻结约束**（属 v0.14 线合法触达），OPS-V15 全部子票受 F1-F4 约束。

---

## §10 非功能性风险登记（正确性 > 可维护性 > 性能）

1. **并发（残余·登记不修）**：runner-state.json 多 daemon 全文件 RMW 竞态——写路径全同步，竞态窗=OS 级抢占微秒窗，现状游标写每任务 1 次、V15-A 增至 3 次，**同量级、暴露点 ×3**；修复面（per-node 分文件或 O_EXCL 锁）牵动 README 文件表与导入面，本波不扩，ARCH-DEBT 挂 v0.15。
2. **并发**：单实例守卫的 PID 复用误判（复用 pid 判活=假活）→ TTL=RUN_TIMEOUT_S+120s 兜底强制过期；单机单用户场景接受残余。
3. **正确性边界**：消息 id 存在 string/number 两型（`:305` 兼容读取）——claim.messageId 存取恒用原值 `===` 比较，恢复去重正则注意 id 字符集（Date.now-base36+随机段，regex-safe，仍须转义防呆）；`claim.messageId ≠ fresh[0].id` 异常态按陈旧 GC。
4. **正确性（at-least-once 残差）**：900s 窗崩溃后重跑=任务副作用重复，daemon 侧不可根除（headless 非幂等）；本设计收敛至「有界（CAP=2）+ 已答必去重 + 全程 report 留痕」，README 已知限制段如实标注（lead 执笔时录入）。
5. **安全**：超时取证新增 stdout 尾 ≤1000 字进入错误回投——暴露面与现行 stderr 尾 800 字同类（收件人=发件人，组织内通道），无新增外泄面；灵感/注入面零改动；零新端口、:3080 零触。
6. **性能**：每任务 +2 次同步小 JSON 写（µs 级）；恢复去重复用已加载 inbox 数组零额外 IO；取证仪表为常数开销。不构成风险。
7. **毒邮件/队列活性**：熔断 CAP=2 + 响亮弃单，杜绝「崩溃型邮件永久卡死一个成员」；配合 A4 案强制验证。

---

## §11 不在本书裁定范围

BE-V14-B 内部实现细节（契约 §C/§D 已冻结，其 hook 顺序/失败面按其票面）；S1 v3（golden 绊线，待自然变更窗口）；ARCH-DEBT-01 切分（v0.15）；§E 进阶路线（NO-GO 定案）；mtmvvm83-n13k 三项处置（lead mtn2w9sc-pj1z 已终裁，本书不复议）。

——架构师 node。本件=交付物本体，非派活不占 hop；请 lead 入册定版（F2）后按 §9 门禁签发实施票。
