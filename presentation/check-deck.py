#!/usr/bin/env python3
"""Fail if any shape falls outside the slide.

Written after the whole deck shipped clipped: every coordinate was authored for
a 13.333 x 7.5in canvas while the slide was declared 10 x 5.625in — the same
aspect ratio, so nothing looked distorted and 210 shapes were simply cut off the
right edge. Geometry is checkable; eyeballing 18 slides is not.

    python3 check-deck.py "Helm - הצעה לפיילוט.pptx"
"""
import zipfile, re, sys
from xml.etree import ElementTree as ET
NS={'a':'http://schemas.openxmlformats.org/drawingml/2006/main'}
EMU=914400
f=sys.argv[1]
z=zipfile.ZipFile(f)
pres=z.read("ppt/presentation.xml").decode()
m=re.search(r'sldSz[^/]*cx="(\d+)"\s+cy="(\d+)"',pres)
W,H=int(m.group(1)),int(m.group(2))
print(f"slide: {W/EMU:.3f}in x {H/EMU:.3f}in")
names=sorted([n for n in z.namelist() if re.match(r'ppt/slides/slide\d+\.xml$',n)],
             key=lambda n:int(re.search(r'(\d+)',n.split('/')[-1]).group(1)))
bad=[]; total=0
for n in names:
    idx=int(re.search(r'(\d+)',n.split('/')[-1]).group(1))
    root=ET.fromstring(z.read(n))
    for sp in root.iter():
        if sp.tag.split('}')[-1] not in ('sp','pic','graphicFrame','cxnSp'): continue
        xfrm=sp.find('.//a:xfrm',NS)
        if xfrm is None: continue
        off=xfrm.find('a:off',NS); ext=xfrm.find('a:ext',NS)
        if off is None or ext is None: continue
        total+=1
        x,y=int(off.get('x')),int(off.get('y')); cx,cy=int(ext.get('cx')),int(ext.get('cy'))
        txt=''.join(t.text or '' for t in sp.iter('{%s}t'%NS['a']))[:40]
        over=[]
        tol=1000
        if x<-tol: over.append(f"left {x/EMU:.2f}in")
        if y<-tol: over.append(f"top {y/EMU:.2f}in")
        if x+cx>W+tol: over.append(f"right +{(x+cx-W)/EMU:.2f}in")
        if y+cy>H+tol: over.append(f"bottom +{(y+cy-H)/EMU:.2f}in")
        if over: bad.append((idx,', '.join(over),f"x={x/EMU:.2f} y={y/EMU:.2f} w={cx/EMU:.2f} h={cy/EMU:.2f}",txt))
print(f"{len(names)} slides · {total} positioned shapes · outside the slide: {len(bad)}")
for b in bad: print(f"  slide {b[0]:2}  {b[1]:26} {b[2]}  «{b[3]}»")
sys.exit(1 if bad else 0)
