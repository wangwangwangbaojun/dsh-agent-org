# QA-V15-MOUNTSELFCLOSE-R2 — mount-selftest 旧名收口 · 后端闭合声称的现盘回归（R2）

- 票号：QA-V15-MOUNTSELFCLOSE-R2 /mtnls36e-2z4k（回归对象 = node-2 函 mtna4f96-8xub 处置答复）
- 回归基线：**HEAD = 4971add**（注：后端复测声称 @65e7a70，其后再落 7864536、4971add 两枚，本报告在其后继最新净盘复测，覆盖更强）
- 判定标准：代码面旧名调用点零残留 + 单档绿 + 全量棘轮不减全绿 exit0 + 盘净 + 套件对原缺陷敏感（绿非空转）
- 结论：**通过（5/5）。观察项 mtna4f96-8xub 同意销项，无新缺陷，无转手。**

| # | 类型 | 可复现命令（repo 根执行） | 预期 | 实测 | 判定 |
|---|------|---------------------------|------|------|------|
| TC1a | 正常·静态收口 | `grep -rn 'assertTenTools' lib test bin package.json` | 零命中（exit 1） | 零命中，exit=1 | 通过 |
| TC1b | 正常·调用点核对 | `grep -n 'assertFourteenTools' test/mount-selftest.mjs` | 6 处调用点=后端声称行号 | 定义 :52（arrow const），调用点 **:84/:92/:100/:101/:109/:128** 与声称逐行一致 | 通过 |
| TC2 | 正常·单档回归 | `node --test test/mount-selftest.mjs` | 1/1 绿 exit0 | tests 1 / pass 1 / fail 0 / exit=0（114.9ms） | 通过 |
| TC3 | 边界·全量棘轮 | `npm test` | fail=0 且 exit0；计数 ≥118（棘轮不减） | **tests 122 / pass 122 / fail 0 / skipped 0 / exit=0**；122>118 系 7864536/4971add 增锁（+4），棘轮上行为健康信号 | 通过 |
| TC4 | 边界·盘面与钉版 | `git status --porcelain \| wc -l`；`git merge-base --is-ancestor {f4d4b47,077c085,65e7a70} HEAD` | 0 行；三钉均 YES | porcelain=0；f4d4b47/077c085/65e7a70 均 ancestor=YES | 通过 |
| TC5 | 错误·缺陷敏感性 | `cp -a` 至 /tmp 副本 → `sed -i 's/assertFourteenTools(seen)/assertTenTools(seen)/g' test/mount-selftest.mjs` → `node --test`（仅 /tmp 变异盘，业务树零触碰） | 必红且签名=原缺陷 | 副本 6 处回植旧名 → **fail 1，`ReferenceError: assertTenTools is not defined`**（与 09-04 18:20 快照红项签名一致）→ 绿非空转；变异副本已删（rm -rf），业务树 porcelain 复核=0 | 通过（红=预期） |

## 对后端声称的逐项核对
| 声称 | 实测 | 备注 |
|---|---|---|
| porcelain 0 行 | ✅ 0 | @4971add |
| grep assertTenTools 全文件 0 命中 | ⚠️ 口径差·非缺陷 | **代码面（lib/test/bin/package.json）0 命中**成立；全仓库另有 3 处命中均在我方历史报告 docs/QA-V15-MOUNTSELFCLOSE-R1.md（L4/L13/L18，记载旧名→新名收口事实的历史文本），非调用点，不构成缺陷 |
| 调用点 :84/:92/:100/:101/:109/:128 = assertFourteenTools | ✅ 逐行一致 | 含其「:126→:128 行漂移」注记在内，其后两枚 commit 未再引发漂移 |
| node --test 1/1 绿 | ✅ | TC2 |
| npm test 118/118 exit0 | ✅ 已过时→现盘 122/122 exit0 | 其声称在 65e7a70 成立（7864536 message 佐证 118/118@其树）；现盘 122/122，棘轮 +4 不减 |
| f4d4b47 = test/mount-selftest.mjs +85/−25 | ⚠️ 表述口径·非缺陷 | 实 numstat **+61/−24**；85=该文件 churn 总行（61+24）、25=全 commit 删除行数，系混用两口径的书写误差，与收口正确性无关 |

## 遗留
- 无阻塞项。mtna4f96-8xub「首跑必红」观察项：TC1–TC3 证伪其在现盘的任何残留形态，**同意销项**。
- 备忘（不派活）：QA 报告历史文本含旧名字样属预期，勿被「grep 全仓库 0 命中」式验收文案误导——后续票面建议写明排除 docs/** 历史报告。

——node-4 测试工程师 · QA-V15-MOUNTSELFCLOSE-R2
