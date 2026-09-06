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
- v0.15 同票评估半行（node-5 建议、lead 受账 [mtnmtyg0-8vfd 答复件]，2026-09-06）：开票 DEBT-02 时同票评估 tmpNameFor 命名 `.<prefix>.<pid>.<ts(ms)>.tmp` 增加随机/path 分量后缀——同目录+同毫秒+同 pid 现同名，全同步管线无实害（在票面/函面记录，非现势执法）；命名形态被 Checklist-v2 §B-3③ 复核锚与 golden（org.test.js @c3af1d1，sha256=6923abd7…）双锁，扩后缀=形态改动涉 R3，届期须架构师重裁后方可动形，v0.15 开票时不得径改命名式。
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

### ARCH-DEBT-05｜lib/team.js org_team_plan objective trim 空值覆盖＝洗空既有 objective（ADJ-5.1 裁 C 修复面延后）
- 来源：ARCH-ADJ-5 终裁相邻发现 ADD-5.1（架构师 2/2 件 mtnmyqqi-jqgl，sha256(content)=89d63fab5cefd062a5bca67a808f58ecfa080dc096ad6f7849dbdfc901204e09，§二；契约执法面=ARCH-V14-CONTRACT §G 尾部入册 No.7/lead 落档注记 [mtnmy0ej-s7t0]）。
- 内容：现盘 `objective` 仅在 :179-182 拦超长、:242 提供即覆盖 ⇒ `objective:"   "`（trim 后空串）系合法覆盖值，可把既有 objective 洗空；:243 仅拦首次立项空值——不变式「objective 非空」可中途摧毁（派发信正文/daemon 注入段随读随空）。架构师终裁＝**裁 C**：最小改动面=入参段一行校验 `objective 提供但 trim 后为空 → OrgError 默认码（形状过错族）`，排期权归 lead。
- lead 排期裁定（2026-09-06 [mtnmy0ej-s7t0]）：v0.14 **不开改动面（B 轨）**——本波已在 QA-V14 正式票执行/收尾窗，n=17 矩阵字面与运行时棘轮链刚冻结开焊，入参面行为变更会移动盘实况靶、违波次最小改动纪律；缺口可利用面窄（须显式提交纯空白 objective）、损害可逆（再 plan 非空 objective 即复原）、无红线暴露。过渡口径=按盘上实况「空值覆盖合法」钉 G11 族第三夹具靶（QA-V14 已按此执法）。
- 状态：已登记（2026-09-06 [mtnmy0ej-s7t0]），待 v0.15 排期（修复面≈1 行＋新金样；开票选型届时随本册 §并案建议统一裁量，编号如有异议按勘误收口）。

## 关联在册挂账（非本台账编号，避免二次编号冲突）

- **OPS-V15 仲裁书 §10-①**：runner-state.json 多 daemon 全文件 RMW 竞态（写路径全同步、竞态窗=OS 级抢占微秒窗；V15-A 使暴露点 ×3）——修复面（per-node 分文件或 O_EXCL 锁）牵动 README 文件表与导入面，本波不扩，ARCH-DEBT 挂 v0.15。
- **§E 探针集（G1–G5 判据 + be14-probe 类脚本）**：v0.15+ 调研 backlog（进阶路线 NO-GO 定案转册，重评审门槛=dsh 平台跨进程单写者协议＋sessionDir 登记面）。
- **ADJ-V14B-NESTED（架构师终裁，2026-09-05 [mto95lu8-bcqp]）｜org_mutate 嵌套对象未知键静默丢弃残域＝实体成立·采门落地（非仅登记）**：测试工程师残域分析（任务 mto3082w-bviy 因 TRANSPORT 中断，判定有效由本裁接收）实证两点均复核属实——①sanitizeModel（lib/org.js:261-278）只提取三键、不校验 `Object.keys(raw)⊆{provider,model,fallback}`，`model:{provder:'x'}` 拼错静默产 `{}`=宿主默认且返回成功（BUG-V14B-1 同款病深一层）；②**同形兄弟面 toolScope（org.js:326/358-363）更敏感**：scopeList 只取 .allow/.deny，`toolScope:{alow:[...]}` 静默产 `{allow:[],deny:[]}`＝**受限意图被静默放开为不限工具面（安全敏感，不可仅台账承载）**。声明-执法错位：schema 对两嵌套对象均申报 additionalProperties:false（index.js:827/828），但装载层申报不执法（index.js:895 注释实锤＋e1db937 _meta 实证），BUG-V14B-4 工具面门（index.js:907-912）仅覆顶层 args 键——嵌套层申报=空头承诺。**终裁＝域层单点补门**：org.js 增 MODEL_KEYS/SCOPE_KEYS 两白名单，非子集整单 OrgError 点名（文案风格对齐 BUG-V14B-2/4），throw 先于 saveOrg；add/update/addOrg 三面同函数收口。**门位裁定=域层非工具面**（域层=全面必经；工具面 E8 门位反证锁+E10 关系锁 knownKeys≡schema properties 单层语义不许动，嵌套遍历必摇两锁）。驳「仅登记不修」案（顶层严嵌套疏=BUG-V14B-1/2/4 三裁「响亮拒」哲学不一致收尾，且 toolScope 静默放开为安全暴露）；驳「泛化 schema 遍历器」案（org_mutate 仅两个嵌套对象，两白名单≈6行；泛化门须另处 _meta 注入面与未来漂移，投机抽象违反可维护性序，二次泛化候实证另票）。金锚影响=零翻转（bugv14b-model-shape 六案零「嵌套未知键=成功」断言；UPDATE_PATCH_KEYS 锚/A4 冻结钉/E8·E10 锁零涉）；与 ADJ-V14B-MODEL 互补不冲突（彼裁=外层形状 string vs object，本裁=内层未知键；且本修零 schema 改动，node-5「schema 零改动」边界原样成立）；ADJ-V14B-MODEL 候证重开门槛（string 旧调用方在盘）与本裁无关。**验收要点（供 lead 开票，建议 BUG-V14B-5 单票：org.js +6~10 行＋新金样 4-6 案）**：A1 嵌套未知键三面（add/update/addOrg）点名必抛＋盘级零写入（throw-before-write 同形）；A2 混合形态 {provider:'x',typo:'y'} 整单拒·合法键不部分生效（6baecd0 update-gate 同形）；A3 toolScope 非 allow/deny 键点名必抛·工具面不得静默放开；A4 等旧四形态与正路径逐字段修剪零回归；A5 新金样与 bugv14b-model-shape/bugv14b-update-gate/QA-GATE1 共跑全绿·棘轮只增。**S2 顺带终裁（REV-PATCHDROP1-CLOSE 挂账「泛化机械票 vs 台账登记票面」）**：采台账登记——org_send 等非 mutate 工具面 typo 键静默忽略属轻度同形（无授权/行为变更暴露），不开泛化机制票，v0.15 随 DEBT 并案（本册 §并案建议）统一选型；例外升格条款：任一工具面键静默丢弃产生授权扩大或行为变更（toolScope 即先例），即时单票不等排期。
- **ADJ-V14B-MODEL（架构师终裁，2026-09-05 [mto90y8w-aqtv]）｜org_mutate model 契约面终态＝B 案·系追认非新建**：插件 schema=object{provider?,model?,fallback?}+null（lib/index.js:827）自 **648cad8（BE-V14B-1）起即法**，HEAD 承载、宿主装载面同形（e1db937 已证 _meta 属装载层）、Web patchOf 三键同构、教学面（README/guide）零 string 残留，五面一致。**A 案（schema 回 string＋工具面归一化）驳回**：其前题「现势 schema=string」不成立（仅 6a6e8ae..648cad8 窗口瞬时态），采 A＝回退 648cad8 + 翻转双金锚（bugv14b-model-shape 案1 schema 申报案 ∧ 案3 工具边界 string 必抛+零落盘，实测 6/6 绿@f06d9d6）。**S1 字符串归一化（typeof string→{model:s}）不落地**：落 org_mutate 工具面必与案3 金锚硬撞（归一后 string 经 {model:s} 成功落盘=案3 必红），且语义上以无权威规则的字符串切分猜测替代响亮显式拒绝，与 BUG-V14B-1/2/3/4 全线「响亮拒」哲学相悖；静默清空病已由 sanitizeModel fail-fast 更严格治愈，归一化无剩余缺陷可修。**候证重开门槛**：工具面真实旧调用方在盘证据（调用日志/语料实证仍发 string）出现，方可另票复议 {model:s} 兼容；node-5 v14b-fix2-rev「schema 零改动」边界**不顺延、原样成立**（B 终态零 schema 增量；V14B-FIX2 剩余票面剔除归一化段后本无 schema 面诉求）。

**并案建议（供 v0.15 排期时 lead 裁量，非现势裁定）**：DEBT-02＋DEBT-03＋OPS §10-① 三件同属「daemon 态/游标文件写面收口」，开票时宜并为一票（统一走 org.js 泛化原子原语＋单写者仲裁选型），一次动 bin/org-role.js 与 lib/index.js 两文件域。

## 记账规则

- 新债入册须经架构师终裁或 lead 终裁，编号连续追加不复用；状态列：已登记 → 已开票（附票 id）→ 已入库（附 commit）。
- 本台账改动走独立 docs commit（不入波次 diff 面），message 带任务 id。

——lead（负责人）2026-09-05 建账 [mtn1no5k-je02]
