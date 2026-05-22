import { getStore } from "@netlify/blobs";

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

export default async (req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return json({ error: "missing id" }, 400);
  try {
    const store = getStore("reports");
    const data = await store.get(id, { type: "json" });
    if (!data) return json({ error: "not found" }, 404);
    return json({ data });
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
};
