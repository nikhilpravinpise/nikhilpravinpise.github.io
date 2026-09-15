import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { bootApp, typeCommand, termText } from "./helpers/dom.js";

const ROOT = path.resolve(import.meta.dirname, "..");

let ctx;
before(async () => {
  ctx = await bootApp();
});
after(() => ctx.restore());

test("typed HTML is escaped in the prompt echo", () => {
  typeCommand(ctx.input, ctx.window, '<img src=x onerror="alert(1)">');
  assert.equal(ctx.term.querySelector("img"), null, "injected <img> rendered");
  assert.equal(ctx.term.querySelector("[onerror]"), null);
  // the literal text is echoed back visibly
  assert.ok(termText(ctx.term).join("\n").includes("<img src=x"));
});

test("script injection via echo command cannot create elements", () => {
  ctx.app.commands.run("echo <script>alert(1)</script>");
  assert.equal(ctx.term.querySelector("script"), null, "injected <script> rendered");
});

test("injection via command-not-found path is escaped", () => {
  ctx.app.commands.run("<svg onload=alert(1)>");
  assert.equal(ctx.term.querySelector("svg"), null);
});

test("history renders stored commands escaped", () => {
  ctx.app.commands.run("history -c");
  ctx.app.commands.run('<b>bold?</b>');
  ctx.app.commands.run("history");
  assert.equal(ctx.term.querySelector("b"), null, "injected <b> rendered");
  assert.ok(termText(ctx.term).join("\n").includes("<b>bold?</b>"));
});

test("all rendered links carry noopener noreferrer", () => {
  ctx.app.commands.run("projects");
  ctx.app.commands.run("contact");
  ctx.app.commands.run("repos");
  const bad = [...ctx.term.querySelectorAll('a[target="_blank"]')].filter(
    (a) => !(a.getAttribute("rel") || "").includes("noopener"),
  );
  assert.equal(bad.length, 0, `${bad.length} links missing rel=noopener`);
});

test("innerHTML sinks stay limited to the reviewed set", () => {
  // Regression guard: innerHTML is only allowed where reviewed -
  // terminal.js line()/clear() (always fed escaped or static content),
  // the static statsBox markup in app.js, and static card markup in
  // contributions.js. A new sink means re-reviewing escaping.
  let count = 0;
  for (const f of fs.readdirSync(path.join(ROOT, "assets"), { recursive: true })) {
    const rel = String(f).replace(/\\/g, "/");
    if (!rel.endsWith(".js") || rel === "fallback.js") continue;
    const text = fs.readFileSync(path.join(ROOT, "assets", rel), "utf8");
    const matches = text.match(/\.innerHTML\s*=/g) || [];
    count += matches.length;
    if (matches.length) {
      assert.ok(
        ["terminal.js", "app.js", "contributions.js"].includes(rel),
        `unexpected innerHTML sink in assets/${rel}`,
      );
    }
  }
  assert.ok(count <= 5, `innerHTML sink count grew to ${count} - re-review escaping`);
});
