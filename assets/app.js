/* 顧問工具邏輯 */
(function () {
  "use strict";

  // ===== 設定（如更換 GAS / 商品表，改這裡）=====
  var GAS_URL = "https://script.google.com/macros/s/AKfycbzvh1viE9ZJIcCAwRleFm1OXQ_Wcj-_VZd0_BFsji8eu74qoM52uUDHeG9LwvX94GkSYA/exec";
  var PRODUCTS_CSV = "https://docs.google.com/spreadsheets/d/1yIRPpRIXzNVQw9xlqBxemKEG84a-PffcyXJHLAKgWoQ/export?format=csv";

  var FEEL = [["morning", "晨間開機"], ["energy", "日間續航"], ["evening", "晚間餘力"], ["sync", "身心同步"]];
  var ACT = [["diet", "飲食調整"], ["nutrition", "營養補充"], ["exercise", "運動習慣"], ["sleep", "睡眠儀式"]];
  var SELECT_OPTS = ["晨間開機", "日間續航", "晚間餘力", "身心同步", "飲食調整", "營養補充", "運動習慣", "睡眠儀式", "自訂內容…"];
  var DAYS = ["d0", "d30", "d60", "d90"];
  var DAY_LABELS = { Day0: "d0", Day30: "d30", Day60: "d60", Day90: "d90" };
  var Q_MAP = { q1: "morning", q2: "energy", q3: "evening", q4: "sync", q5: "diet", q6: "nutrition", q7: "exercise", q8: "sleep" };

  var state = { engine: "claude", tone: "warm", lang: "zh", showHighlights: true, showTrend: true, showRadar: true, showRecs: true, recs: [] };
  var products = [];

  var $ = function (id) { return document.getElementById(id); };
  var previewEl = $("preview");

  // ---------- 建立分數表 ----------
  function buildScoreRows(tableId, items, group) {
    var tbl = $(tableId);
    items.forEach(function (it) {
      var tr = document.createElement("tr");
      var td = '<td>' + it[1] + '</td>';
      DAYS.forEach(function (day) {
        td += '<td><input type="number" min="0" max="5" value="0" data-score="' + group + '.' + it[0] + '.' + day + '"></td>';
      });
      tr.innerHTML = td;
      tbl.appendChild(tr);
    });
  }
  buildScoreRows("tbl-feel", FEEL, "feel");
  buildScoreRows("tbl-act", ACT, "act");

  // ---------- 下拉選項 ----------
  ["f-progress", "f-focus"].forEach(function (id) {
    SELECT_OPTS.forEach(function (o) {
      var opt = document.createElement("option"); opt.value = o; opt.textContent = o; $(id).appendChild(opt);
    });
  });
  // 自訂內容 → 顯示自訂輸入框
  [["f-progress", "f-progress-custom"], ["f-focus", "f-focus-custom"], ["f-retest", "f-retest-custom"]].forEach(function (pair) {
    $(pair[0]).addEventListener("change", function () {
      var custom = this.value === "自訂內容…";
      $(pair[1]).style.display = custom ? "block" : "none";
      renderPreview();
    });
  });

  // ---------- 快速標籤資料 ----------
  var GOAL_TAGS = [
    ["❤️ 心血管循環", ["心血管功能", "血壓調節", "血脂平衡", "血液循環改善"]],
    ["⚡ 能量管理", ["慢性疲勞", "提升精力", "改善體力", "增強耐力"]],
    ["🧠 神經認知", ["提升專注力", "改善記憶力", "減輕腦霧", "情緒穩定", "睡眠品質"]],
    ["🛡 免疫抗壓", ["提升身體抗壓能力", "增強免疫系統", "降低發炎指標", "壓力管理"]],
    ["⚖️ 代謝體重", ["減輕體重", "新陳代謝提升", "血糖穩定", "胰島素敏感性"]],
    ["🌿 消化腸道", ["腸道健康", "消化功能改善", "腸道菌群平衡", "營養吸收優化"]],
    ["🏃 運動表現", ["運動表現提升", "肌肉恢復", "運動耐力", "身體組成改善"]],
    ["🔮 荷爾蒙調節", ["荷爾蒙平衡", "甲狀腺功能", "生殖健康", "壓力荷爾蒙調節"]]
  ];
  var SUMMARY_TAGS = [
    ["💤 作息習慣", ["熬夜", "睡眠不足", "作息不規律", "晚睡晚起", "睡眠品質差"]],
    ["🚭 不良嗜好", ["抽菸", "過量飲酒", "咖啡因依賴", "久坐不動", "暴飲暴食"]],
    ["🏢 職業環境", ["夜班工作", "高壓工作", "常搭飛機", "輪班制度", "長期加班"]],
    ["🌍 環境因素", ["環境污染", "空氣品質差", "噪音環境", "化學物質接觸", "電磁波暴露"]],
    ["😨 壓力相關", ["壓力大", "情緒不穩", "焦慮傾向", "憂鬱情緒", "人際壓力"]],
    ["🤧 健康狀況", ["常過敏", "免疫力低下", "慢性發炎", "腸胃敏感", "荷爾蒙失調"]],
    ["🧬 家族病史", ["家族高血壓", "家族糖尿病", "家族心血管疾病", "家族癌症史", "家族自體免疫疾病"]],
    ["🍔 飲食習慣", ["外食頻繁", "加工食品攝取過多", "蔬果攝取不足", "水分攝取不足", "不規律進食"]],
    ["💊 用藥習慣", ["長期服藥", "止痛藥依賴", "保健食品過量", "抗生素使用頻繁", "荷爾蒙治療"]]
  ];
  var QUOTES = [
    ["🎉 達標恭喜", ["恭喜您成功達成健康目標！您的堅持與努力已經開花結果，這份成就值得為自己驕傲。", "太棒了！您已經成功完成這階段的健康計畫，每一個小小的改變都讓您更接近理想的自己。", "您做到了！從數據可以看出您的用心與付出，這就是健康投資最美好的回報。"]],
    ["💪 努力肯定", ["您的每一份努力我們都看見了，健康之路雖不容易，但您正走在正確的道路上。", "感謝您對自己健康的重視與投入，這份堅持是改變的開始，也是希望的起點。", "您的認真態度令人敬佩，每一個健康的選擇都在為更好的明天累積能量。"]],
    ["🌱 持續加油", ["健康是一場馬拉松，環境變化需要時間。您已經起跑了，請保持這份美好的節奏繼續前進。", "您正在往正確的方向前進，請繼續保持這份對健康的熱忱與堅持。", "每一天的小改變都在累積成大蛻變，期待與您一同見證更多美好的改變。"]],
    ["🤗 未達標鼓勵", ["健康改善需要時間，您已經踏出重要的第一步，讓我們一起調整步調繼續努力。", "每個人的身體節奏不同，重要的是您願意開始改變，我們會陪伴您找到最適合的方式。", "目標雖然還未達成，但您的每一份努力都有意義，讓我們重新檢視計畫，為下一階段做好準備。"]]
  ];
  var QUOTES_EN = [
    ["🎉 Goal Achieved", ["Congratulations on reaching your health goal! Your dedication and effort have truly paid off — this achievement is something to be proud of.", "Amazing work! You've completed this stage of your health plan, and every small change has brought you closer to your best self.", "You did it! The data clearly reflects your care and commitment — the most rewarding return on a health investment."]],
    ["💪 Effort Recognized", ["We see every bit of effort you've put in. The path to health isn't easy, but you're walking the right way.", "Thank you for valuing and investing in your own health — this persistence is the beginning of change and the start of hope.", "Your dedication is admirable; every healthy choice is building energy for a better tomorrow."]],
    ["🌱 Keep Going", ["Health is a marathon and change takes time. You've started strong — keep this wonderful rhythm going.", "You're heading in the right direction; please keep up this passion and commitment to your health.", "Every small daily change adds up to a big transformation. We look forward to witnessing more positive changes with you."]],
    ["🤗 Encouragement", ["Improving health takes time. You've taken an important first step — let's adjust the pace and keep going together.", "Everyone's body has its own rhythm; what matters is your willingness to start. We'll help you find what works best for you.", "The goal isn't reached yet, but every effort counts. Let's review the plan together and prepare for the next stage."]]
  ];

  // ---------- 建立標籤面板（append 模式：點選/自訂加到 textarea）----------
  function appendTag(targetId, text) {
    var el = $(targetId), cur = el.value.trim();
    var parts = cur ? cur.split(/[、,，\n]/).map(function (s) { return s.trim(); }).filter(Boolean) : [];
    if (parts.indexOf(text) > -1) return;
    parts.push(text);
    el.value = parts.join("、");
    renderPreview();
  }
  function buildTagPanel(panelId, btnId, targetId, data, customPlaceholder) {
    var panel = $(panelId);
    var html = '<div class="tag-cats">';
    data.forEach(function (cat) {
      html += '<div class="tag-cat"><h5>' + cat[0] + '</h5><div class="tag-chips">';
      cat[1].forEach(function (tag) { html += '<button type="button" class="chip" data-tag="' + escapeAttr(tag) + '">' + escapeHtml(tag) + '</button>'; });
      html += '</div></div>';
    });
    html += '</div><div class="tag-custom"><input class="f" placeholder="' + customPlaceholder + '"></div>';
    panel.innerHTML = html;
    $(btnId).addEventListener("click", function () { panel.classList.toggle("open"); });
    panel.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip"); if (chip) appendTag(targetId, chip.dataset.tag);
    });
    panel.querySelector(".tag-custom input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); var v = this.value.trim(); if (v) { appendTag(targetId, v); this.value = ""; } }
    });
  }
  buildTagPanel("goal-tag-panel", "goal-tag-btn", "f-goal", GOAL_TAGS, "自訂標籤（按 Enter 新增）…");
  buildTagPanel("summary-tag-panel", "summary-tag-btn", "f-summary", SUMMARY_TAGS, "自訂摘要標籤（按 Enter 新增）…");

  // ---------- 語錄庫（replace 模式：點選帶入語錄欄；隨報告語言切換中／英）----------
  function renderQuotePanel() {
    var panel = $("quote-panel"), data = state.lang === "en" ? QUOTES_EN : QUOTES, html = "";
    data.forEach(function (cat) {
      html += '<div class="quote-cat"><h5>' + cat[0] + '</h5>';
      cat[1].forEach(function (q) { html += '<div class="quote-item" data-q="' + escapeAttr(q) + '">' + escapeHtml(q) + '</div>'; });
      html += '</div>';
    });
    panel.innerHTML = html;
  }
  renderQuotePanel();
  $("quote-btn").addEventListener("click", function () { $("quote-panel").classList.toggle("open"); });
  $("quote-panel").addEventListener("click", function (e) {
    var item = e.target.closest(".quote-item");
    if (item) { $("f-quote").value = item.dataset.q; $("quote-panel").classList.remove("open"); renderPreview(); }
  });

  // ---------- 收集資料 ----------
  function readScores(group) {
    var out = {};
    [].slice.call(document.querySelectorAll('[data-score^="' + group + '."]')).forEach(function (inp) {
      var parts = inp.dataset.score.split("."); // group.key.day
      var key = parts[1], day = parts[2];
      out[key] = out[key] || {};
      out[key][day] = Number(inp.value) || 0;
    });
    return out;
  }

  function gatherData() {
    return {
      assetBase: "",
      date: new Date().toISOString().slice(0, 10),
      consultant: $("f-consultant").value.trim(),
      name: $("f-name").value.trim(),
      age: $("f-age").value.trim(),
      goal: $("f-goal").value.trim(),
      summary: $("f-summary").value.trim(),
      risks: $("f-risks").value.trim(),
      highlights: $("f-highlights").value.trim(),
      showHighlights: state.showHighlights,
      bloodD0: $("f-blood").value.trim(),
      feel: readScores("feel"),
      act: readScores("act"),
      showTrend: state.showTrend,
      showRadar: state.showRadar,
      aiText: $("f-ai").value.trim(),
      progressPoint: resolveSelect("f-progress", "f-progress-custom"),
      focusPoint: resolveSelect("f-focus", "f-focus-custom"),
      retest: resolveSelect("f-retest", "f-retest-custom"),
      quote: $("f-quote").value.trim(),
      recs: state.recs,
      showRecs: state.showRecs
    };
  }

  function renderPreview() { YoungerReport.render(previewEl, gatherData(), state.lang); }

  // ---------- 綁定即時更新 ----------
  document.addEventListener("input", function (e) {
    if (e.target.matches(".f, [data-score]")) renderPreview();
  });

  // toggles
  [].slice.call(document.querySelectorAll("[data-toggle]")).forEach(function (el) {
    el.addEventListener("click", function () {
      var key = el.dataset.toggle;
      state[key] = !state[key];
      el.querySelector(".sw").classList.toggle("off", !state[key]);
      renderPreview();
    });
  });

  // segmented controls
  [].slice.call(document.querySelectorAll("[data-seg]")).forEach(function (seg) {
    seg.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-val]"); if (!btn) return;
      [].slice.call(seg.children).forEach(function (b) { b.classList.remove("on"); });
      btn.classList.add("on");
      state[seg.dataset.seg] = btn.dataset.val;
      if (seg.dataset.seg === "lang") { renderQuotePanel(); renderPreview(); }
    });
  });

  // ---------- Email 帶入 (GAS doGet JSONP) ----------
  function jsonp(url) {
    return new Promise(function (resolve, reject) {
      var cb = "ycb_" + Date.now();
      var s = document.createElement("script");
      var timer = setTimeout(function () { cleanup(); reject(new Error("timeout")); }, 15000);
      function cleanup() { clearTimeout(timer); delete window[cb]; s.remove(); }
      window[cb] = function (data) { cleanup(); resolve(data); };
      s.onerror = function () { cleanup(); reject(new Error("network")); };
      s.src = url + (url.indexOf("?") > -1 ? "&" : "?") + "callback=" + cb;
      document.body.appendChild(s);
    });
  }

  $("lookup-btn").addEventListener("click", function () {
    var email = $("lookup-email").value.trim().toLowerCase();
    if (!email) { toast("請先輸入 email"); return; }
    var msg = $("lookup-msg");
    msg.textContent = "查詢中…";
    jsonp(GAS_URL + "?email=" + encodeURIComponent(email)).then(function (rows) {
      if (!rows || rows.error || !rows.length) { msg.textContent = "查無此 email 的回報紀錄"; return; }
      // 先清零
      [].slice.call(document.querySelectorAll("[data-score]")).forEach(function (i) { i.value = 0; });
      // rows 由新到舊；每個 day 取第一筆出現的值
      var seen = {};
      rows.forEach(function (r) {
        var day = DAY_LABELS[r.targetDay]; if (!day) return;
        Object.keys(Q_MAP).forEach(function (q) {
          var field = Q_MAP[q], k = field + "." + day;
          if (seen[k]) return;
          var inp = document.querySelector('[data-score="feel.' + k + '"],[data-score="act.' + k + '"]');
          if (inp && r[q] !== "" && r[q] != null) { inp.value = Number(r[q]) || 0; seen[k] = true; }
        });
      });
      var name = rows[0].targetName || rows[0].fillerName || "";
      if (name && !$("f-name").value) $("f-name").value = name;
      msg.textContent = "已帶入 " + rows.length + " 筆紀錄（缺漏以 0 計）";
      renderPreview();
    }).catch(function () { msg.textContent = "查詢失敗，請稍後再試"; });
  });

  // ---------- 商品選擇 ----------
  var prodModal = $("prod-modal");
  function loadProducts() {
    if (products.length) { renderProdList(""); return; }
    $("prod-list").textContent = "載入中…";
    Papa.parse(PRODUCTS_CSV, {
      download: true, header: true,
      complete: function (res) {
        products = (res.data || []).filter(function (r) { return (r.Title || "").trim(); }).map(function (r) {
          return { id: r.ID, title: (r.Title || "").trim(), title_en: (r.Title_EN || "").trim(), image: (r.ImageURL || "").trim(), desc: (r.Description || "").trim(), type: (r.Type || "").trim() };
        });
        renderProdList("");
      },
      error: function () { $("prod-list").textContent = "商品載入失敗"; }
    });
  }
  function isSelected(id) { return state.recs.some(function (r) { return r.id === id; }); }
  function renderProdList(q) {
    q = (q || "").toLowerCase();
    var list = products.filter(function (p) { return !q || p.title.toLowerCase().indexOf(q) > -1 || p.title_en.toLowerCase().indexOf(q) > -1; });
    $("prod-list").innerHTML = list.map(function (p) {
      var bg = p.image ? ' style="background-image:url(' + p.image + ')"' : "";
      return '<div class="prod' + (isSelected(p.id) ? " on" : "") + '" data-id="' + p.id + '">' +
        '<span class="thumb"' + bg + '></span><div style="min-width:0"><div class="pt">' + escapeHtml(p.title) + '</div><div class="pd">' + escapeHtml(p.desc) + '</div></div>' +
        '<span class="ck">' + (isSelected(p.id) ? "✓" : "") + '</span></div>';
    }).join("") || '<div style="color:var(--soft);font-size:13px;padding:20px;text-align:center">查無商品</div>';
  }
  $("rec-btn").addEventListener("click", function () { prodModal.classList.add("open"); loadProducts(); });
  $("prod-search").addEventListener("input", function (e) { renderProdList(e.target.value); });
  $("prod-list").addEventListener("click", function (e) {
    var row = e.target.closest(".prod"); if (!row) return;
    var p = products.find(function (x) { return x.id === row.dataset.id; }); if (!p) return;
    if (isSelected(p.id)) state.recs = state.recs.filter(function (r) { return r.id !== p.id; });
    else state.recs.push(p);
    renderProdList($("prod-search").value);
  });
  $("prod-done").addEventListener("click", function () {
    prodModal.classList.remove("open");
    $("rec-selected").textContent = state.recs.length ? "已選 " + state.recs.length + " 項" : "尚未選擇";
    renderPreview();
  });

  // ---------- AI 生成 ----------
  $("ai-btn").addEventListener("click", function () {
    var btn = this; btn.disabled = true; var orig = btn.textContent; btn.textContent = "生成中…";
    var d = gatherData();
    fetch("/.netlify/functions/analyze", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        engine: state.engine, tone: state.tone, lang: state.lang,
        inputs: { name: d.name, age: d.age, goal: d.goal, summary: d.summary, risks: d.risks, highlights: d.highlights, bloodD0: d.bloodD0, feel: d.feel, act: d.act, progressPoint: d.progressPoint, focusPoint: d.focusPoint }
      })
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (res.error) throw new Error(res.error);
      $("f-ai").value = res.text || "";
      renderPreview();
    }).catch(function (err) {
      toast("AI 生成失敗：" + err.message);
    }).finally(function () { btn.disabled = false; btn.textContent = orig; });
  });

  // ---------- 產生連結 ----------
  $("btn-link").addEventListener("click", function () {
    var d = gatherData();
    if (!d.name) { toast("請先填寫客戶姓名"); return; }
    d.lang = state.lang;
    var btn = this; var orig = btn.textContent; btn.textContent = "產生中…"; btn.disabled = true;
    fetch("/.netlify/functions/save-report", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(d)
    }).then(function (r) { return r.json(); }).then(function (res) {
      if (res.error || !res.id) throw new Error(res.error || "no id");
      var url = location.origin + "/report.html?id=" + res.id;
      $("link-url").value = url; $("link-open").href = url;
      $("link-modal").classList.add("open");
    }).catch(function (err) {
      toast("產生連結失敗：" + err.message + "（需部署到 Netlify 後可用）");
    }).finally(function () { btn.textContent = orig; btn.disabled = false; });
  });
  $("link-copy").addEventListener("click", function () {
    var inp = $("link-url"); inp.select();
    navigator.clipboard.writeText(inp.value).then(function () { toast("已複製連結"); });
  });

  // ---------- 匯出 PNG / PDF ----------
  function exportImage(type) {
    var node = document.getElementById("report-card");
    if (!node) { toast("尚無報告內容"); return; }
    html2canvas(node, { scale: 2, useCORS: true, backgroundColor: "#fff" }).then(function (canvas) {
      var name = (gatherData().name || "report") + "_100day";
      if (type === "png") {
        var a = document.createElement("a"); a.download = name + ".png"; a.href = canvas.toDataURL("image/png"); a.click();
      } else {
        var img = canvas.toDataURL("image/png");
        var pdf = new window.jspdf.jsPDF({ unit: "px", format: [canvas.width, canvas.height] });
        pdf.addImage(img, "PNG", 0, 0, canvas.width, canvas.height);
        pdf.save(name + ".pdf");
      }
    }).catch(function () { toast("匯出失敗，請重試"); });
  }
  $("btn-png").addEventListener("click", function () { exportImage("png"); });
  $("btn-pdf").addEventListener("click", function () { exportImage("pdf"); });

  // ---------- modal close ----------
  [].slice.call(document.querySelectorAll(".modal-bg")).forEach(function (m) {
    m.addEventListener("click", function (e) {
      if (e.target === m || e.target.matches("[data-close]")) m.classList.remove("open");
    });
  });

  // ---------- 小工具 ----------
  var toastTimer;
  function toast(msg) {
    var t = $("toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(function () { t.classList.remove("show"); }, 3000);
  }
  function escapeHtml(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function resolveSelect(selId, customId) {
    var v = $(selId).value;
    if (v === "自訂內容…") return $(customId).value.trim();
    return v;
  }

  renderPreview();
})();
