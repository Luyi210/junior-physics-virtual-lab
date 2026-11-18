# 高中自托管字体

本目录是 Noto Sans SC 与 Barlow Condensed 的裁剪衍生版本，分别以 High School Sans 和 High School Display 使用。两者均保留 SIL OFL 1.1；许可证见同目录。

离线复现：在仓库根执行 `PYTHONPATH=.runtime/stage35/font-tools python3 scripts/prepare-high-school-fonts.py`。需要构建工具 FontTools 4.60.2、Brotli 1.2.1，以及 manifest 中准确版本的 npm tarball 和 registry 元数据；不属于网页运行依赖。脚本先核 SHA512，再裁剪。

保留官方分片、字重轴和布局特性，不合并、不简化轮廓。对每个收录码点比较裁剪前后的分解轮廓与字宽；Noto 检查 400/500/600，Barlow 检查 500/600。这不等于浏览器真实字形排版验收。当前字库只覆盖扫描到的高中源文案及常用数字符号；新增内容、用户姓名或不支持的符号继续使用系统字体回退。

精确下载地址、原包 integrity、输入文件与输出文件 SHA256、逐片字形范围和大小见 manifest.json。没有远程字体引用、预加载脚本或跟踪请求。
