# FE-SBB-DESIGN v1｜「滑到最底下」悬浮球——需求确认与方案设计（≤1页）

- 票：team:sbb-design（架构师 node）｜日期 2026-09-05｜v0.14 四件套首个实战活
- 语义参照=宿主官方聊天页 toBottom（dsh-client-ui-chat .EvIC1a_toBottomSlot，外部侦察件）；**只对齐交互语义，不复用其码/类名/样式**，全部落插件自有 dshao- namespace。
- 代码事实基线：lib/client.js @1640 行形态；CSS 集中于文件头部 <style> 模板串；npm test=`node --test`（新 test 文件自动入列）。

## §0 结论先行
1. 在面容器仅两个：**C1 沟通·留痕 feed**、**C2 transcript 详情流**；其余三面明确出局（§1 表）。
2. 挂载用 **sticky-slot**（滚动容器末子、height:0），零 wrapper、零现结构改写、零新增 fetch/state 面外溢。
3. 交互=「非底部出现→点击平滑回底」；reduced-motion 降级为瞬时跳；与 C1 既有自动跟底（:805-811）零耦合共存。
4. 验收=静态锚+纯函数真值表（`sbbVisible` 源文提取 eval，仓内提取器先例 toolface-selfdesc/enum-gate），实景由外部重启后补，Chromium fixtures 随 S2 另票不入本票。

## §1 目标滚动容器裁定（判定表）
| # | 容器 | 现位置 | 裁定 | 理由 |
|---|---|---|---|---|
| C1 | 沟通·留痕 feed（.dshao-feed + ref=feedScrollRef，max-h520） | :805-811 自动跟底 / :1217 渲染点 / :1263 尾哨兵 | **在面** | 线性消息流；已有近底自动跟底，按钮补足「上翻后一键回底」空档 |
| C2 | transcript 详情流（.dshao-proc-scroll，max-h560，可 live-append） | CSS :130 / 渲染点 :1329 | **在面（主落点）** | lead 点名需求本体；长会话流最长滚动面 |
| C3 | 团队面板（.dshao-team-scroll） | CSS :144 | 出面 | 二维滚动（泳道行×依赖列），「最底」语义不成立；78a4bd3 新落盘面正受 S2 审视，勿叠变量 |
| C4 | 组织图 canvas（.dshao-canvas pan/zoom） | CSS :39 | 出面 | 平移画布无线性底部；已有 .dshao-canvas-tools 与拖拽/键盘四向平移 |
| C5 | 嵌套微观滚动（.dshao-tool pre、.dshao-think 等） | :125/:120 | 出面 | details/collapsible 折叠语义已承载「看到全部」，再加按钮=噪声 |

嵌套注记：C2 之外、process tab 内层还有 .dshao-feed（:1313，会话索引层）——**豁免不装**：主滚动面=事件流本体，索引层列表≤40 项且有标题头，按钮绑定只认自身 scroller 原则下自然出局。

## §2 交互规格（S 编号=FE 续聊复述验收要点）
- **S1 可见性**：显示 ⟺ `sbbVisible(el)` = `el.scrollHeight - el.clientHeight > 8` **且** `el.scrollHeight - el.scrollTop - el.clientHeight > SBB_NEAR`。常量 `SBB_NEAR = 120` 单点定义；与 :810 自动跟底阈值 **120 同值同向**（内容锚耦合：测试断言两处字面等值=120；v1 不改 :810，自动跟底面字节零动）。
- **S2 重算时机**：host `scroll`（passive:true）＋ 每次数据驱动重渲染后的 effect（dep：C1=feed、C2=transcript，live-append 不保证触发 scroll，防失明）＋ `resize` 一行监听（1 行消抖窗内面板尺寸翻转失明，收益>成本）。
- **S3 点击**：`host.scrollTo({ top: host.scrollHeight, behavior: reduced ? 'auto' : 'smooth' })`；smooth 途中用户滚轮打断=不强拉回，按钮状态随后续 scroll 事件自然重算。
- **S4 跟底协同**：C1 点击触底后，既有 nearBottom 自动跟底自然恢复；**禁止**新增 follow 标志位/改写 :805-811。
- **S5 reduced-motion**：`matchMedia('(prefers-reduced-motion: reduce)').matches` → behavior:'auto'；CSS 侧 `@media (prefers-reduced-motion:reduce)` 下 `.dshao-sbb` transition:none（先例 :165 team-card 降级）。
- **S6 a11y**：真 `<button type="button" aria-label="滑到最底下">`；隐藏态 `visibility:hidden`（同步退出 tab 序）+ opacity:0 + pointer-events:none，经 `data-show="0/1"` 切换。

## §3 结构与样式（最小改动面）
```js
// 宿主标记：C1/C2 两渲染点各加一个属性 data-sbb-host（内容锚，全库出现数=2）
// slot 组件（同文件工厂，≈20 行）：
const SbbSlot = () => { const slotRef = React.useRef(null); /* effect: 经 closest('[data-sbb-host]') 取 host，绑 S1/S2；cleanup 必 removeEventListener */
  return h('div', { className: 'dshao-sbb-slot', ref: slotRef },
    h('button', { className: 'dshao-sbb', type: 'button', 'aria-label': '滑到最底下', onClick: /*S3*/ },
      h('svg', /* chevron-down 12px, stroke=currentColor */))); };
// 挂载点：C1=:1263 尾哨兵之后；C2=:1329 events.map 之后（各自 scroller 的末子）
```
```css
.dshao-sbb-slot{position:sticky;bottom:10px;height:0;display:flex;justify-content:center;pointer-events:none;z-index:2}
.dshao-sbb{pointer-events:auto;width:28px;height:28px;border-radius:50%;display:grid;place-items:center;
  background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);
  color:var(--dsw-alias-label-secondary);cursor:pointer;transition:opacity .15s ease;box-shadow:0 2px 8px rgba(0,0,0,.12)}
.dshao-sbb:hover{background:color-mix(in srgb,var(--dsw-alias-bg-layer-1) 80%,var(--dsw-alias-label-primary))}
.dshao-sbb:focus-visible{outline:2px solid var(--dsw-alias-border-l1);outline-offset:2px}
.dshao-sbb[data-show=0]{visibility:hidden;opacity:0;pointer-events:none}
```
选型理由（sticky-slot vs 外层 absolute）：零新增 wrapper 层→不动 :1329/:1217 现 DOM 结构与既有测试白名单；height:0 不增 scrollHeight、不扰动 nearBottom/S1 判定；absolute 方案需给两个 scroller 包 position:relative 壳=改动面翻倍且踩现网 DOM 锚。

## §4 拆票（=team 板 sbb-fe，owner node-3，单票）
改动面清单：① CSS 段 +6 行；② `SBB_NEAR`+`sbbVisible` 纯函数 +3 行；③ `SbbSlot` 工厂 ≈20 行；④ C1/C2 两挂载点+host 标记 ≈6 行；⑤ 新档 `test/sbb-lock.test.mjs` ≈60 行。合计 ≤100 行 churn。
**禁触清单**：:805-811 自动跟底段字节零动；lib/、bin/、docs/ 零改动；官方聊天页选择器零触碰；:1329 events.map 行零动；不新增网络请求。

## §5 验收断言清单（A；QA 复跑、评审对表）
- A1 `node --check lib/client.js` exit 0。
- A2 `npm test` 全绿且总数 ≥148+新增 ≥6（棘轮只升不降）。
- A3 静态锚：`data-sbb-host` 出现数=2；`dshao-sbb-slot` 渲染 2+CSS 1=3；CSS 含 .dshao-sbb-slot/.dshao-sbb/两条 media-query 降级（各内容锚，不锚行号）。
- A4 行为真值表（源文平衡括号提取 `sbbVisible` + eval，假 host 对象）：无溢出=假 / 溢出+贴底=假 / 溢出+距底 121px=真 / 距底恰 120=假（开闭区间钉死）/ 零高容器=假 / scrollTop=0 满溢=真。≥6 案。
- A5 门禁同构：新增类名全部 `dshao-` 前缀；`EvIC1a` 零新增命中；新增 CSS 规则选择器逐一以 .dshao- 开头（禁裸标签规则，防污染宿主聊天页）。
- A6 自动跟底面零动：:805-811 语义段与基线内容锚 diff 空；`SBB_NEAR` 定义处=1 且与跟底 120 等值对账。
- A7 reduced-motion 双证：源码含 matchMedia 判定+behavior:'auto' 分支；CSS 含 reduce media 降级。
- A8 泄漏红线：slot effect cleanup 内 `removeEventListener`（scroll 与 resize 两路）静态在位。
- A9 QA 独立面：生产盘 org.json/team.json 前后 sha256 零漂移；四件套既有面板与宿主聊天页 toBottom 行为回归不受扰（静态面）。
- A10 实景（外部）：重启插件，C1 上翻出现按钮/点击平滑回底/贴底隐藏；C2 打开长 transcript 同验；系统开「减弱动态效果」后为瞬跳。

## §6 非功能风险裁定（按正确性>可维护性>性能）
- **并发/失明（最大风险）**：live-append 不触发 scroll → 状态陈旧。已按 S2 三触发面钉死；残留=极窄竞态（重算间隙内滚到底），下一 scroll 事件自愈，可接受。
- **泄漏**：effect cleanup 双路 removeEventListener 列为 A8 红线（先例 :801）。
- **误判**：按钮只认自身 scroller（closest('[data-sbb-host]')），禁 window 级滚动量；嵌套 C1⊃C2 各持独立 slot 互不串扰。
- **安全**：零新增 HTML 注入面（按钮全静态），CSS 全 .dshao- 作用域（A5 闸）；transcript 渲染路径零改动。
- **性能**：passive 监听+纯算术读 scrollTop，无 layout thrash；40×大会话列表规模下无感。
- **兼容**：scrollTo(options)/matchMedia/closest 均在插件既有 Chromium 基线内，零 polyfill。

## §7 锚与留痕
按 ADJ-ANCHOR-1（架构师 2026-09-05 函）：本设计验收=「范围符号（C1/C2 悬浮球面）+ 开工时点重钉锚」制，不绑行号；FE 开工时以内容锚开窗。实景证据 @外部重启后补挂本档尾部即可。
