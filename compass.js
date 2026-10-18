(() => {
  // ---- edit these two lines ------------------------------------------------------------
  // Modifiers: ctrl, shift, alt, meta (cmd). Last part is the key: m, f10, space, contextmenu...
  const MENU_COMBO = "Ctrl+Shift+M";
  const SEEK_SECONDS = 0.5;
  // --------------------------------------------------------------------------------------

  // Compass player tweaks (ported from the Harbor script)
  //   1. Right click on the video       -> play / pause (no context menu)
  //   2. Left click on the video        -> no play / pause (drag-to-move window + double-click fullscreen still work)
  //   3. MENU_COMBO                     -> opens the normal Compass context menu on demand
  //   4. Shift + Left / Right           -> seek -/+ SEEK_SECONDS

  // If an older copy is still active (Custom JS re-runs on every edit), remove it first.
  try {
    if (typeof window.__compassCustomCleanup === "function") window.__compassCustomCleanup();
  } catch (_) {}

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

  // Compass renders one full-size click layer over the video: <div data-player-click-stage>
  // inside <main data-compass-player>. That layer owns click-to-pause, drag-to-move-window
  // and double-click-fullscreen, so it is the only thing these tweaks react to.
  const PLAYER_SEL = "[data-compass-player]";
  const STAGE_SEL = "[data-player-click-stage]";

  const isStage = (t) =>
    t instanceof HTMLElement && t.matches(STAGE_SEL) && !!t.closest(PLAYER_SEL);

  const findStage = () => {
    const root = document.querySelector(PLAYER_SEL);
    if (!root) return null;
    return root.querySelector(STAGE_SEL) || root;
  };

  const isTyping = (e) => {
    const n = e.target;
    if (!(n instanceof HTMLElement)) return false;
    return n.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(n.tagName);
  };

  // 1. Left click: keep Compass's drag + double-click, cancel only the play/pause.
  //    On mousedown the stage registers window "mousemove" + "mouseup" listeners; mouseup
  //    fires play/pause unless a drag started. We record those two listeners while the
  //    stage handles mousedown, then drop them on mouseup (before they run).
  const origAdd = EventTarget.prototype.addEventListener;
  let recording = null;
  let pending = null;
  const patchedAdd = function (...args) {
    if (recording && (args[0] === "mousemove" || args[0] === "mouseup")) recording.push(args);
    return origAdd.apply(this, args);
  };
  window.addEventListener = patchedAdd;

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

  // 2. Right click: play/pause instead of the menu.
  //    Compass's menu listener ignores events that are already defaultPrevented.
  //    Compass handles MediaPlayPause on window; it has a ~350 ms de-bounce built in.
  const onContextMenu = (e) => {
    if (!e.isTrusted || !isStage(e.target)) return;
    e.preventDefault();
    window.dispatchEvent(
      new KeyboardEvent("keydown", { key: "MediaPlayPause", bubbles: true, cancelable: true }),
    );
  };

  // 3. Keys
  let mx = Math.round(window.innerWidth / 2);
  let my = Math.round(window.innerHeight / 2);
  const onMouseMove = (e) => {
    mx = e.clientX;
    my = e.clientY;
  };

  // Seek through Compass's own seek path (same one the media keys use), so it respects
  // rapid-press chaining, exact seeking, watch-together rooms and casting.
  // Falls back to the <video> element, then to a raw mpv command.
  const fallbackSeek = (delta) => {
    const video = document.querySelector(PLAYER_SEL + " video");
    if (video && Number.isFinite(video.duration)) {
      video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + delta));
      return;
    }
    const ti = window.__TAURI_INTERNALS__;
    if (ti && ti.invoke) {
      Promise.resolve(ti.invoke("mpv_command", { cmd: ["seek", delta, "relative", "exact"] })).catch(() => {});
    }
  };
  const seekBy = (delta) => {
    const ti = window.__TAURI_INTERNALS__;
    if (ti && ti.invoke) {
      let p;
      try {
        p = ti.invoke("plugin:event|emit", { event: "compass://media-seek-relative", payload: delta });
      } catch (_) {
        fallbackSeek(delta);
        return;
      }
      Promise.resolve(p).catch(() => fallbackSeek(delta));
      return;
    }
    fallbackSeek(delta);
  };

  const onKeyDown = (e) => {
    if (!e.isTrusted || isTyping(e)) return;

    if (
      e.shiftKey && !e.ctrlKey && !e.altKey && !e.metaKey &&
      (e.key === "ArrowLeft" || e.key === "ArrowRight")
    ) {
      if (!document.querySelector(PLAYER_SEL)) return;
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
      seekBy(e.key === "ArrowRight" ? SEEK_SECONDS : -SEEK_SECONDS);
      return;
    }

    if (e.repeat || !comboMatches(e)) return;
    const stage = findStage();
    if (!stage) return; // not in the player: leave the key alone (Ctrl+Shift+M also toggles Compass's memory HUD)
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation();
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

  // Compass calls this automatically when the Custom JS field changes or is cleared.
  window.__compassCustomCleanup = () => {
    const off = (type, fn) => window.removeEventListener(type, fn, true);
    off("mousedown", onMouseDownCapture);
    off("mouseup", onMouseUpCapture);
    off("contextmenu", onContextMenu);
    off("mousemove", onMouseMove);
    off("keydown", onKeyDown);
    if (window.addEventListener === patchedAdd) delete window.addEventListener;
    recording = null;
    pending = null;
  };
})();
