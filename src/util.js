// MCP tool results carry a text content block. We put structured JSON in it so
// agents can parse the result deterministically.
export function ok(obj) {
  return { content: [{ type: "text", text: JSON.stringify(obj, null, 2) }] };
}

export function fail(message, extra = {}) {
  return {
    content: [{ type: "text", text: JSON.stringify({ error: message, ...extra }, null, 2) }],
    isError: true,
  };
}
