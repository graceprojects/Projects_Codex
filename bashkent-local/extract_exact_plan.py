"""Extract original PDF drawing paths by CAD layer, without retracing geometry.
Requires PyMuPDF in the temporary analysis environment. Source is never modified.
"""
from pathlib import Path
import pymupdf as fitz,json,html,collections
p=fitz.open('pdf/pdf/2-7.kat planı.pdf')[0]
paths=p.get_drawings();out=Path('bashkent-local/site/assets/plans');out.mkdir(exist_ok=True)
# PDF points, top-left origin; crop and calibration confirmed against dimension lines.
crop=fitz.Rect(892.8,335.3,1032.5,513.2)
def overlap(a,b):return a.x0<=b.x1 and a.x1>=b.x0 and a.y0<=b.y1 and a.y1>=b.y0
def n(v):return f'{v:.3f}'.rstrip('0').rstrip('.')
def pt(p):return f'{n(p.x)},{n(p.y)}'
def pathdata(items):
 d=[]
 for item in items:
  t=item[0]
  if t=='l':d.append(f'M{pt(item[1])}L{pt(item[2])}')
  elif t=='c':d.append(f'M{pt(item[1])}C{pt(item[2])} {pt(item[3])} {pt(item[4])}')
  elif t=='re':
   r=item[1];d.append(f'M{n(r.x0)},{n(r.y0)}H{n(r.x1)}V{n(r.y1)}H{n(r.x0)}Z')
  elif t=='qu':
   q=item[1];d.append('M'+pt(q.ul)+'L'+pt(q.ur)+'L'+pt(q.lr)+'L'+pt(q.ll)+'Z')
 return ''.join(d)
def element(d,color=None):
 # Keep connected subpaths for filled polygons; every line still has exact endpoints.
 pieces=[];last=None
 for it in d['items']:
  if it[0]=='l':
   if last!=it[1]:pieces.append('M'+pt(it[1]))
   pieces.append('L'+pt(it[2]));last=it[2]
  elif it[0]=='c':
   if last!=it[1]:pieces.append('M'+pt(it[1]))
   pieces.append('C'+pt(it[2])+' '+pt(it[3])+' '+pt(it[4]));last=it[4]
  else:pieces.append(pathdata([it]));last=None
 if d.get('closePath'):pieces.append('Z')
 fill='none' if d.get('fill') is None else ('#fff' if sum(d['fill'])>2.5 else color or '#292521')
 stroke='none' if d.get('color') is None else ('#fff' if sum(d['color'])>2.5 else color or '#292521')
 width=max(d.get('width',0),.095)
 return f'<path d="{"".join(pieces)}" fill="{fill}" stroke="{stroke}" stroke-width="{n(width)}" stroke-linejoin="round" stroke-linecap="round" fill-rule="{"evenodd" if d.get("even_odd") else "nonzero"}"/>'
layers=collections.defaultdict(list)
for d in paths:
 if overlap(d['rect'],crop):layers[d['layer']].append(d)
print('crop layers', {k:len(v) for k,v in layers.items()},flush=True)
arch=['A-WALL','Duvar_gazbeton 15','S-COLS','A-HATCH_WALL','A-HATCH_REINFORCED','A-HATCH','I-MATERIAL PLASTER','A-ROCKWOOL','A-WINDOWS','A-DOOR','A-RAILING','KOLONCUK','A-10cm-FURNISHING_GENERAL']
furniture=['A-FURNISHING_GENERAL','A-FURNISHING_WET AREA']
groups={}
for key,selected in [('architecture',arch),('furniture',furniture),('dimensions',['A-DIM-INTERIOR'])]:
 groups[key]=''.join('<g data-cad-layer="'+html.escape(layer)+'">'+''.join(element(d, '#536a78' if key=='dimensions' else '#766550' if key=='furniture' else None) for d in layers[layer])+'</g>' for layer in selected)
# Include original dimension text with the original text transform (PDF font is Arial).
texts=[]
for span in p.get_texttrace():
 if span.get('layer')=='A-DIM-INTERIOR' and fitz.Rect(span['bbox']).intersects(crop):
  text=''.join(chr(c[0]) for c in span['chars']);x,y=span['chars'][0][2];dx,dy=span['dir'];import math
  rot=math.degrees(math.atan2(dy,dx));texts.append(f'<text x="{n(x)}" y="{n(y)}" transform="rotate({n(rot)} {n(x)} {n(y)})" font-family="Arial,sans-serif" font-size="{n(span["size"])}" fill="#385a6c">{html.escape(text)}</text>')
groups['dimensions']+=''.join(texts)
for key,content in groups.items():
 (out/f'a3-exact-{key}.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="880 321 170 206">{content}</svg>')
# Entire floor uses original architecture paths, not generic rectangular blocks.
whole=''.join(element(d,'#aaa49a') for d in paths if d['layer'] in ['A-WALL','Duvar_gazbeton 15','S-COLS','A-RAILING','A-WINDOWS','A-STAIR','A-ELEVATOR','A-DOOR'] and overlap(d['rect'],fitz.Rect(485,325,2085,2340)))
(out/'complex-exact.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="470 310 1630 2050">{whole}</svg>')
section=''.join(element(d,'#989084') for d in paths if d['layer'] in arch+['A-STAIR','A-ELEVATOR'] and overlap(d['rect'],fitz.Rect(885,327,1286,750)))
(out/'a3-section-exact.svg').write_text(f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="885 327 401 423">{section}</svg>')
(out/'exact-layers.json').write_text(json.dumps(groups))
# Cache source coordinates for geometric verification and 3D extrusion.
def serial(o):
 if isinstance(o,(fitz.Point,fitz.Rect,fitz.Quad)):return list(o)
 raise TypeError(type(o).__name__)
Path('tmp/plan-audit/crop-paths.json').write_text(json.dumps(dict(layers),default=serial))
Path('tmp/plan-audit/text-crop.json').write_text(json.dumps([s for s in p.get_texttrace() if fitz.Rect(s['bbox']).intersects(crop)],default=serial))
print('Saved precise SVG layers',flush=True)
