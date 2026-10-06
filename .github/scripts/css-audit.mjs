import fs from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git" || entry.name === ".output") continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

const sourceFiles = walk(path.join(root, "src")).filter((p) => /\.(ts|tsx|js|jsx)$/.test(p));
const usedClassTokens = new Set();

function addClassText(value) {
  for (const token of value.split(/\s+/)) {
    if (token && /^[A-Za-z0-9_-]+$/.test(token)) usedClassTokens.add(token);
  }
}

function collectClassExpression(node) {
  if (!node) return;
  if (ts.isStringLiteralLike(node)) addClassText(node.text);
  if (ts.isTemplateExpression(node)) {
    addClassText(node.head.text);
    for (const span of node.templateSpans) addClassText(span.literal.text);
  }
  ts.forEachChild(node, collectClassExpression);
}

for (const file of sourceFiles) {
  const source = fs.readFileSync(file, "utf8");
  const sf = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );

  function visit(node) {
    if (
      ts.isJsxAttribute(node) &&
      node.name.getText(sf) === "className" &&
      node.initializer
    ) {
      if (ts.isStringLiteral(node.initializer)) addClassText(node.initializer.text);
      else if (ts.isJsxExpression(node.initializer) && node.initializer.expression) {
        collectClassExpression(node.initializer.expression);
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(sf);
}

const cssPaths = [
  "src/styles.css",
  "src/styles/app-shell.css",
  "src/features/open-now-niches/open-now.css",
  "src/features/opportunities/opportunities.css",
];

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

function parseRules(css) {
  const rules = [];
  function scan(text, offset = 0, media = []) {
    let i = 0;
    while (i < text.length) {
      while (i < text.length && /\s/.test(text[i])) i++;
      if (i >= text.length) break;
      const start = i;
      let quote = null;
      let paren = 0;
      while (i < text.length) {
        const ch = text[i];
        if (quote) {
          if (ch === "\\\\") i++;
          else if (ch === quote) quote = null;
        } else {
          if (ch === '"' || ch === "'") quote = ch;
          else if (ch === "(") paren++;
          else if (ch === ")") paren--;
          else if (ch === "{" && paren === 0) break;
        }
        i++;
      }
      if (i >= text.length) break;
      const prelude = text.slice(start, i).trim();
      const open = i++;
      let depth = 1;
      quote = null;
      while (i < text.length && depth) {
        const ch = text[i];
        if (quote) {
          if (ch === "\\\\") i++;
          else if (ch === quote) quote = null;
        } else {
          if (ch === '"' || ch === "'") quote = ch;
          else if (ch === "{") depth++;
          else if (ch === "}") depth--;
        }
        i++;
      }
      const close = i - 1;
      const body = text.slice(open + 1, close);
      if (prelude.startsWith("@media") || prelude.startsWith("@supports") || prelude.startsWith("@container")) {
        scan(body, offset + open + 1, [...media, prelude]);
      } else if (!prelude.startsWith("@")) {
        rules.push({ selector: prelude, body, media, start: offset + start, end: offset + i });
      }
    }
  }
  scan(stripComments(css));
  return rules;
}

function classesFromSelector(selector) {
  return [...selector.matchAll(/\.([A-Za-z_][\w-]*)/g)].map((m) => m[1]);
}

function tokenUsage(cls) {
  return usedClassTokens.has(cls) ? 1 : 0;
}

const dynamicAllow = new Set([
  "active","selected","inline","compact","danger","high","medium","low","positive","emphasis",
  "send_message","waiting","accepted","rejected","open","closed","important","level-"
]);

const cssData = {};
for (const rel of cssPaths) {
  const text = fs.readFileSync(path.join(root, rel), "utf8");
  const rules = parseRules(text);
  cssData[rel] = { text, rules };
}

for (const rel of cssPaths) {
  const { text, rules } = cssData[rel];
  const classSet = new Set(rules.flatMap((r) => classesFromSelector(r.selector)));
  const unused = [...classSet].filter((c) => tokenUsage(c) === 0 && !dynamicAllow.has(c)).sort();
  console.log("\\n### FILE", rel, "chars", text.length, "lines", text.split("\\n").length);
  console.log("UNUSED_CLASS_CANDIDATES", JSON.stringify(unused));
}

const oldNav = [
  "app-shell","topbar","topbar-inner","topbar-actions","topnav","nav-link","brand","brand-mark",
  "brand-word","brand-accent","logout-button","open-now-nav-full","open-now-nav-short"
];
console.log("\\n### JSX_CLASS_TOKEN_COUNT", usedClassTokens.size);
console.log("\\n### OLD_NAV_USAGE");
for (const cls of oldNav) console.log(cls, tokenUsage(cls));

console.log("\\n### SAME SELECTOR IN styles.css + app-shell.css");
const left = new Map(cssData["src/styles.css"].rules.map((r) => [r.selector.replace(/\s+/g," ").trim(), r]));
const right = new Map(cssData["src/styles/app-shell.css"].rules.map((r) => [r.selector.replace(/\s+/g," ").trim(), r]));
for (const selector of [...left.keys()].filter((s) => right.has(s)).sort()) console.log(selector);

console.log("\\n### REPEATED EXACT SELECTORS styles.css");
const counts = new Map();
for (const r of cssData["src/styles.css"].rules) {
  const s = r.selector.replace(/\s+/g," ").trim();
  counts.set(s, (counts.get(s) || 0) + 1);
}
for (const [s,n] of [...counts].filter(([,n]) => n > 1).sort((a,b)=>b[1]-a[1])) console.log(n, s);

console.log("\\n### COMMENTS");
for (const rel of ["src/styles.css","src/styles/app-shell.css"]) {
  const text = cssData[rel].text;
  const comments = [...text.matchAll(/\/\*([\s\S]*?)\*\//g)].map((m) => m[1].trim().replace(/\s+/g," "));
  console.log(rel, JSON.stringify(comments));
}
