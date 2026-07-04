# SEO 流量暴跌技术诊断报告：true-size-map 根页面（2026-04-29 起）

> 诊断对象：`https://www.runcell.dev/tool/true-size-map`（及其子页面）
> 暴跌起点：2026-04-29
> 报告日期：2026-06-25
> 数据来源：git 历史（tool 仓库 `world-map-reality` + 主站 `run-cell-website`）、线上 HTTP 实测、Google Search Console（`sc-domain:runcell.dev`，含 URL 级 inspect）

---

## 一、执行摘要（TL;DR）

1. **这是我们自己的代码造成的，不是单纯的谷歌操作。** 唯一吻合的变更是 tool 仓库 **2026-04-27 的 commit `c5bc905`（SSG 改版）**，上线 2 天后（4-29）流量断崖。主站路由配置在整个掉量期间（2-13 → 6-25）零改动，排除主站因素。

2. **损失集中在根页面，子页面安然无恙——已被 GSC 数据证实。** before/after 对比里 true-size-map 系列**只有根页面**是 loser；sea-level、compare 等子页面仍稳居第一页（position 6–7）。

3. **根页面是被「降权」，不是被「去索引」。** GSC URL inspect 显示根页面 `Submitted and indexed`、self-canonical、抓取正常。它只是从 **position 8.2 跌到 11.9（第一页底 → 第二页）**，曝光 −85%、点击 −70%。曝光暴跌是「第一页→第二页」的机械结果（第二页几乎不计曝光）。

4. **此前怀疑的两个技术问题（重复 `.html`、soft-404 克隆）经数据证伪——谷歌从未抓取它们。** 因此 **2026-06-24 的 `fix/true-size-map-seo-recovery`（删除重复 `.html`）修的是一个谷歌根本没发现的非问题，对首页恢复无效。**

5. **真正的诱因：4-27 对首页做了一次性大改**——改了 `<title>`、把渲染从 CSR 换成 SSG（Googlebot 看到的 hero 地图是 `Loading map...` 占位）、重构了页面结构。一个本就处在第一页边缘（position 8）的头部词页面，被谷歌重新评估后跌到第二页。子页面因为是长尾词、且有外链/排名余量而扛住了。

---

## 二、时间线与因果

| 日期 | 仓库 | 事件 | 证据 |
|---|---|---|---|
| 2026-02-13 | 主站 | `501fc8a fix: ssr sub repo`，确立 `/tool/true-size-map/*` → `true-size-map.runcell.dev` 的 rewrite 代理 | git |
| **2026-02-13 → 2026-06-25** | 主站 | **`next.config.js` 期间零改动** → 掉量与主站无关 | `git log -- next.config.js` |
| **2026-04-27 18:03 PDT** | tool | **`c5bc905` SSG 改版上线**（改 title + CSR→SSG + 重构 + 新增 compare 页 + sitemap 改写） | git；sitemap `lastmod=2026-04-28` |
| **2026-04-29** | — | **根页面流量断崖** | GSC 截图 |
| 2026-04-28 → 06-23 | tool | **窗口内无任何其他提交** | `git log` |
| 2026-06-24 | tool | `848927b` 删除重复 `.html`（修错对象，见 §五） | git |

**关键判断：掉量窗口内有且仅有 `c5bc905` 一次部署，且它恰好重写了根页面。**

---

## 三、GSC 数据（决定性证据）

### 3.1 根页面 before/after（losers，对比 4/01–4/28 vs 4/30–5/27）

| 指标 | 掉量前 | 掉量后 | 变化 |
|---|---|---|---|
| impressions | **342,754** | **50,140** | **−85%** |
| clicks | 985 | 293 | −70% |
| position | **8.2** | **11.9** | 第一页底 → 第二页 |
| CTR | 0.29% | 0.58% | （略升，见下）|

> losers 列表中 true-size-map 系列**只有根页面这一行**，子页面零损失。
> CTR 不降反升，说明问题不是「标题/摘要没人点」，而是「排名掉到第二页、曝光基数崩塌」。曝光 −85% 与 position 8→12 完全自洽：第二页结果只有用户翻页才计曝光，因此跌出第一页会让曝光近乎归零。

### 3.2 当前页面级快照（最近 28 天）

| 页面 | clicks | impressions | position | 状态 |
|---|---|---|---|---|
| `/tool/true-size-map`（根） | 242 | 43,748 | **12.1** | ⚠️ 降权中 |
| `/sea-level-rise-simulator` | 2,799 | 21,247 | **6.4** | ✅ 健康 |
| `/compare/russia-vs-united-states` | 66 | 10,208 | 7.5 | ✅ |
| `/compare/japan-vs-united-states` | 55 | 19,452 | 7.5 | ✅ |

> 根页面曝光仍是全工具最高（43,748），但排名第二页 → 点击被锁死。这是「被压制」而非「被删除」的典型形态。

### 3.3 URL 级索引诊断（inspect）

| URL | Coverage | 含义 |
|---|---|---|
| `/tool/true-size-map`（根） | **Submitted and indexed**，self-canonical，6-24 刚抓取，fetch 成功 | 正常收录，纯排名降权 |
| `/tool/true-size-map/`（带斜杠） | Crawled - currently not indexed（末次抓取 3-01） | 旧 URL，被 301 合并到无斜杠版，正常 |
| `/sea-level-rise-simulator` | Indexed，referring 含**外链 ruanyifeng.com** + sitemap | 健康且有外链支撑 |
| `/sea-level-rise-simulator.html`（重复克隆） | **URL is unknown to Google，从未抓取** | 重复 `.html` 谷歌没爬过 |
| `/this-page-does-not-exist-xyz123`（垃圾） | **URL is unknown to Google，从未抓取** | soft-404 克隆谷歌没爬过 |

---

## 四、4-27 改版到底改了首页什么（`c5bc905`）

`c5bc905` 对首页同时做了三处会触发谷歌重排的改动：

1. **改了 `<title>`**（最直接的排名信号）
   - 旧：`True Size of Countries — Mercator Map Playground`（当时 position ~8）
   - 新：`True Size of Countries Map: Compare Real Country Sizes`（现在 position ~12）
2. **渲染模式 CSR → SSG**：入口 `index.html` 从 `/src/main.tsx` 改为 `/src/entry-client.tsx`，新增 SSR 预渲染。Googlebot 现在索引的是预渲染快照，而首页的核心内容（交互地图）在快照里是 **`Loading map...` 占位**（实测线上首页 `<h1>True Size of Countries Map</h1>` 之后即 `Loading map...`）。
3. **页面结构大改**：`App.tsx +194 行`、新增 `SeoContent.tsx +147 行`、导航/路由重构。

> 注：内容质量不是退化方向——改版后首页正文 **481 词**（去标签），是三类页面里最多的（sea-level 仅 90 词却健康）。所以「内容变薄」可排除；问题在于「一次性大改触发重排 + 头部词竞争激烈」。

### 为什么只砸根页面、不碰子页面

- **是「我们的改动」而非「谷歌大更新」的最强证据：外科手术式隔离。** 同一站点、同一属性下，谷歌不会只精准打掉首页却让同主题的子页面稳居第一页。掉的恰好是被一次性重写的那一个页面。
- **根页面本就在第一页边缘（position 8）**，竞争词是 `true size map`、`true size of countries`、`thetruesize.com map`（强势竞品品牌词），一次重排就把它推过了第一页/第二页的临界线。
- **子页面有余量、有外链**：sea-level 在 position 6 且有外部反链（ruanyifeng.com）；compare 页是长尾词、竞争低。根页面的 referring URL 只有内部 `/tool`，缺外链支撑，抗冲击最弱。

---

## 五、被数据证伪的几个假设（含 6-24「修复」为何无效）

| 假设 | 结论 | 依据 |
|---|---|---|
| 重复 `.html` URL 稀释权重 | ❌ 证伪 | `.html` 克隆「unknown to Google」，从未被抓取 |
| soft-404 兜底克隆首页 | ❌ 非本次主因 | 垃圾 URL「unknown to Google」，从未被抓取（但仍是隐患，见 §六） |
| 首页被去索引 / canonical 被改 | ❌ 证伪 | inspect = Submitted and indexed，self-canonical |
| 首页内容变薄 | ❌ 证伪 | 首页 481 词，三页中最多 |
| 尾斜杠 / canonical 不一致 | ❌ 证伪 | 主站 301 `/...map/`→`/...map`，已正确合并 |
| 主站路由配置在 4 月被改 | ❌ 证伪 | `next.config.js` 2-13→6-25 零改动 |

> **因此 `848927b`（6-24 删除重复 `.html`）修的是一个谷歌从未发现的非问题，对首页恢复无任何作用。** 之前误以为"已修复"，需要纠正认知——首页问题至今未被处理。

---

## 六、隐患：soft-404 兜底（建议顺手修，但它不是本次主因）

链路：主站 `/tool/true-size-map/:path*` →（rewrite）→ 工具 `vercel.json` 的 `{ "src": "/(.*)", "dest": "/index.html" }` 兜底。
实测任意不存在 URL → **200 + 完整首页克隆 + canonical 指向首页**。

目前谷歌尚未抓取这些克隆，所以暂未造成伤害；但这是一个随时可能被外链/历史 URL 触发的地雷。建议让未知 URL 返回真正的 404（而非首页 200），见下。

---

## 七、行动建议

### 立即（认知纠偏）
- **停止把「重复 `.html`」当作病因**——数据已证伪，6-24 的修复对首页无效。

### 首页恢复（核心）
1. **复盘 `<title>` 改动**：旧标题对应 position 8、新标题对应 position 12，强相关。可考虑回退到接近旧标题、或做受控测试。
2. **让 Googlebot 看到实质 hero 内容**：首页预渲染快照里地图是 `Loading map...` 占位。考虑 SSR/静态兜底一段描述性内容或静态地图，避免核心区域呈现"加载中"。
3. **加强首页内部链接与外链**：根页面当前 referring 仅 `/tool`；子页面/主站应更多指向首页，并争取外链（参考 sea-level 的外链优势）。
4. **改完后在 GSC 对首页 URL Inspection → 请求重新编入索引**，并持续监控 position。

### 隐患清理（独立于恢复）
5. 改工具 `vercel.json`：未知路由返回真 404（`{ "src": "/(.*)", "status": 404, "dest": "/404.html" }` + 预渲染产出带 `noindex` 的 `404.html`）。所有真实路由已预渲染成文件、由 `filesystem` 优先命中，去掉兜底不影响正常页面。

### 排除外部因素
6. 在 Google Search Status Dashboard 核对 2026-04 下旬是否有官方 ranking update（本机知识截止 2026-01 无法判断）。但鉴于"只精准打掉被改写的首页、子页面无恙"，即便有更新，**我们的改版也是主因**。

---

## 附录：复现命令

```bash
# GSC（凭据在 ob12er-agent-skills/skills/gsc）
cd ob12er-agent-skills/skills/gsc/scripts/google_search_console
export GSC_SITE_URL="sc-domain:runcell.dev" GSC_BASE_URL="https://www.runcell.dev"
python3 gsc.py losers --start1 2026-04-01 --end1 2026-04-28 --start2 2026-04-30 --end2 2026-05-27
python3 gsc.py pages --limit 15
python3 indexing.py inspect /tool/true-size-map

# 线上 soft-404 实测
curl -sS -o /dev/null -w "%{http_code}\n" https://www.runcell.dev/tool/true-size-map/this-page-does-not-exist

# 关键 commit
git -C world-map-reality show c5bc905 --stat   # 4-27 SSG 改版
git -C run-cell-website log -- next.config.js   # 主站路由历史（2-13→6-25 零改动）
```
