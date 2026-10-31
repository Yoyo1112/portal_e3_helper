const { test } = require('node:test');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
test('Safari sync works both before and after optional Chrome sidebar files are merged', () => {
  execFileSync('python3', ['-c', `
import importlib.util, json, shutil, sys, tempfile
from pathlib import Path
source = Path(sys.argv[1])
def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    result = importlib.util.module_from_spec(spec); spec.loader.exec_module(result); return result
original = module(source/'scripts/sync-safari.py', 'original')
for available in [False, True]:
    with tempfile.TemporaryDirectory() as directory:
        root = Path(directory); (root/'scripts').mkdir()
        shutil.copy2(source/'scripts/sync-safari.py', root/'scripts/sync-safari.py')
        for name in original.FILES:
            if name in original.OPTIONAL_SIDEBAR_FILES: continue
            item = source/name
            if item.is_dir(): shutil.copytree(item, root/name)
            else: shutil.copy2(item, root/name)
        if available:
            for name in original.OPTIONAL_SIDEBAR_FILES: (root/name).write_text('// fixture')
        manifest = json.loads((source/'manifest.json').read_text())
        manifest.update(optional_permissions=['scripting'], optional_host_permissions=['https://*/*'], web_accessible_resources=[{'resources':['all-sites-panel.html'], 'matches':['https://*/*']}])
        (root/'manifest.json').write_text(json.dumps(manifest))
        project = root/'Safari'; (project/'Extension/Resources').mkdir(parents=True)
        (project/'Fixture.xcodeproj').mkdir(); (project/'Fixture.xcodeproj/project.pbxproj').write_text('MARKETING_VERSION = 0.0;')
        fixture = module(root/'scripts/sync-safari.py', 'fixture')
        fixture.sync_project(project, 'Extension', True)
        resources = project/'Extension/Resources'
        output = json.loads((resources/'manifest.json').read_text())
        for key in ['optional_permissions', 'optional_host_permissions', 'web_accessible_resources']: assert key not in output
        for name in original.OPTIONAL_SIDEBAR_FILES: assert (resources/name).exists() == available
`, path.join(__dirname, '..')], { stdio: 'pipe' });
});
