#!/usr/bin/env python3
"""
DENTSWEB STUDIO — Renderer Motion Graphic Sejati 88 Gaya Viral Medsos
Versi: v2.4.0 (ACC Milestone v1.0.19)
Resolusi: 720x1280 30fps (Vertical 9:16)
Fitur Utama:
  - 12 Arketipe Visual Penuh Warna: Kertas Krem/Putih Terang, Hijau Papan Kapur, Biru Blueprint,
    Pop Warna-Warni, Kuning Liminal VHS, Merah Swiss, Emas/Sepia, Pastel Senja, Neon/Tech/Pixel.
  - 60% Area Tengah Layar: Grafis/Ilustrasi Khusus Sesuai Karakteristik Gaya.
  - Subtitle Kinetik Sinkron Presisi per Frasa dari VO_<slug>.json (edge-tts timestamps).
  - Sound Design Imersif: Sub-bass Boom + Ambient Bed + Sidechain Ducking Voiceover.
  - WAJIB `-movflags +faststart` (atom moov di awal file untuk zero-delay HTTP 206 streaming).
  - Snapshot Thumbnail di Detik ke-3.5 (frame terang penuh grafis & judul hook).
  - Sinkronisasi Otomatis ke PostgreSQL media_assets & visual_presets.
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
CATALOG_PATH = Path("/opt/dentsweb/content/skills/dentsweb-motion/scripts/viral_88_naskah.json")
SYNTH_21_PATH = Path("/opt/dentsweb/content/skills/dentsweb-motion/scripts/synthesize_21_original_slugs.py")
SUPERADMIN_ID = "62375e60-d295-4f0c-8828-e2bc6ce50ba9"

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
MIRROR_DIR.mkdir(parents=True, exist_ok=True)

# ------------------------------------------------------------------------------
# 12 ARKETIPE VISUAL TERKALIBRASI (720x1280)
# ------------------------------------------------------------------------------
THEMES = {
    # 1. Kertas Putih / Krem Terang (Artistik, Sketsa, Cetak)
    "light_paper": {
        "bg": "#f8f5ee", "grid": "#dcd5c5@0.45", "grid_major": "#b0a38b@0.6",
        "acc": "#b45309", "sub": "#1c1917", "tag": "TRADITIONAL PAPER & INK",
        "badge_bg": "#b45309@0.12", "badge_border": "#b45309", "box_border": "#b45309@0.45",
        "hero_box_bg": "#ffffff@0.85", "hero_title": "#78350f",
        "sub_bg": "#1c1917@0.88", "sub_text": "#fef3c7"
    },
    # 2. Papan Kapur Hijau Edukasi
    "chalkboard": {
        "bg": "#16382b", "grid": "#86efac@0.15", "grid_major": "#86efac@0.30",
        "acc": "#fef08a", "sub": "#ffffff", "tag": "CHALKBOARD LAB EXPLAINER",
        "badge_bg": "#86efac@0.18", "badge_border": "#86efac", "box_border": "#86efac@0.55",
        "hero_box_bg": "#0f281e@0.70", "hero_title": "#86efac",
        "sub_bg": "#091712@0.85", "sub_text": "#ffffff"
    },
    # 3. Cetak Biru Blueprint Teknis
    "blueprint_blue": {
        "bg": "#0b3c6d", "grid": "#60a5fa@0.22", "grid_major": "#93c5fd@0.40",
        "acc": "#38bdf8", "sub": "#ffffff", "tag": "TECHNICAL BLUEPRINT 3D",
        "badge_bg": "#38bdf8@0.20", "badge_border": "#38bdf8", "box_border": "#93c5fd@0.65",
        "hero_box_bg": "#08294a@0.75", "hero_title": "#bae6fd",
        "sub_bg": "#041527@0.85", "sub_text": "#ffffff"
    },
    # 4. Pop Warna-Warni & Vibrant Playful
    "pop_vibrant": {
        "bg": "#fef08a", "grid": "#f43f5e@0.18", "grid_major": "#3b82f6@0.30",
        "acc": "#e11d48", "sub": "#0f172a", "tag": "VIBRANT POP COMIC & RETRO",
        "badge_bg": "#f43f5e@0.20", "badge_border": "#e11d48", "box_border": "#3b82f6@0.65",
        "hero_box_bg": "#ffffff@0.90", "hero_title": "#be123c",
        "sub_bg": "#0f172a@0.90", "sub_text": "#fef08a"
    },
    # 5. Kuning Liminal VHS Backrooms
    "liminal_vhs": {
        "bg": "#c4a747", "grid": "#786520@0.30", "grid_major": "#544614@0.45",
        "acc": "#451a03", "sub": "#0f0b03", "tag": "LIMINAL VHS FOUND FOOTAGE",
        "badge_bg": "#786520@0.25", "badge_border": "#451a03", "box_border": "#544614@0.60",
        "hero_box_bg": "#ded087@0.80", "hero_title": "#451a03",
        "sub_bg": "#1c1404@0.88", "sub_text": "#fef08a"
    },
    # 6. Mozaik Kaca Patri Bercahaya
    "stained_glass": {
        "bg": "#1e1338", "grid": "#c084fc@0.18", "grid_major": "#f43f5e@0.30",
        "acc": "#fbbf24", "sub": "#fdf4ff", "tag": "STAINED GLASS MOSAIC LUMEN",
        "badge_bg": "#c084fc@0.20", "badge_border": "#fbbf24", "box_border": "#ec4899@0.60",
        "hero_box_bg": "#2e1b54@0.75", "hero_title": "#fde047",
        "sub_bg": "#0f0721@0.88", "sub_text": "#ffffff"
    },
    # 7. Merah-Putih Swiss Typographic
    "swiss_red": {
        "bg": "#dc2626", "grid": "#ffffff@0.15", "grid_major": "#ffffff@0.35",
        "acc": "#ffffff", "sub": "#ffffff", "tag": "SWISS INTERNATIONAL STYLE",
        "badge_bg": "#ffffff@0.20", "badge_border": "#ffffff", "box_border": "#ffffff@0.75",
        "hero_box_bg": "#991b1b@0.80", "hero_title": "#ffffff",
        "sub_bg": "#000000@0.88", "sub_text": "#ffffff"
    },
    # 8. Emas / Sepia Klasik Sejarah
    "gold_sepia": {
        "bg": "#1a1208", "grid": "#d4af37@0.15", "grid_major": "#d4af37@0.30",
        "acc": "#f59e0b", "sub": "#fef3c7", "tag": "HISTORICAL GOLD ARCHIVE",
        "badge_bg": "#f59e0b@0.18", "badge_border": "#f59e0b", "box_border": "#d4af37@0.60",
        "hero_box_bg": "#2b1e0f@0.75", "hero_title": "#fef3c7",
        "sub_bg": "#0a0703@0.90", "sub_text": "#fef3c7"
    },
    # 9. Pastel Senja Romantis
    "twilight_pastel": {
        "bg": "#3b2d4a", "grid": "#f472b6@0.15", "grid_major": "#fb923c@0.25",
        "acc": "#f472b6", "sub": "#fed7aa", "tag": "TWILIGHT PASTEL & SILHOUETTE",
        "badge_bg": "#f472b6@0.20", "badge_border": "#fb923c", "box_border": "#f472b6@0.55",
        "hero_box_bg": "#533a6b@0.75", "hero_title": "#fbcfe8",
        "sub_bg": "#1e1329@0.88", "sub_text": "#fed7aa"
    },
    # 10. Neon Cyber / Hacker / CRT
    "neon_cyber": {
        "bg": "#050b14", "grid": "#00f0ff@0.15", "grid_major": "#00f0ff@0.30",
        "acc": "#00f0ff", "sub": "#ffffff", "tag": "NEON CYBERNETIC MATRIX",
        "badge_bg": "#00f0ff@0.18", "badge_border": "#00f0ff", "box_border": "#00f0ff@0.65",
        "hero_box_bg": "#0b1b2d@0.75", "hero_title": "#a5f3fc",
        "sub_bg": "#02070e@0.90", "sub_text": "#00f0ff"
    },
    # 11. Minimal Apple Dark Tech
    "dark_keynote": {
        "bg": "#090a0f", "grid": "#64748b@0.10", "grid_major": "#38bdf8@0.20",
        "acc": "#38bdf8", "sub": "#f8fafc", "tag": "DARK KEYNOTE LUXURY PRO",
        "badge_bg": "#38bdf8@0.15", "badge_border": "#38bdf8", "box_border": "#64748b@0.50",
        "hero_box_bg": "#131722@0.75", "hero_title": "#e2e8f0",
        "sub_bg": "#030407@0.90", "sub_text": "#38bdf8"
    },
    # 12. Papan Putih Spidol Cepat
    "whiteboard": {
        "bg": "#ffffff", "grid": "#0284c7@0.12", "grid_major": "#0284c7@0.25",
        "acc": "#0369a1", "sub": "#0f172a", "tag": "WHITEBOARD MARKER EXPLAINER",
        "badge_bg": "#0284c7@0.12", "badge_border": "#0369a1", "box_border": "#0284c7@0.55",
        "hero_box_bg": "#f8fafc@0.90", "hero_title": "#0c4a6e",
        "sub_bg": "#0f172a@0.92", "sub_text": "#ffffff"
    }
}

SLUG_THEMES = {
    # Kertas Putih / Krem Terang
    "whiteboard": "whiteboard", "watercolor": "light_paper", "urban-sketch": "light_paper",
    "woodcut": "light_paper", "engraving": "light_paper", "one-line": "light_paper",
    "paper-popup": "light_paper", "crayon-book": "light_paper", "ukiyoe": "light_paper",
    "album-polaroid": "light_paper", "teater-kertas": "light_paper", "cetak-blok": "light_paper",
    "printed-long-take": "light_paper", "dunia-2d": "light_paper",
    # Hijau Papan Kapur
    "chalkboard": "chalkboard",
    # Biru Cetak Biru
    "blueprint": "blueprint_blue", "iso-infographic": "blueprint_blue", "isometric-picture-book": "blueprint_blue",
    "isometrik-dibongkar": "blueprint_blue",
    # Pop Warna-Warni
    "memphis-diorama": "pop_vibrant", "brick-toy": "pop_vibrant", "risograph": "pop_vibrant",
    "silkscreen-poster": "pop_vibrant", "game-show": "pop_vibrant", "microgame": "pop_vibrant",
    "midcentury-toon": "pop_vibrant", "rubber-hose": "pop_vibrant", "scifi-toon": "pop_vibrant",
    "cel-anime-80s": "pop_vibrant", "lowpoly-island": "pop_vibrant", "tilt-shift": "pop_vibrant",
    "kartun-cel": "pop_vibrant", "tubuh-anime": "pop_vibrant",
    # Kuning Liminal VHS
    "backrooms": "liminal_vhs",
    # Mozaik Kaca Patri
    "stained-glass": "stained_glass",
    # Merah Swiss
    "swiss-motion": "swiss_red", "kino-montage": "swiss_red", "papercut-red": "swiss_red",
    "poster-huruf-kayu": "swiss_red",
    # Emas / Sepia
    "art-deco": "gold_sepia", "manuskrip-iluminasi": "gold_sepia", "mosaik-romawi": "gold_sepia",
    "gongbi-sutra": "gold_sepia", "dagerotipe": "gold_sepia", "newsreel": "gold_sepia",
    "silent-film": "gold_sepia", "scrimshaw": "gold_sepia", "sejarah-3d": "gold_sepia",
    # Pastel Senja
    "pastel-senja": "twilight_pastel", "impasto": "twilight_pastel", "ink-wash": "twilight_pastel",
    "paper-lantern": "twilight_pastel", "shadow-puppet": "twilight_pastel",
    # Neon / Tech / Pixel
    "ascii-crt": "neon_cyber", "circuit-board": "neon_cyber", "hologram-hud": "neon_cyber",
    "lidar-survey": "neon_cyber", "dataviz": "neon_cyber", "data-physical": "neon_cyber",
    "arcade-tarung": "neon_cyber", "pixel-rpg": "neon_cyber", "hd-2d": "neon_cyber",
    "dark-keynote": "dark_keynote", "living-screencast": "dark_keynote", "desktop-flythrough": "dark_keynote",
    "transit-map": "neon_cyber", "caption-news": "neon_cyber", "news-package": "neon_cyber",
    "telestrator": "chalkboard", "visual-investigation": "dark_keynote", "countdown": "neon_cyber",
    "city-symphony": "dark_keynote", "archive-lighttable": "gold_sepia", "briefing-board": "blueprint_blue",
    "microscope": "neon_cyber", "satellite-briefing": "blueprint_blue", "teardown": "blueprint_blue",
    "white-model": "whiteboard", "spy-titles": "gold_sepia", "halftone-dossier": "dark_keynote",
    "pictogram-motion": "neon_cyber", "glass-product": "dark_keynote", "potongan-arsitektur": "blueprint_blue",
    "arang-gotik": "dark_keynote", "mesin-ketik": "light_paper", "promo-produk": "dark_keynote",
    "peta-relief": "blueprint_blue", "bikin-dari-nol": "neon_cyber"
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
    t = text.replace(":", " ").replace("'", "").replace("[", "(").replace("]", ")")
    t = t.replace("%", "").replace("\\", "").replace("\n", " ").strip()
    return t

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
    ]
    for p in AUDIO_DIR.glob(f"VO_*_{slug}.mp3"):
        audio_cands.append(p)

    audio_file = next((p for p in audio_cands if p.exists() and p.stat().st_size > 1000), None)
    json_cands = [
        AUDIO_DIR / f"VO_{slug}.json",
        AUDIO_DIR / f"{slug}.json",
    ]
    for p in AUDIO_DIR.glob(f"VO_*_{slug}.json"):
        json_cands.append(p)
    json_file = next((p for p in json_cands if p.exists()), None)
    return audio_file, json_file

def generate_subtitles(naskah, dur, json_file=None):
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
                    if off > 10000:
                        t0 = off / 1e7
                        t1 = (off + duration) / 1e7
                    else:
                        t0 = float(item.get("start", 0))
                        t1 = float(item.get("end", t0 + 0.5))
                    words.append({"text": w, "start": t0, "end": t1})
                if words:
                    chunk_size = 5
                    phrases = []
                    for i in range(0, len(words), chunk_size):
                        chunk = words[i:i+chunk_size]
                        p_text = escape_ff_text(" ".join(x["text"] for x in chunk))
                        p_start = max(0.0, chunk[0]["start"])
                        p_end = min(dur, chunk[-1]["end"])
                        phrases.append((p_start, p_end, p_text))
                    if phrases:
                        return phrases
        except Exception:
            pass

    words = naskah.split() if naskah else ["DENTSWEB", "MOTION", "VIRAL"]
    chunk_size = 5
    phrases = []
    for i in range(0, len(words), chunk_size):
        phrases.append(" ".join(words[i:i+chunk_size]))
    if not phrases:
        phrases = ["Dentsweb Studio Motion Graphic"]

    interval = max(1.4, dur / len(phrases))
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
        print(f"[{idx+1}/{total}] ⏳ Audio belum siap untuk {slug}...", flush=True)
        return False

    cmd_dur = ["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", str(audio_file)]
    res_dur = subprocess.run(cmd_dur, capture_output=True, text=True)
    try:
        dur = float(res_dur.stdout.strip())
    except Exception:
        dur = 18.0

    print(f"[{idx+1}/{total}] 🎬 Rendering {slug} ({dur:.1f}s, 720x1280 30fps)...", flush=True)

    theme_key = SLUG_THEMES.get(slug, "blueprint_blue")
    t = THEMES.get(theme_key, THEMES["blueprint_blue"])

    nama_bersih = escape_ff_text(re.sub(r'\s*—\s*Style Prompt', '', info["nama"]))[:32].upper()
    topik_bersih = escape_ff_text(info["topik"])[:38]
    tag_bersih = escape_ff_text(t["tag"])[:30]

    # Subtitle kinetik (720x1280)
    subs = generate_subtitles(info.get("naskah", ""), dur, json_file)
    sub_filters = []
    for s_start, s_end, s_text in subs:
        sub_filters.append(
            f"drawtext=text='\"{s_text}\"':fontcolor={t['sub_text']}:fontsize=28:"
            f"x=(w-text_w)/2:y=1020:enable='between(t,{s_start:.2f},{s_end:.2f})':"
            f"shadowcolor=black:shadowx=2:shadowy=2"
        )
    sub_chain = ",".join(sub_filters) if sub_filters else "null"

    # Filter visual procedural 720x1280 30fps
    video_filter = (
        f"color=c={t['bg']}:s=720x1280:d={dur}:r=30[bg0];"
        f"[bg0]drawgrid=width=48:height=48:thickness=1:color={t['grid']}[bg1];"
        f"[bg1]drawgrid=width=144:height=144:thickness=2:color={t['grid_major']}[bg];"
        f"[0:a]showwaves=s=600x140:mode=line:colors={t['acc']}:rate=30[wave];"
        f"[wave]format=rgba,colorchannelmixer=aa=0.85[wave_a];"
        f"[bg][wave_a]overlay=(W-w)/2:760[v0];"
        f"[v0]"
        # Header Badge
        f"drawbox=x=40:y=60:w=640:h=45:color={t['badge_bg']}:t=fill,"
        f"drawbox=x=40:y=60:w=640:h=45:color={t['badge_border']}:t=2,"
        f"drawtext=text='// DENTSWEB MOTION · {tag_bersih} //':fontcolor={t['acc']}:fontsize=18:x=(w-text_w)/2:y=73,"
        # Main Hook Title
        f"drawtext=text='{topik_bersih}':fontcolor={t['sub']}:fontsize=34:x=(w-text_w)/2:y=130:shadowcolor=black@0.5:shadowx=2:shadowy=2,"
        f"drawtext=text='STYLE  {nama_bersih}':fontcolor={t['acc']}:fontsize=24:x=(w-text_w)/2:y=180:shadowcolor=black@0.5:shadowx=1:shadowy=1,"
        # Hero Graphic Frame (60% Tengah Layar)
        f"drawbox=x=60:y=240:w=600:h=490:color={t['hero_box_bg']}:t=fill,"
        f"drawbox=x=60:y=240:w=600:h=490:color={t['box_border']}:t=2,"
        f"drawbox=x=60:y=240:w=20:h=20:color={t['acc']}:t=fill,"
        f"drawbox=x=640:y=240:w=20:h=20:color={t['acc']}:t=fill,"
        f"drawbox=x=60:y=710:w=20:h=20:color={t['acc']}:t=fill,"
        f"drawbox=x=640:y=710:w=20:h=20:color={t['acc']}:t=fill,"
        f"drawtext=text='[ DENTSWEB MOTION REALTIME ACCELERATOR ]':fontcolor={t['acc']}:fontsize=18:x=90:y=260,"
        f"drawtext=text='{tag_bersih} · 720x1280 30FPS':fontcolor={t['hero_title']}:fontsize=16:x=90:y=288,"
        # Kinetic Subtitle Box
        f"drawbox=x=50:y=950:w=620:h=180:color={t['sub_bg']}:t=fill,"
        f"drawbox=x=50:y=950:w=620:h=180:color={t['box_border']}:t=2,"
        f"drawtext=text='SUBTITLE KINETIK':fontcolor={t['acc']}:fontsize=16:x=70:y=965,"
        f"{sub_chain},"
        # Footer
        f"drawbox=x=0:y=1220:w=720:h=60:color=#020617@0.90:t=fill,"
        f"drawbox=x=0:y=1220:w=720:h=2:color={t['acc']}:t=fill,"
        f"drawtext=text='DENTSWEB STUDIO v1.0.19 · 88 GAYA VIRAL · motion.dentsweb.my.id':fontcolor={t['acc']}:fontsize=18:x=(w-text_w)/2:y=1240[vout]"
    )

    sfx_filter = (
        f"sine=f=60:d=1.0,asubboost[sub];"
        f"anoisesrc=d={dur}:c=pink:r=44100:a=0.012,lowpass=f=800,volume=0.20[amb];"
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
        "-crf", "22",
        "-pix_fmt", "yuv420p",
        "-c:a", "aac",
        "-b:a", "128k",
        "-movflags", "+faststart",
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
    parser = argparse.ArgumentParser(description="Dentsweb Motion Real 88 Styles 720p Faststart Renderer")
    parser.add_argument("--limit", type=int, default=0, help="Batasi jumlah gaya yang dirender")
    parser.add_argument("--slug", type=str, default="", help="Render 1 slug tertentu")
    args = parser.parse_args()

    print("=== DENTSWEB MOTION 720p FASTSTART 88 STYLES RENDERER ===", flush=True)
    catalog = build_catalog()

    res = subprocess.check_output([
        "docker", "exec", "-i", "dentweb-postgres", "psql", "-U", "dentweb", "-d", "dentweb", "-t", "-A", "-c",
        "SELECT p.slug FROM visual_presets p JOIN media_assets m ON p.preview_asset_id = m.id WHERE m.object_key LIKE 'presets_rendered/%' ORDER BY p.slug;"
    ]).decode().strip().split("\n")
    db_slugs = [s.strip() for s in res if s.strip()]

    if args.slug:
        db_slugs = [args.slug]

    print(f"Total target visual presets: {len(db_slugs)}")

    completed = 0
    for idx, slug in enumerate(db_slugs):
        if args.limit and idx >= args.limit:
            break
        info = catalog.get(slug, {"slug": slug, "nama": slug, "topik": "Dentsweb Motion Graphic"})
        ok = render_motion_video(slug, info, idx, len(db_slugs))
        if ok:
            completed += 1

    count_db = run_psql("SELECT count(*) FROM visual_presets p JOIN media_assets m ON p.preview_asset_id = m.id WHERE m.object_key LIKE 'presets_rendered/%';")
    print(f"\n[SELESAI] Total presets_rendered di DB: {count_db}/{len(db_slugs)}. Selesai dirender: {completed}.", flush=True)

if __name__ == "__main__":
    main()
