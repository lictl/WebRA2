#!/usr/bin/env python3
"""Read-only installation triage. Emits metadata, never extracted game content.

Python standard library only. Does not execute binaries, decrypt MIX indexes,
extract archives, disassemble code, or establish runtime behavior.
"""

import argparse
from collections import Counter
import hashlib
import json
from pathlib import Path
import re
import struct
import zipfile


MAP_SECTIONS = (
    "Basic", "Map", "Triggers", "Events", "Actions", "Tags", "CellTags",
    "TeamTypes", "ScriptTypes", "TaskForces", "AITriggerTypes",
    "AITriggerTypesEnable", "VariableNames", "IsoMapPack5", "OverlayPack",
    "OverlayDataPack", "Units", "Infantry", "Aircraft", "Structures",
)


def digest(path):
    result = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            result.update(block)
    return result.hexdigest()


def mix_metadata(path):
    with path.open("rb") as stream:
        head = stream.read(10)
        if len(head) < 6:
            return {"error": "truncated MIX header"}
        classic = struct.unpack_from("<H", head)[0] != 0
        flags = 0 if classic else struct.unpack_from("<I", head)[0]
        result = {
            "format_candidate": "classic" if classic else "flagged",
            "flags_hex": f"0x{flags:08x}",
            "encrypted_index": bool(flags & 0x20000),
            "checksum_flag": bool(flags & 0x10000),
            "checksum_verified": False,
        }
        if flags & ~0x30000:
            result["error"] = "unknown MIX flags"
            return result
        if result["encrypted_index"]:
            result["index_status"] = "not decrypted; members not enumerated"
            return result
        start = 0 if classic else 4
        if len(head) < start + 6:
            result["error"] = "truncated MIX count/size"
            return result
        count, data_size = struct.unpack_from("<HI", head, start)
        data_start = start + 6 + 12 * count
        stream.seek(start + 6)
        index = stream.read(12 * count)
        if len(index) != 12 * count:
            result["error"] = "truncated MIX index"
            return result
        entries = list(struct.iter_unpack("<III", index))
        result.update({
            "entry_count": count,
            "declared_data_bytes": data_size,
            "data_offset": data_start,
            "entry_ranges_within_declared_data": all(
                offset + size <= data_size for _, offset, size in entries
            ),
            "declared_data_within_file": data_start + data_size <= path.stat().st_size,
            "trailing_bytes": path.stat().st_size - data_start - data_size,
            "index_status": "numeric entries read; filenames unresolved",
        })
        return result


def pe_metadata(path):
    data = path.read_bytes()
    if data[:2] != b"MZ":
        raise ValueError("missing MZ signature")
    pe = struct.unpack_from("<I", data, 60)[0]
    if data[pe:pe + 4] != b"PE\0\0":
        raise ValueError("missing PE signature")
    machine, count, _, _, _, optional_size, _ = struct.unpack_from("<HHIIIHH", data, pe + 4)
    optional = pe + 24
    magic = struct.unpack_from("<H", data, optional)[0]
    if magic != 0x10B:
        raise ValueError("this triage parser supports PE32 only")
    sections = []
    for number in range(count):
        offset = optional + optional_size + number * 40
        name = data[offset:offset + 8].rstrip(b"\0").decode("ascii", errors="replace")
        virtual_size, address, size, pointer = struct.unpack_from("<IIII", data, offset + 8)
        sections.append({"name": name, "virtual_size": virtual_size,
                         "rva": address, "raw_size": size, "raw_offset": pointer})

    def file_offset(rva):
        for section in sections:
            if section["rva"] <= rva < section["rva"] + section["raw_size"]:
                result = section["raw_offset"] + rva - section["rva"]
                if result < len(data):
                    return result
        raise ValueError("RVA outside file-backed sections")

    imports = []
    import_rva, import_size = struct.unpack_from("<II", data, optional + 104)
    if import_rva:
        offset = file_offset(import_rva)
        for number in range(min(import_size // 20 + 1, 4096)):
            entry = offset + number * 20
            fields = struct.unpack_from("<IIIII", data, entry)
            if not any(fields):
                break
            name_offset = file_offset(fields[3])
            end = data.index(b"\0", name_offset, min(name_offset + 512, len(data)))
            imports.append(data[name_offset:end].decode("ascii", errors="replace"))
        else:
            raise ValueError("unterminated import descriptor table")

    # These are string-key candidates, not a full version-resource tree parser.
    versions = {}
    for key in ("FileVersion", "ProductVersion", "ProductName", "OriginalFilename"):
        needle = (key + "\0").encode("utf-16le")
        offset = data.find(needle)
        if offset < 0:
            continue
        start = (offset + len(needle) + 3) & ~3
        end = start
        while end + 2 <= min(start + 512, len(data)) and data[end:end + 2] != b"\0\0":
            end += 2
        versions[key] = data[start:end].decode("utf-16le", errors="replace")
    return {"machine_hex": f"0x{machine:04x}", "optional_header": "PE32",
            "sections": sections, "import_dlls": imports,
            "version_string_candidates": versions}


def map_structure(path):
    data = path.read_bytes()
    counts = Counter(match.group(1).decode("ascii") for match in re.finditer(
        rb"(?m)^\[([A-Za-z][A-Za-z0-9]{0,40})\]\r?$", data
    ))
    return {"method": "raw payload section-header scan, without member boundaries",
            "warning": "occurrences are not unique missions or proof of decoded maps",
            "section_occurrences": {name: counts[name] for name in MAP_SECTIONS}}


def inventory(root):
    files = sorted(path for path in root.rglob("*") if path.is_file() and not path.is_symlink())
    extensions = Counter(path.suffix.lower() or "(none)" for path in files)
    top = [path for path in files if path.parent == root]
    archives = [path for path in top if path.suffix.lower() in (".mix", ".mmx", ".yro")]
    report = {
        "schema_version": 1,
        "scope": "static installation triage; no game execution or asset extraction",
        "file_count": len(files),
        "total_bytes": sum(path.stat().st_size for path in files),
        "extensions": dict(sorted(extensions.items())),
        "top_level_archives": [],
        "executables": [],
        "map_archive_structure": {},
    }
    for path in archives:
        item = {"path": path.relative_to(root).as_posix(), "bytes": path.stat().st_size,
                "sha256": digest(path)}
        try:
            item.update(mix_metadata(path))
        except (OSError, ValueError, struct.error) as error:
            item["error"] = str(error)
        report["top_level_archives"].append(item)
    for path in top:
        if path.name.lower() not in ("game.exe", "gamemd.exe", "ra2.exe", "ra2md.exe"):
            continue
        item = {"path": path.name, "bytes": path.stat().st_size, "sha256": digest(path)}
        try:
            item.update(pe_metadata(path))
        except (OSError, ValueError, struct.error) as error:
            item["error"] = str(error)
        report["executables"].append(item)
    for path in top:
        if path.name.lower() in ("maps01.mix", "maps02.mix", "mapsmd03.mix", "expandmd01.mix"):
            report["map_archive_structure"][path.name] = map_structure(path)
    source = root / "FinalAlert2/Source Code/TS_RA2_Mission_Editor_SourceCode.zip"
    if source in files:
        with zipfile.ZipFile(source) as archive:
            report["editor_source_archive"] = {
                "path": source.relative_to(root).as_posix(), "sha256": digest(source),
                "member_count": len(archive.infolist()),
                "scope": "ZIP directory inspection only; no source extracted or copied",
                "selected_members_present": [name for name in (
                    "LICENSE.md", "3rdParty/xcc/COPYING", "3rdParty/xcc/misc/mix_file.cpp",
                    "MissionEditor/MapData.cpp", "MissionEditor/MapValidator.cpp",
                ) if name in archive.namelist()],
            }
    return report


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("game_directory", nargs="?", default="game", type=Path)
    arguments = parser.parse_args()
    if not arguments.game_directory.is_dir():
        parser.error("game_directory must be an existing installation directory")
    print(json.dumps(inventory(arguments.game_directory), indent=2, sort_keys=True))
