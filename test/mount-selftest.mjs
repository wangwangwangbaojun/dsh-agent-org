// 无头兼容自测（任务 mtk1le4d-1y4l，架构裁定：inject 收缩 + webServer 探测/补挂）。
// 纯内存假 ctx，不 spawn 任何 dsh 进程、不发 HTTP 请求；校验 apply() 的四条装载路径：
//   A1 headless（服务后置）：tools 经 internal/service 补挂 10 工具；webServer 永不到货 → 零路由、零异常
//   A2 探测命中 + 事件重复：try/catch 吞同名冲突，仍 10 工具
//   B  web 双服务前置：探测即挂 10 工具 + 1 路由；重复事件不双挂（routeMounted 守卫）
//   C  web 双服务后置：两事件补挂 10 工具 + 1 路由
//   D  路由 handler 冒烟：GET /health 走真实 route 函数（只读端点），期望 200 + ok:true
// 运行：node test/mount-selftest.mjs（退出码 0 = 全部通过）
import assert from 'node:assert/strict';
import { apply, name as pluginName, inject } from '../lib/index.js';

const TOOL_NAMES = ['org_chart', 'org_create', 'org_delegate', 'org_delete', 'org_inbox', 'org_mutate', 'org_node_get', 'org_report', 'org_send', 'org_task'];

/** 假宿主 ctx：reflect.get 按开关返回服务；on 记录监听；effect 同步执行（对齐 cordis 装载语义）。 */
function makeCtx({ hasTools = false, hasWebServer = false } = {}) {
  const avail = { tools: hasTools, webServer: hasWebServer };
  const seen = { tools: [], routes: [], sections: [], listeners: {}, reflectArgs: [] };
  // 真宿主语义：tools 同名再注册抛错；webServer.register 重复 prefix 路径抛错（dsh-host-webserver 实测）
  const toolsSvc = { register(tool) {
    if (seen.tools.some((t) => t.name === tool.name)) throw new Error(`duplicate tool ${tool.name}`);
    seen.tools.push(tool);
  } };
  const webSvc = { register(route) {
    if (seen.routes.some((r) => r.path === route.path)) throw new Error(`duplicate route ${route.path}`);
    seen.routes.push(route);
  } };
  const ctx = {
    systemPrompt: { section(s) { seen.sections.push(s); return () => {}; } },
    effect: (fn) => { fn(); },
    reflect: { get(service, strict) {
      seen.reflectArgs.push([service, strict]);
      if (service === 'tools') return avail.tools ? toolsSvc : undefined;
      if (service === 'webServer') return avail.webServer ? webSvc : undefined;
      return undefined;
    } },
    on(event, handler) { (seen.listeners[event] ??= []).push(handler); },
  };
  // 真宿主语义：internal/service 事件在「服务已可解析」之后才发（cordis 4.0.1 events.emit(self, name, value)），
  // 所以 emit 前先把可用性翻转为 true，再按 (name, value) 位置参数广播。
  const emit = (service) => {
    if (service === 'tools' || service === 'webServer') avail[service] = true;
    const value = service === 'tools' ? toolsSvc : service === 'webServer' ? webSvc : undefined;
    for (const h of seen.listeners['internal/service'] ?? []) h(service, value);
  };
  return { ctx, seen, emit };
}

const assertTenTools = (seen) => {
  assert.deepEqual(TOOL_NAMES, [...TOOL_NAMES].sort(), 'TOOL_NAMES 字面必须保持字典序');
  const names = seen.tools.map((t) => t.name).sort();
  assert.deepEqual(names, [...TOOL_NAMES].sort(), '应为恰好 10 个 org_* 工具');
};

let passed = 0;
const check = (label, fn) => { fn(); passed += 1; console.log(`  ✓ ${label}`); };

console.log('== 静态契约 ==');
check('inject 收缩为 [systemPrompt]', () => {
  assert.deepEqual(inject, ['systemPrompt']);
  assert.equal(pluginName, 'dsh-agent-org');
});

console.log('== A1 headless：无 webServer，tools 走事件补挂 ==');
{
  const { ctx, seen, emit } = makeCtx({}); // apply 时无 tools、无 webServer
  apply(ctx);
  check('apply 后未抛错，systemPrompt 指引已挂', () => {
    assert.equal(seen.sections[0].name, 'agent-org:guide');
    assert.equal(seen.sections[0].order, 60);
  });
  check('探测用非严格模式 reflect.get(name, false)', () => {
    for (const svc of ['tools', 'webServer']) {
      const hit = seen.reflectArgs.find(([n]) => n === svc);
      assert.ok(hit, `应探测 ${svc}`);
      assert.equal(hit[1], false, `${svc} 探测必须 strict=false`);
    }
  });
  check('internal/service(tools) 补挂 10 工具', () => {
    emit('tools');
    assertTenTools(seen);
  });
  check('internal/service(webServer) 永不到货 → 零路由且无异常', () => {
    emit('unrelated'); emit('systemPrompt');
    assert.equal(seen.routes.length, 0);
  });
  check('事件重复投递 tools → try/catch 吞同名，仍 10', () => {
    emit('tools');
    assertTenTools(seen);
  });
}

console.log('== A2 探测命中 tools + 事件再来（web 常见时序）==');
{
  const { ctx, seen, emit } = makeCtx({ hasTools: true });
  apply(ctx);
  check('探测即挂 10 工具', () => assertTenTools(seen));
  check('事件再来不炸不重', () => { emit('tools'); assertTenTools(seen); });
}

console.log('== B web：双服务前置 ==');
{
  const { ctx, seen, emit } = makeCtx({ hasTools: true, hasWebServer: true });
  apply(ctx);
  check('探测挂 10 工具 + 1 前缀路由', () => {
    assertTenTools(seen);
    assert.equal(seen.routes.length, 1);
    assert.deepEqual({ kind: seen.routes[0].kind, path: seen.routes[0].path }, { kind: 'prefix', path: '/dsh-agent-org/v1' });
    assert.equal(typeof seen.routes[0].handler, 'function');
  });
  check('webServer 事件补触发不双挂（重复 register 会抛=挂载事故）', () => {
    emit('webServer'); emit('webServer');
    assert.equal(seen.routes.length, 1);
  });
}

console.log('== C web：双服务后置（事件补挂主路径）==');
{
  const { ctx, seen, emit } = makeCtx({});
  apply(ctx);
  emit('webServer'); emit('tools'); emit('webServer');
  check('两事件后恰好 10 工具 + 1 路由', () => {
    assertTenTools(seen);
    assert.equal(seen.routes.length, 1);
  });
}

console.log('== D 路由 handler 冒烟（只读 /health）==');
{
  const { ctx, seen, emit } = makeCtx({});
  apply(ctx);
  emit('webServer');
  const handler = seen.routes[0].handler;
  const res = { statusCode: 0, headers: null, body: '', writeHead(status, headers) { this.statusCode = status; this.headers = headers; }, end(body) { this.body = body; } };
  const req = { method: 'GET', url: '/dsh-agent-org/v1/health', headers: { host: 'localhost:5399' } };
  await handler(req, res);
  check('GET /health（回环 Host）→ 200 + ok:true', () => {
    assert.equal(res.statusCode, 200);
    assert.equal(JSON.parse(res.body).ok, true);
  });
  // 浏览器攻击形态：恶意页面 Origin=攻击者域、Host=本机（Origin 与 Host 不一致）→ 403
  const bad = { statusCode: 0, body: '', writeHead(status) { this.statusCode = status; }, end(body) { this.body = body; } };
  await handler({ method: 'GET', url: '/dsh-agent-org/v1/health', headers: { host: 'localhost:5399', origin: 'https://evil.example.com' } }, bad);
  check('跨站 Origin（Host=本机）→ 403（同源防线在位）', () => assert.equal(bad.statusCode, 403));
  // sec-fetch-site: cross-site 直接拒（现代浏览器兜底头）
  const bad2 = { statusCode: 0, body: '', writeHead(status) { this.statusCode = status; }, end(body) { this.body = body; } };
  await handler({ method: 'GET', url: '/dsh-agent-org/v1/health', headers: { host: 'localhost:5399', 'sec-fetch-site': 'cross-site' } }, bad2);
  check('sec-fetch-site=cross-site → 403', () => assert.equal(bad2.statusCode, 403));
  // 非回环 Host 且无 Origin（直连伪造）→ 不可信
  const bad3 = { statusCode: 0, body: '', writeHead(status) { this.statusCode = status; }, end(body) { this.body = body; } };
  await handler({ method: 'GET', url: '/dsh-agent-org/v1/health', headers: { host: 'evil.example.com' } }, bad3);
  check('非回环 Host 无 Origin → 403（回环防线在位）', () => assert.equal(bad3.statusCode, 403));
}

console.log(`\n全部通过：${passed} 项断言组，10 工具 × 4 装载路径 + 路由防线 ✓`);
