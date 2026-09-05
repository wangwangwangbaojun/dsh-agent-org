# DEFECT-LEDGER v1 — dsh-agent-org 缺陷台账（在册终态记忆载体）

> 用途：登记缺陷票的**终态**（症状 / 终裁 / 修复锚 / 回归资产 / QA 关账 / 合法出现面），
> 防止日后清理测试用例名、措辞或 `.evidence/` 留痕时失去在册记忆。
> 本档 §1 即 token `dotted-subordinate` 在仓内的在册记忆载体：其在 `test/` 用例名与
> `.evidence/` 历史日志中的出现均为**负向锁定的正当出现**（非残留缺陷）；验收门禁口径为
> `grep -rn 'dotted-subordinate' bin/ lib/` 零命中（仅扫描 bin/ 与 lib/，docs 记档不违门禁）。

---

## 1. DEF-EDGEKIND-1 — org_mutate addEdge `kind` 自述漂移（**关账＝通过**）

- **票链**：立案/修复票 `[DEF-EDGEKIND-1/mtn4l1c6-v2fy]`（lead 立票 FIX-EDGEKIND-1）→ QA 关账确认函 `mtnm716o-hmxt`（node-4）。不计入 BUG-V14 关票面。
- **症状**：工具自述面 `lib/index.js` :558（addEdge `kind` 枚举+同行描述）与 :575（mutate `kind` 枚举）自述 `dotted-subordinate`，而域层唯一合法集为 `lib/org.js` `EDGE_KINDS = ['collab','dotted']`（:14）。用户按工具面字面值调用必抛错、盘上零落盘——「自述≠执法」类缺陷。
- **终裁（架构师）**：采 **(a) 自述向 canonical 收敛**（工具面对齐域层两值集）；**驳 (b) 旧值归一化**——驳值在产盘零存量（无兼容负担），且归一化＝enum 外第三值容忍，与病根同类，违 fail-fast。
- **修复锚**：`9f74abe`（2026-09-05 01:05:03 +0800）＝ `lib/index.js` 恰 2 hunk（2+/2−，单文件）＋ `test/edgekind-contract.test.mjs`（107 行，sha256 前缀 `1a97dc41ddac1861`：R1 enum≡EDGE_KINDS 双向集合锁·禁字面量复制／R2 自述面反模式零残留断言／R3 隔离盘 canonical 每值回读对账）。配套常备门禁 `6c9a8a6`（01:19:01 +0800）＝ `test/edge-kind-lock.test.mjs`（171 行，sha256 前缀 `c3004a8fb8a0539a`，8 案 R1/R1b/R2/R3a/R3b/E1/E2/I1）。`lib/org.js` 域层一字未动、零数据迁移。
- **验收门禁**：`grep -rn 'dotted-subordinate' bin/ lib/` → 零命中（exit 1）。
- **QA 关账（node-4，判定＝通过）**：@`65e7a70` 复跑两案 `13/13` exit 0、`npm test 118/118` exit 0；反向证据：pre-fix 树（`9f74abe^`＝`be816de`）注入两案红集恰 {R1,R2}×2 文件（门禁非空跑）；黑盒旁证 12/12＋类型面八例全部响亮拒收（反向印证驳 b 理由）。证据正本 `.evidence/qa-defedgekind1-close/REPORT.md`。
- **后端复验（node-2，@`78a4bd3` 本档落盘同帧）**：两案 13/13 exit 0；`npm test` 148/148 exit 0；验收 grep 零命中 exit 1；kind 面零漂移 `git diff 9f74abe..HEAD -- lib/index.js lib/org.js | grep -E "^[+-].*(EDGE_KINDS|'collab'|'dotted'|enum:)"` 零命中。`lib/index.js`/`lib/org.js` 在 QA 锚 65e7a70 后的 sha 漂移源自 `[BE-V14B-3/7864536]`（update 零键门）与 `[BUG-V14B-4/0b83aaa]`（工具面未知键门），均属域外改动，与本票契约无关；现盘自述面 `enum: ['collab', 'dotted']` 与终裁一致。
- **合法出现面在册登记（均为负向锁定，非缺陷，清理前先回看本档）**：
  1. `test/edgekind-contract.test.mjs` 与 `test/edge-kind-lock.test.mjs` 的用例名/断言文案——R2 残留锁的语义即「断言该 token 不在自述面出现」，用例名承载 token 系被测对象本身；
  2. `.evidence/qa-defedgekind1-close/` 历史日志与探针件（`.evidence/` 在 .gitignore 内，不入盘）。
