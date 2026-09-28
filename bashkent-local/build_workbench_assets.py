"""Build source-preserving 2D workbench assets. Does not modify project PDFs."""
from pathlib import Path
import ast,json,re,shutil,hashlib,html,math
import pymupdf as fitz
from shapely.geometry import Polygon,LineString,box,MultiPoint,Point
from shapely.ops import unary_union
from shapely import concave_hull

ROOT=Path(__file__).resolve().parent.parent
STUDY=ROOT/'output/plan-studies/a3-type44'
OUT=ROOT/'bashkent-local/site/assets/plans/haven44'
OUT.mkdir(parents=True,exist_ok=True)
ns={}
for node in ast.parse((STUDY/'build_variants.py').read_text()).body:
    if isinstance(node,ast.Assign) and any(isinstance(t,ast.Name) and t.id in ('ROOMS','WALL_FILLS','THEMES') for t in node.targets):
        exec(compile(ast.Module(body=[node],type_ignores=[]),'study','exec'),{},ns)
audit=json.loads((STUDY/'geometry-audit.json').read_text())
n=lambda v:format(float(v),'.9f').rstrip('0').rstrip('.')
def path(pts):return 'M'+'L'.join(','.join(n(v) for v in p) for p in pts)+'Z'
def geometry(d):
    result=[];last=None
    for i in d['items']:
        if i[0] in ('l','c'):
            if last!=i[1]:result.append('M'+','.join(n(v) for v in i[1]))
            result.append(('L' if i[0]=='l' else 'C')+' '.join(','.join(n(v) for v in p) for p in i[2:]));last=i[-1]
        elif i[0]=='re':
            r=i[1];result.append(path([(r.x0,r.y0),(r.x1,r.y0),(r.x1,r.y1),(r.x0,r.y1)]));last=None
        elif i[0]=='qu':
            q=i[1];result.append(path([q.ul,q.ur,q.lr,q.ll]));last=None
    if d.get('closePath'):result.append('Z')
    return ''.join(result)

rooms=ns['ROOMS']
dims={'living':'3,45 × 6,15 м','bedroom1':'Ширина 3,05 м · основная глубина 5,65 м','bedroom2':'2,90 × 7,15 м · с выступами колонн','kitchen':'2,15 × 3,20 м · с нишами','hall':'Проход 1,20 м · сложная форма','bath':'2,40 × 1,90 м','balcony':'Глубина 1,15 / 1,45 м'}
for i,r in enumerate(rooms,1):r.update(number=i,path=path(r['pts']),dimension=dims[r['id']])

arch=[];furn=[]
for d in audit['paths']:
    layer=d['layer'];furniture='FURNISHING' in layer
    attrs=f'data-source-seq="{d["seqno"]}" data-cad-layer="{layer}"'
    cls='wet-furniture' if layer.endswith('WET AREA') else 'furniture' if furniture else 'column' if layer in ['S-COLS','KOLONCUK'] else 'window' if layer=='A-WINDOWS' else 'door' if layer=='A-DOOR' else 'architecture'
    # Copy source fill semantics from the approved SVG (white CAD masks matter).
    (furn if furniture else arch).append(f'<path {attrs} class="{cls}" d="{d["d"]}"/>')
approved=fitz.open(ROOT/'pdf/pdf/2-7.kat planı.pdf')[0]
draw=approved.get_drawings()
byseq={d['seqno']:d for d in draw}
for collection in [arch,furn]:
    for idx,s in enumerate(collection):
        seq=int(re.search(r'data-source-seq="(\d+)"',s).group(1));d=byseq[seq]
        classes=[]
        if d.get('fill') is not None:classes.append('cad-white' if sum(d['fill'])>2.5 else 'cad-filled')
        if d.get('color') is None:classes.append('no-stroke')
        if classes:s=s.replace('class="','class="'+' '.join(classes)+' ',1)
        collection[idx]=s
wallfills=''.join(f'<path class="wall-fill" d="{path(pts)}"/>' for pts in ns['WALL_FILLS'])

ARCH_LAYERS=['A-WALL','Duvar_gazbeton 15','S-COLS','A-WINDOWS','A-RAILING','A-DOOR','A-STAIR','A-ELEVATOR']
selected=[d for d in draw if d['layer'] in ARCH_LAYERS and d['rect'].intersects(fitz.Rect(485,325,2085,2340))]
floor_lines=[];outline_lines=[]
for d in selected:
    fill='var(--wall)' if d['layer']=='S-COLS' else 'none' if d.get('fill') is None else 'var(--wall)' if sum(d['fill'])<2.5 else 'white'
    width='.95' if d['layer'] in ['A-WALL','Duvar_gazbeton 15','S-COLS'] else '.4'
    floor_lines.append(f'<path d="{geometry(d)}" fill="{fill}" stroke="var(--context-line)" stroke-width="{width}"/>')
    if d['layer'] in ['A-STAIR','A-ELEVATOR']:continue
    for it in d['items']:
        if it[0]=='l':points=[list(it[1]),list(it[2])]
        elif it[0]=='c':
            a,b,c,e=it[1:];points=[]
            for k in range(13):
                t=k/12;points.append([((1-t)**3)*a[j]+3*((1-t)**2)*t*b[j]+3*(1-t)*t*t*c[j]+t**3*e[j] for j in [0,1]])
        elif it[0]=='re':
            r=it[1];points=[(r.x0,r.y0),(r.x1,r.y0),(r.x1,r.y1),(r.x0,r.y1),(r.x0,r.y0)]
        elif it[0]=='qu':q=it[1];points=[q.ul,q.ur,q.lr,q.ll,q.ul]
        else:continue
        if len(set(tuple(p) for p in points))>1:outline_lines.append(LineString(points))
print('Extracted',len(selected),'architectural paths',flush=True)
source_points=list(set((round(x,2),round(y,2)) for line in outline_lines for x,y in line.coords))
def svgpath(poly):
    ps=[poly] if poly.geom_type=='Polygon' else list(poly.geoms)
    return ''.join(path(p.exterior.coords) for p in ps if p.geom_type=='Polygon')

# Section viewport boundaries follow the sheet; outline fills are clipped to
# the traced building footprint. These are navigation zones, not property lines.
regions=[
 ('A4',[(485,325),(893,325),(893,515),(830,515),(830,750),(485,750)],[674,523]),
 ('A3',[(893,325),(1296,325),(1296,750),(830,750),(830,515),(893,515)],[1110,468]),
 ('A2',[(1296,325),(1694,325),(1694,750),(1296,750)],[1490,490]),
 ('A1',[(1694,325),(2085,325),(2085,750),(1694,750)],[1883,490]),
 ('A5',[(485,750),(912,750),(912,1151),(485,1151)],[702,956]),
 ('A6',[(485,1151),(912,1151),(912,1517),(485,1517)],[702,1330]),
 ('C5',[(485,1517),(912,1517),(912,1922),(485,1922)],[702,1720]),
 ('C4',[(485,1922),(830,1922),(830,2150),(893,2150),(893,2343),(485,2343)],[674,2160]),
 ('C3',[(830,1922),(1296,1922),(1296,2343),(893,2343),(893,2150),(830,2150)],[1110,2200]),
 ('C2',[(1296,1922),(1694,1922),(1694,2343),(1296,2343)],[1490,2182]),
 ('C1',[(1694,1922),(2085,1922),(2085,2343),(1694,2343)],[1883,2182]),
]
blocks=[];silhouettes=[]
for id,poly,label in regions:
    p=Polygon(poly);b=p.bounds
    points=[(x,y) for x,y in source_points if b[0]<=x<=b[2] and b[1]<=y<=b[3] and p.covers(Point(x,y))]
    # Exterior silhouette, deliberately without internal room voids. The detailed
    # section view below remains the unmodified architectural vector drawing.
    silhouette=MultiPoint(points).convex_hull.intersection(p).simplify(.6,preserve_topology=True)
    silhouettes.append(silhouette)
    markup=''.join(floor_lines[i] for i,d in enumerate(selected) if d['rect'].intersects(fitz.Rect(*b)))
    blocks.append({'id':id,'outline':svgpath(silhouette),'zone':path(poly),'bounds':[b[0]-15,b[1]-15,b[2]-b[0]+30,b[3]-b[1]+30],'label':label,'architecture':markup})
footprint=unary_union(silhouettes)
floor_svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="470 310 1630 2050"><style>:root{--wall:#948171;--context-line:#b8aa9b}</style>'+''.join(floor_lines)+'</svg>'
(OUT/'floor-architecture.svg').write_text(floor_svg)
(OUT/'floor-paths.json').write_text(json.dumps({'markup':''.join(floor_lines)},separators=(',',':')))
data={'rooms':rooms,'blocks':blocks,'sourceScale':18.33,'planView':[955,516,223,247], 'clip':audit['clip_in_source_coordinates'],'architecture':''.join(arch),'furniture':''.join(furn),'walls':wallfills,'footprint':svgpath(footprint),'themes':ns['THEMES'],'sourcePathCount':len(audit['paths']),'sourceHash':audit['geometry_sha256']}
(OUT/'workbench.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')))
for f in ['source-detail.png','source-section.png','01-graphite.svg','02-haven-sand.svg','03-sage.svg']:
    shutil.copy2(STUDY/f,OUT/f)
shutil.copy2(ROOT/'pdf/pdf/2-7.kat planı.pdf',OUT/'source.pdf')
for f in ['model-data.json','model-audit.json']:
    shutil.copy2(STUDY/'haven-02-3d'/f,OUT/f)
(OUT/'source-info.json').write_text(json.dumps({'source':audit['source'],'source_sha256':audit['source_sha256'],'paths':len(audit['paths']),'scope':'Apartment paths copied exactly from approved variants. Complex silhouette simplified from original linework; navigation zones are not legal boundaries. Floor selector uses the common 2–7 floor sheet.'},indent=2))
preview='<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100" viewBox="420 270 1730 2160"><rect x="420" y="270" width="1730" height="2160" fill="white"/>'+''.join(f'<path d="{b["outline"]}" fill="'+('#d7c3b7' if b['id']=='A3' else '#f5f0e9')+'" stroke="#9a8270" stroke-width="2"/>'+f'<text x="{b["label"][0]}" y="{b["label"][1]}" font-size="50" text-anchor="middle" fill="#84482e">{b["id"]}</text>' for b in blocks)+'</svg>'
(OUT/'complex-preview.svg').write_text(preview)
print('Saved workbench:',len(blocks),'sections,',len(rooms),'rooms,',len(audit['paths']),'unchanged source paths',flush=True)
