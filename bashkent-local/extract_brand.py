"""Extract original outlined vector logo from the supplied guidebook."""
from pathlib import Path
from pypdf import PdfReader
from pypdf.generic import ContentStream
root=Path(__file__).resolve().parent
r=PdfReader(root.parent/'Haven. Guidebook.pdf')
matrix=(1,0,0,1,0,0); stack=[]; parts=[]; points=[]; selected=[]
def xy(x,y):
    a,b,c,d,e,f=matrix
    return (a*float(x)+c*float(y)+e,1080-(b*float(x)+d*float(y)+f))
def point(x,y):
    p=xy(x,y); points.append(p); return f'{p[0]:.3f} {p[1]:.3f}'
for args,op in ContentStream(r.pages[2].get_contents(),r).operations:
    if op==b'q': stack.append(matrix)
    elif op==b'Q': matrix=stack.pop()
    elif op==b'cm':
        a,b,c,d,e,f=matrix; A,B,C,D,E,F=map(float,args)
        matrix=(a*A+c*B,b*A+d*B,a*C+c*D,b*C+d*D,a*E+c*F+e,b*E+d*F+f)
    elif op in [b'm',b'l']: parts.append(('M' if op==b'm' else 'L')+point(*args))
    elif op==b'c': parts.append('C'+' '.join(point(*args[i:i+2]) for i in [0,2,4]))
    elif op==b'h': parts.append('Z')
    elif op==b'f':
        if points and all(165<=x<=715 and 182<=y<=550 for x,y in points): selected.append(' '.join(parts))
    elif op==b'n': parts=[]; points=[]
assert selected, 'No logo vectors found'
target=root/'site/assets/brand'; target.mkdir(parents=True,exist_ok=True)
for name,color in [('haven-logo','#4A3226'),('haven-logo-light','#D7C3B7')]:
    svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="165 182.5 550 367.5" fill="'+color+'">'+''.join('<path d="'+p+'"/>' for p in selected)+'</svg>'
    (target/(name+'.svg')).write_text(svg)
print(f'Extracted {len(selected)} original logo paths')
