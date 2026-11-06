---
name: chassis-suspension-innovation-ppt
description: >
  把乘用车底盘悬架平台的创新点写成内部评审 PPT，并同步给出可交给专利工程师的技术交底书骨架。
  在用户要做悬架平台创新提案、底盘专利布局、技术交底书，或要把悬架想法收成可检索、可撰写的结构方案时使用。
  触发词包括：悬架平台、创新提案、技术交底、硬点、衬套、副车架、K&C、权利要求、专利挖掘。
  Use when drafting a patent-oriented chassis suspension platform proposal, an invention disclosure for suspension hardware, or a review deck whose purpose is a later patent filing.
---

# 底盘悬架平台创新提案

产出两份一起交付的文件：评审 PPT，以及按提案拆开的技术交底书骨架。目的是把创新点收成可以检索、可以撰写的结构关系。不承诺授权，不代替检索。

## 何时用

用户要做悬架平台创新提案、专利导向的底盘汇报、技术交底书，或要把一个悬架想法收成权利要求级别的结构。

不用于：整车营销路演、没有新结构的控制算法、已经完成的申请文件润色。

## 先读

1. 本文件。
2. 内容还不够具体时读 [references/domain.md](references/domain.md)。
3. 写权利要求骨架时读 [references/patent.md](references/patent.md)。
4. 定每页标题时读 [references/deck.md](references/deck.md)。
5. 填文件时读 [references/schema.md](references/schema.md)。完整范例是仓库里的 `examples/e-platform-rear/proposal.yaml`。

范例是写法样例，不是用户的方案。真实项目另建 YAML，不要把范例里的分路支架、安装块或斜孔写进用户的平台。

## 步骤

### 1. 判断任务

- 从零挖掘
- 已有想法，收成提案
- 已有稿子，改到能交底

用户已经给出的平台、基线、约束直接采用。缺的只问会改变必要特征的部分，一次问完。

### 2. 只问这些缺口

已经回答的不要再问。用户明确说先看示例，或拒绝补充时，用范例生成一版，并保持 `example: true`。

1. 前悬、后悬，还是前后都做？覆盖几种驱动形式、几种车高或轴距？
2. 基线结构是什么？哪些安装点这次不能动？
3. 是空白挖掘，还是已经有结构？已有结构按“谁和谁连接、力从哪走到哪、车高或轮跳变化时哪一段在动”描述。
4. 必须保住的约束：共用件、半轴、转向、制动，以及用户明确不在权限内的总成。用户说明电池不在权限内时，问题、特征、效果和权利要求都不写电池，只写悬架零件之间的传力。
5. 评审要拍板的是检索顺序、分案，还是样件范围？
6. 有没有必须避开的自有公开或在审主题？没有就写“无”。

### 3. 先过过滤器，再写 YAML

每个候选都要满足 [references/patent.md](references/patent.md) 的过滤器。不满足的写入 `dropped`，写明原因，不要硬编成提案。

从空白平台挖掘时，给出两到三个互不依赖的装置案。不要为了凑数把拥挤区的控制算法算进去。用户只带来一个想法时，就只做一案。用户只要每则两页介绍时，写 `meta.deck: intro`，其余字段仍按完整 schema 填，交底骨架照常生成。

### 4. 生成

在仓库根目录运行：

```bash
python -m pptgen proposals/<名称>/proposal.yaml --out-dir proposals/<名称>
```

校验失败就改 YAML。不要手改 pptx，也不要另做一套版式。版式不够用时改 `pptgen/render.py` 和 `references/schema.md`。

生成前可先跑：

```bash
python -m pptgen proposals/<名称>/proposal.yaml --check
```

### 5. 交付

按 [references/deck.md](references/deck.md) 末尾的清单核对。然后交给用户三样东西：pptx 路径、交底骨架路径、本次假定和需要检索的对比结构。

话术只用这句判断：“这些方案具备写成独立权利要求的结构关系。是不是新的、值不值得申请，要检索之后才知道。”

不要说“可以授权”“具备创造性”“行业领先”。用户没给的试验数字保持待测。

## 硬性禁止

- 编造试验数据、专利公开号、供应商名称、授权结论
- 把目标毫米或百分比写进必要技术特征
- 用假的机构图冒充运动学结果。几何只写图说，幻灯片里只画传力或位移示意
- 把多个发明并成一条系统权利要求
- 把 `examples/e-platform-rear` 的结构当成用户的方案
- 申请日前建议用户把必要特征放进外发图纸或供应商询价包
