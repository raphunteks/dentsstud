#!/usr/bin/env python3
"""
DENTSWEB STUDIO — Render & Sync 21 Gaya Asli DB ke VPS
Memproses 21 gaya asli:
  art-deco, ascii-crt, blueprint, circuit-board, engraving, halftone-dossier,
  memphis-diorama, one-line, paper-popup, pictogram-motion, printed-long-take,
  shadow-puppet, spy-titles, stained-glass, swiss-motion, tilt-shift, ukiyoe,
  urban-sketch, watercolor, whiteboard, woodcut.

Fitur:
  - Render MP4 9:16 (1080x1920 60fps) + Waveform + Pink-noise SFX layer + JPG snapshot
  - Update PostgreSQL media_assets & visual_presets (preview_asset_id & thumbnail_asset_id)
  - Mode --watch: loop menunggu file audio dari voicestudio
"""

import os
import sys
import re
import json
import time
import hashlib
import argparse
import subprocess
from pathlib import Path

AUDIO_DIR = Path("/opt/dentsweb/content/skills/dentsweb-motion/assets/audio")
OUTPUT_DIR = Path("/opt/dentsweb/apps/api/.data/storage/objects/media/presets_rendered")
MIRROR_DIR = Path("/opt/dentsweb/apps/api/.data/storage/objects/presets_rendered")
SUPERADMIN_ID = "62375e60-d295-4f0c-8828-e2bc6ce50ba9"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MIRROR_DIR.mkdir(parents=True, exist_ok=True)

STYLES_21 = [
    {"slug": "art-deco", "title": "ART DECO GEOMETRIS", "topic": "Kemewahan Zaman Emas 1920-an", "bg": "#1a120b", "acc": "#d4af37", "sub": "#f8f1e5"},
    {"slug": "ascii-crt", "title": "ASCII / CRT TERMINAL", "topic": "Hacking & Glitch Terminal Retro", "bg": "#051622", "acc": "#00ff66", "sub": "#a3ffb0"},
    {"slug": "blueprint", "title": "BLUEPRINT ARSITEKTUR", "topic": "Cetak Biru Teknis & Skematik", "bg": "#0d2b45", "acc": "#58a6ff", "sub": "#f0f6fc"},
    {"slug": "circuit-board", "title": "CIRCUIT BOARD PCB", "topic": "Arsitektur Mikroprosesor Modern", "bg": "#072016", "acc": "#00ff88", "sub": "#d1fae5"},
    {"slug": "engraving", "title": "COPPERPLATE ENGRAVING", "topic": "Cukil Tembaga Uang Kertas & Peta Kuno", "bg": "#1f1d1a", "acc": "#d97706", "sub": "#fef3c7"},
    {"slug": "halftone-dossier", "title": "HALFTONE DOSSIER", "topic": "Dokumen Intelijen Titik Halftone", "bg": "#18181b", "acc": "#e11d48", "sub": "#fafafa"},
    {"slug": "memphis-diorama", "title": "MEMPHIS DIORAMA", "topic": "Estetika Pop Geometri 80-an Berani", "bg": "#2e1a47", "acc": "#ff007f", "sub": "#fffa65"},
    {"slug": "one-line", "title": "ONE-LINE DRAWING", "topic": "Satu Garis Kontinu Tanpa Terputus", "bg": "#09090b", "acc": "#38bdf8", "sub": "#ffffff"},
    {"slug": "paper-popup", "title": "PAPER POP-UP BOOK", "topic": "Buku Lipat Kertas 3D Interaktif", "bg": "#2a1b18", "acc": "#fb923c", "sub": "#ffedd5"},
    {"slug": "pictogram-motion", "title": "PICTOGRAM MOTION", "topic": "Piktogram Simbol Universal Dinamis", "bg": "#0f172a", "acc": "#38bdf8", "sub": "#f8fafc"},
    {"slug": "printed-long-take", "title": "PRINTED LONG TAKE", "topic": "Mesin Cetak Berjalan Tanpa Henti", "bg": "#1c1917", "acc": "#f59e0b", "sub": "#f5f5f4"},
    {"slug": "shadow-puppet", "title": "WAYANG SHADOW PUPPET", "topic": "Siluet Bayangan Lampu Minyak Kelir", "bg": "#1c1408", "acc": "#f59e0b", "sub": "#fef3c7"},
    {"slug": "spy-titles", "title": "60S SPY TITLE SEQUENCE", "topic": "Pembuka Sinematik Agen Rahasia 60-an", "bg": "#18181b", "acc": "#ef4444", "sub": "#ffffff"},
    {"slug": "stained-glass", "title": "GOTHIC STAINED GLASS", "topic": "Kaca Patri Bercahaya Katedral Kuno", "bg": "#0c0a09", "acc": "#a855f7", "sub": "#fde047"},
    {"slug": "swiss-motion", "title": "SWISS TYPOGRAPHY MOTION", "topic": "Grid Tipografi Internasional Presisi", "bg": "#09090b", "acc": "#ef4444", "sub": "#ffffff"},
    {"slug": "tilt-shift", "title": "TILT-SHIFT MINIATURE", "topic": "Kota Miniatur Efek Lensa Miring", "bg": "#0f172a", "acc": "#06b6d4", "sub": "#f1f5f9"},
    {"slug": "ukiyoe", "title": "E-HON UKIYO-E WOODBLOCK", "topic": "Lukisan Kayu Cetak Ombak Tradisional Jepang", "bg": "#1c1917", "acc": "#0284c7", "sub": "#fed7aa"},
    {"slug": "urban-sketch", "title": "URBAN SKETCH PEN & WASH", "topic": "Sketsa Tinta & Sapuan Cat Air Spontan", "bg": "#18181b", "acc": "#f97316", "sub": "#f4f4f5"},
    {"slug": "watercolor", "title": "WATERCOLOR BOTANICAL", "topic": "Gradasi Pigmen Cat Air Basah Lembut", "bg": "#141e1b", "acc": "#10b981", "sub": "#ecfdf5"},
    {"slug": "whiteboard", "title": "WHITEBOARD EXPLAINER", "topic": "Spidol Cepat Papan Tulis Edukasi", "bg": "#0f172a", "acc": "#3b82f6", "sub": "#ffffff"},
    {"slug": "woodcut", "title": "MEDIEVAL WOODCUT PRINT", "topic": "Goresan Kayu Kasar Abad Pertengahan", "bg": "#181412", "acc": "#d97706", "sub": "#fef3c7"},
]

def run_psql(query):
    cmd = ["docker", "exec", "-i", "dentweb-postgres", "psql", "-U", "dentweb", "-d", "dentweb", "-t", "-A", "-q", "-c", query]
    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"psql error: {res.stderr.strip()}")
    out = res.stdout.strip()
    m = re.search(r"[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}", out)
    if m:
        return m.group(0)
    return out

def get_sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        while chunk := f.read(65536):
            h.update(chunk)
    return h.hexdigest()

def render_style(s_info, idx):
    slug = s_info["slug"]
    out_mp4 = OUTPUT_DIR / f"{slug}.mp4"
    out_jpg = OUTPUT_DIR / f"{slug}.jpg"
    audio_path = AUDIO_DIR / f"VO_{slug}.mp3"

    if not audio_path.exists():
        return False

    # Render video jika belum ada
    if not (out_mp4.exists() and out_mp4.stat().st_size > 100000 and out_jpg.exists()):
        cmd_dur = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(audio_path)]
        res_dur = subprocess.run(cmd_dur, capture_output=True, text=True)
        try:
            dur = float(res_dur.stdout.strip())
        except Exception:
            dur = 15.0

        print(f"[{idx+1}/21] Render {slug} ({dur:.1f}s)...", flush=True)

        clean_title = s_info["title"].replace("'", "").replace(":", "-").replace("[", "(").replace("]", ")")[:38]
        clean_topic = s_info["topic"].replace("'", "").replace(":", "-").replace("[", "(").replace("]", ")")[:45]

        sfx_filter = f"anoisesrc=d={dur}:c=pink:r=44100:a=0.03,lowpass=f=800,volume=0.3[sfx];[0:a][sfx]amix=inputs=2:duration=first[aout]"
        video_filter = (
            f"color=c={s_info['bg']}:s=1080x1920:d={dur}:r=60[bg];"
            f"[0:a]showwaves=s=920x340:mode=line:colors={s_info['acc']}:rate=60[wave];"
            f"[bg][wave]overlay=(W-w)/2:(H-h)/2+200[v1];"
            f"[v1]drawtext=text='DENTSWEB MOTION':fontcolor={s_info['acc']}:fontsize=44:x=(w-text_w)/2:y=180,"
            f"drawtext=text='{clean_title}':fontcolor={s_info['sub']}:fontsize=52:x=(w-text_w)/2:y=280:shadowcolor=black:shadowx=2:shadowy=2,"
            f"drawtext=text='{clean_topic}':fontcolor={s_info['acc']}:fontsize=32:x=(w-text_w)/2:y=380,"
            f"drawtext=text='VO: Kokoro Neural Engine + SFX':fontcolor={s_info['sub']}:fontsize=30:x=(w-text_w)/2:y=h-220,"
            f"drawtext=text='motion.dentsweb.my.id':fontcolor={s_info['acc']}:fontsize=36:x=(w-text_w)/2:y=h-140[vout]"
        )

        cmd_render = [
            "ffmpeg", "-y",
            "-i", str(audio_path),
            "-filter_complex", f"{video_filter};{sfx_filter}",
            "-map", "[vout]",
            "-map", "[aout]",
            "-c:v", "libx264",
            "-preset", "veryfast",
            "-crf", "22",
            "-pix_fmt", "yuv420p",
            "-c:a", "aac",
            "-b:a", "192k",
            "-shortest",
            str(out_mp4)
        ]
        subprocess.run(cmd_render, capture_output=True, check=True)

        cmd_thumb = [
            "ffmpeg", "-y",
            "-ss", "00:00:01.500",
            "-i", str(out_mp4),
            "-vframes", "1",
            "-q:v", "2",
            str(out_jpg)
        ]
        subprocess.run(cmd_thumb, capture_output=True, check=True)

    # Sync PostgreSQL media_assets & visual_presets
    mp4_size = out_mp4.stat().st_size
    mp4_sha = get_sha256(out_mp4)
    jpg_size = out_jpg.stat().st_size
    jpg_sha = get_sha256(out_jpg)

    mp4_obj = f"presets_rendered/{slug}.mp4"
    jpg_obj = f"presets_rendered/{slug}.jpg"

    # 1. Upsert MP4 asset
    existing_mp4_id = run_psql(f"SELECT id FROM media_assets WHERE object_key = '{mp4_obj}' LIMIT 1;")
    if existing_mp4_id:
        mp4_id = existing_mp4_id
        run_psql(f"UPDATE media_assets SET size_bytes = {mp4_size}, sha256 = '{mp4_sha}', status = 'READY' WHERE id = '{mp4_id}';")
    else:
        mp4_id = run_psql(f"""
            INSERT INTO media_assets (id, owner_id, object_key, filename, mime_type, size_bytes, sha256, metadata, status, created_at)
            VALUES (gen_random_uuid(), '{SUPERADMIN_ID}', '{mp4_obj}', '{slug}.mp4', 'video/mp4', {mp4_size}, '{mp4_sha}', '{{\"type\": \"preview\"}}', 'READY', NOW())
            RETURNING id;
        """)

    # 2. Upsert JPG asset
    existing_jpg_id = run_psql(f"SELECT id FROM media_assets WHERE object_key = '{jpg_obj}' LIMIT 1;")
    if existing_jpg_id:
        jpg_id = existing_jpg_id
        run_psql(f"UPDATE media_assets SET size_bytes = {jpg_size}, sha256 = '{jpg_sha}', status = 'READY' WHERE id = '{jpg_id}';")
    else:
        jpg_id = run_psql(f"""
            INSERT INTO media_assets (id, owner_id, object_key, filename, mime_type, size_bytes, sha256, metadata, status, created_at)
            VALUES (gen_random_uuid(), '{SUPERADMIN_ID}', '{jpg_obj}', '{slug}.jpg', 'image/jpeg', {jpg_size}, '{jpg_sha}', '{{\"type\": \"thumbnail\"}}', 'READY', NOW())
            RETURNING id;
        """)

    # 3. Update visual_presets
    run_psql(f"""
        UPDATE visual_presets
        SET preview_asset_id = '{mp4_id}', thumbnail_asset_id = '{jpg_id}', updated_at = NOW()
        WHERE slug = '{slug}';
    """)

    print(f"[{idx+1}/21] OK {slug}: mp4={mp4_size}B jpg={jpg_size}B -> DB updated!", flush=True)
    return True

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--watch", action="store_true", help="Loop menunggu file audio dari voicestudio")
    args = parser.parse_args()

    print("=== DENTSWEB MOTION 21 SLUG RENDER & SYNC ORCHESTRATOR ===", flush=True)

    while True:
        completed = 0
        waiting = 0
        for idx, s in enumerate(STYLES_21):
            slug = s["slug"]
            # Cek apakah sudah terupdate di DB
            check = run_psql(f"SELECT count(*) FROM visual_presets p JOIN media_assets m ON p.preview_asset_id = m.id WHERE p.slug = '{slug}' AND m.object_key = 'presets_rendered/{slug}.mp4';")
            if check == "1":
                completed += 1
                continue
            ok = render_style(s, idx)
            if ok:
                completed += 1
            else:
                waiting += 1

        total_88 = run_psql("SELECT count(*) FROM visual_presets p JOIN media_assets m ON p.preview_asset_id = m.id WHERE m.object_key LIKE 'presets_rendered/%';")
        print(f"Status saat ini: {completed}/21 selesai. Menunggu audio: {waiting}. Total presets_rendered di DB: {total_88}/88.", flush=True)

        if completed >= 21 or total_88 == "88":
            print(f"\n[DONE] Seluruh 21 gaya berhasil dirender & disinkronkan ke DB! Total di DB: {total_88}/88.", flush=True)
            break

        if not args.watch:
            break

        time.sleep(5)

if __name__ == "__main__":
    main()
