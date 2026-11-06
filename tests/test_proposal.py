import copy
from pathlib import Path

from pptx import Presentation

from pptgen.cli import main
from pptgen.disclosure import render_disclosure
from pptgen.model import lint_proposal, load_proposal, planned_slide_count, validate
from pptgen.render import render_pptx
from pptgen.theme import footer_text

EXAMPLE = Path("examples/e-platform-rear/proposal.yaml")


def test_example_validates():
    deck = load_proposal(EXAMPLE)
    assert deck["meta"]["example"] is True
    assert len(deck["proposals"]) == 3
    assert validate(deck) == []
    assert lint_proposal(deck) == []


def test_banned_phrase_and_thin_embodiment_fail():
    deck = load_proposal(EXAMPLE)
    banned = copy.deepcopy(deck)
    banned["titles"]["platform"] = "赋能后的行业领先平台"
    errors = validate(banned)
    assert any("赋能" in item for item in errors)
    assert any("行业领先" in item for item in errors)

    thin = copy.deepcopy(deck)
    thin["proposals"][0]["embodiments"] = thin["proposals"][0]["embodiments"][:1]
    assert any("两个实施方式" in item for item in validate(thin))

    wording = copy.deepcopy(deck)
    wording["proposals"][0]["embodiments"][0]["difference"] = "只是更换了材料名称"
    assert any("相对" in item for item in validate(wording))


def test_effect_must_cite_essential_feature_and_real_data():
    deck = load_proposal(EXAMPLE)
    missing = copy.deepcopy(deck)
    missing["proposals"][0]["effects"][0]["feature_ids"] = ["R1"]
    missing["proposals"][0]["effects"][0]["rank"] = "优选"
    errors = validate(missing)
    assert any("没有被任何必要效果引用" in item for item in errors)

    invented = copy.deepcopy(deck)
    invented["proposals"][0]["effects"][0]["value"] = "前束改善百分之二十"
    assert any("已有数据" in item for item in validate(invented))


def test_method_needs_structure_and_roadmap_needs_search():
    deck = load_proposal(EXAMPLE)
    method = copy.deepcopy(deck)
    method["proposals"][0]["claim_type"] = "方法"
    assert any("structure_basis" in item for item in validate(method))

    roadmap = copy.deepcopy(deck)
    for step in roadmap["roadmap"]:
        step["phase"] = step["phase"].replace("检索", "复核")
        step["work"] = step["work"].replace("检索", "复核")
        step["gate"] = step["gate"].replace("检索", "复核")
    assert any("检索关口" in item for item in validate(roadmap))


def test_render_and_disclosure(tmp_path):
    deck = load_proposal(EXAMPLE)
    path = tmp_path / "deck.pptx"
    render_pptx(deck, path)
    presentation = Presentation(path)
    assert len(presentation.slides) == planned_slide_count(deck) == 23
    text = "\n".join(
        shape.text_frame.text
        for slide in presentation.slides
        for shape in slide.shapes
        if shape.has_text_frame
    )
    assert footer_text(deck) in text
    assert "合力作用线不穿过衬套中心" in text
    assert "摄像头预瞄" in text
    assert "保证授权" not in text
    assert "行业领先" not in text
    markdown = render_disclosure(deck)
    assert "技术交底书骨架" in markdown
    for proposal in deck["proposals"]:
        assert proposal["name"] in markdown
    assert "本次不写入交底" in markdown


def test_example_flag_changes_footer_only():
    deck = load_proposal(EXAMPLE)
    assert footer_text(deck).endswith("示例")
    plain = copy.deepcopy(deck)
    plain["meta"]["example"] = False
    assert "示例" not in footer_text(plain)
    assert "非正式专利法律意见" in footer_text(plain)


def test_intro_deck_is_two_pages_each(tmp_path):
    deck = load_proposal(Path("proposals/two-intro/proposal.yaml"))
    assert deck["meta"]["deck"] == "intro"
    assert planned_slide_count(deck) == 4
    assert lint_proposal(deck) == []
    path = tmp_path / "intro.pptx"
    render_pptx(deck, path)
    presentation = Presentation(path)
    assert len(presentation.slides) == 4
    text = "\n".join(
        shape.text_frame.text
        for slide in presentation.slides
        for shape in slide.shapes
        if shape.has_text_frame
    )
    assert "电池" not in text
    assert "内点衬套" in text
    assert "轴距" in text
    assert "柔性颈" not in text
    assert "斜孔" not in text
    single = copy.deepcopy(deck)
    single["proposals"] = deck["proposals"][:1]
    single_path = tmp_path / "one-intro.pptx"
    render_pptx(single, single_path)
    assert len(Presentation(single_path).slides) == 2


def test_one_proposal_still_renders(tmp_path):
    deck = load_proposal(EXAMPLE)
    deck["proposals"] = deck["proposals"][:1]
    path = tmp_path / "one.pptx"
    render_pptx(deck, path)
    assert len(Presentation(path).slides) == planned_slide_count(deck)


def test_cli_check_and_write(tmp_path):
    assert main([str(EXAMPLE), "--check"]) == 0
    out = tmp_path / "out"
    assert main([str(EXAMPLE), "--out-dir", str(out)]) == 0
    assert (out / "E平台后悬架创新提案.pptx").exists()
    disclosure = out / "E平台后悬架创新提案-交底骨架.md"
    assert disclosure.exists()
    assert "非正式" in disclosure.read_text(encoding="utf-8")
    assert main([str(EXAMPLE)]) == 2
