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
      progressPoint: $("f-progress").value,
      focusPoint: $("f-focus").value,
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
      if (seg.dataset.seg === "lang") renderPreview();
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
    var names = state.recs.map(function (r) { return r.title; });
    $("rec-selected").textContent = names.length ? "已選：" + names.join("、") : "尚未選擇";
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
      toast("AI 生成失敗：" + err.message + "（本機尚未啟動 functions 時無法生成）");
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

  renderPreview();
})();
