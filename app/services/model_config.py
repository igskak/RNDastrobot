"""
Central model registry: role -> model id, resolved from env with per-role
defaults.

One place to define which model each agent uses. Defaults preserve the exact
values each call site used before centralization, so migrating a site is a pure
substitution (same env var, same default => same model id). Setting the env var
overrides the default for that role only.

This is also the seam where a provider swap would live: today every caller uses
the OpenAI client, but resolving the model id through one function is the first
step toward a provider-agnostic ``client_for(role)`` (the design keeps Anthropic
on the table for a later stage).
"""
from __future__ import annotations

import os
from typing import Dict, Tuple

# role -> (env var, default). Defaults MUST match the historical values so
# centralization changes no behavior:
#   assistant  <- astro_assistant_service._MODEL
#   summary    <- openai_service._MODEL
#   transcribe <- openai_service._TRANSCRIBE_MODEL
#   judge      <- new (Layer-3 gate, T5); safe default = same as assistant,
#                 tune to a smaller/faster model after the eval.
_MODELS: Dict[str, Tuple[str, str]] = {
    "assistant": ("OPENAI_ASSISTANT_MODEL", "gpt-5.4-mini"),
    "judge": ("OPENAI_JUDGE_MODEL", "gpt-5.4-mini"),
    # Narrative Analyst (spec §16), on a reasoning model per §7.1. The stage is
    # gated separately, so this default only applies once it is switched on —
    # and it is the configuration that won a live comparison of the narration
    # stage on identical findings:
    #   luna  / low     15.2s
    #   luna  / medium  19.2s
    #   terra / medium  26.0s
    #   sol   / medium  51.3s   (also leaked internal profile ids into the prose)
    # Defaulting to the winner matters because the flag is the only gate: left on
    # the assistant model, flipping it alone would buy the weakest variant tried.
    "narrative": ("OPENAI_NARRATIVE_MODEL", "gpt-5.6-luna"),
    "summary": ("OPENAI_SUMMARY_MODEL", "gpt-4.1"),
    "transcribe": ("OPENAI_TRANSCRIBE_MODEL", "gpt-4o-transcribe"),
}


def model_for(role: str) -> str:
    """Resolve the model id for a role from env, falling back to its default."""
    try:
        env_var, default = _MODELS[role]
    except KeyError:
        raise ValueError(f"unknown model role: {role!r}")
    return os.getenv(env_var, default)


def known_roles() -> Tuple[str, ...]:
    return tuple(_MODELS)
