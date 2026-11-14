#!/usr/bin/env python3
"""Open exported PPTX files with python-pptx and summarize native objects per slide.
Usage: python3 scripts/verify-pptx.py file1.pptx [file2.pptx ...]"""
import sys
from collections import Counter
from pptx import Presentation
from pptx.util import Emu

def kind(sh):
    if sh.has_chart: return 'chart:' + str(sh.chart.chart_type).split('.')[-1].split(' ')[0]
    if sh.has_table: return 'table'
    t = sh.shape_type
    name = str(t).split('.')[-1].split(' ')[0] if t is not None else 'SHAPE'
    if name == 'GROUP': return 'group(' + str(len(sh.shapes)) + ')'
    if sh.has_text_frame and sh.text_frame.text.strip(): return name + '+text'
    return name

ok = True
for path in sys.argv[1:]:
    try:
        prs = Presentation(path)
    except Exception as e:  # noqa
        print(f'FAIL {path}: {e}'); ok = False; continue
    print(f'== {path}: {len(prs.slides)} slides, size {Emu(prs.slide_width).inches:.2f}x{Emu(prs.slide_height).inches:.2f} in')
    for i, s in enumerate(prs.slides, 1):
        c = Counter(kind(sh) for sh in s.shapes)
        notes = s.notes_slide.notes_text_frame.text.strip() if s.has_notes_slide else ''
        print(f'  slide {i:2d}: {dict(c)}  notes={len(notes)} chars')
print('OK' if ok else 'FAILED')
sys.exit(0 if ok else 1)
