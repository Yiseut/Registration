from __future__ import annotations

import argparse
import csv
import json
import os
import re
import sys
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta
from pathlib import Path


if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
if hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / "config" / "intelligence_monitor.json"
DEFAULT_MASTER = ROOT / "data" / "registration_records_master.csv"
DEFAULT_OUT_DIR = ROOT / "output" / "intelligence_monitor"

CERT_RE = re.compile(r"(?:国械注\s*(?:准|进|许)|国械备进)\s*\d{11,}")
URL_RE = re.compile(r"https?://[^\s\]\)\"'<>]+")
NMPA_ROW_START_RE = re.compile(r"(?:^|\s)(\d{1,4})\s+([A-Z]{2,5}\d{7,})\s+")


def clean(value: object) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def normalize_cert(value: str) -> str:
    return re.sub(r"\s+", "", value or "")


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def read_master_certs(path: Path) -> set[str]:
    certs: set[str] = set()
    if not path.exists():
        return certs
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            cert = normalize_cert(row.get("certificate_no", ""))
            if cert:
                certs.add(cert)
    return certs


def request_text(url: str, *, timeout: int = 45, api_key: str = "") -> tuple[str, str]:
    headers = {
        "User-Agent": "registration-intelligence-monitor/1.0",
        "Accept": "text/plain, text/markdown, text/html;q=0.8, */*;q=0.5",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
        headers["x-api-key"] = api_key
    request = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(request, timeout=timeout) as response:
            raw = response.read()
            charset = response.headers.get_content_charset() or "utf-8"
            return raw.decode(charset, errors="replace"), ""
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read().decode("utf-8", errors="replace")
        except Exception:
            body = ""
        return "", f"HTTP {exc.code} for {url}: {body[:300]}"
    except Exception as exc:
        return "", f"{type(exc).__name__} for {url}: {exc}"


def reader_url(url: str) -> str:
    return f"https://r.jina.ai/{url}"


def search_url(query: str) -> str:
    return "https://s.jina.ai/" + urllib.parse.quote(query, safe="")


def sogou_weixin_url(query: str) -> str:
    return "https://weixin.sogou.com/weixin?" + urllib.parse.urlencode({"type": "2", "query": query})


def build_dates(days: int) -> list[datetime]:
    today = datetime.now()
    return [today - timedelta(days=offset) for offset in range(max(days, 1))]


def build_search_inputs(config: dict, days: int) -> list[dict[str, str]]:
    rows: list[dict[str, str]] = []
    official = config.get("official_sources", {})
    for query in official.get("search_queries", []):
        rows.append(
            {
                "source_type": "nmpa_search",
                "priority": "1",
                "account": "",
                "date": "",
                "query": query,
                "jina_search_url": search_url(query),
                "sogou_weixin_url": "",
                "notes": official.get("source_policy", ""),
            }
        )
    for day in build_dates(days):
        date_cn = f"{day.year}年{day.month:02d}月{day.day:02d}日"
        query = f'site:nmpa.gov.cn/zwfw/sdxx/sdxxylqx/qxpjfb "{date_cn}医疗器械批准证明文件送达信息"'
        rows.append(
            {
                "source_type": "nmpa_daily_search",
                "priority": "1",
                "account": "",
                "date": day.strftime("%Y-%m-%d"),
                "query": query,
                "jina_search_url": search_url(query),
                "sogou_weixin_url": "",
                "notes": "逐日发现 NMPA 送达页 URL，用于补齐新增注册证号。",
            }
        )

    wechat = config.get("wechat_sources", {})
    accounts = [(name, "1") for name in wechat.get("accounts", [])]
    accounts.extend((name, "2") for name in wechat.get("secondary_accounts", []))
    for account, priority in accounts:
        for phrase in wechat.get("primary_phrases", []):
            query = f'site:mp.weixin.qq.com "{account}" "{phrase}" 医美'
            rows.append(
                {
                    "source_type": "wechat_account_search",
                    "priority": priority,
                    "account": account,
                    "date": "",
                    "query": query,
                    "jina_search_url": search_url(query),
                    "sogou_weixin_url": sogou_weixin_url(f"{account} {phrase} 医美"),
                    "notes": wechat.get("query_policy", ""),
                }
            )
    return rows


def extract_urls(text: str) -> list[str]:
    urls: list[str] = []
    seen: set[str] = set()
    for match in URL_RE.finditer(text or ""):
        url = match.group(0).rstrip(".,;，。；")
        if url not in seen:
            seen.add(url)
            urls.append(url)
    return urls


def discover_nmpa_urls(config: dict, days: int, run_web_search: bool, api_key: str) -> tuple[list[str], list[str]]:
    urls: list[str] = []
    errors: list[str] = []
    official = config.get("official_sources", {})
    for url in official.get("seed_urls", []):
        if url:
            urls.append(url)

    if not run_web_search:
        return sorted(set(urls)), errors
    if not api_key:
        errors.append("JINA_API_KEY not set; NMPA URL search skipped, search_inputs.csv still records the required queries.")
        return sorted(set(urls)), errors

    search_rows = [row for row in build_search_inputs(config, days) if row["source_type"].startswith("nmpa")]
    for row in search_rows:
        text, error = request_text(row["jina_search_url"], api_key=api_key)
        if error:
            errors.append(error)
            continue
        for url in extract_urls(text):
            if "nmpa.gov.cn/zwfw/sdxx/sdxxylqx/qxpjfb/" not in url:
                continue
            if not url.endswith(".html") and ".html?" not in url:
                continue
            urls.append(url)
    return sorted(set(urls)), errors


def fetch_page_text(url: str) -> tuple[str, str, str]:
    text, error = request_text(url, timeout=35)
    if text and "Precondition Failed" not in text and "网站地址已变更" not in text:
        return text, url, ""
    fallback, fallback_error = request_text(reader_url(url), timeout=80)
    if fallback:
        return fallback, reader_url(url), ""
    return "", reader_url(url), fallback_error or error


def context_around(text: str, start: int, end: int, radius: int = 420) -> str:
    return clean(text[max(0, start - radius) : min(len(text), end + radius)])


def nmpa_row_segments(text: str) -> list[str]:
    compact = clean(text.replace("\n", " "))
    matches = list(NMPA_ROW_START_RE.finditer(compact))
    if len(matches) < 3:
        return []
    segments: list[str] = []
    for index, match in enumerate(matches):
        start = match.start(1)
        end = matches[index + 1].start(1) if index + 1 < len(matches) else len(compact)
        segment = compact[start:end].strip()
        if CERT_RE.search(segment):
            segments.append(segment)
    return segments


def infer_product_from_context(context: str, cert: str) -> str:
    before = re.split(r"国械注\s*(?:准|进|许)|国械备进", context)[0]
    before = re.sub(r"^\d{1,4}\s+[A-Z]{2,5}\d{7,}\s+", "", before)
    before = re.sub(r"\s+", " ", before).strip(" -:：,，/")
    parts = re.split(r"\s{2,}|/", before)
    parts = [clean(part).strip(" -:：,，") for part in parts if clean(part)]
    if not parts:
        return ""
    return parts[-1][-80:]


def is_excluded_context(context: str, exclusions: list[str]) -> bool:
    lowered = context.lower()
    for keyword in exclusions:
        if keyword.lower() in lowered:
            return True
    return False


def is_attention_context(context: str, keywords: list[str], exclusions: list[str]) -> bool:
    if is_excluded_context(context, exclusions):
        return False
    lowered = context.lower()
    for keyword in keywords:
        if keyword.lower() in lowered:
            return True
    return False


def parse_nmpa_page(
    url: str,
    text: str,
    keywords: list[str],
    exclusions: list[str],
    known_certs: set[str],
) -> list[dict[str, str]]:
    title = ""
    title_match = re.search(r"Title:\s*(.+)", text)
    if title_match:
        title = clean(title_match.group(1))
    records: list[dict[str, str]] = []
    segments = nmpa_row_segments(text)
    if segments:
        for segment in segments:
            for match in CERT_RE.finditer(segment):
                cert = normalize_cert(match.group(0))
                records.append(
                    {
                        "certificate_no": cert,
                        "known_in_master": "yes" if cert in known_certs else "no",
                        "attention_match": "yes" if is_attention_context(segment, keywords, exclusions) else "no",
                        "source_url": url,
                        "source_title": title,
                        "product_hint": infer_product_from_context(segment, cert),
                        "evidence_context": segment[:900],
                    }
                )
        return records

    for match in CERT_RE.finditer(text):
        cert = normalize_cert(match.group(0))
        context = context_around(text, match.start(), match.end(), radius=160)
        records.append(
            {
                "certificate_no": cert,
                "known_in_master": "yes" if cert in known_certs else "no",
                "attention_match": "yes" if is_attention_context(context, keywords, exclusions) else "no",
                "source_url": url,
                "source_title": title,
                "product_hint": infer_product_from_context(context, cert),
                "evidence_context": context[:900],
            }
        )
    return records


def discover_wechat_results(config: dict, run_web_search: bool, api_key: str, limit: int = 80) -> tuple[list[dict[str, str]], list[str]]:
    results: list[dict[str, str]] = []
    errors: list[str] = []
    if not run_web_search:
        return results, errors
    if not api_key:
        errors.append("JINA_API_KEY not set; WeChat web search skipped, search_inputs.csv still records account-level queries.")
        return results, errors
    search_rows = [row for row in build_search_inputs(config, 1) if row["source_type"] == "wechat_account_search"]
    for row in search_rows[:limit]:
        text, error = request_text(row["jina_search_url"], api_key=api_key)
        if error:
            errors.append(error)
            continue
        for url in extract_urls(text):
            if "mp.weixin.qq.com" not in url:
                continue
            certs = sorted({normalize_cert(match.group(0)) for match in CERT_RE.finditer(text)})
            results.append(
                {
                    "account": row["account"],
                    "query": row["query"],
                    "url": url,
                    "certificates_in_search_result": "; ".join(certs),
                    "needs_official_check": "yes",
                }
            )
    return results, errors


def write_csv(path: Path, rows: list[dict[str, str]], fields: list[str] | None = None) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if fields is None:
        fields = list(rows[0].keys()) if rows else []
    with path.open("w", encoding="utf-8-sig", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, extrasaction="ignore")
        if fields:
            writer.writeheader()
            writer.writerows(rows)


def write_markdown(path: Path, summary: dict, missing_attention: list[dict[str, str]]) -> None:
    lines = [
        "# Intelligence Monitor",
        "",
        f"- Generated at: {summary['generated_at']}",
        f"- Master CSV: `{summary['master_csv']}`",
        f"- NMPA pages checked: {summary['nmpa_pages_checked']}",
        f"- Official records parsed: {summary['official_record_count']}",
        f"- Missing official certificates: {summary['missing_official_count']}",
        f"- Missing attention candidates: {summary['missing_attention_count']}",
        f"- WeChat search results: {summary['wechat_search_result_count']}",
        "",
        "## Missing Attention Candidates",
        "",
    ]
    if not missing_attention:
        lines.append("- None")
    else:
        for item in missing_attention[:40]:
            lines.append(
                f"- {item['certificate_no']}: {item.get('product_hint') or '产品名待判定'} | {item.get('source_title') or 'NMPA送达页'} | {item['source_url']}"
            )
            if item.get("evidence_context"):
                lines.append(f"  - Evidence: {item['evidence_context'][:240]}")
    if summary.get("source_errors"):
        lines.extend(["", "## Source Notes", ""])
        for error in summary["source_errors"][:20]:
            lines.append(f"- {error}")
    lines.extend(
        [
            "",
            "## Search Inputs",
            "",
            f"- CSV: `{summary['search_inputs_csv']}`",
            "- Policy: NMPA official pages are the primary source. WeChat account searches only create leads and must be officially verified before dashboard inclusion.",
        ]
    )
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def emit_github_outputs(summary: dict) -> None:
    output = os.environ.get("GITHUB_OUTPUT")
    if not output:
        return
    with open(output, "a", encoding="utf-8") as handle:
        handle.write(f"missing_attention_count={summary['missing_attention_count']}\n")
        handle.write(f"missing_official_count={summary['missing_official_count']}\n")
        handle.write(f"wechat_search_result_count={summary['wechat_search_result_count']}\n")
        handle.write(f"summary_markdown={summary['summary_markdown']}\n")


def main() -> int:
    parser = argparse.ArgumentParser(description="Discover external registration leads before they are missed by the dashboard.")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--master-csv", type=Path, default=DEFAULT_MASTER)
    parser.add_argument("--out-dir", type=Path, default=DEFAULT_OUT_DIR)
    parser.add_argument("--days", type=int, default=14, help="Lookback window for generated NMPA search inputs.")
    parser.add_argument("--run-web-search", action="store_true", help="Use Jina search when JINA_API_KEY is available.")
    parser.add_argument("--seed-url", action="append", default=[], help="Extra NMPA delivery URL to parse this run.")
    args = parser.parse_args()

    config = read_json(args.config)
    known_certs = read_master_certs(args.master_csv)
    api_key = os.environ.get("JINA_API_KEY", "").strip()
    out_dir = args.out_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    search_inputs = build_search_inputs(config, args.days)
    search_inputs_csv = out_dir / f"search_inputs_{stamp}.csv"
    write_csv(search_inputs_csv, search_inputs)
    latest_search_inputs = out_dir / "search_inputs_latest.csv"
    write_csv(latest_search_inputs, search_inputs)

    nmpa_urls, nmpa_errors = discover_nmpa_urls(config, args.days, args.run_web_search, api_key)
    nmpa_urls.extend(args.seed_url)
    nmpa_urls = sorted(set(url for url in nmpa_urls if url))

    official_records: list[dict[str, str]] = []
    source_errors: list[str] = list(nmpa_errors)
    for url in nmpa_urls:
        text, fetched_url, error = fetch_page_text(url)
        if error:
            source_errors.append(error)
            continue
        official_records.extend(
            parse_nmpa_page(
                url,
                text,
                config.get("attention_keywords", []),
                config.get("attention_exclusion_keywords", []),
                known_certs,
            )
        )

    missing_official = [row for row in official_records if row["known_in_master"] == "no"]
    missing_attention = [row for row in missing_official if row["attention_match"] == "yes"]

    wechat_results, wechat_errors = discover_wechat_results(config, args.run_web_search, api_key)
    source_errors.extend(wechat_errors)

    official_csv = out_dir / f"official_candidates_{stamp}.csv"
    missing_csv = out_dir / f"missing_attention_candidates_{stamp}.csv"
    wechat_csv = out_dir / f"wechat_search_results_{stamp}.csv"
    write_csv(official_csv, official_records)
    write_csv(missing_csv, missing_attention, fields=list(official_records[0].keys()) if official_records else [])
    write_csv(wechat_csv, wechat_results)
    write_csv(out_dir / "official_candidates_latest.csv", official_records)
    write_csv(
        out_dir / "missing_attention_candidates_latest.csv",
        missing_attention,
        fields=list(official_records[0].keys()) if official_records else [],
    )
    write_csv(out_dir / "wechat_search_results_latest.csv", wechat_results)

    summary = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "config": str(args.config),
        "master_csv": str(args.master_csv),
        "known_certificate_count": len(known_certs),
        "run_web_search": args.run_web_search,
        "jina_search_enabled": bool(api_key and args.run_web_search),
        "nmpa_pages_checked": len(nmpa_urls),
        "official_record_count": len(official_records),
        "missing_official_count": len(missing_official),
        "missing_attention_count": len(missing_attention),
        "wechat_search_result_count": len(wechat_results),
        "search_inputs_csv": str(search_inputs_csv),
        "official_candidates_csv": str(official_csv),
        "missing_attention_candidates_csv": str(missing_csv),
        "wechat_search_results_csv": str(wechat_csv),
        "source_errors": source_errors,
        "summary_json": str(out_dir / f"intelligence_monitor_{stamp}.json"),
        "summary_markdown": str(out_dir / f"intelligence_monitor_{stamp}.md"),
    }

    summary_json = Path(summary["summary_json"])
    summary_md = Path(summary["summary_markdown"])
    summary_json.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    write_markdown(summary_md, summary, missing_attention)
    (out_dir / "intelligence_monitor_latest.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    write_markdown(out_dir / "intelligence_monitor_latest.md", summary, missing_attention)
    emit_github_outputs(summary)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
