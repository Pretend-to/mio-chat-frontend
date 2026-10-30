export function parseRequestDiagnostics(raw) {
  if (!raw) return null;
  if (typeof raw === "object") return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function requestBodySections(raw) {
  const data = parseRequestDiagnostics(raw);
  if (!data) return [];
  return [
    ["upstreamBody", "实际 HTTP 请求体"],
    ["preparedBody", "适配器请求参数"],
    ["inputBody", "标准化输入"],
  ]
    .filter(([key]) => data[key] != null)
    .map(([key, label]) => ({ key, label, body: data[key] }));
}

export function requestTools(body) {
  return (Array.isArray(body?.tools) ? body.tools : []).flatMap(
    (tool, index) => {
      const declarations =
        tool.functionDeclarations || tool.function_declarations;
      if (Array.isArray(declarations)) {
        return declarations.map((schema, position) => ({
          name: schema.name || "未命名工具",
          schema,
          path: `tools[${index}].${tool.functionDeclarations ? "functionDeclarations" : "function_declarations"}[${position}]`,
        }));
      }
      return [
        {
          name: tool.function?.name || tool.name || tool.type || String(tool),
          schema: tool,
          path: `tools[${index}]`,
        },
      ];
    },
  );
}

export function formatDiagnosticJson(value) {
  return value == null ? "" : JSON.stringify(value, null, 2);
}
