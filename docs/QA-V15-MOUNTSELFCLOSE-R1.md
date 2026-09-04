# QA-V15-MOUNTSELFCLOSE-R1｜mount-selftest 旧名收口回归报告

- 任务：mtnazvk0-b8b5（node-2 → node-4 盘态知会收口答复，非派活）
- 回归对象：test/mount-selftest.mjs 旧名 assertTenTools→assertFourteenTools 收口（node-2 ②声称已修复）
- QA：测试工程师 node-4
- 基线：node v22.22.1；HEAD=6baecd0（BE-V14B-2；回归期间 HEAD 自 648cad8 推进，两树实测均为 6baecd0 口径）
- 结论：**通过**（无缺陷开单；一处计数口径勘误见「观察」）

## 用例与实测

| # | 路径 | 可复现命令 | 实测输出（摘要） | 判定 |
|---|------|-----------|------------------|------|
| TC1a | 正常·静态收口 | `grep -rn 'assertTenTools' --exclude-dir=.git .` | 零命中（exit 1） | 通过 |
| TC1b | 正常·六调用点行号 | `grep -n 'assertFourteenTools' test/mount-selftest.mjs` | 定义@:52 + 调用@:84/:92/:100/:101/:109/:128，与 node-2 票面行号逐一吻合 | 通过 |
| TC2 | 正常·在盘树全量 | `npm test`（在盘工作树） | `# tests 85 / pass 85 / fail 0`，exit 0 | 通过 |
| TC3 | 边界·pristine 导出树 | `git archive HEAD \| tar -x -C /tmp/qa_v15_pristine && cd 该树 && node test/mount-selftest.mjs && npm test` | 单跑 18/18 断言组 exit 0；全量 85/85 exit 0；旧名零命中 | 通过 |
| TC4 | 边界·盘态 vs HEAD 零漂移 | `git diff HEAD -- test/mount-selftest.mjs` | 零输出（盘上六调用点=已提交态，非未提交暂借） | 通过 |
| TC5 | 错误·原缺陷最小复现 | `cp -a pristine副本 && sed -i 's/assertFourteenTools(seen)/assertTenTools(seen)/g' test/mount-selftest.mjs && node test/mount-selftest.mjs` | exit 1：`ReferenceError: assertTenTools is not defined at mount-selftest.mjs:84:5` —— 与 18:20 快照红项签名一致，证明套件对该缺陷真实敏感（绿非空转） | 通过（红=预期） |
| TC6a | 边界·期望14删至13 | 副本 `sed "s/'org_chart', //"` 后单跑 | exit 1：`AssertionError: 应为恰好 14 个 org_* 工具` | 通过（红=预期） |
| TC6b | 边界·期望14加至15 | 副本 TOOL_NAMES 头插假项后单跑 | exit 1：同上 AssertionError | 通过（红=预期） |

证据文件：/tmp/qa_v15_npmtest_disk.log、/tmp/qa_v15_npmtest_pristine.log、/tmp/qa_v15_mount_pristine.log、/tmp/qa_v15_mut_oldname.log、/tmp/qa_v15_mut_13.log、/tmp/qa_v15_mut_15.log（复现沙盒 /tmp/qa_v15_pristine、/tmp/qa_v15_mut_*，均 /tmp 隔离，未触真盘 ~/.dsh）。

## 观察（非缺陷，计数口径勘误）

node-2 票面「npm test = 65/65」系其快照时点数字（对应 BE-V14-A era）；当前 HEAD=6baecd0 实测两树均 **85/85**（R3 棘轮 65→74→80→85，648cad8/6baecd0 两票落库增样所致）。合并线时序请以 85/85@6baecd0 为准。

## 知会收账

- ①WIP 归属（BE-V14-A 在途件归 node-2 持有）：收账，node-4 无重复投递计划；本次回归全程只读 + /tmp 沙盒，未触在途文件。
- ③OPS3-CLOSE·C2 缺位登记（org-toolface-enum-gate 候选件 sha 76e4deab…b719）：收账，冻结期不挂载；开窗后 QA 侧按票面（整文件 sha 对账 + 仅 G2 test.skip + 断言零重写）执行验收。
