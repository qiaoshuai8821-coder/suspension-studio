# 提案文件

仓库根目录执行：

```bash
python -m pptgen <提案.yaml> --check
python -m pptgen <提案.yaml> --out-dir <目录>
```

`--check` 只校验。正式生成会在输出目录写下：

- `<file_stem>.pptx`
- `<file_stem>-交底骨架.md`

两份文件来自同一份 YAML。改措辞改 YAML，然后重新生成。

完整范例：`examples/e-platform-rear/proposal.yaml`。

## 顶层

| 字段 | 要求 |
| --- | --- |
| version | 必须是 1 |
| meta | 平台名称、模块、短名、桥、目的、日期、受众、密级、example、作者角色、范围一行、文件名 |
| titles | 七个结论式标题：platform、contradictions、overview、family、roadmap、decisions、appendix |
| notes | 可选。讲解时不要越界的提醒 |
| platform | 范围、基线、假定、不动的接口、相关接口、至少两种车型状态 |
| contradictions | 1 到 4 条。每条有 id、两侧、卡点、基线为何失败 |
| proposals | 1 到 4 个 |
| family | 原则、3 到 5 条规则、附图边界 |
| roadmap | 3 或 4 步。至少一步出现“检索” |
| decisions | 2 到 5 个问题，每个有 why |
| dropped | 列表。没有放弃的方向就写空列表 |
| confidentiality | 文件性质，以及申请日前不要外发什么 |

`meta.example: true` 时封面和页脚带示例。真实项目用 false。`date` 写成 `"YYYY-MM-DD"`。`file_stem` 只是文件名。`meta.deck` 可选：不写或 `full` 是完整评审稿；`intro` 是每则提案两页介绍，页数等于提案数乘二。

名称尽量短：平台名、模块、短名都不超过 16 字，结论式标题尽量一行。

## 每个提案

| 字段 | 要求 |
| --- | --- |
| id、name、claim_type | 装置、方法，或装置和方法 |
| structure_basis | 方法类必填，说明方法依附的结构 |
| one_liner | 封面用，最多 32 字 |
| 五个标题 | problem、solution、embodiment、effect、patent |
| card | 总览卡片上的问题、必要特征、判据，各一句 |
| contradiction_ids | 指向已有矛盾 |
| only_this | 写明不解决什么，句子里保留“不” |
| conditions | 2 到 4 个工况 |
| baseline_failure | 基线的哪个部位失败 |
| essential_features | 3 到 6 条，id 加 text。每条都要被一条必要效果引用 |
| preferred_features | 0 到 4 条。不进独立权利要求 |
| diagram | 2 或 3 条路径，tone 为 stiff 或 soft，每条 2 到 4 步。caption 要说明这不是几何图 |
| embodiments | 正好两个。difference 里写“相对” |
| figure | 视图、零件、不变、随车型变、相对基线。相对基线的句子里保留“基线” |
| effects | 2 到 4 条。rank 为必要或优选。status 为待测、仿真、台架、整车、已有数据 |
| risks | 2 或 3 条，写进结构才能管住的风险 |
| patent | 独立权利要求骨架、2 到 4 条从属、检索风险、原因、对比结构、不主张的内容、单独立案 |

`status` 不是已有数据时，不能写 `value`。是已有数据时，`value` 必须是用户提供的结果，不能编。

特征编号建议 F1、R1 这种短编号，最多 4 个字符。同一提案里不能重复。

必要效果必须引用必要特征。优选效果必须引用优选特征。没有任何必要效果引用的必要特征，校验不会通过。

## 校验失败时

生成器把原因打到标准错误，退出码为 2。按原因改 YAML。常见原因：

- 实施方式没有写“相对”
- 本案边界没有写“不”
- 图说没有写“基线”
- 路线图里没有“检索”
- 出现了赋能、极致、颠覆式、行业领先、保证授权、具备创造性这类说法
- 效果引用了不存在的特征

警告不阻断生成。特征或待测效果里出现阿拉伯数字时会警告，用来拦住写成必要特征的目标毫米和百分比。结构件数如果必须用数字，确认它不是试验结论后再保留。
