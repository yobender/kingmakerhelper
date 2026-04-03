from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from pypdf import PdfReader


DEFAULT_PDF_FOLDER = Path(r"C:\Users\Chris Bender\Downloads\PathfinderKingmakerAdventurePathPDF-SingleFile")
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "kingmaker-source-manifest.json"


SOURCE_OVERRIDES: dict[str, dict[str, Any]] = {
    "Adventure Path.pdf": {
        "id": "adventure-path",
        "displayTitle": "Kingmaker Adventure Path",
        "audience": "gm",
        "role": "campaign-spine",
        "appBuckets": ["adventure", "atlas", "kingdom", "warfare", "library"],
        "description": "Primary GM book for the full campaign, including the story spine, hexploration, kingdom rules, warfare, treasure, and bestiary appendices.",
        "preferredFiles": ["Adventure Path.pdf", "Kingmaker.pdf"],
    },
    "Kingmaker.pdf": {
        "id": "adventure-path",
        "displayTitle": "Kingmaker Adventure Path",
        "audience": "gm",
        "role": "campaign-spine",
        "appBuckets": ["adventure", "atlas", "kingdom", "warfare", "library"],
        "description": "Duplicate filename for the primary GM book.",
        "preferredFiles": ["Adventure Path.pdf", "Kingmaker.pdf"],
    },
    "Companion Guide.pdf": {
        "id": "companion-guide",
        "displayTitle": "Kingmaker Companion Guide",
        "audience": "gm",
        "role": "companion-supplement",
        "appBuckets": ["companions", "camp", "kingdom", "library"],
        "description": "Companion recruitment, influence, personal quests, camping activities, special meals, and Stolen Lands weather support.",
    },
    "KingmakerSecondEdition_PlayersGuide.pdf": {
        "id": "players-guide",
        "displayTitle": "Kingmaker Player's Guide",
        "audience": "player",
        "role": "player-pack",
        "appBuckets": ["player-pack", "kingdom", "warfare", "library"],
        "description": "Player-safe character guidance plus spoiler-free kingdom, warfare, and reference sheets.",
        "preferredFiles": ["Players Guide.pdf", "KingmakerSecondEdition_PlayersGuide.pdf"],
        "sections": [
            {"depth": 0, "title": "Character Creation", "pageStart": 4},
            {"depth": 1, "title": "Ancestry", "pageStart": 4},
            {"depth": 1, "title": "Backgrounds", "pageStart": 5},
            {"depth": 1, "title": "Classes", "pageStart": 5},
            {"depth": 1, "title": "Other Considerations", "pageStart": 7},
            {"depth": 1, "title": "Kingmaker Backgrounds", "pageStart": 8},
            {"depth": 0, "title": "Kingdoms", "pageStart": 10},
            {"depth": 1, "title": "Kingdom Creation", "pageStart": 11},
            {"depth": 1, "title": "Leveling Up Your Kingdom", "pageStart": 16},
            {"depth": 1, "title": "Leadership Roles", "pageStart": 18},
            {"depth": 1, "title": "Kingdom Skills", "pageStart": 21},
            {"depth": 1, "title": "Kingdom Feats", "pageStart": 36},
            {"depth": 1, "title": "Kingdom Rules", "pageStart": 38},
            {"depth": 1, "title": "Running a Kingdom", "pageStart": 43},
            {"depth": 1, "title": "Gaining Kingdom Experience", "pageStart": 45},
            {"depth": 1, "title": "Settlements", "pageStart": 45},
            {"depth": 1, "title": "Kingdom Events", "pageStart": 59},
            {"depth": 0, "title": "Warfare", "pageStart": 61},
            {"depth": 1, "title": "Preparing for War", "pageStart": 61},
            {"depth": 1, "title": "Army Gear", "pageStart": 67},
            {"depth": 1, "title": "Army Tactics", "pageStart": 68},
            {"depth": 1, "title": "War Encounters", "pageStart": 70},
            {"depth": 1, "title": "Basic War Actions", "pageStart": 73},
            {"depth": 1, "title": "Army Conditions", "pageStart": 76},
            {"depth": 0, "title": "Resources", "pageStart": 78},
            {"depth": 1, "title": "Stolen Lands Maps", "pageStart": 78},
            {"depth": 1, "title": "Kingdom Sheet", "pageStart": 82},
            {"depth": 1, "title": "Urban Grid", "pageStart": 83},
            {"depth": 1, "title": "Structures", "pageStart": 84},
            {"depth": 1, "title": "Army Sheet", "pageStart": 86},
        ],
    },
    "Players Guide.pdf": {
        "id": "players-guide",
        "displayTitle": "Kingmaker Player's Guide",
        "audience": "player",
        "role": "player-pack",
        "appBuckets": ["player-pack", "kingdom", "warfare", "library"],
        "description": "Duplicate filename for the player-safe guide.",
        "preferredFiles": ["Players Guide.pdf", "KingmakerSecondEdition_PlayersGuide.pdf"],
    },
    "Kingdom Tracker.pdf": {
        "id": "kingdom-tracker",
        "displayTitle": "Kingmaker Kingdom Tracker",
        "audience": "table",
        "role": "tracker-pack",
        "appBuckets": ["kingdom", "warfare", "player-pack", "library"],
        "description": "Printable/at-table kingdom tracker with quick references for kingdom turns, armies, and village founding.",
    },
    "Kingdom Management Screen.pdf": {
        "id": "kingdom-management-screen",
        "displayTitle": "Kingdom Management Screen",
        "audience": "table",
        "role": "quick-reference",
        "appBuckets": ["kingdom", "player-pack", "library"],
        "description": "Two-page kingdom management aid intended for quick reference during play.",
        "sections": [
            {"depth": 0, "title": "Kingdom Management Screen", "pageStart": 1},
        ],
    },
    "PZO2020 Interactive Maps v2.pdf": {
        "id": "interactive-maps",
        "displayTitle": "Kingmaker Interactive Maps",
        "audience": "gm",
        "role": "map-pack",
        "appBuckets": ["atlas", "maps", "library"],
        "description": "Room and encounter map pack for use during prep and tactical play.",
        "sections": [
            {"depth": 0, "title": "Encounter Map Pack", "pageStart": 1},
        ],
    },
    "PZO2026 Kingmaker Map Folio Maps.pdf": {
        "id": "map-folio",
        "displayTitle": "Kingmaker Map Folio",
        "audience": "mixed",
        "role": "regional-maps",
        "appBuckets": ["atlas", "maps", "player-pack", "library"],
        "description": "Regional and settlement map folio for the Stolen Lands, Pitax, and Varnhold.",
        "sections": [
            {"depth": 0, "title": "Varnhold", "pageStart": 1},
            {"depth": 0, "title": "Pitax", "pageStart": 2},
            {"depth": 0, "title": "Stolen Lands Regional Maps", "pageStart": 3},
        ],
    },
}


@dataclass
class PdfRecord:
    file_name: str
    relative_path: str
    size_bytes: int
    pages: int
    sha256: str
    pdf_title: str
    sections: list[dict[str, Any]]
    metadata: dict[str, str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Build a Kingmaker PDF source manifest.")
    parser.add_argument("--pdf-folder", type=Path, default=DEFAULT_PDF_FOLDER, help="Folder containing the Kingmaker PDFs.")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT, help="Where to write the JSON manifest.")
    return parser.parse_args()


def compute_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def safe_string(value: Any) -> str:
    return str(value or "").strip()


def walk_outline(reader: PdfReader, items: Any, depth: int = 0, out: list[dict[str, Any]] | None = None) -> list[dict[str, Any]]:
    if out is None:
        out = []
    for item in items:
        if isinstance(item, list):
            walk_outline(reader, item, depth + 1, out)
            continue
        title = safe_string(getattr(item, "title", item))
        if not title:
            continue
        page_start = None
        try:
            page_start = reader.get_destination_page_number(item) + 1
        except Exception:
            page_start = None
        out.append({"depth": depth, "title": title, "pageStart": page_start})
    return out


def slim_sections(sections: list[dict[str, Any]], max_depth: int = 1) -> list[dict[str, Any]]:
    return [section for section in sections if int(section.get("depth", 0)) <= max_depth]


def read_pdf(path: Path, root: Path) -> PdfRecord:
    reader = PdfReader(str(path))
    metadata = reader.metadata or {}
    raw_sections: list[dict[str, Any]] = []
    try:
        raw_sections = walk_outline(reader, reader.outline)
    except Exception:
        raw_sections = []
    sections = slim_sections(raw_sections)
    pdf_title = ""
    if hasattr(metadata, "title"):
        pdf_title = safe_string(metadata.title)
    if not pdf_title:
        pdf_title = safe_string(metadata.get("/Title"))
    meta_map = {
        "author": safe_string(getattr(metadata, "author", None) or metadata.get("/Author")),
        "subject": safe_string(getattr(metadata, "subject", None) or metadata.get("/Subject")),
        "creator": safe_string(getattr(metadata, "creator", None) or metadata.get("/Creator")),
        "producer": safe_string(getattr(metadata, "producer", None) or metadata.get("/Producer")),
    }
    meta_map = {key: value for key, value in meta_map.items() if value}
    return PdfRecord(
        file_name=path.name,
        relative_path=str(path.relative_to(root)),
        size_bytes=path.stat().st_size,
        pages=len(reader.pages),
        sha256=compute_sha256(path),
        pdf_title=pdf_title,
        sections=sections,
        metadata=meta_map,
    )


def pick_override(file_names: list[str]) -> dict[str, Any]:
    for file_name in file_names:
        if file_name in SOURCE_OVERRIDES:
            return SOURCE_OVERRIDES[file_name]
    return {}


def pick_canonical_file(file_names: list[str], override: dict[str, Any]) -> str:
    preferred = override.get("preferredFiles") or []
    for candidate in preferred:
        if candidate in file_names:
            return candidate
    return sorted(file_names)[0]


def build_manifest(pdf_folder: Path) -> dict[str, Any]:
    if not pdf_folder.exists():
        raise FileNotFoundError(f"PDF folder not found: {pdf_folder}")
    records = [read_pdf(path, pdf_folder) for path in sorted(pdf_folder.glob("*.pdf"))]
    groups: dict[str, list[PdfRecord]] = defaultdict(list)
    for record in records:
        override = SOURCE_OVERRIDES.get(record.file_name, {})
        override_id = safe_string(override.get("id"))
        group_key = f"id:{override_id}" if override_id else f"sha:{record.sha256}"
        groups[group_key].append(record)

    canonical_sources: list[dict[str, Any]] = []
    duplicate_files: list[dict[str, Any]] = []

    for group_key, group in sorted(groups.items(), key=lambda item: sorted(record.file_name for record in item[1])[0].lower()):
        file_names = [record.file_name for record in group]
        override = pick_override(file_names)
        canonical_file_name = pick_canonical_file(file_names, override)
        canonical_record = next(record for record in group if record.file_name == canonical_file_name)
        canonical_id = safe_string(override.get("id")) or canonical_record.file_name.lower().replace(".pdf", "").replace(" ", "-")
        sections = override.get("sections") or canonical_record.sections
        aliases = sorted(record.file_name for record in group if record.file_name != canonical_file_name)
        sha_values = sorted({record.sha256 for record in group})
        source = {
            "id": canonical_id,
            "displayTitle": safe_string(override.get("displayTitle")) or canonical_record.pdf_title or canonical_record.file_name.replace(".pdf", ""),
            "fileName": canonical_record.file_name,
            "aliases": aliases,
            "relativePath": canonical_record.relative_path,
            "pages": canonical_record.pages,
            "sizeBytes": canonical_record.size_bytes,
            "sha256": canonical_record.sha256,
            "sourceHashes": sha_values,
            "audience": safe_string(override.get("audience")) or "gm",
            "role": safe_string(override.get("role")) or "reference",
            "appBuckets": list(override.get("appBuckets") or ["library"]),
            "description": safe_string(override.get("description")),
            "pdfTitle": canonical_record.pdf_title,
            "metadata": canonical_record.metadata,
            "sections": sections,
        }
        canonical_sources.append(source)
        if aliases:
            duplicate_files.append(
                {
                    "canonicalSourceId": canonical_id,
                    "canonicalFileName": canonical_file_name,
                    "duplicateFileNames": aliases,
                }
            )

    return {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "sourceFolder": str(pdf_folder),
        "canonicalSourceCount": len(canonical_sources),
        "sourceNotes": [
            "Adventure Path.pdf and Kingmaker.pdf are the same 642-page campaign book.",
            "Players Guide.pdf and KingmakerSecondEdition_PlayersGuide.pdf are the same player-safe guide.",
            "Audience values are intended for app partitioning: gm, player, table, and mixed.",
        ],
        "canonicalSources": canonical_sources,
        "duplicateFiles": duplicate_files,
    }


def main() -> None:
    args = parse_args()
    manifest = build_manifest(args.pdf_folder.resolve())
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Wrote manifest to {args.output}")


if __name__ == "__main__":
    main()
