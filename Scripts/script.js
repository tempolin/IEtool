// GitHub上のCSV（raw）URL
const CSV_URL =
  "https://raw.githubusercontent.com/tempolin/IEtool/refs/heads/main/CSV/soubi_clean.csv";

let gHeaders = [];
let gOriginalRows = [];
let gFilteredRows = [];

// 列番号
const POSITION_COL = 0;
const TYPE_COL = 1;      // 装備種類
const PRIORITY_COL = 2;
const SHOP_COL = 4;

// カスタム順序
const POSITION_ORDER = ["FW", "AMF", "DMF", "ADF", "DDF", "GK"];
const SHOP_ORDER = ["クロニクル百貨店", "VSストア", "スピリット交換所"];
const TYPE_ORDER = ["シューズ", "ミサンガ", "ペンダント", "スペシャル"]; // 装備種類の順序

// --------------------
// ■ 優先度フィルタ（非表示にするだけ）
// --------------------
function getPriorityFilterValues() {
  const checks = document.querySelectorAll("#priority-filter input[type=checkbox]");
  return [...checks]
    .filter(c => c.checked)
    .map(c => c.value);
}

// --------------------
// ■ ポジションフィルタ（非表示にするだけ）
// --------------------
function getPositionFilterValues() {
  const checks = document.querySelectorAll("#position-filter input[type=checkbox]");
  const checked = [...checks].filter(c => c.checked).map(c => c.value);

  // 全部外したら「全ポジション表示」と同じ扱いにする
  if (checked.length === 0) {
    return POSITION_ORDER.slice();
  }
  return checked;
}

// --------------------
// ■ 装備種類フィルタ（非表示にするだけ）
// --------------------
function getTypeFilterValues() {
  const checks = document.querySelectorAll("#type-filter input[type=checkbox]");
  const checked = [...checks].filter(c => c.checked).map(c => c.value);

  // 全部外したら「全種類表示」と同じ扱いにする
  if (checked.length === 0) {
    return TYPE_ORDER.slice();
  }
  return checked;
}

// --------------------
// ■ ソート状態
// --------------------
let gSortState = {
  keys: [],          // ソート対象列（[primary, secondary, ...]）
  directions: {}     // 列ごとの昇順/降順 ("asc" / "desc")
};

// --------------------
// ■ CSV パース（★ 各セルを trim するよう修正 ★）
// --------------------
function parseCSV(text) {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n");

  const headers = lines[0].split(",").map(h => h.trim());

  const rows = lines.slice(1).map(line =>
    line.split(",").map(c => c.trim())
  );

  return { headers, rows };
}

// --------------------
// ■ テーブル描画
// --------------------
function createHeader(headers) {
  const thead = document.querySelector("#soubi-table thead");
  thead.innerHTML = "";
  const tr = document.createElement("tr");

  headers.forEach((h, idx) => {
    const th = document.createElement("th");
    th.textContent = h;
    th.dataset.index = idx;
    th.dataset.baseName = h;
    tr.appendChild(th);
  });

  thead.appendChild(tr);
}

function renderBody(rows) {
  const tbody = document.querySelector("#soubi-table tbody");
  tbody.innerHTML = "";

  rows.forEach(row => {
    const tr = document.createElement("tr");
    row.forEach(cell => {
      const td = document.createElement("td");
      td.textContent = cell;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
}

// --------------------
// ■ 比較関数
// --------------------
function compareCells(a, b) {
  const aNum = parseFloat(a);
  const bNum = parseFloat(b);
  if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
  return String(a).localeCompare(String(b), "ja");
}

function compareByOrder(a, b, orderList) {
  const iA = orderList.indexOf(a);
  const iB = orderList.indexOf(b);
  if (iA !== -1 || iB !== -1) {
    if (iA === -1) return 1;
    if (iB === -1) return -1;
    return iA - iB;
  }
  return compareCells(a, b);
}

// --------------------
// ■ ソート + 各種フィルタ適用
// --------------------
function applySortAndRender() {
  const priorityValues = getPriorityFilterValues();
  const positionValues = getPositionFilterValues();
  const typeValues = getTypeFilterValues();

  // 優先度＆ポジション＆装備種類フィルタ
  let rows = gOriginalRows.filter(row =>
    priorityValues.includes(row[PRIORITY_COL]) &&
    positionValues.includes(row[POSITION_COL]) &&
    typeValues.includes(row[TYPE_COL])
  );

  const keys = gSortState.keys;

  // ソート指定がない場合は、そのまま表示
  if (keys.length === 0) {
    gFilteredRows = rows;
    updateHeaderIndicators();
    renderBody(gFilteredRows);
    return;
  }

  // ソート実行（keys[0] が一番強い → primary）
  rows.sort((a, b) => {
    for (const col of keys) {
      const vA = a[col] ?? "";
      const vB = b[col] ?? "";
      let diff = 0;

      if (col === POSITION_COL) {
        diff = compareByOrder(vA, vB, POSITION_ORDER);

      } else if (col === SHOP_COL) {
        // ① まずショップ順（クロニクル → VSストア → スピリット交換所）
        diff = compareByOrder(vA, vB, SHOP_ORDER);

        // ② ショップが同じなら装備種類でシューズ→ミサンガ→ペンダント→スペシャル
        if (diff === 0) {
          const tA = a[TYPE_COL] ?? "";
          const tB = b[TYPE_COL] ?? "";
          diff = compareByOrder(tA, tB, TYPE_ORDER);
        }

      } else if (col === TYPE_COL) {
        // 装備種類でソートしたとき
        diff = compareByOrder(vA, vB, TYPE_ORDER);

      } else {
        // 優先度含む、その他の列は通常比較
        diff = compareCells(vA, vB);
      }

      if (diff !== 0) {
        const dir = gSortState.directions[col] || "asc";
        return dir === "asc" ? diff : -diff;
      }
    }
    return 0;
  });

  gFilteredRows = rows;
  updateHeaderIndicators();
  renderBody(gFilteredRows);
}

// --------------------
// ■ ヘッダー表示更新
// --------------------
function updateHeaderIndicators() {
  const ths = document.querySelectorAll("#soubi-table thead th");
  const usedCols = gSortState.keys;

  ths.forEach(th => {
    const idx = Number(th.dataset.index);
    const baseName = th.dataset.baseName;

    th.classList.remove("sortable", "used", "asc", "desc");

    // ソート可能列
    if ([POSITION_COL, TYPE_COL, PRIORITY_COL, SHOP_COL].includes(idx)) {
      th.classList.add("sortable");
    }

    if (usedCols.length > 0 && usedCols.includes(idx)) {
      th.classList.add("used");
      const dir = gSortState.directions[idx] || "asc";
      th.classList.add(dir === "asc" ? "asc" : "desc");
    }

    th.textContent = baseName;
  });
}

// --------------------
// ■ ソートヘッダー設定
//   ▶ クリックした列を「先頭」にする（最後に押した列が一番強い）
//   ▶ ソート列数の制限なし
// --------------------
function setupSort() {
  const ths = document.querySelectorAll("#soubi-table thead th");

  [POSITION_COL, TYPE_COL, PRIORITY_COL, SHOP_COL].forEach(idx => {
    const th = ths[idx];
    if (!th) return;

    th.classList.add("sortable");

    th.addEventListener("click", () => {
      const keys = gSortState.keys;

      if (keys[0] === idx) {
        // 既に primary → 昇順/降順をトグル
        gSortState.directions[idx] =
          gSortState.directions[idx] === "asc" ? "desc" : "asc";
      } else {
        // 押した列を先頭に持ってくる（最後に押した列が最強）
        const newKeys = [idx, ...keys.filter(c => c !== idx)];
        gSortState.keys = newKeys;

        // 新しく primary になった列は asc からスタート（未設定なら）
        gSortState.directions[idx] = gSortState.directions[idx] || "asc";
      }

      applySortAndRender();
    });
  });
}

// --------------------
// ■ 優先度フィルタ UI
// --------------------
function setupPriorityFilterUI() {
  const checks = document.querySelectorAll("#priority-filter input[type=checkbox]");
  checks.forEach(cb => {
    cb.addEventListener("change", applySortAndRender);
  });
}

// --------------------
// ■ ポジションフィルタ UI
// --------------------
function setupPositionFilterUI() {
  const checks = document.querySelectorAll("#position-filter input[type=checkbox]");
  checks.forEach(cb => {
    cb.addEventListener("change", applySortAndRender);
  });
}

// --------------------
// ■ 装備種類フィルタ UI
// --------------------
function setupTypeFilterUI() {
  const checks = document.querySelectorAll("#type-filter input[type=checkbox]");
  checks.forEach(cb => {
    cb.addEventListener("change", applySortAndRender);
  });
}

// --------------------
// ■ リセットボタン
// --------------------
function setupResetButton() {
  const btn = document.getElementById("reset-sort");
  if (!btn) return;

  btn.addEventListener("click", () => {
    gSortState = { keys: [], directions: {} };
    applySortAndRender();
  });
}

// --------------------
// ■ 簡易ソートボタン（priority > shop > position）
// --------------------
function setupQuickSortButton() {
  const btn = document.getElementById("quick-sort");
  if (!btn) return;

  btn.addEventListener("click", () => {
    // priority > shop > position の強い順
    gSortState.keys = [PRIORITY_COL, SHOP_COL, POSITION_COL];

    gSortState.directions = {
      [PRIORITY_COL]: "asc",
      [SHOP_COL]: "asc",
      [POSITION_COL]: "asc"
    };

    applySortAndRender();
  });
}

// --------------------
// ■ 初期化
// --------------------
fetch(CSV_URL)
  .then(r => r.text())
  .then(text => {
    const { headers, rows } = parseCSV(text);

    gHeaders = headers;
    gOriginalRows = rows;

    createHeader(headers);
    setupSort();
    setupPriorityFilterUI();
    setupPositionFilterUI();
    setupTypeFilterUI();
    setupResetButton();
    setupQuickSortButton();

    applySortAndRender();
  })
  .catch(err => console.error(err));
