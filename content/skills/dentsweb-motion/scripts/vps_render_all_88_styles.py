import os
import sys
import json
import subprocess
import pathlib
import time

AUDIO_DIR = "/opt/dentsweb/content/skills/dentsweb-motion/assets/audio"
OUTPUT_DIR = "/opt/dentsweb/apps/api/.data/storage/objects/media/presets_rendered"
CATALOG_PATH = "/opt/dentsweb/content/skills/dentsweb-motion/scripts/viral_88_naskah.json"

os.makedirs(OUTPUT_DIR, exist_ok=True)

with open(CATALOG_PATH, "r") as f:
    catalog = json.load(f)

PALETTES = [
    {"bg": "#0a1128", "acc": "#00f0ff", "sub": "#ffffff"},
    {"bg": "#1a120b", "acc": "#d4af37", "sub": "#f8f1e5"},
    {"bg": "#18002e", "acc": "#ff007f", "sub": "#00ffff"},
    {"bg": "#051622", "acc": "#1ba098", "sub": "#deb992"},
    {"bg": "#0d1117", "acc": "#58a6ff", "sub": "#f0f6fc"},
    {"bg": "#171717", "acc": "#fffa65", "sub": "#ffffff"},
    {"bg": "#002b36", "acc": "#268bd2", "sub": "#93a1a1"},
    {"bg": "#2e1a47", "acc": "#f39c12", "sub": "#ecf0f1"},
]

def render_style_video(item, idx):
    slug = item["id"]
    title = item["nama"]
    out_mp4 = f"{OUTPUT_DIR}/{slug}.mp4"
    out_jpg = f"{OUTPUT_DIR}/{slug}.jpg"

    if os.path.exists(out_mp4) and os.path.getsize(out_mp4) > 100000 and os.path.exists(out_jpg):
        return True

    audio_path = f"{AUDIO_DIR}/VO_{slug}.mp3"
    if not os.path.exists(audio_path):
        audio_path = f"{AUDIO_DIR}/VO_{item['num']:02d}_{slug}.mp3"
    if not os.path.exists(audio_path):
        audio_path = f"/tmp/motion_workspace/audio_{slug}.mp3"

    if not os.path.exists(audio_path):
        return False

    cmd_dur = [
        "ffprobe", "-v", "error", "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1", audio_path
    ]
    res_dur = subprocess.run(cmd_dur, capture_output=True, text=True)
    try:
        dur = float(res_dur.stdout.strip())
    except:
        dur = 15.0

    pal = PALETTES[idx % len(PALETTES)]
    clean_title = title.replace("'", "").replace(":", "-").replace("[", "(").replace("]", ")")[:35].upper()

    print(f"[{idx+1}/88] [RENDER] {slug} ({dur:.1f}s)...", flush=True)

    sfx_filter = f"anoisesrc=d={dur}:c=pink:r=44100:a=0.03,lowpass=f=800,volume=0.3[sfx];[0:a][sfx]amix=inputs=2:duration=first[aout]"
    video_filter = (
        f"color=c={pal['bg']}:s=1080x1920:d={dur}:r=60[bg];"
        f"[0:a]showwaves=s=920x340:mode=line:colors={pal['acc']}:rate=60[wave];"
        f"[bg][wave]overlay=(W-w)/2:(H-h)/2+200[v1];"
        f"[v1]drawtext=text='DENTSWEB MOTION':fontcolor={pal['acc']}:fontsize=44:x=(w-text_w)/2:y=180,"
        f"drawtext=text='{clean_title}':fontcolor={pal['sub']}:fontsize=54:x=(w-text_w)/2:y=280:shadowcolor=black:shadowx=2:shadowy=2,"
        f"drawtext=text='GAYA VISUAL RESMI VIRAL':fontcolor={pal['acc']}:fontsize=32:x=(w-text_w)/2:y=380,"
        f"drawtext=text='VO: Kokoro Neural Engine + SFX':fontcolor={pal['sub']}:fontsize=30:x=(w-text_w)/2:y=h-220,"
        f"drawtext=text='motion.dentsweb.my.id':fontcolor={pal['acc']}:fontsize=36:x=(w-text_w)/2:y=h-140[vout]"
    )

    cmd_render = [
        "ffmpeg", "-y",
        "-i", audio_path,
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
        out_mp4
    ]

    res = subprocess.run(cmd_render, capture_output=True, text=True)
    if res.returncode != 0:
        print(f"Error {slug}: {res.stderr[:200]}", flush=True)
        return False

    cmd_thumb = [
        "ffmpeg", "-y",
        "-ss", "00:00:01.500",
        "-i", out_mp4,
        "-vframes", "1",
        "-q:v", "2",
        out_jpg
    ]
    subprocess.run(cmd_thumb, capture_output=True)
    print(f"[{idx+1}/88] [OK] {slug}.mp4 ({os.path.getsize(out_mp4)} bytes)", flush=True)
    return True

def main():
    print("Memulai orchestrator render 88 gaya DENTSWEB MOTION...", flush=True)
    consecutive_no_progress = 0
    while True:
        done = 0
        waiting = 0
        newly_rendered = 0
        for idx, item in enumerate(catalog):
            slug = item["id"]
            out_mp4 = f"{OUTPUT_DIR}/{slug}.mp4"
            out_jpg = f"{OUTPUT_DIR}/{slug}.jpg"
            if os.path.exists(out_mp4) and os.path.getsize(out_mp4) > 100000 and os.path.exists(out_jpg):
                done += 1
                continue
            ok = render_style_video(item, idx)
            if ok:
                done += 1
                newly_rendered += 1
            else:
                waiting += 1
        print(f"Progres saat ini: {done}/88 video telah siap di storage VPS. (Menunggu audio: {waiting})", flush=True)
        if done >= len(catalog):
            print("Semua 88 video DENTSWEB MOTION selesai dirender 100%!", flush=True)
            break
        if newly_rendered == 0:
            consecutive_no_progress += 1
            time.sleep(10)
        else:
            consecutive_no_progress = 0
            time.sleep(2)

if __name__ == "__main__":
    main()
