from __future__ import annotations

import json
from pathlib import Path

from PIL import Image, ImageOps


PROJECT_ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = Path(r"H:\图")
OUTPUT_DIR = PROJECT_ROOT / "docs" / "assets" / "photos"
DATA_FILE = PROJECT_ROOT / "docs" / "gallery-data.js"

SOURCE_NAMES = [
    "04E30B67D09103C439B0B9884DD36552.jpg",
    "90f420fc80a70563abf543232d5035f368ff741a786e83ef401de0b63f701c9c.png",
    "92ea0e9424508dc22128c864cbd489caf92fff6c446740d4a00fa28477070470.png",
    "123.jpg",
    "550ea6fe39e4dfe335f4b1f7cc96c28bf6fa7079a198ad4204fc42e0bd56b538.png",
    "ChatGPT Image 2026年5月13日 20_25_28.png",
    "ChatGPT Image 2026年5月25日 13_10_47.png",
    "ChatGPT Image 2026年5月28日 17_16_32.png",
    "ChatGPT Image 2026年5月28日 17_23_24.png",
    "ChatGPT Image 2026年6月3日 22_42_31 (1).png",
    "ChatGPT Image 2026年6月3日 22_42_32 (2).png",
    "ChatGPT Image 2026年9月14日 14_34_53.png",
    "jimeng-2025-05-22-5071-_ 天上有一个巨大的星球，天空中一艘飞艇和一条龙和一些鸟，没有气球，地面上是无边....jpeg",
    "jimeng-2025-09-15-2400-为这个女孩创作一个充满文艺气息的杂志封面，仰拍女孩，女孩一手叉腰，一只指向前方，....png",
    "QQ图片20240221153011.jpg",
    "QQ图片20240222114853.jpg",
    "QQ图片20240302122211.jpg",
    "微信截图_20250724135816.png",
    "微信截图_20250724212158.png",
    "微信图片_20250430172930.jpg",
    "微信图片_20250609170435.jpg",
    "微信图片_20250609170450.jpg",
    "微信图片_20250609170515.jpg",
    "微信图片_20250609170545.jpg",
    "微信图片_20250609170556.jpg",
    "微信图片_20250710210320.jpg",
    "微信图片_20250726222619.jpg",
    "微信图片_20250726222623.jpg",
    "微信图片_20250728102854.jpg",
    "微信图片_20250910084015_8_226.jpg",
    "微信图片_20251004085956_17_16.jpg",
    "微信图片_20251004091710_20_16.jpg",
    "微信图片_20251026083024_29_16.jpg",
    "微信图片_20251026083047_30_16.jpg",
    "微信图片_20260108120402_1044_27.jpg",
    "微信图片_20260122120455_118_16.jpg",
    "微信图片_20260122120455_119_16.jpg",
    "微信图片_20260131223646_53_16.jpg",
    "微信图片_20260201222530_128_16.jpg",
    "微信图片_20260226212526_170_1.jpg",
    "未命名项目(1).jpeg",
]


def export() -> None:
    if not SOURCE_DIR.is_dir():
        raise SystemExit(f"Source folder not found: {SOURCE_DIR}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    missing = [name for name in SOURCE_NAMES if not (SOURCE_DIR / name).is_file()]
    if missing:
        raise SystemExit("Missing source files:\n" + "\n".join(missing))

    records = []
    total_bytes = 0
    for index, name in enumerate(SOURCE_NAMES, start=1):
        source = SOURCE_DIR / name
        destination = OUTPUT_DIR / f"photo-{index:02d}.webp"

        with Image.open(source) as raw:
            image = ImageOps.exif_transpose(raw)
            image.thumbnail((2400, 2400), Image.Resampling.LANCZOS)
            if image.mode in {"RGBA", "LA"}:
                background = Image.new("RGB", image.size, (7, 5, 14))
                background.paste(image, mask=image.getchannel("A"))
                image = background
            elif image.mode != "RGB":
                image = image.convert("RGB")
            image.save(destination, "WEBP", quality=86, method=6)

        total_bytes += destination.stat().st_size
        records.append(
            {
                "src": f"./assets/photos/{destination.name}",
                "title": "",
                "date": "2026/9/14",
                "story": "",
                "note": "刚刚加入这颗影像星球。",
            }
        )
        print(f"[{index:02d}/{len(SOURCE_NAMES)}] {name} -> {destination.name}")

    payload = json.dumps(records, ensure_ascii=False, indent=2)
    DATA_FILE.write_text(f"window.GALLERY_PHOTOS = {payload};\n", encoding="utf-8")
    print(f"Exported {len(records)} photos ({total_bytes / 1024 / 1024:.1f} MiB)")


if __name__ == "__main__":
    export()
