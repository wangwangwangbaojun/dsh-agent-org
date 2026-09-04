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

## 关联在册挂账（非本台账编号，避免二次编号冲突）

- **OPS-V15 仲裁书 §10-①**：runner-state.json 多 daemon 全文件 RMW 竞态（写路径全同步、竞态窗=OS 级抢占微秒窗；V15-A 使暴露点 ×3）——修复面（per-node 分文件或 O_EXCL 锁）牵动 README 文件表与导入面，本波不扩，ARCH-DEBT 挂 v0.15。
- **§E 探针集（G1–G5 判据 + be14-probe 类脚本）**：v0.15+ 调研 backlog（进阶路线 NO-GO 定案转册，重评审门槛=dsh 平台跨进程单写者协议＋sessionDir 登记面）。

**并案建议（供 v0.15 排期时 lead 裁量，非现势裁定）**：DEBT-02＋DEBT-03＋OPS §10-① 三件同属「daemon 态/游标文件写面收口」，开票时宜并为一票（统一走 org.js 泛化原子原语＋单写者仲裁选型），一次动 bin/org-role.js 与 lib/index.js 两文件域。

## 记账规则

- 新债入册须经架构师终裁或 lead 终裁，编号连续追加不复用；状态列：已登记 → 已开票（附票 id）→ 已入库（附 commit）。
- 本台账改动走独立 docs commit（不入波次 diff 面），message 带任务 id。

——lead（负责人）2026-09-05 建账 [mtn1no5k-je02]
