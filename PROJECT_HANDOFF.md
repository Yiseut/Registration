# Project Handoff

更新日期：2026-05-11

## 接手入口

- 项目目录：`E:\shared\code\registration-insights-integrated`
- 本地页面：`http://127.0.0.1:8781/`
- 当前首页缓存：`20260513-niche-fullrow-heatmaps-82`
- 当前子赛道页缓存：`20260513-niche-fullrow-heatmaps-82`
- 启动脚本：`Open-Dashboard.bat`

不要直接改：

- `E:\shared\code\registration`
- `E:\shared\code\registration-insights`

本项目是整合工作区，确认后再决定是否覆盖 GitHub 版本。

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

`七赛道集中度` 卡片目前已从可见页面移除。

## 最近完成的关键修改

### 热力图视觉统一

所有热力图统一为总表的晶莹悬浮格子语言：

- `docs/assets/js/core.js` 提供共享的热力图 CSS 变量和 ECharts 单元格样式生成函数。
- 首页 HTML/CSS 矩阵、HA 的产品形态 × 适应证矩阵、子页 ECharts 厂家 × 适应证热力图都接入同一套半透明渐变、高光边、柔和阴影和 hover 浮起规则。
- 首页与子页缓存统一递增到 `current-refresh-55`。

### HA 子赛道整合

`docs/tracks/ha.html` 已切回 Cloud/Claude 子页骨架，并只在整合目录内替换内容模块：

- 删除原来的 `布局视角` 双卡片。
- 顶部 KPI 已增加 `产品形态`，显示 HA 主格局内 8 个原始产品形态。
- KPI 下方已补入 Codex 版信息卡：HA 主格局展示 `交联填充类 / 非交联水光、肤质改善类 / 含利多卡因`，其中 `含利多卡因` 是优势差异卡，不并入产品形态分类。
- 原 `厂家竞争力 + 产品形态结构` 双卡区域已删除，避免与头部卡片和后续业务矩阵重复。
- `注册时间线` 已补成两张图：`逐年获批与累计` 使用 2008-2026 基准口径，`国产 vs 进口演变` 使用同一组年度新增拆分。
- `国产 vs 进口演变` 配色改为橙色 / `#fbdec7` 米色，柱体采用与逐年图一致的渐变圆角风格，小值标签改为柱体外侧显示。
- 时间线后新增 `产品形态 × 适应证热力图`，HA 口径只保留交联填充与非交联水光/肤质改善两类。
- `厂家竞争力矩阵` 改为 `业务矩阵`，内部卡片标题和右上筛选框均已移除。
- 注册证清单的产品列增加产品形态标签，保留 `NMPA / 待核` 核验列。

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

### 子赛道页补丁

`docs/assets/js/track.js` 已修复旧逻辑：

- 不再直接使用旧 `primary_indication` 作为最终展示口径。
- 子赛道页 `厂家 × 适应证` 热力图改为运行时重新按规范化适应证生成。
- 子赛道页表格和搜索使用规范化后的适应证。
- 修复了部分子赛道页缺少筛选控件时的 JS 报错。

验证结果：

- `node --check docs/assets/js/track.js` 通过。
- 浏览器打开 `tracks/collagen.html?v=20260511-current-refresh-55`，当前脚本无控制台错误。
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

1. 把适应证规范化规则下沉到数据生成脚本，避免未来重新生成 JSON 后前台再兜底。
2. 如果继续修改热力图宽度、排序、tooltip，需要同时检查：
   - `适应证 × 材料家族热力图`
   - `适应证 × 赛道机会矩阵`
   - `厂家 × 材料布局`
   - `厂家 × 适应证布局`
3. 每次前台 JS/CSS 修改后，递增缓存 query string，并让用户直接刷新原页面。
4. 继续保持前台不出现来源/出处/原文链接。

## 快速验证命令

```powershell
cd E:\shared\code\registration-insights-integrated

& 'C:\Users\gisel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check docs\assets\js\integrated.js
& 'C:\Users\gisel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check docs\assets\js\track.js
& 'C:\Users\gisel\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' --check docs\assets\js\core.js
```

重点页面：

- `http://127.0.0.1:8781/index.html?v=20260511-current-refresh-55`
- `http://127.0.0.1:8781/tracks/ha.html?v=20260511-current-refresh-55`
