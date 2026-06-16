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
- HA 子页把 106 张主格局证进一步拆成 91 张交联填充剂和 15 张非交联/水光肤质类；交联填充剂按 `国产 / 欧美进口 / 韩国进口 / 港澳台 / 其他进口` 定位。
- HA 含麻分析同时保留严格口径和候选口径：严格口径看字段/中文品名，候选口径进一步纳入英文 `Lidocaine` 或“含药”线索。当前交联填充剂严格口径 14 张，候选口径 24 张。

## 适应证分类规则

前台已经接入统一的适应证规范化规则，首页和子赛道页都已同步。

重点规则：

- `颏下脂肪堆积/双下巴` 视为一个适应证，显示为 `颏下脂肪堆积（双下巴）`。
- `鼻唇沟/隆鼻` 视为两个适应证，拆成 `鼻唇沟` 和 `隆鼻`。
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

后续如果重新生成 JSON，建议把同一套适应证规则下沉到数据生成脚本里，前台规则保留为兜底。

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

## 2026-06-16 前台可靠性规则

- 总览页必须显示口径说明：更新时间、统计口径、非销售份额声明、核心记录覆盖范围。
- CR4、HHI、国产/进口结构都是注册准入口径，不代表销量、收入或商业市占率。
- 筛选状态通过 URL 参数分享：`segment`、`company`、`class`、`origin`、`q`、`grain`、`map`。
- HA 子页记录浏览器额外支持 `shape`、`position`、`lidocaine` 参数，用于分享交联填充剂、韩国进口、含麻候选等细分视图。
- 移动端长矩阵默认折叠，注册官方信息筛选区为 sticky。
- smoke test 必须检查主表行数、集中度表、Dysport `S20200016`、HA 韩国进口含麻候选视图、详情抽屉、无旧 `codex-data.js`、移动端无横向溢出和 8 个赛道页加载。

## 最近一次交接

最新交接记录见：

- [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md)
