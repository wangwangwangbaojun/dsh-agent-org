# REV-V14 终审 Checklist · 定版 v2（并入 ARCH-ADJ-2 修订白名单）

> 评审侧文件（node-5 代码评审），非波次 diff、不入任何波次 commit。
> 证据三点套（定版时点）：核查 2026-09-04T19:20Z ± ｜HEAD=bf762afffaa49de78ae18660dfc3349ba889f64b｜本文件 sha256 以入库/回投时点 blob 复算为准。
> **v2.1 勘误注记**（2026-09-05T01:21Z｜复算 HEAD=609885582378955817afee91c692973c9eb85902，porcelain 0）：依仲裁函 mtndupyc-vix0（ADJ-4.1/ADJ-4.2 勘误裁定；定性=账面已结、无需回滚任何已发评审结论）就 **B-4①/B-4④** 两处以校正读法就地注记，执法面既生效文本不因注记号改变（勘误仅消字面自相矛盾之假 blocker）；R-ADJ2-CLOSE（§G No.5 件）口径防混淆注随 B-4④ 随册。§G 尾部 ARCH-ADJ-2/ADJ-4.1/ADJ-4.2 入册随 lead 统一操作，非本件义务。
> **v2.2 预裁入位注记**（2026-09-05｜函 mtng97v8-7fsa，lead→node-5，定性=台账前置入位、非派活）：FE-V14-1 评审票面**不得**以「既有 lastBeat 调用点一并收敛」为合入前置或开 blocker；调用点收敛如需做=另立行为等价机械票排后置波次（排期权归 lead；在账承载=**ARCH-DEBT-04** @docs/ARCH-DEBT-V15-v1.md:24，v0.15）。D1 口径复核一致：beatAlive() 模块级、函数体逐字=ARCH-ADJ-3 D1-1 规格、仅供团队 Tab；本评审验收锚照旧=**函数体与规格逐字符 diff 空＋钉点注释在 diff 内**（D1-1 规格与「与 lead 预裁 mtng97v8-7fsa 一致」互引句均已在契约册 :116 blob 谱系在树，@3b473c1 亲验）。「勿再发明」=阈值**语义**唯一、从来非调用点唯一（契约册 D1 原文），与 B-6 在役面零触碰（其余四 Tab 零改动）无交叠歧义——双向同钉：三内联对 FE 波 diff 零行是执法项，「未收敛」不是失分项。现盘对账 @3b473c1：lib/client.js lastBeat 三内联在位 L1039/L1094/L1290（对 @2f30d58 锚零漂移）、`beatAlive` 于 client.js 0 命中（FE-V14-1 未开工，候 BE-V14-B，符合排程）。架构师异议走增量裁定，lead 持最终决策权（函内自明，本注记照录不代裁）。
> 本件**取代** REV-V14-Prep 中间版 1/3–3/3 中「lib/org.js、LICENSE、test/** = blocker 待裁定」全部预留条款；其余条目继续有效并并入本件。
> 依据文档：docs/ARCH-V14-CONTRACT.md @f81ab6b（blob cb396c9f）含 §G@bc968c5 + ARCH-ADJ-1 增量在册；ARCH-ADJ-2（本定版源件，node→node-5，§G 尾部入册随 lead）；ARCH-ADJ-3（Q1/Q4/Q5 邮件终裁，f4d4b47 message 在案）；lead 口径终裁 mtmwh4l3-uhbh；ARCH-ADJ-R1 断言纪律 G1–G4；G-ATTR-1/2；《验收证据规范》三点套 + 行号钉 commit 惯例；lead 预裁 mtng97v8-7fsa（FE-V14-1 合入前置负面裁定，v2.2 入位）。
> 通用纪律：一切行号引用附 commit 锚（@<sha>）；一切对账用 **blob 谱系**（`git show <commit>:<path> | sha256sum`），盘 sha 只作同时点证据不作后续锚。

---

## 0. 撤预留声明（ARCH-ADJ-2 生效件）

自收讫 ARCH-ADJ-2 起，撤销以下三项 blocker 预留，改为「白名单增量 + 锚条件」执法：
- **lib/org.js**：撤销「§G 改动文件全集外＝越界 blocker」预留 → 按 §B-3/§B-4（ADJ-2.1 四条范围锚）执法；
- **LICENSE**：撤销「末波前不存在即越界/缺件记越界」双重误判 → 末波票专属白名单；BE/FE 波评审**不再**按越界 diff 记，缺失本身仍归 R2 发布面 blocker（§C）；
- **test/**\***：撤销「test/ 新文件=越界」预留 → 非对称规则执法（§B-10）。

## A. 改动文件白名单（修订合并表，逐波适用；diff 越界=blocker）

| 文件 | 波次归属 | 条件 |
|---|---|---|
| lib/team.js | BE-A | §G 原槽 |
| lib/index.js | BE-A | §G 原槽（+4 工具、+/team 路由、routeMounted 1→2）|
| bin/org-role.js | BE-B | §G 原槽（三处 hook+注入；灵感分支与游标逻辑零改动）|
| lib/client.js | FE | §G 原槽（第 5 Tab）|
| test/mount-selftest.mjs | BE-A | §G 原槽（14 工具/2 路由/`/team` 冒烟）|
| package.json | BE-A(描述) + 末波(version) | §G 原槽 |
| README.md | 末波 | §G 原槽 |
| scripts/verify-team.sh | QA-V14 | §G 原槽（QA 名下；端到端冒烟/发布面检查，非边界清单唯一承载，ADJ-2.3④）|
| **lib/org.js** | **BE-A 专属** | **ADJ-2.1 增量**，限 §B-3+§B-4 锚内 |
| **LICENSE**（新） | **末波专属** | **ADJ-2.2 增量**，R2 前置未满足则末波票不开 |
| **test/\*\***（新文件） | 任意在册票 | **ADJ-2.3 增量**，非对称规则 §B-10 |

docs/ 下评审/QA/台账文档属评审侧留痕，不入波次 commit、不计波次 diff 面（循 OPS-V15/ARCH 入册先例）。

## B. 硬红线（每条给可执行核验动作；违者=blocker）

**B-1 邮件 schema 字段面零增删**：appendMessage 九字段不变；`[team:]` 只允许存在于邮件**正文文本**，禁入任何协议字段。
`git show HEAD:lib/team.js | grep -nE 'appendMessage|msg\.\w+' ` 字段面与契约 §F 逐字段对；生产 messages.jsonl 只读抽检（G4 纪律：三点套+当时态标注）。

**B-2 ADD-1 双 0 锚（红线）**：v0.14 diff（基线 23f620f..终态）新增行内 `renameSync` = 0 命中；lib/team.js 代码面 renameSync=0 且无 (writeFileSync+tmp+rename) 组合模式——唯一 sanctioned 写路径 = import lib/org.js 泛化原语（atomicWrite/saveOrg）。team.lock 的 `writeFileSync(..., {flag:'wx'})` 是锁获取语义，不属第二原子写对（ADJ-1 在册：team.lock 已覆盖 lost-update）。
复核：`git diff 23f620f..HEAD -- lib/team.js lib/index.js | grep -E '^\+.*renameSync'` → 须 0 命中。
**预验 PASS @f4d4b47**（HEAD:lib/team.js 仅 :7 注释提及；:11 import atomicWrite；:104 `{tmpPrefix:'team'}` 命中前缀白名单）。

**B-3 tmpPrefix 安全面（ADJ-2.1③ 新增·硬红线，本 checklist 定版新增加项）**：
- ①字符集白名单 `/^[a-z0-9-]{1,16}$/` 逐字在位（禁 `'/'`、`'..'`、`'.'` 路径逃逸——正则下三者结构性不可表达）；
- ②非法前缀 = **写前 throw**：校验必须发生在任何 fs 副作用之前；
- ③tmp 同目录恒等式：`dirname(tmp) ≡ dirname(target)`（rename 原子性=同文件系统前提；跨 fs rename 即失败=正确性红线）。复核锚：tmp 命名式必须为 `join(dirname(path), '.<prefix>.<pid>.<ts>.tmp')`，出现任何可注入目录段的拼接变体=blocker；
- ④缺省行为字节级等旧：缺省 tmpPrefix='org' → `.org.<pid>.<ts>.tmp` 逐字节等（golden 锁：tmpNameFor 输出格式断言，test/** 承载）。
**预验 PASS @f0f40ed（已入库）**：org.js:565 TMP_PREFIX_RE 逐字一致；:568-570 tmpNameFor 纯函数先校验后返回（无 fs 前置副作用）；:572 join(dirname(path),…)；saveOrg(path,doc,opts={}) 缺省路径零偏差。终审时对最终树复跑本组四判据。

**B-4 ADJ-2.1 范围锚四条（lib/org.js 专属）**：
- ①改动面 = saveOrg 签名 + 其 tmp 行区域（锚 `git show 2f30d58:lib/org.js` @558-564，已实测在位）；仅允许新增可选第三参 opts.tmpPrefix；
  **ADJ-4.2 勘误注记（v2.1，函 mtndupyc-vix0）**：字面「仅允许新增 opts.tmpPrefix」会把 ADD-1 红线自身的落点——泛化原语导出——判为锚外，与 P4 预验 PASS 自相矛盾。校正后许可面 = **saveOrg 签名 + 其 tmp 行区域 + 同一 hunk 内新增 atomicWrite/tmpNameFor/TMP_PREFIX_RE 导出**；其余锚不变（B-4② 调用点零 diff、B-4④ 其余区域 '-' 行=0、B-3④ 缺省字节等旧），终审对最终树按校正后锚执法。评审侧复算 @6098855：lib/org.js `:589 export const TMP_PREFIX_RE` / `:592 export function tmpNameFor` / `:599 export function atomicWrite` / `:611 export function saveOrg(path, doc, opts = {})`——相对函内快照 581/584/591/603 整体 +8 行号漂移，漂移源=在册票 7864536 于 org.js 前段另增 update 零键门（+26/-2），非白名单违例；符号锚稳定，行号锚终审按最终树复钉。
- ②既有 5 调用点 lib/index.js:530/552/616/727/765（锚 @2f30d58，已实测逐一吻合、均位置参）对波次 diff 零行——复核：`git diff 2f30d58..HEAD -- lib/index.js | grep -E '^[+-].*saveOrg\('` → **0 命中（预验 PASS @bf762af）**；
- ③见 B-3；
- ④org.js 其余区域（validate/prepareDoc/mutate/loadOrg/backupOrg）'-' 行数=0（预验 PASS @f0f40ed：单 hunk @@-555,12+555,38@@，5 枚 '-' 行全在 saveOrg 函数体；backupOrg 显式不在范围）+ test/org.test.js 零 diff（**ADJ-4.1 勘误读法，见下注**：作「基线 13 枚声明（@2f30d58）零删除、零放宽」解）+ npm test 全绿。
  test/org.test.js 计数口径**勘正**：@2f30d58 实测 = 13 枚 test 声明（12 顶层 + 1 循环内生成 :17；**无** `t.test(`；ARCH-ADJ-2 信内「12 顶层+1 嵌套 t.test」分解口径系笔误，总数 13 不变、与本评审原 13 条吻合）。复算配方：`git show <tree>:test/org.test.js | grep -cE '^\s*(test|await t\.test)\('`。
  **ADJ-4.1 勘误注记（v2.1，函 mtndupyc-vix0）**：B-4④「零 diff」字面执行与 B-10①/B-3④ 自相矛盾——c3af1d1 已向 org.test.js 新增 6 枚 golden（恰为 B-3④ tmpNameFor 格式锁之承载），字面零 diff 将 blocker 掉已入库且预验 PASS 的波次。裁定读法=**基线 13 枚声明（锚 @2f30d58）零删除、零放宽**；新增用例按 B-10① 非对称规则执法。增补复算配方=计数配方 **≥13**，且 `git diff <base>..<head> -- test/org.test.js` 之 '-' 行仅允许非断言行（import/头注）。评审侧亲算 @6098855（porcelain 0）：2f30d58=13 → HEAD=19（+6=c3af1d1 [BE-V14-A/mtn0evg2-24fc] golden）；2f30d58..6098855 '-' 行恰 2 枚=2 行 import 扩充（node:fs 头行 + lib/org.js 头行），基线 13 声明零触碰 → **合规，c3af1d1 该项不记红**；顺带复算 B-4② `git diff 2f30d58..6098855 -- lib/index.js | grep -E '^[+-].*saveOrg\('` = 0 命中 ✓。
  **口径防混淆注（R-ADJ2-CLOSE §一.2 随册）**：org.test.js **静态口径 13**（@2f30d58；=12 顶层+1 循环内 :17，该循环运行时展开 7 用例）≠ **npm test 运行时计数贡献 19**——B-4④ 静态配方与 B-9 棘轮运行时计数系两个口径，后世读者**禁互引**。

**B-5 v0.13 等价红线**：team.json 缺失 = 所有新 hook try/catch no-op = 全路径字节级等 v0.13、零写盘。复核=隔离盘冒烟（假 org 无 team.json → /team 200 空态、目录零新文件）。

**B-6 在役面零触碰**：/feed、/org、/chart、/sessions 行为不变（只增不改）；org_mutate/自我更新/灵感引擎/导出导入零改动。复核=路由 diff 定位 + mount-selftest 装载路径断言 + 相关 gate 测试（org-import-gate/org-mutate-update-gate）全绿。
lead 口径终裁（mtmwh4l3）入案：op=update 空 patch = 不抛错、「已更新节点 X」+ 磁盘 deepEqual 零变化（裁定③定版）；终审**勿按**旧备案②（lib throw）开红。
FE-V14-1 对位注（mtng97v8-7fsa 预裁，v2.2 随册）：本条「其余四 Tab 零改动」与三内联调用点（L1039/L1094/L1290@2f30d58）对 FE 波 diff 零行，是同一执法项的正反两面——FE 波若改三内联即触本条红；**反向护栏**：FE-V14-1 票面不得以「lastBeat 调用点未一并收敛」作合入前置（收敛承载=ARCH-DEBT-04 或另立机械票，见册首 v2.2 注记）。

**B-7 现网零触达**：不触 :3080、零写 ~/.dsh/agent-org（涉审票自证 org.json/messages/reports/roles 等四文件 sha256 前后一致）；重启验证归外部。

**B-8 合并顺序 + 绿先于盘（换代风暴红线）**：波次 BE-A→BE-B→FE→QA-V14→REV→末波(README+version 0.14.0+LICENSE)。每波 **npm test 绿必须先于 commit**，且核验「测试时点 vs commit 时点」tree 一致性（复算=git archive <commit> 纯净树亲跑）。bin/lib 指纹一变 daemon 即自我换代——测试不过禁落盘。

**B-9 R3 验收基线 + 计数棘轮（只升不降）**：git archive 纯净树 + HOME 隔离 + `node --test` 全绿；计数链在册：29（R3 起点）→52→57→65（@f4d4b47 及 QA 归档树实测）→**68（@bf762af，本评审 2026-09-04T19:1xZ git archive HEAD 亲测 pass 68/fail 0；差值 +3 = qa14-attribution-discipline 3 用例，棘轮方向合规，非口径漂移）**。每波完成报须带三点套（核查 UTC 时点 + HEAD 全哈希 + 复算配方），终审以**最终树**复算为唯一权威，账面数字断言无时点者不收。

**B-10 test/** 非对称规则（ADJ-2.3）+ 强制承载条款**：
- ①新增文件=允许；删改既有条目（断言数下降或判定放宽）=blocker；加严=允许（棘轮方向）。复算=上表计数配方 + `git diff <base>..<head> -- test/` 逐 hunk 目检红项；
- ②环境纪律随 R3：HOME 隔离、/tmp 一次性 org/team fixture，不触真实 org.json 与 ~/.dsh、不触 :3080（G1）；门禁测试须在任意机器可复现（G4：禁读生产可变集）；
- ③**强制承载（node --test，shell 仅可加不可代）**：a) claim 崩溃恢复——手工造 `running + dispatchMessageId=null` 盘态 → 反查 `[team:{id}]` 回填不重发；b) 双 daemon（/tmp 假 org 两节点）并发 tick 同 team → `[team:]` 邮件**恰 1 封**。
  **⚠️ 本评审实测：两承载项现树缺位**（@bf762af `grep -rE 'dispatchMessageId|\[team:' test/` = 0 命中；BE-V14-A 的 20 组 /tmp 自证系 ad-hoc 脚本，不入 npm test 即对棘轮与净树复算不可见）。→ **OPEN-GATE①：REV 闸门前必须落 test/team-*.test.mjs 常备承载（BE-V14-B 或 QA-V14 波在册票面），未落=blocker**；
- ④scripts/verify-team.sh 保留 §G 原槽（QA 名下，端到端/发布面），非边界清单唯一承载。
- ⑤§G 边界条件清单 15+ 项（自环/双环三环环路径逐字/未知 dep/未知 owner/同批重复 id/running 改题/pending done/重复 done/半行·坏 JSON·高版本/objective>2000/超时两侧/三态/注入段控制符全角化敌意样本）→ 终审索取「清单项 × 承载测试名」对照表，逐项指认在树测试或 verify-team.sh 槽位；仅 shell 承载而属 ③ 两项者=不合格。
  在途方向观察（非终判）：工作区 M test/org.test.js = +6 test 声明、既有声明零删除零放宽（预验方向=加严，合规），待其票 commit 时按本条终判。

**B-11 归属与提交纪律**：一票一 commit（hunk 级拆分不满足归属检查，ARCH-ADJ-1/lead 在册）；层A/层B 必拆、未归属代码禁混入票内提交；禁 `git commit -a/-A`；起手 porcelain 对账。并发落盘采信（ADOPT-VERBATIM，f0f40ed/f4d4b47 先例）须满足：披露 + 逐行审查声明 + staged diff 全量复核零第三方行——终审抽查其 staged 复算可行性。

**B-12 证据规范（全票适用）**：完成报三点套；钉版一律 blob 谱系核对（盘 sha 过时即弃）；「N/N 全绿」须标 HEAD SHA；sha256 新纪律终审逐字复算；`.gitignore` 等基线文件每一增行 commit message 逐条可考（message-对-hunk 一致性）。

**B-13 归属断言纪律（G-ATTR-1/2 + G1–G4）**：三键=per-write 单次写入不变量（齐⇔缺等价类）；全文件门禁只允许正向蕴含 `fromOrg⇒from∧fromName`；禁「from 必存在」存在性断言、禁历史全文件反向等价门禁（假红模式=blocker）、禁 ts 划界（要划界用换代完成观测点，正解=write-then-read）；report/run/delegate 流分治禁跨流比较；team 流三键恒在+'external' 兜底系第二口径，逐点核「三键同对象字面量共写」，偏离双口径范式=打回。在册常备门禁：test/qa14-attribution-discipline.test.mjs（bf762af）。

## C. 末波票（README + version 0.14.0 + LICENSE）专属门槛（ADJ-2.2 + R2）

1. **前置闸**：版权人由 lead 人工确定；**未定则末波票不开（勿代拟）**——评审见「LICENSE 已落但版权人为 AI 代拟值」=blocker；
2. 文本 = MIT 标准正文 + 版权人行；与 package.json `"license":"MIT"` 一致（现值已核 @bf762af=MIT ✓，LICENSE 现树未落=预期，属末波票未开）；
3. 语义分层：LICENSE 缺失 = **发布面 blocker（R2 管辖）**；BE/FE 波不记越界；
4. version 0.13.0→0.14.0 单点改动；README 增补与 §A–§G 契约口径对账（§A–§G→file:line 对照表随终审产出，缺口标红）。

## D. 终审收尾流程（REV 关卡触发时执行）

1. 最终树三点套 → git archive 纯净树 + HOME 隔离：npm test 全绿 + 计数 ≥ 68@bf762af 链、mount-selftest 18 断言组（14 工具×4 装载路径+2 路由+`/team` 空态）exit 0；
2. 逐波 diff 对照 A 表白名单与 B 表红线（波范围=相邻票 commit 对，锚全哈希）；
3. 逐票完成报 sha256/blob 逐字复算；message-对-hunk 抽查；
4. 强制承载项现场复跑（双 daemon 恰一封 + claim 崩溃恢复），不接受仅账面绿；
5. §G 边界清单承载对照表收讫；
6. 意见分级（blocker/建议）+ 逐条可执行修改方案 → org_send lead，blocker 挂回责任票；
7. org_report 留痕 + 台账（含本 checklist 版本号与偏差勘正）。

## 附录一：预验记录（已消耗白名单项，终审复跑不重验账面）

| # | 项 | 锚 | 实测 | 判定 |
|---|---|---|---|---|
| P1 | ADJ-2.1① saveOrg @558-564 函数体在位 | 2f30d58:lib/org.js | 558 签名/561 tmp/563 rename | ✓ |
| P2 | ADJ-2.1② 5 调用点行号与位置参形态 | 2f30d58:lib/index.js | 530/552/616/727/765 逐一吻合 | ✓ |
| P3 | ADJ-2.1② 波次零 diff | 2f30d58..bf762af lib/index.js | `^[+-].*saveOrg\(`=0 命中 | ✓ |
| P4 | ADJ-2.1④ org.js 其余区域 − 行=0 | f0f40ed | 单 hunk @@-555,12+555,38@@，5 '-' 全在 saveOrg | ✓ |
| P5 | ADJ-2.1④ org.test.js 计数 | 2f30d58 | 13 声明（勘正分解=12 顶层+1 循环内，无 t.test） | ✓（总 13 吻合）|
| P6 | B-3 tmpPrefix 安全面 | f0f40ed/HEAD:lib/org.js | 正则逐字/纯函数先校验/join 同目录/缺省字节等 | ✓ |
| P7 | ADD-1 双 0 锚 | HEAD:lib/team.js | renameSync=0；wx 锁非常规写对；tmpPrefix 'team' 合法 | ✓ |
| P8 | 时序注记：team.js 裁定生效时缺席 | 2f30d58 | 「在磁盘上，但不在 commit 中」 | ✓ |
| P9 | R3 棘轮复算 | bf762af archive 树 | npm test 68/68 fail0；selftest 18/18 | ✓（65→68 归因 qa14+3）|

## 附录二：OPEN-GATE 清单（REV 关卡前必须关，逐条挂票）

| # | 缺口 | 责任波次 | 状态 |
|---|---|---|---|
| OG-1 | B-10③ 两强制承载项无 node --test 在树承载（test/team-*.test.mjs 缺位） | BE-V14-B / QA-V14 | **OPEN（实测）** |
| OG-2 | scripts/verify-team.sh 未落（§G 原槽，scripts/ 目录现不存在） | QA-V14 | OPEN（未开票，正常排程） |
| OG-3 | LICENSE 未落 + 版权人未定（R2 前置：未定则末波不开） | 末波（lead） | OPEN（前置未满足） |
| OG-4 | BE-V14-B（bin/org-role.js tickTeam/hooks/注入）未落；现 bin/org-role.js 盘≡HEAD 零脏 ✓ | BE-B | 未开始 |
| OG-5 | §G 边界条件 15+ 项 → 在树测试承载对照表未交 | QA-V14 + 各波 | OPEN |
| OG-6 | 在途 M test/org.test.js / M lib/team.js 待其票 commit 后按 B-10①/B-2 终判 | 在途票 | **CLOSED @2026-09-05**：team.js 面=f4d4b47/7b765e3 入史，B-2 双 0 锚按 P7 口径成立；org.test.js 面=c3af1d1 入史，按 ADJ-4.1 校正读法终判=合规不记红（终审亲算见 B-4④ v2.1 注）；现盘 porcelain=0 @6098855 |

## 附录三：中间版 → 定版 delta

1. §0 撤三项 blocker 预留（ARCH-ADJ-2 生效件）；A 表白名单三增补行（org.js 限 BE-A 四条锚 / LICENSE 末波专属 / test/** 非对称）；
2. B-3 为 ADJ-2.1③ 新增安全面，按架构师建议**列硬红线**并入 P6 预验；B-2 双 0 锚自 ADD-1 原锚提升至 checklist；
3. B-9 棘轮链补 65→68 实测锚（HEAD 漂移系在册票 bf762af 推进，非口径漂移；「N/N 须标 HEAD」再钉）；
4. B-10③ 强制承载项由「规则」升格为 **OG-1 实测 OPEN 门禁**（现树零承载，REV 不开闸）；
5. 勘正 ADJ-2.1④ 分解口径（13=12 顶层+1 循环内 test，非 12+1 t.test；总数不变，复算配方固化于 B-4④）；
6. 中间版全部其余条目（①–⑦ 最低覆盖、G1–G4、G-ATTR-1/2、三点套、blob 谱系、一票一 commit、message-对-hunk、mtmwh4l3 裁定③口径）原文并入，无删减。

—— 代码评审 node-5 · REV-V14-CHECKLIST-v2 定版 · 源 ARCH-ADJ-2（mtn50lt3-uhea）
