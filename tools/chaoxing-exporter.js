/*
  Run this script in the browser console on a logged-in Chaoxing course page.
  It uses the current browser session only and downloads chapter-bank JSON.
*/
(async () => {
  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const clean = text => String(text || "").replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
  const absoluteUrl = href => {
    try {
      return new URL(href, location.href).href;
    } catch {
      return "";
    }
  };

  function visibleText(node) {
    const clone = node.cloneNode(true);
    clone.querySelectorAll("script,style,noscript,iframe,svg").forEach(item => item.remove());
    return clean(clone.innerText || clone.textContent || "");
  }

  function collectDocuments() {
    const docs = [document];
    document.querySelectorAll("iframe").forEach(frame => {
      try {
        if (frame.contentDocument) docs.push(frame.contentDocument);
      } catch {
        // Cross-origin frames cannot be inspected from the course page.
      }
    });
    return docs;
  }

  function collectCandidateLinks() {
    const keywords = /作业|章节测验|测验|测试|练习|习题|答题|work|job|quiz|test|exam/i;
    const links = [];
    for (const doc of collectDocuments()) {
      doc.querySelectorAll("a[href], [data-url], [onclick]").forEach(el => {
        const text = visibleText(el);
        const raw = el.getAttribute("href") || el.getAttribute("data-url") || "";
        let href = raw;
        const onclick = el.getAttribute("onclick") || "";
        const embedded = onclick.match(/https?:\/\/[^'")]+|\/[^'")]+/);
        if (!href && embedded) href = embedded[0];
        if (!href || href === "javascript:void(0)" || href === "#") return;
        const url = absoluteUrl(href);
        if (!url || !keywords.test(`${text} ${url}`)) return;
        links.push({ title: text || doc.title || "未命名作业", url });
      });
    }
    return [...new Map(links.map(item => [item.url, item])).values()];
  }

  function inferType(typeText, answer, options) {
    if (/多选|multiple/i.test(typeText)) return "multiple";
    if (/判断/.test(typeText)) return "single";
    if (!options.length) return "text";
    return answer.length > 1 ? "multiple" : "single";
  }

  function parseAnswer(text) {
    const answerMatch = text.match(/(?:正确答案|参考答案|答案)\s*[:：]\s*([^解析]+?)(?=\s*(?:解析|得分|我的答案|$))/);
    if (!answerMatch) return [];
    return answerMatch[1]
      .split(/[、,，;；|]/)
      .map(item => clean(item.replace(/^[A-Z]\s*[.、．]\s*/i, "")))
      .filter(Boolean);
  }

  function parseOptions(text) {
    const options = [];
    const pattern = /(?:^|\s)([A-H])\s*[.、．]\s*([\s\S]*?)(?=\s+[A-H]\s*[.、．]|\s*(?:正确答案|参考答案|答案|解析)\s*[:：]|$)/g;
    let match;
    while ((match = pattern.exec(text))) {
      const value = clean(match[2]);
      if (value && value.length < 500) options.push(value);
    }
    return options;
  }

  function parseQuestionBlock(node, chapter, index) {
    const text = visibleText(node);
    if (!text || !/(正确答案|参考答案|答案|[A-H]\s*[.、．])/.test(text)) return null;
    const typeMatch = text.match(/(单选题|多选题|判断题|填空题|简答题|论述题|问答题)/);
    const options = parseOptions(text);
    const answer = parseAnswer(text);
    const prompt = clean(
      text
        .replace(/^\d+\s*[.、．]\s*/, "")
        .replace(typeMatch ? typeMatch[0] : "", "")
        .replace(/[A-H]\s*[.、．][\s\S]*$/, "")
        .replace(/(?:正确答案|参考答案|答案)\s*[:：][\s\S]*$/, "")
    );
    if (!prompt || prompt.length < 3) return null;
    return {
      id: `chaoxing-${Date.now()}-${index}`,
      chapter,
      type: inferType(typeMatch ? typeMatch[0] : "", answer, options),
      prompt,
      options,
      answer,
      explanation: clean((text.match(/解析\s*[:：]\s*([\s\S]+)$/) || [])[1] || "")
    };
  }

  function parseQuestionsFromHtml(html, fallbackChapter) {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const chapter = clean(
      doc.querySelector("h1,h2,.chapter-name,.chapterName,.ZyTop h3,.work-title")?.textContent ||
      doc.title ||
      fallbackChapter
    );
    const selectors = [
      ".TiMu",
      ".questionLi",
      ".question",
      ".topic",
      ".subject",
      "[class*='TiMu']",
      "[class*='question']",
      "[class*='Question']"
    ];
    const blocks = [...doc.querySelectorAll(selectors.join(","))];
    const parsed = blocks.map((node, index) => parseQuestionBlock(node, chapter, index)).filter(Boolean);
    if (parsed.length) return parsed;

    const bodyText = visibleText(doc.body);
    const chunks = bodyText.split(/(?=\s*\d+\s*[.、．]\s*(?:单选题|多选题|判断题|填空题|简答题|论述题|问答题)?)/);
    return chunks.map((chunk, index) => {
      const wrapper = doc.createElement("div");
      wrapper.textContent = chunk;
      return parseQuestionBlock(wrapper, chapter, index);
    }).filter(Boolean);
  }

  async function fetchPage(item) {
    const response = await fetch(item.url, { credentials: "include" });
    if (!response.ok) throw new Error(`${response.status} ${item.url}`);
    const html = await response.text();
    return parseQuestionsFromHtml(html, item.title);
  }

  const links = collectCandidateLinks();
  const questions = [];
  console.log(`找到 ${links.length} 个疑似作业/测验链接，开始抓取。`);
  for (const [index, link] of links.entries()) {
    try {
      const list = await fetchPage(link);
      questions.push(...list);
      console.log(`[${index + 1}/${links.length}] ${link.title}: ${list.length} 题`);
    } catch (error) {
      console.warn(`[${index + 1}/${links.length}] 抓取失败: ${link.title}`, error);
    }
    await sleep(250);
  }

  const unique = [...new Map(questions.map(q => [`${q.chapter}\n${q.prompt}`, q])).values()];
  const blob = new Blob([JSON.stringify(unique, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `chaoxing-question-bank-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  console.log(`完成：导出 ${unique.length} 题。`);
})();
