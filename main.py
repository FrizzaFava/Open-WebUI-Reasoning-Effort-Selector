"""
title: re-registry
author: FrizzaFava
author_url: https://github.com/FrizzaFava/Open-WebUI-Reasoning-Effort-Selector/
version: 1.0.0
license: MIT
description: Serves the per-model reasoning-effort registry consumed by the "Open WebUI - Reasoning Effort Selector" userscript. Do not use it in chats; it only answers the script's automatic registry ping.
required_open_webui_version: 0.4.0
"""

import json

from pydantic import BaseModel, Field

# Each registry entry maps a model id to its reasoning capabilities:
#   "thinking": bool  → the model supports reasoning at all; false hides the widget.
#   "levels":   bool  → the model supports discrete effort levels; false shows a
#                       simple Think On/Off switch instead of the slider.
#   "efforts":  list  → supported effort levels; valid tokens:
#                       none, minimal, low, medium, high, xhigh, max.
# Entry template:
#   "model": { "thinking": true, "levels": true, "efforts": ["none", "minimal", "low", "medium", "high", "xhigh", "max"] }
DEFAULT_REGISTRY = """{
  "deepseek-v4.1-flash": { "thinking": true, "levels": true, "efforts": ["none", "minimal", "low", "high", "max"] },
  "gpt-6-astra": { "thinking": true, "levels": true, "efforts": ["low", "medium", "high", "xhigh", "max"] },
  "qwen-3-5-9b": { "thinking": true, "levels": false, "efforts": [] },
  "llama-2": { "thinking": false, "levels": false, "efforts": [] }
}"""


def _load_registry(raw: str) -> dict:
    """Best-effort parse of the valve JSON: invalid values yield an empty registry."""
    try:
        data = json.loads(raw or "{}")
    except (TypeError, json.JSONDecodeError):
        return {}
    return data if isinstance(data, dict) else {}


class Pipe:
    """Answers the userscript's registry ping with the configured JSON."""

    class Valves(BaseModel):
        registry: str = Field(
            default=DEFAULT_REGISTRY,
            description=(
                "JSON object mapping model ids to reasoning capabilities (keys must "
                "match the model id exactly; a plain list of levels is also accepted). "
                'Entry options: "thinking" (bool) — the model supports reasoning, false '
                'hides the widget; "levels" (bool) — the model has discrete effort '
                'levels, false shows a Think On/Off switch; "efforts" (list) — supported '
                "levels chosen from: none, minimal, low, medium, high, xhigh, max. "
                'Template: "model": { "thinking": true, "levels": true, "efforts": '
                '["none", "minimal", "low", "medium", "high", "xhigh", "max"] }'
            ),
        )

    def __init__(self):
        self.valves = self.Valves()

    async def pipe(self, body: dict) -> str:
        return json.dumps(_load_registry(self.valves.registry))
