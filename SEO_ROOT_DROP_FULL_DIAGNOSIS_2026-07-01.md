# true-size-map 根页面流量暴跌：全面诊断报告（2026-07-01）

> 诊断对象：`https://www.runcell.dev/tool/true-size-map`（根页面）
> 暴跌起点：2026-04-29
> 本报告在前两份报告（`SEO_ROOT_DROP_ANALYSIS_2026-04-29.md`、`SEO_ROOT_DROP_SECOND_OPINION_2026-06-26.md`）基础上，补充了四类新证据：①主站仓库全量变更核查（此前只查过 `next.config.js`）；②截至 2026-06-28 的最新 GSC 每日数据（验证修复效果）；③竞品流量与 SERP 快照（Ahrefs）；④谷歌官方算法更新时间线（联网核实）。

---

## 一、最终结论（TL;DR)

**1. 这次暴跌的触发因素是我们自己的代码变更，不是单纯的谷歌侧操作。** 且证据比之前更强了一层：

- **时间线精确吻合**：`c5bc905`（SSG 改版）于 4-27 18:03 PDT 部署，sitemap `lastmod` 4-28；根页面 4-28 还正常（曝光 11,818、position 8.4），4-29 腰斩（5,440），4-30 崩塌（2,097、position 11.1）。谷歌在部署后 24–48 小时内完成了重新评估。
- **同一次部署内部的差分实验（本次新证据，最关键）**：`c5bc905` 把 SSG 预渲染应用到了**全部路由**，但 `seo-meta.json` 的 diff 显示**只有根页面的 title 被改写**（`True Size of Countries — Mercator Map Playground` → `True Size of Countries Map: Compare Real Country Sizes`），sea-level 页面的 title/meta 一行未动。结果：title 未动的 sea-level 页面同期**持续上涨**（周点击 210 → 650），title/H1/结构被重写的根页面 48 小时内崩塌。**这把根因收敛到"根页面语义信号被改写"，并排除了"SSG 渲染方式本身"这一嫌疑。**
- **竞品对照（本次新证据）**：Ahrefs 显示头部竞品 thetruesize.com 的周度自然流量在 4 月底完全平稳（37.3 万 → 37.7 万 → 36.6 万，无跳变）。如果是谷歌对 `true size` 词簇做了 SERP 级洗牌，市场第一名不可能毫无波动。**SERP 没有洗牌，只有我们掉了。**

**2. 谷歌侧因素存在，但只是"放大器"和"固化剂"，不是起因：**

- 3 月核心更新 3-27 启动、**4-8 已结束**——之后根页面还稳定运行了 3 周（position 8.0–8.6），排除。
- 4-23 起多个第三方跟踪器监测到**未命名的排名波动期**（[Search Engine Land 更新库](https://searchengineland.com/library/platforms/google/google-algorithm-updates)、[ALM Corp 4 月波动分析](https://almcorp.com/blog/google-search-ranking-volatility-april-2026/)），方向是"聚合/工具类薄页面暴露度上升"。我们的根页面在 4-23 → 4-28 之间数据完全正常（position 8.2–8.5、曝光 1.2–1.4 万/天），说明波动期本身没有打击我们；但**在波动期内做一次性大改版，等于在裁判重新打分时主动换了张卷子**，放大了重评估的下行风险。
- 5 月核心更新 **5-21 启动、6-2 结束**（[Search Engine Land](https://searchengineland.com/google-may-2026-core-update-rolling-out-now-478430)、[Search Engine Journal](https://www.searchenginejournal.com/google-begins-rolling-out-may-2026-core-update/575589/)）——比暴跌晚了 3 周，不是起因；但根页面 position 最差的一周（14.2，w/e 5-31）恰好落在该更新的 rollout 窗口内，**它大概率把改版后的低排名进一步固化了**。这也意味着：完整恢复可能需要等到下一次核心更新的重评估周期，需管理预期。

**3. 主站（run-cell-website）彻底排除。** 本次核查的不再只是 `next.config.js`，而是 4-01 → 5-15 的全部提交：内容全部是模型开关、桌面端登录、订阅去重、返佣系统、生物信息工具集（4-06），**没有任何提交触碰 sitemap、robots、rewrite 规则或 true-size-map 相关内链**。`/tool` 目录页对本工具的链接自 4-06 改版（仅新增工具卡片）后保持完好，线上实测仍存在。

**4. 对"负面影响范围"的技术判定（借助 sea-level 子页面这一对照组）：** 影响是**页面级、非站点级**。这不是 penalty（惩罚会波及全站），域名信任度未受损——同一 property、同一子域下的 sea-level 页面同期健康增长（position 稳定在 6.2 左右、周点击翻三倍）、compare 长尾页正常收录起量。损失全部集中在根页面的 `true size / real size` 泛词簇：曝光从 ~10 万/周跌到 ~1 万/周（−90%），position 从 8.2 → 11–13，在 "true size map" 的美国 SERP 前 15 中已完全消失。

---

## 二、关键数据

### 2.1 暴跌窗口的每日数据（GSC，根页面 vs sea-level）

| 日期 | 根页曝光 | 根页 position | sea-level 曝光 | sea-level position |
|---|---:|---:|---:|---:|
| 04-23 | 12,676 | 8.5 | 374 | 5.8 |
| 04-26 | 14,161 | 8.2 | 333 | 6.7 |
| **04-27** | 12,696 | 8.3 | 364 | 6.4 | ← 18:03 PDT 部署 `c5bc905` |
| 04-28 | 11,818 | 8.4 | 427 | 6.3 |
| **04-29** | **5,440** | 8.9 | 403 | 6.4 | ← 暴跌开始 |
| **04-30** | **2,097** | **11.1** | 378 | 6.3 | ← 崩塌完成 |
| 05-05 | 2,047 | 10.9 | 498 | 6.4 |

### 2.2 周度趋势（4 月初 → 6 月底）：根页面无恢复，sea-level 持续增长

| 周（截止） | 根页点击 | 根页曝光 | 根页 pos | sea-level 点击 | sea-level 曝光 | sea-level pos |
|---|---:|---:|---:|---:|---:|---:|
| 04-19 | 285 | 111,900 | 8.0 | 257 | 2,565 | 6.5 |
| 04-26 | 235 | 96,839 | 8.3 | 312 | 2,652 | 6.3 |
| 05-03 | 110 | 37,458 | 10.2 | 323 | 2,813 | 6.2 |
| 05-31 | 49 | 9,232 | **14.2** ← 5 月核心更新窗口 | 511 | 4,441 | 7.0 |
| 06-07 | 68 | 14,358 | 10.8 | 885 | 5,975 | 6.2 |
| 06-28 | 46 | 11,821 | 10.8 | 650 | 5,210 | 6.1 |

- **根页面：截至 6-28 没有恢复**。6-24/6-26 的修复上线后（404 修复已实测生效），6-24 → 6-27 有轻微 position 好转（9.6–10.2），但 6-28 又回到 12.4，尚在噪声范围内，需要继续观察。
- **sea-level：不但没受负面影响，点击量整个期间翻了三倍**（部分得益于改版新增的内链与自身外链 ruanyifeng.com 的支撑）。

### 2.3 竞品与 SERP（Ahrefs，2026-06 末快照）

- **thetruesize.com 周度自然流量 3 月 → 6 月全程平稳**（34–40 万区间缓慢漂移，4 月底无任何跳变）→ 词簇 SERP 未洗牌。
- **"true size map"（US）当前前 15 有机结果中无 runcell.dev**。压在我们上面的包括多个低权重仿制站：truesize.net（DR 25，第 2 位）、truesizeofcountries.org（DR 12，第 8 位）、truesize.world（DR 0，第 13 位）。
- **值得注意的标题细节**：这些仿制站的标题模板与我们改版后的新标题几乎同款——truesize.net 是 "TrueSize: **Compare Real Country and Region Sizes**"，truesizeofcountries.org 是 "True Size of Countries | **Compare Real Country Sizes** on Map"，而我们的新标题是 "True Size of Countries Map: **Compare Real Country Sizes**"。改版把我们从一个有差异化语义的标题（"Mercator Map Playground"，谷歌已认可其 position 8）改成了与一堆低质仿制站同模板的标题，**恰逢谷歌在 3 月核心更新后持续打压同质化工具页的窗口期**。这为"标题回退"提供了额外依据。

---

## 三、谷歌算法更新时间线 vs 我们的时间线

| 日期 | 谷歌侧 | 我们侧 | 根页面状态 |
|---|---|---|---|
| 03-27 → 04-08 | 3 月核心更新 rollout | 无变更 | 正常（pos ~8） |
| 04-23 起 | 未命名波动期（跟踪器升温） | 无变更 | **正常**（04-23→28：pos 8.2–8.5） |
| **04-27 18:03** | — | **部署 `c5bc905`** | 正常（最后一天） |
| **04-29 → 04-30** | （仍处波动期） | 无新变更 | **崩塌**（pos 8.4 → 11.1） |
| 05-21 → 06-02 | 5 月核心更新 rollout | 无变更 | 进一步恶化至 pos 14.2 后企稳 |
| 06-24 / 06-26 | — | 404 修复等上线（已实测生效） | pos ~10–12，暂无恢复信号 |

**推理**：若为纯谷歌侧原因，暴跌应对齐某个更新窗口（4-8 前或 5-21 后），且应伴随竞品波动、或波及同站同主题的子页面。三者皆无。唯一对齐的事件是我们自己的部署。

## 四、遗留问题与行动状态

| 事项 | 来源 | 状态（2026-07-01 实测） |
|---|---|---|
| 未知 URL 返回真 404 | 二诊 P2 | ✅ 已上线生效（unknown URL 与 `.html` 克隆均返回 404） |
| **root title/H1/description 回退旧语义信号** | 二诊 **P0** | ❌ **未执行**。线上仍是 `True Size of Countries Map: Compare Real Country Sizes` / `<h1>True Size of Countries Map</h1>` |
| 首屏初始 HTML 仍为 `Loading map...` 占位 | 二诊 P1 | ❌ 未执行（globe/equator/sea-level 已补内容，根页 hero 未动） |
| 根页内链/外链加强 | 二诊 P1/P2 | ❌ 未系统执行（根页 referring 仍以 `/tool` 为主） |

**优先级建议不变，且本报告的新证据进一步支持 P0**：先回退根页 title/H1/description 至旧语义（"Mercator Map Playground" 差异化信号），再补 hero 静态内容与内链，然后 GSC 请求重新索引，用固定 query 集（`true size map`、`true size of countries`、`the true size`）监控 2–4 周。同时对恢复速度保持现实预期：5 月核心更新已把低排名固化，完整恢复可能要等下一次核心更新周期。

## 五、数据来源与复现

- GSC：`ob12er-agent-skills/skills/gsc`（`sc-domain:runcell.dev`，页面维度过滤按日拉取，2026-04-01 → 2026-06-28）
- Ahrefs MCP：`site-explorer-metrics-history`（thetruesize.com，周度）、`serp-overview`（"true size map"，US）
- git：`world-map-reality`（工具仓库）、`run-cell-website`（主站，全量提交核查 04-01 → 05-15）
- 线上实测：`curl` 根页 title/H1/canonical、未知 URL 与 `.html` 状态码
- 谷歌更新时间线：[Search Engine Land — March 2026 core update](https://searchengineland.com/march-2026-google-core-update-what-changed-474397)、[Search Engine Land — May 2026 core update rolling out](https://searchengineland.com/google-may-2026-core-update-rolling-out-now-478430)、[Search Engine Land — May 2026 core update complete](https://searchengineland.com/google-may-2026-core-update-rollout-is-now-complete-479119)、[Search Engine Journal — May 2026 core update](https://www.searchenginejournal.com/google-begins-rolling-out-may-2026-core-update/575589/)、[ALM Corp — April 2026 volatility](https://almcorp.com/blog/google-search-ranking-volatility-april-2026/)、[Google Search Status Dashboard](https://status.search.google.com/products/rGHU1u87FJnkP6W2GwMi/history)
