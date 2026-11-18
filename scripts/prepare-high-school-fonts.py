#!/usr/bin/env python3
"""Offline, deterministic Fontsource subsets. No application/runtime dependencies.

Run from the repository root:
  PYTHONPATH=.runtime/stage35/font-tools python3 scripts/prepare-high-school-fonts.py
Requires build-only fontTools 4.60.2 and Brotli 1.2.1. Input npm tarballs and
registry metadata live in .runtime/stage35/font-sources. Their SHA512 integrity
is verified before any font is opened. This script never downloads anything.
"""
from __future__ import annotations

import base64
import hashlib
import io
import json
import re
import tarfile
import unicodedata
from pathlib import Path

import brotli
import fontTools
from fontTools import subset
from fontTools.pens.recordingPen import DecomposingRecordingPen
from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
INPUT = ROOT / '.runtime/stage35/font-sources'
OUTPUT = ROOT / 'apps/web/public/fonts/high-school'
CSS = ROOT / 'apps/web/src/features/high-school/styles/HighSchoolFontFaces.css'


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def source_files() -> list[Path]:
    paths = set()
    for directory in [ROOT / 'apps/web/src/features/high-school', *[
        ROOT / 'packages' / package / 'src/highSchool' for package in ('knowledge', 'physics', 'harness')
    ]]:
        paths.update(p for p in directory.rglob('*') if p.suffix in {'.ts', '.tsx', '.css'})
    paths.update((ROOT / 'apps/web/src/data').glob('highSchool*.ts'))
    paths.add(ROOT / 'packages/knowledge/src/classroomExperiments.ts')
    return sorted(p for p in paths if '.test.' not in p.name and p != CSS)


def ranges(value: str) -> set[int]:
    result = set()
    for part in value.split(','):
        ends = part.strip().removeprefix('U+').removeprefix('u+').split('-')
        result.update(range(int(ends[0], 16), int(ends[-1], 16) + 1))
    return result


def compact_ranges(points: set[int]) -> str:
    groups: list[list[int]] = []
    for point in sorted(points):
        if groups and point == groups[-1][-1] + 1:
            groups[-1].append(point)
        else:
            groups.append([point])
    return ','.join(f'U+{group[0]:04X}' + (f'-{group[-1]:04X}' if len(group) > 1 else '') for group in groups)


def package(stem: str, metadata_name: str, expected_name: str, expected_version: str):
    metadata = json.loads((INPUT / metadata_name).read_text())
    assert (metadata['name'], metadata['version']) == (expected_name, expected_version)
    archive = (INPUT / f'{stem}.tgz').read_bytes()
    actual_integrity = 'sha512-' + base64.b64encode(hashlib.sha512(archive).digest()).decode()
    assert actual_integrity == metadata['dist']['integrity'], f'{stem}: registry integrity mismatch'
    tar = tarfile.open(fileobj=io.BytesIO(archive), mode='r:gz')
    internal = json.loads(tar.extractfile('package/package.json').read())
    assert (internal['name'], internal['version']) == (expected_name, expected_version)
    return tar, {
        'name': expected_name, 'version': expected_version, 'license': metadata['license'],
        'tarball': metadata['dist']['tarball'], 'integrity': actual_integrity, 'sha256': sha(archive),
        'repository': metadata['repository']['url'],
    }


def drawing(font: TTFont, point: int, weight: int | None):
    glyphs = font.getGlyphSet(location={'wght': weight} if weight is not None else None)
    glyph = glyphs[font.getBestCmap()[point]]
    pen = DecomposingRecordingPen(glyphs)
    glyph.draw(pen)
    # WOFF2 compression is lossless; rounded coordinates tolerate only floating
    # arithmetic in variation interpolation, never outline simplification.
    def normalized(value):
        if isinstance(value, (tuple, list)):
            return tuple(normalized(item) for item in value)
        return round(value, 6) if isinstance(value, float) else value
    return normalized(pen.value), round(glyph.width, 6)


def write_subset(original: bytes, points: set[int], filename: str, family: str, weight: str, origin: str):
    original_font = TTFont(io.BytesIO(original), recalcTimestamp=False)
    font = TTFont(io.BytesIO(original), recalcTimestamp=False)
    options = subset.Options()
    options.layout_features = ['*']
    options.name_IDs = ['*']
    options.name_languages = ['*']
    options.notdef_glyph = True
    options.notdef_outline = True
    options.recalc_timestamp = False
    subsetter = subset.Subsetter(options=options)
    subsetter.populate(unicodes=points)
    subsetter.subset(font)
    # Layout closure can retain another Unicode alias of a necessary glyph.
    # Keep the glyph/layout closure, but expose only this face's declared cmap.
    for table in font['cmap'].tables:
        if table.isUnicode() and hasattr(table, 'cmap'):
            table.cmap = {point: glyph for point, glyph in table.cmap.items() if point in points}
    # The derivative is presented under its own family; copyright/license names
    # and all remaining legal metadata are kept from the original font.
    name_table = font['name']
    names = {1: family, 16: family, 4: family + ' ' + weight.replace(' ', '-'),
             6: filename.removesuffix('.woff2').replace('-', ''),
             3: family + ':' + sha(original)[:16] + ':' + sha(compact_ranges(points).encode())[:16]}
    for record in list(name_table.names):
        if record.nameID in names:
            name_table.setName(names[record.nameID], record.nameID, record.platformID, record.platEncID, record.langID)
    font.flavor = 'woff2'
    stream = io.BytesIO(); font.save(stream, reorderTables=True); result = stream.getvalue()
    decoded = TTFont(io.BytesIO(result), recalcTimestamp=False)
    assert result[:4] == b'wOF2'
    assert set(decoded.getBestCmap()) == points, f'{filename}: cmap changed'
    variable = weight == '100 900'
    if variable:
        axes = [(axis.axisTag, axis.minValue, axis.defaultValue, axis.maxValue) for axis in decoded['fvar'].axes]
        assert axes == [('wght', 100.0, 100.0, 900.0)] or axes == [('wght', 100.0, 400.0, 900.0)], axes
        assert axes == [(a.axisTag, a.minValue, a.defaultValue, a.maxValue) for a in original_font['fvar'].axes]
        checked_weights = [400, 500, 600]
    else:
        assert 'fvar' not in decoded and decoded['OS/2'].usWeightClass == int(weight)
        checked_weights = [None]
    for checked_weight in checked_weights:
        for point in sorted(points):
            assert drawing(original_font, point, checked_weight) == drawing(decoded, point, checked_weight), f'{filename}: outline/advance mismatch U+{point:04X}'
    (OUTPUT / filename).write_bytes(result)
    info = {'file': filename, 'family': family, 'weight': weight, 'bytes': len(result), 'sha256': sha(result),
            'sourceFile': origin, 'sourceSha256': sha(original), 'unicodeRange': compact_ranges(points),
            'cmapCount': len(points), 'outlineAndAdvanceVerifiedAt': checked_weights if variable else [int(weight)]}
    face = (f"@font-face {{\n  font-family: '{family}';\n  font-style: normal;\n  font-weight: {weight};\n"
            f"  font-display: swap;\n  src: url('/fonts/high-school/{filename}') format('woff2');\n"
            f"  unicode-range: {compact_ranges(points)};\n}}\n")
    return info, face


def main():
    files = source_files()
    corpus = {file: file.read_bytes() for file in files}
    requested = set(range(0x20, 0x7F)) | {0xA0, 0xB0, 0xB1, 0xD7, 0xF7, 0x2212}
    for file in files:
        requested.update(ord(char) for char in corpus[file].decode() if not unicodedata.category(char).startswith('C') and not char.isspace())
    noto, noto_source = package('noto-sans-sc', 'noto-package.json', '@fontsource-variable/noto-sans-sc', '5.3.1')
    barlow, barlow_source = package('barlow-condensed', 'barlow-package.json', '@fontsource/barlow-condensed', '5.3.0')
    OUTPUT.mkdir(parents=True, exist_ok=True)
    faces, assets, covered = [], [], set()
    blocks = re.findall(r'@font-face\s*\{([^}]+)\}', noto.extractfile('package/wght.css').read().decode())
    jobs = []
    # Last CSS face wins if original ranges overlap. Assign each codepoint to
    # exactly one source face; this also avoids duplicate glyph downloads.
    for block in reversed(blocks):
        source = re.search(r'url\(\./(files/[^)]+)\)', block)[1]
        declared = ranges(re.search(r'unicode-range:\s*([^;]+)', block)[1])
        original = noto.extractfile('package/' + source).read()
        available = set(TTFont(io.BytesIO(original), recalcTimestamp=False).getBestCmap())
        points = requested & declared & available - covered
        if points:
            covered.update(points)
            tag = source.removeprefix('files/noto-sans-sc-').removesuffix('-wght-normal.woff2')
            jobs.append((original, points, f'hs-sans-{tag}-wght.woff2', 'High School Sans', '100 900', source))
    for job in reversed(jobs):
        info, face = write_subset(*job); assets.append(info); faces.append(face)
    for weight in (500, 600):
        source = f'files/barlow-condensed-latin-{weight}-normal.woff2'
        original = barlow.extractfile('package/' + source).read()
        points = requested & set(TTFont(io.BytesIO(original), recalcTimestamp=False).getBestCmap())
        info, face = write_subset(original, points, f'hs-display-latin-{weight}.woff2', 'High School Display', str(weight), source)
        assets.append(info); faces.append(face)
    total = sum(asset['bytes'] for asset in assets)
    assert total < 1_000_000, f'Font budget exceeded: {total} bytes'
    expected = {asset['file'] for asset in assets}
    for old in [*OUTPUT.glob('hs-sans-*-wght.woff2'), *OUTPUT.glob('hs-display-latin-*.woff2')]:
        if old.name not in expected:
            old.unlink()
    CSS.write_text('\n'.join(faces))
    (OUTPUT / 'OFL-Noto-Sans-SC.txt').write_bytes(noto.extractfile('package/LICENSE').read())
    (OUTPUT / 'OFL-Barlow-Condensed.txt').write_bytes(barlow.extractfile('package/LICENSE').read())
    manifest = {
        'format': 'physics-high-school-font-subsets-v1',
        'method': 'Original variable Noto unicode shards, exact corpus cmap subsets; static Barlow 500/600 Latin subsets. No merging or outline simplification.',
        'tools': {'fontTools': fontTools.__version__, 'Brotli': brotli.__version__},
        'buildScriptSha256': sha(Path(__file__).read_bytes()),
        'sources': [noto_source, barlow_source],
        'sourceFiles': [{'path': str(p.relative_to(ROOT)), 'sha256': sha(corpus[p])} for p in files],
        'licenses': [{'file': name, 'sha256': sha((OUTPUT / name).read_bytes())} for name in ['OFL-Noto-Sans-SC.txt', 'OFL-Barlow-Condensed.txt']],
        'requestedCodepointCount': len(requested), 'sansCoveredCodepointCount': len(covered),
        'unsupportedCodepointsUseSystemFallback': [f'U+{point:04X}' for point in sorted(requested - covered)],
        'woff2TotalBytes': total, 'assets': assets, 'cssSha256': sha(CSS.read_bytes()),
        'limitations': ['Only current source corpus plus ASCII/common numeric punctuation is bundled.',
                        'New text, personal names and missing symbols require the CSS system fallback or regeneration.',
                        'Outline/advance checks are FontTools comparisons, not a browser rasterization or complete shaping-engine acceptance.'],
    }
    (OUTPUT / 'manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    (OUTPUT / 'README.md').write_text(
        '# 高中自托管字体\n\n'
        '本目录是 Noto Sans SC 与 Barlow Condensed 的裁剪衍生版本，分别以 High School Sans 和 High School Display 使用。两者均保留 SIL OFL 1.1；许可证见同目录。\n\n'
        '离线复现：在仓库根执行 `PYTHONPATH=.runtime/stage35/font-tools python3 scripts/prepare-high-school-fonts.py`。'
        '需要构建工具 FontTools 4.60.2、Brotli 1.2.1，以及 manifest 中准确版本的 npm tarball 和 registry 元数据；不属于网页运行依赖。脚本先核 SHA512，再裁剪。\n\n'
        '保留官方分片、字重轴和布局特性，不合并、不简化轮廓。对每个收录码点比较裁剪前后的分解轮廓与字宽；Noto 检查 400/500/600，Barlow 检查 500/600。'
        '这不等于浏览器真实字形排版验收。当前字库只覆盖扫描到的高中源文案及常用数字符号；新增内容、用户姓名或不支持的符号继续使用系统字体回退。\n\n'
        '精确下载地址、原包 integrity、输入文件与输出文件 SHA256、逐片字形范围和大小见 manifest.json。'
        '没有远程字体引用、预加载脚本或跟踪请求。\n')
    print(json.dumps({'files': len(assets), 'bytes': total, 'sansCodepoints': len(covered),
                      'fallbackCodepoints': len(requested - covered), 'outlineChecks': 'passed'}, ensure_ascii=False))


if __name__ == '__main__':
    main()
