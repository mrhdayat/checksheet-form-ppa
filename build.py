"""Build site/t/ + site/data.json from template-checksheet/*.xlsx.
Needs macOS with Microsoft Excel + swiftc (Xcode command line tools).

  python3 build.py          build (skips templates that haven't changed)
  python3 build.py --all    rebuild everything (e.g. after config.json changes)
  python3 build.py test     self-check
"""
import html, json, re, shutil, subprocess, sys, zipfile
from datetime import date
from pathlib import Path

ROOT = Path(__file__).parent
SRC = ROOT / "template-checksheet"
OUT = ROOT / "site"
TOOL = ROOT / "tools" / ".pages"  # compiled tools/pages.swift
EXCEL = Path.home() / "Library/Containers/com.microsoft.Excel/Data/build"  # Excel sandbox: no permission prompts
CONFIG = json.loads((ROOT / "config.json").read_text())
A4 = {(595, 842), (842, 595)}


# ---------- xlsx edits (raw XML; openpyxl would drop shapes/images) ----------
def fix_text(xml):
    for pat, rep in CONFIG["replace"]:
        xml = re.sub(pat, rep, xml)
    return xml


def fix_page(xml):
    """A4, 1 sheet = 1 page."""
    def setup(m):
        attrs = re.sub(r'\s(paperSize|scale|fitToWidth|fitToHeight)="[^"]*"', "", m.group(1))
        return f'<pageSetup paperSize="9" fitToWidth="1" fitToHeight="1"{attrs}/>'
    if "<pageSetup" in xml:
        xml = re.sub(r"<pageSetup([^>]*?)/>", setup, xml, count=1)
    else:
        xml = re.sub(r"(<pageMargins[^>]*/>)", r'\1<pageSetup paperSize="9" fitToWidth="1" fitToHeight="1"/>', xml, count=1)
    if "<pageSetUpPr" in xml:
        xml = re.sub(r"<pageSetUpPr([^>]*?)/>",
                     lambda m: "<pageSetUpPr" + re.sub(r'\sfitToPage="[^"]*"', "", m.group(1)) + ' fitToPage="1"/>', xml)
    elif re.search(r"<sheetPr[^>]*/>", xml):
        xml = re.sub(r"<sheetPr([^>]*)/>", r'<sheetPr\1><pageSetUpPr fitToPage="1"/></sheetPr>', xml, count=1)
    elif "<sheetPr" in xml:
        xml = xml.replace("</sheetPr>", '<pageSetUpPr fitToPage="1"/></sheetPr>', 1)
    else:
        xml = re.sub(r"(<worksheet[^>]*>)", r'\1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>', xml, count=1)
    return xml


def prep(src, dst):
    with zipfile.ZipFile(src) as zin, zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as zout:
        for item in zin.infolist():
            data, name = zin.read(item.filename), item.filename
            if name.endswith(".xml") and (name == "xl/sharedStrings.xml" or name.startswith(("xl/worksheets/sheet", "xl/drawings/"))):
                xml = fix_text(data.decode("utf-8"))
                if name.startswith("xl/worksheets/sheet"):
                    xml = fix_page(xml)
                data = xml.encode("utf-8")
            zout.writestr(item, data)


def visible_sheets(xlsx):
    wb = zipfile.ZipFile(xlsx).read("xl/workbook.xml").decode("utf-8")
    return [html.unescape(re.search(r'name="([^"]*)"', s).group(1)).strip()
            for s in re.findall(r"<sheet\s[^>]*>", wb) if 'state="hidden"' not in s and 'state="veryHidden"' not in s]


# ---------- naming ----------
def template_id(stem):
    return CONFIG["ids"].get(stem) or stem.lower().removeprefix("template-khusus-")


def title(tid):
    words = tid.split("-")[1:]
    return " ".join("&" if w == "dan" else w.title() if w in CONFIG["title_case"] else w.upper() for w in words)


# ---------- external tools ----------
def excel_pdf(xlsx, pdf):
    script = f'''tell application "Microsoft Excel"
  set display alerts to false
  set wb to open workbook workbook file name (POSIX file "{xlsx}" as text)
  save workbook as wb filename (POSIX file "{pdf}" as text) file format PDF file format
  close wb saving no
end tell'''
    subprocess.run(["osascript", "-e", script], check=True, capture_output=True)


def render(pdf, outdir):
    if not TOOL.exists() or TOOL.stat().st_mtime < (ROOT / "tools/pages.swift").stat().st_mtime:
        subprocess.run(["swiftc", "-O", str(ROOT / "tools/pages.swift"), "-o", str(TOOL)], check=True)
    out = subprocess.run([str(TOOL), str(pdf), str(outdir), ",".join(CONFIG["forbidden"])],
                         check=True, capture_output=True, text=True).stdout
    return json.loads(out)


# ---------- main ----------
def build_one(src, tid, d):
    EXCEL.mkdir(parents=True, exist_ok=True)
    x, p = EXCEL / f"{tid}.xlsx", EXCEL / f"{tid}.pdf"
    prep(src, x)
    excel_pdf(x, p)
    if d.exists():
        shutil.rmtree(d)
    d.mkdir(parents=True)
    shutil.copy(x, d / f"{tid}.xlsx")
    shutil.copy(p, d / f"{tid}.pdf")
    info = render(p, d)
    sheets = visible_sheets(x)
    errors = []
    if len(info["pages"]) != len(sheets):
        errors.append(f"{len(info['pages'])} pages but {len(sheets)} visible sheets")
    if any(tuple(s) not in A4 for s in info["pages"]):
        errors.append(f"non-A4 pages: {sorted({tuple(s) for s in info['pages']} - A4)}")
    if info["bad"]:
        errors.append(f"forbidden text still on pages {info['bad']}")
    if errors:
        shutil.rmtree(d)
        raise SystemExit(f"FAIL {src.name}: " + "; ".join(errors))
    (d / "meta.json").write_text(json.dumps({
        "sheets": [{"name": n, "landscape": w > h} for n, (w, h) in zip(sheets, info["pages"])],
        "updated": date.fromtimestamp(src.stat().st_mtime).isoformat(),
    }))


def main(force=False):
    stale = max((ROOT / f).stat().st_mtime for f in ("config.json", "build.py", "tools/pages.swift"))
    items = []
    for src in sorted(SRC.glob("*.xlsx")):
        if src.name.startswith("~$"):  # Excel lock file
            continue
        tid = template_id(src.stem)
        d = OUT / "t" / tid
        meta = d / "meta.json"
        if force or not meta.exists() or meta.stat().st_mtime < max(src.stat().st_mtime, stale):
            print("build", tid, flush=True)
            build_one(src, tid, d)
        m = json.loads(meta.read_text())
        items.append({"id": tid, "title": title(tid), "category": CONFIG["categories"][tid.split("-")[0]],
                      "size": (d / f"{tid}.pdf").stat().st_size, **m})
    for old in (OUT / "t").iterdir():  # template removed from template-checksheet/
        if old.is_dir() and old.name not in {i["id"] for i in items}:
            shutil.rmtree(old)
    (OUT / "data.json").write_text(json.dumps(items, ensure_ascii=False, separators=(",", ":")))
    print(f"ok: {len(items)} templates, {sum(len(i['sheets']) for i in items)} sheets")


def test():
    x = '<worksheet a="1"><sheetPr><tabColor rgb="1"/></sheetPr><pageMargins left="0"/><pageSetup paperSize="1" scale="74" orientation="landscape"/></worksheet>'
    y = fix_page(x)
    assert 'fitToHeight="1"' in y and "scale" not in y and 'orientation="landscape"' in y, y
    assert '<tabColor rgb="1"/><pageSetUpPr fitToPage="1"/></sheetPr>' in y, y
    assert '<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>' in fix_page("<worksheet><pageMargins/></worksheet>")
    assert fix_text("<t>PPA-BIB-F-PLT-20BDG Rev 1</t><t>x - Girimulya/BIB</t>") == "<t></t><t>x</t>"
    assert fix_text("<t>PPA-BIB-F-PLT- 20BDG REV 1</t>") == "<t></t>"
    assert title("truck-lt-axor-mercy") == "LT Axor Mercy"
    assert title("truck-thds-dan-thdh") == "THDS & THDH"
    assert template_id("PPA-BIB-F-PLT-20BDG REV1 PERIODICAL MAINTENANCE CHECKSHEET COMPRESSOR ELECTRIC") == "compressor-electric"
    print("ok")


if __name__ == "__main__":
    test() if sys.argv[1:2] == ["test"] else main(force="--all" in sys.argv)
