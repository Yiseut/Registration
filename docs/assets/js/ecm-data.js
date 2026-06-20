window.ECM_DASHBOARD_DATA = {
  meta: {
    title: "ECM 细胞外基质中国观察页",
    subtitle: "用于跟踪 ECM/脱细胞基质在中国医美注册和临床线索中的真实进展。",
    updated_at: "2026-06-19",
    scope: "中国市场优先；海外和相邻材料只作为边界提示。",
  },
  kpis: [
    {
      label: "已确认注册证",
      value: "0",
      unit: "张",
      note: "当前已收录注册记录未见 ECM 医美确证",
    },
    {
      label: "观察关键词",
      value: "5",
      unit: "组",
      note: "ECM、细胞外基质、脱细胞基质等",
    },
    {
      label: "相邻材料线索",
      value: "2",
      unit: "类",
      note: "丝素蛋白与再生修复概念需分开看",
    },
    {
      label: "当前判断",
      value: "早期",
      unit: "",
      note: "适合观察，不适合计入成熟赛道",
    },
  ],
  insights: [
    {
      eyebrow: "核心结论",
      title: "暂未形成中国 ECM 医美获批赛道",
      body: "截至当前数据，尚未看到以 ECM/细胞外基质/脱细胞基质作为核心材料，并且适用范围落在医美注射或填充场景的中国注册证。",
    },
    {
      eyebrow: "材料边界",
      title: "机制里出现 ECM 不等于 ECM 产品",
      body: "HA、PLLA、CaHA 文献或介绍里常出现细胞外基质、胶原重塑等表达，这类内容只能解释作用机制，不能把产品归为 ECM 材料。",
    },
    {
      eyebrow: "观察重点",
      title: "先等官方证据，再讨论市场格局",
      body: "一旦出现注册证、临床登记或受理信息，应优先拆出材料组成、适用范围、注册人、临床阶段和证据来源，再决定是否进入主赛道。",
    },
  ],
  stages: [
    {
      id: "concept",
      label: "材料词出现",
      count: 1,
      status: "已出现",
      detail: "ECM 已进入材料观察范围，目前主要用于提示和筛选。",
    },
    {
      id: "candidate",
      label: "产品线索",
      count: 0,
      status: "待确认",
      detail: "当前未见可归并为 ECM 医美产品的中国企业或产品线索。",
    },
    {
      id: "clinical",
      label: "临床/受理",
      count: 0,
      status: "待确认",
      detail: "未见可用于纳入统计的中国临床登记、默示许可或受理记录。",
    },
    {
      id: "approval",
      label: "注册证获批",
      count: 0,
      status: "未见",
      detail: "当前已收录注册记录中没有 ECM/脱细胞基质医美适应证确证。",
    },
    {
      id: "publish",
      label: "进入专题",
      count: 0,
      status: "观察中",
      detail: "在出现官方证据前，本页保持观察页，不进入成熟赛道统计。",
    },
  ],
  boundaries: [
    {
      term: "ECM / 细胞外基质",
      role: "核心观察词",
      status: "未见确证",
      rule: "注册证名称、组成或适用范围明确指向 ECM/细胞外基质材料，且属于医美相关用途时才纳入统计。",
    },
    {
      term: "脱细胞基质",
      role: "核心观察词",
      status: "未见确证",
      rule: "需要看到产品类型、组织来源、适用范围和监管属性；只有材料概念还不能算作产品。",
    },
    {
      term: "再生修复材料",
      role: "宽泛提示词",
      status: "仅作线索",
      rule: "词义过宽，不能直接作为赛道归类；需回到材料组成和适用范围判断。",
    },
    {
      term: "细胞外基质成分 / ECM 重塑",
      role: "机制描述",
      status: "排除归类",
      rule: "用于说明 HA、PLLA、CaHA 等材料的生物学机制时，仍归入原材料赛道。",
    },
    {
      term: "丝素蛋白 / 蚕丝蛋白",
      role: "相邻新材料",
      status: "单独观察",
      rule: "不并入 ECM；后续按丝素蛋白专题单独看注册、临床和企业线索。",
    },
  ],
  watchlist: [
    {
      signal: "HA 被描述为细胞外基质成分",
      source: "NMPA 科普信息",
      judgment: "不是 ECM 产品",
      next: "继续归入 HA 赛道，只用于材料边界说明。",
      url: "https://www.nmpa.gov.cn/xxgk/kpzhsh/kpzhshylqx/20210723105707187.html?m=&type=pc",
    },
    {
      signal: "PLLA / CaHA 促进 ECM 或胶原重塑",
      source: "再生材料文章与产品资料",
      judgment: "不是 ECM 产品",
      next: "继续归入对应材料赛道，避免概念误并。",
      url: "",
    },
    {
      signal: "丝素蛋白皮肤科交付",
      source: "公开文章线索",
      judgment: "相邻材料",
      next: "进入丝素蛋白专题，不并入 ECM。",
      url: "https://mp.weixin.qq.com/s/6bf80_HSY_xmrZ0EuTzxdg",
    },
    {
      signal: "丝素蛋白类填充剂管线",
      source: "企业管线线索",
      judgment: "相邻材料",
      next: "保留为候选线索，待出现注册或临床证据后归并。",
      url: "https://www.sohu.com/a/878302345_121303447",
    },
  ],
  sources: [
    {
      name: "已收录注册记录",
      detail: "195 条记录中未命中 ECM、细胞外基质、脱细胞基质等确证表达。",
    },
    {
      name: "材料分类",
      detail: "ECM 被设置为开放观察类目，需结合注册证描述确认。",
    },
    {
      name: "公开文章线索",
      detail: "当前更多命中为 HA 背景说明和丝素蛋白相邻线索，尚不构成 ECM 医美产品清单。",
    },
  ],
};
