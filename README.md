> DISCLAIMER: this project was created with the assistance of an LLM. Although major parts of the code was generated, it was entirely reviewed and tested by a human. Also this project wouldn't exist without the contribution of CryptoSharon, please see the [credits](#credits) section for more info.

# Reasoning Effort Selector for Open WebUI

![Demo gif](assets/demo.gif)

# UPDATE:
since the v0.12.0 of Open WebUI, they FINALLY added a native control, you can customize more parameters and have a more comprehensive graphical per-model configuration, for older versions of OWUI, you can use the older version of this plugin in the [archive](archive) directory and read it's [README](archive/README.old.md). [Official v0.12.0 changelog](https://github.com/open-webui/open-webui/releases/tag/v0.12.0)

## What this is

Before the new version of OWUI that added official support for an effort slider, this was a userscript implementation that added a ChatGPT style effort selector (you can still find the older implementation of this plugin in the releases before v3.0.4 and in the [archive](archive) directory.
Right now this just a reskin of the native implementation to mimic the same ChatGPT slider style.

## Requirements

1. A brain
2. Open WebUI version v0.12.0 or later.

## Installation

1. In Open WebUI, open **Admin Panel → Functions → Create a Function** and paste the contents of [`main.py`](main.py).
2. Activate it.
3. Hard refresh the browser (ctrl + shift + R).

## Credits

Based on [CryptoSharon's original Reasoning Effort addon for OpenWebUI](https://gist.github.com/CryptoSharon/a8590ce5663926a0bf37ef4ec8429b2c), including the original userscript and native integration idea. Thanks to the [Open WebUI](https://github.com/open-webui/open-webui) community.

## License

Complete license [here](./LICENSE)

Copyright (c) 2026 FrizzaFava
The original contribution by CryptoSharon remains attributed to its respective author; see [Credits](#credits).
