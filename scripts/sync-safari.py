#!/usr/bin/env python3
"""Copy shared extension sources into the checked-in macOS Xcode project."""
import json
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PROJECT = ROOT / 'safari/NYCU E3 Helper'
RESOURCES = PROJECT / 'NYCU E3 Helper Extension/Resources'
FILES = ['background.js', 'content.js', 'i18n.js', 'desktop-notifications.js', 'notification-engine.js',
         'notification-settings.js', 'notification-settings.html',
         'notification-settings.css', 'jszip.min.js', '128.png', '_locales']

def sync():
    for name in FILES:
        source, target = ROOT / name, RESOURCES / name
        if source.is_dir():
            if target.exists():
                shutil.rmtree(target)
            shutil.copytree(source, target)
        else:
            shutil.copy2(source, target)
    manifest = json.loads((ROOT / 'manifest.json').read_text())
    manifest['permissions'] = [p for p in manifest['permissions'] if p not in ('downloads', 'notifications')]
    manifest['permissions'].append('nativeMessaging')
    manifest['options_ui'].pop('open_in_tab', None)
    # The active AI implementation uses OpenAI; no local Ollama service is needed.
    manifest['host_permissions'] = [p for p in manifest['host_permissions'] if 'localhost' not in p]
    (RESOURCES / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    pbx = PROJECT / 'NYCU E3 Helper.xcodeproj/project.pbxproj'
    source = pbx.read_text()
    source = re.sub(r'MARKETING_VERSION = [^;]+;', f"MARKETING_VERSION = {manifest['version']};", source)
    pbx.write_text(source)
    print(f"Safari resources synced: {manifest['version']}")

if __name__ == '__main__':
    sync()
