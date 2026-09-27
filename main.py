"""
title: re-registry
author: FrizzaFava
author_url: https://github.com/FrizzaFava/Open-WebUI-Reasoning-Effort-Selector/
version: 1.3.1
license: MIT
description: Serves separate provider and model reasoning rules to the selector. Do not select this function in chats.
required_open_webui_version: 0.4.0
"""

import json
import math
import re

from pydantic import BaseModel, Field

def _parse_valve(raw: str, name: str) -> dict:
    try:
        data = json.loads(raw or "{}")
    except (TypeError, json.JSONDecodeError) as error:
        if isinstance(error, json.JSONDecodeError):
            detail = f"{error.msg} at line {error.lineno}, column {error.colno}"
        else:
            detail = str(error)
        raise ValueError(f"{name} Valve: {detail}") from error
    if not isinstance(data, dict):
        raise ValueError(f"{name} Valve: expected a JSON object at the top level")
    try:
        json.dumps(data, allow_nan=False)
    except ValueError as error:
        raise ValueError(f"{name} Valve: {error}") from error
    return data


def _error(valve: str, path: str, message: str) -> None:
    raise ValueError(f"{valve} Valve: {path} {message}")


def _safe_key(key: str) -> bool:
    return key not in {"__proto__", "prototype", "constructor"}


def _finite_number(value: object) -> bool:
    if type(value) not in (int, float):
        return False
    try:
        return math.isfinite(value)
    except OverflowError:
        return False


def _validate_json_fields(value: object, valve: str, path: str) -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            if not _safe_key(key):
                _error(valve, f"{path}.{key}", "uses a reserved key")
            _validate_json_fields(child, valve, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            _validate_json_fields(child, valve, f"{path}[{index}]")


def _validate_efforts(value: object, valve: str, path: str) -> None:
    if not isinstance(value, list):
        _error(valve, path, "must be an array")
    for index, item in enumerate(value):
        item_path = f"{path}[{index}]"
        token = item.get("value") if isinstance(item, dict) else item
        if not (
            isinstance(token, str) and 0 < len(token.strip()) <= 80
            or _finite_number(token)
        ):
            _error(valve, item_path, "needs a nonempty string or finite number value")
        if isinstance(item, dict) and "label" in item and not isinstance(item["label"], str):
            _error(valve, f"{item_path}.label", "must be a string")


def _validate_rule(rule: object, valve: str, path: str, *, model: bool) -> None:
    if model and isinstance(rule, list):
        _validate_efforts(rule, valve, path)
        return
    if not isinstance(rule, dict):
        _error(valve, path, "must be an object" + (" or effort array" if model else ""))
    for field in ("thinking", "levels"):
        if field in rule and not isinstance(rule[field], bool):
            _error(valve, f"{path}.{field}", "must be a boolean")
    if "efforts" in rule:
        _validate_efforts(rule["efforts"], valve, f"{path}.efforts")
    if "parameter" in rule:
        parameter = rule["parameter"]
        if not isinstance(parameter, str) or len(parameter) > 120 or not all(
            re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*", part) and _safe_key(part)
            for part in parameter.split(".")
        ):
            _error(valve, f"{path}.parameter", "must be a safe dotted field path")
    if "value_type" in rule and rule["value_type"] not in ("string", "number", "boolean"):
        _error(valve, f"{path}.value_type", "must be string, number, or boolean")
    if "mappings" in rule:
        mappings = rule["mappings"]
        if not isinstance(mappings, dict):
            _error(valve, f"{path}.mappings", "must be an object")
        for level, fields in mappings.items():
            mapping_path = f"{path}.mappings.{level}"
            if not level.strip() or len(level.strip()) > 80 or not _safe_key(level):
                _error(valve, mapping_path, "needs a safe level name")
            if not isinstance(fields, dict):
                _error(valve, mapping_path, "must contain an object of request fields")
            _validate_json_fields(fields, valve, mapping_path)
    if model:
        if "provider" in rule and (not isinstance(rule["provider"], str) or not rule["provider"]):
            _error(valve, f"{path}.provider", "must name a provider profile")
    elif "connection" in rule:
        connection = rule["connection"]
        if not isinstance(connection, dict) or connection.get("type") not in ("openai", "ollama"):
            _error(valve, f"{path}.connection", "needs type openai or ollama")
        if "index" in connection and (
            type(connection["index"]) is not int or not 0 <= connection["index"] <= 9007199254740991
        ):
            _error(valve, f"{path}.connection.index", "must be a zero-based integer")
        if "prefix" in connection and (
            not isinstance(connection["prefix"], str) or not connection["prefix"].strip()
        ):
            _error(valve, f"{path}.connection.prefix", "must be a nonempty Prefix ID")
        if "index" not in connection and "prefix" not in connection:
            _error(valve, f"{path}.connection", "needs a zero-based index or Prefix ID")


class Pipe:
    class Valves(BaseModel):
        providers: str = Field(
            default="{}",
            description=(
                "JSON object of shared provider rules. Connection accepts type openai/ollama "
                "and a zero-based index or Prefix ID; parameter accepts a dotted path. "
                'Example: {"gateway":{"connection":{"type":"openai","index":0},'
                '"parameter":"reasoning.effort"}}'
            ),
        )
        models: str = Field(
            default="{}",
            description=(
                "JSON object keyed by exact Open WebUI model ID. Entries override provider "
                "rules and may set efforts or mappings. Example: "
                '{"model-id":{"provider":"gateway","efforts":["low","high"]}}'
            ),
        )

    def __init__(self):
        self.valves = self.Valves()

    async def pipe(self, body: dict) -> str:
        try:
            providers = _parse_valve(self.valves.providers, "providers")
            models = _parse_valve(self.valves.models, "models")
            for provider_id, profile in providers.items():
                _validate_rule(profile, "providers", provider_id, model=False)
            for model_id, rule in models.items():
                _validate_rule(rule, "models", model_id, model=True)
                if isinstance(rule, dict) and rule.get("provider") and rule["provider"] not in providers:
                    raise ValueError(f"models Valve: {model_id} refers to unknown provider {rule['provider']}")
            return json.dumps({"providers": providers, "models": models})
        except ValueError as error:
            prefix, _, message = str(error).partition(" Valve: ")
            return json.dumps({"error": {"valve": prefix, "message": message or str(error)}})
