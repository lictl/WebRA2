#!/usr/bin/env python3
# SPDX-License-Identifier: MIT
"""macOS diagnostic RSS sampling; includes other processes in the selected family."""
import argparse
import datetime
import json
import subprocess
import time

parser = argparse.ArgumentParser()
parser.add_argument('family', choices=['chrome', 'firefox', 'safari', 'edge'])
parser.add_argument('--seconds', type=int, default=30)
args = parser.parse_args()
if not 1 <= args.seconds <= 240:
    parser.error('seconds must be 1..240')
patterns = {'chrome': ['/Google Chrome.app/'], 'firefox': ['/Firefox.app/'],
            'edge': ['/Microsoft Edge.app/'], 'safari': ['/Safari.app/Contents/MacOS/Safari', '/com.apple.WebKit.WebContent.xpc/']}

def sample():
    values = {}
    for line in subprocess.check_output(['ps', '-axo', 'pid=,rss=,comm='], text=True).splitlines():
        columns = line.strip().split(None, 2)
        if len(columns) == 3 and any(pattern in columns[2] for pattern in patterns[args.family]):
            values[int(columns[0])] = int(columns[1]) * 1024
    return values

started = datetime.datetime.now(datetime.timezone.utc).isoformat()
began = time.monotonic()
baseline = sample()
peaks = dict(baseline)
series = []
while time.monotonic() - began < args.seconds:
    current = sample()
    series.append({'seconds': round(time.monotonic() - began, 3), 'rssBytes': sum(current.values()), 'processCount': len(current)})
    for pid, value in current.items():
        peaks[pid] = max(value, peaks.get(pid, 0))
    time.sleep(0.2)
print(json.dumps({'family': args.family, 'startedUtc': started, 'requestedSeconds': args.seconds,
                  'samplingIntervalMs': 200, 'baselineRssBytes': sum(baseline.values()),
                  'sampledPeakRssBytes': max(row['rssBytes'] for row in series),
                  'largestProcessIncreasesBytes': sorted((value - baseline.get(pid, 0) for pid, value in peaks.items()), reverse=True)[:5],
                  'scope': 'Aggregate family RSS with other tabs/apps open; sampled, not exact peak or attributable allocation. Safari includes all WebKit WebContent services.',
                  'series': series}, indent=2))
