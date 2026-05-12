"""Registration Insights — ETL.

Reads data/registration_records_master.csv and writes a fan-out of JSON
artifacts under docs/assets/data/ that the static dashboard consumes.
"""
from __future__ import annotations

import csv
import json
import re
from collections import Counter, defaultdict
from datetime import date, datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC_CSV = ROOT / "data" / "registration_records_master.csv"
OUT_DIR = ROOT / "docs" / "assets" / "data"
TRACK_DIR = OUT_DIR / "tracks"

TRACK_META = [
    {"key": "ha",         "name": "玻尿酸 / 透明质酸钠",   "tagline": "", "accent": "#D97757"},
    {"key": "collagen",   "name": "胶原蛋白",            "tagline": "", "accent": "#B5915A"},
    {"key": "plla",       "name": "童颜针 / PLLA",       "tagline": "", "accent": "#8B5A6B"},
    {"key": "pcl",        "name": "少女针 / PCL",        "tagline": "", "accent": "#C15F3C"},
    {"key": "pmma",       "name": "PMMA 注射填充剂",     "tagline": "", "accent": "#A56A7C"},
    {"key": "caha",       "name": "羟基磷酸钙 / CaHA",   "tagline": "", "accent": "#5B7B9A"},
    {"key": "botulinum",  "name": "肉毒毒素",           "tagline": "", "accent": "#8B9D7F"},
    {"key": "ebd",        "name": "EBD 设备类",          "tagline": "", "accent": "#6E6A65"},
]
TRACK_BY_KEY = {t["key"]: t for t in TRACK_META}

# How CSV `track` codes map onto the seven strategic tracks above.
EBD_TRACKS = {"raw_rf", "raw_ultrasound", "raw_microneedle", "laser_ipl",
              "body_contouring_device", "raw_thermage_rf"}
EMERGING_TRACKS = {"raw_agarose", "raw_ecm", "raw_lipolysis_injection"}
PMMA_TRACKS = {"raw_pmma"}


def load_rows() -> list[dict]:
    with SRC_CSV.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def classify_track(row: dict) -> str | None:
    """Return one of the 7 surfaced track keys, or None for emerging-only rows."""
    t = (row.get("track") or "").strip()
    if t in {"ha", "plla", "pcl", "caha", "collagen", "botulinum"}:
        return t
    if t in PMMA_TRACKS:
        return "pmma"
    if t in EBD_TRACKS:
        return "ebd"
    return None


def parse_year(value: str) -> int | None:
    if not value:
        return None
    m = re.match(r"(\d{4})", value)
    return int(m.group(1)) if m else None


def parse_date(value: str) -> date | None:
    if not value:
        return None
    for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d"):
        try:
            return datetime.strptime(value.strip(), fmt).date()
        except ValueError:
            continue
    return None


def safe_strip(value: str | None) -> str:
    return (value or "").strip()


def ui_term(value: str | None) -> str:
    return safe_strip(value).replace("再生类", "胶原刺激剂").replace("再生材料", "胶原刺激剂")


def split_portfolio(value: str) -> list[str]:
    if not value:
        return []
    parts = re.split(r"[/、,，;;]", value)
    return [ui_term(p) for p in parts if p.strip()]


def split_indications(value: str) -> list[str]:
    if not value:
        return []
    parts = re.split(r"[/、,，;；]", value)
    return [p.strip() for p in parts if p.strip()]


def best_company_label(row: dict) -> str:
    """Prefer manufacturer_group label (cleaner), fall back to short, then registrant."""
    for k in ("manufacturer_group", "company_short", "registrant", "official_registrant"):
        v = safe_strip(row.get(k))
        if v:
            return v
    return "未公开"


def best_company_key(row: dict) -> str:
    for k in ("manufacturer_group_key", "company_short", "registrant"):
        v = safe_strip(row.get(k))
        if v:
            return v.lower()
    return "unknown"


def build_record_card(row: dict) -> dict:
    """Light-weight payload used on cards/lists/drilldowns."""
    return {
        "id": safe_strip(row.get("﻿record_id") or row.get("record_id")),
        "track": safe_strip(row.get("track")),
        "track_name": safe_strip(row.get("track_name")),
        "strategic": ui_term(row.get("strategic_segment_name")),
        "product_name": safe_strip(row.get("product_name") or row.get("official_product_name")),
        "company": best_company_label(row),
        "company_key": best_company_key(row),
        "registrant": safe_strip(row.get("registrant")),
        "certificate_no": safe_strip(row.get("certificate_no")),
        "origin": safe_strip(row.get("origin")) or "未标注",
        "category": safe_strip(row.get("category")),
        "material_family": safe_strip(row.get("material_family")),
        "material_form": safe_strip(row.get("material_form")),
        "approval_date": safe_strip(row.get("approval_date")),
        "approval_year": parse_year(row.get("approval_year") or row.get("approval_date")),
        "valid_until": safe_strip(row.get("valid_until")),
        "primary_indication": safe_strip(row.get("primary_indication")),
        "indications": split_indications(row.get("approved_indications")),
        "tags": [ui_term(tag) for tag in split_indications(row.get("product_tags"))],
        "official_status": safe_strip(row.get("official_status")),
        "verified": safe_strip(row.get("official_status")) == "verified",
        "main_landscape": safe_strip(row.get("main_landscape_included")) == "是",
        "portfolio_segments": split_portfolio(row.get("portfolio_segments")),
        "source_account": safe_strip(row.get("source_account")),
        "source_title": safe_strip(row.get("source_title")),
        "source_url": safe_strip(row.get("source_url")),
        "confidence": safe_strip(row.get("confidence")),
    }


# ---------- analyses ----------

def kpi_block(records: list[dict]) -> dict:
    main = [r for r in records if r["main_landscape"]]
    verified = [r for r in main if r["verified"]]
    companies = {r["company_key"] for r in main}
    indications = {r["primary_indication"] for r in main if r["primary_indication"]}
    domestic = sum(1 for r in main if r["origin"] == "国产")
    imported = sum(1 for r in main if r["origin"] == "进口")
    hkmt = sum(1 for r in main if r["origin"] == "港澳台")

    # Material-focused breakdowns: industry watches injection assets first.
    # Injection filling = HA + collagen stimulators + collagen + agarose. Injection drug = botulinum + deoxycholic acid.
    injectable_tracks = {"ha", "plla", "pcl", "caha", "collagen", "raw_pmma", "raw_agarose"}
    drug_tracks = {"botulinum", "raw_lipolysis_injection"}
    ebd_tracks = {"raw_rf", "raw_ultrasound", "raw_microneedle", "laser_ipl",
                  "body_contouring_device", "raw_thermage_rf"}
    inj_class3 = [r for r in main if r["track"] in injectable_tracks]
    inj_drug = [r for r in main if r["track"] in drug_tracks]

    track_label = {
        "ha": "HA", "collagen": "胶原", "plla": "PLLA", "pcl": "PCL",
        "caha": "CaHA", "raw_pmma": "PMMA", "raw_agarose": "琼脂糖",
        "botulinum": "肉毒毒素", "raw_lipolysis_injection": "去氧胆酸",
    }

    def friendly_bucket(track_code: str) -> str:
        if track_code in track_label:
            return track_label[track_code]
        # all raw_* device codes + laser_ipl + body_contouring_device collapse to EBD
        return "EBD"

    inj_breakdown = []
    for tk in ("ha", "collagen", "plla", "pcl", "caha", "raw_pmma", "raw_agarose"):
        n = sum(1 for r in inj_class3 if r["track"] == tk)
        if n:
            inj_breakdown.append(f"{track_label[tk]}{n}")
    drug_breakdown = []
    for tk in ("botulinum", "raw_lipolysis_injection"):
        n = sum(1 for r in inj_drug if r["track"] == tk)
        if n:
            drug_breakdown.append(f"{track_label[tk]}{n}")

    # Indication breakdown by category bucket (counts may overlap)
    inj_indications = {r["primary_indication"] for r in main
                       if r["track"] in injectable_tracks and r["primary_indication"]}
    drug_indications = {r["primary_indication"] for r in main
                        if r["track"] in drug_tracks and r["primary_indication"]}
    ebd_indications = {r["primary_indication"] for r in main
                       if r["track"] in ebd_tracks and r["primary_indication"]}

    # Last 12 months by approval_date
    today = date.today()
    cutoff = date(today.year - 1, today.month, today.day) if not (today.month == 2 and today.day == 29) else date(today.year - 1, 2, 28)
    recent = []
    for r in main:
        d = parse_date(r.get("approval_date") or "")
        if d and d >= cutoff:
            recent.append(r)
    recent_bucket_counter = Counter(friendly_bucket(r["track"]) for r in recent)
    recent_breakdown = [f"{name}{n}" for name, n in recent_bucket_counter.most_common(4)]

    return {
        "total_records": len(records),
        "main_records": len(main),
        "excluded": len(records) - len(main),
        "companies": len(companies),
        "indications": len(indications),
        "verified_share": round(len(verified) / max(len(main), 1) * 100, 1),
        "domestic": domestic,
        "imported": imported,
        "hkmt": hkmt,

        # Material-focused KPIs
        "injectable_class3": len(inj_class3),
        "injectable_class3_breakdown": " / ".join(inj_breakdown),
        "injectable_drug": len(inj_drug),
        "injectable_drug_breakdown": " / ".join(drug_breakdown),
        "indication_breakdown": (
            f"注射填充类 {len(inj_indications)} 类 · "
            f"注射用药品 {len(drug_indications)} 类 · "
            f"EBD {len(ebd_indications)} 类"
        ),
        "recent_12mo": len(recent),
        # Percentage against the entire dataset, not the filtered subset.
        "recent_12mo_share": round(len(recent) / max(len(records), 1) * 100, 1),
        "recent_12mo_breakdown": " / ".join(recent_breakdown),
    }


def segment_summary(records: list[dict]) -> list[dict]:
    """Per-track summary cards on the homepage."""
    by_track = defaultdict(list)
    for r in records:
        key = classify_track(r["_raw"])
        if key:
            by_track[key].append(r)
    out = []
    for meta in TRACK_META:
        recs = by_track.get(meta["key"], [])
        main = [r for r in recs if r["main_landscape"]]
        companies = {r["company_key"] for r in main}
        out.append({
            **meta,
            "records": len(recs),
            "main_records": len(main),
            "companies": len(companies),
            "verified": sum(1 for r in main if r["verified"]),
            "latest_year": max((r["approval_year"] for r in recs if r["approval_year"]), default=None),
            "leading_company": Counter([r["company"] for r in main]).most_common(1)[0][0] if main else "—",
        })
    return out


def portfolio_matrix(records: list[dict]) -> dict:
    """Manufacturer group × strategic segment.

    For each company group with >=2 cert records overall, produce a row
    with cert counts per strategic segment. Used to surface full-stack vs
    single-point players.
    """
    main = [r for r in records if r["main_landscape"]]
    segments = sorted({r["strategic"] for r in main if r["strategic"]})
    matrix: dict[str, Counter] = defaultdict(Counter)
    name_lookup: dict[str, str] = {}
    for r in main:
        if not r["strategic"]:
            continue
        key = r["company_key"]
        matrix[key][r["strategic"]] += 1
        name_lookup.setdefault(key, r["company"])
    rows = []
    for key, counts in matrix.items():
        total = sum(counts.values())
        if total < 2 and len(counts) < 2:
            continue
        rows.append({
            "company_key": key,
            "company": name_lookup[key],
            "total": total,
            "segments_covered": len(counts),
            "by_segment": {s: counts.get(s, 0) for s in segments},
        })
    rows.sort(key=lambda r: (-r["segments_covered"], -r["total"]))
    return {"segments": segments, "rows": rows[:24]}


def indication_heatmap(records: list[dict]) -> dict:
    """Material family × primary indication, restricted to injectable tracks."""
    main = [r for r in records
            if r["main_landscape"] and r["track"] in {"ha", "plla", "pcl", "caha", "collagen", "raw_pmma", "botulinum"}
            and r["material_family"] and r["primary_indication"]]
    materials_count = Counter(r["material_family"] for r in main)
    indications_count = Counter(r["primary_indication"] for r in main)
    materials = [m for m, _ in materials_count.most_common()]
    indications = [i for i, _ in indications_count.most_common(14)]
    matrix = [[0] * len(indications) for _ in materials]
    for r in main:
        if r["primary_indication"] not in indications:
            continue
        ix = indications.index(r["primary_indication"])
        iy = materials.index(r["material_family"])
        matrix[iy][ix] += 1
    cells = []
    for iy, mat in enumerate(materials):
        for ix, ind in enumerate(indications):
            v = matrix[iy][ix]
            if v:
                cells.append([ix, iy, v])
    return {"materials": materials, "indications": indications, "cells": cells}


def cert_expiry(records: list[dict]) -> dict:
    """Cert renewal pressure: certs expiring in next 36 months by quarter."""
    today = date.today()
    horizon_quarters = []
    cur = date(today.year, today.month, 1)
    for _ in range(13):
        q = (cur.month - 1) // 3
        label = f"{cur.year}Q{q + 1}"
        horizon_quarters.append(label)
        new_month = cur.month + 3
        new_year = cur.year + (new_month - 1) // 12
        cur = date(new_year, ((new_month - 1) % 12) + 1, 1)

    by_quarter_track: dict[str, Counter] = {q: Counter() for q in horizon_quarters}
    upcoming = []
    for r in records:
        if not r["main_landscape"]:
            continue
        d = parse_date(r["valid_until"])
        if not d:
            continue
        if d < today:
            continue
        q = (d.month - 1) // 3
        label = f"{d.year}Q{q + 1}"
        if label not in by_quarter_track:
            continue
        track = classify_track(r["_raw"]) or "other"
        by_quarter_track[label][track] += 1
        upcoming.append({**{k: v for k, v in r.items() if k != "_raw"}, "days_to_expiry": (d - today).days})
    upcoming.sort(key=lambda r: r["days_to_expiry"])
    series_keys = ["ha", "collagen", "plla", "pcl", "pmma", "caha", "botulinum", "ebd"]
    series = []
    for k in series_keys:
        series.append({
            "key": k,
            "name": TRACK_BY_KEY.get(k, {}).get("name", k),
            "data": [by_quarter_track[q][k] for q in horizon_quarters],
        })
    return {
        "quarters": horizon_quarters,
        "series": series,
        "upcoming_top": upcoming[:30],
    }


def origin_evolution(records: list[dict]) -> dict:
    """Domestic vs imported vs HK/MO/TW share by approval year."""
    main = [r for r in records if r["main_landscape"] and r["approval_year"]]
    years = sorted({r["approval_year"] for r in main})
    if not years:
        return {"years": [], "series": []}
    years = [y for y in years if y >= 2014]  # the long tail before 2014 is noise
    by_year: dict[int, Counter] = {y: Counter() for y in years}
    for r in main:
        if r["approval_year"] in by_year:
            by_year[r["approval_year"]][r["origin"]] += 1
    keys = ["国产", "进口", "港澳台", "未标注"]
    series = []
    for k in keys:
        series.append({"name": k, "data": [by_year[y].get(k, 0) for y in years]})
    return {"years": years, "series": series}


def concentration(records: list[dict]) -> dict:
    """Per-track HHI + CR4/CR8 by company group."""
    out = {}
    for tk in ["ha", "collagen", "plla", "pcl", "pmma", "caha", "botulinum", "ebd"]:
        recs = [r for r in records if r["main_landscape"] and classify_track(r["_raw"]) == tk]
        total = len(recs)
        if total == 0:
            continue
        counts = Counter(r["company"] for r in recs)
        sorted_counts = counts.most_common()
        shares = [c / total for _, c in sorted_counts]
        hhi = round(sum((s * 100) ** 2 for s in shares), 0)
        cr4 = round(sum(shares[:4]) * 100, 1)
        cr8 = round(sum(shares[:8]) * 100, 1)
        out[tk] = {
            "track_name": TRACK_BY_KEY[tk]["name"],
            "total_certs": total,
            "company_count": len(counts),
            "hhi": hhi,
            "cr4": cr4,
            "cr8": cr8,
            "top": [{"company": n, "certs": c, "share": round(c / total * 100, 1)}
                    for n, c in sorted_counts[:8]],
        }
    return out


# ---------- per-track payloads ----------

def per_track_payload(records: list[dict], tk: str) -> dict:
    recs = [r for r in records if classify_track(r["_raw"]) == tk]
    main = [r for r in recs if r["main_landscape"]]
    company_counter = Counter(r["company"] for r in main)
    indication_counter = Counter(r["primary_indication"] for r in main if r["primary_indication"])
    origin_counter = Counter(r["origin"] for r in main)
    material_counter = Counter(r["material_family"] for r in main if r["material_family"])
    year_counter = Counter(r["approval_year"] for r in main if r["approval_year"])
    years = sorted(year_counter)

    # Company × indication heatmap — use ALL records (not just main landscape)
    # so adjacent / boundary registrations are visible too. Then prune any
    # row/column that ends up empty after the top-N intersection.
    co_company_counter = Counter(r["company"] for r in recs)
    co_indication_counter = Counter(r["primary_indication"] for r in recs if r["primary_indication"])
    candidate_companies = [c for c, _ in co_company_counter.most_common(12)]
    candidate_indications = [i for i, _ in co_indication_counter.most_common(10)]

    raw_cells = {}
    for r in recs:
        if not r["primary_indication"] or r["primary_indication"] not in candidate_indications:
            continue
        if r["company"] not in candidate_companies:
            continue
        key = (r["company"], r["primary_indication"])
        raw_cells[key] = raw_cells.get(key, 0) + 1

    # keep only companies / indications that actually appear in the matrix.
    # Tie-break by name so the JSON output is stable across runs (otherwise
    # equal-count entries would shuffle and create spurious git diffs).
    used_companies = sorted(
        {c for (c, _) in raw_cells.keys()},
        key=lambda c: (-co_company_counter[c], c),
    )
    used_indications = sorted(
        {i for (_, i) in raw_cells.keys()},
        key=lambda i: (-co_indication_counter[i], i),
    )
    co_in_cells = []
    for (comp, ind), v in raw_cells.items():
        ix = used_indications.index(ind)
        iy = used_companies.index(comp)
        co_in_cells.append([ix, iy, v])

    return {
        "track_key": tk,
        "track_meta": TRACK_BY_KEY[tk],
        "kpi": {
            "total": len(recs),
            "main": len(main),
            "companies": len(company_counter),
            "indications": len(indication_counter),
            "verified": sum(1 for r in main if r["verified"]),
            "domestic": origin_counter.get("国产", 0),
            "imported": origin_counter.get("进口", 0),
            "hkmt": origin_counter.get("港澳台", 0),
        },
        "company_share": [{"name": n, "value": v} for n, v in company_counter.most_common(12)],
        "long_tail_company_count": max(0, len(company_counter) - 12),
        "indication_share": [{"name": n, "value": v} for n, v in indication_counter.most_common(12)],
        "origin_share": [{"name": n, "value": v} for n, v in origin_counter.items()],
        "material_share": [{"name": n, "value": v} for n, v in material_counter.most_common(12)],
        "timeline": {"years": years, "values": [year_counter[y] for y in years]},
        "company_indication_heatmap": {
            "companies": used_companies,
            "indications": used_indications,
            "cells": co_in_cells,
        },
        "records": [{k: v for k, v in r.items() if k != "_raw"} for r in recs],
    }


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    TRACK_DIR.mkdir(parents=True, exist_ok=True)

    raw_rows = load_rows()
    records: list[dict] = []
    for row in raw_rows:
        card = build_record_card(row)
        card["_raw"] = row
        records.append(card)

    # Anchor "generated_at" to the source CSV's mtime, not the current clock.
    # This keeps the JSON output byte-identical when the data hasn't changed,
    # so git push noise vanishes when there's nothing real to publish.
    csv_mtime = datetime.fromtimestamp(SRC_CSV.stat().st_mtime)

    overview = {
        "generated_at": csv_mtime.isoformat(timespec="seconds"),
        "kpi": kpi_block(records),
        "segments": segment_summary(records),
        "portfolio_matrix": portfolio_matrix(records),
        "indication_heatmap": indication_heatmap(records),
        "cert_expiry": cert_expiry(records),
        "origin_evolution": origin_evolution(records),
        "concentration": concentration(records),
    }
    (OUT_DIR / "overview.json").write_text(
        json.dumps(overview, ensure_ascii=False, indent=2), encoding="utf-8")

    manifest = {
        "generated_at": csv_mtime.isoformat(timespec="seconds"),
        "tracks": [
            {**meta,
             "url": f"tracks/{meta['key']}.html",
             "data_url": f"assets/data/tracks/{meta['key']}.json"}
            for meta in TRACK_META
        ],
    }
    (OUT_DIR / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    for meta in TRACK_META:
        payload = per_track_payload(records, meta["key"])
        (TRACK_DIR / f"{meta['key']}.json").write_text(
            json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")

    print(f"wrote overview ({len(records)} records, {overview['kpi']['main_records']} in main)")
    for meta in TRACK_META:
        path = TRACK_DIR / f"{meta['key']}.json"
        print(f"  - {meta['key']}: {path.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
