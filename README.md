# Registration Insights

中国医美注册准入情报 Dashboard — Claude 风格、苹果卡片、可下钻的纯静态站点。

**在线预览**:启用 GitHub Pages 后访问 https://yiseut.github.io/Registration/

## 设计取向

- 浅色背景(`#FAF9F5` Claude 信纸色),专业咨询风
- 主色 Claude 橙 `#D97757`,延展深红、金、鼠尾草、海蓝、紫梅、灰陶六色
- 卡片是苹果风:圆角 18px、细阴影、发丝边、悬浮上抬,**不要左侧边框那种 AI 风**
- 大量渐变(径向背景光晕、标题渐变文字、柱图渐变填充、热力色阶)
- 数字、图表、卡片、表格行**全部可点**,点击触发右侧抽屉显示背后注册证清单

## 五个新角度

| # | 角度 | 答的问题 |
| - | --- | --- |
| 1 | 证书到期热力(13 季) | 哪个赛道、哪季度,谁要开始为续证发愁 |
| 2 | **厂家集团组合策略矩阵** | 谁是全栈集团 (Galderma/华熙/Merz),谁是单点深耕 |
| 3 | 国产 vs 进口 vs 港澳台 演化 | 国产替代是不是真的发生在每个赛道 |
| 4 | **适应症 × 材料家族 热力** | 每个部位被哪些材料抢占 |
| 5 | 赛道集中度 (HHI/CR4/CR8) | 哪个赛道是寡头,哪个是高度分散 |

## 目录结构

```
registration-insights/
├── data/
│   ├── registration_records_master.csv   # 原始主表(从 codex 项目拷过来)
│   └── manifest.json
├── scripts/
│   └── build_data.py                     # CSV → JSON ETL
├── docs/                                 # GitHub Pages 根目录
│   ├── index.html                        # 总览页
│   ├── tracks/
│   │   ├── _template.html                # 子赛道模板(开发用,不被引用)
│   │   ├── ha.html / collagen.html / plla.html / pcl.html
│   │   └── caha.html / botulinum.html / ebd.html
│   └── assets/
│       ├── css/theme.css                 # Claude 主题
│       ├── js/{core,overview,track}.js   # 共享工具 + 页面装配
│       └── data/{overview,manifest}.json + tracks/<key>.json
└── README.md
```

## 本地开发

```powershell
# 1) 重建 JSON
python scripts/build_data.py

# 2) 启本地服务
cd docs
python -m http.server 8780 --bind 127.0.0.1

# 3) 打开 http://127.0.0.1:8780/
```

## 数据契约

主表 CSV 来自 [registration](../registration/) Codex 项目的
`output/master/registration_records_master.csv`,字段口径见原项目
`PROJECT_HANDOFF.md` 与 `README.md`。本仓库**只读取**该 CSV,
所有可视化通过 `scripts/build_data.py` 一次性生成 JSON,前端无构建步骤。

主格局口径:三类医疗器械 + 药品批准。二类、擦边、边界使用、非合规医美适应症
样本不计入主格局 KPI,仅作为子赛道研究保留。

## 七大战略子赛道

| key | 中文 | 主格局证 | 强调色 |
| --- | --- | -- | --- |
| `ha`        | 玻尿酸 / 透明质酸钠 | 108 | `#D97757` |
| `collagen`  | 胶原蛋白           |  18 | `#B5915A` |
| `plla`      | 童颜针 / PLLA      |  12 | `#8B5A6B` |
| `pcl`       | 少女针 / PCL       |   5 | `#C15F3C` |
| `caha`      | 羟基磷酸钙 / CaHA   |   2 | `#5B7B9A` |
| `botulinum` | 肉毒毒素           |   8 | `#8B9D7F` |
| `ebd`       | EBD 设备类         |  21 | `#6E6A65` |

## 凭证

数据来源:NMPA 国家政务服务平台医疗器械注册证查询、医美公众号原文交叉核验
(详见原 codex 项目的 source_account/source_url/evidence_text 字段)。
本 dashboard 不是官方信息,**入表标记 `verified` 仅指 NMPA 查询返回 `verified` 状态**。

构建:Claude Code (`claude-opus-4-7`) + ECharts 5.5.
