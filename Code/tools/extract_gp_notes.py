from __future__ import annotations

import json
import zipfile
from pathlib import Path
from xml.etree import ElementTree as ET


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT.parent / "Hand Sync pt1 + BT.gp"
OUT = ROOT / "data" / "hand-sync-pt1-notes.json"


NOTE_VALUE_TO_BEATS = {
    "Whole": 4,
    "Half": 2,
    "Quarter": 1,
    "Eighth": 0.5,
    "16th": 0.25,
    "Sixteenth": 0.25,
}


def text(node: ET.Element | None, default: str = "") -> str:
    return node.text.strip() if node is not None and node.text else default


def child_text(node: ET.Element, path: str, default: str = "") -> str:
    return text(node.find(path), default)


def property_node(node: ET.Element, name: str) -> ET.Element | None:
    for prop in node.findall("./Properties/Property"):
        if prop.attrib.get("name") == name:
            return prop
    return None


def int_property(node: ET.Element, name: str, child: str) -> int | None:
    prop = property_node(node, name)
    if prop is None:
        return None
    value = prop.find(child)
    if value is None or not value.text:
        return None
    return int(value.text.strip())


def rhythm_duration_beats(rhythm: ET.Element) -> float:
    value = child_text(rhythm, "NoteValue", "Quarter")
    beats = NOTE_VALUE_TO_BEATS.get(value)
    if beats is None:
        raise ValueError(f"Unsupported GPIF rhythm value: {value}")

    augmentation_dot = rhythm.find("AugmentationDot")
    if augmentation_dot is not None:
        beats *= 1.5

    primary_tuplet = rhythm.find("PrimaryTuplet")
    if primary_tuplet is not None:
        numerator = float(child_text(primary_tuplet, "Numerator", "1"))
        denominator = float(child_text(primary_tuplet, "Denominator", "1"))
        if numerator:
            beats *= denominator / numerator

    return beats


def main() -> None:
    with zipfile.ZipFile(SOURCE) as archive:
        gpif = archive.read("Content/score.gpif")

    root = ET.fromstring(gpif)
    score = root.find("Score")
    title = child_text(score, "Title", SOURCE.stem) if score is not None else SOURCE.stem
    subtitle = child_text(score, "Artist", "") if score is not None else ""

    tempo = 120
    tempo_node = root.find("./MasterTrack/Automations/Automation[Type='Tempo']/Value")
    if tempo_node is not None and tempo_node.text:
        tempo = int(float(tempo_node.text.split()[0]))

    rhythm_by_id = {
        rhythm.attrib["id"]: rhythm_duration_beats(rhythm)
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
        duration = rhythm_by_id.get(rhythm_id or "", 1)
        note_ids = child_text(beat, "Notes", "").split()
        pick = child_text(beat, "./Properties/Property[@name='PickStroke']/Direction", "")
        beat_by_id[beat_id] = {
            "durationBeats": duration,
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

    notes = []
    measure_summaries = []
    sections = []

    for bar_index, bar in enumerate(bars[first_playable_bar:], start=first_playable_bar):
        beat_cursor = 0.0
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
                        "beat": round((visual_measure - 1) * 4 + beat_cursor, 6),
                        "durationBeats": beat["durationBeats"],
                        "sourceMeasure": source_measure,
                        "measure": visual_measure,
                        "beatInMeasure": round(beat_cursor, 6),
                        "gpString": note["gpString"],
                        "midi": note["midi"],
                        "pickStroke": beat["pickStroke"],
                    })
                    bar_notes += 1
                    durations.append(beat["durationBeats"])

                beat_cursor += beat["durationBeats"]

        measure_summaries.append({
            "measure": visual_measure,
            "sourceMeasure": source_measure,
            "noteCount": bar_notes,
            "durationBeats": round(beat_cursor, 6),
            "durations": sorted(set(durations)),
        })

    payload = {
        "source": {
            "file": SOURCE.name,
            "title": title,
            "subtitle": subtitle,
            "tempo": tempo,
            "timeSignature": "4/4",
            "ignoredBackingTrack": True,
            "ignoredGpifSections": ["BackingTrack", "Assets", "Content/Assets/*.mp3"],
        },
        "summary": {
            "measures": len(measure_summaries),
            "notes": len(notes),
            "firstPlayableSourceMeasure": first_playable_bar + 1,
            "durationValues": sorted(set(note["durationBeats"] for note in notes)),
            "allEighthNotes": all(abs(note["durationBeats"] - 0.5) < 0.001 for note in notes),
            "allMeasuresEightNotes": all(
                measure["noteCount"] == 8
                and abs(measure["durationBeats"] - 4) < 0.001
                and measure["durations"] == [0.5]
                for measure in measure_summaries
            ),
        },
        "sections": sections,
        "measures": measure_summaries,
        "notes": notes,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload["summary"], indent=2))
    print(OUT)


if __name__ == "__main__":
    main()
