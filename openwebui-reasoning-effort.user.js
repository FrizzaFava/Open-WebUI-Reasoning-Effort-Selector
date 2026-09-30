// ==UserScript==
// @name         Open WebUI — Reasoning Effort selector (v2)
// @namespace    https://github.com/FrizzaFava/Open-WebUI-Reasoning-Effort-Selector
// @version      2.6.2
// @description  Per-model reasoning effort selector for Open WebUI with custom levels and registry-defined provider request mappings.
// @author       FrizzaFava (original from CryptoSharon)
// @match        *://*/*
// @grant        none
// @run-at       document-start
// @noframes
// @license      MIT
// ==/UserScript==

(() => {
	'use strict';

	// Guard against double injection (userscript managers / extension reloads).
	if (window.__reReasoningEffortV2Loaded) return;
	window.__reReasoningEffortV2Loaded = true;

	const STORAGE_KEY = 'openwebui.reasoningEffortByModel';
	const LEARNED_STORAGE_KEY = 'openwebui.reasoningEffortsLearnedByModel';
	const ALL_EFFORTS = ['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'];
	const PUBLICDB_STORAGE_KEY = 'openwebui.reasoningEffortsPublicDb.v1';
	const PUBLICDB_TTL_MS = 24 * 60 * 60 * 1000;
	const PUBLICDB_URL = 'https://openrouter.ai/api/v1/models';
	const reportError = (context, error) => console.error(`[Reasoning Effort Selector] ${context}`, error);
	const orderedEfforts = (values) => {
		const tokens = normalizeTokens(values);
		const positions = tokens.map((token) => ALL_EFFORTS.indexOf(token));
		if (positions.every((position) => position >= 0) &&
			positions.every((position, index) => index === 0 || position < positions[index - 1])) {
			return tokens.reverse();
		}
		return tokens;
	};
	const normalizeKey = (value) => String(value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '');
	const EFFORT_LABELS = {
		'': 'Default', none: 'None', minimal: 'Minimal', low: 'Low',
		medium: 'Medium', high: 'High', xhigh: 'X-High', max: 'Max',
		on: 'On', off: 'Off'
	};
	const EFFORT_SHORT = {
		none: 'Off', minimal: 'Min', low: 'Lo',
		medium: 'Med', high: 'Hi', xhigh: 'XH', max: 'Mx',
		on: 'On', off: 'Off'
	};

	// ── Inline icons ──

	const SVG_BOLT = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"/></svg>';
	const SVG_BOLT_SM = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="m3.75 13.5 10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75Z"/></svg>';
	const SVG_WARN = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>';
	const SVG_WARN_NAV = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" width="18" height="18"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>';
	const SVG_WARN_SM = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"/></svg>';
	const SVG_CHEVRON = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" width="10" height="10"><path stroke-linecap="round" stroke-linejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5"/></svg>';
	const SVG_CHECK = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5"/></svg>';
	const SVG_RESET = '<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.75" stroke="currentColor" width="16" height="16"><path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99"/></svg>';

	// ── Shared state ──

	const state = {
		models: new Map(),
		modelNames: new Map(),
		control: null,
		btn: null,
		iconEl: null,
		labelEl: null,
		pop: null,
		popEffort: null,
		popHeading: null,
		popBody: null,
		popNotice: null,
		popReset: null,
		popHead: null,
		listView: false,
		popSource: 'desktop',
		slider: null,
		track: null,
		range: null,
		thumb: null,
		switchEl: null,
		tstate: null,
		levels: null,
		mobile: { control: null, btn: null, iconEl: null, badge: null },
		registry: null,
		registryRules: new WeakMap(),
		registryTried: false,
		ollamaInfo: new Map(),
		ollamaInfoTried: new Set(),
		publicDb: null,
		publicDbTried: false,
		ambiguousProviders: new Set(),
		selections: null,
		learnedEfforts: null,
		renderQueued: false
	};

	// ── Styles ──

	const injectStyles = () => {
		if (document.getElementById('re2-styles')) return;
		const style = document.createElement('style');
		style.id = 're2-styles';
		style.textContent = `
#re2-control{position:relative;margin-left:auto;margin-right:2px;flex-shrink:0}
#re2-btn{
  display:flex;align-items:center;gap:6px;
  height:32px;padding:0 12px;border-radius:9999px;
  border:1px solid rgba(156,163,175,.3);
  font-size:13px;font-weight:500;font-family:inherit;
  color:rgb(107,114,128);cursor:pointer;outline:none;
  background:transparent;white-space:nowrap;
  transition:background .15s,border-color .15s,color .15s;
}
#re2-btn:hover{background:rgba(0,0,0,.05)}
.dark #re2-btn{color:rgb(209,213,219);border-color:rgba(75,85,99,.5)}
.dark #re2-btn:hover{background:rgba(255,255,255,.07)}
#re2-btn.re2-warn{color:rgb(217,119,6);border-color:rgba(252,211,77,.45)}
.dark #re2-btn.re2-warn{color:rgb(251,191,36);border-color:rgba(245,158,11,.35)}
#re2-btn.re2-warn:not(.re2-active):hover{background:rgba(251,191,36,.08)}
.dark #re2-btn.re2-warn:not(.re2-active):hover{background:rgba(251,191,36,.1)}
#re2-btn.re2-active:hover,.dark #re2-btn.re2-active:hover{background:rgba(58,131,247,.08)}
#re2-btn.re2-warn.re2-active .re2-icon{color:#fbbf24}
#re2-btn>*{pointer-events:none}
#re2-btn .re2-icon{display:flex;align-items:center;flex-shrink:0}
#re2-btn .re2-chevron{display:flex;align-items:center;opacity:.45;flex-shrink:0;transition:transform .15s}
#re2-btn.re2-open .re2-chevron{transform:rotate(180deg)}

@media(max-width:768px){
  #re2-control{display:none!important}
}
@media(min-width:769px){
  #re2-mobile-control{display:none!important}
}

#re2-mobile-control{
  position:relative;display:flex;align-items:center;
  margin:0 1px;flex-shrink:0;
}
#re2-mobile-btn{
  display:flex;align-items:center;justify-content:center;
  width:36px;height:36px;border-radius:10px;
  border:none;background:transparent;
  color:rgb(156,163,175);cursor:pointer;outline:none;
  position:relative;
  -webkit-tap-highlight-color:transparent;
  transition:background .15s,color .15s;
}
#re2-mobile-btn:active{background:rgba(0,0,0,.08)}
#re2-mobile-btn>*{pointer-events:none}
.dark #re2-mobile-btn{color:rgb(156,163,175)}
.dark #re2-mobile-btn:active{background:rgba(255,255,255,.08)}
#re2-mobile-btn.re2-warn{color:rgb(217,119,6)}
.dark #re2-mobile-btn.re2-warn{color:rgb(251,191,36)}
#re2-mobile-btn.re2-has-effort{color:#3a83f7}
.dark #re2-mobile-btn.re2-has-effort{color:#3a83f7}
#re2-mobile-btn.re2-warn.re2-has-effort>span:first-child{color:#fbbf24}

#re2-mobile-badge{
  position:absolute;bottom:2px;right:0;
  min-width:16px;height:13px;border-radius:7px;
  background:#3a83f7;
  color:#fff;font-size:8px;font-weight:700;
  display:flex;align-items:center;justify-content:center;
  padding:0 3px;line-height:1;
  pointer-events:none;
  transform:scale(0);transition:transform .15s ease;
}
#re2-mobile-badge.re2-visible{transform:scale(1)}
#re2-mobile-btn.re2-warn:not(.re2-has-effort) #re2-mobile-badge{background:rgb(234,179,8);color:rgb(55,65,81)}

#re2-pop{
  position:fixed;width:284px;max-width:calc(100vw - 16px);box-sizing:border-box;z-index:10000;display:none;
  border-radius:16px;background:rgba(50,50,50,.92);
  -webkit-backdrop-filter:blur(8px);backdrop-filter:blur(8px);
  box-shadow:0 0 0 .5px rgba(255,255,255,.15),0 8px 16px -4px rgba(0,0,0,.35);
  font-family:inherit;color:#ededed;
}
#re2-pop[data-mode="toggle"]{width:184px}
#re2-pop.re2-open{display:block;animation:re2-pop-enter .32s cubic-bezier(.23,1,.32,1) .03s both}
#re2-btn,#re2-pop,#re2-mobile-btn{-webkit-user-select:none;user-select:none}
#re2-pop[data-side="top"]{transform-origin:50% 100%}
#re2-pop[data-side="bottom"]{transform-origin:50% 0%}
@keyframes re2-pop-enter{from{opacity:0;transform:scale(.98)}to{opacity:1;transform:scale(1)}}
#re2-pop.re2-resizing{overflow:hidden;transition:height .26s cubic-bezier(.23,1,.32,1)}
@media (prefers-reduced-motion:reduce){#re2-pop.re2-resizing{transition:none}}
@media (prefers-reduced-motion:reduce){#re2-pop.re2-open{animation:none}}
#re2-pop .re2-head{position:relative;padding:6px 2px 2px}
#re2-pop .re2-reset{
  position:absolute;top:4px;right:6px;width:28px;height:28px;
  display:flex;align-items:center;justify-content:center;
  border:none;border-radius:8px;background:transparent;
  color:#afafaf;cursor:pointer;padding:0;
}
#re2-pop .re2-reset:hover{background:rgba(255,255,255,.1);color:#ededed}
#re2-pop .re2-heading{
  display:flex;justify-content:center;align-items:center;
  width:max-content;margin:0 auto;
  padding:5px 10px;border-radius:8px;min-height:32px;
}
#re2-pop .re2-heading.re2-clickable{cursor:pointer;transition:background .15s ease}
#re2-pop .re2-heading.re2-clickable:hover{background:rgba(255,255,255,.1)}
#re2-pop .re2-effort{color:#3a83f7;font-size:16px;font-weight:500;white-space:nowrap;line-height:22px}
#re2-pop .re2-list{display:flex;flex-direction:column;padding:2px 0 4px;max-height:264px;overflow-y:auto}
#re2-pop .re2-listhead{padding:6px 12px 4px;color:#afafaf;font-size:12px}
#re2-pop .re2-listitem{
  display:flex;align-items:center;gap:8px;width:100%;
  padding:7px 12px;border-radius:8px;border:none;background:transparent;
  color:#ededed;font-size:14px;font-family:inherit;text-align:left;cursor:pointer;
}
#re2-pop .re2-listitem:hover{background:rgba(255,255,255,.08)}
#re2-pop .re2-listitem .re2-lchk{margin-left:auto;width:14px;display:flex;align-items:center;color:#ededed}
#re2-pop .re2-listitem .re2-wicon{display:flex;align-items:center;color:#fbbf24}
#re2-pop .re2-notice{display:none;box-sizing:border-box;max-width:calc(100% - 24px);min-width:0;
  margin:8px 12px 12px;padding:7px 9px;border-radius:8px;color:#a16207;
  background:rgba(234,179,8,.10);font-size:11px;line-height:1.35;
  white-space:normal;overflow-wrap:anywhere}
#re2-pop .re2-notice[data-kind="info"]{color:#93c5fd;background:rgba(59,130,246,.10)}
#re2-pop .re2-body{width:100%;box-sizing:border-box;padding:4px 12px 12px}
#re2-pop .re2-slider{
  position:relative;height:28px;touch-action:none;outline:none;cursor:pointer;
  /* Hover growth knobs: tweak these values to control how much the slider
     dots enlarge on hover/drag (1 = no growth). */
  --re2-tick-hover-scale:2;
  --re2-thumb-hover-scale:1.12;
  --re2-thumb-drag-scale:1.18;
}
#re2-pop .re2-slider[data-dragging="true"]{cursor:grabbing}
#re2-pop .re2-track{
  position:absolute;left:0;right:0;top:2px;height:24px;border-radius:12px;
  background:#414141;box-shadow:inset 0 0 0 .5px rgba(255,255,255,.14);overflow:hidden;
  transition:background-color .2s ease;
}
#re2-pop .re2-slider[data-inactive="true"] .re2-track{background:#5a5a5a}
#re2-pop .re2-range{
  position:absolute;top:0;left:0;height:100%;width:0;
  background:#3a83f7;border-radius:12px 0 0 12px;
  transition:width .3s cubic-bezier(.23,1,.32,1);
}
#re2-pop .re2-slider[data-dragging="true"] .re2-range{transition-duration:.15s}
#re2-pop .re2-ticks{position:absolute;inset:0;pointer-events:none}
#re2-pop .re2-tick{
  position:absolute;top:50%;width:4px;height:4px;border-radius:50%;
  background:#787878;transform:translate(-50%,-50%);
  pointer-events:auto;cursor:pointer;
  transition:transform .12s ease,filter .12s ease,background-color .15s ease;
}
#re2-pop .re2-tick::before{content:"";position:absolute;inset:-6px}
#re2-pop .re2-tick:hover{transform:translate(-50%,-50%) scale(var(--re2-tick-hover-scale,2))}
#re2-pop .re2-tick[data-selected="true"]{background:#75a8f9}
#re2-pop .re2-thumb{
  position:absolute;top:50%;width:28px;height:28px;border-radius:50%;
  background:#ffffff;border:.5px solid rgba(255,255,255,.25);
  box-shadow:0 0 2px rgba(0,0,0,.35);transform:translate(-50%,-50%);
  transition:left .3s cubic-bezier(.23,1,.32,1),opacity .15s ease,transform .15s ease;
  pointer-events:auto;z-index:2;
}
#re2-pop .re2-slider[data-dragging="true"] .re2-thumb{transition-duration:.15s}
#re2-pop .re2-thumb:hover{transform:translate(-50%,-50%) scale(var(--re2-thumb-hover-scale,1.12))}
#re2-pop .re2-slider[data-dragging="true"] .re2-thumb{transform:translate(-50%,-50%) scale(var(--re2-thumb-drag-scale,1.18))}
#re2-pop .re2-thumb.re2-idle{opacity:0}
#re2-pop .re2-slider:focus-visible .re2-thumb{outline:2px solid #3a83f7;outline-offset:0}
#re2-pop .re2-switchrow{display:flex;align-items:center;justify-content:center;gap:10px;padding:6px 0 4px;white-space:nowrap}
#re2-pop .re2-tlabel{font-size:14px;color:#afafaf}
#re2-pop .re2-tstate{font-weight:500;color:#3a83f7;display:inline-block;width:24px;text-align:left}
#re2-pop .re2-tstate.re2-off{color:#afafaf}
#re2-pop .re2-switch{
  position:relative;width:44px;height:24px;border-radius:9999px;border:none;
  background:#565656;cursor:pointer;padding:0;outline:none;
  transition:background .2s ease;
}
#re2-pop .re2-switch .re2-knob{
  position:absolute;top:2px;left:2px;width:20px;height:20px;border-radius:50%;
  background:#ffffff;box-shadow:0 0 2px rgba(0,0,0,.35);
  transition:left .2s cubic-bezier(.23,1,.32,1);
}
#re2-pop .re2-switch[aria-checked="true"]{background:#3a83f7}
#re2-pop .re2-switch[aria-checked="true"] .re2-knob{left:22px}
#re2-btn.re2-active{color:#3a83f7;border-color:rgba(58,131,247,.45)}
.dark #re2-btn.re2-active{color:#3a83f7;border-color:rgba(58,131,247,.45)}

`;
		document.head.appendChild(style);
	};

	// ── Per-model selections & learned efforts (localStorage) ──

	const readStoredObject = (key, label) => {
		try {
			const value = JSON.parse(localStorage.getItem(key) ?? '{}');
			return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
		} catch (error) {
			reportError(`Unable to read ${label}`, error);
			return {};
		}
	};
	const readSelections = () => {
		if (state.selections) return state.selections;
		state.selections = readStoredObject(STORAGE_KEY, 'saved selections');
		return state.selections;
	};

	const readLearnedEfforts = () => {
		if (state.learnedEfforts) return state.learnedEfforts;
		state.learnedEfforts = readStoredObject(LEARNED_STORAGE_KEY, 'learned efforts');
		return state.learnedEfforts;
	};

	const writeLearnedEfforts = (modelId, efforts) => {
		const learned = readLearnedEfforts();
		learned[modelId] = normalizeTokens(efforts);
		localStorage.setItem(LEARNED_STORAGE_KEY, JSON.stringify(learned));
		queueRender();
	};

	const writeSelection = (modelIds, effort) => {
		const selections = readSelections();
		for (const modelId of modelIds) {
			if (effort) {
				selections[modelId] = effort;
			} else {
				delete selections[modelId];
			}
		}
		localStorage.setItem(STORAGE_KEY, JSON.stringify(selections));
	};

	// ── Valve registry (Open WebUI "re-registry" pipe) ──

	const safeKey = (key) => !['__proto__', 'prototype', 'constructor'].includes(key);
	const effortValue = (value) => {
		if (typeof value === 'number' && Number.isFinite(value)) value = String(value);
		if (typeof value !== 'string') return '';
		const token = value.trim();
		return token.length <= 80 ? token : '';
	};
	const normalizeTokens = (values) => [...new Set(
		(Array.isArray(values) ? values : []).map((item) => effortValue(
			typeof item === 'string' || typeof item === 'number' ? item : item?.value
		))
	)].filter(Boolean);
	const effortLabels = (values) => {
		const labels = Object.create(null);
		for (const item of Array.isArray(values) ? values : []) {
			const value = effortValue(item?.value);
			if (value && typeof item?.label === 'string') labels[value] = item.label.slice(0, 80);
		}
		return labels;
	};
	const validJsonValue = (value) => value === null || typeof value === 'string' ||
		typeof value === 'number' && Number.isFinite(value) || typeof value === 'boolean' ||
		Array.isArray(value) && value.every(validJsonValue) || validJsonObject(value);
	const plainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
	const validJsonObject = (value) => plainObject(value) && Object.entries(value).every(([key, child]) =>
			safeKey(key) && validJsonValue(child)
		);
	const normalizeMappings = (value) => {
		const mappings = Object.create(null);
		if (!value || typeof value !== 'object' || Array.isArray(value)) return mappings;
		for (const [level, fields] of Object.entries(value)) {
			const token = effortValue(level);
			if (token && safeKey(token) && validJsonObject(fields)) mappings[token] = fields;
		}
		return mappings;
	};
	const normalizeParameter = (value) => typeof value === 'string' &&
		value.split('.').every((part) => /^[A-Za-z_][A-Za-z0-9_]*$/.test(part) && safeKey(part)) &&
		value.length <= 120 ? value : null;

	const registryEntries = (data) => {
		if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
		const entries = Object.create(null);
		for (const [key, value] of Object.entries(data)) {
			if (safeKey(key) && (Array.isArray(value) || value && typeof value === 'object' && !Array.isArray(value))) {
				entries[key] = value;
			}
		}
		return entries;
	};
	const normalizedEntry = (value) => {
		if (Array.isArray(value)) value = { thinking: true, levels: true, efforts: value };
		if (!value || typeof value !== 'object') return null;
		const mappings = normalizeMappings(value.mappings);
		return {
			thinking: value.thinking !== false,
			levels: value.levels === true,
			efforts: [...new Set([...normalizeTokens(value.efforts),
				...Object.keys(mappings).filter((level) => level !== 'on' && level !== 'off')])],
			labels: effortLabels(value.efforts),
			mappings,
			parameter: normalizeParameter(value.parameter),
			valueType: ['string', 'number', 'boolean'].includes(value.value_type) ? value.value_type : 'string'
		};
	};
	const rememberRegistry = (data) => {
		if (data?.error) throw new Error(`${data.error.valve ?? 'registry'} Valve: ${data.error.message ?? 'invalid JSON'}`);
		const split = data && (Object.hasOwn(data, 'providers') || Object.hasOwn(data, 'models'));
		const providers = registryEntries(split ? data.providers ?? {} : {});
		const models = registryEntries(split ? data.models ?? {} : data);
		if (!providers || !models) return false;
		for (const [id, rule] of Object.entries(models)) {
			if (rule?.provider && !Object.hasOwn(providers, rule.provider)) {
				throw new Error(`Model ${id} refers to unknown provider ${rule.provider}`);
			}
		}
		state.registry = { providers, models };
		state.registryRules = new WeakMap();
		state.ambiguousProviders.clear();
		queueRender();
		return true;
	};

	const findRegistryModelId = () => {
		for (const [id, model] of state.models) {
			if (/re[-_ ]?registry/i.test(id) || /re[-_ ]?registry/i.test(String(model?.name ?? ''))) return id;
		}
		return null;
	};

	const modelLineageFor = (model) => {
		const lineage = [];
		const seen = new Set();
		while (model && !seen.has(model.id)) {
			lineage.push(model);
			seen.add(model.id);
			const baseId = model.info?.base_model_id ?? model.base_model_id;
			if (typeof baseId !== 'string' || !baseId.trim()) break;
			model = state.models.get(baseId) ?? { id: baseId };
		}
		return lineage;
	};
	const connectionModelFor = (model) => Object.assign({}, ...modelLineageFor(model));
	const ollamaInfoFor = (model) => modelLineageFor(model)
		.map((item) => state.ollamaInfo.get(item.id)).find(Boolean);
	const connectionMatches = (connection, model) => {
		if (!connection || typeof connection !== 'object') return false;
		const type = String(model.owned_by ?? '').toLowerCase();
		if (connection.type !== type || !['openai', 'ollama'].includes(type)) return false;
		const hasIndex = Number.isSafeInteger(connection.index) && connection.index >= 0;
		const hasPrefix = typeof connection.prefix === 'string' && connection.prefix.length > 0;
		if (!hasIndex && !hasPrefix) return false;
		if (hasPrefix && !String(model.id).startsWith(`${connection.prefix}.`)) return false;
		if (hasIndex) {
			const indices = type === 'ollama' ? model.urls : [model.urlIdx];
			if (!Array.isArray(indices) || !indices.includes(connection.index)) return false;
		}
		return true;
	};
	const registryResolutionFor = (model) => {
		if (!state.registry || !model || typeof model !== 'object') return null;
		if (state.registryRules.has(model)) return state.registryRules.get(model);
		const lineage = modelLineageFor(model);
		const modelRules = lineage.map((item) => state.registry.models[item.id]).filter(Boolean).reverse();
		const modelObject = modelRules.reduce((combined, rule) => {
			const value = Array.isArray(rule) ? { thinking: true, levels: true, efforts: rule } : rule;
			return { ...combined, ...value, mappings: { ...combined.mappings, ...value.mappings } };
		}, {});
		const explicit = typeof modelObject.provider === 'string' ? modelObject.provider : null;
		const connectionModel = connectionModelFor(model);
		const connectionProfiles = Object.entries(state.registry.providers).filter(([, rule]) =>
			connectionMatches(rule?.connection, connectionModel));
		let connectionProvider = null;
		if (connectionProfiles.length === 1) connectionProvider = connectionProfiles[0][0];
		if (connectionProfiles.length > 1 && !state.ambiguousProviders.has(model.id)) {
			state.ambiguousProviders.add(model.id);
			reportError(`Several provider profiles match connection for ${model.id}; use an exact model entry`,
				new Error(connectionProfiles.map(([id]) => id).join(', ')));
		}
		const hinted = lineage.flatMap((item) => [item.provider, item.openai?.provider, item.info?.meta?.provider]);
		if (String(connectionModel.owned_by ?? '').toLowerCase() === 'ollama') hinted.push('ollama');
		const providerId = explicit ?? (connectionProfiles.length > 1 ? null :
			connectionProvider ?? hinted.find((name) => typeof name === 'string' &&
				Object.hasOwn(state.registry.providers, name)));
		const profile = providerId ? state.registry.providers[providerId] : null;
		if (!profile && !modelRules.length) {
			state.registryRules.set(model, null);
			return null;
		}
		const combined = { ...(profile ?? {}), ...modelObject,
			mappings: { ...(profile?.mappings ?? {}), ...(modelObject.mappings ?? {}) } };
		const entry = normalizedEntry(combined);
		const modelEfforts = normalizedEntry(modelObject)?.efforts ?? [];
		const resolution = { entry, modelConfigured: modelRules.length > 0, providerConfigured: Boolean(profile), providerId,
			requestConfigured: Boolean(entry?.parameter || Object.keys(entry?.mappings ?? {}).length),
			levelsConfigured: modelRules.length > 0 && (modelObject.levels === false || modelEfforts.length > 0),
			levelsSpecified: Object.hasOwn(combined, 'levels') };
		state.registryRules.set(model, resolution);
		return resolution;
	};
	const registryEntryFor = (model) => registryResolutionFor(model)?.entry ?? null;

	const loadRegistry = async () => {
		if (state.registry) return;
		const registryModelId = findRegistryModelId();
		if (!registryModelId) return;
		state.registryTried = true;

		try {
			const response = await originalFetch('/api/chat/completions', {
				method: 'POST',
				headers: {
					Accept: 'application/json',
					'Content-Type': 'application/json',
					...(localStorage.token ? { Authorization: `Bearer ${localStorage.token}` } : {})
				},
				body: JSON.stringify({
					model: registryModelId,
					messages: [{ role: 'user', content: 'registry' }],
					stream: false,
					max_tokens: 1
				})
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			const payload = await response.json();
			const content = payload?.choices?.[0]?.message?.content ?? '';
			const text = String(content).replace(/^```(?:json)?/i, '').replace(/```\s*$/, '').trim();
			if (!rememberRegistry(JSON.parse(text))) {
				throw new Error('response is not a valid registry object');
			}
		} catch (error) {
			reportError('Unable to load the Valve registry', error);
		}
	};

	const ensureRegistry = () => {
		if (state.registry || state.registryTried) return;
		if (state.models.size === 0) return;
		void loadRegistry();
	};

	// ── Public effort database (OpenRouter model specs, best effort) ──

	const readPublicDbCache = () => {
		try {
			const cached = JSON.parse(localStorage.getItem(PUBLICDB_STORAGE_KEY) ?? 'null');
			if (cached && Date.now() - (cached.ts ?? 0) < PUBLICDB_TTL_MS) return cached.efforts ?? null;
		} catch (error) {
			reportError('Unable to read the public model cache', error);
		}
		return null;
	};

	const rememberPublicDb = (payload) => {
		const models = payload?.data;
		if (!Array.isArray(models)) return false;
		const efforts = Object.create(null);
		for (const entry of models) {
			const raw = entry?.reasoning?.supported_efforts;
			if (!Array.isArray(raw)) continue;
			const tokens = orderedEfforts(raw);
			if (tokens.length === 0) continue;
			const slug = String(entry?.id ?? '').split('/').pop();
			for (const key of [entry?.id, slug, entry?.name]) {
				const normalized = normalizeKey(key);
				if (normalized && !efforts[normalized]) efforts[normalized] = tokens;
			}
		}
		if (Object.keys(efforts).length === 0) return false;
		state.publicDb = efforts;
		queueRender();
		try {
			localStorage.setItem(PUBLICDB_STORAGE_KEY, JSON.stringify({ ts: Date.now(), efforts }));
		} catch (error) {
			reportError('Unable to save the public model cache', error);
		}
		return true;
	};

	const loadPublicDb = async () => {
		if (state.publicDb) return;
		state.publicDbTried = true;
		const cached = readPublicDbCache();
		if (cached) {
			state.publicDb = cached;
			queueRender();
			return;
		}
		try {
			const response = await fetch(PUBLICDB_URL, { headers: { Accept: 'application/json' } });
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			rememberPublicDb(await response.json());
		} catch (error) {
			reportError('Unable to load public model metadata', error);
		}
	};

	const ensurePublicDb = () => {
		if (state.publicDb || state.publicDbTried) return;
		if (state.models.size === 0) return;
		void loadPublicDb();
	};

	const publicDbEffortsFor = (model) => {
		if (!state.publicDb) return null;
		const nameKey = normalizeKey(model.name);
		const idKey = normalizeKey(model.id);
		if (nameKey && state.publicDb[nameKey]) return state.publicDb[nameKey];
		if (idKey && state.publicDb[idKey]) return state.publicDb[idKey];
		return null;
	};

	// ── Ollama thinking metadata (/ollama/api/show) ──

	// Open WebUI maps reasoning effort for Ollama targets onto the native 'think'
	// control. /api/show reports what each model accepts: named thinking values
	// (e.g. ["low","medium","high"]) or boolean-only, plus the 'thinking'
	// capability flag. Unsupported named selections round DOWN to the nearest
	// supported level; Ollama would otherwise silently use the model default.
	const ensureOllamaInfo = (model) => {
		model = model ? connectionModelFor(model) : null;
		if (!model || String(model.owned_by ?? '').toLowerCase() !== 'ollama') return;
		if (state.ollamaInfo.has(model.id) || state.ollamaInfoTried.has(model.id)) return;
		state.ollamaInfoTried.add(model.id);
		const showModel = model.id;
		originalFetch('/ollama/api/show', {
			method: 'POST',
			headers: {
				Accept: 'application/json',
				'Content-Type': 'application/json',
				...(localStorage.token ? { Authorization: `Bearer ${localStorage.token}` } : {})
			},
			body: JSON.stringify({ model: showModel })
		})
			.then((response) =>
				response.ok ? response.json() : Promise.reject(new Error(`HTTP ${response.status}`))
			)
			.then((payload) => {
				const thinking = payload?.thinking;
				const values = Array.isArray(thinking?.values) ? thinking.values : null;
				const capabilities = Array.isArray(payload?.capabilities) ? payload.capabilities : null;
				const named = values ? values.filter((value) => typeof value === 'string') : [];
				const canThink = values
					? values.some((value) => value === true) || named.length > 0
					: capabilities
						? capabilities.includes('thinking')
						: true;
				state.ollamaInfo.set(model.id, { values, canThink, defaultValue: thinking?.default ?? null });
				queueRender();
			})
			.catch((error) => reportError(`Unable to inspect Ollama model ${model.id}`, error));
	};

	const ollamaThinkFor = (effort, model) => {
		const info = model ? ollamaInfoFor(model) : null;
		if (info && !info.canThink) return null; // model cannot think: strip any override
		if (!effort) return null; // Default → leave the model default in place
		if (effort === 'off') return false;
		if (effort === 'on') {
			// think:true only where the model accepts it; otherwise omit the override.
			const values = info?.values;
			return values && values.includes(true) ? true : null;
		}
		const values = info?.values;
		if (!values) {
			// No values metadata: boolean mapping (on/off control).
			if (effort === 'none' || effort === 'minimal') return false;
			return true;
		}
		const named = values.filter((value) => typeof value === 'string');
		if (named.length === 0) {
			// Boolean on/off model: any level selection means thinking on.
			if (effort === 'none' || effort === 'minimal') {
				return values.includes(false) ? false : null;
			}
			return true;
		}
		const levels = ['low', 'medium', 'high', 'max'];
		const has = (value) => values.includes(value);
		if (effort === 'none' || effort === 'minimal') {
			// think:false works only when the model allows it; otherwise Ollama falls
			// back to the model default (e.g. glm cloud default = max!), so aim for the
			// lowest supported level instead.
			if (has(false)) return false;
			return levels.find((level) => has(level)) ?? null;
		}
		const token = effort === 'xhigh' ? 'high' : effort;
		if (has(token)) return token;
		// Unsupported name → round DOWN to the nearest supported level; when nothing
		// below is supported either, omit the override (the model default applies).
		for (let i = levels.indexOf(token) - 1; i >= 0; i -= 1) {
			if (has(levels[i])) return levels[i];
		}
		return null;
	};

	// Per-model capability resolution, in priority order: valve registry pipe
	// (JSON keyed by model id) → Ollama /api/show → learned efforts →
	// model-reported metadata (OpenRouter reasoning.supported_efforts) →
	// public effort database (display name first, then model id).
	// Modes: 'levels' (slider + list), 'think' (On/Off only) and 'none'
	// (widget hidden). Anything unresolved behaves like an unverified 'levels'
	// model: Default selected and every option flagged with a warning icon.
	const verifiedInfo = (verified, hasVerifiedList = true, labels = {}, mappings = {}) => ({
		show: true,
		mode: 'levels',
		verified,
		efforts: [...new Set([...verified, ...ALL_EFFORTS])],
		labels,
		mappings,
		hasVerifiedList
	});

	const UNKNOWN_INFO = {
		show: true,
		mode: 'levels',
		verified: [],
		efforts: [...ALL_EFFORTS],
		hasVerifiedList: false
	};

	const directInfoForModel = (model) => {
		if (!model) return null;

		// Ollama auto-detection via /ollama/api/show.
		if (String(connectionModelFor(model).owned_by ?? '').toLowerCase() === 'ollama') {
			const info = ollamaInfoFor(model);
			if (info) {
				if (!info.canThink) {
					return { show: false, mode: 'none', verified: [], efforts: [], hasVerifiedList: true };
				}
				const named = info.values ? info.values.filter((value) => typeof value === 'string') : [];
				if (named.length === 0) {
					// Boolean on/off model (or capability known without level values).
					const verified = [];
					if (!info.values || info.values.includes(true)) verified.push('on');
					if (!info.values || info.values.includes(false)) verified.push('off');
					return {
						show: true,
						mode: 'think',
						verified,
						efforts: ['on', 'off'],
						hasVerifiedList: verified.length === 2
					};
				}
				const has = (value) => info.values.includes(value);
				const verified = [];
				if (has(false)) verified.push('none', 'minimal');
				for (const token of ['low', 'medium', 'high', 'max']) {
					if (has(token)) verified.push(token);
				}
				return verifiedInfo(verified);
			}
		}

		const learned = readLearnedEfforts()[model.id];
		if (Array.isArray(learned)) {
			return verifiedInfo(normalizeTokens(learned));
		}

		if (model.reasoning && Object.hasOwn(model.reasoning, 'supported_efforts')) {
			const efforts = model.reasoning.supported_efforts;
			const supported =
				efforts === null
					? [...ALL_EFFORTS]
					: Array.isArray(efforts)
						? orderedEfforts(efforts)
						: [];
			return verifiedInfo(
				model.reasoning.mandatory ? supported.filter((effort) => effort !== 'none') : supported
			);
		}

		const publicDbEfforts = publicDbEffortsFor(model);
		if (publicDbEfforts) return verifiedInfo(publicDbEfforts);

		return null;
	};
	const inferredInfoForModel = (model) => {
		for (const item of modelLineageFor(model)) {
			const info = directInfoForModel(item);
			if (info) return info;
		}
		return UNKNOWN_INFO;
	};

	const effortInfoForModel = (model) => {
		if (!model) return null;
		const inferred = inferredInfoForModel(model);
		const resolution = registryResolutionFor(model);
		const entry = resolution?.entry;
		const confidence = resolution?.modelConfigured ? 'model' : resolution?.providerConfigured ? 'provider' : 'unconfigured';
		const alert = !resolution?.requestConfigured ? 'warning' : !resolution.levelsConfigured ? 'info' : null;
		const notice = alert === 'warning'
			? 'Request parameter is not configured for this model. Set a provider rule or a model parameter in the Valves.'
			: alert === 'info'
				? 'Model levels are inferred and not confirmed in the configuration.'
				: '';
		if (!entry) return { ...inferred, confidence, alert, notice };
		if (!entry.thinking) {
			return { show: false, mode: 'none', verified: [], efforts: [], hasVerifiedList: true, confidence, alert, notice };
		}
		const levelsMode = resolution.levelsSpecified ? entry.levels
			: entry.efforts.length > 0 || inferred.mode !== 'think';
		if (!levelsMode) {
			return { show: true, mode: 'think', verified: ['on', 'off'], efforts: ['on', 'off'],
				mappings: entry.mappings, hasVerifiedList: true, confidence, alert, notice };
		}
		const levels = entry.efforts.length ? entry.efforts
			: inferred.verified.filter((effort) => effort !== 'on' && effort !== 'off');
		const info = levels.length ? verifiedInfo(levels, true, entry.labels, entry.mappings)
			: { ...UNKNOWN_INFO, labels: entry.labels, mappings: entry.mappings };
		return { ...info, confidence, alert, notice };
	};

	const rememberModels = (payload) => {
		const models = Array.isArray(payload) ? payload : payload?.data;
		if (!Array.isArray(models)) return;
		for (const model of models) {
			if (model?.id) state.models.set(model.id, model);
		}
		state.modelNames.clear();
		for (const model of state.models.values()) {
			const label = String(model.name ?? model.id).trim();
			if (!label) continue;
			state.modelNames.set(label, state.modelNames.has(label) ? null : model.id);
		}
		state.registryRules = new WeakMap();
		queueRender();
		ensureRegistry();
		ensurePublicDb();
	};

	const selectedModelIds = () => {
		// Current Open WebUI renders the input's selector as #model-selector-model-button
		// (older builds used numeric ids), so accept any id and, when possible, scope the
		// search to the message-input footer.
		const footer = document.getElementById('input-menu-button')?.closest('[dir="ltr"]');
		let buttons = [...document.querySelectorAll('button[id^="model-selector-"][id$="-button"]')];
		if (footer) {
			const inFooter = buttons.filter((button) => footer.contains(button));
			if (inFooter.length > 0) buttons = inFooter;
		}
		buttons.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

		const ids = buttons.map((button) => state.modelNames.get(button.textContent?.trim()))
			.filter((id) => typeof id === 'string');

		if (ids.length > 0) {
			return [...new Set(ids)];
		}

		try {
			const stored = JSON.parse(sessionStorage.getItem('selectedModels') ?? '[]');
			if (Array.isArray(stored)) {
				const valid = stored.filter((id) => typeof id === 'string' && id.length > 0);
				if (valid.length > 0) {
					return valid;
				}
			}
		} catch (error) {
			reportError('Unable to read selected models from session storage', error);
		}
		return [];
	};

	const commonEffortInfo = (modelIds) => {
		if (modelIds.length === 0) return null;
		// Ensure Ollama thinking metadata for the selected models (async).
		for (const id of modelIds) {
			const model = state.models.get(id);
			if (model) ensureOllamaInfo(model);
		}
		const infos = modelIds.map((id) => effortInfoForModel(state.models.get(id))).filter(Boolean);
		if (infos.length === 0) return null;
		const thinkOnly = infos.every((info) => info.mode === 'think');
		const efforts = thinkOnly ? ['on', 'off'] : [...new Set(infos.flatMap((info) => info.efforts))];
		const verified = thinkOnly
			? ['on', 'off'].filter((effort) => infos.every((info) => info.verified.includes(effort)))
			: efforts.filter((effort) => infos.every((info) => info.verified.includes(effort)));
		const labels = Object.assign(Object.create(null), ...infos.map((info) => info.labels ?? {}));
		return {
			show: infos.every((info) => info.show !== false),
			mode: thinkOnly ? 'think' : 'levels',
			efforts,
			verified,
			labels,
			hasVerifiedList: infos.every((info) => info.hasVerifiedList === true),
			confidence: infos.some((info) => info.confidence === 'unconfigured') ? 'unconfigured'
				: infos.some((info) => info.confidence === 'provider') ? 'provider' : 'model',
			alert: infos.some((info) => info.alert === 'warning') ? 'warning'
				: infos.some((info) => info.alert === 'info') ? 'info' : null,
			notice: infos.find((info) => info.alert === 'warning')?.notice ??
				infos.find((info) => info.alert === 'info')?.notice ?? ''
		};
	};

	// ── DOM finders ──

	const findControlsRow = () => {
		const inputMenuButton = document.getElementById('input-menu-button');
		const footer = inputMenuButton?.closest('[dir="ltr"]');
		if (!footer) return null;
		return [...footer.querySelectorAll('div')].find(
			(element) =>
				element.classList.contains('overflow-x-auto') &&
				element.classList.contains('items-center')
		);
	};

	const findNavbarRow = () => {
		const sidebarBtn = document.getElementById('sidebar-toggle-button');
		if (!sidebarBtn) return null;
		const toggleContainer = sidebarBtn.parentElement;
		const row = toggleContainer?.parentElement;
		if (!row) return null;
		return { row, toggleContainer };
	};

	// ── Popup (ChatGPT-style) ──

	const positionPopup = () => {
		const pop = state.pop;
		const anchor = state.popSource === 'mobile' ? state.mobile.btn : state.btn;
		if (!pop || !anchor) return;
		const rect = anchor.getBoundingClientRect();
		pop.style.display = 'block';
		const width = pop.offsetWidth;
		const height = pop.offsetHeight;
		pop.style.display = '';
		let left = rect.left + rect.width / 2 - width / 2;
		left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
		pop.style.left = `${left}px`;
		pop.style.right = 'auto';
		const above = rect.top - 8 >= height + 8;
		pop.style.top = above ? `${rect.top - height - 8}px` : `${rect.bottom + 8}px`;
		pop.style.bottom = 'auto';
		pop.dataset.side = above ? 'top' : 'bottom';
	};

	// Swap the popup view (slider <-> list) while smoothly animating the popup's
	// height, so the box expands/collapses vertically to reveal the new content
	// instead of jumping. `apply` performs the state change + render().
	const switchView = (apply) => {
		const pop = state.pop;
		const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
		if (!pop || !pop.classList.contains('re2-open') || reduced) {
			apply();
			positionPopup();
			return;
		}
		state.finishHeightAnim?.(); // complete any in-flight height animation first
		const startH = pop.offsetHeight;
		apply();
		positionPopup();
		const endH = pop.offsetHeight;
		if (startH === endH) return;
		// When the popup sits above the trigger, pin its bottom edge during the
		// animation so the box grows upward, away from the trigger.
		// Measure the bottom edge BEFORE touching top/bottom: once `top` becomes
		// 'auto' the fixed-position box falls back to its static flow position
		// (end of <body>) and the measurement would be wrong, teleporting the
		// popup to the bottom of the screen for the whole animation.
		const pinnedBottom = pop.dataset.side === 'top';
		const savedTop = pop.style.top;
		const bottomOffset = Math.max(0, window.innerHeight - pop.getBoundingClientRect().bottom);
		if (pinnedBottom) {
			pop.style.top = 'auto';
			pop.style.bottom = `${bottomOffset}px`;
		}
		pop.style.height = `${startH}px`;
		pop.classList.add('re2-resizing');
		void pop.offsetHeight; // commit the start height before transitioning
		pop.style.height = `${endH}px`;
		let finished = false;
		const done = () => {
			if (finished) return;
			finished = true;
			pop.classList.remove('re2-resizing');
			pop.style.height = '';
			if (pinnedBottom) {
				pop.style.top = savedTop;
				pop.style.bottom = 'auto';
			}
			if (state.finishHeightAnim === done) state.finishHeightAnim = null;
		};
		const onEnd = (event) => {
			if (event.target === pop && event.propertyName === 'height') {
				pop.removeEventListener('transitionend', onEnd);
				done();
			}
		};
		state.finishHeightAnim = done;
		pop.addEventListener('transitionend', onEnd);
		setTimeout(done, 340);
	};

	const setPopOpen = (open) => {
		const pop = state.pop;
		if (!pop) return;
		const anchor = state.popSource === 'mobile' ? state.mobile.btn : state.btn;
		if (!anchor) return;
		if (!open) {
			pop.classList.remove('re2-open');
			state.listView = false;
			state.finishHeightAnim?.();
			return;
		}
		render();
		positionPopup();
		pop.classList.add('re2-open');
	};

	const tickLeft = (index, count) => {
		const ratio = count > 1 ? index / (count - 1) : 0;
		const pct = ratio * 100;
		const offset = 14 - 28 * ratio;
		return `calc(${pct}% + ${offset}px)`;
	};

	// Levels offered on the slider: the verified levels when they are known,
	// otherwise the full generic ladder (starting from None) for unknown models.
	const sliderLevels = (verified) => {
		const levels = (verified ?? []).filter((effort) => effort !== 'on' && effort !== 'off');
		if (levels.length < 2) return [...new Set([...ALL_EFFORTS, ...levels])];
		return levels;
	};
	const displayLabel = (info, value) => info.labels?.[value] ?? EFFORT_LABELS[value] ??
		(value ? value.split(/[-_\s]+/).filter(Boolean).map((part) =>
			part[0].toUpperCase() + part.slice(1)).join(' ') : 'Default');

	const buildSlider = (levels, info) => {
		const body = state.popBody;
		const signature = JSON.stringify(levels.map((level) => [level, displayLabel(info, level)]));
		if (body.dataset.mode === 'slider' && body.dataset.levels === signature) return;
		body.dataset.mode = 'slider';
		body.dataset.levels = signature;
		body.replaceChildren();

		const slider = document.createElement('div');
		slider.className = 're2-slider';
		slider.setAttribute('role', 'slider');
		slider.setAttribute('tabindex', '0');
		slider.setAttribute('aria-label', 'Reasoning effort');
		slider.setAttribute('aria-orientation', 'horizontal');

		const track = document.createElement('div');
		track.className = 're2-track';
		const range = document.createElement('div');
		range.className = 're2-range';
		const ticks = document.createElement('div');
		ticks.className = 're2-ticks';
		for (let i = 0; i < levels.length; i += 1) {
			const tick = document.createElement('span');
			tick.className = 're2-tick';
			tick.dataset.i = String(i);
			tick.style.left = tickLeft(i, levels.length);
			tick.title = displayLabel(info, levels[i]);
			ticks.append(tick);
		}
		track.append(range, ticks);

		const thumb = document.createElement('div');
		thumb.className = 're2-thumb';

		slider.append(track, thumb);
		body.append(slider);
		state.slider = slider;
		state.track = track;
		state.range = range;
		state.thumb = thumb;
	};

	const updateSlider = (index, info) => {
		const levels = state.levels;
		if (!state.slider || !levels?.length) return;
		const count = levels.length;
		const isDefault = index < 0;
		const slider = state.slider;
		slider.setAttribute('aria-valuemin', '0');
		slider.setAttribute('aria-valuemax', String(count - 1));
		if (isDefault) {
			slider.removeAttribute('aria-valuenow');
			slider.setAttribute('aria-valuetext', 'Default');
		} else {
			slider.setAttribute('aria-valuenow', String(index));
			slider.setAttribute('aria-valuetext', displayLabel(info, levels[index]));
		}
		state.range.style.width = isDefault ? '0px' : tickLeft(index, count);
		state.thumb.style.left = tickLeft(isDefault ? 0 : index, count);
		state.thumb.classList.toggle('re2-idle', isDefault);
		state.slider.dataset.inactive = String(isDefault);
		for (const tick of slider.querySelectorAll('.re2-tick')) {
			tick.dataset.selected = String(!isDefault && Number(tick.dataset.i) <= index);
		}
	};

	const toggleOnValue = (ids) => ids.some((id) => {
		const entry = registryEntryFor(state.models.get(id));
		return Boolean(entry?.mappings?.on || entry?.parameter);
	}) ? 'on' : '';
	const buildToggle = () => {
		const body = state.popBody;
		if (body.dataset.mode === 'toggle' && state.switchEl?.isConnected) return;
		body.dataset.mode = 'toggle';
		body.replaceChildren();
		const row = document.createElement('div');
		row.className = 're2-switchrow';
		const label = document.createElement('span');
		label.className = 're2-tlabel';
		label.append('Think ');
		const stateSpan = document.createElement('span');
		stateSpan.className = 're2-tstate';
		label.append(stateSpan);
		const switchBtn = document.createElement('button');
		switchBtn.type = 'button';
		switchBtn.className = 're2-switch';
		switchBtn.setAttribute('role', 'switch');
		switchBtn.setAttribute('aria-label', 'Reasoning');
		switchBtn.innerHTML = '<span class="re2-knob"></span>';
		switchBtn.addEventListener('click', () => {
			const selections = readSelections();
			const ids = selectedModelIds();
			const current = ids.length === 1 ? (selections[ids[0]] ?? '') : '';
			writeSelection(ids, current === 'off' ? toggleOnValue(ids) : 'off');
			render();
		});
		row.append(label, switchBtn);
		body.append(row);
		state.switchEl = switchBtn;
		state.tstate = stateSpan;
	};

	const sliderIndexFromEvent = (event) => {
		const track = state.track;
		const levels = state.levels;
		if (!track || !levels?.length) return;
		const rect = track.getBoundingClientRect();
		const ratio = (event.clientX - rect.left - 14) / Math.max(1, rect.width - 28);
		const index = Math.max(0, Math.min(levels.length - 1, Math.round(ratio * (levels.length - 1))));
		writeSelection(selectedModelIds(), levels[index]);
		queueRender();
	};

	const bindPopup = (pop) => {
		pop.addEventListener('pointerdown', (event) => {
			const slider = event.target.closest?.('.re2-slider');
			if (!slider || !state.levels?.length) return;
			event.preventDefault();
			slider.dataset.dragging = 'true';
			slider.setPointerCapture?.(event.pointerId);
			sliderIndexFromEvent(event);
		});
		pop.addEventListener('pointermove', (event) => {
			if (state.slider?.dataset.dragging !== 'true') return;
			sliderIndexFromEvent(event);
		});
		const endDrag = () => {
			if (state.slider?.dataset.dragging === 'true') state.slider.dataset.dragging = 'false';
		};
		pop.addEventListener('pointerup', endDrag);
		pop.addEventListener('pointercancel', endDrag);
		pop.addEventListener('keydown', (event) => {
			if (!event.target.closest?.('.re2-slider')) return;
			const levels = state.levels;
			if (!levels?.length) return;
			const now = state.slider.getAttribute('aria-valuenow');
			const index = now === null ? -1 : Number(now);
			let next = null;
			if (event.key === 'ArrowRight' || event.key === 'ArrowUp') next = index < 0 ? 0 : Math.min(levels.length - 1, index + 1);
			else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') next = index < 0 ? levels.length - 1 : Math.max(0, index - 1);
			else if (event.key === 'Home') next = 0;
			else if (event.key === 'End') next = levels.length - 1;
			if (next === null) return;
			event.preventDefault();
			event.stopPropagation();
			writeSelection(selectedModelIds(), levels[next]);
			render();
		});
	};

	const ensurePopup = () => {
		if (state.pop?.isConnected) return state.pop;
		const pop = document.createElement('div');
		pop.id = 're2-pop';
		pop.setAttribute('role', 'dialog');
		pop.setAttribute('aria-label', 'Reasoning effort');

		const resetBtn = document.createElement('button');
		resetBtn.type = 'button';
		resetBtn.className = 're2-reset';
		resetBtn.title = 'Reset to default';
		resetBtn.setAttribute('aria-label', 'Reset to default');
		resetBtn.innerHTML = SVG_RESET;
		resetBtn.addEventListener('click', (event) => {
			event.stopPropagation();
			writeSelection(selectedModelIds(), '');
			render();
		});

		const effortEl = document.createElement('div');
		effortEl.className = 're2-effort';
		const heading = document.createElement('div');
		heading.className = 're2-heading';
		heading.append(effortEl);
		heading.addEventListener('click', (event) => {
			event.stopPropagation();
			const mode = state.popBody.dataset.mode;
			if (mode !== 'slider' && mode !== 'list') return;
			switchView(() => {
				state.listView = !state.listView;
				render();
			});
		});

		const head = document.createElement('div');
		head.className = 're2-head';
		head.append(resetBtn, heading);

		const body = document.createElement('div');
		body.className = 're2-body';
		const notice = document.createElement('div');
		notice.className = 're2-notice';
		notice.setAttribute('role', 'status');

		pop.append(head, body, notice);
		document.body.append(pop);
		bindPopup(pop);

		// One-time global dismiss handlers shared by both triggers.
		document.addEventListener('click', (e) => {
			if (!state.pop.contains(e.target) && !state.btn?.contains(e.target) && !state.mobile.btn?.contains(e.target)) {
				setPopOpen(false);
			}
		});
		document.addEventListener('keydown', (e) => {
			if (e.key === 'Escape') setPopOpen(false);
		});

		state.pop = pop;
		state.popEffort = effortEl;
		state.popHeading = heading;
		state.popBody = body;
		state.popNotice = notice;
		state.popReset = resetBtn;
		state.popHead = head;
		return pop;
	};

	const updateListSelection = (selectedValue) => {
		for (const item of state.popBody.querySelectorAll('.re2-listitem')) {
			const isSelected = item.dataset.value === selectedValue;
			item.classList.toggle('re2-active', isSelected);
			const chk = item.querySelector('.re2-lchk');
			const markup = isSelected ? SVG_CHECK : '';
			if (chk && chk.innerHTML !== markup) chk.innerHTML = markup;
		}
	};

	const buildList = (info, selectedValue) => {
		const body = state.popBody;
		const verifiedSet = new Set(info.verified ?? []);
		const signature = JSON.stringify([info.efforts, info.verified, info.labels]);
		if (body.dataset.mode === 'list' && body.dataset.levels === signature) {
			updateListSelection(selectedValue);
			return;
		}
		body.dataset.mode = 'list';
		body.dataset.levels = signature;
		body.replaceChildren();
		state.levels = null;

		const list = document.createElement('div');
		list.className = 're2-list';

		const header = document.createElement('div');
		header.className = 're2-listhead';
		header.textContent = 'Select level';
		list.append(header);

		const makeItem = (value, unverified) => {
			const item = document.createElement('button');
			item.type = 'button';
			item.className = 're2-listitem';
			item.dataset.value = value;
			const txt = document.createElement('span');
			txt.textContent = displayLabel(info, value);
			item.append(txt);
			if (unverified) {
				const warn = document.createElement('span');
				warn.className = 're2-wicon';
				warn.title = 'Unverified for this model';
				warn.innerHTML = SVG_WARN_SM;
				item.append(warn);
			}
			const chk = document.createElement('span');
			chk.className = 're2-lchk';
			item.append(chk);
			item.addEventListener('click', (event) => {
				event.stopPropagation();
				writeSelection(selectedModelIds(), value);
				switchView(() => {
					state.listView = false;
					render();
				});
			});
			return item;
		};

		list.append(makeItem('', false));
		const ordered = (info.efforts ?? []).filter((effort) => effort !== 'on' && effort !== 'off');
		ordered.sort((a, b) => {
			const va = verifiedSet.has(a) ? 0 : 1;
			const vb = verifiedSet.has(b) ? 0 : 1;
			return va - vb;
		});
		for (const effort of ordered) {
			list.append(makeItem(effort, !verifiedSet.has(effort)));
		}

		body.append(list);
		updateListSelection(selectedValue);
	};

	const updatePopup = (info, verified, selectedValue, modelIds) => {
		ensurePopup();
		state.pop.dataset.mode = info.mode === 'think' ? 'toggle' : 'levels';
		const alert = info.alert;
		const notice = alert ? info.notice ?? '' : '';
		if (state.popNotice.textContent !== notice) state.popNotice.textContent = notice;
		state.popNotice.style.display = alert ? 'block' : 'none';
		state.popNotice.dataset.kind = alert ?? '';
		if (info.mode === 'think') {
			state.popHead.style.display = 'none';
			state.popHeading.classList.remove('re2-clickable');
			buildToggle();
			state.levels = null;
			state.listView = false;
			const checked = selectedValue !== 'off';
			if (state.switchEl.getAttribute('aria-checked') !== String(checked)) {
				state.switchEl.setAttribute('aria-checked', String(checked));
			}
			state.switchEl.classList.toggle('re2-on', checked);
			const onLabel = checked ? 'On' : 'Off';
			if (state.popEffort.textContent !== onLabel) state.popEffort.textContent = onLabel;
			if (state.tstate && state.tstate.textContent !== onLabel) {
				state.tstate.textContent = onLabel;
			}
			if (state.tstate) state.tstate.classList.toggle('re2-off', !checked);
		} else {
			state.popHead.style.display = '';
			state.popReset.style.display = '';
			state.popHeading.classList.add('re2-clickable');
			const effortLabel = displayLabel(info, selectedValue) || 'Default';
			if (state.popEffort.textContent !== effortLabel) state.popEffort.textContent = effortLabel;
			if (state.listView) {
				buildList(info, selectedValue);
			} else {
				const levels = sliderLevels(verified);
				buildSlider(levels, info);
				state.levels = levels;
				updateSlider(levels.indexOf(selectedValue), info);
			}
		}
	};

	// ── Desktop control ──

	const ensureControl = () => {
		const row = findControlsRow();
		if (!row) return false;

		if (state.control?.isConnected) {
			if (state.control.parentElement !== row) row.append(state.control);
			return true;
		}

		const wrapper = document.createElement('div');
		wrapper.id = 're2-control';

		const btn = document.createElement('button');
		btn.id = 're2-btn';
		btn.type = 'button';
		btn.setAttribute('aria-label', 'Reasoning effort');
		btn.title = 'Reasoning effort';

		const iconEl = document.createElement('span');
		iconEl.className = 're2-icon';
		iconEl.innerHTML = SVG_BOLT;

		const labelEl = document.createElement('span');
		labelEl.className = 're2-label';
		labelEl.textContent = 'Default';

		const chevron = document.createElement('span');
		chevron.className = 're2-chevron';
		chevron.innerHTML = SVG_CHEVRON;

		btn.append(iconEl, labelEl, chevron);

		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			ensurePopup();
			state.popSource = 'desktop';
			const isOpen = state.pop.classList.contains('re2-open');
			setPopOpen(!isOpen);
		});

		wrapper.append(btn);
		row.append(wrapper);
		state.control = wrapper;
		state.btn = btn;
		state.iconEl = iconEl;
		state.labelEl = labelEl;
		return true;
	};

	// ── Mobile control ──

	const ensureMobileControl = () => {
		const navInfo = findNavbarRow();
		if (!navInfo) return false;
		const { row, toggleContainer } = navInfo;

		if (state.mobile.control?.isConnected) {
			const expectedNext = toggleContainer.nextElementSibling;
			if (state.mobile.control !== expectedNext) {
				row.insertBefore(state.mobile.control, toggleContainer.nextElementSibling);
			}
			return true;
		}

		const wrapper = document.createElement('div');
		wrapper.id = 're2-mobile-control';

		const btn = document.createElement('button');
		btn.id = 're2-mobile-btn';
		btn.type = 'button';
		btn.setAttribute('aria-label', 'Reasoning effort');

		const iconEl = document.createElement('span');
		iconEl.style.cssText = 'display:flex;align-items:center';
		iconEl.innerHTML = SVG_BOLT_SM;

		const badge = document.createElement('span');
		badge.id = 're2-mobile-badge';

		btn.append(iconEl, badge);
		wrapper.append(btn);

		// The mobile trigger shares the desktop ChatGPT-style popup, opened below it.
		btn.addEventListener('click', (e) => {
			e.stopPropagation();
			ensurePopup();
			state.popSource = 'mobile';
			const isOpen = state.pop.classList.contains('re2-open');
			setPopOpen(!isOpen);
		});

		row.insertBefore(wrapper, toggleContainer.nextElementSibling);

		state.mobile.control = wrapper;
		state.mobile.btn = btn;
		state.mobile.iconEl = iconEl;
		state.mobile.badge = badge;
		return true;
	};

	// ── Render ──

	const render = () => {
		const desktopOk = ensureControl();
		const mobileOk = ensureMobileControl();
		if (!desktopOk && !mobileOk) return;

		const modelIds = selectedModelIds();
		if (!state.models.size) maybeLoadModels();
		const info = commonEffortInfo(modelIds) ?? UNKNOWN_INFO;

		// Models that cannot think (valve/Ollama metadata) hide the widget entirely.
		const visible = info.show !== false;
		if (state.control) state.control.style.display = visible ? '' : 'none';
		if (state.mobile.control) state.mobile.control.style.display = visible ? '' : 'none';
		if (!visible) {
			setPopOpen(false);
			return;
		}

		const { verified } = info;
		const selections = readSelections();
		const selectedValues = new Set(modelIds.map((id) => selections[id] ?? ''));
		const selectedValue = selectedValues.size === 1 ? [...selectedValues][0] : '';
		const selectionUnverified = Boolean(selectedValue) && !verified.includes(selectedValue);
		const showWarning = selectionUnverified || info.alert === 'warning';
		const thinkMode = info.mode === 'think';

		// Desktop rendering
		if (desktopOk && state.btn) {
			const newTitle = info.alert === 'warning'
				? 'Request parameter is not configured for this model. Set a provider rule or model parameter in the Valves.'
				: selectionUnverified
					? 'This effort is not reported for the selected model and may fail. Default sends no override.'
				: 'Reasoning effort';
			if (state.btn.title !== newTitle) state.btn.title = newTitle;

			state.btn.classList.toggle('re2-warn', showWarning);
			state.btn.classList.toggle('re2-active', thinkMode ? selectedValue !== 'off' : Boolean(selectedValue) && !selectionUnverified);
			const newIcon = showWarning ? SVG_WARN : SVG_BOLT;
			if (state.iconEl.innerHTML !== newIcon) state.iconEl.innerHTML = newIcon;
			const newLabel = thinkMode ? (selectedValue === 'off' ? 'Off' : 'On') : displayLabel(info, selectedValue);
			if (state.labelEl.textContent !== newLabel) state.labelEl.textContent = newLabel;
		}

		// Mobile rendering
		if (mobileOk && state.mobile.btn) {
			const { btn, iconEl, badge } = state.mobile;

			btn.classList.toggle('re2-warn', showWarning);
			btn.classList.toggle('re2-has-effort', thinkMode ? selectedValue !== 'off' : Boolean(selectedValue) && !selectionUnverified);
			const newIconMobile = showWarning ? SVG_WARN_NAV : SVG_BOLT_SM;
			if (iconEl.innerHTML !== newIconMobile) iconEl.innerHTML = newIconMobile;

			const shortLabel = thinkMode ? (selectedValue === 'off' ? 'Off' : 'On') : (EFFORT_SHORT[selectedValue] ?? (selectedValue ? displayLabel(info, selectedValue).slice(0, 3) : ''));
			if (badge.textContent !== shortLabel) badge.textContent = shortLabel;
			badge.classList.toggle('re2-visible', Boolean(shortLabel));
		}

		// Shared popup rendering (desktop pill and mobile trigger both use it).
		if (state.pop) updatePopup(info, verified, selectedValue, modelIds);
	};

	function queueRender() {
		if (state.renderQueued) return;
		state.renderQueued = true;
		requestAnimationFrame(() => {
			state.renderQueued = false;
			render();
		});
	}

	// ── Passive learning from backend errors ──

	const learnEffortsFromText = async (errorText, modelId, rejectedEffort) => {
		try {
			const text = String(errorText ?? '');

			const candidates = [];
			const collectEffortTokens = (part) => {
				const quoted = [...part.matchAll(/["'`]([^"'`]+)["'`]/g)].map((match) => match[1]);
				const tokens = normalizeTokens(quoted.length ? quoted :
					[...part.matchAll(/\b(none|minimal|low|medium|high|xhigh|max)\b/gi)].map((match) => match[1].toLowerCase()));
				if (tokens.length > 0) candidates.push(tokens);
			};
			// Jinja-style template errors: 'Supported types are xhigh (default), medium, and low.'
			for (const match of text.matchAll(
				/\bsupported\s+(?:types|values|levels|efforts)\s+(?:are|is)\s*[:]?\s*([^.!?\n]+)/gi
			)) {
				collectEffortTokens(match[1]);
			}
			// Pydantic-style validation errors: 'Input should be low, medium or high [type=...]'.
			const pydanticPart = text.split(/input should be|expected/i).at(1);
			if (pydanticPart) collectEffortTokens(pydanticPart.split(/\breceived\b/i)[0]);
			candidates.sort((a, b) => b.length - a.length);

			if (candidates[0]?.length) {
				const currentlyReported =
					effortInfoForModel(state.models.get(modelId))?.verified ?? [];
				const learned = [...new Set([...currentlyReported, ...candidates[0]])].filter(
					(effort) => effort !== rejectedEffort
				);
				writeLearnedEfforts(modelId, learned);
			}
		} catch (error) {
			reportError('Unable to parse a provider error response', error);
		}
	};

	// ── Request interception (fetch hook) ──

	let originalFetch = null;
	let fetchHookInstalled = false;
	const mergeFields = (target, fields) => {
		for (const [key, value] of Object.entries(fields)) {
			if (!safeKey(key)) continue;
			if (plainObject(value)) {
				if (!plainObject(target[key])) target[key] = {};
				mergeFields(target[key], value);
			} else {
				target[key] = value;
			}
		}
	};
	const parameterMapping = (entry, effort) => {
		if (!entry?.parameter) return null;
		let value = effort;
		if (entry.valueType === 'number') {
			value = Number(effort);
			if (!Number.isFinite(value) || effort.trim() === '') return null;
		} else if (entry.valueType === 'boolean') {
			if (effort !== 'on' && effort !== 'off') return null;
			value = effort === 'on';
		}
		const fields = {};
		let cursor = fields;
		const parts = entry.parameter.split('.');
		for (const part of parts.slice(0, -1)) cursor = cursor[part] = {};
		cursor[parts.at(-1)] = value;
		return fields;
	};
	const applySelectionToBody = (body, model, effort, isOllamaChat) => {
		if (!effort) return false;
		const isOllama = isOllamaChat || String(connectionModelFor(model).owned_by ?? '').toLowerCase() === 'ollama';
		const entry = registryEntryFor(model);
		const mapping = entry?.mappings?.[effort] ?? parameterMapping(entry, effort);
		if (mapping) {
			if (isOllamaChat) mergeFields(body, mapping);
			else if (isOllama) {
				body.options = plainObject(body.options) ? body.options : {};
				mergeFields(body.options, mapping);
			}
			else {
				body.params = plainObject(body.params) ? body.params : {};
				delete body.params.reasoning_effort;
				body.params.custom_params = plainObject(body.params.custom_params) ? body.params.custom_params : {};
				mergeFields(body.params.custom_params, mapping);
				if (entry?.valueType !== 'string' &&
					(typeof mapping.reasoning_effort === 'number' || typeof mapping.reasoning_effort === 'boolean')) {
					body.reasoning_effort = mapping.reasoning_effort;
				}
			}
			return true;
		}
		if (isOllama) {
			const think = ollamaThinkFor(effort, model);
			if (think === null) return false;
			if (isOllamaChat) body.think = think;
			else {
				body.options = plainObject(body.options) ? body.options : {};
				body.options.think = think;
			}
			return true;
		}
		if (effort === 'off') return false;
		body.params = plainObject(body.params) ? body.params : {};
		body.params.reasoning_effort = effort === 'on' ? 'low' : effort;
		return true;
	};

	const responseExcerpt = async (response, limit) => {
		const clone = response.clone();
		const reader = clone.body?.getReader?.();
		if (!reader) return (await clone.text()).slice(0, limit);
		const decoder = new TextDecoder();
		let text = '';
		let length = 0;
		try {
			while (length < limit) {
				const { done, value } = await reader.read();
				if (done) break;
				const bytes = value.subarray(0, limit - length);
				text += decoder.decode(bytes, { stream: true });
				length += bytes.length;
			}
			return text + decoder.decode();
		} finally {
			void reader.cancel().catch(() => {});
		}
	};

	const installFetchHook = () => {
		if (fetchHookInstalled) return;
		fetchHookInstalled = true;
		originalFetch = window.fetch.bind(window);
		window.fetch = async (input, init) => {
			let nextInit = init;
			let requestModelId = null;
			let requestEffort = null;
			const url = new URL(
				typeof input === 'string' || input instanceof URL ? input : input.url,
				window.location.href
			);

			const sameOrigin = url.origin === window.location.origin;
			const isChatCompletions = sameOrigin && url.pathname.endsWith('/api/chat/completions');
			const isOllamaChat = sameOrigin && url.pathname.endsWith('/ollama/api/chat');

			if ((isChatCompletions || isOllamaChat) && typeof init?.body === 'string') {
				try {
					const body = JSON.parse(init.body);
					requestModelId = body.model ?? null;
					const model = state.models.get(body.model);
					if (model) ensureOllamaInfo(model);
					const selections = readSelections();
					const selectedEffort = selections[body.model];
					if (selectedEffort && applySelectionToBody(body, model, selectedEffort, isOllamaChat)) {
						requestEffort = selectedEffort;
					}

					nextInit = { ...init, body: JSON.stringify(body) };
				} catch (err) {
					reportError('Unable to apply the selected effort to a chat request', err);
				}
			}

			let response;
			try {
				response = await originalFetch(input, nextInit);
			} catch (error) {
				if (isChatCompletions || isOllamaChat) {
					reportError(`Chat request failed before a response: model=${requestModelId ?? 'unknown'}`, error);
				}
				throw error;
			}
			const chatRequest = (isChatCompletions || isOllamaChat) && requestModelId;
			if (chatRequest && !response.ok) {
				void responseExcerpt(response, 8192)
					.then((text) => {
						console.error(`[Reasoning Effort Selector] Chat request failed: HTTP ${response.status}; model=${requestModelId}; effort=${requestEffort ?? 'Default'}; response=${text.slice(0, 1000)}`);
						learnEffortsFromText(text, requestModelId, requestEffort);
					})
					.catch((error) => reportError('Unable to inspect the failed chat response', error));
			} else if (chatRequest && requestEffort && response.ok) {
				void responseExcerpt(response, 65536)
					.then((text) => {
						if (/reasoning effort|supported types|invalid.{0,30}think|think must be|output_config\.effort/i.test(text)) {
							console.error(`[Reasoning Effort Selector] Provider reported a reasoning error in an HTTP 200 response: model=${requestModelId}; effort=${requestEffort}; response=${text.slice(0, 1000)}`);
							return learnEffortsFromText(text, requestModelId, requestEffort);
						}
					})
					.catch((error) => reportError('Unable to inspect the chat response', error));
			}
			if (
				url.origin === window.location.origin &&
				url.pathname.endsWith('/api/models') &&
				response.ok
			) {
				response
					.clone()
					.json()
					.then(rememberModels)
				.catch((error) => reportError('Unable to read the model list response', error));
			}
			return response;
		};
	};
	// ── Model list loading ──

	let lastModelsAttempt = 0;
	const maybeLoadModels = () => {
		const now = Date.now();
		if (state.models.size > 0 || now - lastModelsAttempt < 4000) return;
		lastModelsAttempt = now;
		void loadModels();
	};

	const loadModels = async () => {
		if (!originalFetch) return;
		try {
			const response = await originalFetch('/api/models?', {
				headers: {
					Accept: 'application/json',
					...(localStorage.token ? { Authorization: `Bearer ${localStorage.token}` } : {})
				},
				credentials: 'include'
			});
			if (!response.ok) throw new Error(`HTTP ${response.status}`);
			rememberModels(await response.json());
		} catch (error) {
			reportError('Unable to load the model list', error);
		}
	};

	// ── Bootstrap: arm only on Open WebUI pages, then keep the UI in sync ──

	const looksLikeOpenWebUI = () =>
		Boolean(
			document.getElementById('input-menu-button') ||
				document.getElementById('sidebar-toggle-button')
		);

	let armed = false;
	const arm = () => {
		if (armed) return;
		armed = true;
		injectStyles();
		installFetchHook();
		lastModelsAttempt = Date.now();
		window.addEventListener('storage', (event) => {
			if (!event.key || event.key === STORAGE_KEY) state.selections = null;
			if (!event.key || event.key === LEARNED_STORAGE_KEY) state.learnedEfforts = null;
			queueRender();
		});
		setTimeout(loadModels, 250);
	};

	const start = () => {
		const anchorSelector = '#input-menu-button,#sidebar-toggle-button,button[id^="model-selector-"][id$="-button"]';
		const containsAnchor = (node) => node?.nodeType === 1 &&
			(node.matches?.(anchorSelector) || node.querySelector?.(anchorSelector));
		new MutationObserver((records) => {
			if (!armed) {
				if (!looksLikeOpenWebUI()) return;
				arm();
			}
			if (records.some((record) => {
				const target = record.target.nodeType === 1 ? record.target : record.target.parentElement;
				return target?.closest?.(anchorSelector) ||
					[...record.addedNodes, ...record.removedNodes].some(containsAnchor);
			})) queueRender();
		}).observe(document.documentElement, {
			childList: true,
			subtree: true,
			characterData: true,
			attributes: true,
			attributeFilter: ['aria-label']
		});

		// Handle pages that are already fully rendered when we run.
		if (looksLikeOpenWebUI()) {
			arm();
			queueRender();
		}
	};

	if (document.documentElement) {
		start();
	} else {
		document.addEventListener('DOMContentLoaded', start, { once: true });
	}
})();
