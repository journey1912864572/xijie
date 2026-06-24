const demoQuestions = [
  {
    id: "demo-1",
    chapter: "示例章节",
    type: "single",
    prompt: "这是一道单选示例题，导入你的题库后可以删除。",
    options: ["选项 A", "选项 B", "选项 C", "选项 D"],
    answer: ["选项 B"],
    explanation: "示例解析。"
  },
  {
    id: "demo-2",
    chapter: "示例章节",
    type: "multiple",
    prompt: "多选题支持多个正确答案。",
    options: ["答案一", "答案二", "干扰项"],
    answer: ["答案一", "答案二"],
    explanation: "多选答案用竖线分隔。"
  }
];

const els = {
  chapterList: document.querySelector("#chapterList"),
  questionTotal: document.querySelector("#questionTotal"),
  currentChapter: document.querySelector("#currentChapter"),
  questionTitle: document.querySelector("#questionTitle"),
  optionList: document.querySelector("#optionList"),
  textAnswer: document.querySelector("#textAnswer"),
  feedback: document.querySelector("#feedback"),
  submitAnswer: document.querySelector("#submitAnswer"),
  nextQuestion: document.querySelector("#nextQuestion"),
  masterQuestion: document.querySelector("#masterQuestion"),
  wrongTimes: document.querySelector("#wrongTimes"),
  answeredCount: document.querySelector("#answeredCount"),
  accuracyRate: document.querySelector("#accuracyRate"),
  wrongCount: document.querySelector("#wrongCount"),
  modeAll: document.querySelector("#modeAll"),
  modeWrong: document.querySelector("#modeWrong"),
  importFile: document.querySelector("#importFile"),
  bulkImportText: document.querySelector("#bulkImportText"),
  bulkImport: document.querySelector("#bulkImport"),
  exportAll: document.querySelector("#exportAll"),
  syncEndpoint: document.querySelector("#syncEndpoint"),
  syncKey: document.querySelector("#syncKey"),
  saveSync: document.querySelector("#saveSync"),
  syncNow: document.querySelector("#syncNow"),
  syncStatus: document.querySelector("#syncStatus")
};

const sampleQuestions = Array.isArray(window.chapterBankQuestions) && window.chapterBankQuestions.length
  ? window.chapterBankQuestions
  : demoQuestions;

const storageKey = "chapter-bank-v3";
let state = loadState();
let view = {
  mode: "all",
  chapter: "全部",
  index: 0,
  answeredCurrent: false
};

function loadState() {
  const saved = localStorage.getItem(storageKey);
  if (saved) return JSON.parse(saved);
  return {
    questions: sampleQuestions,
    stats: {},
    sync: { endpoint: "", key: "" }
  };
}

function saveState() {
  localStorage.setItem(storageKey, JSON.stringify(state));
}

function normalizeQuestion(raw, idx) {
  const type = raw.type || "single";
  const options = Array.isArray(raw.options)
    ? raw.options
    : String(raw.options || "").split("|").map(item => item.trim()).filter(Boolean);
  const answer = Array.isArray(raw.answer)
    ? raw.answer
    : String(raw.answer || "").split("|").map(item => item.trim()).filter(Boolean);
  return {
    id: raw.id || `q-${Date.now()}-${idx}`,
    chapter: raw.chapter || "未分章",
    type,
    prompt: raw.prompt || raw.question || "",
    options,
    answer,
    explanation: raw.explanation || ""
  };
}

function statFor(id) {
  if (!state.stats[id]) {
    state.stats[id] = { attempts: 0, correct: 0, wrong: 0 };
  }
  return state.stats[id];
}

function chapters() {
  return ["全部", ...new Set(state.questions.map(q => q.chapter))];
}

function activeQuestions() {
  return state.questions.filter(q => {
    const inChapter = view.chapter === "全部" || q.chapter === view.chapter;
    const inMode = view.mode === "all" || statFor(q.id).wrong > 0;
    return inChapter && inMode;
  });
}

function currentQuestion() {
  const list = activeQuestions();
  if (!list.length) return null;
  return list[Math.min(view.index, list.length - 1)];
}

function render() {
  renderChapters();
  renderStats();
  renderQuestion();
  els.modeAll.classList.toggle("active", view.mode === "all");
  els.modeWrong.classList.toggle("active", view.mode === "wrong");
  els.syncEndpoint.value = state.sync.endpoint || "";
  els.syncKey.value = state.sync.key || "";
  els.syncStatus.textContent = state.sync.endpoint ? "已配置" : "本地";
}

function renderChapters() {
  els.chapterList.innerHTML = "";
  els.questionTotal.textContent = `${state.questions.length} 题`;
  for (const chapter of chapters()) {
    const count = chapter === "全部"
      ? state.questions.length
      : state.questions.filter(q => q.chapter === chapter).length;
    const button = document.createElement("button");
    button.type = "button";
    button.className = chapter === view.chapter ? "active" : "";
    button.textContent = `${chapter} · ${count}`;
    button.addEventListener("click", () => {
      view.chapter = chapter;
      view.index = 0;
      view.answeredCurrent = false;
      render();
    });
    els.chapterList.appendChild(button);
  }
}

function renderStats() {
  const values = Object.values(state.stats);
  const attempts = values.reduce((sum, item) => sum + item.attempts, 0);
  const correct = values.reduce((sum, item) => sum + item.correct, 0);
  const wrong = values.filter(item => item.wrong > 0).length;
  els.answeredCount.textContent = attempts;
  els.accuracyRate.textContent = attempts ? `${Math.round((correct / attempts) * 100)}%` : "0%";
  els.wrongCount.textContent = wrong;
}

function renderQuestion() {
  const q = currentQuestion();
  els.feedback.className = "feedback";
  els.feedback.textContent = "";
  els.optionList.innerHTML = "";
  els.textAnswer.style.display = "none";
  els.textAnswer.value = "";
  els.masterQuestion.style.display = q && statFor(q.id).wrong > 0 ? "inline-flex" : "none";

  if (!q) {
    els.currentChapter.textContent = view.mode === "wrong" ? "错题本为空" : "无题目";
    els.questionTitle.textContent = view.mode === "wrong" ? "当前筛选下没有错题" : "请先导入题目";
    els.wrongTimes.textContent = "";
    return;
  }

  const stats = statFor(q.id);
  els.currentChapter.textContent = q.chapter;
  els.questionTitle.textContent = q.prompt;
  els.wrongTimes.textContent = stats.wrong ? `错 ${stats.wrong} 次` : "";

  if (q.type === "text") {
    els.textAnswer.style.display = "block";
  } else {
    q.options.forEach((option, index) => {
      const label = document.createElement("label");
      label.className = "option";
      const input = document.createElement("input");
      input.type = q.type === "multiple" ? "checkbox" : "radio";
      input.name = "answer";
      input.value = option;
      const span = document.createElement("span");
      span.textContent = `${String.fromCharCode(65 + index)}. ${option}`;
      label.append(input, span);
      els.optionList.appendChild(label);
    });
  }
}

function selectedAnswer(q) {
  if (q.type === "text") return [els.textAnswer.value.trim()];
  return [...document.querySelectorAll("[name='answer']:checked")].map(input => input.value);
}

function sameAnswer(a, b) {
  const clean = arr => arr.map(item => String(item).trim()).filter(Boolean).sort();
  return JSON.stringify(clean(a)) === JSON.stringify(clean(b));
}

function submitAnswer() {
  const q = currentQuestion();
  if (!q || view.answeredCurrent) return;
  const picked = selectedAnswer(q);
  if (!picked.length || picked.every(item => !item)) {
    showFeedback(false, "请先作答。");
    return;
  }

  const ok = sameAnswer(picked, q.answer);
  const stats = statFor(q.id);
  stats.attempts += 1;
  if (ok) stats.correct += 1;
  else stats.wrong += 1;
  view.answeredCurrent = true;
  saveState();
  showFeedback(ok, ok ? `正确。${q.explanation || ""}` : `错误。正确答案：${q.answer.join("、")}。${q.explanation || ""}`);
  renderStats();
  els.wrongTimes.textContent = stats.wrong ? `错 ${stats.wrong} 次` : "";
  els.masterQuestion.style.display = stats.wrong > 0 ? "inline-flex" : "none";
  syncState(false);
}

function showFeedback(ok, text) {
  els.feedback.className = `feedback ${ok ? "ok" : "bad"}`;
  els.feedback.textContent = text;
}

function nextQuestion() {
  const list = activeQuestions();
  if (!list.length) return;
  view.index = (view.index + 1) % list.length;
  view.answeredCurrent = false;
  renderQuestion();
}

async function importQuestions(file) {
  const text = await file.text();
  const rows = file.name.toLowerCase().endsWith(".json") ? JSON.parse(text) : parseCsv(text);
  importRows(rows);
}

function importText(text) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error("请先粘贴 JSON 内容");
  importRows(JSON.parse(trimmed));
}

function importRows(rows) {
  const list = Array.isArray(rows) ? rows : rows.questions;
  if (!Array.isArray(list)) throw new Error("导入文件不是题目数组");
  state.questions = list.map(normalizeQuestion).filter(q => q.prompt);
  view.chapter = "全部";
  view.index = 0;
  view.answeredCurrent = false;
  saveState();
  render();
}

function parseCsv(text) {
  const lines = text.replace(/\r/g, "").split("\n").filter(Boolean);
  const headers = splitCsvLine(lines.shift()).map(h => h.trim());
  return lines.map(line => {
    const cells = splitCsvLine(line);
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] || ""]));
  });
}

function splitCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"' && line[i + 1] === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current);
  return cells;
}

function exportAll() {
  const payload = JSON.stringify(state, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "chapter-bank-export.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function syncState(showMessage = true) {
  if (!state.sync.endpoint) return;
  try {
    const res = await fetch(state.sync.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sync-Key": state.sync.key || ""
      },
      body: JSON.stringify({ stats: state.stats, updatedAt: new Date().toISOString() })
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    els.syncStatus.textContent = "已同步";
    if (showMessage) showFeedback(true, "同步完成。");
  } catch (err) {
    els.syncStatus.textContent = "同步失败";
    if (showMessage) showFeedback(false, `同步失败：${err.message}`);
  }
}

els.submitAnswer.addEventListener("click", submitAnswer);
els.nextQuestion.addEventListener("click", nextQuestion);
els.masterQuestion.addEventListener("click", () => {
  const q = currentQuestion();
  if (!q) return;
  statFor(q.id).wrong = 0;
  saveState();
  view.answeredCurrent = false;
  render();
  syncState(false);
});
els.modeAll.addEventListener("click", () => {
  view.mode = "all";
  view.index = 0;
  view.answeredCurrent = false;
  render();
});
els.modeWrong.addEventListener("click", () => {
  view.mode = "wrong";
  view.index = 0;
  view.answeredCurrent = false;
  render();
});
els.importFile.addEventListener("change", event => {
  const file = event.target.files[0];
  if (!file) return;
  importQuestions(file).catch(err => showFeedback(false, `导入失败：${err.message}`));
  event.target.value = "";
});
els.bulkImport.addEventListener("click", () => {
  try {
    importText(els.bulkImportText.value);
    els.bulkImportText.value = "";
    showFeedback(true, "粘贴导入完成。");
  } catch (err) {
    showFeedback(false, `粘贴导入失败：${err.message}`);
  }
});
els.exportAll.addEventListener("click", exportAll);
els.saveSync.addEventListener("click", () => {
  state.sync.endpoint = els.syncEndpoint.value.trim();
  state.sync.key = els.syncKey.value.trim();
  saveState();
  render();
});
els.syncNow.addEventListener("click", () => syncState(true));

render();
