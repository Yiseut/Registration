# Registration Insights Integrated

中国医美市场准入格局 Dashboard，本目录是 Cloud/Claude 版与 Codex 版的本地整合工作区。

## 当前定位

- 当前工作目录：`E:\shared\code\registration-insights-integrated`
- 本地预览地址：`http://127.0.0.1:8781/`
- 原始 Codex 数据/页面目录：`E:\shared\code\registration`
- 原始 Cloud/Claude 页面目录：`E:\shared\code\registration-insights`
- 重要原则：不要直接改动上面两个原始目录，先在本整合目录完成本地打磨。

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

## 当前缓存版本

- 首页脚本：`20260513-caha-trim-low-info-79`
- 子赛道页 `track.js`：`20260513-caha-trim-low-info-79`

如果修改前台 JS/CSS，继续递增 query string，方便用户直接刷新当前页面看到新版本。

## 数据和规则

主要数据来自：

- 官方主工作簿：`E:\shared\code\registration\output\master\registration_master_workbook.xlsx`
- 前台整合数据：`docs/assets/js/codex-data.js`
- Cloud/Claude JSON 数据：`docs/assets/data/overview.json` 和 `docs/assets/data/tracks/*.json`

当前分析口径：

- 二类医疗器械不纳入主格局分析。
- `小众材料` 收拢 PMMA、琼脂糖、溶脂类、可聚糖/ECM 等小体量或边界材料；不再单设“新型材料”。
- EBD 不是材料，不进入材料家族统计。
- 热力图只要有 1 条记录就显示，不再只筛选大于 2 家厂家的数据。

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

## 最近一次交接

最新交接记录见：

- [PROJECT_HANDOFF.md](PROJECT_HANDOFF.md)
