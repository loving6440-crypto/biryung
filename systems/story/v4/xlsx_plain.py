"""Small, dependency-free XLSX cell value reader, preserving the source row number.
This reads raw OOXML cells; does not modify the source spreadsheet.
"""
import posixpath
import re
import zipfile
import xml.etree.ElementTree as ET

M = '{http://schemas.openxmlformats.org/spreadsheetml/2006/main}'
R = '{http://schemas.openxmlformats.org/officeDocument/2006/relationships}'


def read_rows(file_name, sheet_title):
    with zipfile.ZipFile(file_name) as z:
        book = ET.fromstring(z.read('xl/workbook.xml'))
        sheet = next(x for x in book.find(M + 'sheets') if x.get('name') == sheet_title)
        rels = ET.fromstring(z.read('xl/_rels/workbook.xml.rels'))
        target = next(x.get('Target') for x in rels if x.get('Id') == sheet.get(R + 'id'))
        target = target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join('xl', target))
        strings = []
        if 'xl/sharedStrings.xml' in z.namelist():
            strings = [''.join(e.text or '' for e in si.iter(M + 't')) for si in ET.fromstring(z.read('xl/sharedStrings.xml')).iter(M + 'si')]
        root = ET.fromstring(z.read(target))
        out = []
        for row in root.find(M + 'sheetData'):
            n = int(row.get('r'))
            columns = [None] * 11
            for cell in row:
                ref = cell.get('r', '')
                found = re.match(r'[A-Z]+', ref)
                if not found: continue
                k = 0
                for c in found.group(): k = k * 26 + ord(c) - 64
                if k < 1 or k > len(columns): continue
                if cell.get('t') == 'inlineStr':
                    value = ''.join(e.text or '' for e in cell.iter(M + 't'))
                else:
                    v = cell.find(M + 'v')
                    value = v.text if v is not None else None
                    if value is not None and cell.get('t') == 's': value = strings[int(value)]
                columns[k - 1] = value
            out.append((n, columns))
        return out
