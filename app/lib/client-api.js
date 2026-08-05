export async function requestJson(url, options) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text ? { error: text } : null;
  }
  if (!response.ok) throw new Error(body?.error || body?.message || `Error ${response.status}`);
  return body;
}
