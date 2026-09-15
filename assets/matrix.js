// Matrix digital rain on a fixed canvas behind the page.

export function createMatrix(canvas) {
  let on = false;
  let loop = 0;
  let drops = [];

  function colors() {
    const cs = getComputedStyle(document.documentElement);
    return {
      glyph: cs.getPropertyValue("--green").trim() || "#39d353",
      // "--matrix-fade" holds "r,g,b" channel values per theme
      fade: `rgba(${cs.getPropertyValue("--matrix-fade").trim() || "13,17,23"},0.12)`,
    };
  }

  function start() {
    const ctx = canvas.getContext && canvas.getContext("2d");
    if (!ctx) return; // canvas 2d unavailable (e.g. jsdom) - skip quietly
    const myLoop = ++loop; // invalidates any previous draw loop
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const cols = Math.floor(canvas.width / 14);
    drops = Array.from({ length: cols }, () => Math.floor(Math.random() * -35));
    const chars = "01アビヴァシシュタ<>/{}[]#*";
    const { glyph, fade } = colors();
    function draw() {
      if (!on || myLoop !== loop) return;
      ctx.fillStyle = fade;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = glyph;
      ctx.font = "13px monospace";
      for (let i = 0; i < drops.length; i++) {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillText(ch, i * 14, drops[i] * 14);
        drops[i] =
          drops[i] * 14 > canvas.height && Math.random() > 0.975
            ? 0
            : drops[i] + 1;
      }
      if (typeof requestAnimationFrame === "function") requestAnimationFrame(draw);
    }
    draw();
  }

  function toggle() {
    on = !on;
    canvas.style.display = on ? "block" : "none";
    if (on) start();
    return on;
  }

  window.addEventListener("resize", () => {
    if (on) start();
  });

  return { toggle, start, get on() { return on; } };
}
