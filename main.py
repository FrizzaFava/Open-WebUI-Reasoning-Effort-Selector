"""
title: Native RE Slider Skin
author: FrizzaFava
author_url: https://github.com/FrizzaFava
version: 3.0.4
license: MIT
required_open_webui_version: 0.12.0
description: Styles Open WebUI's native model controls without changing their options, saved choices, or provider requests.
"""

import asyncio
import hashlib
import logging
import re
from pathlib import Path
from typing import Any

LOADER_PATH = "/static/loader.js"
CUSTOM_CSS_PATH = "/static/custom.css"


def asset_compose(app, path):
    from open_webui.env import STATIC_DIR

    target = Path(STATIC_DIR) / path.rsplit("/", 1)[-1]
    try:
        body = (
            target.read_text(encoding="utf-8")
            if target.is_file() and not target.is_symlink()
            else ""
        )
    except OSError:
        body = ""
    fragments = getattr(app.state, "_owui_static_fragments", {}).get(path, {})
    ordered = sorted(
        fragments.items(), key=lambda item: (int(item[1].get("order", 0)), item[0])
    )
    for _, entry in ordered:
        pattern = (
            re.escape(entry["start"]) + r".*?(?:" + re.escape(entry["end"]) + r"\n?|$)"
        )
        body = re.sub(pattern, "", body, flags=re.DOTALL)
    parts = [body.rstrip()]
    for key, entry in ordered:
        try:
            parts.append((entry["js"]() or "").strip())
        except Exception:
            logging.getLogger(__name__).exception(
                "Could not load asset fragment %s", key
            )
    result = "\n\n".join(part for part in parts if part)
    return result + "\n" if result else ""


def asset_register(app, path, key, start, end, producer, order=0):
    from starlette.responses import Response
    from starlette.routing import Mount, Route

    registry = getattr(app.state, "_owui_static_fragments", None)
    if registry is None:
        registry = {}
        app.state._owui_static_fragments = registry
    registry.setdefault(path, {})[key] = {
        "start": start,
        "end": end,
        "js": producer,
        "order": order,
    }
    if any(getattr(route, "_owui_shared_asset", None) == path for route in app.routes):
        return

    async def serve(request):
        body = asset_compose(app, path)
        etag = '"' + hashlib.sha256(body.encode("utf-8")).hexdigest() + '"'
        headers = {"Cache-Control": "no-cache, private", "ETag": etag}
        if request.headers.get("if-none-match") == etag:
            return Response(status_code=304, headers=headers)
        media_type = "application/javascript" if path == LOADER_PATH else "text/css"
        return Response(body, media_type=media_type, headers=headers)

    route = Route(path, serve, methods=["GET"])
    # Existing asset plugins can share the same registry and route.
    route._owui_shared_asset = path
    app.routes[:] = [
        existing for existing in app.routes if getattr(existing, "path", None) != path
    ]
    position = next(
        (
            index
            for index, existing in enumerate(app.routes)
            if isinstance(existing, Mount) and existing.name == "static"
        ),
        len(app.routes),
    )
    app.routes.insert(position, route)


ASSET_KEY = "frizzafava-native-reasoning-skin"
_module_name = __name__.removeprefix("function_")
_function_name, _, _module_nonce = _module_name.rpartition("_")
FUNCTION_ID = (
    _function_name
    if len(_module_nonce) == 32
    and all(char in "0123456789abcdef" for char in _module_nonce)
    else _module_name
)
JS_START = "// frizzafava-native-reasoning-skin:start"
JS_END = "// frizzafava-native-reasoning-skin:end"
CSS_START = "/* frizzafava-native-reasoning-skin:start */"
CSS_END = "/* frizzafava-native-reasoning-skin:end */"
log = logging.getLogger(ASSET_KEY)

CSS = r"""
[data-re-native-trigger] {
  display: inline-flex !important; align-items: center; justify-content: center;
  height: 32px; width: 32px; flex: none; margin: 0 6px 0 0 !important;
  padding: 0; border: 1px solid rgba(156,163,175,.3);
  border-radius: 9999px; background: transparent; color: #6b7280;
  font-family: inherit; font-size: 13px; font-weight: 500; line-height: 1; white-space: nowrap;
  transition: background .15s, border-color .15s, color .15s;
}
[data-re-native-trigger] > svg { display: none; }
[data-re-native-trigger]::before {
  content: ""; flex: none; width: 16px; height: 16px; background: currentColor;
  --re-bolt: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke-width='1.75' stroke='black'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z'/%3E%3C/svg%3E");
  -webkit-mask: var(--re-bolt) center/contain no-repeat;
  mask: var(--re-bolt) center/contain no-repeat;
}
[data-re-native-trigger]:hover { background: rgba(0,0,0,.05); }
.dark [data-re-native-trigger] { color: #d1d5db; border-color: rgba(75,85,99,.5); }
.dark [data-re-native-trigger]:hover { background: rgba(255,255,255,.07); }
[data-re-native-trigger][data-re-native-open] {
  color: #3a83f7 !important; border-color: rgba(58,131,247,.45);
  background: rgba(58,131,247,.08);
}
[data-re-native-trigger]:focus-visible { outline: 2px solid #3a83f7; outline-offset: 2px; }
.app-dropdown-menu[data-re-native-panel] {
  --re-surface: rgba(255,255,255,.95); --re-text: #1f2937;
  --re-muted: #6b7280; --re-track: #e5e7eb; --re-hover: rgba(0,0,0,.05);
  width: 284px !important; max-width: calc(100vw - 16px) !important;
  padding: 6px !important; border: 0 !important; border-radius: 16px !important;
  background: var(--re-surface) !important; color: var(--re-text) !important;
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px);
  box-shadow: 0 0 0 .5px rgba(0,0,0,.12),0 8px 16px -4px rgba(0,0,0,.2);
  font-family: inherit;
}
.dark .app-dropdown-menu[data-re-native-panel] {
  --re-surface: rgba(50,50,50,.92); --re-text: #ededed;
  --re-muted: #afafaf; --re-track: #414141; --re-hover: rgba(255,255,255,.08);
  box-shadow: 0 0 0 .5px rgba(255,255,255,.15),0 8px 16px -4px rgba(0,0,0,.35);
}
[data-re-native-panel] [data-re-native-slider] { padding: 6px 6px 10px; }
[data-re-native-slider] > div:first-child { gap: 8px; min-height: 32px; }
[data-re-native-slider] > div:first-child > span:first-child {
  flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis;
  white-space: nowrap; color: var(--re-muted); font-size: 12px;
}
[data-re-native-slider] > div:first-child > span:nth-child(2) {
  flex: none; max-width: 55%; color: #3a83f7; font-size: 16px; font-weight: 500;
}
[data-re-native-slider] [data-re-native-track] { height: 34px !important; }
[data-re-native-slider] [data-re-native-ticks] { z-index: 2; pointer-events: none; }
[data-re-native-slider] [data-re-native-ticks] { left: 14px; right: 14px; }
[data-re-native-ticks] > span {
  width: 4px; height: 4px; background: #858585;
  transition: transform .12s ease;
}
[data-re-native-ticks] > [data-re-native-filled] { background: #75a8f9; }
[data-re-native-ticks] > [data-re-native-near] { transform: scale(2); }
[data-re-native-ticks] > [data-re-native-current] { visibility: hidden; }
[data-re-native-slider] input.control-slider {
  --slider-fill: #3a83f7 !important;
  position: relative; z-index: 1; width: 100%; height: 24px !important;
  appearance: none; -webkit-appearance: none; border: 0;
  border-radius: 12px !important; background-color: var(--re-track) !important;
  box-shadow: inset 0 0 0 .5px rgba(128,128,128,.2);
  cursor: pointer; outline-offset: 3px;
}
[data-re-native-slider] input.control-slider::-webkit-slider-thumb {
  appearance: none; -webkit-appearance: none;
  width: 28px; height: 28px; border-radius: 50%; background: #fff;
  border: .5px solid rgba(0,0,0,.08); box-shadow: 0 0 2px rgba(0,0,0,.35);
  transition: transform .15s;
}
[data-re-native-slider] input.control-slider::-moz-range-thumb {
  width: 28px; height: 28px; border-radius: 50%; background: #fff;
  border: .5px solid rgba(0,0,0,.08); box-shadow: 0 0 2px rgba(0,0,0,.35);
  transition: transform .15s;
}
[data-re-native-slider] input.control-slider:hover::-webkit-slider-thumb { transform: scale(1.08); }
[data-re-native-slider] input.control-slider:hover::-moz-range-thumb { transform: scale(1.08); }
[data-re-native-slider] input.control-slider:focus-visible { outline: 2px solid #3a83f7; }
[data-re-native-slider] input.control-slider:disabled { cursor: pointer !important; }
[data-re-native-slider] input[data-re-native-enhanced] {
  z-index: 4; background-color: transparent !important;
  background-image: none !important; box-shadow: none;
}
[data-re-native-slider] input[data-re-native-enhanced]::-webkit-slider-thumb { opacity: 0; }
[data-re-native-slider] input[data-re-native-enhanced]::-moz-range-thumb { opacity: 0; }
[data-re-native-visual] {
  position: absolute; left: 0; right: 0; top: 5px; height: 24px;
  border-radius: 12px; background: var(--re-track); pointer-events: none;
  box-shadow: inset 0 0 0 .5px rgba(128,128,128,.2);
}
[data-re-native-fill] {
  position: absolute; left: 0; top: 0; height: 100%; z-index: 1;
  border-radius: 12px 0 0 12px; background: #3a83f7;
  transition: width .3s cubic-bezier(.23,1,.32,1);
}
[data-re-native-thumb] {
  position: absolute; top: 50%; width: 28px; height: 28px; z-index: 3;
  border-radius: 50%; background: #fff; border: .5px solid rgba(0,0,0,.08);
  box-shadow: 0 0 2px rgba(0,0,0,.35); transform: translate(-50%,-50%);
  transition: left .3s cubic-bezier(.23,1,.32,1), transform .15s ease;
}
[data-re-native-track][data-re-native-thumb-hover] [data-re-native-thumb] { transform: translate(-50%,-50%) scale(1.12); }
[data-re-native-track][data-re-native-dragging] [data-re-native-thumb] { transform: translate(-50%,-50%) scale(1.18); }
[data-re-native-dragging] [data-re-native-thumb],
[data-re-native-dragging] [data-re-native-fill] { transition-duration: .15s; }
[data-re-native-slider] > button:last-child {
  margin-top: 5px; padding: 4px 6px; border-radius: 8px;
  color: var(--re-muted); font: inherit; font-size: 11px;
}
[data-re-native-panel] button:hover:not(:disabled) { background: var(--re-hover) !important; }
[data-re-native-panel] button:focus-visible { outline: 2px solid #3a83f7; outline-offset: -2px; }
[data-re-native-panel] button[role="menuitemradio"] {
  min-height: 32px; height: auto !important; color: var(--re-text);
  border-radius: 8px !important;
}
[data-re-native-panel] button[role="menuitemradio"][aria-checked="true"] {
  color: #3a83f7 !important; background: rgba(58,131,247,.1) !important;
}
@media (prefers-reduced-motion: reduce) {
  [data-re-native-trigger] { transition: none; }
  [data-re-native-slider] input.control-slider::-webkit-slider-thumb { transition: none; }
  [data-re-native-slider] input.control-slider::-moz-range-thumb { transition: none; }
  [data-re-native-track] [data-re-native-thumb],
  [data-re-native-track] [data-re-native-fill],
  [data-re-native-ticks] > span { transition: none; }
}
"""

SCRIPT = r"""
(() => {
  'use strict';
  const key = '__frizzafavaNativeReasoningSkin';
  if (window[key]) return;
  window[key] = true;
  const composerSelector = '#message-input-container';
  const knobsPath = 'M10.5 6h9.75M10.5 6a1.5 1.5 0 1 1-3 0m3 0a1.5 1.5 0 1 0-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 0 1-3 0m3 0a1.5 1.5 0 0 0-3 0m-9.75 0h9.75';
  const normalize = value => value.replace(/\s+/g, '');
  const mark = (element, name, on = true) => {
    if (on && !element.hasAttribute(name)) element.setAttribute(name, '');
    else if (!on && element.hasAttribute(name)) element.removeAttribute(name);
  };
  const roots = new Set();
  const panels = new Set();
  const inputs = new WeakSet();
  const dragging = new Set();
  let pending = null;
  let frame = 0;
  const decorateComposer = composer => {
    for (const button of composer.querySelectorAll('button[aria-label]')) {
      if (![...button.querySelectorAll('svg path')].some(path => normalize(path.getAttribute('d') || '') === normalize(knobsPath))) continue;
      const wrapper = button.closest('[role="button"][aria-haspopup="true"]');
      if (!wrapper || !composer.contains(wrapper)) continue;
      mark(button, 'data-re-native-trigger');
      mark(button, 'data-re-native-open', wrapper.getAttribute('aria-expanded') === 'true');
    }
  };
  const decoratePanel = panel => {
    // Inline importance overrides native utilities without changing global layer order.
    panel.style.setProperty('border-radius', '16px', 'important');
    panel.style.setProperty('padding', '6px', 'important');
    for (const button of panel.querySelectorAll('button[role="menuitemradio"]')) {
      button.style.setProperty('border-radius', '8px', 'important');
    }
    for (const input of panel.querySelectorAll('input.control-slider[type="range"]')) {
      const track = input.parentElement;
      const section = track?.parentElement?.parentElement;
      if (!section || section.lastElementChild?.tagName !== 'BUTTON' || !section.firstElementChild?.querySelector('span')) continue;
      mark(section, 'data-re-native-slider');
      mark(track, 'data-re-native-track');
      if (input.disabled) {
        mark(track, 'data-re-native-dragging', false);
        dragging.delete(track);
      }
      const ticks = track.querySelector('div[aria-hidden="true"]');
      if (ticks) {
        mark(ticks, 'data-re-native-ticks');
        [...ticks.children].forEach((tick, index) => {
          mark(tick, 'data-re-native-current', index === Number(input.value));
          mark(tick, 'data-re-native-filled', index <= Number(input.value));
        });
      }
      let visual = track.querySelector('[data-re-native-visual]');
      if (!visual) {
        visual = document.createElement('span');
        visual.setAttribute('aria-hidden', 'true');
        mark(visual, 'data-re-native-visual');
        for (const name of ['fill', 'thumb']) {
          const part = document.createElement('span');
          mark(part, `data-re-native-${name}`);
          visual.append(part);
        }
        track.append(visual);
        mark(input, 'data-re-native-enhanced');
      }
      const min = Number(input.min) || 0;
      const max = Number(input.max);
      const progress = Math.min(1, Math.max(0, (Number(input.value) - min) / Math.max(1, max - min)));
      const position = `calc(${progress * 100}% + ${14 - 28 * progress}px)`;
      visual.querySelector('[data-re-native-thumb]').style.left = position;
      visual.querySelector('[data-re-native-fill]').style.width = position;
      if (!inputs.has(input)) {
        inputs.add(input);
        input.addEventListener('input', schedule);
        input.addEventListener('change', schedule);
        input.addEventListener('pointerdown', () => {
          if (!input.disabled) { mark(track, 'data-re-native-dragging'); dragging.add(track); }
        });
        track.addEventListener('pointermove', event => {
          const bounds = input.getBoundingClientRect();
          const x = event.clientX - bounds.left;
          const count = ticks?.children.length || 0;
          const index = Math.round(((x - 14) / Math.max(1, bounds.width - 28)) * (count - 1));
          if (ticks) [...ticks.children].forEach((tick, offset) => mark(tick, 'data-re-native-near', offset === index));
          const thumb = visual.querySelector('[data-re-native-thumb]').getBoundingClientRect();
          const distance = Math.hypot(event.clientX - thumb.x - thumb.width / 2, event.clientY - thumb.y - thumb.height / 2);
          mark(track, 'data-re-native-thumb-hover', distance <= thumb.width / 2);
        });
        track.addEventListener('pointerleave', () => {
          if (ticks) for (const tick of ticks.children) mark(tick, 'data-re-native-near', false);
          mark(track, 'data-re-native-thumb-hover', false);
        });
      }
    }
  };
  const flush = () => {
    frame = 0;
    for (const root of roots) if (root.isConnected) decorateComposer(root);
    roots.clear();
    if (pending && pending.until >= performance.now() && pending.wrapper.isConnected && pending.wrapper.getAttribute('aria-expanded') === 'true') {
      const added = [...document.querySelectorAll('body > [role="menu"]')].filter(menu => !pending.menus.has(menu));
      if (added.length === 1) {
        const panel = added[0].querySelector('.app-dropdown-menu');
        if (panel) { mark(panel, 'data-re-native-panel'); panels.add(panel); pending = null; }
      }
    }
    if (pending && (pending.until < performance.now() || !pending.wrapper.isConnected)) pending = null;
    for (const panel of panels) {
      if (!panel.isConnected) panels.delete(panel);
      else decoratePanel(panel);
    }
  };
  const schedule = () => { if (!frame) frame = requestAnimationFrame(flush); };
  const trackOpen = event => {
    if (event.type === 'keydown' && !['Enter', ' '].includes(event.key)) return;
    const button = event.target instanceof Element ? event.target.closest('[data-re-native-trigger]') : null;
    if (!button) return;
    const wrapper = button.closest('[role="button"][aria-haspopup="true"]');
    pending = wrapper?.getAttribute('aria-expanded') === 'false'
      ? { wrapper, menus: new Set(document.querySelectorAll('body > [role="menu"]')), until: performance.now() + 1000 }
      : null;
    roots.add(button.closest(composerSelector));
    schedule();
  };
  const start = () => {
    for (const composer of document.querySelectorAll(composerSelector)) roots.add(composer);
    flush();
    document.addEventListener('click', trackOpen, true);
    document.addEventListener('keydown', trackOpen, true);
    const stopDragging = () => {
      for (const track of dragging) mark(track, 'data-re-native-dragging', false);
      dragging.clear();
      schedule();
    };
    document.addEventListener('pointerup', stopDragging, true);
    document.addEventListener('pointercancel', stopDragging, true);
    window.addEventListener('blur', stopDragging);
    new MutationObserver(records => {
      let relevant = false;
      for (const record of records) {
        const target = record.target instanceof Element ? record.target : record.target.parentElement;
        if (record.attributeName === 'style' && !target?.matches('input.control-slider')) continue;
        const composer = target?.closest(composerSelector);
        if (composer) { roots.add(composer); relevant = true; }
        if (target?.closest('[data-re-native-panel]')) relevant = true;
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          const next = node.matches(composerSelector) ? node : node.querySelector(composerSelector);
          if (next) { roots.add(next); relevant = true; }
          if (pending && (node.matches('[role="menu"]') || node.querySelector('[role="menu"]'))) relevant = true;
        }
      }
      if (relevant) schedule();
    }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['aria-expanded', 'aria-valuetext', 'disabled', 'min', 'max', 'value', 'style'] });
  };
  if (document.body) start();
  else document.addEventListener('DOMContentLoaded', start, { once: true });
})();
"""

JS_FRAGMENT = f"{JS_START}\n{SCRIPT.strip()}\n{JS_END}"
CSS_FRAGMENT = f"{CSS_START}\n{CSS.strip()}\n{CSS_END}"


class Event:
    def __init__(self):
        self._active = False
        self._disabled = False
        self._bootstrap_task = None
        try:
            self._bootstrap_task = asyncio.get_running_loop().create_task(
                self._bootstrap()
            )
        except RuntimeError:
            pass

    def _register(self, app):
        self._active = True
        self._disabled = False
        asset_register(
            app,
            LOADER_PATH,
            ASSET_KEY,
            JS_START,
            JS_END,
            lambda: JS_FRAGMENT if self._active else "",
        )
        asset_register(
            app,
            CUSTOM_CSS_PATH,
            ASSET_KEY,
            CSS_START,
            CSS_END,
            lambda: CSS_FRAGMENT if self._active else "",
        )

    async def _bootstrap(self):
        try:
            from open_webui.main import app
            from open_webui.models.functions import Functions

            record = await Functions.get_function_by_id(FUNCTION_ID)
            if record is not None and record.is_active and not self._disabled:
                self._register(app)
        except Exception:
            log.exception("Could not initialize native model control styling")

    async def event(
        self,
        event: dict | None = None,
        __event_name__: str = "",
        __app__: Any = None,
        __id__: str = "",
        **kwargs,
    ):
        if __app__ is None:
            return
        own = ((event or {}).get("subject") or {}).get("id") == (__id__ or FUNCTION_ID)
        if own and __event_name__ in {
            "function.disable_started",
            "function.disabled",
            "function.deleted",
        }:
            self._active = False
            self._disabled = True
            return
        if own and __event_name__ in {
            "function.enable_started",
            "function.enabled",
            "function.updated",
        }:
            self._register(__app__)
        elif not self._disabled and (
            __event_name__ == "system.startup.completed" or not self._active
        ):
            self._register(__app__)
