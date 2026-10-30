import { describe, expect, it } from "vitest";
import {
  formatDiagnosticJson,
  requestBodySections,
  requestTools,
} from "../requestDiagnostics.js";

describe("failure request diagnostics", () => {
  it("loads JSON snapshots with the HTTP body first and handles historical records", () => {
    const sections = requestBodySections(
      JSON.stringify({
        round: 1,
        inputBody: { messages: [] },
        preparedBody: { model: "test" },
        upstreamBody: { contents: [] },
      }),
    );
    expect(sections.map((section) => section.key)).toEqual([
      "upstreamBody",
      "preparedBody",
      "inputBody",
    ]);
    expect(requestBodySections(null)).toEqual([]);
    expect(requestBodySections("invalid")).toEqual([]);
  });
  it("shows indexed Gemini tools without changing the failing schema", () => {
    const schema = {
      name: "bad_tool",
      parameters: { properties: { value: { type: ["string", "null"] } } },
    };
    const tools = requestTools({
      tools: [{ function_declarations: [schema] }],
    });
    expect(tools[0].path).toBe("tools[0].function_declarations[0]");
    expect(tools[0].schema).toEqual(schema);
    expect(JSON.parse(formatDiagnosticJson(tools[0].schema))).toEqual(schema);
  });
  it("supports OpenAI and Anthropic tool schemas", () => {
    expect(
      requestTools({
        tools: [{ function: { name: "oai_tool" } }, { name: "claude_tool" }],
      }).map((tool) => tool.name),
    ).toEqual(["oai_tool", "claude_tool"]);
  });
});
