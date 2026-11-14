"""Finds Roblox games that have a Discord server and writes games.json (run by GitHub Actions)."""
import json, os, re, time, uuid, urllib.parse, requests

S = requests.Session()
S.headers["User-Agent"] = "Mozilla/5.0 (X11; Linux x86_64) roblox-finder"
MIN_CCU = 300          # ignore games below this many players
MAX_WEB = 20           # web searches per run (keeps it fast and avoids blocks)
RETRY_DAYS = 3         # re-search games with no Discord after this many days
CACHE_FILE = "discord_cache.json"
INV = re.compile(r"(?:discord\.gg|discord(?:app)?\.com/invite)/([A-Za-z0-9-]{2,32})", re.I)
cache = json.load(open(CACHE_FILE)) if os.path.exists(CACHE_FILE) else {}
web_used = 0

def get(url, **kw):
    for i in range(4):
        try:
            r = S.get(url, timeout=20, **kw)
            if r.status_code == 404: return None
            if r.status_code == 429:
                time.sleep(5 * (i + 1)); continue
            if r.ok: return r.json()
        except (requests.RequestException, ValueError):
            pass
        time.sleep(2)
    return None

def find_ids(obj, out):
    if isinstance(obj, dict):
        if "universeId" in obj: out.add(obj["universeId"])
        for v in obj.values(): find_ids(v, out)
    elif isinstance(obj, list):
        for v in obj: find_ids(v, out)

def discover():
    ids, sid = set(), str(uuid.uuid4())
    base = "https://apis.roblox.com/explore-api/v1"
    data = get(f"{base}/get-sorts", params={"sessionId": sid, "device": "computer", "country": "all"})
    if not data: return ids
    find_ids(data, ids)
    for s in data.get("sorts", []):
        sort, token = s.get("sortId"), None
        if not sort: continue
        for _ in range(30):
            p = {"sessionId": sid, "sortId": sort, "device": "computer", "country": "all"}
            if token: p["cursor"] = token
            page = get(f"{base}/get-sort-content", params=p)
            if not page: break
            find_ids(page, ids)
            token = page.get("nextSortTokenOrCursor") or page.get("nextPageToken") or page.get("nextCursor")
            if not token: break
            time.sleep(0.5)
    return ids

def details(ids):
    ids, out = list(ids), []
    for i in range(0, len(ids), 100):
        d = get("https://games.roblox.com/v1/games", params={"universeIds": ",".join(map(str, ids[i:i+100]))})
        if d: out += d.get("data", [])
        time.sleep(0.5)
    return out

def invite_info(code):
    """Checks the invite is alive and returns the server name + member count."""
    d = get(f"https://discord.com/api/v9/invites/{code}", params={"with_counts": "true"})
    if d and d.get("guild"):
        return {"url": f"https://discord.gg/{code}", "server": d["guild"]["name"],
                "members": d.get("approximate_member_count", 0)}
    return None

def codes_in(text):
    out = []
    for c in INV.findall(urllib.parse.unquote(text or "")):
        if c not in out: out.append(c)
    return out

def words(s):
    return set(re.findall(r"[a-z0-9]{4,}", (s or "").lower())) - {"roblox", "game", "simulator", "tycoon", "official"}

def web_search(name):
    clean = " ".join(re.sub(r"\[.*?\]|\(.*?\)|[^\w\s]", " ", name).split())
    try:
        r = S.get("https://html.duckduckgo.com/html/", params={"q": f'"{clean}" roblox discord server'}, timeout=20)
        return codes_in(r.text)[:3]
    except requests.RequestException:
        return []

def find_discord(g):
    global web_used
    uid, codes = g["id"], []
    # 1) links the dev added on the game page
    d = get(f"https://games.roblox.com/v1/games/{uid}/social-links/list")
    for l in (d or {}).get("data", []):
        if "discord" in (l.get("type") or "").lower() or "discord" in (l.get("url") or "").lower():
            codes += codes_in(l.get("url"))
    for c in codes:
        r = invite_info(c)
        if r: return {**r, "src": "roblox"}
    # 2) invite written in the game description
    for c in codes_in(g.get("description")):
        r = invite_info(c)
        if r: return {**r, "src": "description"}
    # 3) the group that owns the game (social links + description)
    cr = g.get("creator") or {}
    if cr.get("type") == "Group":
        gid = cr.get("id")
        d = get(f"https://groups.roblox.com/v1/groups/{gid}/social-links")
        txt = " ".join(l.get("url", "") for l in (d or {}).get("data", []))
        info = get(f"https://groups.roblox.com/v1/groups/{gid}")
        txt += " " + ((info or {}).get("description") or "")
        for c in codes_in(txt):
            r = invite_info(c)
            if r: return {**r, "src": "group"}
    # 4) web search; only accept if the server name matches the game name
    if web_used >= MAX_WEB: return None   # not cached, retried next run
    web_used += 1
    time.sleep(2)
    for c in web_search(g["name"]):
        r = invite_info(c)
        if r and words(g["name"]) & words(r["server"]): return {**r, "src": "web"}
    return {"url": ""}

def votes(ids):
    out = {}
    for i in range(0, len(ids), 100):
        d = get("https://games.roblox.com/v1/games/votes", params={"universeIds": ",".join(map(str, ids[i:i+100]))})
        for v in (d or {}).get("data", []):
            out[v["id"]] = (v.get("upVotes", 0), v.get("downVotes", 0))
        time.sleep(0.4)
    return out

def thumbs(ids):
    out = {}
    for i in range(0, len(ids), 100):
        d = get("https://thumbnails.roblox.com/v1/games/icons", params={
            "universeIds": ",".join(map(str, ids[i:i+100])), "size": "256x256", "format": "Png", "returnPolicy": "PlaceHolder"})
        for t in (d or {}).get("data", []):
            if t.get("imageUrl"): out[t["targetId"]] = t["imageUrl"]
        time.sleep(0.4)
    return out

FAST = os.environ.get("FAST") == "1"   # fast run = only refresh numbers of known games
KEEP_CCU = 100                          # known games stay in the list until they drop below this
prev = {}
if os.path.exists("games.json"):
    try: prev = {g["id"]: g for g in json.load(open("games.json"))}
    except ValueError: prev = {}

ids = set(prev) if FAST else set(prev) | discover()
need = [g for g in details(ids) if g.get("playing", 0) >= (KEEP_CCU if g["id"] in prev else MIN_CCU)]
vt = {} if FAST else votes([g["id"] for g in need])
th = {} if FAST else thumbs([g["id"] for g in need if not prev.get(g["id"], {}).get("thumb")])

games = []
for g in need:
    uid, old = str(g["id"]), prev.get(g["id"], {})
    c = cache.get(uid)
    stale = not isinstance(c, dict) or (not c.get("url") and time.time() - c.get("checked", 0) > RETRY_DAYS * 86400)
    if stale and not FAST:
        res = find_discord(g)
        if res is not None: c = cache[uid] = {**res, "checked": time.time()}
        time.sleep(0.3)
    c = c if isinstance(c, dict) else {}
    up, down = vt.get(g["id"], (old.get("likes", 0), old.get("dislikes", 0)))
    games.append({"id": g["id"], "placeId": g.get("rootPlaceId"), "name": g["name"], "ccu": g["playing"],
                  "visits": g["visits"], "created": g["created"], "description": (g.get("description") or "")[:400],
                  "likes": up, "dislikes": down, "favorites": g.get("favoritedCount", old.get("favorites", 0)),
                  "thumb": th.get(g["id"]) or old.get("thumb", ""), "discord": c.get("url", ""),
                  "server": c.get("server", ""), "members": c.get("members", 0), "src": c.get("src", "")})

json.dump(games, open("games.json", "w"), separators=(",", ":"))
json.dump(cache, open(CACHE_FILE, "w"))
print(f"saved {len(games)} games, {sum(1 for g in games if g['discord'])} with Discord, {web_used} web searches")
