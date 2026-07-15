from __future__ import annotations

import argparse
import json
import subprocess
from pathlib import Path

from faster_whisper import WhisperModel


def atomic_json(path: Path, payload: dict) -> None:
    temp = path.with_name(path.name + ".tmp")
    temp.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    temp.replace(path)


def extract_audio(ffmpeg: Path, source: Path, audio: Path) -> None:
    completed = subprocess.run(
        [str(ffmpeg), "-y", "-i", str(source), "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", str(audio)],
        text=True,
        encoding="utf-8",
        errors="replace",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
        creationflags=subprocess.CREATE_NO_WINDOW,
    )
    if completed.returncode != 0 or not audio.exists():
        raise RuntimeError(f"audio extraction failed: {completed.stderr[-800:]}")


def transcribe_once(
    audio: Path, model_name: str, language: str, device: str, compute_type: str
) -> tuple[list[dict], str]:
    model = WhisperModel(model_name, device=device, compute_type=compute_type)
    segments_iter, info = model.transcribe(
        str(audio), language=language, beam_size=5, vad_filter=True, condition_on_previous_text=True
    )
    segments = []
    for index, segment in enumerate(segments_iter, start=1):
        text = " ".join(str(segment.text or "").split()).strip()
        if not text:
            continue
        segments.append({
            "id": f"t{index:04d}",
            "start": round(float(segment.start), 3),
            "end": round(float(segment.end), 3),
            "text": text,
        })
    return segments, getattr(info, "language", language) or language


def transcribe(audio: Path, model_name: str, language: str, device: str, compute_type: str) -> tuple[list[dict], str, str]:
    try:
        segments, detected_language = transcribe_once(
            audio, model_name, language, device, compute_type
        )
        return segments, device, detected_language
    except Exception:
        if device != "cuda":
            raise
        # CUDA libraries can be missing even when the GPU is detectable. Some
        # failures only surface while consuming the lazy segment iterator, so
        # the entire GPU transcription attempt must be inside the try block.
        segments, detected_language = transcribe_once(
            audio, model_name, language, "cpu", "int8"
        )
        return segments, "cpu", detected_language


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--audio-output", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--ffmpeg", required=True)
    parser.add_argument("--model", default="large-v3")
    parser.add_argument("--language", default="ko")
    parser.add_argument("--device", default="cuda")
    parser.add_argument("--compute-type", default="float16")
    args = parser.parse_args()

    source = Path(args.input).resolve()
    audio = Path(args.audio_output).resolve()
    output = Path(args.output).resolve()
    audio.parent.mkdir(parents=True, exist_ok=True)
    extract_audio(Path(args.ffmpeg), source, audio)
    segments, active_device, detected_language = transcribe(
        audio, args.model, args.language, args.device, args.compute_type
    )
    payload = {
        "schema_version": "1.0",
        "language": detected_language,
        "model": args.model,
        "device": active_device,
        "segments": segments,
        "full_text": " ".join(segment["text"] for segment in segments),
    }
    atomic_json(output, payload)
    print(json.dumps({"ok": True, "transcript_file": output.as_posix(), "segments": len(segments), "device": active_device}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
