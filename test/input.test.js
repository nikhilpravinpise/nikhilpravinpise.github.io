import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { bootApp, key, typeCommand, termText } from "./helpers/dom.js";

let ctx;
before(async () => {
  ctx = await bootApp();
});
after(() => ctx.restore());

function lines() {
  return termText(ctx.term).join("\n");
}

test("Enter runs the command and clears the input", () => {
  typeCommand(ctx.input, ctx.window, "whoami");
  assert.equal(ctx.input.value, "");
  assert.ok(lines().includes("DJSCE"));
});

test("empty Enter echoes a bare prompt line and no output", () => {
  const before = ctx.term.querySelectorAll(".line").length;
  typeCommand(ctx.input, ctx.window, "   ");
  const all = [...ctx.term.querySelectorAll(".line")];
  const added = all.slice(before);
  assert.equal(added.length, 1);
  assert.ok(added[0].classList.contains("prompt-line"));
});

test("ArrowUp recalls history, ArrowDown restores the draft", () => {
  typeCommand(ctx.input, ctx.window, "firstcmd-aaa");
  typeCommand(ctx.input, ctx.window, "secondcmd-bbb");
  ctx.input.value = "my draft";
  key(ctx.input, ctx.window, "ArrowUp");
  assert.equal(ctx.input.value, "secondcmd-bbb");
  key(ctx.input, ctx.window, "ArrowUp");
  assert.equal(ctx.input.value, "firstcmd-aaa");
  key(ctx.input, ctx.window, "ArrowDown");
  assert.equal(ctx.input.value, "secondcmd-bbb");
  key(ctx.input, ctx.window, "ArrowDown");
  assert.equal(ctx.input.value, "my draft", "draft not restored");
});

test("repeated identical commands are deduped in history", () => {
  ctx.app.commands.run("history -c");
  typeCommand(ctx.input, ctx.window, "whoami");
  typeCommand(ctx.input, ctx.window, "whoami");
  assert.deepEqual(ctx.app.state.history, ["whoami"]);
});

test("Tab completes a unique command with trailing space", () => {
  ctx.input.value = "proj";
  key(ctx.input, ctx.window, "Tab");
  assert.equal(ctx.input.value, "projects ");
});

test("Tab lists ambiguous matches", () => {
  ctx.input.value = "co";
  key(ctx.input, ctx.window, "Tab");
  const t = lines();
  assert.ok(t.includes("contributions") && t.includes("contact") && t.includes("copy"));
});

test("Tab completes `open` sub-arguments", () => {
  ctx.input.value = "open lin";
  key(ctx.input, ctx.window, "Tab");
  assert.equal(ctx.input.value, "open linkedin ");
});

test("Tab completes `theme` sub-arguments", () => {
  ctx.input.value = "theme am";
  key(ctx.input, ctx.window, "Tab");
  assert.equal(ctx.input.value, "theme amber ");
  ctx.input.value = "";
});

test("Ctrl+L clears the terminal", () => {
  typeCommand(ctx.input, ctx.window, "whoami");
  key(ctx.input, ctx.window, "l", { ctrlKey: true });
  assert.ok(!lines().includes("DJSCE"));
  assert.ok(lines().includes("connected to github.com"));
});

test("Ctrl+C echoes ^C and clears the input", () => {
  ctx.input.value = "half-typed";
  key(ctx.input, ctx.window, "c", { ctrlKey: true });
  assert.equal(ctx.input.value, "");
  assert.ok(lines().includes("^C"));
});

test("Ctrl+U clears the input", () => {
  ctx.input.value = "half-typed";
  key(ctx.input, ctx.window, "u", { ctrlKey: true });
  assert.equal(ctx.input.value, "");
});

test("history persists to localStorage across sessions", async () => {
  ctx.app.commands.run("history -c");
  typeCommand(ctx.input, ctx.window, "persisted-xyz");
  const stored = JSON.parse(ctx.window.localStorage.getItem("npp:history"));
  assert.ok(stored.includes("persisted-xyz"));

  // commands sync to the #hash as deep links - clear it so the reboot
  // doesn't auto-run the last command
  ctx.window.history.replaceState(null, "", "#");

  // a second boot in the same window restores it
  await import(`../assets/app.js?reboot=${Date.now()}`);
  await ctx.window.__appReady;
  assert.ok(ctx.window.__app.state.history.includes("persisted-xyz"));
  assert.deepEqual(ctx.window.__app.state.history.slice(0, -1), ["persisted-xyz"]); // + whoami from boot
});

test("deep link ?cmd=projects auto-runs the command", async () => {
  const deep = await bootApp({ url: "https://nikhilpravinpise.github.io/?cmd=projects" });
  assert.ok(termText(deep.term).join("\n").includes("Cairn"));
  deep.restore();
});

test("deep link #streak auto-runs the command", async () => {
  const deep = await bootApp({ url: "https://nikhilpravinpise.github.io/#streak" });
  const t = termText(deep.term).join("\n");
  assert.ok(t.includes("streak"));
  deep.restore();
});

test("bogus deep link does not print 'command not found'", async () => {
  const deep = await bootApp({ url: "https://nikhilpravinpise.github.io/#nonexistent-cmd" });
  const t = termText(deep.term).join("\n");
  assert.ok(!t.includes("command not found: nonexistent"));
  deep.restore();
});

test("running a command syncs the location hash", () => {
  typeCommand(ctx.input, ctx.window, "skills");
  assert.equal(ctx.window.location.hash, "#skills");
});
