"""从提案 YAML 生成评审幻灯片和交底书骨架。"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from pptgen.disclosure import render_disclosure
from pptgen.model import ProposalError, lint_proposal, load_proposal, planned_slide_count
from pptgen.render import render_pptx


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description="由悬架平台创新提案生成 PPTX 和技术交底书骨架")
    parser.add_argument("proposal", help="提案 YAML 路径")
    parser.add_argument("--out-dir", help="输出目录")
    parser.add_argument("--check", action="store_true", help="只校验，不生成文件")
    args = parser.parse_args(argv)

    try:
        deck = load_proposal(args.proposal)
    except ProposalError as exc:
        print(exc, file=sys.stderr)
        return 2

    for warning in lint_proposal(deck):
        print(f"警告: {warning}", file=sys.stderr)

    count = planned_slide_count(deck)
    if args.check:
        print(f"校验通过，{len(deck['proposals'])} 个提案，{count} 页")
        return 0
    if not args.out_dir:
        print("请提供 --out-dir，或使用 --check 只做校验", file=sys.stderr)
        return 2

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    stem = deck["meta"]["file_stem"]
    pptx_path = out_dir / f"{stem}.pptx"
    markdown_path = out_dir / f"{stem}-交底骨架.md"
    render_pptx(deck, pptx_path)
    markdown_path.write_text(render_disclosure(deck), encoding="utf-8")
    print(pptx_path)
    print(markdown_path)
    print(f"{count} 页")
    return 0


if __name__ == "__main__":
    sys.exit(main())
