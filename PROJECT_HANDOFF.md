# Project Handoff

更新日期：2026-06-19

## 接手入口

- 项目目录：`E:\shared\code\registration-insights-integrated`
- 本地页面：`http://127.0.0.1:8781/`
- 线上页面：`https://yiseut.github.io/Registration/`
- GitHub 仓库：`https://github.com/Yiseut/Registration`
- 启动脚本：`Open-Dashboard.bat`

原数据库源头是 `E:\shared\code\registration`。本项目负责前台发布，不负责公众号抓取、NMPA 首次核验或原数据库事实判断。

## 2026-06-16 当前真实状态

今天完成了一轮前台可靠性修复和 QA 固化：

- 总览页已移除旧 `docs/assets/js/codex-data.js` 加载，不再允许旧数据 fallback。
- 总览页事实源为 `docs/assets/data/overview.json`、`docs/assets/data/manifest.json` 和 `docs/assets/data/tracks/*.json`。
- `scripts/build_data.py` 已补齐前台详情需要的主表字段，包括监管类型、适应证、适用范围、规格、成分、产品标签、来源标题和官方核验状态。
- 总览页顶部只保留更新时间；统计口径、非销售份额声明、核心记录覆盖范围等后台解释性语言不要作为首页顶部说明条展示，以免造成 184 条全局记录与地图 105 张中国主体注册证之间的口径混淆。
- 总览页产地结构 KPI 已改为 `证照数`，展示 `总数 184张 / 国内 99张 / 进口 79张 / 港澳台 6张` 的带单位口径，避免冒号结构被误读为比例。
- 中国企业地图头部只显示城市和注册主体，不显示地图子集注册证总数；地图内部仍可按企业数/注册证数切换观察城市分布。
- 筛选状态可通过 URL 分享：`segment`、`company`、`class`、`origin`、`q`、`grain`、`map`。
- 移动端长矩阵默认折叠，注册官方信息筛选区为 sticky。
- 新增 `scripts/dashboard_smoke_test.mjs` 和 GitHub Actions `Dashboard QA`。
- GitHub Actions 在提交 `02888f3` 上已通过。
- HA 子页新增交联填充剂定位拆分：在 106 张主格局证中筛出 91 张交联填充剂，并按 `国产 / 欧美进口 / 韩国进口 / 港澳台 / 其他进口` 展示；`其他进口` 是待复核桶，当前已清零。
- HA 利多卡因口径已收敛为一层：以官方注册证名称、产品名、型号规格和结构组成为准，中文“利多卡因”或英文 `Lidocaine` 均计入“含利多卡因”。当前 91 张交联填充剂中含利多卡因 37 张、未见利多卡因 54 张。
- 新增 `docs/pivot.html` 自定义透视工作台：读取当前发布 JSON，支持把变量拖到行、列、筛选区，默认视图为 HA 交联填充剂 `利多卡因状态 × 定位层级`。

关键教训：

- 如果前台总览页同时混用新版 JSON 和旧 `codex-data.js`，会出现 KPI 正确但明细表、搜索、详情抽屉仍读旧数据的问题。
- GitHub Pages 资源刷新可能有短暂缓存延迟，验证时使用 `?v=<commit>`。
- 仪表盘的 CR4、HHI、国产/进口结构均是注册准入口径，不代表销量、收入或商业市占率；这类说明应放在具体分析语境中，不要堆在首页顶部。
- 药品批准文号按官方字段原样显示，例如 Dysport 为 `S20200016`。
- 当用户问“为什么某张证补了但前台看不到/点开年度新增没有它”时，先说明状态链路：`已收录 → 官方详情是否同步 → 适应症/规格/结构组成是否完整 → 是否进入主格局 → 前台展示口径`。例如：`已收录，但 NMPA 注册证详情尚未同步，适应症缺失待查，所以暂放待复核/底层，不进入主格局；前台年度新增按主格局和待复核分层展示。`
- 用户已明确要求：所有优化都必须让流程更精简、更高效、更人性化，重点是提升质量、精准度和匹配度，而不是把项目操作复杂化。不要把 Codex 对话里可以直接完成的人工投喂、更新请求和状态确认，改造成前台复制口令再去 PowerShell 执行的中转流程；前台 Dashboard 应专注展示、分析和解释数据。

## 用户已经明确的展示原则

1. 前台只呈现事实，不展示内部设计逻辑、工具比较、版本整合说明或后续修改计划。
2. 所有来源、出处、原文、原文链接都不要在前台出现。
3. 页面统一浅色风格，不做深色模板。
4. 术语统一：
   - `透明质酸钠`
   - `注册官方信息`
   - 赛道标题统一使用专业名称，如 `PLA`、`PCL`、`CaHA`，不使用“童颜针”“少女针”等消费化称呼。
   - 不使用“再生”，相关材料按 `胶原刺激剂` 等更准确表达。
5. 图表和热力图应保持 Cloud/Claude 的整体页面风格，同时延续 Codex 的晶莹、悬浮、有阴影的小格子热力图语言。

## 当前布局状态

总览页按以下大结构组织：

1. 顶部 KPI 与八大战略子赛道卡片
2. 注册准入趋势
3. 结构性压力与演化
4. 国产 vs 进口 vs 港澳台
5. 注射剂市场结构
6. 交叉热力图区域
7. 业务矩阵
8. 注册官方信息
9. 自定义透视

`七赛道集中度` 卡片当前已恢复可见，并由 smoke test 检查应渲染 7 行。

## 最近完成的关键修改

### 热力图视觉统一

所有热力图统一为总表的晶莹悬浮格子语言：

- `docs/assets/js/core.js` 提供共享的热力图 CSS 变量和 ECharts 单元格样式生成函数。
- 首页 HTML/CSS 矩阵、HA 的产品形态 × 适应证矩阵、子页 ECharts 厂家 × 适应证热力图都接入同一套半透明渐变、高光边、柔和阴影和 hover 浮起规则。
- 当前子页 `track.js` 缓存版本为 `20260616-lidocaine-source-1`，透视页 `pivot.js` 缓存版本为 `20260616-lidocaine-source-1`。

### HA 子赛道整合

`docs/tracks/ha.html` 已切回 Cloud/Claude 子页骨架，并只在整合目录内替换内容模块：

- 删除原来的 `布局视角` 双卡片。
- 顶部 KPI 已增加 `产品形态`，显示 HA 主格局内 8 个原始产品形态。
- KPI 下方已补入信息卡：HA 主格局展示 `交联填充类 / 非交联水光、肤质改善类 / 含利多卡因`，其中 `含利多卡因` 是 106 张主格局证内的利多卡因口径卡，不并入产品形态分类；交联填充剂模块另列 91 张中的 37 张含利多卡因。
- 原 `厂家竞争力 + 产品形态结构` 双卡区域已删除，避免与头部卡片和后续业务矩阵重复。
- 新增 `交联填充剂定位拆分` 模块：
  - 地区/定位层级基于注册人、集团和产品名文本映射，不代表注册人法定住所字段。
  - 当前交联填充剂结构：国产 36、欧美进口 28、韩国进口 24、港澳台 3、其他进口 0。
  - 含利多卡因统一口径：欧美进口 19、韩国进口 9、国产 9、其他进口 0。
  - 未见利多卡因：国产 27、欧美进口 9、韩国进口 15、港澳台 3。
  - 记录浏览器新增 `形态`、`定位`、`利多卡因状态` 筛选，并支持 URL 参数 `shape`、`position`、`lidocaine`。
- `注册时间线` 已补成两张图：`逐年获批与累计` 使用 2008-2026 基准口径，`国产 vs 进口演变` 使用同一组年度新增拆分。
- `国产 vs 进口演变` 配色改为橙色 / `#fbdec7` 米色，柱体采用与逐年图一致的渐变圆角风格，小值标签改为柱体外侧显示。
- 时间线后新增 `产品形态 × 适应证热力图`，HA 口径只保留交联填充与非交联水光/肤质改善两类。
- `厂家竞争力矩阵` 改为 `业务矩阵`，内部卡片标题和右上筛选框均已移除。
- 注册证清单的产品列增加产品形态标签，保留 `NMPA / 待核` 核验列。

### 自定义透视页

`docs/pivot.html` 是跨赛道自助拆分页面，核心逻辑在 `docs/assets/js/pivot.js`。

- 直接读取 `docs/assets/data/manifest.json` 和各赛道 `tracks/*.json`，不依赖旧 `codex-data.js`。
- 默认筛选：赛道 `透明质酸钠`、产品形态 `交联填充类`，默认行维度 `利多卡因状态`，列维度 `定位层级`。
- 默认结果应为 91 张记录；其中 `含利多卡因 × 韩国进口` 为 9，`瑞典/瑞士 × 含利多卡因` 为 5。
- 可选维度包括赛道、产品形态、国产/进口、定位层级、国家/地区、利多卡因状态、是否含利多卡因、材料/剂型、适应证、注册人/集团、批准年份和核验状态。
- URL 参数：`rows`、`cols`、`metric`、`scope`、`q` 和 `f_<field>`；拖拽后状态应可分享。
- smoke test 已覆盖默认透视、图表渲染、关键 HA 单元格和拖动 `国家/地区` 到列区域。

### 胶原蛋白子赛道整合

`docs/tracks/collagen.html` 已按 Cloud/Claude 子页骨架收口，并补回旧 Codex 的三类口径分析图表：

- 删除当前 Claude 版中重复的 `厂家竞争力`、`布局视角`、`厂家 × 适应证卡位`展示区。
- `docs/assets/data/tracks/collagen.json` 已从 46 条历史样本收口到 18 条三类主格局记录。
- 已补入 `国产 vs 进口/港澳台演变`、`胶原来源结构`、`产品形态`、`适应证结构`、`产品形态 × 适应证热力图`、`业务矩阵`。
- `docs/assets/js/track.js` 的非 HA 年度拆分改为优先使用 `approval_year / approval_date`，使胶原页年度趋势和来源演变与三类记录一致。
- 注册证清单补入旧 Codex 版详细字段，包括注册人、规格、适用范围、UDI/校准来源字段。
- 清单和抽屉标签只保留 `动物源` / `类人源`，不再把国产、三类、二类、利多卡因作为标签展示。

### 其他子赛道模板修复

`docs/tracks/plla.html`、`docs/tracks/pcl.html`、`docs/tracks/caha.html`、`docs/tracks/botulinum.html`、`docs/tracks/ebd.html` 已用干净的 `docs/tracks/_template.html` 重新生成：

- 修复旧模板把 `</div>`、`</span>`、`</h2>` 等结束标签误渲染成前台文字的问题。
- 修复头部导航、标题、KPI 标签和章节标题的乱码。
- 修复 KPI 卡片套壳，当前五个页面均为 4 张并列 KPI 卡，嵌套数为 0。
- 这几个页面暂时按 Cloud/Claude 子页骨架承载通用分析模块，后续再逐页替换为对应赛道的 Codex 分析视角。

### 适应证分类

首页和子赛道页已经接入统一适应证规则。

重点规则：

- `颏下脂肪堆积/双下巴` 合并为一个适应证，显示 `颏下脂肪堆积（双下巴）`。
- `鼻唇沟/隆鼻` 拆成两个适应证：`鼻唇沟`、`隆鼻`。
- `唇红体 / 唇红缘 / 唇黏膜 / 唇部不对称 / 唇部组织容积 / 容积缺损` 等官方唇部适用范围归为 `唇部`，不归为 `肤质改善`。`国械注进20213130109` 已按此规则修正。
- `中下面部/颏下/颈部皮肤松弛` 拆分。
- `下颏/下颌部`、`中面部容量/轮廓`、`痤疮/术后` 保留组合表达。

已覆盖：

- 首页热力图
- 机会矩阵
- 厂家热力图
- 注册官方信息表格
- 右侧抽屉
- 子赛道页 KPI、适应证图表、厂家 × 适应证热力图、表格、搜索

核心文件：

- `docs/assets/js/integrated.js`
- `docs/assets/js/track.js`
- `scripts/build_data.py`

### 子赛道页补丁

`docs/assets/js/track.js` 已修复旧逻辑：

- 不再直接使用旧 `primary_indication` 作为最终展示口径。
- 子赛道页 `厂家 × 适应证` 热力图改为运行时重新按规范化适应证生成。
- 子赛道页表格和搜索使用规范化后的适应证。
- 修复了部分子赛道页缺少筛选控件时的 JS 报错。

验证结果：

- `node --check docs/assets/js/track.js` 通过。
- 浏览器打开 `tracks/collagen.html?v=20260616-lidocaine-source-1`，当前脚本无控制台错误。
- `鼻唇沟/隆鼻` 前台不再作为一个合并适应证显示。
- `隆鼻` 和 `鼻唇沟` 可分别显示。

## 数据口径

用户刚明确：

- 所有二类医疗器械全部删除，不纳入分析格局。
- `小众材料` 收拢 PMMA、琼脂糖、溶脂类、可聚糖/ECM 等小体量或边界材料；不再单设“新型材料”。
- 其他部分，包括 EBD，不应称为材料，直接从材料统计中去掉。

当前首页已按这个方向处理：

- `niche_materials` 收拢小众/边界材料，避免把 PMMA 这类老材料误称为“新型材料”。
- EBD 不进入材料家族热力图和材料赛道活跃度。

## 仍建议后续做的事

1. 后续源表最好补 `country_or_region`、`position_tier`、`lidocaine_signal_status` 字段，把 HA 进口国家/地区和利多卡因统一口径从前台映射下沉到数据层。利多卡因源字段必须覆盖官方注册证名称、型号规格、结构及组成/主要组成成分；Galderma/Q-Med 的 `国械注进20213130059`、`国械注进20253130284` 等证号已证明仅看产品名会漏判。
2. 如果继续修改热力图宽度、排序、tooltip，需要同时检查：
   - `适应证 × 材料家族热力图`
   - `适应证 × 赛道机会矩阵`
   - `厂家 × 材料布局`
   - `厂家 × 适应证布局`
4. 每次前台 JS/CSS 修改后，递增缓存 query string，并让用户直接刷新原页面。
5. 继续保持前台不出现来源/出处/原文链接。

## 快速验证命令

```powershell
cd E:\shared\code\registration-insights-integrated

& 'C:\Users\gisel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check docs\assets\js\integrated.js
& 'C:\Users\gisel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check docs\assets\js\track.js
& 'C:\Users\gisel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check docs\assets\js\pivot.js
& 'C:\Users\gisel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check docs\assets\js\core.js
npm run test:dashboard -- http://127.0.0.1:8781/
npm run test:dashboard -- https://yiseut.github.io/Registration/?v=<commit>
```

重点页面：

- `http://127.0.0.1:8781/index.html?v=20260616-lidocaine-source-1`
- `http://127.0.0.1:8781/tracks/ha.html?v=20260616-lidocaine-source-1`
- `http://127.0.0.1:8781/pivot.html?v=20260616-lidocaine-source-1`
