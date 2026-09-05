/**
 * dsh-agent-org browser half：设置页「Agent 组织」分区（多组织版）。
 * 顶部：组织页签（切换 / ＋新建 / 重命名 / 删除）
 * 左：组织架构图（方框+连线，＋下级/×删除，未读●角标；浮动控件含缩放/适应/⇅自动排布/⤓导出PNG）
 * 右：节点配置 与 沟通·留痕（含跨组织消息标注）。纯 ESM + 宿主 React（无构建）。
 */
window.__ModuleLoader__.load({
  id: '@dsh-community/dsh-agent-org',
  factory: (require) => {
    const React = require('react');
    const h = React.createElement;
    const API = '/dsh-agent-org/v1';

    const css = `
      .dshao-root{display:flex;flex-direction:column;gap:12px;width:100%;color:var(--dsw-alias-label-primary);container-type:inline-size}
      .dshao-head{display:flex;flex-direction:column;gap:5px}
      .dshao-title{font-size:18px;line-height:26px;font-weight:600}
      .dshao-copy{max-width:720px;color:var(--dsw-alias-label-secondary);font-size:13px;line-height:20px}
      .dshao-copy code{font-family:ui-monospace,monospace;font-size:12px;background:var(--dsw-alias-bg-layer-1);padding:1px 5px;border-radius:5px}
      .dshao-orgtabs{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .dshao-orgtab{height:30px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;cursor:pointer;display:inline-flex;align-items:center;gap:6px}
      .dshao-orgtab:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dshao-orgtab[data-active=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font-weight:600;border-color:var(--dsw-alias-border-l2)}
      .dshao-orgtab .dshao-n{font-size:11px;color:var(--dsw-alias-label-caption)}
      .dshao-orgops{display:flex;align-items:center;gap:6px;margin-left:auto}
      .dshao-orgops input{height:28px;width:150px;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;background:var(--dsw-alias-bg-base);color:inherit;font:inherit;font-size:12px;padding:0 8px}
      .dshao-grid{display:grid;grid-template-columns:minmax(min(320px,100%),1fr) minmax(min(320px,100%),420px);gap:14px;align-items:start}
      @container(max-width:700px){.dshao-grid{grid-template-columns:1fr}.dshao-head-actions{gap:4px}.dshao-head-actions .dshao-action{padding:0 8px;font-size:12px}}
      .dshao-panel{border:1px solid var(--dsw-alias-border-l1);border-radius:14px;background:var(--dsw-alias-bg-layer-1);padding:12px;display:flex;flex-direction:column;gap:8px;min-width:0}
      .dshao-panel-head{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;row-gap:6px}
      .dshao-panel-title{font-size:13px;font-weight:600;color:var(--dsw-alias-label-secondary);flex:1 1 auto;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dshao-head-actions{display:flex;align-items:center;gap:6px;flex:0 1 auto;min-width:0;flex-wrap:nowrap;overflow:hidden}
      .dshao-head-actions .dshao-action{flex:0 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis}
      .dshao-mini{flex:none;width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;border:0;border-radius:6px;background:transparent;color:var(--dsw-alias-label-caption);cursor:pointer;font-size:13px;line-height:1;padding:0}
      .dshao-mini:hover{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}
      .dshao-mini[data-danger=true]:hover{color:var(--dsw-alias-state-error-primary)}
      .dshao-chart{padding:4px 0 8px}
      .dshao-canvas-wrap{position:relative}
      .dshao-canvas{position:relative;height:440px;overflow:auto;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background-color:var(--dsw-alias-bg-base)}
      .dshao-canvas-outer{position:relative}
      .dshao-canvas-inner{position:relative;width:1200px;height:800px;background-image:radial-gradient(color-mix(in srgb, var(--dsw-alias-label-caption) 25%, transparent) 1px, transparent 1px);background-size:20px 20px}
      .dshao-zoom-badge{min-width:40px;text-align:center;font-size:11px;color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums}
      .dshao-canvas-tools{position:absolute;left:10px;bottom:12px;z-index:2;display:flex;flex-direction:column;align-items:center;gap:2px;padding:4px;border:1px solid var(--dsw-alias-border-l2);border-radius:10px;background:var(--dsw-alias-bg-layer-2);box-shadow:var(--dsw-shadow-lv2)}
      .dshao-canvas[data-linking=true] .dshao-box{cursor:crosshair}
      .dshao-edges{position:absolute;left:0;top:0;width:100%;height:100%;overflow:visible;pointer-events:none}
      .dshao-edge-line[data-kind=parent]{stroke:var(--dsw-alias-border-l2);stroke-width:1.6;fill:none}
      .dshao-edge-line[data-kind=collab]{stroke:var(--dsw-alias-state-business-primary);stroke-width:1.6;stroke-dasharray:7 5;fill:none}
      .dshao-edge-line[data-kind=dotted]{stroke:#8f5fe8;stroke-width:1.8;stroke-dasharray:2 5;stroke-linecap:round;fill:none}
      .dshao-edge-hit{stroke:transparent;stroke-width:14;fill:none;pointer-events:stroke;cursor:pointer}
      .dshao-edge[data-kind=collab]:hover .dshao-edge-line,.dshao-edge[data-kind=dotted]:hover .dshao-edge-line{stroke-width:3}
      .dshao-edge-arrow{fill:#8f5fe8}
      .dshao-legend{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-size:11px;color:var(--dsw-alias-label-caption);padding:0 2px}
      .dshao-line-sample{display:inline-block;width:22px;border-top:2px solid var(--dsw-alias-border-l2);vertical-align:middle;margin-right:4px}
      .dshao-line-sample[data-kind=collab]{border-top:2px dashed var(--dsw-alias-state-business-primary)}
      .dshao-line-sample[data-kind=dotted]{border-top:2px dotted #8f5fe8}
      .dshao-legend-hint{margin-left:auto}
      .dshao-pending-hint{font-size:12px;color:#8f5fe8;border:1px dashed #8f5fe8;border-radius:8px;padding:4px 8px;background:color-mix(in srgb,#8f5fe8 8%,transparent)}
      .dshao-edges-list{display:flex;flex-direction:column;gap:4px}
      .dshao-edge-row{display:flex;align-items:center;gap:6px;font-size:12px}
      .dshao-topadd{display:flex;gap:6px;align-items:center;padding:6px;border:1px dashed var(--dsw-alias-border-l1);border-radius:9px;flex-wrap:wrap}
      .dshao-topadd input{flex:1;min-width:90px;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:4px 8px}
      .dshao-topadd select{border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:4px 6px}
      .dshao-box{position:absolute;display:flex;flex-direction:column;gap:3px;width:152px;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l1);border-radius:11px;background:var(--dsw-alias-bg-base);padding:8px 10px;cursor:grab;touch-action:none;user-select:none;transition:border-color .12s ease, box-shadow .12s ease}
      .dshao-box:hover{border-color:var(--dsw-alias-border-l2)}
      .dshao-box[data-drag=true]{cursor:grabbing;z-index:5;box-shadow:0 10px 26px color-mix(in srgb, #000 22%, transparent)}
      .dshao-box[data-selected=true]{border-color:var(--dsw-alias-state-business-primary);box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 28%, transparent)}
      .dshao-box[data-pending=true]{border-color:#8f5fe8;box-shadow:0 0 0 2px color-mix(in srgb,#8f5fe8 30%,transparent)}
      .dshao-box-top{display:flex;align-items:center;gap:5px;min-width:0}
      .dshao-box-name{font-size:13px;font-weight:600;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dshao-unread{flex:none;min-width:16px;height:16px;padding:0 4px;border-radius:8px;background:var(--dsw-alias-state-error-primary);color:#fff;font-size:10px;line-height:16px;text-align:center}
      .dshao-box-title{font-size:11px;color:var(--dsw-alias-label-caption);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dshao-badge{align-self:flex-start;font-size:10px;line-height:16px;padding:0 6px;border-radius:6px;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l1);color:var(--dsw-alias-label-secondary);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dshao-box-actions{display:flex;gap:2px;margin-top:1px}
      .dshao-tabs{display:flex;gap:6px;border-bottom:1px solid var(--dsw-alias-border-l1);padding-bottom:8px}
      .dshao-tab{border:0;background:transparent;color:var(--dsw-alias-label-secondary);font:inherit;font-size:13px;padding:4px 10px;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:5px}
      .dshao-tab:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dshao-tab[data-active=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary);font-weight:600}
      .dshao-form{display:flex;flex-direction:column;gap:10px}
      .dshao-fields{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      @media(max-width:640px){.dshao-fields{grid-template-columns:1fr}}
      .dshao-field{display:flex;flex-direction:column;gap:4px;min-width:0}
      .dshao-field[data-wide=true]{grid-column:1 / -1}
      .dshao-label{font-size:12px;color:var(--dsw-alias-label-secondary)}
      .dshao-field input,.dshao-field textarea{box-sizing:border-box;width:100%;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:6px 9px}
      .dshao-field textarea{min-height:140px;resize:vertical;font-family:ui-monospace,monospace;font-size:12px;line-height:18px}
      .dshao-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
      .dshao-action{height:32px;padding:0 12px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;cursor:pointer;white-space:nowrap;flex-shrink:0}
      .dshao-action:hover{background:var(--dsw-alias-interactive-bg-hover)}
      .dshao-action[data-primary=true]{background:var(--dsw-alias-state-business-primary);border-color:transparent;color:#fff}
      .dshao-action[data-danger=true]{color:var(--dsw-alias-state-error-primary)}
      .dshao-action:disabled{opacity:.45;cursor:default}
      .dshao-select{height:32px;border:1px solid var(--dsw-alias-border-l1);border-radius:9px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:13px;padding:0 8px}
      .dshao-status{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);min-height:18px}
      .dshao-status[data-kind=error]{color:var(--dsw-alias-state-error-primary)}
      .dshao-addbox{display:flex;gap:6px;align-items:center;padding:6px;margin-top:6px;border:1px dashed var(--dsw-alias-border-l1);border-radius:9px;max-width:320px}
      .dshao-addbox input{flex:1;min-width:0;border:1px solid var(--dsw-alias-border-l1);border-radius:7px;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:4px 8px}
      .dshao-empty{color:var(--dsw-alias-label-caption);font-size:13px;padding:8px 2px}
      .dshao-feed{display:flex;flex-direction:column;gap:6px;max-height:520px;overflow-y:auto;padding-right:2px}
      .dshao-typing{display:flex;align-items:center;gap:8px;padding:8px 10px;border:1px dashed color-mix(in srgb,currentColor 25%,transparent);border-radius:8px;opacity:.85;font-size:12px}
      .dshao-typing i{display:inline-flex;gap:3px}
      .dshao-typing i b{width:5px;height:5px;border-radius:50%;background:currentColor;animation:dshao-dot 1.2s infinite}
      .dshao-typing i b:nth-child(2){animation-delay:.2s}
      .dshao-typing i b:nth-child(3){animation-delay:.4s}
      @keyframes dshao-dot{0%,60%,100%{opacity:.25;transform:translateY(0)}30%{opacity:1;transform:translateY(-3px)}}
      .dshao-msg{display:flex;gap:8px;align-items:flex-start}
      .dshao-msg[data-out=true]{flex-direction:row-reverse}
      .dshao-avatar{flex:none;width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;color:#fff;user-select:none;box-shadow:0 1px 3px rgba(0,0,0,.18)}
      .dshao-bubble{max-width:82%;min-width:0;display:flex;flex-direction:column;gap:3px}
      .dshao-msg[data-out=true] .dshao-bubble{align-items:flex-end}
      .dshao-msg-meta{display:flex;align-items:center;gap:6px;font-size:11px;color:var(--dsw-alias-label-caption)}
      .dshao-msg-dir{font-weight:600;color:var(--dsw-alias-label-secondary)}
      .dshao-msg-text{font-size:12.5px;line-height:19px;white-space:pre-wrap;word-break:break-word;padding:8px 12px;border-radius:12px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base)}
      .dshao-msg:not([data-out=true]) .dshao-msg-text{border-top-left-radius:4px}
      .dshao-msg[data-out=true] .dshao-msg-text{border-top-right-radius:4px;border-color:color-mix(in srgb, var(--dsw-alias-state-business-primary) 40%, var(--dsw-alias-border-l1));background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 8%, var(--dsw-alias-bg-base))}
      .dshao-msg[data-cross=true] .dshao-msg-text{border-color:color-mix(in srgb, #b48cff 55%, var(--dsw-alias-border-l1))}
      .dshao-msg-text[data-collapsible=true]{max-height:120px;overflow:hidden;-webkit-mask-image:linear-gradient(#000 60%,transparent);mask-image:linear-gradient(#000 60%,transparent)}
      .dshao-bubblewrap{display:flex;flex-direction:column;gap:2px;min-width:0;max-width:100%}
      .dshao-expand{border:none;background:none;color:var(--dsw-alias-state-business-primary);font-size:11px;cursor:pointer;padding:0;text-align:left}
      .dshao-cross-tag{font-size:10px;padding:0 6px;border-radius:6px;background:color-mix(in srgb, #b48cff 18%, transparent);color:#8f5fe8;border:1px solid color-mix(in srgb, #b48cff 45%, transparent)}
      .dshao-think{border-left:3px solid color-mix(in srgb, #f5a623 60%, transparent);background:color-mix(in srgb, #f5a623 8%, transparent);border-radius:0 8px 8px 0;padding:6px 10px;font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);white-space:pre-wrap;word-break:break-word;max-height:110px;overflow:hidden;font-style:italic}
      .dshao-think[data-open=true]{max-height:none}
      .dshao-think-tag{font-size:10px;font-weight:700;color:#b0781a;font-style:normal;margin-bottom:2px}
      .dshao-tool{border:1px dashed color-mix(in srgb,currentColor 22%,transparent);border-radius:8px;padding:5px 9px;font-size:11.5px;background:color-mix(in srgb,currentColor 4%,transparent)}
      .dshao-tool summary{cursor:pointer;font-weight:600;color:var(--dsw-alias-label-secondary);list-style:none;display:flex;gap:6px;align-items:center}
      .dshao-tool pre{margin:4px 0 0;font-size:11px;max-height:260px;overflow:auto;white-space:pre-wrap;word-break:break-all;background:var(--dsw-alias-bg-base);border-radius:6px;padding:6px 8px}
      .dshao-sess{display:flex;gap:8px;align-items:center;border:1px solid var(--dsw-alias-border-l1);border-radius:8px;padding:6px 10px;cursor:pointer;font-size:12px;background:var(--dsw-alias-bg-base)}
      .dshao-sess:hover{border-color:var(--dsw-alias-state-business-primary)}
      .dshao-sess[data-live=true]{border-color:#34c77b}
      .dshao-sess[data-open=true]{background:color-mix(in srgb, var(--dsw-alias-state-business-primary) 10%, var(--dsw-alias-bg-base))}
      .dshao-proc-scroll{max-height:560px;overflow-y:auto}
      /* —— 第5 Tab「团队面板」：owner 泳道 × 拓扑分层列（§F 信息架构）—— */
      .dshao-team{display:flex;flex-direction:column;gap:8px;min-width:0}
      .dshao-team-head{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
      .dshao-team-objective{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary);max-height:36px;overflow:hidden;word-break:break-word}
      .dshao-team-stats{display:flex;align-items:center;gap:4px;flex-wrap:wrap}
      .dshao-team-chip{display:inline-flex;align-items:center;gap:4px;font-size:11px;line-height:16px;padding:0 6px;border-radius:6px;border:1px solid var(--dsw-alias-border-l1);background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-secondary);font-variant-numeric:tabular-nums}
      .dshao-team-chip i{width:7px;height:7px;border-radius:50%;background:currentColor;flex:none}
      .dshao-team-chip[data-status=pending]{color:var(--dsw-alias-label-caption)}
      .dshao-team-chip[data-status=ready]{color:var(--dsw-alias-state-business-primary)}
      .dshao-team-chip[data-status=running]{color:#c9820f}
      .dshao-team-chip[data-status=done]{color:#1f9d5c}
      .dshao-team-chip[data-status=failed]{color:var(--dsw-alias-state-error-primary)}
      .dshao-team-chip[data-status=blocked]{color:#d9541f}
      .dshao-team-scroll{overflow:auto;max-height:560px;border:1px solid var(--dsw-alias-border-l1);border-radius:12px;background:var(--dsw-alias-bg-base)}
      .dshao-team-grid{position:relative;box-sizing:border-box}
      .dshao-team-edges{position:absolute;left:0;top:0;pointer-events:none;overflow:visible}
      .dshao-team-edge{stroke:var(--dsw-alias-border-l2);stroke-width:1.4;fill:none}
      .dshao-team-arrow{fill:var(--dsw-alias-border-l2)}
      .dshao-team-lanehead{position:absolute;display:flex;align-items:center;font-size:10px;color:var(--dsw-alias-label-caption);padding-left:2px}
      .dshao-team-lane{position:absolute;display:flex;flex-direction:column;gap:1px;justify-content:center;padding:4px 6px 4px 2px;border-right:1px solid var(--dsw-alias-border-l1);box-sizing:border-box;background:var(--dsw-alias-bg-base)}
      .dshao-team-lane[data-offline=true]{opacity:.55}
      .dshao-team-lane-top{display:flex;align-items:center;gap:5px;min-width:0}
      .dshao-team-lane-name{font-size:12px;font-weight:600;color:var(--dsw-alias-label-primary);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dshao-team-lane-meta{font-size:10px;color:var(--dsw-alias-label-caption);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dshao-team-avatar{flex:none;width:22px;height:22px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;color:#fff;user-select:none}
      .dshao-team-card{position:absolute;box-sizing:border-box;display:flex;flex-direction:column;gap:2px;justify-content:center;padding:6px 8px;border:1px solid var(--dsw-alias-border-l1);border-left-width:3px;border-radius:9px;background:var(--dsw-alias-bg-layer-1);overflow:hidden}
      .dshao-team-card:hover,.dshao-team-card:focus-visible{border-color:var(--dsw-alias-border-l2);outline:none;box-shadow:0 0 0 2px color-mix(in srgb, var(--dsw-alias-state-business-primary) 22%, transparent)}
      .dshao-team-card[data-status=pending]{border-left-color:var(--dsw-alias-label-caption)}
      .dshao-team-card[data-status=ready]{border-left-color:var(--dsw-alias-state-business-primary)}
      .dshao-team-card[data-status=running]{border-left-color:#f5a623;animation:dshao-team-pulse 1.6s ease-in-out infinite}
      .dshao-team-card[data-status=done]{border-left-color:#34c77b}
      .dshao-team-card[data-status=failed]{border-left-color:var(--dsw-alias-state-error-primary)}
      .dshao-team-card[data-status=blocked]{border-left-color:#f2733c}
      @keyframes dshao-team-pulse{0%,100%{box-shadow:0 0 0 0 color-mix(in srgb,#f5a623 0%,transparent)}50%{box-shadow:0 0 0 3px color-mix(in srgb,#f5a623 35%,transparent)}}
      @media (prefers-reduced-motion:reduce){.dshao-team-card[data-status=running]{animation:none}.dshao-team-skeleton{animation:none}}
      .dshao-team-card-top{display:flex;align-items:center;gap:5px;min-width:0}
      .dshao-team-badge{flex:none;font-size:10px;line-height:15px;padding:0 5px;border-radius:5px;border:1px solid currentColor}
      .dshao-team-card[data-status=pending] .dshao-team-badge{color:var(--dsw-alias-label-caption)}
      .dshao-team-card[data-status=ready] .dshao-team-badge{color:var(--dsw-alias-state-business-primary)}
      .dshao-team-card[data-status=running] .dshao-team-badge{color:#c9820f}
      .dshao-team-card[data-status=done] .dshao-team-badge{color:#1f9d5c}
      .dshao-team-card[data-status=failed] .dshao-team-badge{color:var(--dsw-alias-state-error-primary)}
      .dshao-team-card[data-status=blocked] .dshao-team-badge{color:#d9541f}
      .dshao-team-card-id{font-family:ui-monospace,monospace;font-size:10px;color:var(--dsw-alias-label-caption);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
      .dshao-team-card-title{font-size:11.5px;line-height:15px;color:var(--dsw-alias-label-primary);overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;word-break:break-word}
      .dshao-team-card-foot{display:flex;align-items:center;gap:5px;font-size:10px;color:var(--dsw-alias-label-caption);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
      .dshao-team-err{display:flex;flex-direction:column;gap:3px;padding:8px 10px;border:1px solid var(--dsw-alias-state-error-primary);border-radius:10px;background:color-mix(in srgb, var(--dsw-alias-state-error-primary) 8%, transparent);font-size:12px;line-height:18px;color:var(--dsw-alias-state-error-primary)}
      .dshao-team-err code{font-family:ui-monospace,monospace;font-size:12px;font-weight:700;word-break:break-all}
      .dshao-team-errnote{font-size:12px;line-height:18px;color:var(--dsw-alias-label-secondary)}
      .dshao-team-loading{display:flex;flex-direction:column;gap:8px;padding:6px 2px}
      .dshao-team-skeleton{height:14px;border-radius:7px;background:linear-gradient(90deg,var(--dsw-alias-bg-layer-1) 25%,var(--dsw-alias-bg-layer-2) 50%,var(--dsw-alias-bg-layer-1) 75%);background-size:200% 100%;animation:dshao-team-shimmer 1.2s linear infinite}
      @keyframes dshao-team-shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      .dshao-team-hint{font-size:12px;line-height:18px;color:var(--dsw-alias-label-caption)}
      .dshao-team-updated{font-size:10px;color:var(--dsw-alias-label-caption);font-variant-numeric:tabular-nums}
      @container(max-width:700px){.dshao-team-lane-meta{display:none}.dshao-team-updated{display:none}}
    `;

    if (document.querySelector('style[data-plugin-css="@dsh-community/dsh-agent-org"]') === null) {
      const style = document.createElement('style');
      style.dataset.pluginCss = '@dsh-community/dsh-agent-org';
      style.textContent = css;
      document.head.appendChild(style);
    }

    async function call(suffix, body) {
      const res = await fetch(API + suffix, body === undefined
        ? { headers: { accept: 'application/json' } }
        : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json().catch(() => ({ ok: false, error: { message: `HTTP ${res.status}` } }));
      if (!res.ok || data.ok === false) throw new Error(data?.error?.message ?? `请求失败（${res.status}）`);
      return data;
    }

    function childrenMap(org) {
      const map = new Map();
      for (const node of org.nodes) {
        if (!map.has(node.parentId)) map.set(node.parentId, []);
        map.get(node.parentId).push(node);
      }
      return map;
    }

    function subtreeSet(org, id) {
      const doomed = new Set([id]);
      const kids = childrenMap(org);
      const walk = (parent) => {
        for (const child of kids.get(parent) ?? []) {
          if (doomed.add(child.id)) walk(child.id);
        }
      };
      walk(id);
      return doomed;
    }

    function csv(text) {
      return String(text ?? '').split(',').map((item) => item.trim()).filter((item) => item !== '');
    }

    function formOf(node) {
      return {
        name: node.name,
        title: node.title ?? '',
        provider: node.model?.provider ?? '',
        model: node.model?.model ?? '',
        fallback: node.model?.fallback ?? '',
        maxTokens: node.maxTokens === null || node.maxTokens === undefined ? '' : String(node.maxTokens),
        allow: (node.toolScope?.allow ?? []).join(', '),
        deny: (node.toolScope?.deny ?? []).join(', '),
        systemPrompt: node.systemPrompt ?? '',
      };
    }

    function patchOf(form) {
      return {
        name: form.name,
        title: form.title,
        model: { provider: form.provider, model: form.model, fallback: form.fallback },
        systemPrompt: form.systemPrompt,
        toolScope: { allow: csv(form.allow), deny: csv(form.deny) },
        maxTokens: form.maxTokens === '' ? null : Number(form.maxTokens),
      };
    }

    // ———— 第5 Tab「团队面板」纯渲染层（§F 信息架构 + ARCH-ADJ-3 Q1–Q5/D1 在册增量）————
    // 纯函数、零 hook、零 fetch；数据只来自 GET /team。client.js 只收 FE 渲染增量（ARCH-DEBT-01 软约束）。

    // D1-1 规格逐字（ARCH-ADJ-3 D1，钉点：抄源 lib/client.js L1289-1290 同式；三常量 60000 / ??20 / 4000 为「逐字抄」组成部分）。
    // 禁误抄 L1094 的 typing 式（90000 / ×5000）。仅供团队 Tab；null/undefined 入参 → false（=offline 灰列语义）。
    // 入参必携 intervalS（Q1 roster 透传），否则 ??20 兜底对 10/12s 轮询成员阈值虚宽。
    function beatAlive(r) {
      return r?.lastBeat != null && (Date.now() - Date.parse(r.lastBeat)) < Math.max(60000, (r.intervalS ?? 20) * 4000) && r.status !== 'stopped';
    }

    // 拓扑分层深度 = deps 最长路径（§F：pending..done 六列自然成层；环在 plan 期已拒，visiting 分支为不可达防御，前端无需环处理）。
    function depthOf(task, byId, memo = new Map(), visiting = new Set()) {
      if (memo.has(task.id)) return memo.get(task.id);
      if (visiting.has(task.id)) return 0;
      visiting.add(task.id);
      let depth = 0;
      for (const dep of task.deps ?? []) {
        const up = byId.get(dep);
        if (up === undefined) continue;
        depth = Math.max(depth, depthOf(up, byId, memo, visiting) + 1);
      }
      visiting.delete(task.id);
      memo.set(task.id, depth);
      return depth;
    }

    // 落位：owner→泳道行、depth→列；同泳道同列碰撞时右移到下一个空列（保持「deps 恒在左」不变式，泳道内零重叠）。
    function teamLayout(tasks, laneOf) {
      const list = tasks ?? [];
      const byId = new Map(list.map((task) => [task.id, task]));
      const memo = new Map();
      const cells = new Map();
      const taken = new Set();
      const ordered = list.slice().sort((a, b) => depthOf(a, byId, memo) - depthOf(b, byId, memo) || String(a.id).localeCompare(String(b.id)));
      for (const task of ordered) {
        const depth = depthOf(task, byId, memo);
        const lane = laneOf(task.owner);
        let col = depth;
        while (taken.has(`${lane}:${col}`)) col += 1;
        taken.add(`${lane}:${col}`);
        cells.set(task.id, { lane, col, depth });
      }
      const cols = cells.size === 0 ? 1 : Math.max(...Array.from(cells.values(), (c) => c.col)) + 1;
      return { cells, cols, byId };
    }

    // dispatchedAt→finishedAt 时长（§F 任务卡字段）；任一端点缺失=空串，禁臆造 0s（running 由调用侧传快照 now 现算）。
    function fmtDur(fromIso, toIso) {
      const from = fromIso === undefined || fromIso === null ? Number.NaN : Date.parse(fromIso);
      const to = toIso === undefined || toIso === null ? Number.NaN : Date.parse(toIso);
      if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return '';
      const secs = Math.round((to - from) / 1000);
      if (secs < 60) return `${secs}s`;
      const mins = Math.floor(secs / 60);
      if (mins < 60) return `${mins}m${String(secs % 60).padStart(2, '0')}s`;
      return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, '0')}m`;
    }

    const TEAM_POLL_MS = 5000;                    // §F：5s 轮询，循 mail/roles 的 useEffect+cleanup 模式，离开 Tab 停表
    const TEAM_STATUSES_UI = ['pending', 'ready', 'running', 'done', 'failed', 'blocked']; // 与 lib/team.js TEAM_STATUSES 同序同集
    const TEAM_STATUS_LABEL = { pending: '待调度', ready: '就绪', running: '执行中', done: '完成', failed: '失败', blocked: '受阻' };
    const TEAM_EMPTY_TEXT = '尚无团队立项';       // §F 空态原文（team:null 且无 error）
    const TEAM_LANE_W = 152;                      // 泳道标签列宽
    const TEAM_CARD_W = 196;
    const TEAM_CARD_H = 62;
    const TEAM_GAP_X = 26;                        // 列间距 = 依赖箭头行走区
    const TEAM_GAP_Y = 10;
    const TEAM_COL_W = TEAM_CARD_W + TEAM_GAP_X;
    const TEAM_ROW_H = TEAM_CARD_H + TEAM_GAP_Y;
    const TEAM_HEAD_H = 22;                       // 分层列标题行高

    function Field(props) {
      return h('label', { className: 'dshao-field', 'data-wide': props.wide || undefined },
        h('span', { className: 'dshao-label' }, props.label),
        props.textarea
          ? h('textarea', { value: props.value, onChange: (e) => props.onChange(e.target.value), spellcheck: false })
          : h('input', { value: props.value, onChange: (e) => props.onChange(e.target.value), placeholder: props.placeholder ?? '' }));
    }

    const KIND_LABEL = { collab: '协作（虚线）', dotted: '虚线下级（点线）' };
    const kindLabel = (kind) => KIND_LABEL[kind] ?? String(kind);

    // —— 自由画布常量（xyflow 思路：节点绝对定位 + 边由位置推导）——
    const CANVAS_W = 1200;
    const CANVAS_H = 800;
    const BOX_W = 152;
    const DEFAULT_SIZE = { w: BOX_W, h: 92 };
    const ZOOM_MIN = 0.4;
    const ZOOM_MAX = 2.5;
    const ZOOM_STEP = 1.25;
    const GRID = 20;

    /** 两点间贝塞尔：主轴水平走左右边中点，否则走上下边中点；控制点偏移 = 距离一半（夹在 32..120）。 */
    function edgePath(p1, s1, p2, s2) {
      const ax = p1.x + s1.w / 2, ay = p1.y + s1.h / 2;
      const bx = p2.x + s2.w / 2, by = p2.y + s2.h / 2;
      const dx = bx - ax, dy = by - ay;
      if (Math.abs(dx) >= Math.abs(dy)) {
        const right = dx >= 0;
        const sx = right ? p1.x + s1.w : p1.x;
        const tx = right ? p2.x : p2.x + s2.w;
        const off = Math.min(120, Math.max(32, Math.abs(dx) / 2));
        return `M ${sx} ${ay.toFixed(1)} C ${(sx + (right ? off : -off))} ${ay.toFixed(1)}, ${(tx - (right ? off : -off))} ${by.toFixed(1)}, ${tx} ${by.toFixed(1)}`;
      }
      const down = dy >= 0;
      const sy = down ? p1.y + s1.h : p1.y;
      const ty = down ? p2.y : p2.y + s2.h;
      const off = Math.min(120, Math.max(32, Math.abs(dy) / 2));
      return `M ${ax.toFixed(1)} ${sy} C ${ax.toFixed(1)} ${(sy + (down ? off : -off))}, ${bx.toFixed(1)} ${(ty - (down ? off : -off))}, ${bx.toFixed(1)} ${ty}`;
    }

    const clampPos = (n, min, max) => Math.max(min, Math.min(max, Math.round(n)));

    // —— PNG 导出辅助 ——
    /** 解析宿主主题 CSS 变量为具体颜色（隐藏探针元素取 computed color）。 */
    const cssVar = (name, fallback) => {
      const probe = document.createElement('span');
      probe.style.display = 'none';
      probe.style.color = `var(${name})`;
      document.body.appendChild(probe);
      const value = getComputedStyle(probe).color;
      probe.remove();
      return value === '' || value === undefined ? fallback : value;
    };

    const ellipsisText = (c, text, maxWidth) => {
      let out = String(text ?? '');
      if (c.measureText(out).width <= maxWidth) return out;
      while (out.length > 1 && c.measureText(`${out}…`).width > maxWidth) out = out.slice(0, -1);
      return `${out}…`;
    };

    function roundRectPath(c, x, y, w, height, r) {
      c.beginPath();
      if (typeof c.roundRect === 'function') { c.roundRect(x, y, w, height, r); return; }
      c.moveTo(x + r, y);
      c.arcTo(x + w, y, x + w, y + height, r);
      c.arcTo(x + w, y + height, x, y + height, r);
      c.arcTo(x, y + height, x, y, r);
      c.arcTo(x, y, x + w, y, r);
      c.closePath();
    }

    function OrgSettings() {
      const [doc, setDoc] = React.useState(null);
      const [path, setPath] = React.useState('');
      const [orgId, setOrgId] = React.useState(null);
      const [selected, setSelected] = React.useState(null);
      const [form, setForm] = React.useState(null);
      const [moveTo, setMoveTo] = React.useState('');
      const [adding, setAdding] = React.useState(null);
      const [addingOrg, setAddingOrg] = React.useState(null);
      const [busy, setBusy] = React.useState(false);
      const [status, setStatus] = React.useState({ kind: '', text: '' });
      const [orgName, setOrgName] = React.useState('');
      const [tab, setTab] = React.useState('config');
      const [feed, setFeed] = React.useState({ messages: [], reports: [], cursors: {}, unread: {} });
      const [pendingEdge, setPendingEdge] = React.useState(null);
      const [drag, setDrag] = React.useState(null);
      const [topAdding, setTopAdding] = React.useState(null);
      const [zoom, setZoom] = React.useState(1);
      const chartRef = React.useRef(null);
      const canvasInnerRef = React.useRef(null);
      const dragRef = React.useRef(null);
      const zoomRef = React.useRef(1);
      const zoomAnchorRef = React.useRef(null);
      const canvasRef = React.useRef(null);
      const wheelOffRef = React.useRef(null);
      const nudgeRef = React.useRef(null);
      const nudgeTimerRef = React.useRef(null);
      const fitRef = React.useRef(null);
      const fileInputRef = React.useRef(null);
      const ioRef = React.useRef(false); // 导入/导出防重入闸门（互斥并发 IO；busy 仅供按钮 disabled 展示）
      const revokeTimersRef = React.useRef([]); // 待执行的 revokeObjectURL 定时器句柄（卸载时统一清理）
      const [sizes, setSizes] = React.useState(new Map());
      const [expandedSet, setExpandedSet] = React.useState(() => new Set());
      const [sessions, setSessions] = React.useState([]);
      const [sessionsErr, setSessionsErr] = React.useState(''); // PERF-SESS-1：轮询失败可见化（旧版静默吞错=面板显空无从归因）
      const [openSession, setOpenSession] = React.useState(null); // 展开的 session dir
      const [transcript, setTranscript] = React.useState(null); // {dir, events, ...}
      // 团队面板快照：phase='loading' 首帧未到（加载态）| 'ready' | 'failed'（传输层失败且无任何快照）。
      // error=契约 error 原文（TEAM_SCHEMA_CORRUPT/TEAM_SCHEMA_TOO_NEW，Q4：error⊥team）或传输失败文案；'' = 无错。
      const [teamData, setTeamData] = React.useState({ phase: 'loading', snap: null, error: '', stale: '' });

      const org = doc === null ? undefined : (doc.orgs.find((entry) => entry.id === orgId) ?? doc.orgs[0]);
      const orgKey = org?.id;
      const rootKey = org?.rootNodeId;

      const refreshFeed = React.useCallback(async (id) => {
        try {
          setFeed(await call('/feed' + (id === null || id === undefined ? '' : '?id=' + encodeURIComponent(id))));
        } catch { /* 静默 */ }
      }, []);

      // 像主对话一样：停留在 沟通·留痕/角色工作台 时自动轮询刷新（切走即停）
      const autoIdRef = React.useRef(null);
      React.useEffect(() => {
        if (tab !== 'mail' && tab !== 'roles') return undefined;
        const tick = () => { void refreshFeed(autoIdRef.current); };
        tick();
        const timer = setInterval(tick, 5000);
        return () => clearInterval(timer);
      }, [tab, refreshFeed]);

      const load = React.useCallback(async () => {
        try {
          const data = await call('/org');
          setDoc(data.org);
          setPath(data.path);
          setOrgId((current) => (current !== null && data.org.orgs.some((entry) => entry.id === current) ? current : data.org.orgs[0].id));
          await refreshFeed(null);
        } catch (cause) {
          setStatus({ kind: 'error', text: `加载失败：${cause.message}` });
        }
      }, [refreshFeed]);

      React.useEffect(() => { load(); }, [load]);
      React.useEffect(() => {
        if (orgKey !== undefined && rootKey !== undefined) setSelected(rootKey);
      }, [orgKey, rootKey]);
      React.useEffect(() => { setOrgName(org?.name ?? ''); }, [orgKey, org?.name]);

      const node = org !== undefined && selected !== undefined && selected !== null
        ? org.nodes.find((entry) => entry.id === selected)
        : undefined;
      const nodeId = node?.id;
      const nodeName = node?.name;
      React.useEffect(() => {
        setForm(node === undefined ? null : formOf(node));
        setMoveTo('');
      }, [nodeId, nodeName]);
      React.useEffect(() => {
        autoIdRef.current = selected;
        if ((tab === 'mail' || tab === 'roles') && selected !== null) refreshFeed(selected);
      }, [tab, selected, refreshFeed]);

      // 「工作过程」页：会话列表 8s 轮询 + 打开的 transcript 5s 增量刷新（live 会话像主对话滚动）
      React.useEffect(() => {
        if (tab !== 'process') return undefined;
        const tick = async () => {
          // PERF-SESS-1：不再静默——失败写 sessionsErr 上屏；6s 超时兜底（后端已亚秒，
          // 超时=进程级异常，给用户可见降级提示而非空面板）。
          try {
            const body = await call('/sessions');
            setSessions(body.sessions ?? []);
            setSessionsErr('');
          } catch (e) {
            setSessionsErr(e?.message ?? '会话列表加载失败');
          }
          if (openSession !== null) { try { setTranscript(await call(`/session?dir=${encodeURIComponent(openSession)}`)); } catch { /* 静默 */ } }
        };
        void tick();
        const timer = setInterval(tick, openSession !== null ? 5000 : 8000);
        return () => clearInterval(timer);
      }, [tab, openSession]);

      // 「团队面板」页：5s 轮询 GET /team（恒 200、只读幂等；Q5 传输层失败是唯一抛点）。
      // 首帧未到=加载态；已有快照时轮询失败=沿用旧快照 + stale 提示（不塌成错误态、不清空泳道）。
      const refreshTeam = React.useCallback(async () => {
        try {
          const body = await call('/team');
          setTeamData({
            phase: 'ready',
            snap: body,
            error: typeof body?.error === 'string' && body.error !== '' ? body.error : '',
            stale: '',
          });
        } catch (cause) {
          setTeamData((cur) => (cur.snap === null
            ? { phase: 'failed', snap: null, error: `团队快照读取失败：${cause?.message ?? cause}`, stale: '' }
            : { ...cur, stale: `轮询失败，沿用上次快照：${cause?.message ?? cause}` }));
        }
      }, []);

      React.useEffect(() => {
        if (tab !== 'team') return undefined;
        const tick = () => { void refreshTeam(); };
        tick();
        const timer = setInterval(tick, TEAM_POLL_MS);
        return () => clearInterval(timer); // 离开 Tab 停表（同 mail/roles/process 模式）
      }, [tab, refreshTeam]);

      // 测量各节点框尺寸（边锚点需要真实高度）；位置本身是数据，不依赖测量。
      React.useLayoutEffect(() => {
        const inner = canvasInnerRef.current;
        if (inner === null || inner === undefined) return undefined;
        const measure = () => {
          const next = new Map();
          for (const box of inner.querySelectorAll('.dshao-box')) {
            const id = box.getAttribute('data-node-id');
            if (id === null || id === '') continue;
            const r = box.getBoundingClientRect();
            const z = zoomRef.current === 0 ? 1 : zoomRef.current; // rect 含画布 scale(zoom)，除回未变换尺寸供 edgePath 用
            next.set(id, { w: Math.round(r.width / z), h: Math.round(r.height / z) });
          }
          setSizes((prev) => {
            if (prev.size === next.size) {
              let same = true;
              for (const [id, s] of next) {
                const p = prev.get(id);
                if (p === undefined || p.w !== s.w || p.h !== s.h) { same = false; break; }
              }
              if (same) return prev;
            }
            return next;
          });
        };
        measure();
        let ro = null;
        try {
          ro = new ResizeObserver(measure);
          for (const box of inner.querySelectorAll('.dshao-box')) ro.observe(box);
        } catch { /* 忽略：无 ResizeObserver 时靠重渲染兜底 */ }
        return () => { if (ro !== null) ro.disconnect(); };
      }, [orgKey, (org?.nodes ?? []).length, doc]);

      // 连线待选中时 Esc 取消
      React.useEffect(() => {
        if (pendingEdge === null) return undefined;
        const onKey = (e) => { if (e.key === 'Escape') setPendingEdge(null); };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [pendingEdge]);

      // 卸载时清掉待执行的 revokeObjectURL 定时器，避免组件移除后延时句柄仍触发
      React.useEffect(() => () => {
        for (const id of revokeTimersRef.current) clearTimeout(id);
        revokeTimersRef.current = [];
      }, []);

      // —— 画布缩放：Ctrl/⌘+滚轮（锚定光标），回调 ref 挂 wheel 监听（passive:false 才能 preventDefault）——
      const attachCanvas = React.useCallback((el) => {
        canvasRef.current = el;
        if (wheelOffRef.current !== null) {
          const off = wheelOffRef.current;
          wheelOffRef.current = null;
          off();
        }
        if (el === null) return;
        const onWheel = (e) => {
          if (!e.ctrlKey && !e.metaKey) return; // 普通滚轮：照常滚动页面/画布
          e.preventDefault();
          const nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomRef.current * Math.exp(-e.deltaY * 0.0015)));
          const cr = el.getBoundingClientRect();
          const px = e.clientX - cr.left;
          const py = e.clientY - cr.top;
          zoomAnchorRef.current = { px, py, cx: (px + el.scrollLeft) / zoomRef.current, cy: (py + el.scrollTop) / zoomRef.current };
          zoomRef.current = nz;
          setZoom(nz);
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        wheelOffRef.current = () => el.removeEventListener('wheel', onWheel);
      }, []);

      // 按钮缩放：以视口中心为锚点
      const applyZoom = (nz) => {
        const el = canvasRef.current;
        if (el === null || el === undefined) return;
        const target = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, nz));
        const px = el.clientWidth / 2;
        const py = el.clientHeight / 2;
        zoomAnchorRef.current = { px, py, cx: (px + el.scrollLeft) / zoomRef.current, cy: (py + el.scrollTop) / zoomRef.current };
        zoomRef.current = target;
        setZoom(target);
      };

      // 适应画布：全部节点（含尺寸）装进视口，不放大超过 100%
      const fitView = () => {
        const el = canvasRef.current;
        if (el === null || el === undefined || org === undefined) return;
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        for (const entry of org.nodes) {
          const x = entry.x ?? 0;
          const y = entry.y ?? 0;
          const s = sizes.get(entry.id) ?? DEFAULT_SIZE;
          if (x < minX) minX = x;
          if (y < minY) minY = y;
          if (x + s.w > maxX) maxX = x + s.w;
          if (y + s.h > maxY) maxY = y + s.h;
        }
        if (!Number.isFinite(minX)) return;
        const pad = 24;
        const nz = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, Math.min(
          el.clientWidth / (maxX - minX + 2 * pad),
          el.clientHeight / (maxY - minY + 2 * pad),
          1)));
        zoomAnchorRef.current = { px: pad, py: pad, cx: minX - pad, cy: minY - pad };
        zoomRef.current = nz;
        setZoom(nz);
      };
      fitRef.current = fitView;

      // 一键自动排布：服务端按层级 tidy-tree 重排全部坐标，完成后自动适应画布
      const autoLayout = () => {
        if (org === undefined) return;
        if (!window.confirm('按上下级层级重新排布全部节点？手动拖动的位置会被覆盖。')) return;
        run('已自动排布', { op: 'layoutAll', org: org.id }).then(() => {
          if (fitRef.current !== null) fitRef.current();
        });
      };

      // 缩放后按锚点换算回滚动位置（DOM 更新后、绘制前同步应用）
      React.useLayoutEffect(() => {
        const el = canvasRef.current;
        const a = zoomAnchorRef.current;
        if (el === null || el === undefined || a === null) return;
        el.scrollLeft = a.cx * zoom - a.px;
        el.scrollTop = a.cy * zoom - a.py;
        zoomAnchorRef.current = null;
      }, [zoom]);

      const run = React.useCallback(async (label, payload, after) => {
        if (busy) return;
        setBusy(true);
        setStatus({ kind: '', text: '' });
        try {
          const data = await call('/mutate', payload);
          setDoc(data.org);
          if (after === 'org') {
            setOrgId(data.createdId ?? data.org.orgs[0].id);
          } else if (after !== 'edge' && data.createdId !== undefined) {
            setSelected(data.createdId);
          }
          setStatus({ kind: '', text: `${label} ✓` });
          await refreshFeed(null);
        } catch (cause) {
          setStatus({ kind: 'error', text: `${label}失败：${cause.message}` });
        } finally {
          setBusy(false);
          setAdding(null);
          setAddingOrg(null);
          setTopAdding(null);
        }
      }, [busy, refreshFeed]);

      const removeEdge = React.useCallback((edge) => {
        if (org === undefined) return;
        const a = org.nodes.find((n) => n.id === edge.from)?.name ?? edge.from;
        const b = org.nodes.find((n) => n.id === edge.to)?.name ?? edge.to;
        const label = edge.kind === 'collab' ? `${a} ⇄ ${b} 协作` : `${a} ⇢ ${b} 虚线下级`;
        if (!window.confirm(`删除连线：${label}？`)) return;
        run('已删除连线', { op: 'removeEdge', org: org.id, id: edge.id }, 'edge');
      }, [org, run]);

      // —— 自由拖拽（1:1 跟手，xyflow NodeDragItem 的 distance 偏移法）——
      const onBoxPointerDown = (e, entry) => {
        if (e.button !== 0) return;
        if (e.target.closest('button, input, textarea, select, a') !== null) return;
        const node = org.nodes.find((n) => n.id === entry.id);
        if (node === undefined) return;
        const canvas = e.currentTarget.closest('.dshao-canvas');
        if (canvas === null) return;
        const ox = node.x ?? 0;
        const oy = node.y ?? 0;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* 忽略 */ }
        const cr = canvas.getBoundingClientRect();
        dragRef.current = {
          id: entry.id,
          canvas,
          sx: e.clientX, sy: e.clientY,
          offX: ((e.clientX - cr.left) + canvas.scrollLeft) / zoomRef.current - ox,
          offY: ((e.clientY - cr.top) + canvas.scrollTop) / zoomRef.current - oy,
          moved: false,
          x: ox, y: oy,
        };
      };
      const onBoxPointerMove = (e) => {
        const d = dragRef.current;
        if (d === null) return;
        if (!d.moved && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) < 3) return;
        d.moved = true;
        const canvas = d.canvas;
        const cr = canvas.getBoundingClientRect();
        if (e.clientX - cr.left < 36) canvas.scrollLeft = Math.max(0, canvas.scrollLeft - 14);
        else if (cr.right - e.clientX < 36) canvas.scrollLeft = Math.min(CANVAS_W * zoomRef.current, canvas.scrollLeft + 14);
        if (e.clientY - cr.top < 36) canvas.scrollTop = Math.max(0, canvas.scrollTop - 14);
        else if (cr.bottom - e.clientY < 36) canvas.scrollTop = Math.min(CANVAS_H * zoomRef.current, canvas.scrollTop + 14);
        // 屏幕位移 → 未变换坐标（÷zoom）→ 减抓取点偏移 → 吸附 20px 网格
        const vx = ((e.clientX - cr.left) + canvas.scrollLeft) / zoomRef.current - d.offX;
        const vy = ((e.clientY - cr.top) + canvas.scrollTop) / zoomRef.current - d.offY;
        const x = clampPos(Math.round(vx / GRID) * GRID, 0, CANVAS_W - BOX_W);
        const y = clampPos(Math.round(vy / GRID) * GRID, 0, CANVAS_H - 80);
        if (x !== d.x || y !== d.y) {
          d.x = x;
          d.y = y;
          setDrag({ id: d.id, x, y });
        }
      };
      const onBoxPointerUp = (e) => {
        const d = dragRef.current;
        dragRef.current = null;
        if (d === null) return;
        try { e.currentTarget.releasePointerCapture(e.pointerId); } catch { /* 忽略 */ }
        if (!d.moved) {
          if (pendingEdge !== null) {
            if (pendingEdge.fromId === d.id) { setPendingEdge(null); return; }
            const fromId = pendingEdge.fromId;
            const kind = pendingEdge.kind;
            setPendingEdge(null);
            run(`已添加连线 ${kindLabel(kind)}`, { op: 'addEdge', org: org.id, from: fromId, to: d.id, kind }, 'edge');
            return;
          }
          setSelected(d.id);
          return;
        }
        setDrag(null);
        run('位置已保存', { op: 'movePos', org: org.id, id: d.id, x: d.x, y: d.y }, 'move');
      };
      const onBoxPointerCancel = () => {
        dragRef.current = null;
        setDrag(null);
      };

      // 键盘：方向键微调选中节点（默认一格=GRID，Shift=5px 精细；连按基于 drag 累计，停手 260ms 后提交保存）；
      // Delete/Backspace 删除选中节点（根节点忽略，含下级需确认，与 × 按钮同款）。
      React.useEffect(() => {
        if (org === undefined || selected === null) return undefined;
        const onKey = (e) => {
          const t = e.target;
          const tag = typeof t?.tagName === 'string' ? t.tagName.toUpperCase() : '';
          if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable === true) return;
          const entry = org.nodes.find((n) => n.id === selected);
          if (entry === undefined) return;
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            const step = e.shiftKey ? 5 : GRID;
            const base = drag !== null && drag.id === selected ? drag : { x: entry.x ?? 0, y: entry.y ?? 0 };
            const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
            const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
            const nx = clampPos(base.x + dx, 0, CANVAS_W - BOX_W);
            const ny = clampPos(base.y + dy, 0, CANVAS_H - 80);
            e.preventDefault();
            setDrag({ id: selected, x: nx, y: ny });
            nudgeRef.current = { id: selected, x: nx, y: ny };
            if (nudgeTimerRef.current !== null) clearTimeout(nudgeTimerRef.current);
            nudgeTimerRef.current = setTimeout(() => {
              const nudge = nudgeRef.current;
              nudgeTimerRef.current = null;
              if (nudge === null) return;
              nudgeRef.current = null;
              run('位置已保存', { op: 'movePos', org: org.id, id: nudge.id, x: nudge.x, y: nudge.y }, 'move')
                .then(() => { setDrag(null); });
            }, 260);
            return;
          }
          if (e.key === 'Delete' || e.key === 'Backspace') {
            if (selected === org.rootNodeId) return;
            e.preventDefault();
            const name = entry.name;
            const count = subtreeSet(org, selected).size;
            if (window.confirm(`删除「${name}」及其 ${count - 1} 个下级节点？`)) run(`已删除 ${name}`, { op: 'delete', org: org.id, id: selected });
          }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
      }, [org, selected, drag, run]);

      // 留痕面板自动滚到最新一条（像主对话；用户手动上滚查看历史时不打扰）
      const feedEndRef = React.useRef(null);
      const feedScrollRef = React.useRef(null);
      React.useEffect(() => {
        const el = feedScrollRef.current;
        if (el === null) return;
        const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 120;
        if (nearBottom) feedEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }, [feed]);

      if (doc === null) return h('div', { className: 'dshao-root' }, h('div', { className: 'dshao-empty' }, '加载组织数据…'));
      if (org === undefined) return h('div', { className: 'dshao-root' }, h('div', { className: 'dshao-empty' }, '组织数据为空'));

      const rootNode = org.nodes.find((entry) => entry.id === org.rootNodeId);
      const isRoot = node !== undefined && node.parentId === null;
      const totalUnread = Object.values(feed.unread ?? {}).reduce((sum, n) => sum + n, 0);
      const unreadHere = node === undefined ? 0 : (feed.unread?.[`${org.id}/${node.id}`] ?? 0);
      const boxUnread = (id) => feed.unread?.[`${org.id}/${id}`] ?? 0;
      const orgNameById = (id) => doc.orgs.find((entry) => entry.id === id)?.name ?? id;
      const moveCandidates = node === undefined ? [] : org.nodes
        .filter((entry) => !subtreeSet(org, node.id).has(entry.id))
        .map((entry) => h('option', { key: entry.id, value: entry.id }, `${entry.name}${entry.title !== '' ? `（${entry.title}）` : ''}`));
      const nodeEdges = node === undefined ? [] : (org.edges ?? []).filter((edge) => edge.from === node.id || edge.to === node.id);

      const boxView = (entry) => {
        const unread = boxUnread(entry.id);
        const dragging = drag !== null && drag.id === entry.id;
        const pos = dragging ? { x: drag.x, y: drag.y } : { x: entry.x ?? 0, y: entry.y ?? 0 };
        return h('div', {
          key: entry.id,
          className: 'dshao-box',
          'data-node-id': entry.id,
          'data-selected': selected === entry.id || undefined,
          'data-pending': pendingEdge !== null && pendingEdge.fromId === entry.id || undefined,
          'data-drag': dragging || undefined,
          style: { left: pos.x, top: pos.y },
          onPointerDown: (e) => onBoxPointerDown(e, entry),
          onPointerMove: onBoxPointerMove,
          onPointerUp: onBoxPointerUp,
          onPointerCancel: onBoxPointerCancel,
        },
          h('div', { className: 'dshao-box-top' },
            h('span', { className: 'dshao-box-name' }, entry.name),
            unread > 0 ? h('span', { className: 'dshao-unread' }, String(unread)) : null),
          entry.title !== '' ? h('div', { className: 'dshao-box-title' }, entry.title) : null,
          entry.model?.model !== undefined
            ? h('span', { className: 'dshao-badge' }, `${entry.model.provider !== undefined ? `${entry.model.provider}/` : ''}${entry.model.model}`)
            : null,
          h('div', { className: 'dshao-box-actions' },
            h('button', {
              className: 'dshao-mini', title: '新增下级（出现在本节点下方，可再拖动）', disabled: busy,
              onClick: (e) => { e.stopPropagation(); setAdding({ parentId: entry.id, name: '', title: '' }); },
            }, '＋'),
            h('button', {
              className: 'dshao-mini', title: '连协作虚线：点击后再点目标节点（Esc 取消）', disabled: busy,
              onClick: (e) => { e.stopPropagation(); setPendingEdge({ fromId: entry.id, kind: 'collab' }); },
            }, '⇄'),
            h('button', {
              className: 'dshao-mini', title: '连虚线下级点线（本节点=虚线上级）：点击后再点目标节点', disabled: busy,
              onClick: (e) => { e.stopPropagation(); setPendingEdge({ fromId: entry.id, kind: 'dotted' }); },
            }, '◌'),
            entry.parentId !== null
              ? h('button', {
                className: 'dshao-mini', 'data-danger': 'true', title: '删除（含下级）', disabled: busy,
                onClick: (e) => {
                  e.stopPropagation();
                  const count = subtreeSet(org, entry.id).size;
                  if (window.confirm(`删除「${entry.name}」及其 ${count - 1} 个下级节点？`)) run(`已删除 ${entry.name}`, { op: 'delete', id: entry.id, org: org.id });
                },
              }, '×')
              : null),
          adding !== null && adding.parentId === entry.id
            ? h('div', { className: 'dshao-addbox', onPointerDown: (e) => e.stopPropagation(), onClick: (e) => e.stopPropagation() },
              h('input', { placeholder: '名称', autoFocus: true, value: adding.name, onChange: (e) => setAdding({ ...adding, name: e.target.value }) }),
              h('input', { placeholder: '职位', value: adding.title, onChange: (e) => setAdding({ ...adding, title: e.target.value }) }),
              h('button', {
                className: 'dshao-action', 'data-primary': 'true', disabled: busy || adding.name.trim() === '',
                onClick: () => run('已新增节点', { op: 'add', org: org.id, parentId: adding.parentId, name: adding.name, title: adding.title }),
              }, '确定'),
              h('button', { className: 'dshao-action', onClick: () => setAdding(null) }, '取消'))
            : null);
      };

      // 边 = 上下级（树关系，实线）+ 协作/虚线下级（存储边）；全部由位置推导，拖拽时实时跟随
      const nodeById = new Map(org.nodes.map((entry) => [entry.id, entry]));
      const posOf = (id) => {
        const entry = nodeById.get(id);
        if (entry === undefined) return undefined;
        return drag !== null && drag.id === id ? { x: drag.x, y: drag.y } : { x: entry.x ?? 0, y: entry.y ?? 0 };
      };
      const sizeOf = (id) => sizes.get(id) ?? DEFAULT_SIZE;
      const edgeList = [];
      for (const entry of org.nodes) {
        if (entry.parentId === null) continue;
        const from = posOf(entry.parentId);
        const to = posOf(entry.id);
        if (from === undefined || to === undefined) continue;
        edgeList.push({ key: `parent-${entry.id}`, kind: 'parent', edge: undefined, d: edgePath(from, sizeOf(entry.parentId), to, sizeOf(entry.id)) });
      }
      for (const edge of org.edges ?? []) {
        const from = posOf(edge.from);
        const to = posOf(edge.to);
        if (from === undefined || to === undefined) continue;
        edgeList.push({ key: edge.id, kind: edge.kind, edge, d: edgePath(from, sizeOf(edge.from), to, sizeOf(edge.to)) });
      }

      // —— 导出 PNG：canvas 2x 复刻当前组织（方框/连线/未读角标），前端本地生成，无需后端 ——
      const exportPng = () => {
        try {
          const pad = 36;
          let minX = Infinity;
          let minY = Infinity;
          let maxX = -Infinity;
          let maxY = -Infinity;
          for (const entry of org.nodes) {
            const x = entry.x ?? 0;
            const y = entry.y ?? 0;
            const s = sizeOf(entry.id);
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x + s.w > maxX) maxX = x + s.w;
            if (y + s.h > maxY) maxY = y + s.h;
          }
          if (!Number.isFinite(minX)) return;
          const scale = 2;
          const el = document.createElement('canvas');
          el.width = Math.ceil((maxX - minX + 2 * pad) * scale);
          el.height = Math.ceil((maxY - minY + 2 * pad) * scale);
          const c = el.getContext('2d');
          if (c === null) throw new Error('浏览器不支持 canvas');
          c.scale(scale, scale);
          c.translate(pad - minX, pad - minY);
          const color = {
            bg: cssVar('--dsw-alias-bg-base', '#ffffff'),
            border: cssVar('--dsw-alias-border-l1', '#c9c9c9'),
            line: cssVar('--dsw-alias-border-l2', '#a3a3a3'),
            collab: cssVar('--dsw-alias-state-business-primary', '#3b82f6'),
            primary: cssVar('--dsw-alias-label-primary', '#222222'),
            caption: cssVar('--dsw-alias-label-caption', '#8a8a8a'),
            unread: cssVar('--dsw-alias-state-error-primary', '#e5484d'),
            dotted: '#8f5fe8',
          };
          c.fillStyle = color.bg;
          c.fillRect(minX - pad, minY - pad, el.width / scale, el.height / scale);
          // 连线：复用渲染期同一条贝塞尔（M + C 共 8 个数字），配色/虚线与 SVG 同款
          for (const item of edgeList) {
            const nums = (item.d.match(/-?\d+(?:\.\d+)?/g) ?? []).map(Number);
            if (nums.length < 8) continue;
            c.save();
            c.strokeStyle = item.kind === 'parent' ? color.line : item.kind === 'collab' ? color.collab : color.dotted;
            c.lineWidth = item.kind === 'dotted' ? 1.8 : 1.6;
            if (item.kind === 'collab') c.setLineDash([7, 5]);
            else if (item.kind === 'dotted') { c.setLineDash([2, 5]); c.lineCap = 'round'; }
            c.beginPath();
            c.moveTo(nums[0], nums[1]);
            c.bezierCurveTo(nums[2], nums[3], nums[4], nums[5], nums[6], nums[7]);
            c.stroke();
            if (item.kind === 'dotted') {
              const angle = Math.atan2(nums[7] - nums[5], nums[6] - nums[4]);
              c.setLineDash([]);
              c.fillStyle = color.dotted;
              c.beginPath();
              c.moveTo(nums[6], nums[7]);
              c.lineTo(nums[6] - 9 * Math.cos(angle - 0.4), nums[7] - 9 * Math.sin(angle - 0.4));
              c.lineTo(nums[6] - 9 * Math.cos(angle + 0.4), nums[7] - 9 * Math.sin(angle + 0.4));
              c.closePath();
              c.fill();
            }
            c.restore();
          }
          // 节点方框：名称 / 职位 / 模型徽章 / 未读角标（动作按钮不进导出图）
          for (const entry of org.nodes) {
            const pos = posOf(entry.id) ?? { x: entry.x ?? 0, y: entry.y ?? 0 };
            const s = sizeOf(entry.id);
            const unread = boxUnread(entry.id);
            c.save();
            roundRectPath(c, pos.x, pos.y, s.w, s.h, 11);
            c.fillStyle = color.bg;
            c.fill();
            c.strokeStyle = color.border;
            c.lineWidth = 1;
            c.stroke();
            c.textBaseline = 'top';
            c.fillStyle = color.primary;
            c.font = '600 13px system-ui, sans-serif';
            c.fillText(ellipsisText(c, entry.name, s.w - 20 - (unread > 0 ? 24 : 0)), pos.x + 10, pos.y + 9);
            if (unread > 0) {
              const badgeW = Math.max(16, String(unread).length * 7 + 8);
              roundRectPath(c, pos.x + s.w - 10 - badgeW, pos.y + 8, badgeW, 16, 8);
              c.fillStyle = color.unread;
              c.fill();
              c.fillStyle = '#ffffff';
              c.font = '10px system-ui, sans-serif';
              c.textAlign = 'center';
              c.fillText(String(unread), pos.x + s.w - 10 - badgeW / 2, pos.y + 11);
              c.textAlign = 'left';
            }
            if (entry.title !== '') {
              c.fillStyle = color.caption;
              c.font = '11px system-ui, sans-serif';
              c.fillText(ellipsisText(c, entry.title, s.w - 20), pos.x + 10, pos.y + 28);
            }
            if (entry.model?.model !== undefined) {
              c.fillStyle = color.caption;
              c.font = '10px system-ui, sans-serif';
              const badge = `${entry.model.provider !== undefined ? `${entry.model.provider}/` : ''}${entry.model.model}`;
              c.fillText(ellipsisText(c, badge, s.w - 20), pos.x + 10, pos.y + 45);
            }
            c.restore();
          }
          el.toBlob((blob) => {
            if (blob === null) {
              setStatus({ kind: 'error', text: '导出失败：canvas 无法生成图片' });
              return;
            }
            const fileName = `agent-org-${org.id}-${new Date().toISOString().slice(0, 10)}.png`;
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            a.remove();
            revokeTimersRef.current.push(setTimeout(() => URL.revokeObjectURL(url), 4000));
            setStatus({ kind: '', text: `已导出 ${fileName} ✓` });
          }, 'image/png');
        } catch (cause) {
          setStatus({ kind: 'error', text: `导出失败：${cause.message}` });
        }
      };

      // —— 配置导出 / 导入（全量 doc JSON，跨实例搬迁用）——
      // 导出：GET /org 拿磁盘上的完整 doc，本地 JSON.stringify 成 Blob 下载（与 PNG 同路，无后端参与）。
      // 导入：选中 JSON → 解析 → 大小/形状/版本预检 → 强确认 → POST /import（后端整单校验通过后先备份原配置（org.json.bak.* 轮转 5 份；此前无配置文件则不生成备份）再原子替换）。
      const docCounts = (value) => {
        const list = Array.isArray(value?.orgs) ? value.orgs : [];
        return `${list.length} 个组织 / ${list.reduce((sum, entry) => sum + (Array.isArray(entry?.nodes) ? entry.nodes.length : 0), 0)} 个节点`;
      };

      const exportJson = async () => {
        if (ioRef.current) return;
        ioRef.current = true;
        setBusy(true);
        setStatus({ kind: '', text: '' });
        try {
          const data = await call('/org');
          if (data?.org === undefined || data.org === null) throw new Error('响应缺少 org 字段');
          const fileName = `agent-org-导出-${new Date().toISOString().slice(0, 10)}.json`;
          const blob = new Blob([JSON.stringify(data.org, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = fileName;
          document.body.appendChild(a);
          a.click();
          a.remove();
          revokeTimersRef.current.push(setTimeout(() => URL.revokeObjectURL(url), 4000));
          setStatus({ kind: '', text: `已导出 ${fileName} ✓（${docCounts(data.org)}）` });
        } catch (cause) {
          setStatus({ kind: 'error', text: `导出配置失败：${cause.message}` });
        } finally {
          ioRef.current = false;
          setBusy(false);
        }
      };

      const importJson = () => {
        if (busy) return;
        const input = fileInputRef.current;
        if (input === null || input === undefined) return;
        input.value = ''; // 复位：连续导入同一个文件也能再次触发 change
        input.click();
      };

      const onImportFile = async (e) => {
        if (ioRef.current) return;
        ioRef.current = true;
        try {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file === undefined || file === null) return;
          // 前端预检大小：后端对过大文件返回 413，这里先行拦下，省一次无谓往返
          if (file.size > 16 * 1024 * 1024) {
            setStatus({ kind: 'error', text: '导入失败：文件超过 16MB 上限' });
            return;
          }
          let text = '';
          try {
            text = await file.text();
          } catch (cause) {
            setStatus({ kind: 'error', text: `导入失败：读取「${file.name}」失败（${cause.message}）` });
            return;
          }
          let payload;
          try {
            payload = JSON.parse(text);
          } catch (cause) {
            setStatus({ kind: 'error', text: `导入失败：「${file.name}」不是合法 JSON（${cause.message}）` });
            return;
          }
          if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) {
            setStatus({ kind: 'error', text: '导入失败：文件内容不是组织配置对象（应为 org.json 的完整内容）' });
            return;
          }
          // 形状预检：v2 为 { orgs: [...] }；v1 旧版单组织为 { schemaVersion: 1, organization, nodes }（后端两者都收）。
          // 两种形态都不像的，/import 必然整单校验失败，别浪费一次确认弹窗。
          const isV2 = Array.isArray(payload.orgs);
          const isV1 = payload.schemaVersion === 1
            && typeof payload.organization === 'object' && payload.organization !== null
            && Array.isArray(payload.nodes);
          if (!isV2 && !isV1) {
            setStatus({ kind: 'error', text: '导入失败：文件不像组织配置（应含 orgs 数组）' });
            return;
          }
          // 版本早退：数字且明确高于支持范围时，后端 prepareDoc 必 400 拒收，这里先行挡下，
          // 避免先弹"覆盖导入"强确认、用户点完才被后端打回的假承诺。
          // 其余畸形形态交给后端权威判定——prepareDoc 是唯一权威，前端仅做体验层（双防线）。
          const sv = payload.schemaVersion;
          if (typeof sv === 'number' && sv > 2) { // 与 lib/org.js SCHEMA_VERSION 同步
            setStatus({ kind: 'error', text: `导入失败：文件 schemaVersion ${sv} 高于本插件支持范围，请先升级插件` });
            return;
          }
          if (!window.confirm('覆盖导入将替换全部组织（含节点位置与连线），只搬迁组织配置，不含沟通留痕与未读/daemon 游标；原有配置将先自动备份（org.json.bak.* 轮转 5 份）。本机历史消息与留痕会按节点 id 挂到导入的同 id 节点上，daemon 可能重放陈旧任务或屏蔽新消息；有历史留痕的实例请先按 README「导入的破坏性与回退」做归档重置。继续？')) {
            setStatus({ kind: '', text: '已取消导入，未做任何修改' });
            return;
          }
          setBusy(true);
          setStatus({ kind: '', text: '' });
          try {
            const res = await fetch(API + '/import', {
              method: 'POST',
              headers: { 'content-type': 'application/json', accept: 'application/json' },
              body: JSON.stringify(payload),
            });
            const data = await res.json().catch(() => null);
            // 旧实例（尚未加载新半区）：404 与非 JSON 响应分开报，各自给出可执行的下一步，不抛未捕获异常
            if (res.status === 404) {
              setStatus({ kind: 'error', text: '导入端点不可用：可能需重启 dsh web 后生效' });
              return;
            }
            if (data === null) {
              setStatus({ kind: 'error', text: '导入失败：响应不是 JSON（可能被代理或旧实例拦截）' });
              return;
            }
            if (!res.ok || data.ok === false) {
              setStatus({ kind: 'error', text: `导入失败：${data?.error?.message ?? `请求失败（${res.status}）`}` });
              return;
            }
            const orgs = Array.isArray(data.org?.orgs) ? data.org.orgs : [];
            if (orgs.length === 0) {
              setStatus({ kind: 'error', text: '导入失败：后端返回的组织数据为空，界面保持原状' });
              return;
            }
            setDoc(data.org);
            const keepId = orgId !== null && orgs.some((entry) => entry.id === orgId) ? orgId : orgs[0].id;
            setOrgId(keepId);
            setSelected(orgs.find((entry) => entry.id === keepId)?.rootNodeId ?? null);
            setAdding(null);
            setAddingOrg(null);
            setTopAdding(null);
            await refreshFeed(null);
            setStatus({ kind: '', text: `已导入 ${file.name} ✓（${docCounts(data.org)}，${data.backedUp === true ? '原配置已备份（org.json.bak.* 轮转 5 份）' : '此前无配置文件，未生成备份'}）` });
          } catch (cause) {
            setStatus({ kind: 'error', text: `导入失败：${cause.message}` });
          } finally {
            setBusy(false);
          }
        } finally {
          ioRef.current = false;
        }
      };

      const relationship = (message, out) => {
        if (node === undefined) return '';
        const cross = message.fromOrg !== message.toOrg && message.fromOrg !== undefined && message.toOrg !== undefined;
        if (cross) return '·跨组织';
        const otherId = out ? message.to : message.from;
        if (out) return otherId === node.parentId ? '·上级' : ((org.nodes.find((entry) => entry.id === otherId)?.parentId === node.id) ? '·下级' : '·平级');
        return otherId === node.parentId ? '·上级' : ((org.nodes.find((entry) => entry.id === otherId)?.parentId === node.id) ? '·下级' : '·平级');
      };

      // 任务状态表：daemon 的开工/完工留痕（type=run）映射到邮件气泡——像主对话一样看到 处理中/已处理
      const taskState = {};
      for (const report of feed.reports ?? []) {
        if (report.type !== 'run' || !report.taskId) continue;
        taskState[report.taskId] = report.action === 'start' ? 'run' : report.ok === false ? 'err' : 'done';
      }
      const stateBadge = (message) => {
        let state = taskState[message.id] ?? null;
        const toRole = (feed.roles ?? {})[`${message.toOrg ?? org.id}/${message.to}`];
        const toAlive = toRole?.lastBeat && Date.now() - Date.parse(toRole.lastBeat) < Math.max(60000, (toRole.intervalS ?? 20) * 4000) && toRole.status !== 'stopped';
        if (toAlive && toRole.busy === message.id) state = 'run';
        if (state === null) {
          if ((feed.unread?.[`${message.toOrg ?? org.id}/${message.to}`] ?? 0) > 0 && toAlive) return h('span', { className: 'dshao-cross-tag', title: '对方值守中，排队待处理' }, '◌ 排队');
          return null;
        }
        if (state === 'run') return h('span', { className: 'dshao-cross-tag', title: '角色进程执行中' }, '⏳ 处理中');
        return state === 'err'
          ? h('span', { className: 'dshao-cross-tag' }, '✗ 出错')
          : h('span', { className: 'dshao-unread', title: '角色已处理并回件' }, '✓ 已处理');
      };

      // 主对话式气泡：按人名哈希取色的圆形头像 + 左右分布 + 长文折叠（展开态提到顶层，map 内零 hook）
      const avatarColor = (key) => { const palette = ['#4f8cff', '#34c77b', '#f5a623', '#e8618c', '#8f5fe8', '#17b3c4', '#f2733c', '#6b7a99']; let x = 0; for (const ch of String(key)) x = (x * 31 + ch.codePointAt(0)) % 997; return palette[x % palette.length]; };
      const avatarOf = (name) => h('div', { className: 'dshao-avatar', style: { background: avatarColor(name) } }, (name ?? '?').slice(0, 1));
      const Collapsible = (text, key) => {
        const long = (text ?? '').length > 320 || (text ?? '').split('\n').length > 7;
        const open = expandedSet.has(key);
        return h('div', { className: 'dshao-bubblewrap' },
          h('div', { className: 'dshao-msg-text', 'data-collapsible': long && !open ? 'true' : undefined }, text),
          long ? h('button', { className: 'dshao-expand', onClick: () => setExpandedSet((s) => { const n = new Set(s); if (n.has(key)) { n.delete(key); } else { n.add(key); } return n; }) }, open ? '收起 ▲' : '展开全文 ▼') : null);
      };

      const feedView = h('div', { className: 'dshao-feed', ref: feedScrollRef },
        feed.messages.length === 0 && feed.reports.length === 0
          ? h('div', { className: 'dshao-empty' }, '暂无沟通与留痕。对话里让 agent 用 org_send（可跨组织）/ org_report，消息就会出现在这里。')
          : null,
        feed.messages.map((message) => {
          const out = node !== undefined && message.from === node.id;
          const cross = message.fromOrg !== message.toOrg && message.fromOrg !== undefined && message.toOrg !== undefined;
          const fromName = message.fromName ?? (message.from === 'external' ? '外部' : message.from);
          const toName = message.toName ?? message.to;
          const peer = out ? toName : fromName;
          return h('div', { key: message.id, className: 'dshao-msg', 'data-out': out || undefined, 'data-cross': cross || undefined },
            avatarOf(fromName),
            h('div', { className: 'dshao-bubble' },
              h('div', { className: 'dshao-msg-meta' },
                h('span', { className: 'dshao-msg-dir' }, out ? `${fromName} → ${peer}` : fromName),
                cross ? h('span', { className: 'dshao-cross-tag' }, '跨组织') : null,
                stateBadge(message),
                h('span', null, (message.ts ?? '').slice(5, 16).replace('T', ' '))),
              Collapsible(message.content, message.id)));
        }),
        feed.reports.slice().reverse().map((report, index) => h('div', { key: `r${index}`, className: 'dshao-msg' },
          h('div', { className: 'dshao-avatar', style: { background: '#6b7a99', fontSize: 14 } }, report.type === 'delegate' ? '⤓' : report.type === 'task' ? '◉' : report.type === 'run' ? '⚙' : '↑'),
          h('div', { className: 'dshao-bubble' },
            h('div', { className: 'dshao-msg-meta' },
              h('span', { className: 'dshao-msg-dir' }, report.type === 'delegate' ? '委派登记' : report.type === 'task' ? '派单任务' : report.type === 'run' ? (report.action === 'start' ? '角色开工' : report.ok === false ? '角色出错' : '角色完工') : '汇报'),
              h('span', null, (report.ts ?? '').slice(5, 16).replace('T', ' '))),
            Collapsible(report.summary ?? report.task ?? '', `rep${index}:${(report.ts ?? '').slice(0, 19)}`)))),
        (() => {
          // 像主对话的「正在输入」：选中节点的 daemon 干活中 → 三点动画 + 已处理时长；值守中 → 等待提示
          if (node === undefined) return null;
          const role = (feed.roles ?? {})[`${org.id}/${node.id}`];
          const beatMs = role?.lastBeat ? Date.now() - Date.parse(role.lastBeat) : null;
          const alive = beatMs !== null && beatMs < Math.max(90000, (role.intervalS ?? 20) * 5000) && role.status !== 'stopped';
          if (!alive) return h('div', { className: 'dshao-typing' }, '○ 该角色 daemon 未在值守（启动：dsh-agent-org-role ', h('code', null, node.id), '）');
          if (role.status === 'busy' && role.busy) {
            const start = (feed.reports ?? []).find((r) => r.type === 'run' && r.taskId === role.busy && r.action === 'start');
            const secs = start?.ts ? Math.round((Date.now() - Date.parse(start.ts)) / 1000) : null;
            return h('div', { className: 'dshao-typing' },
              h('i', null, h('b', null), h('b', null), h('b', null)),
              `${node.name} 正在处理 ${role.busy}${secs !== null ? `（已 ${secs}s）` : ''}…`,
              (feed.unread?.[`${org.id}/${node.id}`] ?? 0) > 0 ? ` · 队列还有 ${feed.unread[`${org.id}/${node.id}`]} 封` : '');
          }
          return (feed.unread?.[`${org.id}/${node.id}`] ?? 0) > 0
            ? h('div', { className: 'dshao-typing' }, h('i', null, h('b', null), h('b', null), h('b', null)), `${node.name} 值守中，队列 ${feed.unread[`${org.id}/${node.id}`]} 封待处理`)
            : h('div', { className: 'dshao-typing' }, `◉ ${node.name} 值守中，等待来信（轮询 ${role.intervalS ?? '?'}s）`);
        })(),
        h('div', { ref: feedEndRef }));

      // 「工作过程」：角色 headless 会话执行流（思考/工具/输出，主对话式渲染）
      const toggleKey = (key) => setExpandedSet((s) => { const n = new Set(s); if (n.has(key)) { n.delete(key); } else { n.add(key); } return n; });
      const renderEvent = (ev, i) => {
        const key = `tr${openSession ?? ''}:${i}`;
        const open = expandedSet.has(key);
        if (ev.kind === 'user') {
          return h('div', { key, className: 'dshao-msg' },
            h('div', { className: 'dshao-avatar', style: { background: '#e8618c' } }, '票'),
            h('div', { className: 'dshao-bubble' },
              h('div', { className: 'dshao-msg-meta' }, h('span', { className: 'dshao-msg-dir' }, '任务来信')),
              Collapsible(ev.text, key)));
        }
        if (ev.kind === 'reasoning' || ev.kind === 'reasoning-live') {
          return h('div', { key, className: 'dshao-msg' },
            h('div', { className: 'dshao-avatar', style: { background: '#f5a623' } }, '💭'),
            h('div', { className: 'dshao-bubble', style: { flex: 1 } },
              h('div', { className: 'dshao-think', 'data-open': open || undefined, onClick: () => toggleKey(key) },
                h('div', { className: 'dshao-think-tag' }, ev.kind === 'reasoning-live' ? '💭 正在思考…（点击展开/收起）' : '💭 思考（点击展开/收起）'),
                ev.text)));
        }
        if (ev.kind === 'tool' || ev.kind === 'tool-live') {
          return h('details', { key, className: 'dshao-tool' },
            h('summary', null, '⚙ ', ev.name ?? 'tool', ' ', h('span', { style: { opacity: .6, fontWeight: 400 } }, String(ev.args ?? '').slice(0, 80))),
            h('pre', null, String(ev.args ?? '')));
        }
        if (ev.kind === 'result') {
          return h('details', { key, className: 'dshao-tool' },
            h('summary', null, '↳ 结果 ', h('span', { style: { opacity: .6, fontWeight: 400 } }, String(ev.text ?? '').slice(0, 80).replace(/\n/g, ' '))),
            h('pre', null, ev.text));
        }
        // text / text-live：助手气泡
        return h('div', { key, className: 'dshao-msg' },
          h('div', { className: 'dshao-avatar', style: { background: '#4f8cff' } }, 'AI'),
          h('div', { className: 'dshao-bubble' },
            h('div', { className: 'dshao-msg-meta' }, ev.kind === 'text-live' ? h('span', { className: 'dshao-cross-tag' }, '实时输出') : null),
            Collapsible(ev.text, key)));
      };
      const taskNodeOf = (taskId) => {
        if (taskId === undefined) return null;
        const hit = (feed.reports ?? []).find((r) => r.type === 'run' && r.taskId === taskId);
        return hit?.node ?? hit?.to ?? null;
      };
      const busyTaskIds = new Set(Object.values(feed.roles ?? {}).filter((r) => r.status === 'busy' && r.busy).map((r) => r.busy));
      const visibleSessions = sessions.filter((s) => {
        if (node === undefined) return true;
        const nid = taskNodeOf(s.taskId);
        return nid === null ? false : nid === node.id;
      });
      const processView = h('div', { className: 'dshao-feed' },
        h('div', { className: 'dshao-panel-head' },
          h('span', { className: 'dshao-panel-title' }, node === undefined ? '角色工作过程（全部）' : `角色工作过程 · ${node.name}`),
          h('span', { className: 'dshao-badge' }, `${visibleSessions.length} 个会话`)),
        sessionsErr !== '' ? h('div', { className: 'dshao-team-err', style: { margin: '0 0 6px' } },
          h('span', null, `列表刷新失败（${sessionsErr}），下轮 8 秒自动重试；当前展示为上一次成功的快照。`)) : null,
        visibleSessions.length === 0
          ? h('div', { className: 'dshao-empty' }, node === undefined ? '未发现角色会话记录。' : '该角色暂无可归属的会话（旧记录缺任务 id 时无法归属，切到架构根节点可看全部）。')
          : visibleSessions.slice(0, 40).map((s) => h('div', {
              key: s.dir, className: 'dshao-sess', 'data-live': busyTaskIds.has(s.taskId) || undefined, 'data-open': openSession === s.dir || undefined,
              onClick: () => { setOpenSession(openSession === s.dir ? null : s.dir); if (openSession !== s.dir) { setTranscript(null); void call(`/session?dir=${encodeURIComponent(s.dir)}`).then(setTranscript).catch(() => setTranscript({ events: [{ kind: 'text', text: '加载失败' }] })); } },
            },
              busyTaskIds.has(s.taskId) ? h('span', { style: { color: '#34c77b', fontWeight: 700 } }, '●') : '○',
              h('span', { style: { opacity: .65, minWidth: 74 } }, new Date(s.mtime).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })),
              h('span', { style: { flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' } }, s.title ?? s.dir.slice(8, 16)),
              s.taskId ? h('span', { className: 'dshao-cross-tag' }, s.taskId) : null,
              h('span', { style: { opacity: .5 } }, `${Math.round(s.size / 1024)}KB`))),
        openSession !== null && Array.isArray(transcript?.events)
          ? h('div', { className: 'dshao-proc-scroll' },
              h('div', { className: 'dshao-panel-head' },
                h('span', { className: 'dshao-panel-title' }, `▶ ${transcript.title ?? openSession}`),
                transcript.cwd ? h('span', { className: 'dshao-badge' }, transcript.cwd) : null),
              transcript.events.map(renderEvent))
          : null);

      // ———— teamView（第5 Tab「团队面板」§F 渲染体 @FE-V14-1-R3）————
      // 只读消费 teamData：零新增 state、零 fetch、零副作用（轮询已由上方 tab==='team' effect 承担）。
      // 四分枝：loading→skeleton ｜ error且team空→.dshao-team-err（TEAM_SCHEMA_CORRUPT/TOO_NEW 原文+code，Q4 error⊥team）
      // ｜ team=null且无error→TEAM_EMPTY_TEXT 空态 ｜ 有team→泳道×分层列看板（stale=沿用旧快照+提示行）。
      const TEAM_LANE_H = TEAM_ROW_H + 10; // 泳道行高 = 卡行高 + 纵向呼吸（标签与卡同泳道）
      const teamRoster = teamData.snap?.roster ?? [];
      const teamDoc = teamData.snap?.team ?? null;
      const teamTasks = teamDoc?.tasks ?? [];
      // 泳道集合与次序（纯函数，同输入稳定）：本 org 节点按架构图序在前，跨 org/已下线 owner 按首现序追加。
      const teamLaneOwners = (() => {
        const inOrg = (org?.nodes ?? []).filter((n) => teamTasks.some((t) => t.owner === n.id)).map((n) => n.id);
        const orphans = [];
        for (const t of teamTasks) if (!inOrg.includes(t.owner) && !orphans.includes(t.owner)) orphans.push(t.owner);
        return [...inOrg, ...orphans];
      })();
      const laneIndexOf = (owner) => { const i = teamLaneOwners.indexOf(owner); return i === -1 ? 0 : i; };
      const teamPlaced = teamLayout(teamDoc?.tasks ?? [], laneIndexOf);
      const rosterHit = (owner) => teamRoster.find((r) => r.nodeId === owner) ?? null;
      const laneName = (owner) => rosterHit(owner)?.name ?? org?.nodes?.find((n) => n.id === owner)?.name ?? owner;
      const laneHue = (s) => { let v = 0; for (const ch of String(s)) v = (v * 31 + ch.codePointAt(0)) % 360; return `hsl(${v}, 52%, 45%)`; };
      const gridW = TEAM_LANE_W + teamPlaced.cols * TEAM_COL_W + 10;
      const laneRows = Math.max(1, teamLaneOwners.length);
      const gridH = TEAM_HEAD_H + laneRows * TEAM_LANE_H + 8;
      // 依赖箭头：dep 卡右缘 → 下游卡左缘（贝塞尔，箭头 marker 落卡缘 -6px）；同列回折为退化态防御，不违「deps 恒在左」主序。
      const teamEdgeViews = [];
      for (const task of teamTasks) {
        const to = teamPlaced.cells.get(task.id);
        if (to === undefined) continue;
        for (const depId of task.deps ?? []) {
          const from = teamPlaced.cells.get(depId);
          if (from === undefined) continue;
          const x1 = TEAM_LANE_W + from.col * TEAM_COL_W + TEAM_CARD_W;
          const y1 = TEAM_HEAD_H + from.lane * TEAM_LANE_H + TEAM_LANE_H / 2;
          const x2 = TEAM_LANE_W + to.col * TEAM_COL_W - 6;
          const y2 = TEAM_HEAD_H + to.lane * TEAM_LANE_H + TEAM_LANE_H / 2;
          const dx = Math.max(18, (x2 - x1) / 2);
          teamEdgeViews.push(h('path', { key: `edge:${depId}->${task.id}`, className: 'dshao-team-edge', d: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`, 'marker-end': 'url(#dshao-team-arrowhead)' }));
        }
      }
      const teamColHeads = Array.from({ length: teamPlaced.cols }, (_, c) => h('div', { key: `col:${c}`, className: 'dshao-team-lanehead', style: { left: TEAM_LANE_W + c * TEAM_COL_W, top: 0, width: TEAM_CARD_W, height: TEAM_HEAD_H } }, `层 ${c}`));
      const teamLaneViews = teamLaneOwners.map((owner, i) => {
        const r = rosterHit(owner);
        const alive = beatAlive(r);
        const cnt = teamTasks.filter((t) => t.owner === owner);
        const doneN = cnt.filter((t) => t.status === 'done').length;
        return h('div', { key: `lane:${owner}`, className: 'dshao-team-lane', 'data-offline': !alive, style: { left: 0, top: TEAM_HEAD_H + i * TEAM_LANE_H + 2, width: TEAM_LANE_W, height: TEAM_LANE_H - 4 } },
          h('div', { className: 'dshao-team-lane-top' },
            h('span', { className: 'dshao-team-avatar', 'aria-hidden': 'true', style: { background: laneHue(owner) } }, Array.from(laneName(owner))[0] ?? '?'),
            h('span', { className: 'dshao-team-lane-name', title: `${laneName(owner)}（owner=${owner}）` }, laneName(owner))),
          h('div', { className: 'dshao-team-lane-meta' }, !alive ? 'daemon 离线' : `${doneN}/${cnt.length} done${r?.status === 'busy' && r.busy ? ` · ${r.busy}` : ''}`));
      });
      const teamCardViews = teamTasks.map((task) => {
        const pos = teamPlaced.cells.get(task.id);
        if (pos === undefined) return null;
        const dur = task.status === 'running' ? fmtDur(task.dispatchedAt, teamData.snap?.now) : fmtDur(task.dispatchedAt, task.finishedAt); // running 用快照 now 现算；端点缺失=空串不臆造
        const foot = [];
        if ((task.deps ?? []).length > 0) foot.push(`deps: ${task.deps.join(',')}`);
        if ((task.attempt ?? 1) > 1) foot.push(`attempt ${task.attempt}`);
        if (dur !== '') foot.push(dur);
        return h('div', {
          key: `card:${task.id}`, className: 'dshao-team-card', 'data-status': TEAM_STATUSES_UI.includes(task.status) ? task.status : 'pending',
          tabIndex: 0, // 键盘可达：卡可聚焦，focus-visible 高亮走既有 CSS
          style: { left: TEAM_LANE_W + pos.col * TEAM_COL_W, top: TEAM_HEAD_H + pos.lane * TEAM_LANE_H + Math.round((TEAM_LANE_H - TEAM_CARD_H) / 2), width: TEAM_CARD_W, height: TEAM_CARD_H },
          'aria-label': `${task.id} · ${TEAM_STATUS_LABEL[task.status] ?? task.status} · ${task.title}`,
          title: `${task.id} · ${task.title}\nowner ${laneName(task.owner)}（${task.owner}）· attempt ${task.attempt ?? 1}${task.finishedAt ? ` · 完成于 ${task.finishedAt}` : ''}${task.summary ? `\nsummary：${task.summary}` : ''}`,
        },
          h('div', { className: 'dshao-team-card-top' },
            h('span', { className: 'dshao-team-badge' }, TEAM_STATUS_LABEL[task.status] ?? task.status),
            h('span', { className: 'dshao-team-card-id' }, task.id)),
          h('div', { className: 'dshao-team-card-title' }, task.title),
          h('div', { className: 'dshao-team-card-foot' }, foot.join(' · ')));
      });
      const teamView = teamData.phase === 'loading'
        ? h('div', { className: 'dshao-team' },
            h('div', { className: 'dshao-team-loading' },
              h('div', { className: 'dshao-team-skeleton', style: { width: '38%' } }),
              h('div', { className: 'dshao-team-skeleton', style: { width: '82%', height: 40, borderRadius: 10 } }),
              h('div', { className: 'dshao-team-skeleton', style: { width: '94%', height: 40, borderRadius: 10 } }),
              h('div', { className: 'dshao-team-skeleton', style: { width: '56%' } })),
            h('div', { className: 'dshao-team-hint' }, '正在读取团队快照 GET /team…（5s 轮询）'))
        : teamData.error !== '' && teamDoc === null
          ? h('div', { className: 'dshao-team' },
              h('div', { className: 'dshao-team-err' },
                h('span', null, teamData.phase === 'failed' ? '团队快照读取失败（传输层）：' : '团队立项数据解析失败（契约错误，error⊥team ⇒ team=null、stats 全 0）：'),
                h('code', null, teamData.error)),
              h('div', { className: 'dshao-team-hint' }, '修复 team.json 后本面板随 5s 轮询自动恢复，无需重启。'))
          : teamDoc === null
            ? h('div', { className: 'dshao-team' },
                h('div', { className: 'dshao-team-hint' }, TEAM_EMPTY_TEXT),
                h('div', { className: 'dshao-team-hint' }, 'org_team_plan(objective, tasks) 立项，或等待派发后 5s 内自动出现在此面板。'))
            : h('div', { className: 'dshao-team' },
                h('div', { className: 'dshao-team-head' },
                  h('span', { className: 'dshao-panel-title' }, '团队立项板'),
                  h('span', { className: 'dshao-badge', title: `team.json：${teamData.snap?.path ?? ''}` }, `rev ${teamDoc.rev}`),
                  h('span', { className: 'dshao-team-objective', style: { flex: 1, minWidth: 0 }, title: teamDoc.objective }, teamDoc.objective),
                  h('span', { className: 'dshao-team-stats' },
                    TEAM_STATUSES_UI.map((s) => h('span', { key: s, className: 'dshao-team-chip', 'data-status': s, title: `${s} = ${teamData.snap?.stats?.[s] ?? 0}` },
                      h('i', null), `${TEAM_STATUS_LABEL[s]} ${teamData.snap?.stats?.[s] ?? 0}`)),
                    h('span', { key: 'total', className: 'dshao-team-chip', title: '任务总数' }, `合计 ${teamData.snap?.stats?.total ?? teamTasks.length}`)),
                  h('span', { className: 'dshao-team-updated' }, teamDoc.updatedAt ? `快照更新 ${new Date(teamDoc.updatedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : null)),
                teamData.stale !== '' ? h('div', { className: 'dshao-team-errnote' }, teamData.stale) : null, // stale=沿用旧快照渲染 + 提示行（不塌错误态）
                h('div', { className: 'dshao-team-scroll' },
                  h('div', { className: 'dshao-team-grid', style: { width: gridW, height: gridH } },
                    h('svg', { className: 'dshao-team-edges', width: gridW, height: gridH, viewBox: `0 0 ${gridW} ${gridH}`, 'aria-hidden': 'true' },
                      h('defs', null,
                        h('marker', { id: 'dshao-team-arrowhead', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '6', markerHeight: '6', orient: 'auto' },
                          h('path', { d: 'M 0 0 L 10 5 L 0 10 z', className: 'dshao-team-arrow' }))),
                      teamEdgeViews),
                    teamColHeads,
                    teamLaneViews,
                    teamCardViews)));

      return h('div', { className: 'dshao-root' },
        h('div', { className: 'dshao-head' },
          h('div', { className: 'dshao-title' }, 'Agent 组织'),
          h('p', { className: 'dshao-copy' },
            '可管理多个组织：每个组织一棵上下级树，节点配 模型/provider、系统提示词、工具白/黑名单；组织内与跨组织沟通（org_send）都记入「沟通·留痕」。架构图是自由画布：节点可拖到任意位置（松手自动保存）、新建节点、连协作/虚线下级线（点线删除）；实线=上下级，虚线=协作，点线=虚线下级。数据为单个可 diff 的 JSON（',
            h('code', null, path || '~/.dsh/agent-org/org.json'), '）。'),
          h('div', { className: 'dshao-orgtabs' },
            doc.orgs.map((entry) => h('button', {
              key: entry.id, className: 'dshao-orgtab', 'data-active': entry.id === org.id, title: `id=${entry.id}`,
              onClick: () => setOrgId(entry.id),
            }, entry.name, h('span', { className: 'dshao-n' }, String(entry.nodes.length)))),
            addingOrg === null
              ? h('button', { className: 'dshao-mini', title: '新建组织', disabled: busy, onClick: () => setAddingOrg({ name: '', rootName: '负责人' }) }, '＋')
              : null,
            h('div', { className: 'dshao-orgops' },
              h('input', { value: orgName, onChange: (e) => setOrgName(e.target.value), placeholder: '当前组织名' }),
              h('button', {
                className: 'dshao-action', disabled: busy || orgName.trim() === '' || orgName.trim() === org.name,
                onClick: () => run('重命名组织', { op: 'renameOrg', org: org.id, name: orgName }),
              }, '重命名'),
              h('button', {
                className: 'dshao-action', 'data-danger': 'true', disabled: busy || doc.orgs.length <= 1,
                title: doc.orgs.length <= 1 ? '至少保留一个组织' : '',
                onClick: () => {
                  if (window.confirm(`删除组织「${org.name}」及其全部 ${org.nodes.length} 个节点？此操作不可撤销。`)) run(`已删除组织 ${org.name}`, { op: 'removeOrg', org: org.id });
                },
              }, '删除组织')))),
        addingOrg !== null
          ? h('div', { className: 'dshao-addbox' },
            h('input', { placeholder: '组织名称', autoFocus: true, value: addingOrg.name, onChange: (e) => setAddingOrg({ ...addingOrg, name: e.target.value }) }),
            h('input', { placeholder: '根节点名称', value: addingOrg.rootName, onChange: (e) => setAddingOrg({ ...addingOrg, rootName: e.target.value }) }),
            h('button', {
              className: 'dshao-action', 'data-primary': 'true', disabled: busy || addingOrg.name.trim() === '',
              onClick: () => run('已创建组织', { op: 'addOrg', name: addingOrg.name, rootName: addingOrg.rootName }, 'org'),
            }, '创建'),
            h('button', { className: 'dshao-action', onClick: () => setAddingOrg(null) }, '取消'))
          : null,
        h('div', { className: 'dshao-grid' },
          h('div', { className: 'dshao-panel' },
            h('div', { className: 'dshao-panel-head' },
              h('span', { className: 'dshao-panel-title' }, `${org.name} · 架构图（${org.nodes.length} 个节点${totalUnread > 0 ? `，全局 ${totalUnread} 条未读` : ''}）`),
              h('div', { className: 'dshao-head-actions' },
                h('button', { className: 'dshao-action', disabled: busy, onClick: () => setTopAdding({ name: '', title: '', parentId: node?.id ?? org.rootNodeId }) }, '＋ 新建节点'),
                h('button', { className: 'dshao-action', title: '导出全部组织配置为 JSON 文件（含节点位置与连线，可在其他实例导入；不含沟通留痕与游标）', disabled: busy, onClick: exportJson }, '⬇ 导出配置'),
                h('button', { className: 'dshao-action', title: '从 JSON 文件覆盖导入全部组织（导入前自动备份原配置，org.json.bak.* 轮转 5 份）', disabled: busy, onClick: importJson }, '⬆ 导入配置'),
                h('input', { ref: fileInputRef, type: 'file', accept: 'application/json,.json', tabIndex: -1, 'aria-hidden': 'true', style: { display: 'none' }, onChange: onImportFile }),
                h('button', { className: 'dshao-mini', title: '重新加载', onClick: () => load(), disabled: busy }, '⟳'))),
            topAdding !== null
              ? h('div', { className: 'dshao-topadd' },
                h('input', { placeholder: '节点名称', autoFocus: true, value: topAdding.name, onChange: (e) => setTopAdding({ ...topAdding, name: e.target.value }) }),
                h('input', { placeholder: '职位', value: topAdding.title, onChange: (e) => setTopAdding({ ...topAdding, title: e.target.value }) }),
                h('select', { value: topAdding.parentId, onChange: (e) => setTopAdding({ ...topAdding, parentId: e.target.value }) },
                  org.nodes.map((entry) => h('option', { key: entry.id, value: entry.id }, `上级：${entry.name}`))),
                h('button', {
                  className: 'dshao-action', 'data-primary': 'true', disabled: busy || topAdding.name.trim() === '' || topAdding.parentId === '',
                  onClick: () => run('已新建节点', { op: 'add', org: org.id, parentId: topAdding.parentId, name: topAdding.name, title: topAdding.title }),
                }, '创建'),
                h('button', { className: 'dshao-action', onClick: () => setTopAdding(null) }, '取消'))
              : null,
            rootNode === undefined
              ? h('div', { className: 'dshao-empty' }, '组织数据异常：找不到根节点')
              : h('div', { className: 'dshao-chart', ref: chartRef, onClick: pendingEdge !== null ? () => setPendingEdge(null) : undefined },
                pendingEdge !== null
                  ? h('div', { className: 'dshao-pending-hint' }, `正在连${kindLabel(pendingEdge.kind)}：点一个目标节点完成；点画布空白或按 Esc 取消`)
                  : null,
                h('div', { className: 'dshao-canvas-wrap' },
                  h('div', { className: 'dshao-canvas', 'data-linking': pendingEdge !== null || undefined, ref: attachCanvas },
                    h('div', { className: 'dshao-canvas-outer', style: { width: CANVAS_W * zoom, height: CANVAS_H * zoom } },
                      h('div', { className: 'dshao-canvas-inner', ref: canvasInnerRef, style: { transform: 'scale(' + zoom + ')', transformOrigin: '0 0' } },
                        h('svg', { className: 'dshao-edges' },
                          h('defs', {},
                            h('marker', { id: 'dshao-arrow', viewBox: '0 0 10 10', refX: '9', refY: '5', markerWidth: '7', markerHeight: '7', orient: 'auto' },
                              h('path', { d: 'M 0 0 L 10 5 L 0 10 z', className: 'dshao-edge-arrow' }))),
                          edgeList.map((item) => h('g', { key: item.key, className: 'dshao-edge', 'data-kind': item.kind },
                            h('path', { d: item.d, className: 'dshao-edge-line', 'data-kind': item.kind, fill: 'none', 'marker-end': item.kind === 'dotted' ? 'url(#dshao-arrow)' : undefined }),
                            item.edge === undefined
                              ? null
                              : h('path', { d: item.d, className: 'dshao-edge-hit', onClick: (e) => { e.stopPropagation(); removeEdge(item.edge); } })))),
                        org.nodes.map(boxView)))),
                  h('div', { className: 'dshao-canvas-tools' },
                    h('button', { className: 'dshao-mini', title: '缩小', onClick: () => applyZoom(zoom / ZOOM_STEP) }, '－'),
                    h('span', { className: 'dshao-zoom-badge' }, `${Math.round(zoom * 100)}%`),
                    h('button', { className: 'dshao-mini', title: '放大', onClick: () => applyZoom(zoom * ZOOM_STEP) }, '＋'),
                    h('button', { className: 'dshao-mini', title: '适应画布（全部节点可见）', onClick: fitView }, '⤢'),
                    h('button', { className: 'dshao-mini', title: '一键自动排布（按层级整理，覆盖手动位置）', onClick: autoLayout, disabled: busy }, '⇅'),
                    h('button', { className: 'dshao-mini', title: '导出本组织架构图 PNG（2x）', onClick: exportPng, disabled: busy }, '⤓')))
              ,
            h('div', { className: 'dshao-legend' },
              h('span', null, h('i', { className: 'dshao-line-sample' }), '实线=上下级'),
              h('span', null, h('i', { className: 'dshao-line-sample', 'data-kind': 'collab' }), '虚线=协作（点线可删）'),
              h('span', null, h('i', { className: 'dshao-line-sample', 'data-kind': 'dotted' }), '点线=虚线下级（箭头，点线可删）'),
              h('span', { className: 'dshao-legend-hint' }, '拖拽=移动(吸附网格·松手保存) · Ctrl+滚轮=缩放 · ⤢=适应画布 · ⇅=自动排布 · ⤓=导出PNG · 选中后方向键微调(Shift 精细)/Delete 删除 · ⇄/◌ 再点目标=加连线')))),
          h('div', { className: 'dshao-panel' },
            h('div', { className: 'dshao-tabs' },
              h('button', { className: 'dshao-tab', 'data-active': tab === 'config', onClick: () => setTab('config') }, '节点配置'),
              h('button', { className: 'dshao-tab', 'data-active': tab === 'mail', onClick: () => setTab('mail') },
                '沟通·留痕', unreadHere > 0 ? h('span', { className: 'dshao-unread' }, String(unreadHere)) : null),
              h('button', { className: 'dshao-tab', 'data-active': tab === 'roles', onClick: () => setTab('roles') }, '角色工作台'),
              h('button', { className: 'dshao-tab', 'data-active': tab === 'process', onClick: () => setTab('process') }, '工作过程'),
              h('button', { className: 'dshao-tab', 'data-active': tab === 'team', onClick: () => setTab('team') }, '团队面板'),
              h('span', { style: { flex: 1 } }),
              h('button', { className: 'dshao-mini', title: '刷新动态', onClick: () => refreshFeed(selected), disabled: busy }, '⟳')),
            tab === 'team'
              ? teamView
              : tab === 'roles'
              ? h('div', { className: 'dshao-feed' },
                h('div', { className: 'dshao-panel-head' },
                  h('span', { className: 'dshao-panel-title' }, `角色 daemon · ${org.name}`),
                  h('span', { className: 'dshao-badge' }, 'roles.json')),
                org.nodes.map((n) => {
                  const r = (feed.roles ?? {})[`${org.id}/${n.id}`];
                  const beatMs = r?.lastBeat ? Date.now() - Date.parse(r.lastBeat) : null;
                  const alive = beatMs !== null && beatMs < Math.max(60000, (r.intervalS ?? 20) * 4000) && r.status !== 'stopped';
                  const dot = r === undefined ? '○' : r.status === 'stopped' ? '○' : !alive ? '◌' : r.status === 'busy' ? '●' : '◉';
                  const label = r === undefined ? '未启动' : r.status === 'stopped' ? '已停止' : !alive ? '心跳失联' : r.status === 'busy' ? `干活中（${r.busy ?? ''}）` : '值守中';
                  return h('div', { key: n.id, className: 'dshao-msg', 'data-out': undefined },
                    h('div', { className: 'dshao-msg-meta' },
                      h('span', { className: 'dshao-msg-dir' }, `${dot} ${n.name}${n.title ? ` · ${n.title}` : ''} — ${label}`),
                      (feed.unread?.[`${org.id}/${n.id}`] ?? 0) > 0 ? h('span', { className: 'dshao-unread', title: '排队待处理的邮件' }, `队列 ${feed.unread[`${org.id}/${n.id}`]}`) : null,
                      beatMs !== null ? h('span', null, `心跳 ${Math.round(beatMs / 1000)}s 前`) : null),
                    r === undefined
                      ? h('div', { className: 'dshao-msg-text' }, `启动命令：dsh-agent-org-role ${n.id} --org ${org.id}`)
                      : h('div', { className: 'dshao-msg-text' }, `pid ${r.pid} · 已完成 ${r.tasksDone ?? 0} 单${r.lastTask ? ` · 上一单 ${r.lastTask}` : ''}${r.intervalS ? ` · 轮询 ${r.intervalS}s` : ''}`));
                }))
              : node === undefined || form === null
              ? tab === 'process' ? processView : h('div', { className: 'dshao-empty' }, '在上方架构图选择一个节点')
              : tab === 'mail'
                ? feedView
                : tab === 'process'
                  ? processView
                  : h('div', { className: 'dshao-form' },
                  h('div', { className: 'dshao-panel-head' },
                    h('span', { className: 'dshao-panel-title' }, `节点：${node.name}${isRoot ? '（根）' : ''}`),
                    h('span', { className: 'dshao-badge' }, node.id)),
                  h('div', { className: 'dshao-fields' },
                    Field({ label: '名称', value: form.name, onChange: (v) => setForm({ ...form, name: v }) }),
                    Field({ label: '职位/头衔', value: form.title, onChange: (v) => setForm({ ...form, title: v }) }),
                    Field({ label: 'Provider（空=宿主默认）', value: form.provider, onChange: (v) => setForm({ ...form, provider: v }), placeholder: '如 deepseek / anthropic' }),
                    Field({ label: 'Model（空=默认）', value: form.model, onChange: (v) => setForm({ ...form, model: v }), placeholder: '如 deepseek-chat' }),
                    Field({ label: 'Fallback 模型', value: form.fallback, onChange: (v) => setForm({ ...form, fallback: v }) }),
                    Field({ label: 'maxTokens（空=默认）', value: form.maxTokens, onChange: (v) => setForm({ ...form, maxTokens: v.replace(/[^\d]/g, '') }) }),
                    Field({ label: '工具白名单（逗号分隔，空=不限制）', value: form.allow, onChange: (v) => setForm({ ...form, allow: v }), wide: true }),
                    Field({ label: '工具黑名单（逗号分隔）', value: form.deny, onChange: (v) => setForm({ ...form, deny: v }), wide: true }),
                    Field({ label: '系统提示词（该角色的完整人设与规则；委派执行时将注入给下级）', value: form.systemPrompt, onChange: (v) => setForm({ ...form, systemPrompt: v }), textarea: true, wide: true })),
                  h('div', { className: 'dshao-actions' },
                    h('button', {
                      className: 'dshao-action', 'data-primary': 'true', disabled: busy,
                      onClick: () => run(`已保存 ${node.name}`, { op: 'update', org: org.id, id: node.id, patch: patchOf(form) }),
                    }, '保存节点'),
                    !isRoot ? h('select', { className: 'dshao-select', value: moveTo, onChange: (e) => setMoveTo(e.target.value) },
                      h('option', { value: '' }, '移动到…'), moveCandidates) : null,
                    !isRoot && moveTo !== '' && moveTo !== node.parentId
                      ? h('button', { className: 'dshao-action', disabled: busy, onClick: () => run('已调整上下级', { op: 'move', org: org.id, id: node.id, newParentId: moveTo }) }, '确认移动')
                      : null,
                    !isRoot ? h('button', {
                      className: 'dshao-action', 'data-danger': 'true', disabled: busy,
                      onClick: () => {
                        const count = subtreeSet(org, node.id).size;
                        if (window.confirm(`删除「${node.name}」及其 ${count - 1} 个下级节点？`)) run(`已删除 ${node.name}`, { op: 'delete', org: org.id, id: node.id });
                      },
                    }, '删除节点（含下级）') : null),
                  nodeEdges.length > 0
                    ? h('div', { className: 'dshao-edges-list' },
                      h('span', { className: 'dshao-panel-title' }, '连线（点 × 或点图上对应线删除）'),
                      nodeEdges.map((edge) => {
                        const otherId = edge.from === node.id ? edge.to : edge.from;
                        const other = org.nodes.find((n) => n.id === otherId);
                        return h('div', { key: edge.id, className: 'dshao-edge-row' },
                          h('span', { className: 'dshao-badge' }, kindLabel(edge.kind)),
                          h('span', null, edge.kind === 'dotted'
                            ? (edge.from === node.id ? `${node.name} ⇢ ${other?.name ?? otherId}` : `${other?.name ?? otherId} ⇢ ${node.name}`)
                            : `${node.name} ⇄ ${other?.name ?? otherId}`),
                          h('button', { className: 'dshao-mini', 'data-danger': 'true', onClick: () => removeEdge(edge) }, '×'));
                      }))
                    : null))),
        h('div', { className: 'dshao-status', 'data-kind': status.kind || undefined }, status.text));
    }

    function apply(ctx) {
      ctx.inject(['slots'], (scope) => {
        scope.slots.inject('settings.section', () => scope.slots.register({
          name: 'settings.section',
          id: 'agent-org',
          order: 30,
          label: () => 'Agent 组织',
          inject: () => ({}),
        }, OrgSettings));
      });
    }

    return { apply };
  },
});
