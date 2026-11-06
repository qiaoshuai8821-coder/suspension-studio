"""提案 YAML 的结构校验。

校验的是“能不能交底”，不是文笔。缺必要特征、效果对不上特征、
实施方式没有互相区分，都会在生成幻灯片之前停下。
"""

from __future__ import annotations

import re
from datetime import date, datetime
from pathlib import Path

import yaml

BANNED = (
    "赋能",
    "极致",
    "颠覆式",
    "行业领先",
    "国际领先",
    "行业第一",
    "国际第一",
    "闭环生态",
    "保证授权",
    "肯定能授权",
    "具备创造性",
    "具有创造性",
)
CLAIM_TYPES = {"装置", "方法", "装置和方法"}
RISKS = {"高", "中", "低"}
RANKS = {"必要", "优选"}
STATUSES = {"待测", "仿真", "台架", "整车", "已有数据"}
TONES = {"stiff", "soft"}
TITLE_KEYS = (
    "problem_title",
    "solution_title",
    "embodiment_title",
    "effect_title",
    "patent_title",
)
TOP_TITLES = (
    "platform",
    "contradictions",
    "overview",
    "family",
    "roadmap",
    "decisions",
    "appendix",
)
NOTE_KEYS = set(TOP_TITLES)
PROPOSAL_NOTE_KEYS = {"problem", "solution", "embodiment", "effect", "patent"}
META_LIMITS = {
    "platform_name": 16,
    "module": 16,
    "short_name": 16,
    "purpose": 80,
    "scope_line": 40,
    "audience": 40,
    "classification": 20,
    "author": 20,
    "axle": 20,
}


class ProposalError(Exception):
    def __init__(self, errors: list[str]):
        self.errors = errors
        super().__init__("\n".join(errors))


def load_proposal(path: str | Path) -> dict:
    file_path = Path(path)
    with file_path.open(encoding="utf-8") as handle:
        data = yaml.safe_load(handle)
    if not isinstance(data, dict):
        raise ProposalError(["提案文件的顶层必须是一组字段"])
    errors = validate(data)
    if errors:
        raise ProposalError(errors)
    return data


def validate(data: dict) -> list[str]:
    errors: list[str] = []
    if data.get("version") != 1:
        errors.append("version 必须是 1")

    meta = data.get("meta")
    if not isinstance(meta, dict):
        errors.append("缺少 meta")
        meta = {}
    else:
        _normalize_date(meta, errors)
        for key, limit in META_LIMITS.items():
            value = _need_str(meta, key, "meta", errors)
            if value and len(value) > limit:
                errors.append(f"meta.{key} 有 {len(value)} 字，最多 {limit} 字")
        if not isinstance(meta.get("example"), bool):
            errors.append("meta.example 必须是 true 或 false")
        deck_format = meta.get("deck", "full")
        if deck_format not in {"full", "intro"}:
            errors.append("meta.deck 只能是 full 或 intro")
        stem = _need_str(meta, "file_stem", "meta", errors)
        if stem and ("/" in stem or "\\" in stem or stem.startswith(".")):
            errors.append("meta.file_stem 只能是文件名，不能包含路径")

    titles = data.get("titles")
    if not isinstance(titles, dict):
        errors.append("缺少 titles")
        titles = {}
    else:
        for key in TOP_TITLES:
            _need_str(titles, key, "titles", errors)

    _check_notes(data.get("notes"), NOTE_KEYS, "notes", errors)

    platform = data.get("platform")
    if not isinstance(platform, dict):
        errors.append("缺少 platform")
    else:
        _need_str(platform, "scope", "platform", errors)
        _need_str(platform, "baseline", "platform", errors)
        _need_str_list(platform, "assumptions", "platform", errors, minimum=1, maximum=4)
        _need_str_list(platform, "frozen", "platform", errors, minimum=2, maximum=5)
        _need_str_list(platform, "interfaces", "platform", errors, minimum=3, maximum=6)
        variants = platform.get("variants")
        if not isinstance(variants, list) or not 2 <= len(variants) <= 4:
            errors.append("platform.variants 需要 2 到 4 个车型状态")
        else:
            for index, variant in enumerate(variants, start=1):
                where = f"platform.variants[{index}]"
                if not isinstance(variant, dict):
                    errors.append(f"{where} 必须是字段")
                    continue
                _need_str(variant, "name", where, errors)
                _need_str(variant, "difference", where, errors)

    contradictions = data.get("contradictions")
    contradiction_ids: set[str] = set()
    if not isinstance(contradictions, list) or not 1 <= len(contradictions) <= 4:
        errors.append("contradictions 需要 1 到 4 条")
    else:
        for index, item in enumerate(contradictions, start=1):
            where = f"contradictions[{index}]"
            if not isinstance(item, dict):
                errors.append(f"{where} 必须是字段")
                continue
            identifier = _need_str(item, "id", where, errors)
            if identifier:
                if identifier in contradiction_ids:
                    errors.append(f"{where} 的 id 重复")
                contradiction_ids.add(identifier)
            for key in ("left", "right", "clash", "baseline_failure"):
                _need_str(item, key, where, errors)

    proposals = data.get("proposals")
    if not isinstance(proposals, list) or not 1 <= len(proposals) <= 4:
        errors.append("proposals 需要 1 到 4 个。一次评审超过 4 个就拆成另一册")
        proposals = []

    for index, proposal in enumerate(proposals, start=1):
        _validate_proposal(proposal, index, contradiction_ids, errors)

    family = data.get("family")
    if not isinstance(family, dict):
        errors.append("缺少 family")
    else:
        _need_str(family, "principle", "family", errors)
        _need_str(family, "drawing_note", "family", errors)
        _need_str_list(family, "rules", "family", errors, minimum=3, maximum=5)

    roadmap = data.get("roadmap")
    if not isinstance(roadmap, list) or not 3 <= len(roadmap) <= 4:
        errors.append("roadmap 需要 3 或 4 步")
    else:
        blob = []
        for index, step in enumerate(roadmap, start=1):
            where = f"roadmap[{index}]"
            if not isinstance(step, dict):
                errors.append(f"{where} 必须是字段")
                continue
            for key in ("phase", "work", "gate"):
                value = _need_str(step, key, where, errors)
                blob.append(value)
        if not any("检索" in item for item in blob):
            errors.append("roadmap 里要有检索关口。检索前不要把样件做成后来要改的样子")

    decisions = data.get("decisions")
    if not isinstance(decisions, list) or not 2 <= len(decisions) <= 5:
        errors.append("decisions 需要 2 到 5 个请评审拍板的问题")
    else:
        for index, item in enumerate(decisions, start=1):
            where = f"decisions[{index}]"
            if not isinstance(item, dict):
                errors.append(f"{where} 必须是字段")
                continue
            _need_str(item, "question", where, errors)
            _need_str(item, "why", where, errors)

    dropped = data.get("dropped")
    if not isinstance(dropped, list):
        errors.append("dropped 必须是列表。没有放弃的方向就写空列表")
    elif len(dropped) > 6:
        errors.append("dropped 最多 6 条")
    else:
        for index, item in enumerate(dropped, start=1):
            where = f"dropped[{index}]"
            if not isinstance(item, dict):
                errors.append(f"{where} 必须是字段")
                continue
            _need_str(item, "idea", where, errors)
            _need_str(item, "reason", where, errors)

    confidentiality = data.get("confidentiality")
    if not isinstance(confidentiality, dict):
        errors.append("缺少 confidentiality")
    else:
        _need_str(confidentiality, "legal", "confidentiality", errors)
        _need_str(confidentiality, "supplier", "confidentiality", errors)

    _ban_phrases(data, errors)
    return errors


def lint_proposal(data: dict) -> list[str]:
    """不阻断生成，只指出可能挤出版面或混入目标数值的句子。"""
    warnings: list[str] = []
    digit = re.compile(r"\d")
    for key, value in data.get("titles", {}).items():
        if isinstance(value, str) and len(value) > 34:
            warnings.append(f"标题 titles.{key} 有 {len(value)} 字，可能超过一行")
    for proposal in data.get("proposals", []):
        if not isinstance(proposal, dict):
            continue
        name = proposal.get("id", "提案")
        for key in TITLE_KEYS:
            value = proposal.get(key, "")
            if isinstance(value, str) and len(value) > 34:
                warnings.append(f"{name} 的 {key} 有 {len(value)} 字，可能超过一行")
        for feature in proposal.get("essential_features", []):
            text = feature.get("text", "") if isinstance(feature, dict) else ""
            if digit.search(text):
                warnings.append(f"{name} 特征 {feature.get('id')} 含有阿拉伯数字。目标数值放实施例，关系放必要特征")
        for effect in proposal.get("effects", []):
            if not isinstance(effect, dict) or effect.get("status") == "已有数据":
                continue
            blob = "".join(str(effect.get(key, "")) for key in ("mechanism", "effect", "setup", "criterion"))
            if digit.search(blob):
                warnings.append(f"{name} 的效果里有阿拉伯数字，但状态不是已有数据。确认这不是编出来的试验结果")
    return warnings


def planned_slide_count(data: dict) -> int:
    if data.get("meta", {}).get("deck") == "intro":
        return 2 * len(data["proposals"])
    return 4 + 5 * len(data["proposals"]) + 4


def _validate_proposal(proposal, index: int, contradiction_ids: set[str], errors: list[str]) -> None:
    where = f"proposals[{index}]"
    if not isinstance(proposal, dict):
        errors.append(f"{where} 必须是字段")
        return
    identifier = _need_str(proposal, "id", where, errors) or f"P{index}"
    where = identifier
    _need_str(proposal, "name", where, errors)
    claim_type = _need_str(proposal, "claim_type", where, errors)
    if claim_type and claim_type not in CLAIM_TYPES:
        errors.append(f"{where} 的 claim_type 只能是装置、方法、装置和方法")
    if claim_type in {"方法", "装置和方法"}:
        _need_str(proposal, "structure_basis", where, errors, minimum=8)
    one_liner = _need_str(proposal, "one_liner", where, errors)
    if one_liner and len(one_liner) > 32:
        errors.append(f"{where} 的 one_liner 最多 32 字")
    for key in TITLE_KEYS:
        _need_str(proposal, key, where, errors)

    card = proposal.get("card")
    if not isinstance(card, dict):
        errors.append(f"{where} 缺少 card")
    else:
        for key in ("problem", "feature", "criterion"):
            _need_str(card, key, f"{where}.card", errors)

    only_this = _need_str(proposal, "only_this", where, errors, minimum=12)
    if only_this and "不" not in only_this:
        errors.append(f"{where} 的 only_this 要写明本案不解决什么")
    _need_str(proposal, "baseline_failure", where, errors, minimum=20)
    _need_str_list(proposal, "conditions", where, errors, minimum=2, maximum=4)
    _need_str_list(proposal, "risks", where, errors, minimum=2, maximum=3)

    refs = proposal.get("contradiction_ids")
    if not isinstance(refs, list) or not refs:
        errors.append(f"{where} 至少对应一条 contradiction")
    else:
        for ref in refs:
            if ref not in contradiction_ids:
                errors.append(f"{where} 引用了不存在的矛盾 {ref}")

    essential = _features(proposal, "essential_features", where, errors, minimum=3, maximum=6)
    preferred = _features(proposal, "preferred_features", where, errors, minimum=0, maximum=4)
    known = {}
    for feature in essential + preferred:
        feature_id = feature.get("id")
        if feature_id in known:
            errors.append(f"{where} 的特征编号 {feature_id} 重复")
        known[feature_id] = feature
    essential_ids = {feature["id"] for feature in essential if feature.get("id")}
    preferred_ids = {feature["id"] for feature in preferred if feature.get("id")}

    _validate_diagram(proposal.get("diagram"), where, errors)
    _validate_embodiments(proposal.get("embodiments"), where, errors)
    _validate_figure(proposal.get("figure"), where, errors)
    _validate_effects(proposal.get("effects"), where, essential_ids, preferred_ids, errors)
    _validate_patent(proposal.get("patent"), where, errors)
    _check_notes(proposal.get("notes"), PROPOSAL_NOTE_KEYS, f"{where}.notes", errors)


def _features(proposal, key, where, errors, minimum, maximum) -> list[dict]:
    value = proposal.get(key)
    label = "必要技术特征" if key.startswith("essential") else "优选特征"
    if not isinstance(value, list) or not minimum <= len(value) <= maximum:
        errors.append(f"{where} 的{label}需要 {minimum} 到 {maximum} 条")
        return []
    cleaned = []
    for index, feature in enumerate(value, start=1):
        item_where = f"{where}.{key}[{index}]"
        if not isinstance(feature, dict):
            errors.append(f"{item_where} 必须是字段")
            continue
        feature_id = _need_str(feature, "id", item_where, errors)
        if feature_id and len(feature_id) > 4:
            errors.append(f"{item_where} 的 id 最多 4 个字符，避免页上的编号放不下")
        _need_str(feature, "text", item_where, errors, minimum=8)
        cleaned.append(feature)
    return cleaned


def _validate_diagram(diagram, where, errors) -> None:
    if not isinstance(diagram, dict):
        errors.append(f"{where} 缺少 diagram")
        return
    _need_str(diagram, "caption", f"{where}.diagram", errors)
    _need_str(diagram, "note", f"{where}.diagram", errors)
    paths = diagram.get("paths")
    if not isinstance(paths, list) or not 2 <= len(paths) <= 3:
        errors.append(f"{where} 的传力路径需要 2 或 3 条")
        return
    for index, path in enumerate(paths, start=1):
        item_where = f"{where}.diagram.paths[{index}]"
        if not isinstance(path, dict):
            errors.append(f"{item_where} 必须是字段")
            continue
        _need_str(path, "name", item_where, errors)
        if path.get("tone") not in TONES:
            errors.append(f"{item_where} 的 tone 只能是 stiff 或 soft")
        steps = path.get("steps")
        if not isinstance(steps, list) or not 2 <= len(steps) <= 4:
            errors.append(f"{item_where} 的 steps 需要 2 到 4 步")
        elif not all(isinstance(step, str) and step.strip() for step in steps):
            errors.append(f"{item_where} 的 steps 必须是非空字符串")


def _validate_embodiments(embodiments, where, errors) -> None:
    if not isinstance(embodiments, list) or len(embodiments) != 2:
        errors.append(f"{where} 需要正好两个实施方式。更多差别请收进这两个里面")
        return
    for index, item in enumerate(embodiments, start=1):
        item_where = f"{where}.embodiments[{index}]"
        if not isinstance(item, dict):
            errors.append(f"{item_where} 必须是字段")
            continue
        _need_str(item, "name", item_where, errors)
        _need_str(item, "structure", item_where, errors, minimum=12)
        difference = _need_str(item, "difference", item_where, errors, minimum=8)
        if difference and "相对" not in difference:
            errors.append(f"{item_where} 要写明相对另一实施方式差在结构的哪一处")


def _validate_figure(figure, where, errors) -> None:
    if not isinstance(figure, dict):
        errors.append(f"{where} 缺少 figure")
        return
    item_where = f"{where}.figure"
    for key in ("view", "parts", "invariant", "variant_delta"):
        _need_str(figure, key, item_where, errors, minimum=8)
    difference = _need_str(figure, "difference_vs_baseline", item_where, errors, minimum=12)
    if difference and "基线" not in difference:
        errors.append(f"{item_where} 要写明相对基线的差别")


def _validate_effects(effects, where, essential_ids, preferred_ids, errors) -> None:
    if not isinstance(effects, list) or not 2 <= len(effects) <= 4:
        errors.append(f"{where} 的效果需要 2 到 4 条")
        return
    covered: set[str] = set()
    for index, effect in enumerate(effects, start=1):
        item_where = f"{where}.effects[{index}]"
        if not isinstance(effect, dict):
            errors.append(f"{item_where} 必须是字段")
            continue
        _need_str(effect, "feature_label", item_where, errors)
        rank = effect.get("rank")
        if rank not in RANKS:
            errors.append(f"{item_where} 的 rank 只能是必要或优选")
        status = effect.get("status")
        if status not in STATUSES:
            errors.append(f"{item_where} 的 status 不在允许的范围内")
        elif status == "已有数据":
            _need_str(effect, "value", item_where, errors)
        elif effect.get("value"):
            errors.append(f"{item_where} 只有状态为已有数据时才能写 value")
        for key in ("mechanism", "effect", "setup", "criterion"):
            _need_str(effect, key, item_where, errors, minimum=8)
        feature_ids = effect.get("feature_ids")
        if not isinstance(feature_ids, list) or not feature_ids:
            errors.append(f"{item_where} 至少引用一条特征")
            continue
        for feature_id in feature_ids:
            if feature_id not in essential_ids and feature_id not in preferred_ids:
                errors.append(f"{item_where} 引用了不存在的特征 {feature_id}")
        if rank == "必要":
            used = [feature_id for feature_id in feature_ids if feature_id in essential_ids]
            if not used:
                errors.append(f"{item_where} 是必要效果，但没有引用必要特征")
            covered.update(used)
        if rank == "优选" and not any(feature_id in preferred_ids for feature_id in feature_ids):
            errors.append(f"{item_where} 是优选效果，但没有引用优选特征")
    missing = essential_ids - covered
    if missing:
        joined = "、".join(sorted(missing))
        errors.append(f"{where} 的必要特征 {joined} 没有被任何必要效果引用。拿掉仍成立的特征不要放在必要里")


def _validate_patent(patent, where, errors) -> None:
    if not isinstance(patent, dict):
        errors.append(f"{where} 缺少 patent")
        return
    item_where = f"{where}.patent"
    _need_str(patent, "independent_claim", item_where, errors, minimum=40)
    _need_str_list(patent, "dependents", item_where, errors, minimum=2, maximum=4)
    if patent.get("retrieval_risk") not in RISKS:
        errors.append(f"{item_where} 的 retrieval_risk 只能是高、中、低")
    _need_str(patent, "retrieval_risk_reason", item_where, errors, minimum=16)
    _need_str_list(patent, "compare_with", item_where, errors, minimum=2, maximum=4)
    _need_str_list(patent, "must_not_claim", item_where, errors, minimum=2, maximum=4)
    _need_str(patent, "standalone", item_where, errors, minimum=8)


def _check_notes(notes, allowed: set[str], where: str, errors: list[str]) -> None:
    if notes is None:
        return
    if not isinstance(notes, dict):
        errors.append(f"{where} 必须是字段")
        return
    for key, value in notes.items():
        if key not in allowed:
            errors.append(f"{where} 不认识 {key}")
        elif not isinstance(value, str) or not value.strip():
            errors.append(f"{where}.{key} 必须是非空文字")


def _normalize_date(meta: dict, errors: list[str]) -> None:
    value = meta.get("date")
    if isinstance(value, datetime):
        meta["date"] = value.date().isoformat()
    elif isinstance(value, date):
        meta["date"] = value.isoformat()
    elif not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}-\d{2}", value or ""):
        errors.append("meta.date 要写成 YYYY-MM-DD")


def _need_str(data: dict, key: str, where: str, errors: list[str], minimum: int = 1) -> str:
    value = data.get(key)
    if not isinstance(value, str) or len(value.strip()) < minimum:
        errors.append(f"{where} 缺少足够具体的 {key}")
        return ""
    return value.strip()


def _need_str_list(data: dict, key: str, where: str, errors: list[str], minimum: int, maximum: int) -> None:
    value = data.get(key)
    if not isinstance(value, list) or not minimum <= len(value) <= maximum:
        errors.append(f"{where}.{key} 需要 {minimum} 到 {maximum} 条")
        return
    if not all(isinstance(item, str) and item.strip() for item in value):
        errors.append(f"{where}.{key} 必须是非空文字")


def _ban_phrases(data, errors: list[str]) -> None:
    for path, text in _walk_strings(data):
        for phrase in BANNED:
            if phrase in text:
                errors.append(f"{path} 含有禁用说法“{phrase}”。改成结构关系和检索边界")


def _walk_strings(node, path=""):
    if isinstance(node, str):
        yield path or "文本", node
    elif isinstance(node, dict):
        for key, value in node.items():
            child = f"{path}.{key}" if path else str(key)
            yield from _walk_strings(value, child)
    elif isinstance(node, list):
        for index, value in enumerate(node):
            yield from _walk_strings(value, f"{path}[{index}]")
