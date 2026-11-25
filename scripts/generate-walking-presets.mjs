import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const OUT_DIR = '/Users/m.aksaarsyad/Downloads/DENTSWEB STUDIO/dentweb-studio/.temp-walking-presets';
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const PRESETS = [
  { slug: 'kartun-flat', name: 'Kartun Flat', sub: 'Langkah Pertama' },
  { slug: 'papan-sains', name: 'Papan Sains', sub: 'Evolusi Gerak' },
  { slug: 'sinematik', name: 'Sinematik', sub: 'Menembus Batas' },
  { slug: 'clay', name: 'Clay Stop-Motion', sub: 'Bentuk Nyata' },
  { slug: 'retro', name: 'Retro Neon Synthwave', sub: 'Ke Masa Depan' },
  { slug: 'cat-air', name: 'Cat Air Artistik', sub: 'Sentuhan Alami' },
  { slug: 'pixel', name: 'Pixel 8-bit Arkade', sub: 'Level 01: Walk' },
  { slug: 'komik', name: 'Panel Komik Strip', sub: 'Aksi Nyata!' },
  { slug: 'stickman', name: 'Stickman Relatable', sub: 'Santai Melangkah' },
  { slug: 'lowpoly', name: 'Low-poly 3D Geometri', sub: 'Dimensi Baru' },
];

function getHtml(preset) {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { width: 540px; height: 960px; overflow: hidden; background: #000; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
  canvas { display: block; width: 540px; height: 960px; }
</style>
</head>
<body>
<canvas id="c" width="540" height="960"></canvas>
<script>
const canvas = document.getElementById('c');
const ctx = canvas.getContext('2d');
const W = 540, H = 960;
const SLUG = '${preset.slug}';
const NAME = '${preset.name}';
const SUB = '${preset.sub}';

window.drawFrame = function(frame, totalFrames) {
  const t = (frame % totalFrames) / totalFrames; // 0..1
  const cycle = (t * 2 * Math.PI) * 2; // 2 full walk cycles
  ctx.clearRect(0, 0, W, H);

  // Common walk cycle math
  const hipY = 560 + Math.abs(Math.sin(cycle * 2)) * -14;
  const legSwingL = Math.sin(cycle) * 38;
  const legSwingR = Math.sin(cycle + Math.PI) * 38;
  const armSwingL = Math.sin(cycle + Math.PI) * 34;
  const armSwingR = Math.sin(cycle) * 34;
  const headBob = Math.abs(Math.sin(cycle * 2)) * -6;

  if (SLUG === 'kartun-flat') {
    // 1. KARTUN FLAT
    // Sky
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0F1B33');
    bgGrad.addColorStop(1, '#1A2F5A');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, H);

    // Floating cartoon clouds
    ctx.fillStyle = '#213B70';
    [100, 240, 420].forEach((cx, idx) => {
      const off = (t * 60 + idx * 180) % 640 - 50;
      ctx.beginPath();
      ctx.arc(off, 180 + idx * 80, 45, 0, Math.PI * 2);
      ctx.arc(off + 40, 170 + idx * 80, 55, 0, Math.PI * 2);
      ctx.arc(off + 80, 180 + idx * 80, 40, 0, Math.PI * 2);
      ctx.fill();
    });

    // Sun / Moon badge
    ctx.fillStyle = '#FFC93C';
    ctx.beginPath();
    ctx.arc(430, 150, 48, 0, Math.PI * 2);
    ctx.fill();

    // Hills
    ctx.fillStyle = '#1D7A6E';
    ctx.beginPath();
    ctx.arc(270, 1150, 480, Math.PI, 0);
    ctx.fill();

    // Character (Cartoon human walking)
    const cx = W / 2;
    // Left Leg (back)
    drawLimb(ctx, cx, hipY, cx - 20 + legSwingL * 0.8, hipY + 120, cx - 25 + legSwingL * 1.4, hipY + 220, '#1E3A5F', 24);
    // Left Arm (back)
    drawLimb(ctx, cx, hipY - 90, cx - 35 + armSwingL * 0.7, hipY - 20, cx - 45 + armSwingL * 1.3, hipY + 40, '#FFC93C', 18);

    // Torso (Yellow jacket)
    ctx.fillStyle = '#FFC93C';
    ctx.beginPath();
    roundRect(ctx, cx - 36, hipY - 110, 72, 120, 18);
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#0F1B33';
    ctx.stroke();

    // Head
    ctx.fillStyle = '#FFE0B2';
    ctx.beginPath();
    ctx.arc(cx, hipY - 150 + headBob, 42, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 5;
    ctx.stroke();

    // Hair & Cap
    ctx.fillStyle = '#FF5C7A';
    ctx.beginPath();
    ctx.arc(cx, hipY - 162 + headBob, 42, Math.PI, 0);
    roundRect(ctx, cx - 44, hipY - 168 + headBob, 88, 20, 6);
    ctx.fill();

    // Eye & Smile
    ctx.fillStyle = '#0F1B33';
    ctx.beginPath();
    ctx.arc(cx + 16, hipY - 150 + headBob, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 14, hipY - 140 + headBob, 12, 0.1 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // Right Leg (front)
    drawLimb(ctx, cx, hipY, cx + 15 + legSwingR * 0.8, hipY + 120, cx + 20 + legSwingR * 1.4, hipY + 220, '#2A4D7C', 26);
    // Right Foot sneaker
    ctx.fillStyle = '#FFF8EC';
    ctx.beginPath();
    roundRect(ctx, cx + 10 + legSwingR * 1.4, hipY + 215, 45, 20, 8);
    ctx.fill();
    ctx.stroke();

    // Right Arm (front)
    drawLimb(ctx, cx, hipY - 90, cx + 30 + armSwingR * 0.7, hipY - 20, cx + 40 + armSwingR * 1.3, hipY + 40, '#FFB703', 20);

  } else if (SLUG === 'papan-sains') {
    // 2. PAPAN SAINS (Scientific chalkboard & neon chalk)
    ctx.fillStyle = '#0B1E2D';
    ctx.fillRect(0, 0, W, H);

    // Chalkboard Grid
    ctx.strokeStyle = 'rgba(92, 225, 230, 0.08)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 40) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 40) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // Floating formulas & diagrams
    ctx.fillStyle = 'rgba(92, 225, 230, 0.35)';
    ctx.font = '16px "Courier New", monospace';
    ctx.fillText('E = mc²', 60, 200 + Math.sin(t * 6) * 10);
    ctx.fillText('∇ × B = μ₀J', 380, 260 + Math.cos(t * 6) * 10);
    ctx.fillText('pH 7.35 - 7.45', 70, 720);
    ctx.fillText('ΔG = ΔH - TΔS', 340, 700);

    // Tooth outline diagram (dentsweb theme)
    ctx.strokeStyle = 'rgba(92, 225, 230, 0.4)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(270, 220, 40, 0.8 * Math.PI, 2.2 * Math.PI);
    ctx.lineTo(260, 290);
    ctx.lineTo(270, 260);
    ctx.lineTo(280, 290);
    ctx.closePath();
    ctx.stroke();

    // Walking Scientist / Figure in glowing chalk
    const cx = W / 2;
    ctx.strokeStyle = '#5CE1E6';
    ctx.shadowColor = '#5CE1E6';
    ctx.shadowBlur = 12;
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';

    // Head
    ctx.beginPath();
    ctx.arc(cx, hipY - 140 + headBob, 26, 0, Math.PI * 2);
    ctx.stroke();

    // Spine
    ctx.beginPath();
    ctx.moveTo(cx, hipY - 114 + headBob);
    ctx.lineTo(cx, hipY);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx - 20 + legSwingL * 0.7, hipY + 100);
    ctx.lineTo(cx - 30 + legSwingL * 1.3, hipY + 200);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx + 20 + legSwingR * 0.7, hipY + 100);
    ctx.lineTo(cx + 30 + legSwingR * 1.3, hipY + 200);
    ctx.stroke();

    // Arms with glowing beaker / tablet
    ctx.beginPath();
    ctx.moveTo(cx, hipY - 90);
    ctx.lineTo(cx - 30 + armSwingL * 0.7, hipY - 30);
    ctx.lineTo(cx - 40 + armSwingL * 1.2, hipY + 20);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, hipY - 90);
    ctx.lineTo(cx + 35 + armSwingR * 0.6, hipY - 30);
    ctx.lineTo(cx + 50 + armSwingR * 1.1, hipY - 10);
    ctx.stroke();

    // Ground line
    ctx.beginPath();
    ctx.moveTo(40, hipY + 205);
    ctx.lineTo(500, hipY + 205);
    ctx.stroke();
    ctx.shadowBlur = 0;

  } else if (SLUG === 'sinematik') {
    // 3. SINEMATIK (Moody cinematic lighting, fog & golden beam)
    ctx.fillStyle = '#08080A';
    ctx.fillRect(0, 0, W, H);

    // Warm volumetric light beam from top-right
    const beam = ctx.createRadialGradient(480, 100, 20, 270, 560, 600);
    beam.addColorStop(0, 'rgba(224, 169, 109, 0.45)');
    beam.addColorStop(0.5, 'rgba(115, 149, 174, 0.15)');
    beam.addColorStop(1, 'rgba(8, 8, 10, 0)');
    ctx.fillStyle = beam;
    ctx.fillRect(0, 0, W, H);

    // Floating golden particles
    for (let i = 0; i < 24; i++) {
      const px = (i * 73 + t * 40) % W;
      const py = (i * 97 + Math.sin(t * 4 + i) * 30) % (H - 200);
      ctx.fillStyle = 'rgba(224, 169, 109, ' + (0.2 + (i % 5) * 0.1) + ')';
      ctx.beginPath();
      ctx.arc(px, py, (i % 3) + 2, 0, Math.PI * 2);
      ctx.fill();
    }

    // Walking silhouette figure with golden rim light
    const cx = W / 2;
    // Ground
    ctx.fillStyle = '#0F0F14';
    ctx.fillRect(0, hipY + 200, W, H - (hipY + 200));

    // Shadow on ground
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.beginPath();
    ctx.ellipse(cx, hipY + 200, 80, 14, 0, 0, Math.PI * 2);
    ctx.fill();

    // Silhouette body
    ctx.fillStyle = '#121218';
    ctx.strokeStyle = '#E0A96D'; // Rim light
    ctx.lineWidth = 3;

    // Head
    ctx.beginPath();
    ctx.arc(cx, hipY - 145 + headBob, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Overcoat / Body
    ctx.beginPath();
    ctx.moveTo(cx - 30, hipY - 110 + headBob);
    ctx.lineTo(cx + 30, hipY - 110 + headBob);
    ctx.lineTo(cx + 42, hipY + 70);
    ctx.lineTo(cx - 42, hipY + 70);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Coat tails flapping
    ctx.beginPath();
    ctx.moveTo(cx - 42, hipY + 70);
    ctx.lineTo(cx - 65 - Math.sin(cycle) * 15, hipY + 140);
    ctx.lineTo(cx + 20, hipY + 70);
    ctx.fill();

    // Legs
    drawLimb(ctx, cx - 15, hipY + 60, cx - 25 + legSwingL * 0.8, hipY + 130, cx - 30 + legSwingL * 1.3, hipY + 200, '#121218', 22);
    drawLimb(ctx, cx + 15, hipY + 60, cx + 25 + legSwingR * 0.8, hipY + 130, cx + 30 + legSwingR * 1.3, hipY + 200, '#181822', 24);

    // Film Anamorphic Streak
    ctx.fillStyle = 'rgba(224, 169, 109, 0.08)';
    ctx.fillRect(0, hipY - 145 + headBob, W, 8);

  } else if (SLUG === 'clay') {
    // 4. CLAY STOP-MOTION (12 fps stepped clay figure, plasticine tactile feel)
    const stepFrame = Math.floor(frame / 2.5); // 12 fps stepped
    const clayCycle = (stepFrame * 0.35);
    const clayHipY = 560 + Math.abs(Math.sin(clayCycle * 2)) * -14;
    const clayLegL = Math.sin(clayCycle) * 36;
    const clayLegR = Math.sin(clayCycle + Math.PI) * 36;
    const clayArmL = Math.sin(clayCycle + Math.PI) * 30;
    const clayArmR = Math.sin(clayCycle) * 30;

    // Textured warm clay backdrop
    ctx.fillStyle = '#F2E8DC';
    ctx.fillRect(0, 0, W, H);

    // Clay table / floor
    ctx.fillStyle = '#E3D3C2';
    ctx.beginPath();
    roundRect(ctx, 40, clayHipY + 200, W - 80, 160, 24);
    ctx.fill();

    const cx = W / 2;

    // Clay Character (Terracotta & Teal)
    // Left Leg
    ctx.fillStyle = '#1D7A6E';
    drawLimb(ctx, cx - 18, clayHipY, cx - 24 + clayLegL * 0.7, clayHipY + 100, cx - 28 + clayLegL * 1.2, clayHipY + 195, '#1D7A6E', 28);
    // Left Arm
    ctx.fillStyle = '#E76F51';
    drawLimb(ctx, cx - 30, clayHipY - 80, cx - 45 + clayArmL * 0.7, clayHipY - 10, cx - 55 + clayArmL * 1.2, clayHipY + 50, '#E76F51', 22);

    // Clay Torso (Rounded sphere/blob)
    ctx.fillStyle = '#E76F51';
    ctx.beginPath();
    ctx.ellipse(cx, clayHipY - 60, 44, 58, 0, 0, Math.PI * 2);
    ctx.fill();

    // Clay Buttons
    ctx.fillStyle = '#E9C46A';
    [clayHipY - 85, clayHipY - 60, clayHipY - 35].forEach(by => {
      ctx.beginPath();
      ctx.arc(cx, by, 7, 0, Math.PI * 2);
      ctx.fill();
    });

    // Clay Head
    ctx.fillStyle = '#F4A261';
    ctx.beginPath();
    ctx.ellipse(cx, clayHipY - 145, 38, 42, 0, 0, Math.PI * 2);
    ctx.fill();

    // Clay Eyes & Nose
    ctx.fillStyle = '#264653';
    ctx.beginPath();
    ctx.arc(cx + 12, clayHipY - 148, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#E76F51';
    ctx.beginPath();
    ctx.arc(cx + 24, clayHipY - 140, 7, 0, Math.PI * 2);
    ctx.fill();

    // Right Leg
    ctx.fillStyle = '#2A9D8F';
    drawLimb(ctx, cx + 18, clayHipY, cx + 24 + clayLegR * 0.7, clayHipY + 100, cx + 28 + clayLegR * 1.2, clayHipY + 195, '#2A9D8F', 30);
    // Clay Boot
    ctx.fillStyle = '#264653';
    ctx.beginPath();
    roundRect(ctx, cx + 18 + clayLegR * 1.2, clayHipY + 185, 42, 22, 10);
    ctx.fill();

    // Right Arm
    drawLimb(ctx, cx + 30, clayHipY - 80, cx + 45 + clayArmR * 0.7, clayHipY - 10, cx + 55 + clayArmR * 1.2, clayHipY + 50, '#E76F51', 24);

  } else if (SLUG === 'retro') {
    // 5. RETRO SYNTHWAVE (Neon grid floor & glowing sunset sun)
    ctx.fillStyle = '#14002B';
    ctx.fillRect(0, 0, W, H);

    // Sliced Synthwave Sun
    const sunY = 380;
    const sunGrad = ctx.createLinearGradient(0, sunY - 120, 0, sunY + 120);
    sunGrad.addColorStop(0, '#FFE600');
    sunGrad.addColorStop(0.5, '#FF007F');
    sunGrad.addColorStop(1, '#7928CA');
    ctx.fillStyle = sunGrad;
    ctx.beginPath();
    ctx.arc(W / 2, sunY, 120, 0, Math.PI * 2);
    ctx.fill();

    // Sun horizontal slice lines
    ctx.fillStyle = '#14002B';
    for (let i = 0; i < 8; i++) {
      const sy = sunY + 20 + i * 14;
      const sh = 3 + i * 1.5;
      ctx.fillRect(W / 2 - 130, sy, 260, sh);
    }

    // 3D Perspective Neon Grid Floor
    ctx.strokeStyle = '#00F0FF';
    ctx.shadowColor = '#00F0FF';
    ctx.shadowBlur = 8;
    ctx.lineWidth = 2;
    const horizonY = 520;

    // Horizon line
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(W, horizonY);
    ctx.stroke();

    // Perspective lines
    for (let x = -200; x <= W + 200; x += 60) {
      ctx.beginPath();
      ctx.moveTo(W / 2, horizonY);
      ctx.lineTo(x, H);
      ctx.stroke();
    }

    // Moving horizontal grid lines
    const gridOffset = (t * 40) % 40;
    for (let i = 0; i < 14; i++) {
      const prog = (i + gridOffset / 40) / 14;
      const y = horizonY + Math.pow(prog, 2.2) * (H - horizonY);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }

    // Neon Walker Character
    const cx = W / 2;
    ctx.strokeStyle = '#FF007F';
    ctx.shadowColor = '#FF007F';
    ctx.shadowBlur = 16;
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';

    // Head
    ctx.beginPath();
    ctx.arc(cx, hipY - 140 + headBob, 26, 0, Math.PI * 2);
    ctx.stroke();

    // Body
    ctx.beginPath();
    ctx.moveTo(cx, hipY - 114 + headBob);
    ctx.lineTo(cx, hipY);
    ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx - 20 + legSwingL * 0.7, hipY + 95);
    ctx.lineTo(cx - 30 + legSwingL * 1.3, hipY + 190);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx + 20 + legSwingR * 0.7, hipY + 95);
    ctx.lineTo(cx + 30 + legSwingR * 1.3, hipY + 190);
    ctx.stroke();

    // Arms
    ctx.strokeStyle = '#00F0FF';
    ctx.shadowColor = '#00F0FF';
    ctx.beginPath();
    ctx.moveTo(cx, hipY - 90);
    ctx.lineTo(cx - 30 + armSwingL * 0.7, hipY - 30);
    ctx.lineTo(cx - 40 + armSwingL * 1.2, hipY + 30);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx, hipY - 90);
    ctx.lineTo(cx + 30 + armSwingR * 0.7, hipY - 30);
    ctx.lineTo(cx + 40 + armSwingR * 1.2, hipY + 30);
    ctx.stroke();
    ctx.shadowBlur = 0;

  } else if (SLUG === 'cat-air') {
    // 6. CAT AIR ARTISTIK (Watercolor washes & fluid paper bleed)
    ctx.fillStyle = '#FBF7EF';
    ctx.fillRect(0, 0, W, H);

    // Watercolor background blobs
    ctx.save();
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#7FB7D9';
    ctx.beginPath();
    ctx.ellipse(180, 320, 140, 110, 0.4, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F2A7A0';
    ctx.beginPath();
    ctx.ellipse(360, 460, 160, 130, -0.3, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#F6D27A';
    ctx.beginPath();
    ctx.ellipse(270, 720, 180, 80, 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Watercolor walking figure (layered transparent wash)
    const cx = W / 2;
    ctx.save();
    ctx.globalAlpha = 0.85;

    // Head
    ctx.fillStyle = '#5A8CA8';
    ctx.beginPath();
    ctx.arc(cx, hipY - 145 + headBob, 32, 0, Math.PI * 2);
    ctx.fill();

    // Torso (soft dress/coat with brush flow)
    const coatGrad = ctx.createLinearGradient(cx, hipY - 110, cx, hipY + 80);
    coatGrad.addColorStop(0, '#7FB7D9');
    coatGrad.addColorStop(0.6, '#F2A7A0');
    coatGrad.addColorStop(1, '#D97A8F');
    ctx.fillStyle = coatGrad;

    ctx.beginPath();
    ctx.moveTo(cx - 24, hipY - 110 + headBob);
    ctx.lineTo(cx + 24, hipY - 110 + headBob);
    ctx.bezierCurveTo(cx + 50, hipY, cx + 45, hipY + 80, cx + 30, hipY + 80);
    ctx.lineTo(cx - 30, hipY + 80);
    ctx.bezierCurveTo(cx - 45, hipY + 40, cx - 35, hipY - 40, cx - 24, hipY - 110 + headBob);
    ctx.fill();

    // Limbs with soft brush lines
    ctx.strokeStyle = '#5A7A90';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    drawLimb(ctx, cx - 15, hipY + 70, cx - 25 + legSwingL * 0.7, hipY + 135, cx - 30 + legSwingL * 1.2, hipY + 200, '#5A7A90', 14);
    drawLimb(ctx, cx + 15, hipY + 70, cx + 25 + legSwingR * 0.7, hipY + 135, cx + 30 + legSwingR * 1.2, hipY + 200, '#8E5A70', 16);

    ctx.restore();

  } else if (SLUG === 'pixel') {
    // 7. PIXEL 8-BIT ARKADE (Chunky pixel walk cycle)
    ctx.fillStyle = '#1A1C2C';
    ctx.fillRect(0, 0, W, H);

    // Pixel stars
    ctx.fillStyle = '#FFFFFF';
    [[60, 120], [180, 80], [420, 140], [480, 260], [120, 340], [360, 300]].forEach(([px, py]) => {
      ctx.fillRect(px, py, 8, 8);
    });

    // 8-bit Brick Floor
    const floorY = hipY + 190;
    ctx.fillStyle = '#5D275D';
    ctx.fillRect(0, floorY, W, H - floorY);
    ctx.fillStyle = '#38B764'; // Grass top
    ctx.fillRect(0, floorY, W, 16);

    // Pixel Walk Cycle (4 steps)
    const step = Math.floor(frame / 6) % 4; // 0, 1, 2, 3
    const pxSize = 8;
    const cx = Math.floor((W / 2) / pxSize) * pxSize;
    const py = Math.floor((hipY - 100) / pxSize) * pxSize;

    // Draw pixel sprite grid
    const spriteColors = {
      R: '#E43B44', // Red cap/shirt
      B: '#0099DB', // Blue overalls
      S: '#FEE761', // Skin
      D: '#3E2731', // Dark boots
      W: '#FFFFFF',
    };

    // 8-bit character pixel matrix
    const matrix = [
      "  RRRRRR  ",
      "  RRRRRRRR",
      "  SSSSWSS ",
      "  SSSSSSS ",
      "  RRRRRR  ",
      " RRRRRRRR ",
      " R BRR B R",
      "   BBBB   ",
      "   B  B   ",
    ];

    matrix.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const char = row[c];
        if (char && spriteColors[char]) {
          ctx.fillStyle = spriteColors[char];
          ctx.fillRect(cx - 40 + c * pxSize, py + r * pxSize, pxSize, pxSize);
        }
      }
    });

    // Dynamic pixel legs depending on step
    ctx.fillStyle = '#3E2731';
    if (step === 0) {
      ctx.fillRect(cx - 24, py + 9 * pxSize, pxSize * 2, pxSize * 3);
      ctx.fillRect(cx + 8, py + 9 * pxSize, pxSize * 2, pxSize * 3);
    } else if (step === 1) {
      ctx.fillRect(cx - 32, py + 9 * pxSize, pxSize * 2, pxSize * 2);
      ctx.fillRect(cx + 16, py + 9 * pxSize, pxSize * 2, pxSize * 3);
    } else if (step === 2) {
      ctx.fillRect(cx - 16, py + 9 * pxSize, pxSize * 2, pxSize * 3);
      ctx.fillRect(cx, py + 9 * pxSize, pxSize * 2, pxSize * 3);
    } else {
      ctx.fillRect(cx - 8, py + 9 * pxSize, pxSize * 2, pxSize * 3);
      ctx.fillRect(cx + 24, py + 9 * pxSize, pxSize * 2, pxSize * 2);
    }

    // Floating 8-bit Coin
    ctx.fillStyle = '#FFCD75';
    const coinY = 240 + Math.sin(t * 8) * 12;
    ctx.fillRect(cx - 20, coinY, 40, 40);
    ctx.fillStyle = '#E4A620';
    ctx.fillRect(cx - 12, coinY + 8, 24, 24);

  } else if (SLUG === 'komik') {
    // 8. PANEL KOMIK STRIP (Halftone dots & action lines)
    ctx.fillStyle = '#FFFBEA';
    ctx.fillRect(0, 0, W, H);

    // Comic Halftone Dots
    ctx.fillStyle = 'rgba(238, 66, 102, 0.12)';
    for (let x = 20; x < W; x += 30) {
      for (let y = 20; y < H; y += 30) {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Bold comic panel border
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 10;
    ctx.strokeRect(30, 40, W - 60, H - 80);

    // Action speed lines
    ctx.lineWidth = 4;
    for (let i = 0; i < 8; i++) {
      const ly = 300 + i * 50;
      ctx.beginPath();
      ctx.moveTo(50, ly);
      ctx.lineTo(140 + (i % 3) * 30, ly);
      ctx.stroke();
    }

    // Comic Walker
    const cx = W / 2 + 20;
    ctx.fillStyle = '#FFD23F';
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';

    // Limbs (comic bold outlines)
    drawLimb(ctx, cx - 20, hipY, cx - 35 + legSwingL * 0.9, hipY + 110, cx - 45 + legSwingL * 1.4, hipY + 200, '#EE4266', 24);
    drawLimb(ctx, cx, hipY - 90, cx - 45 + armSwingL * 0.8, hipY - 20, cx - 60 + armSwingL * 1.3, hipY + 40, '#FFD23F', 20);

    // Torso
    ctx.beginPath();
    roundRect(ctx, cx - 35, hipY - 110, 70, 120, 12);
    ctx.fill();
    ctx.stroke();

    // Head
    ctx.fillStyle = '#FFE0B2';
    ctx.beginPath();
    ctx.arc(cx, hipY - 150 + headBob, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Action sound badge (TAP! TAP!)
    ctx.fillStyle = '#EE4266';
    ctx.beginPath();
    const bx = cx + 80, by = hipY + 120;
    ctx.arc(bx, by, 36, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px "Impact", sans-serif';
    ctx.fillText('TAP!', bx - 18, by + 6);

    // Front limbs
    drawLimb(ctx, cx + 20, hipY, cx + 35 + legSwingR * 0.9, hipY + 110, cx + 45 + legSwingR * 1.4, hipY + 200, '#EE4266', 26);
    drawLimb(ctx, cx, hipY - 90, cx + 45 + armSwingR * 0.8, hipY - 20, cx + 60 + armSwingR * 1.3, hipY + 40, '#FFD23F', 22);

  } else if (SLUG === 'stickman') {
    // 9. STICKMAN RELATABLE (Minimal clean lines, expressive swagger)
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    const cx = W / 2;

    // Ground line
    ctx.strokeStyle = '#1A1A1A';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(60, hipY + 205);
    ctx.lineTo(480, hipY + 205);
    ctx.stroke();

    // Foot dust puffs
    ctx.fillStyle = '#BDBDBD';
    const puffX = cx - (Math.sin(cycle) > 0 ? 30 : -30);
    ctx.beginPath();
    ctx.arc(puffX, hipY + 195, Math.abs(Math.sin(cycle)) * 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#1A1A1A';

    // Head
    ctx.beginPath();
    ctx.arc(cx, hipY - 150 + headBob, 36, 0, Math.PI * 2);
    ctx.stroke();

    // Eyes & Smile
    ctx.fillStyle = '#1A1A1A';
    ctx.beginPath();
    ctx.arc(cx + 12, hipY - 152 + headBob, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx + 8, hipY - 142 + headBob, 12, 0.1 * Math.PI, 0.8 * Math.PI);
    ctx.stroke();

    // Spine
    ctx.beginPath();
    ctx.moveTo(cx, hipY - 114 + headBob);
    ctx.lineTo(cx, hipY);
    ctx.stroke();

    // Left Leg
    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx - 25 + legSwingL * 0.7, hipY + 105);
    ctx.lineTo(cx - 35 + legSwingL * 1.3, hipY + 200);
    ctx.stroke();

    // Right Leg
    ctx.beginPath();
    ctx.moveTo(cx, hipY);
    ctx.lineTo(cx + 25 + legSwingR * 0.7, hipY + 105);
    ctx.lineTo(cx + 35 + legSwingR * 1.3, hipY + 200);
    ctx.stroke();

    // Left Arm
    ctx.beginPath();
    ctx.moveTo(cx, hipY - 80);
    ctx.lineTo(cx - 30 + armSwingL * 0.7, hipY - 20);
    ctx.lineTo(cx - 45 + armSwingL * 1.3, hipY + 40);
    ctx.stroke();

    // Right Arm (Thumbs up / swinging)
    ctx.beginPath();
    ctx.moveTo(cx, hipY - 80);
    ctx.lineTo(cx + 30 + armSwingR * 0.7, hipY - 20);
    ctx.lineTo(cx + 45 + armSwingR * 1.3, hipY + 40);
    ctx.stroke();

  } else if (SLUG === 'lowpoly') {
    // 10. LOW-POLY 3D GEOMETRI (Faceted 3D triangles & amber highlights)
    ctx.fillStyle = '#1E3A5F';
    ctx.fillRect(0, 0, W, H);

    // Faceted background mountain polygons
    const polyMountains = [
      [[0, 460], [140, 280], [280, 460]],
      [[140, 280], [300, 200], [420, 460]],
      [[280, 460], [420, 260], [540, 460]],
      [[0, 600], [200, 440], [380, 600]],
      [[200, 440], [400, 360], [540, 600]],
    ];
    const mountainColors = ['#2A4D7C', '#345E94', '#24436C', '#1B365B', '#274B7A'];
    polyMountains.forEach((pts, idx) => {
      ctx.fillStyle = mountainColors[idx % mountainColors.length];
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      ctx.lineTo(pts[1][0], pts[1][1]);
      ctx.lineTo(pts[2][0], pts[2][1]);
      ctx.closePath();
      ctx.fill();
    });

    // Low-poly terrain
    ctx.fillStyle = '#162C4A';
    ctx.fillRect(0, hipY + 190, W, H - (hipY + 190));

    // Faceted walking humanoid
    const cx = W / 2;
    // Head (faceted octahedron)
    drawFacet(ctx, [
      [cx, hipY - 170 + headBob],
      [cx - 24, hipY - 145 + headBob],
      [cx, hipY - 125 + headBob]
    ], '#F4A259');
    drawFacet(ctx, [
      [cx, hipY - 170 + headBob],
      [cx + 24, hipY - 145 + headBob],
      [cx, hipY - 125 + headBob]
    ], '#E76F51');

    // Torso facets
    drawFacet(ctx, [[cx, hipY - 120 + headBob], [cx - 30, hipY - 60], [cx, hipY]], '#3D7EA6');
    drawFacet(ctx, [[cx, hipY - 120 + headBob], [cx + 30, hipY - 60], [cx, hipY]], '#5599C4');

    // Left Leg facets
    drawFacet(ctx, [[cx - 10, hipY], [cx - 25 + legSwingL * 0.7, hipY + 100], [cx - 35 + legSwingL * 1.3, hipY + 195]], '#2C5A78');
    // Right Leg facets
    drawFacet(ctx, [[cx + 10, hipY], [cx + 25 + legSwingR * 0.7, hipY + 100], [cx + 35 + legSwingR * 1.3, hipY + 195]], '#487B9F');

    // Arms
    drawFacet(ctx, [[cx - 25, hipY - 90], [cx - 35 + armSwingL * 0.7, hipY - 30], [cx - 45 + armSwingL * 1.2, hipY + 30]], '#F4A259');
    drawFacet(ctx, [[cx + 25, hipY - 90], [cx + 35 + armSwingR * 0.7, hipY - 30], [cx + 45 + armSwingR * 1.2, hipY + 30]], '#E76F51');
  }

  // Common Clean Preset Branding Top/Bottom (Anti-slop, clean minimal typography)
  ctx.save();
  // Top category badge
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  roundRect(ctx, W / 2 - 120, 48, 240, 42, 21);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 15px -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('ONE-LINE MOTION', W / 2, 74);

  // Bottom Title & Subtitle Card
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)';
  roundRect(ctx, 36, H - 140, W - 72, 88, 18);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  ctx.font = 'bold 22px -apple-system, sans-serif';
  ctx.fillText(NAME, W / 2, H - 98);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
  ctx.font = '14px -apple-system, sans-serif';
  ctx.fillText(SUB, W / 2, H - 72);
  ctx.restore();
};

function drawLimb(ctx, x1, y1, x2, y2, x3, y3, color, width) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.stroke();
}

function drawFacet(ctx, pts, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  ctx.lineTo(pts[1][0], pts[1][1]);
  ctx.lineTo(pts[2][0], pts[2][1]);
  ctx.closePath();
  ctx.fill();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
</script>
</body>
</html>`;
}

async function renderPreset(browser, preset) {
  console.log(`[RENDER] Generating ${preset.name} (${preset.slug})...`);
  const page = await browser.newPage({
    viewport: { width: 540, height: 960 }
  });

  await page.setContent(getHtml(preset));
  await page.waitForTimeout(100);

  const totalFrames = 60; // 2 seconds loop at 30 fps
  const mp4Path = path.join(OUT_DIR, `${preset.slug}.mp4`);
  const jpgPath = path.join(OUT_DIR, `${preset.slug}.jpg`);

  const ffmpeg = spawn('/opt/homebrew/bin/ffmpeg', [
    '-y',
    '-f', 'image2pipe',
    '-vcodec', 'png',
    '-r', '30',
    '-i', '-',
    '-c:v', 'libx264',
    '-pix_fmt', 'yuv420p',
    '-profile:v', 'baseline',
    '-level', '3.0',
    '-movflags', '+faststart',
    mp4Path
  ]);

  for (let f = 0; f < totalFrames; f++) {
    await page.evaluate((frame) => {
      window.drawFrame(frame, 60);
    }, f);
    const buf = await page.screenshot({ type: 'png' });
    ffmpeg.stdin.write(buf);

    if (f === 30) {
      // Capture 1-second poster thumbnail
      const jpgBuf = await page.screenshot({ type: 'jpeg', quality: 90 });
      fs.writeFileSync(jpgPath, jpgBuf);
    }
  }

  ffmpeg.stdin.end();
  await new Promise((resolve, reject) => {
    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });

  await page.close();
  const statMp4 = fs.statSync(mp4Path);
  const statJpg = fs.statSync(jpgPath);
  console.log(`[RENDER] OK: ${preset.slug} -> MP4: ${(statMp4.size / 1024).toFixed(1)} KB, JPG: ${(statJpg.size / 1024).toFixed(1)} KB`);
}

async function main() {
  console.log('=== STARTING WALKING PERSON PRESET RENDERS (10 STYLES) ===');
  const browser = await chromium.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true
  });

  for (const preset of PRESETS) {
    await renderPreset(browser, preset);
  }

  await browser.close();
  console.log('=== ALL 10 PRESETS RENDERED SUCCESSFULLY ===');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
