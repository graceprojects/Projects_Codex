"""Copy public same-origin website resources; never accesses server-private files."""
import concurrent.futures, json, pathlib, re, subprocess, urllib.parse, sys

ROOT = pathlib.Path(__file__).resolve().parent / 'site'
BASE = 'http://159.89.93.31/site/'
queue = {'index.html', 'script.js', 'styles.css', 'map2d.js', 'map3d.html'}
queue.update(f'assets/frames/{side}-{i}.jpg' for side in ['left', 'right'] for i in range(3))
queue.update(json.loads((ROOT.parent / 'map-assets.json').read_text()))
if len(sys.argv) > 1:
    queue = set(json.loads(pathlib.Path(sys.argv[1]).read_text()))
seen = set()
failures = []
def download(path):
    dest = ROOT / path
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        result = subprocess.run(['curl', '-fsSL', '--retry', '2', '--connect-timeout', '20', '--max-time', '180', BASE + urllib.parse.quote(path, safe='/'), '-o', str(dest)], capture_output=True)
        if result.returncode:
            dest.unlink(missing_ok=True)
            return path, None
    if dest.suffix in ['.html', '.css', '.js', '.json', '.svg']:
        return path, dest.read_text(errors='replace')
    return path, ''
while queue:
    batch = sorted(queue - seen)
    if not batch: break
    seen.update(batch)
    queue.clear()
    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
        for path, content in pool.map(download, batch):
            print(('OK ' if content is not None else 'FAILED ') + path, flush=True)
            if content is None:
                failures.append(path)
                continue
            refs = re.findall(r'''["'`(]([^"'`()\s<>]+?\.(?:html|css|js|json|jpg|jpeg|png|webp|svg|mp4|glb|gltf|bin|woff2?)(?:\?[^"'`()\s<>]*)?)["'`)]''', content)
            for ref in refs:
                if '${' in ref or '*' in ref or ref.startswith(('http:', 'https:', 'data:', '//', 'three/')): continue
                if path == 'map2d.js' and ref.split('?')[0] in ['map.svg', 'data.json']:
                    ref = 'assets/map2d/' + ref
                if path == 'map3d.js' and ref.split('?')[0] in ['city.glb', 'complex.glb', 'landmarks.glb', 'lights.bin', 'peds.bin', 'scene.json', 'traffic.bin', 'trees.bin']:
                    ref = 'assets/map/' + ref
                full = urllib.parse.urljoin(BASE + path, ref)
                if not full.startswith(BASE): continue
                target = urllib.parse.unquote(urllib.parse.urlparse(full).path[len('/site/'):])
                if '..' not in pathlib.PurePosixPath(target).parts: queue.add(target)
            if path == 'assets/plans/index.json':
                for entry in json.loads(content).get('plans', []):
                    if entry.get('file'): queue.add('assets/plans/' + entry['file'])
(ROOT.parent / 'download-report.json').write_text(json.dumps({'downloaded': sorted(seen-set(failures)), 'failed': failures}, ensure_ascii=False, indent=2))
