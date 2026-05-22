import Anthropic from "@anthropic-ai/sdk";

const CLAUDE_MODEL = "claude-sonnet-4-6";

const FEEL = [["morning", "晨間開機", "Morning energy"], ["energy", "日間續航", "Daytime stamina"], ["evening", "晚間餘力", "Evening reserve"], ["sync", "身心同步", "Mind-body sync"]];
const ACT = [["diet", "飲食執行", "Diet"], ["nutrition", "營養補充", "Supplements"], ["exercise", "運動習慣", "Exercise"], ["sleep", "睡眠儀式", "Sleep ritual"]];

const json = (obj, status = 200) =>
  new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

function n(v) { const x = Number(v); return isFinite(x) ? x : 0; }
function avg(feel, day) {
  const vals = FEEL.map(f => n(feel?.[f[0]]?.[day])).filter(x => x > 0);
  return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : "—";
}

function buildPrompt({ inputs, tone, lang }) {
  const zh = lang !== "en";
  const f = inputs.feel || {}, a = inputs.act || {};
  const feelLines = FEEL.map(x => `${zh ? x[1] : x[2]}: ${n(f[x[0]]?.d0)} → ${n(f[x[0]]?.d90)}`).join(zh ? "、" : ", ");
  const actLines = ACT.map(x => `${zh ? x[1] : x[2]}: ${n(a[x[0]]?.d0)} → ${n(a[x[0]]?.d90)}`).join(zh ? "、" : ", ");
  const v = (s) => (s == null || s === "" ? (zh ? "（未填寫）" : "(not provided)") : s);

  const toneZh = tone === "professional"
    ? "語氣精簡、專業、客觀，聚焦數據與下一步建議，少用情緒性詞彙。"
    : "語氣溫暖、像朋友般鼓勵與支持，多用同理心詞彙（很棒、我們一起、你做到了）。";
  const toneEn = tone === "professional"
    ? "Tone: concise, professional, objective; focus on data and next steps."
    : "Tone: warm and encouraging like a supportive friend; use empathetic language.";

  const data = `
- ${zh ? "姓名" : "Name"}: ${v(inputs.name)}
- ${zh ? "年齡" : "Age"}: ${v(inputs.age)}
- ${zh ? "改善目標" : "Goal"}: ${v(inputs.goal)}
- ${zh ? "起始摘要" : "Initial summary"}: ${v(inputs.summary)}
- ${zh ? "健康風險" : "Health risks"}: ${v(inputs.risks)}
- ${zh ? "顧問重點" : "Consultant focus"}: ${v(inputs.highlights)}
- ${zh ? "D0 關鍵抽血指標" : "Key D0 blood markers"}: ${v(inputs.bloodD0)}
- ${zh ? "主觀身體感受均值" : "Subjective feeling avg"}: D0 ${avg(f, "d0")} → D90 ${avg(f, "d90")}
- ${zh ? "主觀指標明細" : "Feeling detail"}: ${feelLines}
- ${zh ? "行動策略執行度" : "Action execution"}: ${actLines}
- ${zh ? "最顯著進步點" : "Top progress"}: ${v(inputs.progressPoint)}
- ${zh ? "下一階段關注點" : "Next focus"}: ${v(inputs.focusPoint)}`;

  if (zh) {
    return `你是 YOUNGER 的專業功能醫學健康顧問，為客戶撰寫 100 天計劃的結案總結。
${toneZh}
分析重點：慶祝進步幅度大（+2 分以上）的項目；對退步或紀錄缺失給予理解與支持；對停滯項目給予耐心鼓勵。
輸出要求：180–250 字；以「Hi ${v(inputs.name)}，」開頭；只輸出總結內文，不要標題或條列符號；資料缺失請溫柔提醒下次補上即可。

客戶資料：${data}`;
  }
  return `You are YOUNGER's professional functional-medicine health consultant, writing the closing summary of a 100-day program.
${toneEn}
Celebrate large improvements (+2 or more); be understanding about declines or missing records; encourage patience on plateaus.
Output: 120–180 words; start with "Hi ${v(inputs.name)},"; return only the summary prose (no headings or bullet points).

Client data:${data}`;
}

export default async (req) => {
  if (req.method !== "POST") return json({ error: "POST only" }, 405);
  let body;
  try { body = await req.json(); } catch { return json({ error: "bad json" }, 400); }

  const key = process.env.CLAUDE_API_KEY;
  if (!key) return json({ error: "CLAUDE_API_KEY not set" }, 500);

  try {
    const client = new Anthropic({ apiKey: key });
    const msg = await client.messages.create({
      model: CLAUDE_MODEL,
      max_tokens: 700,
      messages: [{ role: "user", content: buildPrompt(body) }]
    });
    const text = (msg.content || []).map(b => b.text || "").join("").trim();
    return json({ text });
  } catch (err) {
    return json({ error: String(err.message || err) }, 500);
  }
};
