from __future__ import annotations
import argparse
import json
import logging
import os
import sys
import time
from copy import deepcopy
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple
import random
import requests
from tqdm import tqdm  # progress bar if available
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

_HAS_TQDM = True
_HAS_RETRIES = True


# ---------- Configuration ----------
DEFAULT_BASE_JSON_URL = (
    "https://www.shortcutfoo.com/_next/data/V2ZzQwBGu-tTlA-2nzgDp/app/dojos.json"
)
DEFAULT_CHEATSHEET_URL_TPL = "https://www.shortcutfoo.com/_next/data/V2ZzQwBGu-tTlA-2nzgDp/app/dojos/{slug}/cheatsheet.json"
DEFAULT_DATA_DIR = "data"
TOOLS_FILENAME = "tools.json"
CHEATSHEET_DIRNAME = "cheatsheet"
USER_AGENT = "Mozilla/5.0 (compatible; scrapper/1.0; +https://example.local)"
# -----------------------------------

# ---------- Logging ----------
logger = logging.getLogger("scrapper")
_handler = logging.StreamHandler()
_formatter = logging.Formatter(
    "%(asctime)s %(levelname)-7s %(message)s", "%Y-%m-%d %H:%M:%S"
)
_handler.setFormatter(_formatter)
logger.addHandler(_handler)
logger.setLevel(logging.INFO)


# ---------- Utilities ----------
def ensure_dir(path: str) -> None:
    os.makedirs(path, exist_ok=True)


def load_json(path: str) -> Optional[dict]:
    if not os.path.exists(path):
        return None
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception as e:
        logger.warning("Failed to load JSON from %s: %s", path, e)
        return None


def save_json(path: str, data: dict) -> None:
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=4)
    os.replace(tmp, path)  # atomic-ish replace


def safe_slug(slug: str) -> str:
    # Very mild normalization for filenames
    return slug.replace("/", "_")


def make_requests_session(
    retries: int = 3, backoff_factor: float = 0.3, timeout: int = 10
) -> Tuple[requests.Session, int]:
    session = requests.Session()
    session.headers.update({"Accept": "application/json", "User-Agent": USER_AGENT})
    if _HAS_RETRIES:
        retry = Retry(
            total=retries,
            read=retries,
            connect=retries,
            backoff_factor=backoff_factor,
            status_forcelist=(429, 500, 502, 503, 504),
            allowed_methods=frozenset(
                ["GET", "POST", "PUT", "DELETE", "HEAD", "OPTIONS"]
            ),
        )
        adapter = HTTPAdapter(max_retries=retry)
        session.mount("https://", adapter)
        session.mount("http://", adapter)
    return session, timeout


@dataclass
class Stats:
    total_tools_current: int = 0
    tools_added: int = 0
    tools_removed: int = 0
    tools_unchanged: int = 0
    total_cheatsheets_fetched: int = 0
    cheatsheets_new: int = 0
    cheatsheets_changed: int = 0
    cheatsheets_unchanged: int = 0
    cheatsheets_removed: int = 0


# ---------- Fetching ----------
def fetch_shortcutfoo_dojos(
    session: requests.Session, timeout: int, url: str = DEFAULT_BASE_JSON_URL
) -> dict:

    logger.debug("Fetching tool list from %s", url)
    resp = session.get(url, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    dojos = data.get("pageProps", {}).get("dojos", [])
    tools = []
    for dojo in dojos:
        tools.append(
            {
                "id": dojo.get("id"),
                "name": dojo.get("name"),
                "slug": dojo.get("slug"),
                "category": dojo.get("category"),
                "os": dojo.get("os"),
                "page_metadata": dojo.get("page_metadata"),
            }
        )
    return {"tools": tools}


def fetch_shortcutfoo_tool(
    session: requests.Session,
    timeout: int,
    slug: str,
    url_tpl: str = DEFAULT_CHEATSHEET_URL_TPL,
) -> dict:

    url = url_tpl.format(slug=slug)
    params = {"id": slug}
    logger.debug("Fetching cheatsheet for slug=%s url=%s", slug, url)
    resp = session.get(url, params=params, timeout=timeout)
    resp.raise_for_status()
    data = resp.json()
    dojo = data.get("pageProps", {}).get("dojo", {})
    tool = {
        "slug": dojo.get("slug"),
        "name": dojo.get("name"),
        "os": dojo.get("os"),
        "page_metadata": dojo.get("page_metadata"),
        "units": dojo.get("units", []),
    }
    return {"tool": tool}


# ---------- Comparison helpers ----------
def compare_tools(
    prev_tools: Optional[dict], cur_tools: dict
) -> Tuple[List[dict], List[dict], List[dict]]:

    prev_list = (prev_tools or {}).get("tools", [])
    cur_list = cur_tools.get("tools", [])

    prev_map = {t.get("slug"): t for t in prev_list}
    cur_map = {t.get("slug"): t for t in cur_list}

    prev_slugs = set(prev_map.keys())
    cur_slugs = set(cur_map.keys())

    added_slugs = cur_slugs - prev_slugs
    removed_slugs = prev_slugs - cur_slugs
    unchanged_slugs = cur_slugs & prev_slugs

    added = [cur_map[s] for s in sorted(added_slugs)]
    removed = [prev_map[s] for s in sorted(removed_slugs)]
    unchanged = [cur_map[s] for s in sorted(unchanged_slugs)]

    return added, removed, unchanged


def deep_equal(a, b) -> bool:
    try:
        return json.dumps(a, sort_keys=True, ensure_ascii=False) == json.dumps(
            b, sort_keys=True, ensure_ascii=False
        )
    except Exception:
        return a == b


# ---------- Progress bar fallback ----------
class SimpleProgress:
    def __init__(self, total: int, desc: str = ""):
        self.total = total
        self.count = 0
        self.desc = desc
        self.start = time.time()
        print(f"{desc} 0/{total}", end="", flush=True)

    def update(self, n=1):
        self.count += n
        elapsed = time.time() - self.start
        print(
            f"\r{self.desc} {self.count}/{self.total} (elapsed {elapsed:.1f}s)",
            end="",
            flush=True,
        )

    def close(self):
        print()


# ---------- Main runner ----------
def run_scraper(
    data_dir: str = DEFAULT_DATA_DIR,
    download_cheatsheets: bool = True,
    timeout: int = 10,
    retries: int = 3,
    verbose: bool = False,
    delay_min: float = 2.0,
    delay_max: float = 5.0,
) -> Stats:

    if verbose:
        logger.setLevel(logging.DEBUG)
        logger.debug("Verbose logging enabled")

    ensure_dir(data_dir)
    cheatsheet_dir = os.path.join(data_dir, CHEATSHEET_DIRNAME)
    ensure_dir(cheatsheet_dir)

    session, effective_timeout = make_requests_session(retries=retries, timeout=timeout)

    stats = Stats()

    tools_path = os.path.join(data_dir, TOOLS_FILENAME)
    prev_tools = load_json(tools_path)
    if prev_tools is None:
        logger.info(
            "No previous tools.json found; this is a first run or data dir is empty."
        )
    else:
        logger.debug(
            "Loaded previous tools.json with %d tools", len(prev_tools.get("tools", []))
        )

    try:
        current_tools = fetch_shortcutfoo_dojos(session, effective_timeout)
    except Exception as exc:
        logger.error("Failed to fetch tools list: %s", exc)
        raise

    save_json(tools_path, current_tools)
    stats.total_tools_current = len(current_tools.get("tools", []))
    logger.info(
        "Fetched %d tools and saved to %s", stats.total_tools_current, tools_path
    )

    added_tools, removed_tools, unchanged_tools = compare_tools(
        prev_tools, current_tools
    )
    stats.tools_added = len(added_tools)
    stats.tools_removed = len(removed_tools)
    stats.tools_unchanged = len(unchanged_tools)

    logger.info(
        "Tools summary: +%d added, -%d removed, %d unchanged",
        stats.tools_added,
        stats.tools_removed,
        stats.tools_unchanged,
    )

    if download_cheatsheets:
        slugs = [t.get("slug") for t in current_tools.get("tools", []) if t.get("slug")]
        total = len(slugs)
        if _HAS_TQDM:
            prog = tqdm(slugs, desc="Downloading cheatsheets", unit="file")
            prog_iter = prog
        else:
            prog = SimpleProgress(total, desc="Downloading cheatsheets")
            prog_iter = slugs

        existing_files = set()
        for fname in os.listdir(cheatsheet_dir):
            if fname.endswith(".json"):
                existing_files.add(fname[:-5])

        processed_files = set()

        for s in prog_iter:
            slug = s if _HAS_TQDM else s
            try:
                result = fetch_shortcutfoo_tool(session, effective_timeout, slug)
            except Exception as exc:
                logger.warning("Failed to fetch cheatsheet for slug=%s: %s", slug, exc)
                if _HAS_TQDM:
                    prog.set_postfix({"error": slug})
                else:
                    print(f"\nWarning: failed to fetch {slug}: {exc}")
                if _HAS_TQDM:
                    prog.update(1)
                else:
                    prog.update(1)
                continue

            tool = result.get("tool", {})
            filename = safe_slug(slug) + ".json"
            file_path = os.path.join(cheatsheet_dir, filename)
            processed_files.add(slug)

            out = {"tool": tool}

            existing = load_json(file_path)
            if existing is None:
                save_json(file_path, out)
                stats.cheatsheets_new += 1
                logger.info("New cheatsheet saved: %s", file_path)
            else:
                if deep_equal(existing, out):
                    stats.cheatsheets_unchanged += 1
                    logger.debug("Unchanged cheatsheet: %s", file_path)
                else:
                    # changed
                    save_json(file_path, out)
                    stats.cheatsheets_changed += 1
                    logger.info("Updated cheatsheet (changed): %s", file_path)

            stats.total_cheatsheets_fetched += 1

            if _HAS_TQDM:
                prog.update(1)
            else:
                prog.update(1)

            sleep_time = random.uniform(delay_min, delay_max)
            if verbose:
                logger.debug("Sleeping for %.2fs before next request", sleep_time)
            time.sleep(sleep_time)

        if _HAS_TQDM:
            prog.close()
        else:
            prog.close()

        removed = 0
        for fname in os.listdir(cheatsheet_dir):
            if not fname.endswith(".json"):
                continue
            slugname = fname[:-5]
            if slugname not in {safe_slug(s) for s in slugs}:
                removed += 1
        stats.cheatsheets_removed = removed
        logger.info(
            "Cheatsheets summary: %d new, %d changed, %d unchanged, %d removed",
            stats.cheatsheets_new,
            stats.cheatsheets_changed,
            stats.cheatsheets_unchanged,
            stats.cheatsheets_removed,
        )
    else:
        logger.info("Skipping cheatsheet downloads (--no-download-cheatsheets set)")

    return stats


# ---------- CLI ----------
def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="ShortcutFoo dojos & cheatsheets scraper (CLI-only)."
    )
    p.add_argument(
        "--data-dir",
        default=DEFAULT_DATA_DIR,
        help="Directory to store data (default: data)",
    )
    p.add_argument(
        "--no-download-cheatsheets",
        action="store_true",
        help="Only fetch tools.json; skip per-tool cheatsheet downloads",
    )
    p.add_argument(
        "--timeout",
        type=int,
        default=10,
        help="Request timeout in seconds (default: 10)",
    )
    p.add_argument(
        "--retries", type=int, default=3, help="HTTP request retries (default: 3)"
    )
    p.add_argument(
        "--delay-min",
        type=float,
        default=2.0,
        help="Minimum delay between cheatsheet fetches (seconds, default: 2)",
    )
    p.add_argument(
        "--delay-max",
        type=float,
        default=5.0,
        help="Maximum delay between cheatsheet fetches (seconds, default: 5)",
    )
    p.add_argument(
        "--verbose", "-v", action="store_true", help="Verbose logging / debug"
    )
    p.add_argument("--version", action="version", version="scrapper/1.0")
    return p.parse_args(argv)


def main(argv=None):
    args = parse_args(argv)
    try:
        stats = run_scraper(
            data_dir=args.data_dir,
            download_cheatsheets=not args.no_download_cheatsheets,
            timeout=args.timeout,
            retries=args.retries,
            verbose=args.verbose,
            delay_min=args.delay_min,
            delay_max=args.delay_max,
        )
    except Exception as e:
        logger.error("Scraper failed: %s", e)
        sys.exit(2)

    # Print concise final summary
    print("\n=== Scraper run summary ===")
    print(f"Total tools fetched: {stats.total_tools_current}")
    print(f"Tools added: {stats.tools_added}")
    print(f"Tools removed: {stats.tools_removed}")
    print(f"Tools unchanged: {stats.tools_unchanged}")
    print(f"Total cheatsheets fetched: {stats.total_cheatsheets_fetched}")
    print(f"Cheatsheets new: {stats.cheatsheets_new}")
    print(f"Cheatsheets changed: {stats.cheatsheets_changed}")
    print(f"Cheatsheets unchanged: {stats.cheatsheets_unchanged}")
    print(f"Cheatsheets removed: {stats.cheatsheets_removed}")
    print("===========================")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
