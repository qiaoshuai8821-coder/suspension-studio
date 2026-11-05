"""由同一份提案生成技术交底书骨架。"""


def render_disclosure(deck: dict) -> str:
    meta = deck["meta"]
    lines: list[str] = []
    add = lines.append
    add(f"# {meta['platform_name']}{meta['module']}技术交底书骨架")
    add("")
    add(
        "> 内部材料。本骨架供专利工程师检索和改写，不是检索报告，也不是申请文件。"
        "未写明“已有数据”的效果都还没有试验。新颖性和创造性要在检索之后判断。"
    )
    add("")
    add(f"- 日期：{meta['date']}")
    add(f"- 范围：{meta['scope_line']}")
    add(f"- 受众：{meta['audience']}")
    if meta.get("example"):
        add("- 标记：示例项目，不是真实车型数据")
    add("")
    add("## 提案目录")
    add("")
    for index, proposal in enumerate(deck["proposals"], start=1):
        risk = proposal["patent"]["retrieval_risk"]
        add(f"{index}. {proposal['name']}（{proposal['claim_type']}，检索风险：{risk}）")
    add("")
    add("## 平台边界")
    add("")
    add(deck["platform"]["scope"])
    add("")
    add(f"基线：{deck['platform']['baseline']}")
    add("")
    add("本次假定：")
    add("")
    for item in deck["platform"]["assumptions"]:
        add(f"- {item}")
    add("")
    _section_contradictions(add, deck)
    for index, proposal in enumerate(deck["proposals"], start=1):
        _section_proposal(add, deck, proposal, index)
    _section_family(add, deck)
    _section_roadmap(add, deck)
    _section_dropped(add, deck)
    add("## 保密")
    add("")
    add(deck["confidentiality"]["legal"])
    add("")
    add(deck["confidentiality"]["supplier"])
    add("")
    add("---")
    add("")
    add("本骨架与评审幻灯片由同一份 YAML 生成。正式交底前请专利工程师改写用语，并替换图说为正式附图。")
    add("")
    return "\n".join(lines)


def _section_contradictions(add, deck) -> None:
    add("## 技术矛盾")
    add("")
    for item in deck["contradictions"]:
        add(f"### {item['id']}")
        add("")
        add(f"- 一侧：{item['left']}")
        add(f"- 另一侧：{item['right']}")
        add(f"- 卡点：{item['clash']}")
        add(f"- 基线为何失败：{item['baseline_failure']}")
        add("")


def _section_proposal(add, deck, proposal, index: int) -> None:
    patent = proposal["patent"]
    add(f"## 提案 {index}　{proposal['name']}")
    add("")
    add("### 技术领域")
    add("")
    add(
        f"本发明涉及乘用车底盘，具体是{deck['meta']['axle']}的一种{proposal['claim_type']}，"
        f"名称为“{proposal['name']}”。"
    )
    if proposal["claim_type"] in {"方法", "装置和方法"}:
        add("")
        add(f"方法所依附的结构：{proposal['structure_basis']}")
    add("")
    add("### 背景技术与缺陷")
    add("")
    add(deck["platform"]["baseline"])
    add("")
    add(proposal["baseline_failure"])
    add("")
    for identifier in proposal["contradiction_ids"]:
        matched = next(item for item in deck["contradictions"] if item["id"] == identifier)
        add(f"对应矛盾 {identifier}：{matched['left']}，与{matched['right']}，卡在{matched['clash']}。")
    add("")
    add("### 要解决的技术问题")
    add("")
    add(proposal["only_this"])
    add("")
    add("涉及工况：")
    add("")
    for item in proposal["conditions"]:
        add(f"- {item}")
    add("")
    add("### 技术方案")
    add("")
    add("必要技术特征：")
    add("")
    for feature in proposal["essential_features"]:
        add(f"- {feature['id']}　{feature['text']}")
    add("")
    if proposal["preferred_features"]:
        add("优选特征，不放进独立权利要求：")
        add("")
        for feature in proposal["preferred_features"]:
            add(f"- {feature['id']}　{feature['text']}")
        add("")
    add("### 有益效果")
    add("")
    add("每条效果都只对应上面列出的特征。没有“已有数据”的，不能写成已经验证。")
    add("")
    for effect in proposal["effects"]:
        joined = "、".join(effect["feature_ids"])
        add(f"- {effect['feature_label']}（{effect['rank']}，特征 {joined}，状态：{effect['status']}）")
        add(f"  机理：{effect['mechanism']}")
        add(f"  效果：{effect['effect']}")
        add(f"  试验：{effect['setup']}")
        add(f"  通过判据：{effect['criterion']}")
        if effect.get("value"):
            add(f"  已有数据：{effect['value']}")
    add("")
    add("### 具体实施方式")
    add("")
    for item in proposal["embodiments"]:
        add(f"- {item['name']}：{item['structure']}")
        add(f"  差别：{item['difference']}")
    add("")
    add("实施时要写进结构、不能只放在口头要求里的风险：")
    add("")
    for item in proposal["risks"]:
        add(f"- {item}")
    add("")
    add("### 附图说明")
    add("")
    figure = proposal["figure"]
    add(f"- 视图：{figure['view']}")
    add(f"- 零件：{figure['parts']}")
    add(f"- 不变：{figure['invariant']}")
    add(f"- 随车型变：{figure['variant_delta']}")
    add(f"- 相对基线：{figure['difference_vs_baseline']}")
    add("")
    add(f"传力或位移示意（{proposal['diagram']['caption']}）：{proposal['diagram']['note']}")
    add("")
    add("### 权利要求骨架")
    add("")
    add("以下为非正式用语，由专利工程师校准。")
    add("")
    add(patent["independent_claim"].strip())
    add("")
    add("从属：")
    add("")
    for item in patent["dependents"]:
        add(f"- {item}")
    add("")
    add(f"检索风险：{patent['retrieval_risk']}。{patent['retrieval_risk_reason']}")
    add("")
    add("建议对比的结构：")
    add("")
    for item in patent["compare_with"]:
        add(f"- {item}")
    add("")
    add("不写入权利要求：")
    add("")
    for item in patent["must_not_claim"]:
        add(f"- {item}")
    add("")
    add(f"单独立案：{patent['standalone']}")
    add("")


def _section_family(add, deck) -> None:
    family = deck["family"]
    add("## 分案与附图边界")
    add("")
    add(family["principle"])
    add("")
    for item in family["rules"]:
        add(f"- {item}")
    add("")
    add(family["drawing_note"])
    add("")


def _section_roadmap(add, deck) -> None:
    add("## 检索与验证顺序")
    add("")
    for index, step in enumerate(deck["roadmap"], start=1):
        add(f"{index}. {step['phase']}：{step['work']} 关口：{step['gate']}")
    add("")
    add("请评审拍板：")
    add("")
    for item in deck["decisions"]:
        add(f"- {item['question']} {item['why']}")
    add("")


def _section_dropped(add, deck) -> None:
    add("## 本次不写入交底")
    add("")
    if not deck["dropped"]:
        add("无。")
        add("")
        return
    for item in deck["dropped"]:
        add(f"- {item['idea']}：{item['reason']}")
    add("")
