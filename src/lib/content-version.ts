export function canonicalContent(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalContent).join(",")}]`;
  const item = value as Record<string, unknown>;
  return `{${Object.keys(item).sort().filter(key => item[key] !== undefined).map(key => `${JSON.stringify(key)}:${canonicalContent(item[key])}`).join(",")}}`;
}
