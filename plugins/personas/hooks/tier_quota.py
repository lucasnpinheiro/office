"""Tier quota: keeps the mix of suggested tiers near 50/35/15 (rapido / padrao / profundo).

Pure functions; the caller passes the history (tier names of the last decisions). Shares are measured over
the last WINDOW entries; a tier over its target hands the request to the neighbour with the largest deficit,
never below the keyword floor. Set MODEL_ROUTER_QUOTA=off to disable (the classifier tier is kept as is).
"""
import collections
import json
import os

TIERS = ("rapido", "padrao", "profundo")
TARGET = {"rapido": 0.50, "padrao": 0.35, "profundo": 0.15}
WINDOW = 100
TAIL_LINES = 5000


def shares(history):
    h = [t for t in history if t in TARGET][-WINDOW:]
    if not h:
        return {t: 0.0 for t in TIERS}
    c = collections.Counter(h)
    return {t: c[t] / len(h) for t in TIERS}


def deficit(history):
    if not [t for t in history if t in TARGET]:
        return dict(TARGET)
    s = shares(history)
    return {t: TARGET[t] - s[t] for t in TIERS}


def balance(idx, floor, history):
    """Classifier tier idx (0..2) -> quota tier: keep it unless over target; then move ONE step to the
    neighbour with the largest positive deficit, never below the floor."""
    idx = max(idx, floor)
    d = deficit(history)
    if d[TIERS[idx]] >= 0:
        return idx
    cands = [j for j in (idx - 1, idx + 1) if floor <= j <= 2 and d[TIERS[j]] > 0]
    return max(cands, key=lambda j: d[TIERS[j]]) if cands else idx


def fallback(floor, history):
    """No classifier (Laya down): `padrao` unless the keyword floor says higher. Quota-free on purpose:
    without a classifier there is no signal to balance."""
    return max(floor, 1)


def tail_rows(path, n=TAIL_LINES):
    try:
        with open(path, encoding="utf-8") as f:
            lines = collections.deque(f, maxlen=n)
    except OSError:
        return []
    out = []
    for line in lines:
        try:
            out.append(json.loads(line))
        except ValueError:
            continue
    return out


def log_dir():
    return os.environ.get("MODEL_ROUTER_DIR") or os.path.join(os.path.expanduser("~"), ".claude", "model-router")


def router_history():
    return [r.get("agent") for r in tail_rows(os.path.join(log_dir(), "decisions.jsonl"))]
