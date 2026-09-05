# QA-BUGV14B5-NESTED-R1 —— BUG-V14B-5 嵌套未知键门 QA 回归报告

- **判定：通过（A1-A5 全绿，零缺陷，上线闸门放行）**
- QA 任务：mtofpc37-gsky（测试工程师）｜承接终裁 ADJ-V14B-NESTED@**5c36db7**｜被测修复 BUG-V14B-5@**c2f62aa**
- 被测域：lib/org.js `MODEL_KEYS/SCOPE_KEYS` 白名单门（sanitizeModel + sanitizeScope，add/update/addOrg 三面收口）
- 被测 HEAD：c2f62aa（工作树零业务改动；QA 产物仅 test/qa-bugv14b5-nested-regression.test.mjs + 本报告，untracked 候并入）
- 独立性声明：本套 **≠ 实现方金样 bugv14b-nested-keys.test.mjs 复读**。差异视角：A1 逐面（而非合并）盘级比对＋结构计数；A3 安全锚改打**既有受限面 {allow:[read]} 不放开**（实现方仅空面案型）；A4 补钉 **addOrg 成功路径**（实现方金样零涉）、update 面整单替换语义、sanitizeScope 重构后 overlap 门不破、非纯对象 toolScope 零误杀。

## 用例矩阵（正常 P／边界 B／错误 E 各≥1；结论只判通过/不通过）

统一复现命令：`node --test test/qa-bugv14b5-nested-regression.test.mjs`（单案可加 `--test-name-pattern 'QA-E05'`）

| 用例 | 类 | 验收映射 | 断言要旨 | 实测 | 结论 |
|---|---|---|---|---|---|
| QA-P01 | 正常 | A4 | add 面合法三键 model（trim/空 fallback 省略）＋全键 toolScope 逐字段落盘 | ok | 通过 |
| QA-P02 | 正常 | A4 | update 面 model 整单替换（非 merge）＋半键 scope 修剪等旧 | ok | 通过 |
| QA-P03 | 正常 | A4/A1 互证 | addOrg 合法 model 正路径落盘（成功面真实写入=与必抛面零写入互证门位同点） | ok | 通过 |
| QA-B01 | 边界 | A4 | model 等旧四形态 缺省/null/''/{} 仍产 `{}` 宿主默认标记 | ok | 通过 |
| QA-B02 | 边界 | A1 | 门据=键非值：`{provder:undefined}` 必抛（禁 undefined 值逃逸白名单） | ok | 通过 |
| QA-B03 | 边界 | A1 | 白名单大小写严格：`{Provider}` 必抛（禁宽容复活静默面） | ok | 通过 |
| QA-B04 | 边界 | A4 | 非纯对象 toolScope（串/数组）等旧空面——终裁明令零扩大打击面，门不误伤 | ok | 通过 |
| QA-E01 | 错误 | **A1** | add 面 `{provder}` 点名 OrgError（含已知字段清单文案）＋**本面盘字节零写入**＋节点计数零增 | ok | 通过 |
| QA-E02 | 错误 | **A1/A2** | update 面必抛＋盘上 node.model 不被部分刷新（合法 provider 同不落）＋盘零写入 | ok | 通过 |
| QA-E03 | 错误 | **A1** | addOrg 面必抛＋orgs 计数零增＋盘零写入（第三面独立实证，throw-before-write） | ok | 通过 |
| QA-E04 | 错误 | **A2** | 混合形态双未知键**一次全点名**＋全盘扫描合法 provider 不部分生效 | ok | 通过 |
| QA-E05 | 错误 | **A3 安全锚** | 既有受限面 `{allow:['read']}` 遇 `{alow:['bash']}` 必抛且**限制绝不抹平/扩面**，盘零写入 | ok | 通过 |
| QA-E06 | 错误 | A4 | sanitizeScope 重构后 allow/deny 冲突门不破（`冲突条目：bash` 仍点名） | ok | 通过 |

**套件实测：`# tests 13  # pass 13  # fail 0`，exit 0。**

## A5 棘轮与共跑

- 指定共跑（实现方金样＋三金锚＋本 QA 件）：`node --test test/bugv14b-nested-keys.test.mjs test/bugv14b-model-shape.test.mjs test/bugv14b-update-gate.test.mjs test/org-mutate-update-gate.test.mjs test/qa-bugv14b5-nested-regression.test.mjs` → **52/52 pass，exit 0**（E8/E10 锁、model-shape 六案、UPDATE_PATCH 门零翻转）。
- 全量闸：`npm test` → **209/209 pass，exit 0**。棘轮：实现方在册 196 → 本 QA 并入后 209，只增（≥184 基线裕度扩大）。
- 噪声排除：一次历史运行显 1 fail，系本 QA 文件写入与 npm test 采集并行的**竞态半文件**，非实体缺陷；复跑定案 fail 0。

## 红基线复验（证本套非空转）

`git archive da6a243`（修复前）隔离树跑同一 QA 件：**7 fail / 6 pass**。
- 必红 7 案=QA-E01~E05＋QA-B02/B03——旧码下缺陷全数实体复现（静默成功＋盘写入＋受限面被放开）；
- 双绿 6 案=QA-P01/P02/P03＋QA-B01/B04＋QA-E06——等旧形态与正路径新旧两侧逐字段同果=**A4 零翻转的独立实证**。

## 范围外观察（台账，不属本票缺陷，不影响放行）

1. add 面无 allow/deny overlap 冲突门（update 面有）——既有不对称，先于本修存在；按终裁「零扩大打击面」本修不动它正确。建议候补票评估（涉授权语义，非静默丢键域）。
2. S2 例外升格条款：本轮未观察到新的「静默丢弃致授权扩大」先例（toolScope 域已被 c2f62aa 收口）。

## 产物

- `test/qa-bugv14b5-nested-regression.test.mjs`（13 案，untracked 候 lead 裁并入，循 storm QA 先例）
- 本报告 `docs/QA-BUGV14B5-NESTED-R1.md`
- 零业务实现触碰；零 ~/.dsh 触碰；临时沙盒（/tmp）已清。
