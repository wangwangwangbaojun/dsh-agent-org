# ARCH-DEBT v0.15 技术债台账 v1

> 性质：技术债登记台账（lead 名下建账，任务 [mtn1no5k-je02]；编号权威=架构师终裁 mtn7g3wq-sdnz，2026-09-04T17:05Z）。
> 裁定基线：三债并册随 ARCH-V14-CONTRACT §G 尾部「不切」裁定（ADD-2 + ARCH-ADJ-2 D2），**v0.14 不开新票**；排期权在 lead。

## 编号债票

### ARCH-DEBT-01｜client.js / lib/index.js 切分 + 三套实现归一
- 来源：§G 尾部增量入册 No.1 ADD-2（非红线，归 v0.15）。
- v0.14 期软约束（现行有效）：新增纯函数逻辑全落 lib/team.js；client.js 只收 FE tab 渲染增量；**切分与功能票混做=blocker**。
- 状态：已登记（2026-09-04），待 v0.15 排期。

### ARCH-DEBT-02｜bin/org-role.js atomicWriteJson（:117-121 @2f30d58 位）归一至 lib/org.js 泛化原语
- 来源：ARCH-ADJ-2 D2（Q2 裁定：窄口径豁免成立，**不构成第四套**——红线绑定对象=org.json/team.json 配置文档写者，该件仅写 daemon 态）。
- 护栏（v0.14 波次内即执法，非 v0.15 才开始）：GQ2-1（blocker）豁免仅绑定现有调用面——org-role.js 新增任何 tmp+rename 实现体、或写面扩至 org.json/team.json，豁免作废即 blocker；GQ2-2 归一后 lib/ 之外任何第二实现体一律 blocker。
- 状态：已登记（架构师债册确认），待 v0.15 排期。

### ARCH-DEBT-03｜lib/index.js saveCursor 裸 writeFileSync 非原子写（S3）
- 来源：node-5 盘上复核观察（mtn1no5k-je02 函②，票面 :160）；架构师复验属实并入债册；lead 落档时点复测 @1e6319a 现盘位=lib/index.js:162（saveCursor→writeFileSync(statePath(),…)），行号漂移属正常，锚以 commit 为准。
- 定性：S3——cursor 丢失可重扫自恢复，无正确性红线暴露。
- 评审「建议并票」的处置答复：架构师终裁采**独立编号 DEBT-03**（未并入 DEBT-02）；并票意图在 v0.15 开票边界保留——见下「并案建议」。
- 状态：已登记（2026-09-04 债册），待 v0.15 排期。

### ARCH-DEBT-04｜lib/client.js lastBeat 阈值两式三处 + v0.14 beatAlive 归一为单一共享模块
- 来源：ARCH-ADJ-3 D1-2（架构师 mtn77xm9-gnlf 16:59Z，原文借用「ARCH-DEBT-02」编号，与本册在账 DEBT-02〔org-role 原语归一〕撞号，按记账规则「编号连续追加不复用」lead 改号登记为 DEBT-04，内容零损；契约执法面=ARCH-V14-CONTRACT §F 尾部入册 No.3/D1）。
- 内容：L1039/L1290=`max(60000,(intervalS??20)×4000)` 与 L1094=`max(90000,(intervalS??20)×5000)` 两式并存 + v0.14 新增团队 Tab beatAlive；v0.15 归一为单一共享函数并裁定 60s/×4 vs 90s/×5 语义分歧去留（typing 气泡语义是否保留独立常数为届时开放题）。
- v0.14 期现行纪律（非本债、随 ADJ-3 D1 生效）：三调用点零触碰；beatAlive 逐字= D1-1 规格，REV 锚=函数体与规格逐字符 diff 空。
- 状态：已登记（2026-09-05 [mtn1v1cq-3h6q]），待 v0.15 排期。

## 关联在册挂账（非本台账编号，避免二次编号冲突）

- **OPS-V15 仲裁书 §10-①**：runner-state.json 多 daemon 全文件 RMW 竞态（写路径全同步、竞态窗=OS 级抢占微秒窗；V15-A 使暴露点 ×3）——修复面（per-node 分文件或 O_EXCL 锁）牵动 README 文件表与导入面，本波不扩，ARCH-DEBT 挂 v0.15。
- **§E 探针集（G1–G5 判据 + be14-probe 类脚本）**：v0.15+ 调研 backlog（进阶路线 NO-GO 定案转册，重评审门槛=dsh 平台跨进程单写者协议＋sessionDir 登记面）。
- **ADJ-V14B-MODEL（架构师终裁，2026-09-05 [mto90y8w-aqtv]）｜org_mutate model 契约面终态＝B 案·系追认非新建**：插件 schema=object{provider?,model?,fallback?}+null（lib/index.js:827）自 **648cad8（BE-V14B-1）起即法**，HEAD 承载、宿主装载面同形（e1db937 已证 _meta 属装载层）、Web patchOf 三键同构、教学面（README/guide）零 string 残留，五面一致。**A 案（schema 回 string＋工具面归一化）驳回**：其前题「现势 schema=string」不成立（仅 6a6e8ae..648cad8 窗口瞬时态），采 A＝回退 648cad8 + 翻转双金锚（bugv14b-model-shape 案1 schema 申报案 ∧ 案3 工具边界 string 必抛+零落盘，实测 6/6 绿@f06d9d6）。**S1 字符串归一化（typeof string→{model:s}）不落地**：落 org_mutate 工具面必与案3 金锚硬撞（归一后 string 经 {model:s} 成功落盘=案3 必红），且语义上以无权威规则的字符串切分猜测替代响亮显式拒绝，与 BUG-V14B-1/2/3/4 全线「响亮拒」哲学相悖；静默清空病已由 sanitizeModel fail-fast 更严格治愈，归一化无剩余缺陷可修。**候证重开门槛**：工具面真实旧调用方在盘证据（调用日志/语料实证仍发 string）出现，方可另票复议 {model:s} 兼容；node-5 v14b-fix2-rev「schema 零改动」边界**不顺延、原样成立**（B 终态零 schema 增量；V14B-FIX2 剩余票面剔除归一化段后本无 schema 面诉求）。

**并案建议（供 v0.15 排期时 lead 裁量，非现势裁定）**：DEBT-02＋DEBT-03＋OPS §10-① 三件同属「daemon 态/游标文件写面收口」，开票时宜并为一票（统一走 org.js 泛化原子原语＋单写者仲裁选型），一次动 bin/org-role.js 与 lib/index.js 两文件域。

## 记账规则

- 新债入册须经架构师终裁或 lead 终裁，编号连续追加不复用；状态列：已登记 → 已开票（附票 id）→ 已入库（附 commit）。
- 本台账改动走独立 docs commit（不入波次 diff 面），message 带任务 id。

——lead（负责人）2026-09-05 建账 [mtn1no5k-je02]
