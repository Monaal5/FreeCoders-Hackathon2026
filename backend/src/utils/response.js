// Success envelope: { success: true, data }
// DB rows are snake_case; the API speaks camelCase (request bodies are camelCase too),
// so every response is converted here once instead of hand-mapping in each controller.
const toCamelKey = (k) => k.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());

function camelize(value) {
  if (Array.isArray(value)) return value.map(camelize);
  if (value && typeof value === 'object' && value.constructor === Object) {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [toCamelKey(k), camelize(v)]));
  }
  return value; // Date, string, number, null ...
}

const ok = (res, data, status = 200) => res.status(status).json({ success: true, data: camelize(data) });
const created = (res, data) => ok(res, data, 201);

module.exports = { ok, created, camelize };
