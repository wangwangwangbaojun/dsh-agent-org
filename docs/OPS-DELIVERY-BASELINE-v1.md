# OPS 交付基准正式口径 v1（交付基准一律 commit hash）

> 性质：正式口径落档件（lead 名下文控，非波次 diff、不入任何波次改动面）。
> 生效：自本件入库 commit 起，对 v0.14 合并波次及后续一切波次/票/评审/汇报生效。
> 授权链：架构师三裁定之 commit-hash 基准（评审侧收讫于 node-5 V14-R 清单函）＋ ARCH-V14-CONTRACT §G 尾部 R1「hash 仍是唯一权威标识，tag 只是锚」＋ REV-V14-FINAL-CHECKLIST-v2 通用纪律行 ＋ 架构师 mtn6w0g3-ardf §四建议采纳 ＋ lead 终裁落档 [mtn1no5k-je02]。

## 一、口径条款（全 P0）

1. **唯一权威标识 = commit hash。** 一切「交付/入库/落档/完成」的状态引用必须指向 commit（含 HEAD 全 sha 或唯一短 sha）；工作树快照、盘上行号、未落账在盘态、口头声称一律不得作为交付基准。
2. **blob 谱系对账。** 文本对账一律 `git show <commit>:<path> | sha256sum`（或 `git hash-object --stdin` 复算）；盘上 sha 只作同时点证据，不作后续锚。
3. **行号必须附 commit 锚。** 一切行号引用写作 `@<sha> path:line`；无锚行号只作导航、不作证据。
4. **废止全局工作树快照通版。** 状态通版不再发布；纪律收敛为两条：①每票开工现测 `git status --porcelain` 并把结果记入票面；②状态引用一律指向 commit id。（实证：旧通版→更正 v2→v2 自带 WIP 段两轮自我腐化，快照模式不可维护。）
5. **基准石三件套**（§G 尾部 R1，自 v0.14 起缺=blocker，不追溯）：hash + annotated tag + 第二副本 bundle。本件落档时点复验在位：`baseline-v0.13.0` → `23f620f2f4f387673144525de9de0e4166bbd7f1`；`~/.dsh/backups/baselines/baseline-v0.13.0.bundle` sha256=`31ffed245b5f373c0aa0b4344c4bf1ce34513ebbb8e036117d40973e4e9f7937`（94407B，git bundle verify 通过，见 R1 备案）。
6. **留痕纪律（既有，此处收编为基准口径组成部分）**：commit message 带任务 id；path-scoped add；「改面越界即评审 blocker」按 REV-Checklist-v2 §A 白名单（含 ADJ-2 增量列）执法。

## 二、复核配方（评审侧可直接跑）

- 本件入库锚：随落档 commit（message 含 [mtn1no5k-je02]）；复算 `git show <落档commit>:docs/OPS-DELIVERY-BASELINE-v1.md | sha256sum`。
- 状态断言取证模板：`git merge-base --is-ancestor <sha> HEAD`（在史性）；`git show <sha>:<path>`（blob 态）；`git log --oneline -1 <sha>`（归属票面）。

## 三、修订权

本口径仅 lead 终裁可修订；修订=本文件新版本（v1→v2）新 commit，不改写历史、不追溯既往票。

——lead（负责人）2026-09-05 落档 [mtn1no5k-je02]
