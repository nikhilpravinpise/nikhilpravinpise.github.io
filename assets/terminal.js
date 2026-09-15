// Output primitives for the terminal pane. Import-safe: nothing here
// touches the DOM until createTerminal() is called with a live element.

import { PROFILE } from "./profile.js";

export function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
}

export function createTerminal(el) {
  function line(html, cls) {
    const div = document.createElement("div");
    div.className = "line" + (cls ? " " + cls : "");
    div.innerHTML = html;
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
    return div;
  }

  function blank() {
    line("&nbsp;");
  }

  function clear() {
    el.innerHTML = "";
  }

  /** Echo what the user typed, as a prompt line (HTML-escaped). */
  function echo(text) {
    line(
      `<span class="prompt-tag">${escapeHtml(PROFILE.prompt)}</span> <span class="out-white">${escapeHtml(text)}</span>`,
      "prompt-line",
    );
  }

  /** Append an arbitrary element (heatmap, image, ...) as a line. */
  function append(node) {
    const div = document.createElement("div");
    div.className = "line";
    div.appendChild(node);
    el.appendChild(div);
    el.scrollTop = el.scrollHeight;
    return div;
  }

  return { el, line, blank, clear, echo, append };
}
