/* 共用報告渲染器：顧問預覽 (index.html) 與 客戶公開頁 (report.html) 共用 */
(function (global) {
  "use strict";

  var ACCOUNT_URL = "https://www.younger.tw/account";

  var I18N = {
    zh: {
      sub: "你的生理數據顧問",
      title: "100天數據改善計劃 結案報告",
      date: "報告日期：",
      name: "姓名", age: "年齡", ageUnit: " 歲",
      goal: "主要改善目標",
      trend: "數據改善趨勢", trendHint: "與自己的起點 D0 相比",
      action: "你的行動力", actionHint: "D0 vs D90",
      self: "自評", baseline: "基準（你的 D0）", d0: "D0", d90: "D90",
      summary: " 顧問總結",
      recs: "下一階段推薦方案",
      note1: "詳細檢測內容請至 ", noteLink: "Shopify 會員中心", note2: " 查看",
      fmsg: "祝賀您成功完成 100 天數據改善旅程，期待更健康的未來與您見面。",
      disc: "本站所有檢測皆由通過認證的專業檢驗機構開立與執行，所提供的資訊不能取代醫師的專業診斷和治療。若您有任何不適或疑慮，請務必尋求專業醫療意見。© 2023 楊格健康股份有限公司. All rights reserved.",
      radar: ["飲食", "營養", "運動", "睡眠"]
    },
    en: {
      sub: "Your Physiological Data Consultant",
      title: "100-Day Health Improvement · Final Report",
      date: "Report Date: ",
      name: "Name", age: "Age", ageUnit: "",
      goal: "Primary Goal",
      trend: "Improvement Trend", trendHint: "Compared to your own D0 baseline",
      action: "Your Action Power", actionHint: "D0 vs D90",
      self: "Self-rating", baseline: "Baseline (your D0)", d0: "D0", d90: "D90",
      summary: " — Consultant's Summary",
      recs: "Recommended Next Steps",
      note1: "For full test details, visit your ", noteLink: "Shopify Member Center", note2: "",
      fmsg: "Congratulations on completing your 100-day improvement journey — here's to a healthier future ahead.",
      disc: "All tests are conducted by certified professional laboratories. The information provided cannot replace a physician's professional diagnosis or treatment. If you experience any discomfort or concern, please seek professional medical advice. © 2023 Younger Health Co., Ltd. All rights reserved.",
      radar: ["Diet", "Supps", "Exercise", "Sleep"]
    }
  };

  var DAYS = ["d0", "d30", "d60", "d90"];

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

  // 主觀身體感受四項在某天的平均（只計 >0），全 0 回傳 null
  function feelAvg(feel, day) {
    var vals = ["morning", "energy", "evening", "sync"]
      .map(function (k) { return num(feel[k] && feel[k][day]); })
      .filter(function (n) { return n > 0; });
    if (!vals.length) return null;
    return vals.reduce(function (a, b) { return a + b; }, 0) / vals.length;
  }

  var charts = [];
  function destroyCharts() { charts.forEach(function (c) { try { c.destroy(); } catch (e) {} }); charts = []; }

  function buildHTML(d, lang) {
    var t = I18N[lang] || I18N.zh;
    var logoDark = (d.assetBase || "") + "logo/Logo-dark.png";
    var logoWhite = (d.assetBase || "") + "logo/Logo-white.png";
    var html = "";
    html += '<div class="report" id="report-card">';
    html += '<div class="r-pad">';

    // header
    html += '<div class="r-head"><div class="r-lockup">';
    html += '<img class="r-logo" src="' + logoDark + '" alt="YOUNGER">';
    html += '<span class="r-sub">' + esc(t.sub) + '</span></div>';
    html += '<div class="r-title">' + esc(t.title) + '</div></div>';
    html += '<div class="r-date">' + esc(t.date + (d.date || "")) + '</div>';

    // info
    html += '<div class="r-info">';
    html += '<div class="c"><span>' + esc(t.name) + '</span><b>' + esc(d.name) + '</b></div>';
    html += '<div class="c"><span>' + esc(t.age) + '</span><b>' + (d.age ? esc(d.age) + esc(t.ageUnit) : "—") + '</b></div>';
    html += '</div>';
    if (d.goal) html += '<div class="r-goal"><span>' + esc(t.goal) + '</span><b>' + esc(d.goal) + '</b></div>';

    // charts
    var showTrend = d.showTrend !== false, showRadar = d.showRadar !== false;
    if (showTrend || showRadar) {
      html += '<div class="r-sec"><div class="r-charts">';
      if (showTrend) {
        html += '<div class="r-chart"><div class="r-sec-h">' + esc(t.trend) + '</div>';
        html += '<div class="hint">' + esc(t.trendHint) + '</div>';
        html += '<div class="chartbox"><canvas id="rc-trend"></canvas></div>';
        html += '<div class="r-legend"><span><i style="background:#0d9488"></i>' + esc(t.self) + '</span><span><i style="background:#aab4bd"></i>' + esc(t.baseline) + '</span></div></div>';
      }
      if (showRadar) {
        html += '<div class="r-chart"><div class="r-sec-h">' + esc(t.action) + '</div>';
        html += '<div class="hint">' + esc(t.actionHint) + '</div>';
        html += '<div class="chartbox"><canvas id="rc-radar"></canvas></div>';
        html += '<div class="r-legend"><span><i style="background:#cbd5e1"></i>' + esc(t.d0) + '</span><span><i style="background:#0d9488"></i>' + esc(t.d90) + '</span></div></div>';
      }
      html += '</div></div>';
    }

    // summary
    if (d.aiText) {
      html += '<div class="r-sec"><div class="r-summary">';
      html += '<div class="h">' + esc((d.consultant || "") + t.summary) + '</div>';
      html += '<p>' + esc(d.aiText) + '</p></div></div>';
    }

    // recommendations
    if (d.showRecs !== false && d.recs && d.recs.length) {
      html += '<div class="r-sec"><div class="r-sec-h">' + esc(t.recs) + '</div><div class="r-recs">';
      d.recs.forEach(function (r) {
        var title = lang === "en" ? (r.title_en || r.title) : r.title;
        var img = r.image ? ' style="background-image:url(' + esc(r.image) + ')"' : "";
        html += '<span class="r-pill"><span class="t"' + img + '></span>' + esc(title) + '</span>';
      });
      html += '</div>';
      html += '<div class="r-note">' + esc(t.note1) + '<a href="' + ACCOUNT_URL + '" target="_blank" rel="noopener">' + esc(t.noteLink) + '</a>' + esc(t.note2) + '</div>';
      html += '</div>';
    }

    html += '</div>'; // r-pad

    // footer
    html += '<div class="r-footer"><div class="r-flockup">';
    html += '<img class="flogo" src="' + logoWhite + '" alt="YOUNGER">';
    html += '<span class="fsub">' + esc(t.sub) + '</span></div>';
    html += '<div class="fmsg">' + esc(t.fmsg) + '</div>';
    html += '<hr><div class="disc">' + esc(t.disc) + '</div></div>';

    html += '</div>'; // report
    return html;
  }

  function drawCharts(d, lang) {
    var t = I18N[lang] || I18N.zh;
    if (typeof Chart === "undefined") return;
    var common = { plugins: { legend: { display: false } }, maintainAspectRatio: false, responsive: true };

    var trendEl = document.getElementById("rc-trend");
    if (trendEl) {
      var actual = DAYS.map(function (day) { return feelAvg(d.feel || {}, day); });
      var baseVal = actual[0];
      var base = DAYS.map(function () { return baseVal; });
      charts.push(new Chart(trendEl, {
        type: "line",
        data: {
          labels: ["D0", "D30", "D60", "D90"],
          datasets: [
            { data: actual, borderColor: "#0d9488", backgroundColor: "rgba(13,148,136,.08)", borderWidth: 2, fill: true, tension: .4, pointRadius: 2.5, pointBackgroundColor: "#0d9488", spanGaps: true },
            { data: base, borderColor: "#aab4bd", borderWidth: 1.5, borderDash: [4, 4], fill: false, pointRadius: 0 }
          ]
        },
        options: Object.assign({}, common, {
          scales: {
            y: { min: 0, max: 5, ticks: { stepSize: 1, font: { size: 9 }, color: "#aab4bd" }, grid: { color: "#f1f5f9" } },
            x: { grid: { display: false }, ticks: { font: { size: 9 }, color: "#aab4bd" } }
          }
        })
      }));
    }

    var radarEl = document.getElementById("rc-radar");
    if (radarEl) {
      var act = d.act || {};
      var keys = ["diet", "nutrition", "exercise", "sleep"];
      var d0 = keys.map(function (k) { return num(act[k] && act[k].d0); });
      var d90 = keys.map(function (k) { return num(act[k] && act[k].d90); });
      charts.push(new Chart(radarEl, {
        type: "radar",
        data: {
          labels: t.radar,
          datasets: [
            { data: d0, borderColor: "#cbd5e1", backgroundColor: "rgba(203,213,225,.2)", borderWidth: 1.5, pointRadius: 1.5 },
            { data: d90, borderColor: "#0d9488", backgroundColor: "rgba(13,148,136,.15)", borderWidth: 1.5, pointRadius: 2, pointBackgroundColor: "#0d9488" }
          ]
        },
        options: Object.assign({}, common, {
          scales: { r: { min: 0, max: 5, ticks: { display: false, stepSize: 1 }, grid: { color: "#eceff1" }, angleLines: { color: "#eceff1" }, pointLabels: { font: { size: 11, weight: "bold" }, color: "#475569" } } }
        })
      }));
    }
  }

  function renderReport(container, data, lang) {
    destroyCharts();
    container.innerHTML = buildHTML(data, lang || "zh");
    drawCharts(data, lang || "zh");
  }

  global.YoungerReport = { render: renderReport, I18N: I18N, ACCOUNT_URL: ACCOUNT_URL };
})(window);
