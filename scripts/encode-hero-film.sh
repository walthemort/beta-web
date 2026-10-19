#!/usr/bin/env bash
set -euo pipefail
motion_source=${1:?Usage: bash scripts/encode-hero-film.sh /path/to/new-brand-film.mp4}
project_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
# Keep the master outside public/. Only web exports are committed.
ffmpeg -hide_banner -loglevel error -y -i "$motion_source" -an -vf 'scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=24' -c:v libx264 -preset medium -crf 27 -pix_fmt yuv420p -g 48 -movflags +faststart -threads 2 "$project_root/public/work/hero-loop.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$motion_source" -an -vf 'scale=640:360:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=24' -c:v libx264 -preset medium -crf 28 -pix_fmt yuv420p -g 48 -movflags +faststart -threads 2 "$project_root/public/work/hero-loop-mobile.mp4"
ffmpeg -hide_banner -loglevel error -y -i "$motion_source" -vf 'scale=1280:720:force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30' -c:v libx264 -preset medium -crf 24 -pix_fmt yuv420p -g 60 -c:a aac -b:a 96k -movflags +faststart -threads 2 "$project_root/public/work/beta-brand-film.mp4"
ffmpeg -hide_banner -loglevel error -y -ss 0 -i "$motion_source" -frames:v 1 -vf 'scale=1280:720:force_original_aspect_ratio=decrease' -c:v libwebp -quality 78 -update 1 "$project_root/public/work/hero-film-poster.webp"
