#!/bin/bash
# Cut seasonal lookbook video into per-look segments using ffmpeg
# Usage: bash scripts/cut-looks.sh videos/cuts/FW1314/looks.json

set -e

LOOKS_JSON="$1"
if [ -z "$LOOKS_JSON" ]; then
  echo "Usage: $0 <looks.json>"
  exit 1
fi

SEASON_DIR=$(dirname "$LOOKS_JSON")
VIDEOS_DIR=$(dirname "$SEASON_DIR")/..
SOURCE_VIDEO=$(python3 -c "import json; d=json.load(open('$LOOKS_JSON')); print(d['source_video'])")
INPUT="$VIDEOS_DIR/$SOURCE_VIDEO"

if [ ! -f "$INPUT" ]; then
  echo "Source video not found: $INPUT"
  exit 1
fi

echo "Source: $INPUT"
echo "Output: $SEASON_DIR"
echo ""

# Parse looks and cut each one
python3 -c "
import json, subprocess, os, sys

data = json.load(open('$LOOKS_JSON'))
season_dir = '$SEASON_DIR'
input_file = '$INPUT'

for look in data['looks']:
    num = look['look']
    label = look['label']
    start = look['start']
    end = look['end']

    # Create look directory
    look_dir = os.path.join(season_dir, f'look{num}_{label}')
    os.makedirs(look_dir, exist_ok=True)

    # Write per-look JSON metadata
    meta_path = os.path.join(look_dir, f'look{num}.json')
    with open(meta_path, 'w') as f:
        json.dump(look, f, indent=2)

    # Convert MM:SS to seconds for ffmpeg
    def to_seconds(ts):
        parts = ts.split(':')
        return int(parts[0]) * 60 + int(parts[1])

    start_s = to_seconds(start)
    end_s = to_seconds(end)
    duration = end_s - start_s

    if duration <= 0:
        print(f'  [skip] Look {num} ({label}): duration {duration}s')
        continue

    output = os.path.join(look_dir, f'look{num}.mp4')

    cmd = [
        'ffmpeg', '-y',
        '-ss', str(start_s),
        '-i', input_file,
        '-t', str(duration),
        '-c', 'copy',
        '-avoid_negative_ts', 'make_zero',
        output
    ]

    print(f'  [{num}] {label}: {start} -> {end} ({duration}s)')
    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        print(f'    ERROR: {result.stderr[-200:]}')
    else:
        size_kb = os.path.getsize(output) / 1024
        print(f'    -> {output} ({size_kb:.0f}KB)')

print('\nDone!')
"
