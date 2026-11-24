"""Insert diagrams into the FYP document automatically.

Put this script, the .docx file and all the images in the same folder, then run:
    pip3 install python-docx
    python3 insert_images.py

Every placeholder like  [Insert diagram: 04_use_case_diagram.png]  is replaced by that image.
The result is saved as a new file; the original is not changed.
"""
import re
from pathlib import Path

from docx import Document
from docx.image.image import Image as DocxImage
from docx.shared import Inches

FOLDER = Path(__file__).resolve().parent
SOURCE = FOLDER / "FYP_Farm_Animal_Activity_Recognition.docx"
OUTPUT = FOLDER / "FYP_Farm_Animal_Activity_Recognition_with_images.docx"
MAX_WIDTH, MAX_HEIGHT = 6.0, 7.5          # inches; keeps tall diagrams on one page
PATTERN = re.compile(r"\[Insert diagram:\s*([^\]]+?)\]")


def picture_size(path):
    img = DocxImage.from_file(str(path))
    w = img.px_width / img.horz_dpi if img.horz_dpi else img.px_width / 96
    h = img.px_height / img.vert_dpi if img.vert_dpi else img.px_height / 96
    scale = min(MAX_WIDTH / w, MAX_HEIGHT / h)
    return Inches(w * scale), Inches(h * scale)


def fix_list_fields(doc):
    """Older copies of the report used style IDs in the List of Tables / Figures fields,
    which Word cannot match, so the lists came out empty after an update. Fix them."""
    ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
    fixed = 0
    for el in doc.element.body.iter(ns + "instrText"):
        if el.text and ("TabCaption,1" in el.text or "FigCaption,1" in el.text):
            el.text = el.text.replace("TabCaption,1", "Table Caption,1").replace("FigCaption,1", "Figure Caption,1")
            fixed += 1
    return fixed


def main():
    doc = Document(SOURCE)
    if fix_list_fields(doc):
        print("Fixed the List of Tables / List of Figures fields")
    done, missing = [], []
    for para in doc.paragraphs:
        match = PATTERN.search(para.text)
        if not match:
            continue
        # file names may include a note in brackets, e.g. "results.png (runs/...)"
        name = match.group(1).split(" (")[0].strip()
        path = FOLDER / name
        if not path.exists():
            missing.append(name)
            continue
        # remove the dashed placeholder border and the placeholder text
        ppr = para._p.pPr
        if ppr is not None:
            for bdr in ppr.findall("{http://schemas.openxmlformats.org/wordprocessingml/2006/main}pBdr"):
                ppr.remove(bdr)
        for run in list(para.runs):
            run._r.getparent().remove(run._r)
        width, height = picture_size(path)
        para.add_run().add_picture(str(path), width=width, height=height)
        done.append(name)

    doc.save(OUTPUT)
    print(f"Inserted {len(done)} images -> {OUTPUT.name}")
    if missing:
        print("Not found in this folder (check the file names):")
        for m in missing:
            print("  -", m)


if __name__ == "__main__":
    main()
