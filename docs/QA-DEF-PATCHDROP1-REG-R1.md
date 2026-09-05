# QA-DEF-PATCHDROP1-REG-R1：DEF-PATCHDROP-1 修复回归 + E5/E6 现案固化（含报备增补 E7）

- 任务 id：mtnp23sr-qrno（node-4 QA 回归固化票）；立案函 mtnlc4f0-q9n3；node-2 交付函（0b83aaa 落地通报，收讫 09:1x）。
- 被测件：commit `0b83aaa`（[BUG-V14B-4/mtnlc4f0-q9n3]），`lib/index.js` createTools 数组外裹 org_mutate 未知键点名必拒门。
- 回归取件：直取 HEAD=1af78e8；`lib/index.js` 自 0b83aaa 后零动（`git log 0b83aaa..HEAD -- lib/index.js` 空），
  sha256=`a2671894c611fe5b1cc321fcf216e56a98a39f814070f6c9bd3dedc0374fec5c` 与函钉全等。
- 总裁定：**通过（PASS）**。缺陷分级维持立案口径=非 blocker、随 BUG-V14B 线收口；发布闸口径候 lead 对 ③ 之裁。
- 固化件：`test/bugv14b4-toolface-unknown-keys.test.mjs`（11 案，npm test 自动计入；本票零业务实现改动）。

## 一、验收项台账

| # | 验收项 | 实测 | 结论 |
|---|--------|------|------|
| R1 | 修复件票面核对：0b83aaa 在史；仅 `lib/index.js` +25/−1；`lib/org.js` 对 0b83aaa^ diff 空（域层零改动）；工作树 porcelain=0 | `git show --stat 0b83aaa` = `1 file changed, 25 insertions(+), 1 deletion(-)`；`git diff 4971add 0b83aaa^ -- lib/` 空（0e1fe73 系纯报告件，pre-fix 面 byte 级同 4971add）；porcelain 0 行；sha256 全等函钉 | 通过 |
| R2 | 固化锁 post-fix 全绿（11 案=正常 2 / 边界 3 / 错误 6，覆盖 E5/E6 现案 + E7 增补 + 门位置/单一事实源/透明性锁） | `node --test test/bugv14b4-toolface-unknown-keys.test.mjs` → 11/11 pass exit 0 | 通过 |
| R3 | 双向证据契约：本锁在 pre-fix 净树必红且红因=缺陷形状直接显形 | 净树 `git archive 4971add \| tar -x` + 隔离 HOME 运行本锁：恰红 **E5 E5z E6 E7 E8 E9 B1 E10**（8 案）exit 1；H1 H2 E11 双树同绿。红因逐条：E5 `未抛错→"已更新节点 node-w。"`（静默假成功）；E6 退化泛化 `update patch 未携带任何已知字段（…）`（点名退化证实）；E7 `未抛错→"已新增节点 node（受害者）。"`（add 面同形残面）；E8 `未知操作：frobnicate` 抢跑（门位前置必要性反证）——与 node-2 函 pre-fix 描述逐字同形 | 通过 |
| R4 | node-2 原探针逐字交叉（`/tmp/def-patchdrop1/probe.mjs`，DSH_AGENT_ORG_PATH 重定向，不入库） | post-fix 实测：E5/E6/E7 全部点名必抛，E5 文案与函件逐字相符 `org_mutate 入参含未知字段：sytemPrompt（已知字段：org/op/.../confirm）`；E6 点名 `foo, bar`；E5z 盘字节级零变化 ✓；H1 title 落盘 / H2 六键成功=true 零误伤 | 通过 |
| R5 | 全量回归棘轮不减 + 装载自测 | 基线本票前实测 HEAD=1af78e8 **137/137**（函内 122/122 系 0b83aaa 时点现势，其后 2800f28 增账，口径注记见 §三.2）；本票 +11 案 → **npm test 148/148 pass 0 fail 0 skip exit 0**；`node test/mount-selftest.mjs` exit 0；enum-gate G0/G1a/G1b/G2 全含于全量绿 | 通过 |
| R6 | 生产盘零写入 | `~/.dsh/agent-org/org.json` 全部回归跑前后 sha256=`4d67d7f15fe8d503a7ee2404f28b4520fea8c04c9145184bdad1dc11ba5fb5aa`，与台账锚/函锚全等，零漂移 | 通过 |
| R7 | 自述面源文零动（node-2 工程提示兑现核查） | 0b83aaa 对源文的改动仅 `return [` → `const defs = [` 一行 + 数组闭合后外裹块，两处均在 `name:'org_mutate'`→`output:` 自述面界定段之外；schema 源文声明位零动（无 ORG_MUTATE_PARAMS 上提残留）；G0/G1a 绿=R3/R5 全量内证 | 通过 |

## 二、用例台账（固化档=唯一现案载体；逐案命令=单档运行过滤案名）

复现命令（post-fix）：`node --test test/bugv14b4-toolface-unknown-keys.test.mjs`（11/11 绿）；
复现命令（pre-fix 红案对账）：`git archive 4971add | tar -x -C <净树目录> && cp test/bugv14b4-toolface-unknown-keys.test.mjs <净树>/test/ && cd <净树> && node --test test/bugv14b4-toolface-unknown-keys.test.mjs`（恰 8 红 3 绿 exit 1）。

| 案号 | 面 | 入参 | 期望（post-fix 实测） | 结论 |
|------|----|------|----------------------|------|
| E5 | 错误·混合拼错键 | `{op:'update',id:'node-w',title:'资深执行',sytemPrompt:'TYPO-PROMPT'}` | 必抛 /未知字段/ 且点名段含 `sytemPrompt`、不含已知键 `title`；盘 sysPrompt=OLD-PROMPT、title=执行 不动 | 通过 |
| E5z | 边界·写前抛 | 同 E5 | 盘 sha256 调用前后全等（throw-before-write 字节级契约） | 通过 |
| E6 | 错误·纯未知键点名 | `{op:'update',id:'node-w',foo:1,bar:2}` | 点名段逐含 `foo`/`bar`；禁泛化「未携带任何已知字段」回潮（退化锁）；盘=种子档 | 通过 |
| E7 | 错误·op=add 同形 | `{op:'add',parentId:'lead',name:'受害者',sytemPrompt:'TYPO-ADD'}` | 必抛点名；盘无「受害者」节点；盘字节级零变化（域层 add 无未知键概念，工具面唯一防线） | 通过 |
| E8 | 边界·门位置 | `{op:'frobnicate',bogusKey:1}` | 点名 `bogusKey`、域「未知操作」不得抢跑（锁门在 op 分发之前＝全 op 覆盖之机制性锁，防未来下移回 op 分支） | 通过 |
| E9 | 错误·第二 op 样张 | `{op:'addEdge',from:'lead',to:'node-w',kind:'collab',knd:'x'}` | 必抛点名 `knd`；边不生成；盘零变化 | 通过 |
| B1 | 边界·原型名 own key | `{op:'update',id:'node-w',toString:'evil'}` | 点名 `toString` 必拒，不得经 knownKeys 原型链漏网、不得退化泛化（Object.keys own-keys 语义锁） | 通过 |
| E10 | 边界·单一事实源 | `{op:'update',id:'node-w',zzz:1}` | 文案「（已知字段：…）」枚举 ≡ `Object.keys(tool.parameters.properties)`（关系锁，不锚字面全文，依 node-2 函锚点纪律）；schema `additionalProperties:false` 声明在位 | 通过 |
| E11 | 正常·门透明 | `{op:'frobnicate',id:'node-w'}`（全已知键） | 域层「未知操作」照常报错＝门不越权抢报（双树同绿） | 通过 |
| H1 | 正常·金样 | `{op:'update',id:'node-w',title:'资深执行'}` | 零误伤：成功前缀「已更新节点 node-w」+ title 落盘 + sysPrompt 不动 | 通过 |
| H2 | 正常·Web 同构金样 | 六已知键全带（name/title/systemPrompt/model/toolScope/maxTokens） | 零误伤：成功前缀 + 磁盘逐字段对账一致（client.js patchOf 同构面） | 通过 |

## 三、QA 注记（非缺陷）

1. **门覆盖口径**：本锁以 E7+E8+E9 三点位锁「门在 op 分发之前覆盖全部 op」的口径（add 面红案、门位反证、addEdge 第二样张）。node-2 增补 E7 入固化票之建议已兑现；move/delete/removeEdge/renameOrg/layoutAll 与 addEdge 共用同一入口门（同一 `execute` 包装），按样张覆盖口径不再逐 op 铺案。
2. **基线现势差**：函内「npm test 122/122」为 0b83aaa 时点现势；本回归取 HEAD=1af78e8 基线实测 137/137（2800f28 org-role 接线增账 15）。棘轮「不减」判据在现势口径成立：137→148（本票 +11）。`lib/index.js` 钉 sha 两时点同值，回归结论不受影响。
3. 锚点纪律（node-2 工程提示）：本锁全程运行时工具面 + 磁盘回读，零依赖源文自述面提取路；`org-toolface-enum-gate` 的 schema 源文锚（G0 双形态样张，6098855 收口件）与本锁互不重叠、无重复挂锚。

—— node-4 QA @1af78e8（2026-09-05）
