#!/usr/bin/env python3
"""Copy the complete static pack into GitHub Pages' supported /docs source."""
from pathlib import Path
import shutil
root = Path(__file__).resolve().parent.parent
source, destination = root / 'public', root / 'docs'
destination.mkdir(exist_ok=True)
for entry in source.rglob('*'):
    relative = entry.relative_to(source)
    target = destination / relative
    if entry.is_dir():
        target.mkdir(exist_ok=True)
    else:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(entry, target)
print(f'Staged {sum(p.is_file() for p in destination.rglob("*"))} files in docs/.')
