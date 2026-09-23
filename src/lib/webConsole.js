/**
 * 前端 DevTools 控制台通道。
 *
 * 服务端（backend: lib/server/socket.io/services/webConsole.js，由 web_console 工具触发）
 * 通过 socket.io 下发 { protocol: 'console', type: 'exec', data: { code } }，
 * 这里在页面里真的把 code 跑一遍，再把结果原路回传。
 *
 * 用途：让 Agent 能直接读写这个页面的运行时状态 —— localStorage（清掉卡死的
 * 会话链）、Cache Storage、Service Worker、DOM 等，不用再「你去刷新一下」。
 */
const MAX_RESULT_LENGTH = 8000;

const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;

async function evaluate(code) {
  try {
    // 先按表达式求值：localStorage.length、await caches.keys() 这种控制台常见写法
    return await new AsyncFunction(`return (${code})`)();
  } catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    // 不是表达式就当语句块跑：localStorage.clear(); location.reload()
    return await new AsyncFunction(
      `return await (async () => { ${code} })()`,
    )();
  }
}

function describe(value) {
  if (value === undefined) return "undefined";
  try {
    const text =
      typeof value === "string" ? value : JSON.stringify(value, null, 2);
    return String(text ?? value).slice(0, MAX_RESULT_LENGTH);
  } catch {
    // 循环引用 / BigInt 等 JSON 不了的值
    return String(value).slice(0, MAX_RESULT_LENGTH);
  }
}

/**
 * 执行服务端下发的命令，返回回包体（由 websocket.js 负责发出）。
 * @returns {Promise<Object>}
 */
export async function runConsoleCommand(event) {
  const reply = {
    data: { url: window.location.href },
    protocol: "console",
    request_id: event.request_id,
    type: "result",
  };

  try {
    const value = await evaluate(event.data?.code ?? "");
    reply.data.value = describe(value);
    reply.success = true;
  } catch (error) {
    reply.data.error = String(error?.stack || error).slice(
      0,
      MAX_RESULT_LENGTH,
    );
    reply.success = false;
  }

  return reply;
}
