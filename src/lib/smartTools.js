export const SMART_TOOL_PLUGINS = ["ai-plugin", "ai", "terminal-pty"];
const base = (name) => name.split("_mid_")[0];
export function toolGroups(catalog) {
  if (Array.isArray(catalog)) return catalog;
  return Object.entries(catalog || {}).map(([name, tools]) => ({
    name,
    tools: Object.keys(tools || {}).map((name) => ({ name })),
  }));
}
export function getSmartToolNames(catalog) {
  return [
    ...new Set(
      toolGroups(catalog)
        .filter((p) => SMART_TOOL_PLUGINS.includes(p.name.toLowerCase()))
        .flatMap((p) => (p.tools || []).map((t) => t.name)),
    ),
  ];
}
/** Existing complete AI bundles acquire the terminal tools when used. */
export function resolveSmartTools(selected = [], catalog) {
  const groups = toolGroups(catalog);
  const ai = groups
    .filter((p) => ["ai-plugin", "ai"].includes(p.name.toLowerCase()))
    .flatMap((p) => (p.tools || []).map((t) => t.name));
  const names = new Set(selected.map(base));
  if (!ai.length || !ai.every((name) => names.has(base(name))))
    return [...selected];
  return [...new Set([...selected, ...getSmartToolNames(catalog)])];
}
