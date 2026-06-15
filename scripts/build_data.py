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
    {"key": "ha",         "name": "透明质酸钠",           "tagline": "", "accent": "#58bfd7"},
    {"key": "botulinum",  "name": "肉毒毒素",            "tagline": "", "accent": "#737ed0"},
    {"key": "collagen",   "name": "胶原蛋白",            "tagline": "", "accent": "#dd7b8b"},
    {"key": "plla",       "name": "PLA",                "tagline": "", "accent": "#9daaf0"},
    {"key": "pcl",        "name": "PCL",                 "tagline": "", "accent": "#e5b574"},
    {"key": "caha",       "name": "CaHA",                "tagline": "", "accent": "#b486d4"},
    {"key": "niche_materials", "name": "小众材料",       "tagline": "", "accent": "#cf6a9d"},
    {"key": "ebd",        "name": "EBD 设备",             "tagline": "", "accent": "#8fa8c8"},
]
TRACK_BY_KEY = {t["key"]: t for t in TRACK_META}

SUBMENTAL_LIPOLYSIS_INDICATION = "颏下脂肪堆积（双下巴）"
JAW_CHIN_CONTOUR_FILLING_INDICATION = "下颌及颏部轮廓改善（填充）"
JAW_CHIN_EXACT_INDICATION_LABELS = {
    "下颌部",
    "下颌",
    "下颏",
    "颏部",
    "下颏/下颌部",
    "下颌/下颏",
    "面部软组织/轮廓",
    "下颌及颏部轮廓改善（填充）",
}

CITY_COORDS = {
    "北京": {"province": "北京", "lat": 39.9042, "lng": 116.4074},
    "上海": {"province": "上海", "lat": 31.2304, "lng": 121.4737},
    "天津": {"province": "天津", "lat": 39.3434, "lng": 117.3616},
    "重庆": {"province": "重庆", "lat": 29.5630, "lng": 106.5516},
    "杭州": {"province": "浙江", "lat": 30.2741, "lng": 120.1551},
    "宁波": {"province": "浙江", "lat": 29.8683, "lng": 121.5440},
    "绍兴": {"province": "浙江", "lat": 30.0303, "lng": 120.5802},
    "南京": {"province": "江苏", "lat": 32.0603, "lng": 118.7969},
    "苏州": {"province": "江苏", "lat": 31.2989, "lng": 120.5853},
    "常州": {"province": "江苏", "lat": 31.8107, "lng": 119.9741},
    "无锡": {"province": "江苏", "lat": 31.4912, "lng": 120.3119},
    "深圳": {"province": "广东", "lat": 22.5431, "lng": 114.0579},
    "广州": {"province": "广东", "lat": 23.1291, "lng": 113.2644},
    "珠海": {"province": "广东", "lat": 22.2707, "lng": 113.5767},
    "香港": {"province": "香港", "lat": 22.3193, "lng": 114.1694},
    "澳门": {"province": "澳门", "lat": 22.1987, "lng": 113.5439},
    "台北": {"province": "台湾", "lat": 25.0330, "lng": 121.5654},
    "新北": {"province": "台湾", "lat": 25.0169, "lng": 121.4628},
    "桃园": {"province": "台湾", "lat": 24.9937, "lng": 121.3009},
    "台中": {"province": "台湾", "lat": 24.1477, "lng": 120.6736},
    "台南": {"province": "台湾", "lat": 22.9999, "lng": 120.2270},
    "高雄": {"province": "台湾", "lat": 22.6273, "lng": 120.3014},
    "成都": {"province": "四川", "lat": 30.5728, "lng": 104.0668},
    "武汉": {"province": "湖北", "lat": 30.5928, "lng": 114.3055},
    "济南": {"province": "山东", "lat": 36.6512, "lng": 117.1201},
    "青岛": {"province": "山东", "lat": 36.0671, "lng": 120.3826},
    "济宁": {"province": "山东", "lat": 35.4149, "lng": 116.5872},
    "长春": {"province": "吉林", "lat": 43.8171, "lng": 125.3235},
    "大连": {"province": "辽宁", "lat": 38.9140, "lng": 121.6147},
    "沈阳": {"province": "辽宁", "lat": 41.8057, "lng": 123.4315},
    "兰州": {"province": "甘肃", "lat": 36.0611, "lng": 103.8343},
    "西安": {"province": "陕西", "lat": 34.3416, "lng": 108.9398},
    "太原": {"province": "山西", "lat": 37.8706, "lng": 112.5489},
    "海口": {"province": "海南", "lat": 20.0440, "lng": 110.1999},
    "长沙": {"province": "湖南", "lat": 28.2282, "lng": 112.9388},
    "合肥": {"province": "安徽", "lat": 31.8206, "lng": 117.2272},
    "福州": {"province": "福建", "lat": 26.0745, "lng": 119.2965},
    "南昌": {"province": "江西", "lat": 28.6820, "lng": 115.8579},
    "郑州": {"province": "河南", "lat": 34.7466, "lng": 113.6254},
    "石家庄": {"province": "河北", "lat": 38.0428, "lng": 114.5149},
    "南宁": {"province": "广西", "lat": 22.8170, "lng": 108.3669},
    "银川": {"province": "宁夏", "lat": 38.4872, "lng": 106.2309},
}

CITY_NAME_ORDER = sorted(CITY_COORDS, key=len, reverse=True)

REGISTRANT_LOCATION_OVERRIDES = [
    (r"华熙生物", "济南"),
    (r"爱美客", "北京"),
    (r"山东凯乐普", "济宁"),
    (r"山东采采|谷雨春", "济南"),
    (r"崇山生物|珂瑞康|浙江景嘉|浙江微度", "杭州"),
    (r"西宏生物|江苏天莱雅|江苏创健|创健医疗", "常州"),
    (r"巨子生物|佰傲再生", "西安"),
    (r"锦波生物", "太原"),
    (r"渼颜空间|漠颐空间", "长春"),
    (r"希睿达", "海口"),
    (r"圣博玛", "长春"),
    (r"乐普医疗|乐普（北京）|乐普\\(北京\\)", "北京"),
    (r"热芙美", "长沙"),
    (r"广东花至|广东雅思", "广州"),
    (r"普罗米修斯奇迹", "深圳"),
    (r"南京迈诺威|南京麦澜德|麦澜德", "南京"),
    (r"双美生物|雙美生物", "台南"),
    (r"和康生物", "桃园"),
    (r"科妍生物", "高雄"),
]

PROVINCE_FALLBACK_CITY = {
    "山东": "济南",
    "浙江": "杭州",
    "江苏": "南京",
    "广东": "广州",
    "四川": "成都",
    "陕西": "西安",
    "山西": "太原",
    "吉林": "长春",
    "海南": "海口",
    "湖南": "长沙",
    "湖北": "武汉",
    "辽宁": "沈阳",
    "甘肃": "兰州",
    "安徽": "合肥",
    "福建": "福州",
    "江西": "南昌",
    "河南": "郑州",
    "河北": "石家庄",
    "广西": "南宁",
    "宁夏": "银川",
    "台湾": "台北",
    "臺灣": "台北",
    "香港": "香港",
    "澳门": "澳门",
    "澳門": "澳门",
}

FOREIGN_REGISTRANT_RE = re.compile(
    r"Allergan|Ipsen|Hugel|Merz|Galderma|Sinclair|Revance|Huons|WON TECH|韩国|Ireland|GmbH|Limited|Inc\.|Corporation|株式会社|원텍",
    re.I,
)

# How CSV `track` codes map onto the surfaced strategic tracks above.
EBD_TRACKS = {"raw_rf", "raw_ultrasound", "raw_microneedle", "laser_ipl",
              "body_contouring_device", "raw_thermage_rf"}
NICHE_MATERIAL_TRACKS = {
    "raw_pmma",
    "raw_agarose",
    "raw_ecm",
    "raw_lipolysis_injection",
    "raw_silk",
    "silk_protein",
}


def load_rows() -> list[dict]:
    with SRC_CSV.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def classify_track(row: dict) -> str | None:
    """Return one of the surfaced track keys, or None for background-only rows."""
    t = (row.get("track") or "").strip()
    if t in {"ha", "plla", "pcl", "caha", "collagen", "botulinum"}:
        return t
    if t in NICHE_MATERIAL_TRACKS:
        return "niche_materials"
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


def compact_text(value: str | None) -> str:
    return safe_strip(value).replace("(", "（").replace(")", "）").replace("／", "/").replace(" ", "")


def write_json(path: Path, payload: dict) -> None:
    with path.open("w", encoding="utf-8", newline="\r\n") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def ui_term(value: str | None) -> str:
    return (
        safe_strip(value)
        .replace("再生类", "胶原刺激剂")
        .replace("再生材料", "胶原刺激剂")
        .replace("HA/透明质酸钠", "透明质酸钠")
        .replace("玻尿酸 / 透明质酸钠", "透明质酸钠")
        .replace("玻尿酸/透明质酸钠", "透明质酸钠")
        .replace("童颜针 / PLLA", "PLA")
        .replace("少女针 / PCL", "PCL")
        .replace("羟基磷酸钙 / CaHA", "CaHA")
        .replace("肉毒素", "肉毒毒素")
        .replace("EBD 设备类", "EBD 设备")
    )


def split_portfolio(value: str) -> list[str]:
    if not value:
        return []
    parts = re.split(r"[/、,，;;]", value)
    return [ui_term(p) for p in parts if p.strip()]


def is_jaw_chin_contour_filling_text(text: str) -> bool:
    if not text:
        return False
    compact = compact_text(text)
    if "去氧胆酸" in compact or "溶脂" in compact or "脂肪堆积" in compact or "双下巴" in compact:
        return False
    if "皮肤松弛" in compact or "热效应" in compact:
        return False
    has_jaw_chin_area = any(term in compact for term in ("下颌", "下颏", "颏部"))
    has_filling_purpose = any(term in compact for term in ("填充", "后缩", "轮廓", "骨膜", "皮下组织"))
    return has_jaw_chin_area and has_filling_purpose


def is_jaw_chin_contour_filling_row(row: dict) -> bool:
    text = " ".join(
        safe_strip(row.get(key))
        for key in (
            "track",
            "track_name",
            "category",
            "material_family",
            "material_form",
            "product_name",
            "primary_indication",
            "approved_indications",
            "indication_description",
            "scope_full",
            "official_indication",
            "official_scope",
            "product_tags",
        )
    )
    return is_jaw_chin_contour_filling_text(text)


def is_jaw_chin_indication_label(value: str | None) -> bool:
    compact = compact_text(value)
    if compact in JAW_CHIN_EXACT_INDICATION_LABELS:
        return True
    if re.search(r"[/、,，;；]", safe_strip(value)):
        return False
    return is_jaw_chin_contour_filling_text(compact)


def split_indications(value: str, row: dict | None = None) -> list[str]:
    if not value:
        return []
    compact = compact_text(value)
    if (
        compact in {"颏下脂肪堆积/双下巴", "双下巴/颏下脂肪堆积", "颏下脂肪堆积（双下巴）"}
        or ("颏下脂肪堆积" in compact and "双下巴" in compact)
    ):
        return [SUBMENTAL_LIPOLYSIS_INDICATION]
    if is_jaw_chin_indication_label(value) and (row is None or is_jaw_chin_contour_filling_row(row)):
        return [JAW_CHIN_CONTOUR_FILLING_INDICATION]
    parts = re.split(r"[/、,，;；]", value)
    out = []
    for part in parts:
        text = safe_strip(part)
        if not text:
            continue
        if compact_text(text) in {"颏下脂肪堆积（双下巴）", "颏下脂肪堆积/双下巴", "双下巴/颏下脂肪堆积"}:
            out.append(SUBMENTAL_LIPOLYSIS_INDICATION)
        elif is_jaw_chin_indication_label(text) and (row is None or is_jaw_chin_contour_filling_row(row)):
            out.append(JAW_CHIN_CONTOUR_FILLING_INDICATION)
        else:
            out.append(text)
    return list(dict.fromkeys(out))


def is_submental_lipolysis_row(row: dict) -> bool:
    text = " ".join(
        safe_strip(row.get(key))
        for key in (
            "track",
            "track_name",
            "category",
            "material_family",
            "brand",
            "product_name",
            "certificate_no",
            "primary_indication",
            "approved_indications",
            "indication_description",
            "scope_full",
            "official_product_name",
            "official_indication",
            "official_scope",
            "product_tags",
        )
    )
    return (
        "raw_lipolysis_injection" in text
        or "去氧胆酸" in text
        or "溶脂" in text
        or "H20254519" in text
    ) and (
        "颏下脂肪" in text
        or "双下巴" in text
        or "H20254519" in text
    )


def canonical_primary_indication(row: dict) -> str:
    if is_submental_lipolysis_row(row):
        return SUBMENTAL_LIPOLYSIS_INDICATION
    value = safe_strip(row.get("primary_indication"))
    if is_jaw_chin_contour_filling_row(row) and is_jaw_chin_indication_label(value):
        return JAW_CHIN_CONTOUR_FILLING_INDICATION
    return safe_strip(row.get("primary_indication"))


def canonical_official_indication(row: dict) -> str:
    if is_submental_lipolysis_row(row):
        return SUBMENTAL_LIPOLYSIS_INDICATION
    if is_jaw_chin_contour_filling_row(row):
        values = split_indications(row.get("official_indication"), row)
        if values:
            return " / ".join(values)
    return safe_strip(row.get("official_indication"))


def record_indications(record: dict) -> list[str]:
    if is_submental_lipolysis_row(record.get("_raw") or record):
        return [SUBMENTAL_LIPOLYSIS_INDICATION]
    values = []
    values.extend(record.get("indications") or [])
    row = record.get("_raw") or record
    values.extend(split_indications(record.get("official_indication") or "", row))
    if record.get("primary_indication"):
        values.append(record["primary_indication"])
    return list(dict.fromkeys(v for v in values if v))


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
    primary_indication = canonical_primary_indication(row)
    official_indication = canonical_official_indication(row)
    return {
        "id": safe_strip(row.get("﻿record_id") or row.get("record_id")),
        "track": safe_strip(row.get("track")),
        "track_name": ui_term(row.get("track_name")),
        "strategic": ui_term(row.get("strategic_segment_name")),
        "brand": safe_strip(row.get("brand")),
        "aliases": safe_strip(row.get("aliases")),
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
        "primary_indication": primary_indication,
        "indications": split_indications(row.get("approved_indications"), row),
        "tags": [ui_term(tag) for tag in split_indications(row.get("product_tags"))],
        "official_status": safe_strip(row.get("official_status")),
        "official_verification_status": safe_strip(row.get("official_verification_status")),
        "official_source": safe_strip(row.get("official_source")),
        "official_product_name": safe_strip(row.get("official_product_name")),
        "official_registrant": safe_strip(row.get("official_registrant")),
        "official_approval_date": safe_strip(row.get("official_approval_date")),
        "official_valid_until": safe_strip(row.get("official_valid_until")),
        "official_indication": official_indication,
        "official_scope": safe_strip(row.get("official_scope")),
        "verified": safe_strip(row.get("official_status")) == "verified",
        "main_landscape": safe_strip(row.get("main_landscape_included")) == "是",
        "portfolio_segments": split_portfolio(row.get("portfolio_segments")),
        "source_account": safe_strip(row.get("source_account")),
        "source_title": ui_term(row.get("source_title")),
        "source_url": safe_strip(row.get("source_url")),
        "confidence": safe_strip(row.get("confidence")),
    }


# ---------- analyses ----------

def kpi_block(records: list[dict]) -> dict:
    main = [r for r in records if r["main_landscape"]]
    verified = [r for r in main if r["verified"]]
    companies = {r["company_key"] for r in main}
    indications = {item for r in main for item in record_indications(r)}
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
        "ha": "HA", "collagen": "胶原蛋白", "plla": "PLA", "pcl": "PCL",
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
    inj_indications = {item for r in main if r["track"] in injectable_tracks for item in record_indications(r)}
    drug_indications = {item for r in main if r["track"] in drug_tracks for item in record_indications(r)}
    ebd_indications = {item for r in main if r["track"] in ebd_tracks for item in record_indications(r)}

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
            if r["main_landscape"] and r["track"] in {"ha", "plla", "pcl", "caha", "collagen", "raw_pmma", "raw_agarose", "raw_lipolysis_injection", "botulinum"}
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
    series_keys = ["ha", "botulinum", "collagen", "plla", "pcl", "caha", "niche_materials", "ebd"]
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
    for tk in ["ha", "botulinum", "collagen", "plla", "pcl", "caha", "niche_materials", "ebd"]:
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


def china_map_candidate(record: dict) -> bool:
    """Records that represent a mainland Chinese registration subject."""
    cert = safe_strip(record.get("certificate_no"))
    registrant = safe_strip(record.get("registrant") or record.get("company"))
    if not record.get("main_landscape"):
        return False
    if cert.startswith("国械注进"):
        return False
    if FOREIGN_REGISTRANT_RE.search(registrant):
        return False
    if not re.search(r"[\u4e00-\u9fff]", registrant):
        return False
    return (
        record.get("origin") in {"国产", "港澳台"}
        or cert.startswith("国械注准")
        or cert.startswith("国械注许")
        or cert.startswith("国药准字")
        or re.match(r"^[\u4e00-\u9fa5]械注准", cert or "")
    )


def locate_china_record(record: dict) -> tuple[str | None, str]:
    """Infer registered city from public registration fields plus a small maintained map."""
    raw = record.get("_raw") or {}
    text = " ".join(
        safe_strip(record.get(k) or raw.get(k))
        for k in (
            "registrant",
            "company",
            "company_key",
            "brand",
            "product_name",
            "manufacturer_group",
            "company_short",
            "official_registrant",
        )
    )
    for city in CITY_NAME_ORDER:
        if city in text:
            return city, "注册人名称含城市"
    for pattern, city in REGISTRANT_LOCATION_OVERRIDES:
        if re.search(pattern, text):
            return city, "维护映射"
    for province, city in PROVINCE_FALLBACK_CITY.items():
        if province in text:
            return city, "省级名称推断"
    return None, "未识别"


def china_enterprise_map(records: list[dict], generated_at: str) -> dict:
    """City-level distribution of domestic medical-aesthetic registration subjects."""
    buckets = {}
    unmapped = []
    candidates = [record for record in records if china_map_candidate(record)]

    for record in candidates:
        city, location_source = locate_china_record(record)
        company = safe_strip(record.get("registrant") or record.get("company"))
        if not city or city not in CITY_COORDS:
            unmapped.append({
                "company": company,
                "certificate_no": record.get("certificate_no"),
                "track": record.get("strategic") or record.get("track_name"),
                "reason": location_source,
            })
            continue

        coord = CITY_COORDS[city]
        bucket = buckets.setdefault(city, {
            "city": city,
            "province": coord["province"],
            "lat": coord["lat"],
            "lng": coord["lng"],
            "companies": {},
            "records": [],
            "tracks": Counter(),
            "location_sources": Counter(),
        })
        company_key = safe_strip(record.get("registrant") or record.get("company_key") or company)
        company_row = bucket["companies"].setdefault(company_key, {
            "name": company,
            "records": 0,
            "tracks": Counter(),
        })
        company_row["records"] += 1
        company_row["tracks"][record.get("strategic") or record.get("track_name") or "未标注"] += 1
        bucket["records"].append({
            "certificate_no": record.get("certificate_no"),
            "brand": record.get("brand"),
            "product_name": record.get("product_name"),
            "company": company,
            "track": record.get("strategic") or record.get("track_name"),
            "approval_date": record.get("approval_date"),
        })
        bucket["tracks"][record.get("strategic") or record.get("track_name") or "未标注"] += 1
        bucket["location_sources"][location_source] += 1

    cities = []
    for city, bucket in buckets.items():
        company_rows = sorted(
            (
                {
                    "name": value["name"],
                    "records": value["records"],
                    "top_track": value["tracks"].most_common(1)[0][0] if value["tracks"] else "未标注",
                }
                for value in bucket["companies"].values()
            ),
            key=lambda item: (-item["records"], item["name"]),
        )
        tracks = [{"name": name, "records": count} for name, count in bucket["tracks"].most_common()]
        cities.append({
            "city": city,
            "province": bucket["province"],
            "lat": bucket["lat"],
            "lng": bucket["lng"],
            "companies": len(bucket["companies"]),
            "registrations": len(bucket["records"]),
            "tracks": tracks,
            "leading_track": tracks[0]["name"] if tracks else "未标注",
            "companies_sample": company_rows[:8],
            "records_sample": bucket["records"][:12],
            "location_sources": dict(bucket["location_sources"]),
        })
    cities.sort(key=lambda item: (-item["companies"], -item["registrations"], item["city"]))

    return {
        "generated_at": generated_at,
        "scope": "中国及港澳台注册主体，按注册人名称和维护表推断城市；进口注册人不纳入中国企业分布。",
        "metrics": {
            "candidate_records": len(candidates),
            "mapped_records": sum(item["registrations"] for item in cities),
            "mapped_companies": sum(item["companies"] for item in cities),
            "mapped_cities": len(cities),
            "unmapped_companies": len({item["company"] for item in unmapped if item.get("company")}),
        },
        "cities": cities,
        "unmapped": unmapped,
    }


# ---------- per-track payloads ----------

def per_track_payload(records: list[dict], tk: str) -> dict:
    recs = [r for r in records if classify_track(r["_raw"]) == tk]
    main = [r for r in recs if r["main_landscape"]]
    company_counter = Counter(r["company"] for r in main)
    indication_counter = Counter(item for r in main for item in record_indications(r))
    origin_counter = Counter(r["origin"] for r in main)
    material_counter = Counter(r["material_family"] for r in main if r["material_family"])
    year_counter = Counter(r["approval_year"] for r in main if r["approval_year"])
    years = sorted(year_counter)

    # Company × indication heatmap — use ALL records (not just main landscape)
    # so adjacent / boundary registrations are visible too. Then prune any
    # row/column that ends up empty after the top-N intersection.
    co_company_counter = Counter(r["company"] for r in recs)
    co_indication_counter = Counter(item for r in recs for item in record_indications(r))
    candidate_companies = [c for c, _ in co_company_counter.most_common(12)]
    candidate_indications = [i for i, _ in co_indication_counter.most_common(10)]

    raw_cells = {}
    for r in recs:
        indications = [item for item in record_indications(r) if item in candidate_indications]
        if not indications:
            continue
        if r["company"] not in candidate_companies:
            continue
        for indication in indications:
            key = (r["company"], indication)
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
    write_json(OUT_DIR / "overview.json", overview)
    china_map = china_enterprise_map(records, csv_mtime.isoformat(timespec="seconds"))
    write_json(OUT_DIR / "china_enterprise_map.json", china_map)

    manifest = {
        "generated_at": csv_mtime.isoformat(timespec="seconds"),
        "tracks": [
            {**meta,
             "url": f"tracks/{meta['key']}.html",
             "data_url": f"assets/data/tracks/{meta['key']}.json"}
            for meta in TRACK_META
        ],
    }
    write_json(OUT_DIR / "manifest.json", manifest)

    for meta in TRACK_META:
        payload = per_track_payload(records, meta["key"])
        write_json(TRACK_DIR / f"{meta['key']}.json", payload)

    print(f"wrote overview ({len(records)} records, {overview['kpi']['main_records']} in main)")
    for meta in TRACK_META:
        path = TRACK_DIR / f"{meta['key']}.json"
        print(f"  - {meta['key']}: {path.stat().st_size // 1024}KB")


if __name__ == "__main__":
    main()
