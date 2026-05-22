// 暫時診斷用：只顯示金鑰長度與頭尾，不外洩內容。確認沒問題後可刪除。
export default async () => {
  const k = process.env.CLAUDE_API_KEY || "";
  const t = k.trim();
  const body = {
    present: !!k,
    length: k.length,
    trimmedLength: t.length,
    head: k.slice(0, 12),
    tail: k.slice(-6),
    hasLeadingTrailingWhitespace: k !== t,
    hasNewline: /\r|\n/.test(k),
    expectedLength: 108
  };
  return new Response(JSON.stringify(body, null, 2), { headers: { "Content-Type": "application/json" } });
};
