(() => {
  // ---- edit this line to change the shortcut -------------------------------------------
  // Modifiers: ctrl, shift, alt, meta (cmd). Last part is the key: m, f10, space, contextmenu...
  const MENU_COMBO = "Ctrl+Shift+M";
  // --------------------------------------------------------------------------------------

  const ALIASES = { space: " ", esc: "escape", cmd: "meta", del: "delete", return: "enter" };
  const parseCombo = (s) => {
    const parts = String(s).toLowerCase().split("+").map((x) => x.trim()).filter(Boolean);
    const key = parts.pop() || "";
    const mods = parts.map((m) => ALIASES[m] || m);
    return {
      key: ALIASES[key] || key,
      ctrl: mods.includes("ctrl") || mods.includes("control"),
      shift: mods.includes("shift"),
      alt: mods.includes("alt"),
      meta: mods.includes("meta"),
    };
  };
  const combo = parseCombo(MENU_COMBO);
  const comboMatches = (e) => {
    if (e.ctrlKey !== combo.ctrl || e.shiftKey !== combo.shift) return false;
    if (e.altKey !== combo.alt || e.metaKey !== combo.meta) return false;
    const k = (e.key || "").toLowerCase();
    const c = (e.code || "").toLowerCase();
    return k === combo.key || c === "key" + combo.key || c === "digit" + combo.key || c === combo.key;
  };

  const isStage = (t) =>
    t instanceof HTMLElement &&
    t.childElementCount === 0 &&
    t.classList.contains("inset-0") &&
    t.classList.contains("z-[3]") &&
    !!t.closest("[data-harbor-player]");

  const findStage = () => {
    const root = document.querySelector("[data-harbor-player]");
    if (!root) return null;
    return Array.from(root.querySelectorAll("div.inset-0")).find(isStage) || null;
  };

  const isTyping = (e) => {
    const n = e.target;
    if (!(n instanceof HTMLElement)) return false;
    return n.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName);
  };

  // 1. Left click: keep Harbor's drag + double-click, cancel only the play/pause
  const origAdd = EventTarget.prototype.addEventListener;
  let recording = null;
  let pending = null;
  window.addEventListener = function (...args) {
    if (recording && (args[0] === "mousemove" || args[0] === "mouseup")) recording.push(args);
    return origAdd.apply(this, args);
  };

  const onMouseDownCapture = (e) => {
    if (!e.isTrusted || e.button !== 0 || !isStage(e.target)) return;
    pending = null;
    recording = [];
    setTimeout(() => {
      pending = recording;
      recording = null;
    }, 0);
  };

  const onMouseUpCapture = (e) => {
    if (!e.isTrusted || !pending) return;
    const list = pending;
    pending = null;
    for (const [type, fn, opts] of list) window.removeEventListener(type, fn, opts);
  };

  // 2. Right click: play/pause instead of the menu
  const onContextMenu = (e) => {
    if (!e.isTrusted || !isStage(e.target)) return;
    e.preventDefault();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "MediaPlayPause", bubbles: true, cancelable: true }),
    );
  };

  // 3. Shortcut: open the context menu at the mouse position
  let mx = Math.round(window.innerWidth / 2);
  let my = Math.round(window.innerHeight / 2);
  const onMouseMove = (e) => {
    mx = e.clientX;
    my = e.clientY;
  };

  const onKeyDown = (e) => {
    if (!e.isTrusted || e.repeat || isTyping(e) || !comboMatches(e)) return;
    const stage = findStage();
    if (!stage) return;
    e.preventDefault();
    e.stopPropagation();
    stage.dispatchEvent(
      new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: mx, clientY: my, button: 2 }),
    );
  };

  const on = (type, fn) => origAdd.call(window, type, fn, true);
  on("mousedown", onMouseDownCapture);
  on("mouseup", onMouseUpCapture);
  on("contextmenu", onContextMenu);
  on("mousemove", onMouseMove);
  on("keydown", onKeyDown);

  window.__harborCustomCleanup = () => {
    const off = (type, fn) => window.removeEventListener(type, fn, true);
    off("mousedown", onMouseDownCapture);
    off("mouseup", onMouseUpCapture);
    off("contextmenu", onContextMenu);
    off("mousemove", onMouseMove);
    off("keydown", onKeyDown);
    delete window.addEventListener;
    recording = null;
    pending = null;
  };
})();
