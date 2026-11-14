#!/usr/bin/env python3
"""Generate a PowerPoint deck with python-pptx (default template) for PPTX-import tests.

Usage: python3 scripts/make-test-pptx.py out.pptx
Slides: title placeholder, bulleted body (2 levels), table, column chart, picture + group + notes.
"""
import io
import struct
import sys
import zlib

from pptx import Presentation
from pptx.chart.data import CategoryChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE
from pptx.enum.shapes import MSO_SHAPE
from pptx.util import Inches, Pt


def png_bytes(w=8, h=8, rgb=(37, 99, 235)):
    raw = b''.join(b'\x00' + bytes(rgb) * w for _ in range(h))
    def chunk(t, d):
        return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    return b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', w, h, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw)) + chunk(b'IEND', b'')


def main(out):
    prs = Presentation()
    prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)

    s = prs.slides.add_slide(prs.slide_layouts[0])
    s.shapes.title.text = 'Quarterly Review'
    s.placeholders[1].text = 'Results and next steps'

    s = prs.slides.add_slide(prs.slide_layouts[1])
    s.shapes.title.text = 'Agenda'
    tf = s.placeholders[1].text_frame
    tf.text = 'Revenue grew 18%'
    p = tf.add_paragraph(); p.text = 'Online channel'; p.level = 1
    p = tf.add_paragraph(); p.text = 'Costs under control'
    r = p.add_run(); r.text = ' (bold part)'; r.font.bold = True

    s = prs.slides.add_slide(prs.slide_layouts[5])
    s.shapes.title.text = 'Sales by region'
    rows = [['Region', 'Q1', 'Q2'], ['North', '10', '12'], ['South', '8', '9']]
    tbl = s.shapes.add_table(3, 3, Inches(1), Inches(2), Inches(8), Inches(2)).table
    for i, row in enumerate(rows):
        for j, v in enumerate(row):
            tbl.cell(i, j).text = v

    s = prs.slides.add_slide(prs.slide_layouts[5])
    s.shapes.title.text = 'Monthly trend'
    cd = CategoryChartData(); cd.categories = ['Jan', 'Feb', 'Mar']; cd.add_series('Sales', (10, 20, 15))
    s.shapes.add_chart(XL_CHART_TYPE.COLUMN_CLUSTERED, Inches(1), Inches(1.5), Inches(8), Inches(5), cd)

    s = prs.slides.add_slide(prs.slide_layouts[6])
    s.shapes.add_picture(io.BytesIO(png_bytes()), Inches(1), Inches(1), Inches(3), Inches(3))
    grp = s.shapes.add_group_shape()
    a = grp.shapes.add_shape(MSO_SHAPE.ROUNDED_RECTANGLE, Inches(6), Inches(1), Inches(3), Inches(1.5))
    a.text = 'Grouped A'
    a.fill.solid(); a.fill.fore_color.rgb = RGBColor(0x16, 0xA3, 0x4A)
    b = grp.shapes.add_shape(MSO_SHAPE.OVAL, Inches(6), Inches(3), Inches(2), Inches(2))
    b.text = 'Grouped B'
    tb = s.shapes.add_textbox(Inches(1), Inches(5), Inches(5), Inches(1))
    tb.text_frame.text = 'Tiếng Việt có dấu'
    tb.text_frame.paragraphs[0].runs[0].font.size = Pt(28)
    s.notes_slide.notes_text_frame.text = 'Ghi chú cho người thuyết trình'

    prs.save(out)


if __name__ == '__main__':
    main(sys.argv[1] if len(sys.argv) > 1 else 'test.pptx')
