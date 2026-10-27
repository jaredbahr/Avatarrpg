"""Minimal PixelLab v2 client that records every call in ../ledger.json.

Usage (from the repo root):  python3 -I art/source/ba-dan-market-g/tools/pl.py <spec.json>
A spec is {"id": "...", "endpoint": "/create-object-pro-flash", "body": {...}, "inputs": {"image": "path.png", ...}}
where each inputs entry is a dotted body path filled with {"type":"base64","base64":...}.
The key is read from PIXELLAB_API_KEY and never written anywhere.
"""
import base64, json, os, sys, time, urllib.request, hashlib, datetime, pathlib

ROOT = pathlib.Path(__file__).resolve().parent.parent
API = "https://api.pixellab.ai/v2"
LEDGER = ROOT / "ledger.json"


def call(method, path, body=None):
    req = urllib.request.Request(API + path, method=method,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + os.environ["PIXELLAB_API_KEY"],
                                          "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            return json.loads(r.read() or b"{}")
    except urllib.error.HTTPError as e:
        return {"http_error": e.code, "detail": e.read().decode()[:2000]}


def b64(path):
    return {"type": "base64", "base64": base64.b64encode(open(ROOT / path, "rb").read()).decode()}


def set_path(d, dotted, value):
    keys = dotted.split(".")
    for k in keys[:-1]:
        d = d.setdefault(k, {})
    d[keys[-1]] = value


def balance():
    r = call("GET", "/balance")
    return r.get("subscription", {}).get("generations")


def fetch(url, dest):
    headers = {"Authorization": "Bearer " + os.environ["PIXELLAB_API_KEY"]} if "api.pixellab.ai" in url else {}
    headers["User-Agent"] = "curl/8.5.0"
    if url.startswith("/"):
        url = "https://api.pixellab.ai" + url
        headers = {"Authorization": "Bearer " + os.environ["PIXELLAB_API_KEY"], "User-Agent": "curl/8.5.0"}
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=120) as r:
            dest.write_bytes(r.read())
        return True
    except Exception as e:  # noqa: BLE001
        print("fetch failed", url.split("?")[0], e, file=sys.stderr)
        return False


def run(spec, recover=None):
    body = json.loads(json.dumps(spec["body"]))
    for dotted, path in spec.get("inputs", {}).items():
        set_path(body, dotted, b64(path))
    before = balance()
    started = datetime.datetime.now(datetime.timezone.utc).isoformat()
    r = recover
    for attempt in range(40):
        if r is not None:
            break
        r = call("POST", spec["endpoint"], body)
        if r.get("http_error") == 429:   # the account's concurrent-job cap is shared with other sessions
            r = None
            time.sleep(20)
    r = r or {"http_error": 429}
    job = r.get("background_job_id") or r.get("job_id")
    obj = r.get("object_id")
    print("queued", spec["id"], job, obj, r.get("http_error", ""), r.get("detail", "")[:300], file=sys.stderr)
    result = r
    if job:
        for _ in range(120):
            time.sleep(5)
            result = call("GET", f"/background-jobs/{job}")
            if result.get("status") in ("completed", "failed", "cancelled"):
                break
    out_dir = ROOT / "raw" / spec["id"]
    out_dir.mkdir(parents=True, exist_ok=True)
    files = []
    lr = result.get("last_response") or {}
    urls = []
    for key in ("image_url", "url"):
        if isinstance(lr.get(key), str):
            urls.append(lr[key])
        if isinstance(result.get(key), str):
            urls.append(result[key])
    for im in lr.get("images", []) or []:
        if isinstance(im, dict) and im.get("base64"):
            p = out_dir / f"{len(files)}.png"
            p.write_bytes(base64.b64decode(im["base64"]))
            files.append(p)
        elif isinstance(im, dict) and im.get("url"):
            urls.append(im["url"])
    if isinstance(lr.get("image"), dict) and lr["image"].get("base64"):
        p = out_dir / f"{len(files)}.png"
        p.write_bytes(base64.b64decode(lr["image"]["base64"]))
        files.append(p)
    if obj and not files and not urls:
        o = call("GET", f"/objects/{obj}")
        for k, u in (o.get("storage_urls") or {}).items():
            if u:
                urls.append(u)
        for k, u in (o.get("rotation_urls") or {}).items():
            if u:
                urls.append(u)
    seen = {hashlib.sha256(p.read_bytes()).hexdigest() for p in files}
    for u in dict.fromkeys(urls):
        p = out_dir / f"{len(files)}.png"
        if fetch(u, p):
            h = hashlib.sha256(p.read_bytes()).hexdigest()
            if h in seen:
                p.unlink()
                continue
            seen.add(h)
            files.append(p)
    after = balance()
    entry = {
        "id": spec["id"], "endpoint": spec["endpoint"], "started": started,
        "job_id": job, "object_id": obj, "status": result.get("status", r.get("http_error")),
        "body": spec["body"], "inputs": {k: {"path": v, "sha256": hashlib.sha256((ROOT / v).read_bytes()).hexdigest()}
                                         for k, v in spec.get("inputs", {}).items()},
        "usage": result.get("usage") or lr.get("usage"),
        "balance_before": before, "balance_after": after,
        # the account is shared with other sessions, so the balance delta is not this call's cost
        "gens": ((result.get("usage") or lr.get("usage") or {}).get("generations")),
        "outputs": [{"path": str(p.relative_to(ROOT)), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in files],
        "verdict": spec.get("verdict", "pending"), "note": spec.get("note", ""),
    }
    if not files:
        entry["error"] = json.dumps({k: v for k, v in result.items() if k != "last_response"})[:1500] + json.dumps(lr)[:1500]
    import fcntl
    import tempfile
    with open(os.path.join(tempfile.gettempdir(), "ba-dan-market-g-ledger.lock"), "w") as lock:  # parallel writers
        fcntl.flock(lock, fcntl.LOCK_EX)
        ledger = json.loads(LEDGER.read_text()) if LEDGER.exists() else {"entries": []}
        ledger["entries"] = [e for e in ledger["entries"] if e["id"] != spec["id"]] + [entry]
        tmp = LEDGER.with_suffix(".tmp")
        tmp.write_text(json.dumps(ledger, indent=1) + "\n")
        tmp.replace(LEDGER)
        # keep the ledger in the repository's Prettier format (format:check runs over art/source)
        import subprocess
        subprocess.run(["npx", "--no-install", "prettier", "--write", str(LEDGER)], cwd=ROOT,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, check=False)
    print(json.dumps({k: entry[k] for k in ("id", "status", "gens", "balance_after", "outputs")} | ({"error": entry["error"]} if "error" in entry else {})))


if __name__ == "__main__":
    if sys.argv[1] == "--recover":  # --recover spec.json job_id [object_id]
        run(json.load(open(sys.argv[2])), {"background_job_id": sys.argv[3], "object_id": (sys.argv[4:] or [None])[0]})
    else:
        for path in sys.argv[1:]:
            run(json.load(open(path)))
