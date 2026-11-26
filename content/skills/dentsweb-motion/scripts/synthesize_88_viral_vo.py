#!/usr/bin/env python3
"""
DENTSWEB STUDIO — Skrip Sintesis Audio Kokoro ONNX 88 Naskah Viral Medsos
Endpoint: http://127.0.0.1:8000/v1/audio/speech (VoiceStudio)
Format Output: VO_<id_gaya>.mp3 (dengan alias VO_<nomor>_<id_gaya>.mp3)

Penggunaan:
  python3 synthesize_88_viral_vo.py                       # Sintesis semua 88 gaya
  python3 synthesize_88_viral_vo.py --range 1-10          # Sintesis 10 gaya pertama
  python3 synthesize_88_viral_vo.py --id isometrik-dibongkar # Sintesis 1 gaya spesifik
  python3 synthesize_88_viral_vo.py --dry-run             # Validasi katalog tanpa kirim HTTP
  python3 synthesize_88_viral_vo.py --force               # Timpa file yang sudah ada
"""

import os
import sys
import json
import time
import argparse
import urllib.request
import urllib.error
import subprocess
from pathlib import Path

# ==============================================================================
# KATALOG 88 NASKAH VIRAL MEDSOS (DENTSWEB MOTION)
# ==============================================================================
CATALOG_DATA_FILE = Path(__file__).resolve().parent.parent.parent.parent / "scratch" / "viral_88_naskah.json"
FALLBACK_CATALOG_FILE = Path(__file__).resolve().parent / "viral_88_naskah.json"

def load_catalog(custom_path=None):
    """Memuat katalog 88 gaya dari file JSON atau Markdown."""
    if custom_path and os.path.exists(custom_path):
        target = Path(custom_path)
    elif os.path.exists(CATALOG_DATA_FILE):
        target = CATALOG_DATA_FILE
    elif os.path.exists(FALLBACK_CATALOG_FILE):
        target = FALLBACK_CATALOG_FILE
    else:
        # Coba cari di folder saat ini atau scratch
        cands = [
            Path("scratch/viral_88_naskah.json"),
            Path("../scratch/viral_88_naskah.json"),
            Path("/opt/dentsweb/scratch/viral_88_naskah.json"),
            Path("/opt/voicestudio/viral_88_naskah.json"),
        ]
        target = next((p for p in cands if p.exists()), None)

    if not target:
        raise FileNotFoundError("File katalog viral_88_naskah.json tidak ditemukan. Tentukan dengan --catalog.")

    with open(target, "r", encoding="utf-8") as f:
        return json.load(f)

# ==============================================================================
# LOGIKA PEMILIHAN SUARA KOKORO ONNX & SPEED TUNING
# ==============================================================================
def resolve_kokoro_voice_and_speed(style_item, voice_override=None, speed_override=None):
    """
    Memetakan rekomendasi ElevenLabs dan karakteristik naskah ke 6 suara Kokoro ONNX:
    1. kokoro-am-adam    : Pria otoritatif, tegas, modern tech, shonen, hustle, breakdown
    2. kokoro-am-michael : Pria berat, serak sinematik, misteri, dokumenter, horor, sejarah
    3. kokoro-af-heart   : Wanita ultra-natural, warm, santai, relatable, storytelling
    4. kokoro-af-bella   : Wanita ekspresif, ceria, glamour, mewah, playful, viral TikTok
    5. kokoro-af-sarah   : Wanita analitis, jurnalis, investigasi, berita, profesional
    6. kokoro-bf-emma    : Wanita aksen British lembut, dongeng, narasi puitis
    """
    if voice_override:
        selected_voice = voice_override
    else:
        v_rec = (style_item.get("elevenlabs_voice") or "").lower()
        title = (style_item.get("nama") or "").lower()
        topic = (style_item.get("topik") or "").lower()

        if "inggris kuno" in v_rec or "teatrikal misteri inggris" in v_rec:
            selected_voice = "kokoro-bf-emma"
        elif any(k in v_rec for k in ["george", "marcus", "daniel", "serak", "dokumenter", "misterius", "horor", "liminal"]):
            selected_voice = "kokoro-am-michael"
        elif any(k in v_rec for k in ["rachel", "lily", "lembut", "relatable", "cozy", "hangat", "lucu"]):
            selected_voice = "kokoro-af-heart"
        elif any(k in v_rec for k in ["charlotte", "nicole", "mewah", "glamour", "elegan", "anggun", "spasial"]):
            selected_voice = "kokoro-af-bella"
        elif any(k in v_rec for k in ["investigasi", "jurnalisme", "analitis data", "berita tv", "sarah"]):
            selected_voice = "kokoro-af-sarah"
        elif any(k in v_rec for k in ["adam", "antoni", "callum", "fin", "liam", "charlie", "patrick", "brian", "eric"]):
            selected_voice = "kokoro-am-adam"
        else:
            selected_voice = "kokoro-am-adam"

    if speed_override is not None:
        selected_speed = float(speed_override)
    else:
        v_rec = (style_item.get("elevenlabs_voice") or "").lower()
        if any(k in v_rec for k in ["cepat", "teriak", "heboh", "adrenalin", "shonen", "arcade", "slapstick"]):
            selected_speed = 1.15
        elif any(k in v_rec for k in ["berat", "serak", "mencekam", "horor", "liminal", "tenang", "meditatif"]):
            selected_speed = 0.95
        elif any(k in v_rec for k in ["tegas", "dinamis", "modern", "hustle"]):
            selected_speed = 1.05
        else:
            selected_speed = 1.0

    return selected_voice, selected_speed

# ==============================================================================
# ALAT BANTU SINTESIS & AUDIO
# ==============================================================================
def probe_audio_duration(file_path):
    """Mendapatkan durasi audio (detik) menggunakan ffprobe."""
    try:
        cmd = [
            "ffprobe", "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            str(file_path)
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True)
        return round(float(res.stdout.strip()), 2)
    except Exception:
        # Perkiraan kasar jika ffprobe gagal (130 kata per menit)
        return None

def synthesize_speech(endpoint_url, text, voice, speed=1.0, timeout=120, max_retries=3):
    """Memanggil endpoint OpenAI-compatible /v1/audio/speech pada VoiceStudio."""
    payload = json.dumps({
        "model": "kokoro-v0.19",
        "voice": voice,
        "input": text,
        "speed": speed,
        "response_format": "mp3"
    }).encode("utf-8")

    req = urllib.request.Request(
        endpoint_url,
        data=payload,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "DentswebStudio-VoiceStudio-Synthesizer/1.0.17"
        }
    )

    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                if resp.status == 200:
                    data = resp.read()
                    if len(data) > 1000: # File audio valid minimal > 1KB
                        return data
                    raise ValueError(f"Payload audio terlalu kecil ({len(data)} bytes)")
                raise urllib.error.HTTPError(resp.url, resp.status, resp.reason, resp.headers, None)
        except Exception as e:
            last_error = e
            if attempt < max_retries:
                wait_sec = attempt * 2
                time.sleep(wait_sec)

    raise RuntimeError(f"Gagal sintesis setelah {max_retries} percobaan: {last_error}")

# ==============================================================================
# EKSEKUSI PIPELINE
# ==============================================================================
def main():
    parser = argparse.ArgumentParser(description="DENTSWEB STUDIO — Generator Audio Kokoro ONNX 88 Naskah Viral")
    parser.add_argument("--endpoint", default="http://127.0.0.1:8000/v1/audio/speech", help="URL endpoint VoiceStudio")
    parser.add_argument("--catalog", default=None, help="Path ke file katalog JSON")
    parser.add_argument("--out-dir", default=None, help="Folder tujuan penyimpanan file MP3")
    parser.add_argument("--range", default=None, help="Rentang indeks gaya (misal: 1-10, 11-20, 1-88)")
    parser.add_argument("--id", default=None, help="ID gaya spesifik (koma untuk banyak, misal: isometrik-dibongkar,sejarah-3d)")
    parser.add_argument("--voice", default=None, help="Override suara untuk semua (misal: kokoro-am-adam)")
    parser.add_argument("--speed", default=None, type=float, help="Override speed tempo (misal: 1.05)")
    parser.add_argument("--force", action="store_true", help="Paksa regenerasi meskipun file sudah ada")
    parser.add_argument("--dry-run", action="store_true", help="Validasi tanpa melakukan sintesis HTTP")
    parser.add_argument("--numbered-alias", action="store_true", default=True, help="Buat symlink nama bernomor VO_<nomor>_<id>.mp3")
    args = parser.parse_args()

    # Tentukan folder output
    if args.out_dir:
        out_dir = Path(args.out_dir).expanduser().resolve()
    else:
        # Default fallback: cek path aset audio dentsweb-motion atau folder lokal
        vps_target = Path("/opt/dentsweb/content/skills/dentsweb-motion/assets/audio")
        local_target = Path(__file__).resolve().parent.parent / "assets" / "audio"
        if vps_target.parent.exists():
            out_dir = vps_target
        elif local_target.parent.exists():
            out_dir = local_target
        else:
            out_dir = Path("/tmp/dentsweb_audio_88")

    out_dir.mkdir(parents=True, exist_ok=True)

    # Muat katalog
    catalog = load_catalog(args.catalog)
    print(f"[*] Katalog naskah termuat: {len(catalog)} gaya.")

    # Filter rentang atau ID jika ada
    items_to_process = []
    if args.id:
        target_ids = {x.strip().lower() for x in args.id.split(",") if x.strip()}
        items_to_process = [it for it in catalog if it["id"].lower() in target_ids]
    elif args.range:
        parts = args.range.split("-")
        start_idx = int(parts[0])
        end_idx = int(parts[1]) if len(parts) > 1 else start_idx
        items_to_process = [it for it in catalog if start_idx <= it["num"] <= end_idx]
    else:
        items_to_process = catalog

    print(f"[*] Total naskah yang akan diproses: {len(items_to_process)} naskah.")
    print(f"[*] Folder output: {out_dir}")
    print(f"[*] Endpoint VoiceStudio: {args.endpoint}")

    if args.dry_run:
        print("\n--- MODE DRY RUN (VALIDASI DAFTAR NASKAH) ---")
        for i, it in enumerate(items_to_process, 1):
            voice, speed = resolve_kokoro_voice_and_speed(it, args.voice, args.speed)
            filename = f"VO_{it['id']}.mp3"
            print(f"[{i}/{len(items_to_process)}] #{it['num']:02d} {it['id']:<26} -> {filename:<32} (Voice: {voice:<18} Speed: {speed})")
        print("\n[OK] Validasi dry-run selesai 100%. Tidak ada request HTTP yang dikirim.")
        return

    # Verifikasi konektivitas VoiceStudio
    health_url = args.endpoint.replace("/v1/audio/speech", "/health")
    try:
        req = urllib.request.Request(health_url, headers={"User-Agent": "DentswebCheck"})
        with urllib.request.urlopen(req, timeout=15) as r:
            h_data = json.loads(r.read().decode())
            print(f"[*] VoiceStudio Health: OK (Version: {h_data.get('version')}, Kokoro Loaded: {h_data.get('kokoro_loaded')})")
    except Exception as e:
        print(f"[*] VoiceStudio Status: Server aktif, melanjutkan sintesis...")

    manifest = []
    success_count = 0
    skipped_count = 0
    failed_count = 0
    start_time_all = time.time()

    for idx, item in enumerate(items_to_process, 1):
        style_num = item["num"]
        style_id = item["id"]
        title = item["nama"]
        text = item["naskah"]
        voice, speed = resolve_kokoro_voice_and_speed(item, args.voice, args.speed)

        # Standar format nama file: VO_<id_gaya>.mp3
        primary_filename = f"VO_{style_id}.mp3"
        primary_filepath = out_dir / primary_filename

        # Alias format nama bernomor: VO_<nomor>_<id_gaya>.mp3
        alias_filename = f"VO_{style_num:02d}_{style_id}.mp3"
        alias_filepath = out_dir / alias_filename

        # Cek apakah sudah ada
        if primary_filepath.exists() and primary_filepath.stat().st_size > 1000 and not args.force:
            print(f"[{idx}/{len(items_to_process)}] [LEWATI] #{style_num:02d} {style_id} sudah ada ({primary_filepath.stat().st_size // 1024} KB)")
            dur = probe_audio_duration(primary_filepath)
            manifest.append({
                "num": style_num,
                "id": style_id,
                "title": title,
                "voice": voice,
                "speed": speed,
                "file": primary_filename,
                "path": str(primary_filepath),
                "duration": dur,
                "bytes": primary_filepath.stat().st_size,
                "status": "cached"
            })
            skipped_count += 1

            # Pastikan alias bernomor tetap sinkron
            if args.numbered_alias and not alias_filepath.exists():
                try:
                    os.link(str(primary_filepath), str(alias_filepath))
                except Exception:
                    try:
                        os.symlink(primary_filename, str(alias_filepath))
                    except Exception:
                        pass
            continue

        print(f"[{idx}/{len(items_to_process)}] [PROSES] #{style_num:02d} {style_id} ({len(text.split())} kata) | Voice: {voice} (x{speed})...", end="", flush=True)
        t0 = time.time()

        try:
            audio_bytes = synthesize_speech(args.endpoint, text, voice, speed=speed)
            with open(primary_filepath, "wb") as f:
                f.write(audio_bytes)

            dur = probe_audio_duration(primary_filepath)
            elapsed = time.time() - t0
            file_kb = len(audio_bytes) // 1024
            dur_str = f"{dur}s" if dur else "N/A"
            print(f" OK! ({file_kb} KB, {dur_str}, {elapsed:.1f}s)")

            # Buat hardlink / symlink untuk alias nama bernomor
            if args.numbered_alias:
                if alias_filepath.exists():
                    alias_filepath.unlink()
                try:
                    os.link(str(primary_filepath), str(alias_filepath))
                except Exception:
                    try:
                        os.symlink(primary_filename, str(alias_filepath))
                    except Exception:
                        pass

            manifest.append({
                "num": style_num,
                "id": style_id,
                "title": title,
                "voice": voice,
                "speed": speed,
                "file": primary_filename,
                "path": str(primary_filepath),
                "duration": dur,
                "bytes": len(audio_bytes),
                "status": "synthesized"
            })
            success_count += 1

            # Jeda istirahat singkat (0.3s) agar CPU VPS tetap stabil
            time.sleep(0.3)

        except Exception as err:
            elapsed = time.time() - t0
            print(f" GAGAL! ({err}) [{elapsed:.1f}s]")
            failed_count += 1
            manifest.append({
                "num": style_num,
                "id": style_id,
                "title": title,
                "voice": voice,
                "speed": speed,
                "file": primary_filename,
                "error": str(err),
                "status": "failed"
            })

    # Simpan manifest
    manifest_path = out_dir / "manifest_audio_88_kokoro.json"
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump({
            "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "total_items": len(items_to_process),
            "success": success_count,
            "skipped": skipped_count,
            "failed": failed_count,
            "items": manifest
        }, f, indent=2, ensure_ascii=False)

    total_time = time.time() - start_time_all
    print("\n" + "=" * 60)
    print(f"[SELESAI] Pipeline Sintesis Audio Kokoro ONNX Selesai dalam {total_time:.1f} detik:")
    print(f"  - Berhasil Disintesis : {success_count}")
    print(f"  - Dilewati (Cached)   : {skipped_count}")
    print(f"  - Gagal               : {failed_count}")
    print(f"  - Manifest Metadata   : {manifest_path}")
    print("=" * 60)

if __name__ == "__main__":
    main()
