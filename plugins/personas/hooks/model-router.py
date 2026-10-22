"""Tier router, called by model-router.sh on UserPromptSubmit.

With Laya reachable (LAYA_API_URL, default http://localhost:8000): one /predict call asks level + risk of the
message. Without it: keyword floor, else tier `padrao`. Code decides: level -> rapido/padrao/profundo.
Skipped (no output, no log): prompts starting with `!` or `/` and machine turns (subagent hand-backs).
Every failure path prints nothing (or the fallback) and exits 0: it never blocks a prompt.
Decisions are logged to $MODEL_ROUTER_DIR (default ~/.claude/model-router/decisions.jsonl); set
MODEL_ROUTER_LOG=off to disable the log.
"""
import datetime
import json
import os
import re
import sys
import time
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import tier_quota as tq  # noqa: E402

LAYA_URL = os.environ.get("LAYA_API_URL", "http://localhost:8000")
CHECKPOINT = "english"
QUOTA_ON = os.environ.get("MODEL_ROUTER_QUOTA", "on").lower() != "off"
LOG_ON = os.environ.get("MODEL_ROUTER_LOG", "on").lower() != "off"

LEVEL_Q = {"type": "choice",
           "instructions": "How hard is this request to a coding agent?",
           "criteria": {
               "simple": "small localized change such as text, color, label, typo or renaming something, or a quick factual question",
               "routine": "common feature, new screen, report, endpoint, tests, documentation or configuration following an existing pattern",
               "hard": "bug with unknown cause, change across several parts of the project, concurrency, security, money or compliance rules, architecture or specification"}}
RISK_Q = {"type": "noul", "instructions": "Could carrying out this request break something that already works?"}

LEVELS = ["simple", "routine", "hard"]
AGENT = {"simple": ("rapido", "Haiku"), "routine": ("padrao", "Sonnet"), "hard": ("profundo", "Opus")}
LEVEL_GATE, RISK_CUT = 0.45, 0.70
ENVELOPES = ("<agent-message", "<task-notification")
STATE_CHARS = 600

# Safety floor on the user's OWN words (never quoted/pasted text, code fences or URL hosts).
SPLIT = re.compile(r"(?<=[a-z])(?=[A-Z])|_")
HARD = re.compile(r"\bsecurity\b|\bvulnerab|\bauth(entication|orization|orize)?\b|\bpasswords?\b|\bcredentials?\b|"
                  r"\btokens?\b|\bsecrets?\b|\bpayments?\b|\bbilling\b|\binvoices?\b|\btax(es)?\b|\bgdpr\b|\blgpd\b|"
                  r"\bhipaa\b|race condition|\bdeadlock|\bconcurren|\bmigrat|alter table|"
                  r"\bdrop\s+(table|database|schema|column|index|constraint)\b", re.I)
PASTED_CLOSED = re.compile(r'<pasted_content id="([^"]*)">(.*?)</pasted_content id="\1">', re.S)
PASTED_OPEN = re.compile(r"<pasted_content\b.*", re.S)
FENCE = re.compile(r"```.*?(```|\Z)", re.S)
QUOTE = re.compile(r"^[ \t]*>.*$", re.M)
URL_HOST = re.compile(r"https?://[^/\s]+")
KEYWORD_CHARS = 4000
SHORT_OUTSIDE = 40


def _clean(t):
    return SPLIT.sub(" ", URL_HOST.sub(" ", QUOTE.sub(" ", FENCE.sub(" ", t))))


def user_text(msg):
    if msg.lstrip().startswith(ENVELOPES):
        return ""
    return _clean(PASTED_OPEN.sub(" ", PASTED_CLOSED.sub(" ", msg)))[:KEYWORD_CHARS]


def keyword_floor(msg):
    """2 = profundo (keyword in the user's words), 1 = padrao (keyword only in pasted text), 0 = none."""
    ut = user_text(msg)
    if HARD.search(ut):
        return 2
    pasted = _clean(" ".join(m.group(2) for m in PASTED_CLOSED.finditer(msg)))
    if HARD.search(pasted):
        return 2 if len(re.sub(r"\W", "", ut)) < SHORT_OUTSIDE else 1
    return 0


def decide(msg, level, p, risk, laya_ok):
    if level not in LEVELS:
        level, laya_ok = "routine", False
    idx, reasons = LEVELS.index(level), []
    if not laya_ok:
        reasons.append("Laya unavailable")
    elif idx == 0:
        if p < LEVEL_GATE:
            reasons.append("confidence %.2f < %.2f" % (p, LEVEL_GATE))
        if risk > RISK_CUT:
            reasons.append("risk %.2f > %.2f" % (risk, RISK_CUT))
        if reasons:
            idx = 1
    kw = keyword_floor(msg)
    if kw > idx:
        idx = kw
        reasons.append("critical topic (security/money/schema)" if kw == 2 else "critical topic in pasted text")
    return idx, reasons


def route(msg, level, p, risk, laya_ok, history):
    idx, reasons = decide(msg, level, p, risk, laya_ok)
    floor = keyword_floor(msg)
    if not laya_ok:
        return tq.fallback(floor, history), reasons
    new = tq.balance(idx, floor, history) if QUOTA_ON else idx
    if new != idx:
        reasons.append("quota 50/35/15: %s -> %s" % (tq.TIERS[idx], tq.TIERS[new]))
    return new, reasons


def predict(state, questions, timeout=4):
    body = json.dumps({"state": state, "questions": questions, "model": CHECKPOINT}).encode()
    req = urllib.request.Request(LAYA_URL + "/predict", body, {"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=timeout))["answers"]


def top(answer):
    choice = answer["choice"]
    return choice, float(answer["probabilities"][choice])


def main():
    try:
        data = json.load(sys.stdin)
    except Exception:
        return
    msg = (data.get("prompt") or "").strip()
    if not msg or msg[0] in "!/" or msg.startswith(ENVELOPES):
        return

    laya_ok, fail, t0 = True, "", time.time()
    level, p, risk = "routine", 0.0, 0.0
    try:
        ans = predict({"message": msg[:STATE_CHARS]}, {"level": LEVEL_Q, "risk": RISK_Q})
        level, p = top(ans["level"])
        risk = float(ans["risk"]["noul"])
    except Exception as e:
        laya_ok, fail = False, type(e).__name__
    laya_ms = int((time.time() - t0) * 1000)

    history = tq.router_history() if (laya_ok and QUOTA_ON) else []
    idx, reasons = route(msg, level, p, risk, laya_ok, history)
    if fail:
        reasons = [r + " (" + fail + ")" if r == "Laya unavailable" else r for r in reasons]
    final = LEVELS[min(idx, 2)]
    agent, model = AGENT[final]

    if LOG_ON:
        rec = {"ts": datetime.datetime.now().isoformat(timespec="seconds"), "session_id": data.get("session_id"),
               "message": re.sub(r"\s+", " ", msg)[:160], "laya_level": level, "confidence": round(p, 3),
               "risk": round(risk, 3), "level": final, "agent": agent, "model": model,
               "laya_ms": laya_ms, "reasons": reasons}
        try:
            os.makedirs(tq.log_dir(), exist_ok=True)
            with open(os.path.join(tq.log_dir(), "decisions.jsonl"), "a", encoding="utf-8") as f:
                f.write(json.dumps(rec, ensure_ascii=False) + "\n")
        except OSError:
            pass

    src = ("Laya: %s, confidence %.2f, risk %.2f" % (level, p, risk)) if laya_ok else "keyword fallback"
    why = ("; adjustment: " + ", ".join(reasons)) if reasons else ""
    ctx = ("[model-router] level %s (%s%s) -> suggested subagent `personas:%s` (%s). "
           "Consider delegating the work with Agent subagent_type=\"personas:%s\" and relaying a short summary."
           % (final, src, why, agent, model, agent))
    print(json.dumps({"hookSpecificOutput": {"hookEventName": "UserPromptSubmit", "additionalContext": ctx}},
                     ensure_ascii=False))


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
