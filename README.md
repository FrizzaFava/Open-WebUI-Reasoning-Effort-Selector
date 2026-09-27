> DISCLAIMER: this project was created with the assistance of an LLM. Although major parts of the code was generated, it was entirely reviewed and tested by a human. Also this project wouldn't exist without the contribution of CryptoSharon, please see the [credits](#credits) section for more info.

# Reasoning Effort Selector for Open WebUI

A per-model reasoning effort selector for [Open WebUI](https://github.com/open-webui/open-webui). It adds a compact control to the desktop input bar and mobile navbar. Install the same script as a Docker-mounted native patch or as a browser userscript.

![Demo gif](assets/demo.gif)

> **TL;DR:** Follow [Installation](#installation), check the [full configuration example](#full-configuration-example), then check the [major provider parameter list](#major-provider-reasoning-parameters) for the request field your connection expects.

## Contents

- [Reasoning Effort Selector for Open WebUI](#reasoning-effort-selector-for-open-webui)
  - [Contents](#contents)
  - [What it does](#what-it-does)
  - [How it works](#how-it-works)
  - [Installation](#installation)
    - [Method A: native Docker mount](#method-a-native-docker-mount)
    - [Method B: browser userscript](#method-b-browser-userscript)
    - [Registry function](#registry-function)
  - [Configuration](#configuration)
    - [Share a rule across a connection](#share-a-rule-across-a-connection)
    - [Configure levels and request values](#configure-levels-and-request-values)
    - [Confirmation and warnings](#confirmation-and-warnings)
    - [Full configuration example](#full-configuration-example)
    - [Major provider reasoning parameters](#major-provider-reasoning-parameters)
  - [Usage](#usage)
  - [FAQ](#faq)
  - [Credits](#credits)
  - [License](#license)

## What it does

The widget offers discrete levels such as None, Low, Medium, and High, or an On/Off switch for a model with boolean thinking. It stores the selection per model in the browser. **Default** clears the widget's override and leaves Open WebUI's existing request settings alone.

For predictable behavior across providers, also install [`main.py`](main.py) and configure its two JSON Valves: **providers** defines shared request rules; **models** defines exact model capabilities and exceptions. The [full example](#full-configuration-example) shows how they work together.

## How it works

The script observes Open WebUI's model selector and intercepts its same-origin chat request. It adds the chosen value to the request sent to Open WebUI; Open WebUI then forwards a provider-specific request using the connection's URL and credentials.

For an OpenAI-compatible chat connection, a configured `"parameter": "reasoning.effort"` with High adds `{"reasoning":{"effort":"high"}}` to `params.custom_params`. Open WebUI merges that into the outgoing provider request. A dotted path such as `output_config.effort` creates nested JSON. For Ollama, `think` goes through Open WebUI's `options` or the root of a direct Ollama chat request. Open WebUI can also convert its chat request to a Responses API request when that connection uses the Responses type. Confirm that your Open WebUI version and provider connection forward the configured field.

For models without an exact entry, levels can come from Ollama's `/api/show`, model metadata such as `reasoning.supported_efforts`, previously learned provider errors, or public model metadata. Unknown models retain the common levels as selectable but unverified choices. The model list and provider metadata can change over time, so treat automatic detection as a starting point.

## Installation

### Method A: native Docker mount

1. Save [`openwebui-reasoning-effort.user.js`](openwebui-reasoning-effort.user.js) at a persistent path on the Docker host.
2. Bind-mount it read-only into the Open WebUI container as `/app/build/static/loader.js`. For example: `<host-path>/openwebui-reasoning-effort.user.js:/app/build/static/loader.js:ro`.
3. Recreate the container and hard-refresh the browser. Visit `https://your-openwebui-domain/static/loader.js` to confirm that the current script is served.

The mount must remain in your deployment configuration when the container is recreated.

### Method B: browser userscript

1. Install a userscript manager such as [Violentmonkey](https://violentmonkey.github.io/) or [Tampermonkey](https://www.tampermonkey.net/).
2. Create a new script and replace its contents with [`openwebui-reasoning-effort.user.js`](openwebui-reasoning-effort.user.js).
3. Save and reload Open WebUI. Repeat on each browser where you want the widget.

The two installation methods can coexist; the script prevents duplicate initialization.

### Registry function

1. In Open WebUI, open **Admin Panel → Functions → Create a Function** and paste [`main.py`](main.py).
2. Give it an ID containing `re-registry`, such as `re_registry`. Save and activate it.
3. Open its **Valves** and paste a complete JSON object into each of **providers** and **models**. Use `{}` for an intentionally empty Valve; see the [full configuration example](#full-configuration-example) for both objects.
4. Reload Open WebUI after changing the Valves. The function appears in the model list for the script's registry lookup; do not select it as a chat model.

The userscript can still read responses from older single-registry installations and simple per-model effort arrays. The two-Valve format is recommended for new configuration.

## Configuration

Every JSON example below is a complete object you can paste into the named Valve after replacing the illustrative IDs and connection selectors. JSON does not allow comments or single quotes. Provider IDs such as `gateway` are local names you choose; model IDs must match Open WebUI exactly. Use the [parameter list](#major-provider-reasoning-parameters) to check documented request fields before configuring a connection.

### Share a rule across a connection

**providers Valve:**

```json
{
  "gateway": {
    "connection": { "type": "openai", "index": 0 },
    "thinking": true,
    "levels": true,
    "parameter": "reasoning_effort"
  },
  "ollama": {
    "connection": { "type": "ollama", "index": 0 },
    "thinking": true,
    "levels": true,
    "parameter": "think"
  }
}
```

**models Valve:**

```json
{
  "your-chat-model-id": {
    "provider": "gateway",
    "efforts": ["low", "medium", "high"]
  },
  "your-boolean-model-id": {
    "provider": "ollama",
    "levels": false,
    "value_type": "boolean"
  }
}
```

These IDs are placeholders, not a claim that any named provider or model accepts these values. A connection rule applies to all models on that connection. An exact model entry overrides its fields; in this example the Ollama model inherits `think` but switches to boolean On/Off. You can leave another Ollama model out of **models** and let its supported levels be inferred.

`connection.type` is `openai` for an OpenAI-compatible connection or `ollama` for a native Ollama connection. The zero-based `index` is the model's `urlIdx` or an entry in its `urls` array in the browser Network response for `/api/models`. You can find your index by counting in what place the connection you are interested appear in the settings list, starting from 0. An Open WebUI connection reorder can change indices.

If you use Open WebUI's **Prefix ID** connection setting, you can target the prefix instead:

```json
{
  "gateway": {
    "connection": { "type": "openai", "prefix": "my-gateway" },
    "thinking": true,
    "levels": true,
    "parameter": "reasoning.effort"
  }
}
```

This profile matches model IDs beginning `my-gateway.`. If both `index` and `prefix` are supplied, both must match. The script tries an exact model association first, then a unique connection match, then a matching provider hint from model metadata. A shared OpenAI-compatible request format cannot reliably identify its upstream provider on its own.

### Configure levels and request values

`efforts` sets the model's confirmed level list and order. Plain strings display with title capitalization; `super-mega-ultra` becomes **Super Mega Ultra**. Use `{"value":50,"label":"Medium"}` for a custom label. If an automatically detected list contains unfamiliar values, their source order is preserved; put them in `efforts` when you need to set the order yourself.

`parameter` writes the selected value to one field.
`value_type` controls the JSON value and accepts these values:

- `"string"` (the default) (eg. "low", "medium", "max")
- `"number"` (for models like DeepSeekV4) (eg. 25, 50, 100)
- `"boolean"` sends `true` or `false` for an On/Off thinking switch.

Whitespace or indentation in the Valve JSON never changes the value's type.

For a numerical control, this **models Valve** example is illustrative; replace the field, numbers, and ID with values documented for your API:

```json
{
  "your-numeric-model-id": {
    "thinking": true,
    "levels": true,
    "parameter": "reasoning_effort",
    "value_type": "number",
    "efforts": [
      { "value": 25, "label": "Low" },
      { "value": 50, "label": "Medium" },
      { "value": 100, "label": "Maximum" }
    ]
  }
}
```

When one UI choice must translate to another value or set multiple fields, use `mappings` instead of repeating a simple `parameter`. Each mapping is the exact JSON fragment to merge into the outgoing request. For example, this **models Valve** object sends nested token budgets:

```json
{
  "your-budget-model-id": {
    "thinking": true,
    "levels": true,
    "efforts": [
      { "value": "quick", "label": "Quick" },
      { "value": "deep", "label": "Deep" }
    ],
    "mappings": {
      "quick": { "thinking": { "type": "enabled", "budget_tokens": 1024 } },
      "deep": { "thinking": { "type": "enabled", "budget_tokens": 8192 } }
    }
  }
}
```

Provider and model `mappings` merge by level; a model mapping with the same level overrides its provider mapping. Explicit mappings take priority over `parameter`. Confirm the exact keys and supported values in the documentation for the connection you use.

### Confirmation and warnings

| Configuration state                            | Widget behavior                                                                                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| No configured request field or mapping         | Yellow warning on the trigger and a wrapping yellow explanation in the popup. The legacy OpenAI-compatible `reasoning_effort` or Ollama `think` fallback still works, but its provider format is unconfirmed. |
| Request rule configured, model levels inferred | Light-blue popup explanation. The common level list remains available, with warning icons on levels not verified for that model. This applies when a model sets `parameter` but omits `efforts`.              |
| Request rule and model levels configured       | No configuration notice. An individual level can still show a warning when it is not verified across all selected models.                                                                                     |

`thinking: false` hides the widget. `levels: false` explicitly selects an On/Off switch; omitting `levels` lets the script infer the control type. A model with `efforts` but no provider rule or `parameter` still gets the yellow request-format warning.

**Default** or Reset sends no *new* reasoning override. A selectable level literally named `default` sends that value to the provider. Existing settings in Open WebUI remain in effect after Reset, so the two choices may produce the same result while sending different request bodies.

### Full configuration example

These two objects show the main ways to configure the selector together. Paste each block into its named Valve and replace the illustrative model IDs, connection indices, prefixes, fields, and effort values with ones confirmed for your connections. The optional `_comment` fields are ignored by the current function and userscript; they provide notes while keeping the blocks valid JSON.

**providers Valve:**

```json
{
  "openai-chat": {
    "_comment": "Index 0 is the first OpenAI-compatible connection; its models inherit this request field.",
    "connection": { "type": "openai", "index": 0 },
    "thinking": true,
    "levels": true,
    "parameter": "reasoning_effort"
  },
  "responses-gateway": {
    "_comment": "A Prefix ID can identify a connection without relying on its position in the settings list.",
    "connection": { "type": "openai", "prefix": "my-responses" },
    "thinking": true,
    "levels": true,
    "parameter": "reasoning.effort"
  },
  "ollama": {
    "_comment": "No connection selector is needed for the explicit model references below.",
    "thinking": true,
    "levels": true,
    "parameter": "think"
  },
  "budget-gateway": {
    "_comment": "Use mappings when a selection must send nested fields or translated values.",
    "connection": { "type": "openai", "index": 1 },
    "thinking": true,
    "levels": true,
    "mappings": {
      "low": { "thinking": { "type": "enabled", "budget_tokens": 1024 } },
      "high": { "thinking": { "type": "enabled", "budget_tokens": 8192 } }
    }
  }
}
```

**models Valve:**

```json
{
  "your-standard-model-id": {
    "_comment": "Uses the openai-chat request field and confirms this model's available levels.",
    "provider": "openai-chat",
    "efforts": ["none", "low", "medium", "high", "super-mega-ultra"]
  },
  "your-numeric-model-id": {
    "_comment": "Overrides the inherited value type; labels are shown in the widget, while numbers are sent.",
    "provider": "openai-chat",
    "value_type": "number",
    "efforts": [
      { "value": 0, "label": "Minimum" },
      { "value": 50, "label": "Medium" },
      { "value": 100, "label": "Maximum" }
    ]
  },
  "my-responses.your-model-id": {
    "_comment": "No provider key is needed when the Prefix ID uniquely matches the connection.",
    "efforts": ["low", "medium", "high"]
  },
  "your-ollama-switch-model-id": {
    "_comment": "Inherits think but uses a boolean On/Off switch instead of named levels.",
    "provider": "ollama",
    "levels": false,
    "value_type": "boolean"
  },
  "your-ollama-level-model-id": {
    "_comment": "The same Ollama profile can serve a model with named thinking levels.",
    "provider": "ollama",
    "efforts": ["low", "medium", "high"]
  },
  "your-budget-model-id": {
    "_comment": "Overrides only the high mapping; low still comes from budget-gateway.",
    "provider": "budget-gateway",
    "efforts": ["low", "high"],
    "mappings": {
      "high": { "thinking": { "type": "enabled", "budget_tokens": 16384 } }
    }
  },
  "your-standalone-model-id": {
    "_comment": "A self-contained model rule needs no provider entry; a dotted path creates nested JSON.",
    "thinking": true,
    "levels": true,
    "parameter": "output_config.effort",
    "efforts": ["low", "high"]
  },
  "your-disabled-model-id": {
    "_comment": "Hide the widget for a model without a reasoning control.",
    "thinking": false
  }
}
```

The example fields and values illustrate the configuration format; they do not establish that a real provider accepts them. A model omitted from **models** can still inherit a uniquely matched connection rule, but its levels remain inferred. An exact model entry can also use a plain effort array for older configurations; add a provider or `parameter` when you want its request format confirmed.

### Major provider reasoning parameters

<details>
<summary>Show documented request fields and model-specific notes</summary>

This list covers reasoning controls, not every API parameter. A value in the **API request field** column is the field the named endpoint expects; use it as a Valve `parameter` only when your Open WebUI connection forwards that shape. Native Gemini and Bedrock request bodies, and providers reached through a gateway, may require translation. Supported levels vary by model and can change, so confirm the exact model before filling `efforts` in the [full example](#full-configuration-example).

| Provider / endpoint | API request field | What to check |
| --- | --- | --- |
| [OpenAI Chat Completions](https://developers.openai.com/api/docs/guides/reasoning) | `reasoning_effort` | String levels are model-specific; `none` is rejected by some models. |
| [OpenAI Responses](https://developers.openai.com/api/docs/guides/reasoning) | `reasoning.effort` | Nested object; the available levels and default vary by model. |
| [Azure OpenAI Chat / Responses](https://learn.microsoft.com/en-us/azure/foundry/openai/how-to/reasoning) | `reasoning_effort` / `reasoning.effort` | Use the field for the endpoint selected by your Azure connection and check the deployed model's supported levels. |
| [Anthropic Messages](https://platform.claude.com/docs/en/build-with-claude/effort) | `output_config.effort`; sometimes `thinking.type` | Effort can be `low`, `medium`, `high`, `xhigh`, or `max` on supported models. Some models need `thinking: {"type":"adaptive"}` as well; older models use `thinking.budget_tokens` instead. Use `mappings` when several fields must be set together. |
| [Gemini OpenAI-compatible endpoint](https://ai.google.dev/gemini-api/docs/openai) | `reasoning_effort` | Google maps `minimal`, `low`, `medium`, and `high` to model-specific thinking settings. `none` works only on supported Gemini 2.5 models. |
| [Gemini native GenerateContent](https://ai.google.dev/api/generate-content) | `generationConfig.thinkingConfig.thinkingLevel` or `generationConfig.thinkingConfig.thinkingBudget` | `thinkingLevel` is for Gemini 3 and later; earlier Gemini 2.5 models use a numeric token budget. This native shape is not automatically the Valve path for an OpenAI-compatible connection. |
| [OpenRouter Chat Completions](https://openrouter.ai/docs/api/api-reference/chat/send-chat-completion-request) | `reasoning.effort` or `reasoning_effort` | The latter is shorthand for the former. Levels and other reasoning options depend on the routed model; avoid conflicting values in both fields. |
| [Groq GPT-OSS / Qwen](https://console.groq.com/docs/reasoning) | `reasoning_effort` | GPT-OSS accepts `low`, `medium`, `high`; supported Qwen models may use `none`, `default`, and, on some models, `low`/`medium`/`high`. |
| [DeepSeek OpenAI-format API](https://api-docs.deepseek.com/guides/thinking_mode/) | `reasoning_effort`; `thinking.type` | The documented effort control maps named values to `low`, `high`, or `max`; `thinking.type` enables or disables thinking. The direct API docs do not establish a numeric 0–100 `reasoning_effort` range. |
| [xAI Chat / Responses](https://docs.x.ai/developers/model-capabilities/text/reasoning) | `reasoning_effort` / `reasoning.effort` | Current supported Grok reasoning models use `low`, `medium`, `high`, and sometimes `xhigh`; reasoning cannot be disabled on those models. |
| [Mistral Chat Completions](https://docs.mistral.ai/studio/conversations/reasoning) | `reasoning_effort` | Adjustable reasoning is documented for specific Mistral models. `none` and `high` have distinct output shapes; native Magistral models reason by default. |
| [Ollama native chat](https://github.com/ollama/ollama/blob/main/docs/api.md) | `think` | Boolean `true`/`false`, or `low`, `medium`, `high`, `max` for models that accept named levels. The userscript handles Open WebUI's Ollama route separately. |
| [Amazon Bedrock Converse: Claude](https://docs.aws.amazon.com/bedrock/latest/userguide/claude-messages-adaptive-thinking.html) | `additionalModelRequestFields.output_config.effort`; `additionalModelRequestFields.thinking.type` | Bedrock Converse has its own envelope. This is a native API shape, not a confirmed Open WebUI Valve path. |
| [Amazon Bedrock Converse: Nova](https://docs.aws.amazon.com/nova/latest/nova2-userguide/extended-thinking.html) | `additionalModelRequestFields.reasoningConfig.type` and `additionalModelRequestFields.reasoningConfig.maxReasoningEffort` | Set `type` to `enabled` with `low`, `medium`, or `high`. Nova's control differs from Claude's; verify your Bedrock integration before using it. |
| [vLLM OpenAI-compatible chat](https://docs.vllm.ai/en/latest/api/vllm/entrypoints/openai/chat_completion/protocol/) | `reasoning_effort`; optionally `chat_template_kwargs` | The server accepts named effort values, but whether they change generation depends on the model's chat template and server setup. |
| [LM Studio OpenAI-compatible endpoints](https://lmstudio.ai/docs/developer/api-changelog) | `reasoning_effort` (Chat) / `reasoning.effort` (Responses) | Responses support is documented in the API changelog; [Chat support](https://lmstudio.ai/changelog/lmstudio) depends on LM Studio version and loaded model. Check its server logs. |
| [llama.cpp server](https://github.com/ggml-org/llama.cpp/blob/master/tools/server/README.md) | `reasoning_effort` or `chat_template_kwargs.reasoning_effort` | Values are passed to the chat template; the template must implement the desired behavior. `chat_template_kwargs.enable_thinking` is another model-dependent switch. |

For a gateway-specific numeric control, set `value_type: "number"` and define confirmed numeric `efforts` for that exact model. Do not reuse the illustrative 0–100 range in the [full example](#full-configuration-example) as a claim about a provider's direct API.

</details>

## Usage

- Open the popup from the desktop pill or mobile navbar. Click the level title to switch between slider and full list.
- Select a level or reset to **Default**. Choices are stored per model in browser `localStorage`.
- A warning beside a level means that value is selectable but not confirmed for every selected model. When several models are selected, the list contains their combined choices; each request uses that model's own rule.
- If a request fails, check the browser developer console for messages prefixed `[Reasoning Effort Selector]`. Check the configured field, JSON type, model ID, and connection selector against the [provider parameter list](#major-provider-reasoning-parameters) and your provider's model documentation.

## FAQ

<details>
<summary><strong>The widget does not appear after updating.</strong></summary>

Hard-refresh the browser. For a Docker mount, open `/static/loader.js` and confirm it serves the current script. Check that the function ID contains `re-registry` if you expect Valve configuration.

</details>

<details>
<summary><strong>Is the registry function mandatory?</strong></summary>

No. Without it, the widget uses available model information and the legacy request fallback. Configure a provider rule to confirm the request format.

</details>

<details>
<summary><strong>Why does a configured provider still show a light-blue message?</strong></summary>

The request field is known, but that model's levels are still inferred. Add an exact model entry with `efforts`, or `levels: false` for a boolean switch, once you have confirmed them.

</details>

<details>
<summary><strong>Why did formatting my JSON change its behavior?</strong></summary>

Whitespace cannot change valid JSON. Check for an extra brace, missing comma, single quote, or a number written as a quoted string. The function reports the Valve name and JSON line/column in an error; the browser console reports registry-loading failures.

</details>

<details>
<summary><strong>Does it work on mobile or behind a reverse proxy?</strong></summary>

The native mount is served by Open WebUI to every client, including mobile browsers. A userscript runs only where its manager is installed. Keep the script and Open WebUI on the same origin for its intercepted requests.

</details>

<details>
<summary><strong>How do I uninstall it?</strong></summary>

Remove the Docker mount and recreate the container, or remove the userscript from its manager. Remove the registry function if you no longer use it.

</details>

## Credits

Based on [CryptoSharon's original Reasoning Effort addon for OpenWebUI](https://gist.github.com/CryptoSharon/a8590ce5663926a0bf37ef4ec8429b2c), including the original userscript and native integration idea. Thanks to the [Open WebUI](https://github.com/open-webui/open-webui) community.

## License

Complete license [here](./LICENSE)

Copyright (c) 2026 FrizzaFava
The original contribution by CryptoSharon remains attributed to its respective author; see [Credits](#credits).
