import { getStore } from "@netlify/blobs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

function makeId() {
  return Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let data;
  try { data = await req.json(); } catch { return json({ error: "bad json" }, 400); }
  if (!data || !data.name) return json({ error: "missing data" }, 400);

  try {
    const store = getStore("reports");
    const id = makeId();
    data.savedAt = new Date().toISOString();
    await store.setJSON(id, data);
    return json({ id });
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
};
