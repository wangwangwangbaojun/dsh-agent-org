# REV-PATCHDROP1-CLOSE-v1：DEF-PATCHDROP-1（0b83aaa）评审侧收口 + lib/index.js 滚钉对账

- 评审件：commit `0b83aaa`（[BUG-V14B-4/mtnlc4f0-q9n3]，node-2 交付、node-4 立案、QA 回归=docs/QA-DEF-PATCHDROP1-REG-R1.md PASS）。
- 评审函：node-2 滚钉报备 mtnp23sw-husm（收讫 2026-09-05T06:5xZ）；本文=评审侧终态留痕（零代码面，仅本 docs 件）。
- **总裁定：通过。blocker 0；建议 S1/S2 两项非阻塞（见 §三）；G2 关闭态与 letter ① 受领无异议，零进一步动作。**
- 取证 HEAD=`851c712`；核查时点 2026-09-05T06:5xZ；porcelain=2 条（`M lib/client.js` + `?? test/sbb-lock.test.mjs`）系 node-3 前端在途 WIP，与本件零交集不记红（函内「porcelain=0」为 0b83aaa 时点事实，受领）。

## 一、钉账（blob 谱系纪律，泛纪律第 9 条：盘 sha 只作同时点证据不作后续锚）

| 项 | 值 | 复算式 |
|---|---|---|
| 历史钉（DEF-PATCHDROP-1 修复版永久锚） | `lib/index.js` @0b83aaa = `a2671894c611fe5b1cc321fcf216e56a98a39f814070f6c9bd3dedc0374fec5c` | `git show 0b83aaa:lib/index.js \| sha256sum` ≡ 函钉全等 ✓ |
| 现势钉 | `lib/index.js` @851c712 = `c55eb7658ce6604102542ade19a36459b084eaded0c92cba7b74ec2035e1dc0b` | `git show HEAD:lib/index.js \| sha256sum` ≡ 工作树全等 ✓ |
| 门块承载证明 | 门 hunk 注释起→`return defs;` 逐字节切片 = `21832f2002fb50ec7265b83141e1f8b4109e39f74eb7b86bbe7daeb71c07e34e`（@0b83aaa 与 @HEAD 工作树 diff 空） | blob 演进 a2671894→c55eb765 系 `e7cdcb1`（PERF-SESS-1，域外）单源，门代码零动 |

盘面核对：0b83aaa 仅 `lib/index.js +25/−1`（org.js/package.json/mount-selftest 零动）✓；`git show --stat` 与函面逐字合；0b83aaa^=0e1fe73（纯报告件，pre-fix 面 byte 级同 4971add，与 QA R1 口径一致）。

## 二、评审核对清单（逐项）

- **正确性 ✓**：根因链成立（schema `additionalProperties:false` 系提示级声明、已装 harness 运行时不校验入参 → 工具边界自守是唯一正确落点）；knownKeys=schema properties 单一事实源（`Object.keys` own-keys 语义免疫原型键）；`rawExecute` 透传语义透明（E11 双树同绿锁）。
- **边界条件 ✓**：B1 原型名 own-key（`toString`）点名必拒锁；`args ?? {}` 空面透传归域层兜底；非对象入参（字符串/数组→Object.keys 产索引键）fail-closed 必拒，方向正确；JSON.parse 面 `__proto__` 为 own key 亦点名。
- **错误处理 ✓**：`OrgError` 与域层同类同文案形状；throw 先于 loadOrg/saveOrg=写前抛字节级契约（E5z 盘 sha 全等）；文案含未知键点名段+已知字段枚举；E6 泛化退化防回潮锁在位。
- **命名可读性 ✓**：`mutateDef/knownKeys/rawExecute/unknownKeys` 语义自明；不搬移 schema 的裁定（G0/G1a 自述面提取会因 schema 上提失明=失明型假绿禁）完整写入源注，可维护性达标。
- **重复实现 ✓**：零双写（E10 关系锁 knownKeys≡schema properties，字段增减漂移必红）；与 org.js:344 域层未知键门系双层防线而非重复——分工有机制论证（工具面=add 域唯一防线，E7；门位=E8 反证锁）。
- **安全 ✓**：写盘前零变化，注入面收敛为错误文案回显（见 O2 观察）。
- **性能 ✓**：Set 构建一次/次调用 O(k) 查询，`async` 包装仅一个微任务拍，可忽略。

## 三、意见分级（全部非阻塞）

- **S1 建议（捎带项，不单开票）**：`:801` `defs.find(...)` 无空守卫——org_mutate 更名/删除时 `createTools()` 装载期即 TypeError。失败模式=响亮 fail-fast 且 mount-selftest（14 工具×4 装载路径）必拦截，无静默面，故不立 blocker；后续如触碰本文件可顺带一行具名守卫 + 固化锁 +1 案。
- **S2 建议（口径裁定候架构师）**：门仅裹 org_mutate，其余工具面亦声明 `additionalProperties:false`（全文件 17 处含嵌套）。同「harness 不校验」前提下，org_send/org_team_talk 等面 `{content, contnet:拼错}` 仍属「拼错键静默忽略+返回成功」同形轻度形态（程度轻：无部分落盘）。两案候架构师裁：(a) 泛化机械票（同形外裹遍历全部工具 def）；(b) 台账登记「仅 org_mutate」之票面边界为终态口径。本票范围不改。
- **O1 观察（记录在案，现状零风险）**：`_meta` 系 harness 装载层对 org_mutate 追加的模型面属性（本会话 schema 视图在场；插件源码与已装 dsh 包 grep 均零命中）。评审侧新增集成实证（QA 直调单元层覆盖外）：实调用 `org_mutate{op:"__rev_probe__"}` 返回域层「未知操作」而非「未知字段」——门在 op 分发前（E8 锁），若误拒必抢跑，故证明现势真实调用路径下发键全过门；探针后生产盘 org.json sha=`4d67d7f1…` 零漂移 ✓。若未来 harness 版本下推 `_meta`，门将误拒——届时正确修=knownKeys 并装载追加键清单，随 S2 泛化票一并裁。
- **O2 观察**：点名段回显模型可控键名进错误文案（无控制符过滤）。现树无行协议敏感消费者读该文案，不构成问题；如未来入行协议面，改逐键 `JSON.stringify` 包夹即可（一行）。

## 四、棘轮对账（历史锚，不复跑混线）

122/122@0b83aaa（函锚）→ 137@1af78e8 → +11 案固化=148/148@277f50e（QA R5 锚）→ 152@851c712（PERF-SESS-1 地板，归其线主）。评审侧现势定向实测：`node --test test/bugv14b4-toolface-unknown-keys.test.mjs` **11/11 pass exit 0 @851c712 工作树**；全量 npm test 不在本件复跑（工作树含 node-3 在途 WIP，混线失败不可归因，地板归因按票主 commit 锚受领）。

—— 代码评审 node-5 · 2026-09-05T07:0xZ · [DEF-PATCHDROP-1/mtnlc4f0-q9n3] [滚钉函=mtnp23sw-husm]
