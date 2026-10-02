#!/usr/bin/env python3
"""Build the Chrome Web Store zip from the extension's own files only.

Docs, tests, scripts and the Safari projects share the repository root with
the extension, so zipping the whole folder would ship them too.

Usage: python3 scripts/package-extension.py [output-dir]   (default: dist/)
"""
import importlib.util
import json
import re
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def extension_files():
    # sync-safari.py already lists the shared sources; reuse it so the two cannot drift.
    spec = importlib.util.spec_from_file_location('sync_safari', ROOT / 'scripts/sync-safari.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    # CHANGELOG.md is fetched at runtime for the What's New dialog.
    return ['manifest.json', 'CHANGELOG.md', *module.FILES]

def expand(names):
    paths = []
    for name in names:
        source = ROOT / name
        if not source.exists():
            sys.exit(f'Missing extension file: {name}')
        found = sorted(p for p in source.rglob('*') if p.is_file()) if source.is_dir() else [source]
        paths += [p for p in found if not p.name.startswith('.')]
    return paths

def referenced(manifest):
    """Paths the manifest, the service worker and the options page load."""
    refs = {manifest['background']['service_worker'], manifest['options_ui']['page']}
    refs.update(manifest.get('icons', {}).values())
    refs.update(manifest.get('action', {}).get('default_icon', {}).values())
    for entry in manifest.get('content_scripts', []):
        refs.update(entry.get('js', []) + entry.get('css', []))
    if 'default_locale' in manifest:
        refs.add(f"_locales/{manifest['default_locale']}/messages.json")
    worker = (ROOT / manifest['background']['service_worker']).read_text(encoding='utf-8')
    for call in re.findall(r'importScripts\(([^)]*)\)', worker):
        refs.update(re.findall(r'''['"]([^'"]+)['"]''', call))
    page = (ROOT / manifest['options_ui']['page']).read_text(encoding='utf-8')
    refs.update(ref for ref in re.findall(r'''(?:src|href)=["']([^"']+)["']''', page) if '://' not in ref)
    for script in ROOT.glob('*.js'):
        refs.update(re.findall(r'''runtime\.getURL\(['"]([^'"]+)['"]\)''', script.read_text(encoding='utf-8')))
    return refs

def main():
    manifest = json.loads((ROOT / 'manifest.json').read_text(encoding='utf-8'))
    paths = expand(extension_files())
    packaged = {p.relative_to(ROOT).as_posix() for p in paths}
    missing = sorted(referenced(manifest) - packaged)
    if missing:
        sys.exit('Referenced by the extension but not packaged: ' + ', '.join(missing))
    output = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'dist'
    output.mkdir(parents=True, exist_ok=True)
    target = output / f"nycu-e3-helper-{manifest['version']}.zip"
    with zipfile.ZipFile(target, 'w', zipfile.ZIP_DEFLATED) as archive:
        for path in paths:
            archive.write(path, path.relative_to(ROOT).as_posix())
    print(f'{target} ({target.stat().st_size / 1024:.0f} KB, {len(paths)} files)')
    for name in sorted(packaged):
        print(f'  {name}')

if __name__ == '__main__':
    main()
