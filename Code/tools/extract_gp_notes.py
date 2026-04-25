from __future__ import annotations

import json
import argparse
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "Hand Sync pt1 + BT.gp"
OUT = ROOT / "data" / "hand-sync-pt1-notes.json"


NOTE_VALUE_TO_UNITS = {
    "Whole": 1,
    "Half": 0.5,
    "Quarter": 0.25,
    "Eighth": 0.125,
    "16th": 0.0625,
    "Sixteenth": 0.0625,
}


def text(node: ET.Element | None, default: str = "") -> str:
    """Purpose: return trimmed XML text or a safe default.
    Warning: this does not inspect child nodes, so callers must pass the exact element.
    Why: this tiny helper keeps optional GPIF fields from adding repeated null checks.
    """
    return node.text.strip() if node is not None and node.text else default


def child_text(node: ET.Element, path: str, default: str = "") -> str:
    """Purpose: read trimmed text from one GPIF child path.
    Warning: ElementTree paths here are intentionally narrow and should not be used as fuzzy searches.
    Why: the extractor mirrors the browser parser while keeping XML lookup readable.
    """
    return text(node.find(path), default)


def property_node(node: ET.Element, name: str) -> ET.Element | None:
    """Purpose: find a named GPIF Property node.
    Warning: many score objects do not have the requested property, so None is normal.
    Why: GPIF stores string, fret, and MIDI values in property bags instead of direct fields.
    """
    for prop in node.findall("./Properties/Property"):
        if prop.attrib.get("name") == name:
            return prop
    return None


def int_property(node: ET.Element, name: str, child: str) -> int | None:
    """Purpose: read an integer from a named GPIF property child.
    Warning: returns None for missing values so rests and unsupported notes can be skipped.
    Why: defensive parsing keeps the extraction running on sparse GPIF note records.
    """
    prop = property_node(node, name)
    if prop is None:
        return None
    value = prop.find(child)
    if value is None or not value.text:
        return None
    return int(value.text.strip())


def rhythm_duration_units(rhythm: ET.Element) -> float:
    """Purpose: convert GPIF rhythm notation into whole-note units.
    Warning: tuplets must multiply by denominator/numerator; an eighth-note triplet is 1/12, not 1/3.
    Why: refactored from beat counts so whole=1, quarter=.25, and sizing/sync share one unit model.
    """
    value = child_text(rhythm, "NoteValue", "Quarter")
    units = NOTE_VALUE_TO_UNITS.get(value)
    if units is None:
        raise ValueError(f"Unsupported GPIF rhythm value: {value}")

    augmentation_dot = rhythm.find("AugmentationDot")
    if augmentation_dot is not None:
        units *= 1.5

    primary_tuplet = rhythm.find("PrimaryTuplet")
    if primary_tuplet is not None:
        numerator = float(child_text(primary_tuplet, "Numerator", "1"))
        denominator = float(child_text(primary_tuplet, "Denominator", "1"))
        if numerator:
            units *= denominator / numerator

    return units


def asset_node(root: ET.Element, asset_id: str) -> ET.Element | None:
    """Purpose: find a GPIF Asset record by id.
    Warning: missing asset records are valid for scores without embedded audio.
    Why: backing tracks reference AssetId, so this keeps audio lookup separate from note parsing.
    """
    for asset in root.findall("./Assets/Asset"):
        if asset.attrib.get("id") == asset_id:
            return asset
    return None


def backing_output_path(out: Path, embedded_path: str) -> Path:
    """Purpose: choose the static output path for an extracted backing-track asset.
    Warning: this deliberately normalizes the filename instead of exposing GP's UUID-heavy asset name.
    Why: deriving from the note JSON name gives predictable URLs such as hand-sync-pt1-backing.mp3.
    """
    suffix = Path(embedded_path).suffix or ".mp3"
    stem = out.stem[:-6] if out.stem.endswith("-notes") else out.stem
    return out.with_name(f"{stem}-backing{suffix}")


def backing_url_for_output(path: Path) -> str:
    """Purpose: convert a copied backing file into a browser URL.
    Warning: paths outside the app root fall back to a sibling filename and may need manual serving.
    Why: the default app is served from Code/, so app-relative URLs keep the static page portable.
    """
    try:
        return f"./{path.relative_to(ROOT).as_posix()}"
    except ValueError:
        return path.name


def extract_backing_track(root: ET.Element, archive: zipfile.ZipFile, out: Path, tempo: int) -> dict:
    """Purpose: copy an embedded GP8 backing track and return runtime metadata.
    Warning: score notes still come only from GPIF; the MP3 is optional playback audio, not timing truth.
    Why: the static browser app needs a served MP3 file so backing can load without reselecting the GP package.
    """
    backing = root.find("./BackingTrack")
    asset_id = child_text(backing, "AssetId", "") if backing is not None else ""
    asset = asset_node(root, asset_id) if asset_id else None
    embedded_path = child_text(asset, "EmbeddedFilePath", "") if asset is not None else ""
    original_path = child_text(asset, "OriginalFilePath", "") if asset is not None else ""
    label = child_text(backing, "Name", "") if backing is not None else ""
    label = label or Path(original_path).name or Path(embedded_path).name or "Backing track"

    metadata = {
        "available": False,
        "url": None,
        "embeddedPath": embedded_path or None,
        "label": label,
        "nativeTempo": tempo,
        "startOffsetUnits": 0,
        "startOffsetSeconds": 0,
    }

    if not embedded_path:
        return metadata

    try:
        backing_bytes = archive.read(embedded_path)
    except KeyError:
        return metadata

    backing_out = backing_output_path(out, embedded_path)
    backing_out.parent.mkdir(parents=True, exist_ok=True)
    backing_out.write_bytes(backing_bytes)

    metadata.update({
        "available": True,
        "url": backing_url_for_output(backing_out),
        "label": label,
    })
    return metadata


def main() -> None:
    """Purpose: extract timed guitar notes from a GP8 package into static JSON.
    Warning: only GPIF drives note timing; copied backing audio is optional playback and PDF notation is not inferred.
    Why: a deterministic extractor gives the browser app clean position data without a runtime backend.
    """
    parser = argparse.ArgumentParser(description="Extract renderable note data from a GP8 package.")
    parser.add_argument("--source", type=Path, default=SOURCE, help="Path to the .gp file.")
    parser.add_argument("--out", type=Path, default=OUT, help="Path for the extracted note JSON.")
    args = parser.parse_args()
    source = args.source
    out = args.out

    with zipfile.ZipFile(source) as archive:
        # GP8 files are zip packages. score.gpif drives note timing; embedded audio is copied only for optional playback.
        gpif = archive.read("Content/score.gpif")
        root = ET.fromstring(gpif)
        score = root.find("Score")
        title = child_text(score, "Title", source.stem) if score is not None else source.stem
        subtitle = child_text(score, "Artist", "") if score is not None else ""

        tempo = 120
        tempo_node = root.find("./MasterTrack/Automations/Automation[Type='Tempo']/Value")
        if tempo_node is not None and tempo_node.text:
            tempo = int(float(tempo_node.text.split()[0]))

        backing_track = extract_backing_track(root, archive, out, tempo)

    rhythm_by_id = {
        rhythm.attrib["id"]: rhythm_duration_units(rhythm)
        for rhythm in root.findall("./Rhythms/Rhythm")
    }

    note_by_id = {}
    for note in root.findall("./Notes/Note"):
        note_id = note.attrib["id"]
        gp_string = int_property(note, "String", "String")
        fret = int_property(note, "Fret", "Fret")
        midi = int_property(note, "Midi", "Number")
        if gp_string is None or fret is None:
            continue
        note_by_id[note_id] = {
            "gpString": gp_string,
            "string": 6 - gp_string,
            "fret": fret,
            "midi": midi,
        }

    beat_by_id = {}
    for beat in root.findall("./Beats/Beat"):
        beat_id = beat.attrib["id"]
        rhythm_ref = beat.find("Rhythm")
        rhythm_id = rhythm_ref.attrib.get("ref") if rhythm_ref is not None else None
        duration = rhythm_by_id.get(rhythm_id or "", NOTE_VALUE_TO_UNITS["Quarter"])
        note_ids = child_text(beat, "Notes", "").split()
        pick = child_text(beat, "./Properties/Property[@name='PickStroke']/Direction", "")
        beat_by_id[beat_id] = {
            "durationUnits": duration,
            "noteIds": note_ids,
            "pickStroke": pick.lower() or None,
            "section": child_text(beat, "FreeText", ""),
        }

    voice_by_id = {
        voice.attrib["id"]: child_text(voice, "Beats", "").split()
        for voice in root.findall("./Voices/Voice")
    }

    bars = []
    for bar in root.findall("./Bars/Bar"):
        voice_ids = [value for value in child_text(bar, "Voices", "").split() if value != "-1"]
        bars.append({
            "id": bar.attrib["id"],
            "voiceIds": voice_ids,
        })

    first_playable_bar = next(
        (index for index, bar in enumerate(bars) if bar["voiceIds"]),
        0,
    )
    backing_track["startOffsetUnits"] = round(first_playable_bar * NOTE_VALUE_TO_UNITS["Whole"], 6)
    backing_track["startOffsetSeconds"] = round(
        (backing_track["startOffsetUnits"] / NOTE_VALUE_TO_UNITS["Quarter"]) * (60 / tempo),
        6,
    )

    notes = []
    measure_summaries = []
    sections = []

    for bar_index, bar in enumerate(bars[first_playable_bar:], start=first_playable_bar):
        position_cursor = 0.0
        bar_notes = 0
        durations = []
        source_measure = bar_index + 1
        visual_measure = bar_index - first_playable_bar + 1

        for voice_id in bar["voiceIds"]:
            for beat_id in voice_by_id.get(voice_id, []):
                beat = beat_by_id.get(beat_id)
                if not beat:
                    continue
                if beat["section"]:
                    sections.append({
                        "measure": visual_measure,
                        "sourceMeasure": source_measure,
                        "label": beat["section"],
                    })

                for note_id in beat["noteIds"]:
                    note = note_by_id.get(note_id)
                    if not note:
                        continue
                    notes.append({
                        "string": note["string"],
                        "fret": note["fret"],
                        "position": round((visual_measure - 1) + position_cursor, 6),
                        "durationUnits": beat["durationUnits"],
                        "sourceMeasure": source_measure,
                        "measure": visual_measure,
                        "positionInMeasure": round(position_cursor, 6),
                        "gpString": note["gpString"],
                        "midi": note["midi"],
                        "pickStroke": beat["pickStroke"],
                    })
                    bar_notes += 1
                    durations.append(beat["durationUnits"])

                position_cursor += beat["durationUnits"]

        measure_summaries.append({
            "measure": visual_measure,
            "sourceMeasure": source_measure,
            "noteCount": bar_notes,
            "durationUnits": round(position_cursor, 6),
            "durations": sorted(set(durations)),
        })

    payload = {
        "source": {
            "file": source.name,
            "title": title,
            "subtitle": subtitle,
            "tempo": tempo,
            "timeSignature": "4/4",
            "backingTrack": backing_track,
            "scoreTimingSource": "GPIF notes",
        },
        "summary": {
            "measures": len(measure_summaries),
            "notes": len(notes),
            "firstPlayableSourceMeasure": first_playable_bar + 1,
            "durationValues": sorted(set(note["durationUnits"] for note in notes)),
            "allEighthNotes": all(abs(note["durationUnits"] - NOTE_VALUE_TO_UNITS["Eighth"]) < 0.001 for note in notes),
            "allMeasuresEightNotes": all(
                measure["noteCount"] == 8
                and abs(measure["durationUnits"] - NOTE_VALUE_TO_UNITS["Whole"]) < 0.001
                and measure["durations"] == [NOTE_VALUE_TO_UNITS["Eighth"]]
                for measure in measure_summaries
            ),
        },
        "sections": sections,
        "measures": measure_summaries,
        "notes": notes,
    }

    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload["summary"], indent=2))
    print(out)


if __name__ == "__main__":
    main()
