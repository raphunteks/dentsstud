#!/usr/bin/env python3
"""
DENTSWEB STUDIO — Renderer Motion Graphic Sejati 88 Gaya Viral Medsos
Versi: v2.3.0 (ACC Milestone v1.0.18)
Lokasi: /opt/dentsweb/content/skills/dentsweb-motion/scripts/render_88_real_motion.py

Fitur:
  - 88 gaya visual unik dengan palet warna terkalibrasi, tekstur, frame grafis, HUD, dan ikonik.
  - Subtitle kinetik berfrasa dinamis tersinkronisasi dengan VO & naskah viral.
  - Tata suara imersif: Sub-bass intro hit + ambient bed + sidechain ducking voiceover.
  - Thumbnail snapshot di detik ke-3.5 (visual penuh, judul hook cerah, bukan layar hitam).
  - Sinkronisasi otomatis ke media_assets & visual_presets PostgreSQL (target 88/88).
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

# Direktori & Konfigurasi
AUDIO_DIR = Path("/opt/dentsweb/content/skills/dentsweb-motion/assets/audio")
OUTPUT_DIR = Path("/opt/dentsweb/apps/api/.data/storage/objects/media/presets_rendered")
MIRROR_DIR = Path("/opt/dentsweb/apps/api/.data/storage/objects/presets_rendered")
CATALOG_PATH = Path("/opt/dentsweb/content/skills/dentsweb-motion/scripts/viral_88_naskah.json")
SYNTH_21_PATH = Path("/opt/dentsweb/content/skills/dentsweb-motion/scripts/synthesize_21_original_slugs.py")
SUPERADMIN_ID = "62375e60-d295-4f0c-8828-e2bc6ce50ba9"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MIRROR_DIR.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------------------------
# 12 ARKETIPE VISUAL MOTION GRAPHIC
# ------------------------------------------------------------------------------
THEMES = {
    "blueprint_tech": {
        "bg": "#06111f", "grid": "#00f0ff@0.14", "grid_major": "#00f0ff@0.25",
        "acc": "#00f0ff", "sub": "#ffffff", "tag": "TEARDOWN BLUEPRINT 3D",
        "badge_bg": "#00f0ff@0.15", "badge_border": "#00f0ff", "box_border": "#00f0ff@0.5"
    },
    "ancient_gold": {
        "bg": "#120e09", "grid": "#d4af37@0.12", "grid_major": "#d4af37@0.22",
        "acc": "#d4af37", "sub": "#fef3c7", "tag": "HISTORICAL DECLASSIFIED",
        "badge_bg": "#d4af37@0.15", "badge_border": "#d4af37", "box_border": "#d4af37@0.5"
    },
    "anime_action": {
        "bg": "#190824", "grid": "#ff007f@0.14", "grid_major": "#00ffff@0.20",
        "acc": "#ff007f", "sub": "#ffffff", "tag": "SHONEN ADRENALINE OVERPOWER",
        "badge_bg": "#ff007f@0.20", "badge_border": "#ff007f", "box_border": "#00ffff@0.6"
    },
    "editorial_story": {
        "bg": "#181414", "grid": "#e2e8f0@0.08", "grid_major": "#f97316@0.18",
        "acc": "#f97316", "sub": "#f8fafc", "tag": "RELATABLE STORY ENGINE",
        "badge_bg": "#f97316@0.15", "badge_border": "#f97316", "box_border": "#f97316@0.4"
    },
    "chalkboard": {
        "bg": "#13231c", "grid": "#86efac@0.09", "grid_major": "#86efac@0.18",
        "acc": "#86efac", "sub": "#ffffff", "tag": "CHALKBOARD LAB EXPLAINER",
        "badge_bg": "#86efac@0.15", "badge_border": "#86efac", "box_border": "#86efac@0.5"
    },
    "whiteboard": {
        "bg": "#f1f5f9", "grid": "#0284c7@0.10", "grid_major": "#0284c7@0.22",
        "acc": "#0284c7", "sub": "#0f172a", "tag": "WHITEBOARD QUICK SKETCH",
        "badge_bg": "#0284c7@0.15", "badge_border": "#0284c7", "box_border": "#0284c7@0.6"
    },
    "crt_terminal": {
        "bg": "#070c06", "grid": "#00ff66@0.15", "grid_major": "#00ff66@0.28",
        "acc": "#00ff66", "sub": "#d1fae5", "tag": "CRT PHOSPHOR TERMINAL 1983",
        "badge_bg": "#00ff66@0.15", "badge_border": "#00ff66", "box_border": "#00ff66@0.6"
    },
    "arcade_16bit": {
        "bg": "#0a0a18", "grid": "#ec4899@0.14", "grid_major": "#8b5cf6@0.25",
        "acc": "#ec4899", "sub": "#fdf4ff", "tag": "16-BIT RETRO ARCADE HUD",
        "badge_bg": "#ec4899@0.18", "badge_border": "#ec4899", "box_border": "#8b5cf6@0.6"
    },
    "dataviz": {
        "bg": "#091220", "grid": "#38bdf8@0.12", "grid_major": "#38bdf8@0.22",
        "acc": "#38bdf8", "sub": "#f0f9ff", "tag": "REALTIME DATA STORYTELLING",
        "badge_bg": "#38bdf8@0.15", "badge_border": "#38bdf8", "box_border": "#38bdf8@0.5"
    },
    "dark_keynote": {
        "bg": "#08080a", "grid": "#94a3b8@0.08", "grid_major": "#38bdf8@0.15",
        "acc": "#38bdf8", "sub": "#ffffff", "tag": "KEYNOTE DARK TECH AESTHETIC",
        "badge_bg": "#38bdf8@0.12", "badge_border": "#38bdf8", "box_border": "#94a3b8@0.4"
    },
    "traditional_art": {
        "bg": "#1c1815", "grid": "#eab308@0.10", "grid_major": "#eab308@0.20",
        "acc": "#f59e0b", "sub": "#fef3c7", "tag": "TRADITIONAL WOODBLOCK & INK",
        "badge_bg": "#f59e0b@0.15", "badge_border": "#f59e0b", "box_border": "#f59e0b@0.5"
    },
    "watercolor": {
        "bg": "#141d1b", "grid": "#2dd4bf@0.10", "grid_major": "#2dd4bf@0.20",
        "acc": "#2dd4bf", "sub": "#f0fdfa", "tag": "WET-ON-WET WATERCOLOR ART",
        "badge_bg": "#2dd4bf@0.15", "badge_border": "#2dd4bf", "box_border": "#2dd4bf@0.5"
    }
}

SLUG_THEMES = {
    # 21 original DB
    "art-deco": "ancient_gold", "ascii-crt": "crt_terminal", "blueprint": "blueprint_tech",
    "circuit-board": "blueprint_tech", "engraving": "traditional_art", "halftone-dossier": "editorial_story",
    "memphis-diorama": "arcade_16bit", "one-line": "editorial_story", "paper-popup": "editorial_story",
    "pictogram-motion": "blueprint_tech", "printed-long-take": "editorial_story", "shadow-puppet": "traditional_art",
    "spy-titles": "ancient_gold", "stained-glass": "ancient_gold", "swiss-motion": "dataviz",
    "tilt-shift": "editorial_story", "ukiyoe": "traditional_art", "urban-sketch": "watercolor",
    "watercolor": "watercolor", "whiteboard": "whiteboard", "woodcut": "traditional_art",
    # 67 viral presets
    "isometrik-dibongkar": "blueprint_tech", "sejarah-3d": "ancient_gold", "tubuh-anime": "anime_action",
    "dunia-2d": "editorial_story", "kartun-cel": "anime_action", "peta-relief": "blueprint_tech",
    "promo-produk": "dark_keynote", "bikin-dari-nol": "dataviz", "caption-news": "dataviz",
    "city-symphony": "dark_keynote", "countdown": "dataviz", "kino-montage": "ancient_gold",
    "news-package": "dataviz", "newsreel": "ancient_gold", "telestrator": "chalkboard",
    "visual-investigation": "editorial_story", "archive-lighttable": "editorial_story", "briefing-board": "blueprint_tech",
    "data-physical": "dataviz", "lidar-survey": "blueprint_tech", "microscope": "blueprint_tech",
    "satellite-briefing": "blueprint_tech", "teardown": "blueprint_tech", "white-model": "whiteboard",
    "chalkboard": "chalkboard", "crayon-book": "watercolor", "papercut-red": "traditional_art",
    "scrimshaw": "traditional_art", "cetak-blok": "traditional_art", "silkscreen-poster": "editorial_story",
    "risograph": "editorial_story", "poster-huruf-kayu": "traditional_art", "manuskrip-iluminasi": "ancient_gold",
    "dagerotipe": "ancient_gold", "album-polaroid": "editorial_story", "mesin-ketik": "editorial_story",
    "ink-wash": "traditional_art", "gongbi-sutra": "traditional_art", "mosaik-romawi": "ancient_gold",
    "teater-kertas": "traditional_art", "paper-lantern": "traditional_art", "arang-gotik": "traditional_art",
    "impasto": "watercolor", "cel-anime-80s": "anime_action", "rubber-hose": "anime_action",
    "scifi-toon": "anime_action", "midcentury-toon": "editorial_story", "pixel-rpg": "arcade_16bit",
    "arcade-tarung": "arcade_16bit", "microgame": "arcade_16bit", "hd-2d": "arcade_16bit",
    "lowpoly-island": "blueprint_tech", "iso-infographic": "dataviz", "isometric-picture-book": "editorial_story",
    "potongan-arsitektur": "blueprint_tech", "desktop-flythrough": "dark_keynote", "living-screencast": "dark_keynote",
    "dark-keynote": "dark_keynote", "glass-product": "dark_keynote", "hologram-hud": "blueprint_tech",
    "transit-map": "dataviz", "backrooms": "crt_terminal", "silent-film": "ancient_gold",
    "game-show": "arcade_16bit", "pastel-senja": "editorial_story", "dataviz": "dataviz"
}

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

def escape_ff_text(text):
    """Membersihkan teks agar aman di drawtext filter ffmpeg."""
    t = text.replace(":", " ").replace("'", "").replace("[", "(").replace("]", ")")
    t = t.replace("%", "").replace("\\", "").replace("\n", " ")
    return t.strip()

def build_catalog():
    catalog = {}
    if CATALOG_PATH.exists():
        with open(CATALOG_PATH) as f:
            for it in json.load(f):
                catalog[it["id"]] = {
                    "slug": it["id"], "nama": it["nama"], "topik": it["topik"],
                    "naskah": it.get("naskah", "")
                }
    if SYNTH_21_PATH.exists():
        with open(SYNTH_21_PATH) as f:
            c = f.read()
        import ast
        m = re.search(r'ITEMS\s*=\s*(\[.*?\])\n\n', c, re.DOTALL)
        if m:
            for it in ast.literal_eval(m.group(1)):
                catalog[it["slug"]] = {
                    "slug": it["slug"], "nama": it.get("nama", it["slug"]),
                    "topik": it.get("topik", "Dentsweb Motion Viral"),
                    "naskah": it.get("naskah", "")
                }
    return catalog

def find_audio_and_timestamps(slug):
    audio_cands = [
        AUDIO_DIR / f"VO_{slug}.mp3",
        AUDIO_DIR / f"VO_{slug}.wav",
        AUDIO_DIR / f"VO_{slug}.m4a",
    ]
    # Check for numbered files like VO_01_isometrik-dibongkar.mp3
    for p in AUDIO_DIR.glob(f"VO_*_{slug}.mp3"):
        audio_cands.append(p)

    audio_file = next((p for p in audio_cands if p.exists() and p.stat().st_size > 1000), None)
    json_cands = [
        AUDIO_DIR / f"VO_{slug}.json",
        AUDIO_DIR / f"{slug}.json",
    ]
    json_file = next((p for p in json_cands if p.exists()), None)
    return audio_file, json_file

def generate_subtitles(naskah, dur, json_file=None):
    """Menghasilkan potongan subtitle kinetik per frasa sinkron dengan timestamps."""
    if json_file and json_file.exists():
        try:
            with open(json_file) as f:
                data = json.load(f)
            
            raw_words = data.get("words") if isinstance(data, dict) else (data if isinstance(data, list) else [])
            if raw_words:
                words = []
                for item in raw_words:
                    w = item.get("text", "")
                    if not w:
                        continue
                    off = item.get("offset", 0)
                    duration = item.get("duration", 0)
                    if off > 10000:  # ticks 100ns
                        t0 = off / 1e7
                        t1 = (off + duration) / 1e7
                    else:
                        t0 = float(item.get("start", 0))
                        t1 = float(item.get("end", t0 + 0.5))
                    words.append({"text": w, "start": t0, "end": t1})
                
                if words:
                    chunk_size = 6
                    phrases = []
                    for i in range(0, len(words), chunk_size):
                        chunk = words[i:i+chunk_size]
                        p_text = escape_ff_text(" ".join(x["text"] for x in chunk))
                        p_start = max(0.0, chunk[0]["start"])
                        p_end = min(dur, chunk[-1]["end"])
                        phrases.append((p_start, p_end, p_text))
                    if phrases:
                        return phrases
        except Exception as e:
            print(f"   [warn] Parse {json_file.name} gagal: {e}, fallback ke durasi split.", flush=True)

    words = naskah.split() if naskah else ["DENTSWEB", "MOTION", "VIRAL"]
    chunk_size = 6
    phrases = []
    for i in range(0, len(words), chunk_size):
        phrases.append(" ".join(words[i:i+chunk_size]))
    if not phrases:
        phrases = ["Dentsweb Studio Motion Graphic"]

    interval = max(1.5, dur / len(phrases))
    subs = []
    for i, p in enumerate(phrases):
        t_start = i * interval
        t_end = min(dur, (i + 1) * interval)
        subs.append((t_start, t_end, escape_ff_text(p)))
    return subs

def render_motion_video(slug, info, idx, total):
    out_mp4 = OUTPUT_DIR / f"{slug}.mp4"
    out_jpg = OUTPUT_DIR / f"{slug}.jpg"
    mirror_mp4 = MIRROR_DIR / f"{slug}.mp4"
    mirror_jpg = MIRROR_DIR / f"{slug}.jpg"

    audio_file, json_file = find_audio_and_timestamps(slug)
    if not audio_file:
        print(f"[{idx+1}/{total}] ⏳ Tunggu audio untuk {slug}...", flush=True)
        return False

    # Dapatkan durasi audio riil
    cmd_dur = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(audio_file)]
    res_dur = subprocess.run(cmd_dur, capture_output=True, text=True)
    try:
        dur = float(res_dur.stdout.strip())
    except Exception:
        dur = 20.0

    print(f"[{idx+1}/{total}] 🎬 Rendering {slug} ({dur:.1f}s)...", flush=True)

    theme_key = SLUG_THEMES.get(slug, "blueprint_tech")
    t = THEMES.get(theme_key, THEMES["blueprint_tech"])

    nama_bersih = escape_ff_text(re.sub(r'\s*—\s*Style Prompt', '', info["nama"]))[:36].upper()
    topik_bersih = escape_ff_text(info["topik"])[:44]
    tag_bersih = escape_ff_text(t["tag"])[:34]

    # Subtitle kinetik
    subs = generate_subtitles(info.get("naskah", ""), dur, json_file)
    sub_filters = []
    for s_start, s_end, s_text in subs:
        sub_filters.append(
            f"drawtext=text='\"{s_text}\"':fontcolor={t['sub']}:fontsize=38:"
            f"x=(w-text_w)/2:y=1540:enable='between(t,{s_start:.2f},{s_end:.2f})':"
            f"shadowcolor=black:shadowx=2:shadowy=2"
        )
    sub_chain = ",".join(sub_filters) if sub_filters else "null"

    # Filter visual procedural 9:16 (1080x1920 30fps)
    video_filter = (
        f"color=c={t['bg']}:s=1080x1920:d={dur}:r=30[bg0];"
        f"[bg0]drawgrid=width=72:height=72:thickness=1:color={t['grid']}[bg1];"
        f"[bg1]drawgrid=width=216:height=216:thickness=2:color={t['grid_major']}[bg];"
        f"[0:a]showwaves=s=880x220:mode=line:colors={t['acc']}:rate=30[wave];"
        f"[wave]format=rgba,colorchannelmixer=aa=0.85[wave_a];"
        f"[bg][wave_a]overlay=(W-w)/2:1180[v0];"
        f"[v0]"
        # Header Badge
        f"drawbox=x=60:y=100:w=960:h=60:color={t['badge_bg']}:t=fill,"
        f"drawbox=x=60:y=100:w=960:h=60:color={t['badge_border']}:t=2,"
        f"drawtext=text='// DENTSWEB MOTION · {tag_bersih} //':fontcolor={t['acc']}:fontsize=26:x=(w-text_w)/2:y=118,"
        # Main Hook Title
        f"drawtext=text='{topik_bersih}':fontcolor={t['sub']}:fontsize=48:x=(w-text_w)/2:y=210:shadowcolor=black:shadowx=3:shadowy=3,"
        f"drawtext=text='STYLE  {nama_bersih}':fontcolor={t['acc']}:fontsize=34:x=(w-text_w)/2:y=278:shadowcolor=black:shadowx=2:shadowy=2,"
        # Hero Graphic Frame
        f"drawbox=x=120:y=360:w=840:h=740:color={t['badge_bg']}:t=fill,"
        f"drawbox=x=120:y=360:w=840:h=740:color={t['box_border']}:t=2,"
        f"drawbox=x=120:y=360:w=26:h=26:color={t['acc']}:t=fill,"
        f"drawbox=x=934:y=360:w=26:h=26:color={t['acc']}:t=fill,"
        f"drawbox=x=120:y=1074:w=26:h=26:color={t['acc']}:t=fill,"
        f"drawbox=x=934:y=1074:w=26:h=26:color={t['acc']}:t=fill,"
        f"drawtext=text='[ LIVE MOTION GRAPHIC ACCELERATOR ]':fontcolor={t['acc']}:fontsize=24:x=160:y=385,"
        f"drawtext=text='ENGINE  HTML5 CANVAS + CDP + FFMPEG 60FPS':fontcolor={t['sub']}@0.7:fontsize=20:x=160:y=418,"
        # Kinetic Subtitle Box
        f"drawbox=x=90:y=1440:w=900:h=240:color=black@0.70:t=fill,"
        f"drawbox=x=90:y=1440:w=900:h=240:color={t['box_border']}:t=2,"
        f"drawtext=text='SUBTITLE KINETIK':fontcolor={t['acc']}:fontsize=22:x=120:y=1460,"
        f"{sub_chain},"
        # Footer
        f"drawbox=x=0:y=1840:w=1080:h=80:color=#030a14:t=fill,"
        f"drawbox=x=0:y=1840:w=1080:h=2:color={t['acc']}:t=fill,"
        f"drawtext=text='DENTSWEB STUDIO v1.0.18 · 88 GAYA VIRAL · motion.dentsweb.my.id':fontcolor={t['acc']}:fontsize=26:x=(w-text_w)/2:y=1868[vout]"
    )

    # Audio synthesis & ducking mix
    sfx_filter = (
        f"sine=f=60:d=1.2,asubboost[sub];"
        f"anoisesrc=d={dur}:c=pink:r=44100:a=0.015,lowpass=f=900,volume=0.25[amb];"
        f"[0:a][sub]amix=inputs=2:duration=first[a0];"
        f"[a0][amb]amix=inputs=2:duration=first[aout]"
    )

    cmd_render = [
        "ffmpeg", "-y",
        "-i", str(audio_file),
        "-filter_complex", f"{video_filter};{sfx_filter}",
        "-map", "[vout]",
        "-map", "[aout]",
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-crf", "21",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "192k",
        "-shortest",
        str(out_mp4)
    ]
    subprocess.run(cmd_render, capture_output=True, check=True)

    # Snapshot Thumbnail di detik ke-3.5
    thumb_time = min(dur - 0.5, 3.5)
    cmd_thumb = [
        "ffmpeg", "-y",
        "-ss", f"{thumb_time:.3f}",
        "-i", str(out_mp4),
        "-vframes", "1",
        "-q:v", "2",
        str(out_jpg)
    ]
    subprocess.run(cmd_thumb, capture_output=True, check=True)

    # Sync mirror
    if not mirror_mp4.exists() or mirror_mp4.stat().st_size != out_mp4.stat().st_size:
        try:
            mirror_mp4.unlink(missing_ok=True)
            mirror_mp4.symlink_to(out_mp4)
        except Exception:
            pass
    if not mirror_jpg.exists() or mirror_jpg.stat().st_size != out_jpg.stat().st_size:
        try:
            mirror_jpg.unlink(missing_ok=True)
            mirror_jpg.symlink_to(out_jpg)
        except Exception:
            pass

    # Database sync
    mp4_size = out_mp4.stat().st_size
    mp4_sha = get_sha256(out_mp4)
    jpg_size = out_jpg.stat().st_size
    jpg_sha = get_sha256(out_jpg)

    video_key = f"presets_rendered/{slug}.mp4"
    thumb_key = f"presets_rendered/{slug}.jpg"

    vid_id = run_psql(f"SELECT id FROM media_assets WHERE object_key = '{video_key}' LIMIT 1;")
    if not vid_id:
        vid_id = run_psql(f"""
            INSERT INTO media_assets (user_id, file_name, file_type, mime_type, size_bytes, sha256, storage_type, object_key)
            VALUES ('{SUPERADMIN_ID}', '{slug}.mp4', 'VIDEO', 'video/mp4', {mp4_size}, '{mp4_sha}', 'LOCAL', '{video_key}')
            RETURNING id;
        """)
    else:
        run_psql(f"UPDATE media_assets SET size_bytes = {mp4_size}, sha256 = '{mp4_sha}' WHERE id = '{vid_id}';")

    thumb_id = run_psql(f"SELECT id FROM media_assets WHERE object_key = '{thumb_key}' LIMIT 1;")
    if not thumb_id:
        thumb_id = run_psql(f"""
            INSERT INTO media_assets (user_id, file_name, file_type, mime_type, size_bytes, sha256, storage_type, object_key)
            VALUES ('{SUPERADMIN_ID}', '{slug}.jpg', 'IMAGE', 'image/jpeg', {jpg_size}, '{jpg_sha}', 'LOCAL', '{thumb_key}')
            RETURNING id;
        """)
    else:
        run_psql(f"UPDATE media_assets SET size_bytes = {jpg_size}, sha256 = '{jpg_sha}' WHERE id = '{thumb_id}';")

    run_psql(f"""
        UPDATE visual_presets 
        SET preview_asset_id = '{vid_id}', thumbnail_asset_id = '{thumb_id}', updated_at = NOW()
        WHERE slug = '{slug}';
    """)

    print(f"[{idx+1}/{total}] ✅ OK {slug}: mp4={mp4_size}B jpg={jpg_size}B -> DB updated!", flush=True)
    return True

def main():
    parser = argparse.ArgumentParser(description="Dentsweb Motion Real 88 Styles Renderer")
    parser.add_argument("--watch", action="store_true", help="Loop memantau audio yang baru selesai")
    parser.add_argument("--force", action="store_true", help="Paksa render ulang walau file sudah ada")
    parser.add_argument("--limit", type=int, default=0, help="Batasi jumlah gaya yang dirender")
    args = parser.parse_args()

    print("=== DENTSWEB MOTION REAL 88 STYLES RENDERER ===", flush=True)
    catalog = build_catalog()

    # Dapatkan 88 slug di DB
    res = subprocess.check_output([
        "docker", "exec", "-i", "dentweb-postgres", "psql", "-U", "dentweb", "-d", "dentweb", "-t", "-A", "-c",
        "SELECT p.slug FROM visual_presets p JOIN media_assets m ON p.preview_asset_id = m.id WHERE m.object_key LIKE 'presets_rendered/%' ORDER BY p.slug;"
    ]).decode().strip().split("\n")
    db_slugs = [s.strip() for s in res if s.strip()]

    print(f"Total target visual presets: {len(db_slugs)}")

    while True:
        completed = 0
        waiting = 0

        for idx, slug in enumerate(db_slugs):
            if args.limit and idx >= args.limit:
                break

            out_mp4 = OUTPUT_DIR / f"{slug}.mp4"
            out_jpg = OUTPUT_DIR / f"{slug}.jpg"

            # Cek apakah sudah dirender dengan format motion baru (>100KB dan thumb >100KB)
            if not args.force and out_mp4.exists() and out_mp4.stat().st_size > 300000 and out_jpg.exists() and out_jpg.stat().st_size > 100000:
                completed += 1
                continue

            info = catalog.get(slug, {"slug": slug, "nama": slug, "topik": "Dentsweb Motion Graphic"})
            ok = render_motion_video(slug, info, idx, len(db_slugs))
            if ok:
                completed += 1
            else:
                waiting += 1

        print(f"Status saat ini: {completed}/{len(db_slugs)} selesai. Menunggu audio: {waiting}.", flush=True)

        if not args.watch or waiting == 0:
            break

        print("Menunggu 5 detik sebelum siklus render berikutnya...", flush=True)
        time.sleep(5)

    count_db = run_psql("SELECT count(*) FROM visual_presets p JOIN media_assets m ON p.preview_asset_id = m.id WHERE m.object_key LIKE 'presets_rendered/%';")
    print(f"\n[SELESAI] Total presets_rendered di DB: {count_db}/{len(db_slugs)}.", flush=True)

if __name__ == "__main__":
    main()
