"""Parses an SSC CGL paper PDF into JSON for scripts/import-response-sheets.mjs.

Two layouts are recognised:
  response  A printed SSC response sheet ("Q.1 ... Ans 1. ... Question ID :").
            The correct option carries a different icon from the others (SSC's
            tick), so the answer is SSC's own key.
  typed     A typed paper ("1. ... a. ... (+2, -0.5)") with an answer list at
            the end ("1. Answer: b"). Only the letter is kept, not explanations.

Figures (diagrams, figure options, typeset maths) are cropped from the page
into --images DIR as PNGs named by content hash, and attached to the question
or to the option they sit beside. Candidate details on response sheets are
never read out.

Usage: uv run --no-project --with pdfplumber==0.11.4 python -I scripts/pdf/parse_paper.py in.pdf out.json [--shift N] [--images DIR]
"""
import collections
import hashlib
import io
import json
import os
import re
import sys

import pdfplumber
import pypdfium2 as pdfium
import pypdfium2.raw as pdfium_c
from PIL import Image

ICON_MAX = 18  # option tick/cross icons are about 8-15 pt square
ICON_COLUMN_SLACK = 10  # tick and cross icons start a few pt apart in one column
FIGURE_MIN_SIDE = 4
FIGURE_DPI = 150
MARKING_NOTE = re.compile(r"\(\+2,\s*-0\.5\)")

HEADER_LINE = re.compile(
    r"^(Combined Graduate Level Examination.*|Roll Number.*|Candidate Name.*|Venue Name.*|Exam Date.*|Exam Time.*|Subject.*"
    r"|Option \d ID\s*:.*|Status\s*:.*|Chosen Option\s*:.*|Total Marks.*|Total Time.*)$"
)
SECTION_LINE = re.compile(r"^(?:Section\s*:\s*)?(General Intelligence and Reasoning|General Awareness|Quantitative Aptitude|English Comprehension)\s*$", re.I)


def load_items(pdf):
    """Every text line, option icon and figure, in reading order, tagged with its page."""
    pages = pdf.pages
    repeat = collections.Counter()
    for p in pages:
        for im in p.images:
            repeat[(round(im["x0"]), round(im["top"]), round(im["width"]), round(im["height"]))] += 1
    # Logos and watermarks sit at the same spot on most pages.
    furniture = {k for k, n in repeat.items() if n >= max(3, len(pages) // 2)}

    items = []
    for pn, p in enumerate(pages):
        page_items = []
        for line in p.extract_text_lines():
            page_items.append({"kind": "text", "top": line["top"], "x0": line["x0"], "text": line["text"].strip()})
        for im in p.images:
            key = (round(im["x0"]), round(im["top"]), round(im["width"]), round(im["height"]))
            if key in furniture:
                continue
            if im["width"] <= ICON_MAX and im["height"] <= ICON_MAX:
                kind = "small"  # a tick icon or small content; see classify_small
            elif im["width"] >= FIGURE_MIN_SIDE and im["height"] >= FIGURE_MIN_SIDE:
                kind = "figure"
            else:
                continue
            page_items.append({
                "kind": kind, "top": im["top"], "bottom": im["bottom"], "x0": im["x0"], "x1": im["x1"],
                "size": (round(im["width"]), round(im["height"])),
            })
        page_items.sort(key=lambda it: (round(it["top"]), it["x0"]))
        for it in page_items:
            it["page"] = pn
        items.extend(page_items)
    return items


def classify_small(items, layout):
    """Response sheets put a tick/cross icon left of every option, so the icons
    are the most common small image and share one column (its x varies between
    sheets with the print scale). Other small images, and every small image in
    typed papers, are content such as typeset maths."""
    small = [it for it in items if it["kind"] == "small"]
    column = None
    if layout == "response" and small:
        column = collections.Counter(round(it["x0"]) for it in small).most_common(1)[0][0]
    for it in small:
        is_icon = column is not None and it["x0"] <= column + ICON_COLUMN_SLACK
        it["kind"] = "icon" if is_icon else "figure" if it["size"][0] >= FIGURE_MIN_SIDE and it["size"][1] >= FIGURE_MIN_SIDE else "skip"


def detect_layout(items):
    text = "\n".join(it["text"] for it in items[:400] if it["kind"] == "text")
    if re.search(r"^Q\.\d+", text, re.M) and "Question ID" in text:
        return "response"
    if MARKING_NOTE.search(text):
        return "typed"
    raise SystemExit("Unrecognised paper layout: neither an SSC response sheet nor a typed paper")


def read_meta(items, layout):
    text = "\n".join(it["text"] for it in items[:200] if it["kind"] == "text")
    meta = {"layout": layout, "tier": 2 if re.search(r"Tier[\s-]*(II|2)\b", text) else 1}
    m = re.search(r"Examination (20\d\d)", text) or re.search(r"SSC CGL (20\d\d)", text)
    meta["year"] = int(m.group(1)) if m else None
    m = re.search(r"Exam Date\s*:?\s*(\d{2})/(\d{2})/(\d{4})", text)
    if m:
        meta["date"] = f"{m.group(3)}-{m.group(2)}-{m.group(1)}"
    m = re.search(r"Exam Time\s*:?\s*([\d:]+\s*[AP]M\s*-\s*[\d:]+\s*[AP]M)", text)
    if m:
        meta["time"] = m.group(1)
    m = re.search(r"\((\d{1,2})-(\w{3})-(20\d\d)\)\s*\(Shift (\d)\)", text)
    if m:
        month = "JanFebMarAprMayJunJulAugSepOctNovDec".index(m.group(2)[:3].title()) // 3 + 1
        meta["date"] = f"{m.group(3)}-{month:02d}-{int(m.group(1)):02d}"
        meta["shift"] = int(m.group(4))
    return meta


def pos(it):
    return (it["page"], it["top"])


def new_question(section, number, it):
    return {"section": section, "number": number, "lines": [], "options": [], "answer": None, "qid": None,
            "icons": [], "start": pos(it), "end": None}


def parse_response(items):
    questions, section, passage, cur, in_options, in_passage = [], None, None, None, False, False
    for it in items:
        if it["kind"] not in ("text", "icon"):
            continue  # figures are attached by position afterwards
        if it["kind"] == "icon":
            # Icons sit a point above their option's text, so option 1's icon
            # arrives before the "Ans 1." line: collect from the question start.
            if cur and cur["end"] is None:
                cur["icons"].append(it)
            continue
        t = it["text"]
        m = SECTION_LINE.match(t)
        if m:
            section, passage = m.group(1), None
            continue
        if t.startswith("Comprehension"):
            passage, in_passage = [], True
            rest = t.split(":", 1)[1].strip() if ":" in t else ""
            if rest:
                passage.append(rest)
            continue
        if t.startswith("SubQuestion No"):
            in_passage = False
            continue
        m = re.match(r"^Q\.(\d+)\s*(.*)$", t)
        if m:
            in_passage = False
            cur = new_question(section, int(m.group(1)), it)
            if passage:
                cur["passage"] = " ".join(passage)
            if m.group(2):
                cur["lines"].append(m.group(2))
            questions.append(cur)
            in_options = False
            continue
        if in_passage and passage is not None:
            if not HEADER_LINE.match(t):
                passage.append(t)
            continue
        if not cur or cur["end"] is not None:
            continue
        if t.startswith("Question ID"):
            cur["qid"] = t.split(":", 1)[1].strip()
            cur["end"] = pos(it)
            in_options = False
            continue
        if HEADER_LINE.match(t):
            continue
        m = re.match(r"^(?:Ans\s*)?([1-4])\.\s*(.*)$", t)
        if (t.startswith("Ans") or in_options) and m:
            in_options = True
            cur["options"].append({"text": m.group(2).strip(), "top": it["top"], "page": it["page"]})
            continue
        if t == "Ans":
            in_options = True
            continue
        if in_options and cur["options"]:
            cur["options"][-1]["text"] += " " + t
        else:
            cur["lines"].append(t)

    for q in questions:
        q["answer"] = ticked_option(q)
    return questions


def ticked_option(q):
    """Index of the option whose icon differs from the other options' icons."""
    if len(q["options"]) < 2:
        return None
    sizes = []
    for opt in q["options"]:
        near = [ic for ic in q["icons"] if ic["page"] == opt["page"] and abs(ic["top"] - opt["top"]) < 6]
        sizes.append(near[0]["size"] if near else None)
    if None in sizes:
        return None
    counts = collections.Counter(sizes)
    odd = [i for i, s in enumerate(sizes) if counts[s] == 1]
    return odd[0] if len(odd) == 1 and len(counts) == 2 else None


def parse_typed(items):
    questions, answers, section, cur, expect, in_answers = [], {}, None, None, 1, False
    for it in items:
        if it["kind"] != "text":
            continue
        t = it["text"]
        m = re.match(r"^(\d{1,3})\.\s*Answer:\s*([a-d])\b", t, re.I)
        if m:
            if not in_answers and cur:
                cur["end"] = pos(it)
            in_answers = True
            answers[int(m.group(1))] = "abcd".index(m.group(2).lower())
            continue
        if in_answers:
            continue
        m = SECTION_LINE.match(t)
        if m:
            section = m.group(1)
            continue
        m = re.match(r"^(\d{1,3})\.\s*(.*)$", t)
        # The instructions page is numbered too ("1. Test will auto submit..."):
        # questions only start under the first section heading.
        if m and section and int(m.group(1)) == expect:
            if cur:
                cur["end"] = pos(it)
            cur = new_question(section, expect, it)
            if m.group(2):
                cur["lines"].append(m.group(2))
            questions.append(cur)
            expect += 1
            continue
        if not cur:
            continue
        if MARKING_NOTE.fullmatch(t):
            continue
        m = re.match(r"^([a-d])\.\s*(.*)$", t)
        if m and len(cur["options"]) == "abcd".index(m.group(1)):
            cur["options"].append({"text": m.group(2).strip(), "top": it["top"], "page": it["page"]})
            continue
        if cur["options"]:
            cur["options"][-1]["text"] += " " + t
        elif not HEADER_LINE.match(t):
            cur["lines"].append(t)
    if cur and cur["end"] is None:
        cur["end"] = (10**6, 0)
    for q in questions:
        q["answer"] = answers.get(q["number"])
    return questions


def attach_figures(pdf, items, questions, images_dir):
    """Crops each figure and attaches it to the question it falls inside, or
    to the option whose line sits beside it."""
    for q in questions:
        q["figures"], q["optionFigures"] = [], {}
    for fig in (it for it in items if it["kind"] == "figure"):
        centre = (fig["page"], (fig["top"] + fig["bottom"]) / 2)
        # A figure can start a hair above its question's first line.
        owner = next((q for q in questions if (q["start"][0], q["start"][1] - 8) <= centre and (q["end"] is None or centre <= q["end"])), None)
        if not owner:
            continue
        name = save_figure(pdf, fig, images_dir)
        if not name:
            continue
        opt = next((i for i, o in enumerate(owner["options"])
                    if o["page"] == fig["page"] and fig["top"] - 4 <= o["top"] <= fig["bottom"] + 4), None)
        if opt is not None and opt not in owner["optionFigures"]:
            owner["optionFigures"][opt] = name
        else:
            owner["figures"].append(name)


def save_figure(pdf, fig, images_dir):
    """Extracts the figure's own image object, not a crop of the rendered page,
    so a site watermark drawn underneath it is left out. w/h are the printed
    size in points, which the app uses to size it."""
    if not images_dir:
        return {"file": None}
    img = extract_image_object(pdf, fig)
    if img is None:
        page = pdf.pages[fig["page"]]
        box = (max(0, fig["x0"]), max(0, fig["top"]), min(page.width, fig["x1"]), min(page.height, fig["bottom"]))
        img = page.crop(box).to_image(resolution=FIGURE_DPI).original
    # Flatten transparency onto white, then a palette: line drawings need few colours.
    if img.mode in ("RGBA", "LA", "P"):
        img = img.convert("RGBA")
        bg = Image.new("RGBA", img.size, (255, 255, 255, 255))
        img = Image.alpha_composite(bg, img)
    img = img.convert("RGB").quantize(colors=64)
    buf = io.BytesIO()
    img.save(buf, format="PNG", optimize=True)
    data = buf.getvalue()
    name = hashlib.sha1(data).hexdigest()[:16] + ".png"
    path = os.path.join(images_dir, name)
    if not os.path.exists(path):
        with open(path, "wb") as f:
            f.write(data)
    return {"file": name, "w": round(fig["x1"] - fig["x0"]), "h": round(fig["bottom"] - fig["top"])}


_pdfium_docs = {}


def extract_image_object(pdf, fig):
    """The PDF image object at the figure's position, rendered on its own."""
    doc = _pdfium_docs.get(pdf.stream.name)
    if doc is None:
        doc = _pdfium_docs[pdf.stream.name] = pdfium.PdfDocument(pdf.stream.name)
    page = doc[fig["page"]]
    height = page.get_height()
    want = (fig["x0"], height - fig["bottom"], fig["x1"], height - fig["top"])
    best, best_err = None, 3.0
    for obj in page.get_objects(filter=[pdfium_c.FPDF_PAGEOBJ_IMAGE], max_depth=3):
        err = max(abs(a - b) for a, b in zip(obj.get_bounds(), want))
        if err < best_err:
            best, best_err = obj, err
    if best is None:
        return None
    try:
        return best.get_bitmap(render=True, scale_to_original=True).to_pil()
    except Exception:
        return None


def finish(q):
    # Typed papers print "(+2, -0.5)" after each question; across a page break it lands mid-text.
    lines = [MARKING_NOTE.sub(" ", line).strip() for line in q["lines"]]
    text = re.sub(r"[ \t]+", " ", " ".join(line for line in lines if line)).strip()
    if q.get("passage"):
        text = f"{q['passage']}\n\n{text}"
    options = [re.sub(r"\s+", " ", MARKING_NOTE.sub(" ", o["text"])).strip() for o in q["options"]]
    figures = [f for f in q.get("figures", []) if f.get("file")]
    option_figures = {str(i): f for i, f in q.get("optionFigures", {}).items() if f.get("file")}
    complete = len(options) >= 2 and all(o or str(i) in option_figures for i, o in enumerate(options)) and (text or figures)
    return {
        "number": q["number"],
        "section": q["section"],
        "question": text,
        "options": options,
        "answer": q["answer"],
        "qid": q["qid"],
        "figures": figures,
        "optionFigures": option_figures,
        "incomplete": not complete,
    }


def main():
    args = sys.argv[1:]
    src, out = args[0], args[1]
    images_dir = args[args.index("--images") + 1] if "--images" in args else None
    if images_dir:
        os.makedirs(images_dir, exist_ok=True)
    with pdfplumber.open(src) as pdf:
        items = load_items(pdf)
        layout = detect_layout(items)
        classify_small(items, layout)
        meta = read_meta(items, layout)
        raw = parse_response(items) if layout == "response" else parse_typed(items)
        attach_figures(pdf, items, raw, images_dir)
    if "--shift" in args:
        meta["shift"] = int(args[args.index("--shift") + 1])
    questions = [finish(q) for q in raw]
    meta["answerSource"] = "ssc-key" if layout == "response" else "typed-key"
    with open(out, "w", encoding="utf-8") as f:
        json.dump({"meta": meta, "questions": questions}, f, ensure_ascii=False, indent=1)
    answered = sum(q["answer"] is not None for q in questions)
    with_figs = sum(bool(q["figures"] or q["optionFigures"]) for q in questions)
    incomplete = sum(q["incomplete"] for q in questions)
    print(f"{layout}: {len(questions)} questions, {answered} with answers, {with_figs} with figures, {incomplete} incomplete  ({meta})")


if __name__ == "__main__":
    main()
