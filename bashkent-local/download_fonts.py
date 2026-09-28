from pathlib import Path
import re, subprocess
root=Path(__file__).resolve().parent/'site'
css=Path('/tmp/haven-fonts.css').read_text()
blocks=re.findall(r'@font-face\s*\{[^}]+\}',css)
out=[]
for block in blocks:
    if 'Noto Serif TC' in block: continue
    family=re.search("font-family: '([^']+)'",block)[1]
    weight=re.search(r'font-weight: (\d+)',block)[1]
    url=re.search(r'url\(([^)]+)\)',block)[1]
    filename=family.lower().replace(' ','-')+'-'+weight+'.ttf'
    path=root/'assets/brand/fonts'/filename; path.parent.mkdir(parents=True,exist_ok=True)
    subprocess.run(['curl','-fsSL','--max-time','60',url,'-o',str(path)],check=True)
    out.append(block.replace(url,'assets/brand/fonts/'+filename))
(root/'fonts.css').write_text('\n'.join(out))
