# Registration Insights Integrated

中国医美市场准入格局 Dashboard，本目录是 Cloud/Claude 版与 Codex 版的本地整合工作区。

## 当前定位

- 当前工作目录：`E:\shared\code\registration-insights-integrated`
- 本地预览地址：`http://127.0.0.1:8781/`
- 原始 Codex 数据/页面目录：`E:\shared\code\registration`
- 原始 Cloud/Claude 页面目录：`E:\shared\code\registration-insights`
- 重要原则：本目录是线上 GitHub Pages 的前台发布仓库；原数据库仍以 `E:\shared\code\registration` 为源头。

## 打开方式

```powershell
cd E:\shared\code\registration-insights-integrated
.\Open-Dashboard.bat
```

或手动启动：

```powershell
cd E:\shared\code\registration-insights-integrated\docs
python -m http.server 8781 --bind 127.0.0.1
```

然后打开 `http://127.0.0.1:8781/`。

## 前台表达原则

- 对外页面只呈现事实、数据和可视化，不写内部设计思路、工具来源、版本整合逻辑或后续修改计划。
- 页面内不展示来源、出处、原文、原文链接等采集渠道信息。
- 统一使用 `注册官方信息`，不使用 `注册原始信息`。
- 统一使用 `透明质酸钠`，不要混用 `玻尿酸`、`玻尿酸/透明质酸钠`。
- 赛道标题统一使用专业名称，如 `PLA`、`PCL`、`CaHA`，不使用“童颜针”“少女针”等消费化称呼。
- 目前只打磨浅色模板，不做深色模板。

## 页面结构

当前导航统一为：

1. 总览
2. 透明质酸钠
3. 肉毒毒素
4. 胶原蛋白
5. PLA
6. PCL
7. CaHA
8. 小众材料
9. EBD 设备
10. 自定义透视

总览页以 Cloud/Claude 的浅色咨询风格为基础，保留 Codex 的分析视角和热力图表达。

## 缓存与公开验证

线上验证优先使用提交号做页面级 cache busting：

```text
https://yiseut.github.io/Registration/?v=<commit>
```

如果修改前台 JS/CSS 后遇到 GitHub Pages 或浏览器缓存延迟，先用 `?v=<commit>` 验证公开页，再判断是否需要递增静态资源 query string。

## 数据和规则

主要数据来自：

- 原数据库主表：`E:\shared\code\registration\output\master\registration_records_master.csv`
- 发布仓库同步副本：`data/registration_records_master.csv`
- 前台事实源：`docs/assets/data/overview.json`、`docs/assets/data/manifest.json`、`docs/assets/data/tracks/*.json`

`docs/assets/js/codex-data.js` 是历史文件，不再作为总览页默认数据源，也不能作为 fallback。总览页如无法读取新版 JSON，应直接暴露初始化失败，不能悄悄回退到旧数据。

当前分析口径：

- 二类医疗器械不纳入主格局分析。
- `小众材料` 收拢 PMMA、琼脂糖、溶脂类、可聚糖/ECM 等小体量或边界材料；不再单设“新型材料”。
- EBD 不是材料，不进入材料家族统计。
- 热力图只要有 1 条记录就显示，不再只筛选大于 2 家厂家的数据。
- HA 子页把 106 张主格局证进一步拆成 91 张交联填充剂和 15 张非交联/水光肤质类；交联填充剂按 `国产 / 欧美进口 / 韩国进口 / 港澳台 / 其他进口` 定位，其中 `其他进口` 作为待复核桶，当前已核实后为 0 张。
- HA 利多卡因分析以官方注册证名称、产品名、型号规格和结构组成为准：中文“利多卡因”或英文 `Lidocaine` 均直接计入“含利多卡因”，不再拆“严格/候选”口径；当前 91 张交联填充剂中含利多卡因 37 张、未见利多卡因 54 张。
- `pivot.html` 是自定义透视工作台，直接读取 `manifest.json` 和各赛道 JSON；默认视图为 HA 交联填充剂的 `利多卡因状态 × 定位层级`。

前台排查沟通口径：

- 如果用户问“已补录但前台没有看到”“年度新增数字和点开清单不一致”，先按状态链路解释：`已收录/未收录 → 官方详情是否已同步 → 适应症、规格、结构组成是否完整 → 是否进入主格局 → 前台展示在哪个口径`。
- 已收录但 NMPA/官方注册证详情尚未发布或未同步、适应症等关键字段缺失的记录，应说明为 `待复核/底层`，不直接进入主格局；前台可在年度新增分层或待复核口径里展示。
- 已入库且字段完整但前台仍缺失时，优先检查 JSON 是否重建、GitHub Pages 是否已发布、静态资源 query string 和浏览器缓存是否更新。

流程设计原则：

- 所有优化都必须建立在让流程更精简、更高效、更人性化的基础上。
- 优先提升数据质量、事实精准度、字段匹配度和前台解释清晰度，而不是增加新的操作步骤。
- 用户已经可以在 Codex 项目对话里完成人工投喂、更新请求和状态确认，不应再设计“去仪表盘复制口令，再到 PowerShell 执行”的中转流程。
- 前台 Dashboard 的职责是展示、分析和解释数据；后台更新与核验应尽量通过对话中的自然语言请求由项目工作流代为执行。

## 适应证分类规则

前台已经接入统一的适应证规范化规则，首页和子赛道页都已同步。

重点规则：

- `颏下脂肪堆积/双下巴` 视为一个适应证，显示为 `颏下脂肪堆积（双下巴）`。
- `鼻唇沟/隆鼻` 视为两个适应证，拆成 `鼻唇沟` 和 `隆鼻`。
- 官方适用范围出现 `唇红体`、`唇红缘`、`唇黏膜/唇粘膜`、`唇部不对称`、`唇部组织容积` 或 `容积缺损` 时，按 `唇部` 归类，不归入 `肤质改善`。
- `下颏/下颌部`、`中面部容量/轮廓`、`痤疮/术后` 等目前保留为组合表达。
- `中下面部/颏下/颈部皮肤松弛` 拆分为多个适应证。

已同步的前台模块：

- 首页 KPI 和七大战略子赛道卡片
- 注册准入趋势
- 注射剂市场结构
- 结构性压力与演化
- 适应证 × 材料家族热力图
- 适应证 × 赛道机会矩阵
- 厂家 × 材料布局热力图
- 厂家 × 适应证布局热力图
- 注册官方信息表格
- 点击弹窗 / 右侧抽屉
- 子赛道页 KPI、适应证列表、厂家 × 适应证热力图、表格和搜索

同一套适应证规则已在 `scripts/build_data.py` 中生成时兜底，前台规则保留为展示层补充。

## 日常同步与发布

从原数据库同步并发布：

```powershell
cd E:\shared\code\registration-insights-integrated
.\sync-and-publish.bat
```

这一步会复制：

```text
E:\shared\code\registration\output\master\registration_records_master.csv
  -> data\registration_records_master.csv
```

然后运行 `scripts/build_data.py` 生成 `docs/assets/data/*.json`，提交并推送到 `https://github.com/Yiseut/Registration`。

本地重建 JSON：

```powershell
python .\scripts\build_data.py
```

本地前台 smoke test：

```powershell
npm run test:dashboard -- http://127.0.0.1:8781/
```

公网 smoke test：

```powershell
npm run test:dashboard -- https://yiseut.github.io/Registration/?v=<commit>
```

GitHub Actions 已配置 `Dashboard QA`，push 到 `main` 后会重建数据、启动静态服务并运行 Playwright smoke test。

## 外部线索发现机制

为避免再次出现“外部已获批但主表未发现”的缺口，仓库新增 `Intelligence Monitor`：

- 定时：`.github/workflows/intelligence-monitor.yml` 每天 21:00（Asia/Shanghai）运行，也支持手动触发。
- 官方主线：扫描/发现 NMPA 医疗器械批准证明文件送达信息和电子证照纠错送达信息，以注册证号和 `data/registration_records_master.csv` 做差异比对。
- 公众号线索：固定账号池和搜索词在 `config/intelligence_monitor.json`，策略是“指定公众号账号 + 获批/批准上市/注册证”等宽召回，不把证号、NMPA、新适应证作为第一层前置过滤。
- 入库边界：公众号文章只生成候选线索；任何新增记录进入主表和前台前，仍必须经过 NMPA/CMDE/官方注册信息核验。
- 通知方式：发现可能相关的缺口时创建或更新 `intelligence-monitor` GitHub issue；workflow 本身不因发现线索失败，避免把正常情报提醒变成失败邮件。

本地运行：

```powershell
python .\scripts\intelligence_monitor.py --days 14 --run-web-search
```

如果没有配置 `JINA_API_KEY`，脚本仍会生成 `output/intelligence_monitor/search_inputs_latest.csv`，作为 NMPA 和指定公众号的定期搜索输入清单；配置密钥后可自动执行 Jina 搜索。对单个 NMPA 送达页做复核：

```powershell
python .\scripts\intelligence_monitor.py --seed-url "https://www.nmpa.gov.cn/zwfw/sdxx/sdxxylqx/qxpjfb/20260312163232162.html"
```

## 2026-06-16 前台可靠性规则

- 总览页顶部只保留更新时间，不展示统计口径、非销售份额声明、核心记录覆盖范围等后台解释性语言。
- CR4、HHI、国产/进口结构等注册准入口径说明应放在必要的分析场景中，避免在首页顶部制造数字口径混淆。
- 总览页产地结构 KPI 使用 `证照数` 表达，并给每个数字加 `张` 单位；不要使用 `99 : 79 : 6` 这种容易被误读为比例的写法。
- 中国企业地图头部只显示城市和注册主体，不显示地图子集注册证总数，避免与全局已收录注册证总数混淆。
- 筛选状态通过 URL 参数分享：`segment`、`company`、`class`、`origin`、`q`、`grain`、`map`。
- HA 子页记录浏览器额外支持 `shape`、`position`、`lidocaine` 参数，用于分享交联填充剂、韩国进口、含利多卡因等细分视图。
- 自定义透视页支持 `rows`、`cols`、`metric`、`scope`、`q` 和 `f_<field>` 参数，拖拽后的行列状态可分享。
- 移动端长矩阵默认折叠，注册官方信息筛选区为 sticky。
- smoke test 必须检查主表行数、集中度表、Dysport `S20200016`、HA 韩国进口含利多卡因视图、官方成分命中的 HA 利多卡因证号、Galderma/Q-Med 瑞典/瑞士含利多卡因透视、自定义透视页默认 91 张和拖拽列变量、详情抽屉、无旧 `codex-data.js`、移动端无横向溢出和 8 个赛道页加载。

## 最近一次交接

最新交接记录见：

- [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md)
