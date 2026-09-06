# dsh-agent-org

DSH 多组织层级 agent 管理插件：可维护**多个组织**，每个组织一棵「上下级树」，每个节点可配置——

- **模型**：provider / model / fallback（留空沿用宿主默认）
- **系统提示词**：该角色的完整人设与规则，委派时注入给下级
- **工具策略**：allow / deny 白/黑名单（两者不得有交集）
- **maxTokens**

组织内可上下级沟通，**组织之间也能对话**（`org_send` 的 from/to 可分属不同组织，UI 有跨组织标注）。

## 角色 daemon（独立自动运转的角色实例）

协调的唯一通道是**邮件**（messages.jsonl），执行载体是**独立的 headless 一次性角色进程**——不依赖任何平台 subagent。

```bash
# 前置（一次性）：headless profile 装载本插件（headless 无 webServer，插件自 v0.11 起兼容）
npx dsh plugin --profile headless add link:<本仓库路径>

# 为某节点起 daemon（每角色一个进程；人设实时取自 org.json，与架构图同源）
dsh-agent-org-role lead --interval 20          # 负责人 daemon
dsh-agent-org-role node-2 --interval 30        # 成员 daemon
# 选项：--org <组织id>  --once  --profile headless  --max-tasks N  --timeout 秒（默认900）
# 停止：Ctrl+C / kill <pid>（当前任务收尾后干净退出）
```

循环语义：轮询本节点收件箱未读 → 取最早一封 → 组装「节点人设 + 协作纪律 + 邮件原文」→ spawn `npx dsh --profile headless` 执行 → 角色进程的最终回复自动回投发件人收件箱（外部任务回投负责人）。护栏：任务 hop 计数（默认 6，邮件正文 `[hop:N]` 透传，0 必须收尾）、一封一任务、`runner-state.json` 独立游标（不抢 org_inbox 的已读游标，Web 未读角标不受影响）、失败也回投错误摘要。每次任务 = 一次模型推理调用，daemon 不会自启，按需用命令拉起。

首发游标：默认 `--from-now`（首次启动把游标定位到当前邮件末尾，**历史未读不重放**，防止旧工单被执行两次）；要追历史未读传 `--from-now=false`。

心跳与工作台：daemon 每轮询/每 10s 任务期间把状态原子写进数据目录 `roles.json`（status=idle|busy|stopped、busy 任务 id、已完成单数、心跳时间、pid）；Web「Agent 组织 → 角色工作台」Tab 据此渲染 ◉值守中/●干活中/◌心跳失联/○未启动 + 队列数，「沟通·留痕」的邮件气泡同步显示 ⏳处理中/✓已处理/✗出错（数据源=reports.jsonl 的 `type:"run"` 留痕）。注意：改 daemon 代码后需重启对应 daemon 生效；:3080 主实例需重启才有 `/feed.roles` 字段。

## 管理界面

Web GUI → 设置 → 「Agent 组织」：

- **沟通·留痕 Tab**：主对话式聊天流——头像气泡（左右分侧、跨组织标记、状态徽标、长文折叠）、●●● 实时处理指示（任务/耗时/队列）、5s 自动刷新与智能吸底
- **角色工作台 Tab**：六角色 daemon 心跳总览（值守/干活中/失联/未启动、pid、完成单数、启动命令）
- **工作过程 Tab**：角色 headless 会话的完整执行流（思考 💭 / 工具调用 ⚙ / 结果 / 发言），主对话式渲染；数据源为 `~/.dsh/sessions/**/session.jsonl.zstd` 只读解析，busy 角色会话 5s 增量刷新可看到实时思考流
- **组织页签栏**：多组织切换、＋新建组织（自动建根节点）、重命名、删除整个组织（确认后不可撤销，至少保留一个）
- **组织架构图**：**自由画布**（xyflow 式：节点绝对定位 + 边随位置实时推导的贝塞尔），方框+连线的真实层级图
  - **拖节点到任意位置**：按住方框拖动，1:1 跟手（靠近画布边缘自动滚动），松手自动保存坐标（`movePos`，持久化到 org.json）
  - **Ctrl+滚轮缩放画布**（锚定光标）、画布右下角浮动控件 －/百分比/＋/⤢ 适应画布（滚动时钉住，xyflow Controls 式）；拖拽自动吸附 20px 网格；选中节点后 **方向键微调位置**（Shift 精细 5px）、**Delete 删除**（含确认）
  - **⇅ 一键自动排布**：按上下级层级做 tidy-tree 重排（每层一行、叶子按遍历顺序展开、父节点居中于首末子节点，坐标吸附网格后持久化，`layoutAll`）；排完自动适应画布，之后仍可继续手动微调
  - **⤓ 导出 PNG**：把当前组织的架构图（方框/三种连线/未读角标）按主题配色 2x 渲染成 PNG 本地下载，纯前端 canvas 生成，不走网络
  - **两个节点之间最多一条连线**：同类型/跨类型/反向重复均被服务端拒绝；父子节点已有实线，不能再画第二条；旧数据中的重叠边加载时自动清理（保留最先一条）
  - **⬇ 导出配置 / ⬆ 导入配置**（卡片头部按钮）：导出 = GET /org 整档 JSON 本地下载；导入 = 选文件 → 强确认 → `POST /import` **整档覆盖替换**（含全部组织、节点位置与连线）。导入复用与磁盘加载同一套迁移/normalize/validate 管线：v1 旧档自动迁移（缺根自动推断）、**节点原始 id 一律保留**（id 是 messages/reports/state/runner-state/roles 五类本机数据的外键）、`schemaVersion` 高于支持范围（1..2）一律拒收。**只搬迁组织配置，不含沟通留痕与未读/daemon 游标**——节点原始 id 是 messages.jsonl / reports.jsonl / state.json / runner-state.json / roles.json 五个文件的外键：跨实例导入后，本机同 id 的历史留痕与游标会挂到导入节点上，daemon 游标滞后会**自动重放旧消息**（headless 进程自动执行陈旧任务），超前会**静默屏蔽新消息**。**已知限制**：有历史留痕的实例导入前须先按「导入的破坏性与回退」完成干净重置（归档重置）；跨实例带留痕迁移见下一迭代「整目录打包导出/导入」（架构师预裁定：整目录替换、不做 merge）。成功响应含 `backedUp`；请求体上限 16MB、节点总数上限 2000
  - 点框选中、框内 ＋ 加下级（默认出现在父节点下方，可再拖动）、× 级联删除（含确认）、未读消息 ● 角标
  - 改上下级用右侧节点配置的「移动到…」选择器（拖拽只改位置，不改层级，语义清晰）
  - 嵌入宿主窄列时自适应：容器 <700px 自动单列折叠（@container），标题超长省略号、按钮不挤压
- **三种连线**（图下有图例）：
  - **实线 = 上下级**（汇报线）：由树结构自动画出，不可点删
  - **虚线 = 协作**：点框上的 ⇄ 按钮再点目标节点即连上（双向；画布空白/Esc 取消）
  - **点线 = 虚线下级**（带箭头，本节点=虚线上级）：点框上的 ◌ 按钮再点目标节点
  - 虚线/点线可**直接点图上的线删除**（含确认），节点配置页也有连线列表可删；删除节点时其连线级联清除
- **节点配置**页签：模型/提示词/工具策略编辑、「移动到…」换上级、该节点连线管理
- **沟通·留痕**页签：该节点收发的消息（标注 上级/下级/平级、收发方向，跨组织消息紫色边框＋来源组织标记）+ 委派登记与汇报流水

数据持久化（均可 diff / git 管理），默认在 `~/.dsh/agent-org/`（`DSH_AGENT_ORG_PATH` 可覆盖路径）；旧版单组织 `org.json` 在加载时自动迁移为 v2 多组织格式。节点画布坐标 `x/y`（0..3000）存于节点对象；旧数据缺坐标时加载自动布局（根 (60,40)，子节点在父节点下方依次排列）：

| 文件 | 内容 |
| --- | --- |
| `org.json` | 全部组织树与节点配置（schemaVersion 2，节点含画布坐标 x/y） |
| `messages.jsonl` | 节点间沟通消息（含 fromOrg/toOrg） |
| `reports.jsonl` | 委派登记 / 完成汇报留痕 |
| `state.json` | 各节点收件箱已读游标（`组织id/节点id` 复合键） |
| `runner-state.json` | 角色 daemon 已读游标（`组织id/节点id` 复合键，独立于 state.json） |

## Agent 工具

| 工具 | 作用 |
| --- | --- |
| `org_task` | **单一入口派单**：一句 `objective` 直达组织负责人——任务写入负责人收件箱（架构图 ● 角标）+ task 留痕，并返回负责人完整运行包（人设提示词/模型/工具策略/指挥链）与 how_to_run 五步派发协议；调用方据此用平台 subagent/task 起「负责人分身」执行，拆票协同由分身在提示词内用 org_* 工具完成 |
| `org_chart` | 查看全部组织树与各节点配置摘要 |
| `org_node_get` | 读取节点完整配置（含系统提示词全文、所属组织与指挥链） |
| `org_delegate` | 登记委派并返回目标角色配置（配合平台 subagent/task 派发） |
| `org_report` | 完成汇报，追加留痕 |
| `org_send` | 以某节点名义给另一节点发消息；**from/to 可跨组织** |
| `org_inbox` | 读取节点收件箱（默认未读并标记已读，`includeRead` 看全史） |
| `org_create` | 新建一个组织（自动创建根节点） |
| `org_delete` | 删除整个组织（需 `confirm:true`，至少保留一个组织） |
| `org_mutate` | **自我编排**：agent 程序化改组织结构——`add`/`update`/`move`/`delete`（子树，需 `confirm:true`）/`addEdge`/`removeEdge`/`renameOrg`/`layoutAll`，等于 Web 画布的工具版；先 `org_chart` 取 id |

## 安装

```bash
# 方式一：从 GitHub 直接安装
dsh plugin --profile web add github:wangwangwangbaojun/dsh-agent-org

# 方式二：本地 clone / link 开发安装
git clone https://github.com/wangwangwangbaojun/dsh-agent-org.git
dsh plugin --profile web add link:./dsh-agent-org
# 重启 DSH Web 服务后生效；浏览器需刷新页面（前端模块在页面加载时拉取）
```

## 安全

HTTP API（`/dsh-agent-org/v1`）仅接受回环地址或同源请求，跨站 Origin 一律 403。

**导入的破坏性与回退**：`POST /import` 一次请求整档替换 org.json，属最高危操作。每次成功导入前当前配置自动备份为 `org.json.bak.<ISO时间戳>`（权限 0600，轮转保留最近 5 份）。误导入恢复：

```bash
ls -t ~/.dsh/agent-org/org.json.bak.* | head -1          # 找最新备份
cp ~/.dsh/agent-org/org.json.bak.<最新时间戳> ~/.dsh/agent-org/org.json   # 覆盖回去即恢复（无需重启，loadOrg 每次读盘）
```

**跨实例导入（干净重置 = 归档重置）**：目标实例如有历史留痕，导入前先把 `messages.jsonl`、`reports.jsonl`、`state.json`、`runner-state.json` 四个文件**一并**移出 `~/.dsh/agent-org/` 归档（如 `agent-org.bak.<时间戳>/`；四件必须同移，只移消息文件会让游标 id 永久失配），做完干净重置再导入，避免同 id 节点继承旧游标导致重放旧消息或静默屏蔽新消息；`roles.json` 是 daemon 运行时状态（live pid/busy），心跳自愈，不必移出。

实例配置 `lockName: true` 时禁止改组织名称，该策略对 `/mutate`（setName/renameOrg）与 `/import`（同 id 改名）一致生效。落盘临界区全同步 fs、无 await，同进程内 import/mutate 天然串行；跨进程并发无锁（多实例共用同一数据文件时注意）。

## License

MIT
