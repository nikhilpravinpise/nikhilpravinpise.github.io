import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { bootApp, termText } from "./helpers/dom.js";
import { PROFILE } from "../assets/profile.js";

let ctx;
before(async () => {
  ctx = await bootApp();
});
after(() => ctx.restore());

function lines() {
  return termText(ctx.term).join("\n");
}

test("boot: banner, prompt echo and stat cards render", () => {
  assert.ok(ctx.document.getElementById("bannerArt").textContent.length > 50);
  assert.ok(lines().includes("connected to github.com/nikhilpravinpise"));
  assert.equal(ctx.document.querySelectorAll(".stat").length, 4);
});

test("data loaded: stats show fixture totals", async () => {
  assert.ok(ctx.app.state.data, "data should be loaded after ready");
  // boot a reduced-motion app so countUp writes final values synchronously
  const reduced = await bootApp({ reducedMotion: true });
  const nums = [...reduced.document.querySelectorAll(".stat .num")].map((n) => n.textContent);
  assert.deepEqual(nums.map((s) => s.replace(/,/g, "")), [
    String(reduced.app.state.data.total_contributions),
    "8",
    "14",
    "40",
  ]);
  reduced.restore();
});

test("every visible command runs without throwing and prints output", () => {
  for (const c of ctx.app.commands.registry) {
    if (c.hidden) continue;
    const before = ctx.term.querySelectorAll(".line").length;
    assert.doesNotThrow(() => ctx.app.commands.run(c.name), c.name);
    if (c.name !== "clear") {
      // `clear` removes lines by design; assert its home reprint instead
      const after = ctx.term.querySelectorAll(".line").length;
      assert.ok(after > before, `${c.name} produced no output`);
    } else {
      assert.ok(lines().includes("connected to github.com"));
    }
  }
});

test("whoami prints the profile bio", () => {
  ctx.app.commands.run("whoami");
  assert.ok(lines().includes("DJSCE"));
  assert.ok(lines().includes("IIT Guwahati"));
});

test("about is an alias of whoami", () => {
  ctx.term.innerHTML = "";
  ctx.app.commands.run("about");
  assert.ok(lines().includes("DJSCE"));
});

test("experience prints all roles", () => {
  ctx.app.commands.run("experience");
  for (const [, role, org] of PROFILE.experience) {
    assert.ok(lines().includes(role), role);
    assert.ok(lines().includes(org), org);
  }
});

test("skills prints all groups", () => {
  ctx.app.commands.run("skills");
  for (const [k] of PROFILE.skills) assert.ok(lines().includes(k));
  assert.ok(lines().includes("PyTorch"));
});

test("projects prints every project with its url", () => {
  ctx.app.commands.run("projects");
  for (const [name, , url] of PROFILE.projects) {
    assert.ok(lines().includes(name), name);
    assert.ok(lines().includes(url), url);
  }
});

test("repos renders fixture repos with stars and language", () => {
  ctx.app.commands.run("repos");
  assert.ok(lines().includes("FixtureRepo"));
  assert.ok(lines().includes("NoLangRepo"));
  assert.ok(lines().includes("★7"));
});

test("contributions renders the heatmap with data", () => {
  ctx.app.commands.run("contributions");
  const grid = ctx.term.querySelector(".heatmap");
  assert.ok(grid, "heatmap grid missing");
  assert.ok(grid.querySelectorAll(".cell").length > 300);
});

test("streak prints fixture streak numbers", () => {
  ctx.app.commands.run("streak");
  const t = lines();
  assert.ok(t.includes("8 days"), "current streak 8");
  assert.ok(t.includes("14 days"), "longest streak 14");
  assert.ok(t.includes("40 contributions"), "best day 40");
});

test("graph prints monthly bars", () => {
  ctx.app.commands.run("graph");
  const t = lines();
  assert.ok(t.includes("2026-09"));
  assert.ok(t.includes("█"), "no bars rendered");
});

test("contact prints all links + email", () => {
  ctx.app.commands.run("contact");
  const hrefs = [...ctx.term.querySelectorAll("a")].map((a) => a.getAttribute("href"));
  for (const url of Object.values(PROFILE.links)) {
    assert.ok(hrefs.includes(url), `contact missing ${url}`);
  }
  assert.ok(lines().includes(PROFILE.email));
});

test("open: valid target, unknown target, and no arg", () => {
  ctx.app.commands.run("open portfolio");
  assert.ok(lines().includes("opening portfolio"));
  ctx.app.commands.run("open nonsense");
  assert.ok(lines().includes("usage: open"));
  ctx.app.commands.run("open");
  assert.ok(lines().includes("usage: open"));
});

test("copy: email goes to clipboard, bad target shows usage", async () => {
  await ctx.app.commands.registry.find((c) => c.name === "copy").run(["email"]);
  assert.ok(ctx.clipboard.includes(PROFILE.email));
  ctx.app.commands.run("copy bogus");
  assert.ok(lines().includes("usage: copy"));
});

test("theme: lists themes, applies, persists, rejects bad names", () => {
  ctx.app.commands.run("theme");
  assert.ok(lines().includes("synthwave"));
  ctx.app.commands.run("theme amber");
  assert.equal(ctx.document.documentElement.dataset.theme, "amber");
  assert.equal(ctx.window.localStorage.getItem("npp:theme"), "amber");
  ctx.app.commands.run("theme bogus");
  assert.ok(lines().includes("unknown theme"));
  ctx.app.commands.run("theme dark"); // restore for later tests
});

test("matrix toggles the canvas", () => {
  const canvas = ctx.document.getElementById("matrixCanvas");
  // ensure we start from off regardless of earlier test order
  while (canvas.style.display === "block") ctx.app.commands.run("matrix");
  ctx.app.commands.run("matrix");
  assert.equal(canvas.style.display, "block", "toggle on failed");
  ctx.app.commands.run("matrix");
  assert.equal(canvas.style.display, "none", "toggle off failed");
});

test("matrix refuses under reduced motion", async () => {
  const reduced = await bootApp({ reducedMotion: true });
  reduced.app.commands.run("matrix");
  assert.ok(termText(reduced.term).join("\n").includes("reduced motion"));
  assert.equal(reduced.document.getElementById("matrixCanvas").style.display, "");
  reduced.restore();
});

test("banner reprints ASCII art", () => {
  ctx.app.commands.run("banner");
  const pre = ctx.term.querySelector("pre");
  assert.ok(pre && pre.textContent.length > 50);
});

test("history lists and -c clears", () => {
  ctx.app.commands.run("history");
  assert.ok(lines().includes("whoami"), "history should list whoami");
  ctx.app.commands.run("history -c");
  // the `history -c` entry itself was pushed, then the list was cleared
  assert.equal(ctx.app.state.history.length, 0);
  ctx.app.commands.run("history");
  assert.deepEqual(ctx.app.state.history, ["history"]); // only the call itself
});

test("clear wipes the pane and reprints home", () => {
  ctx.app.commands.run("clear");
  const t = lines();
  assert.ok(t.includes("connected to github.com/nikhilpravinpise"));
  assert.ok(!t.includes("FixtureRepo"));
});

test("hidden easter eggs work: sudo, exit, echo, date, vim", () => {
  ctx.app.commands.run("sudo rm -rf /");
  assert.ok(lines().includes("nice try"));
  ctx.app.commands.run("exit");
  assert.ok(lines().includes("no escape"));
  ctx.app.commands.run("echo hello world");
  assert.ok(lines().includes("hello world"));
  ctx.app.commands.run("date");
  assert.ok(lines().includes("202")); // year in Date.toString
  ctx.app.commands.run("vim");
  assert.ok(lines().includes("editor war"));
});

test("unknown command suggests the closest match", () => {
  ctx.app.commands.run("projetcs");
  assert.ok(lines().includes("did you mean 'projects'"));
  ctx.app.commands.run("zzzqqq");
  assert.ok(lines().includes("type 'help'"));
});

test("neofetch prints the info card", () => {
  ctx.app.commands.run("neofetch");
  const t = lines();
  assert.ok(t.includes("nikhil@github"));
  assert.ok(t.includes("OS:") || t.includes("OS"));
  assert.ok(t.includes("days on github"), "uptime missing");
});

test("chips dispatch their data-cmd", () => {
  const chip = ctx.document.querySelector('.chip[data-cmd="projects"]');
  chip.dispatchEvent(new ctx.window.MouseEvent("click", { bubbles: true }));
  assert.ok(lines().includes("Cairn"));
});
