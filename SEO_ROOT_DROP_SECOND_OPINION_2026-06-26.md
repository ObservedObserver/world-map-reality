# true-size-map 根页 SEO 下跌：独立判断报告（2026-06-26）

> 诊断对象：`https://www.runcell.dev/tool/true-size-map`
> 目的：对 `SEO_ROOT_DROP_ANALYSIS_2026-04-29.md` 做独立复核，帮助后续形成共识。
> 数据来源：本地 git 历史、线上 HTTP 实测、Google Search Console 脚本复查。

## 一、我的总体判断

我认为原报告的大方向是成立的：这次下跌最像是 `2026-04-27` 的 `c5bc905` 改版触发了 Google 对根页的重新评估，导致根页在 `true size` / `real size` / `country size` 这组泛词和头部词上的可见度明显下调。

这不是去索引问题，也不像 canonical、robots、主站 rewrite 或 `.html` 重复 URL 直接造成的事故。根页当前仍是 `Submitted and indexed`，Google 最近抓取成功，且同工具下的 sea-level 页面同期稳定。

不过我会把“原因”表述得比原报告更谨慎一点：不是单独某一个点导致暴跌，而是一次较大的页面重写叠加了标题/H1/首屏初始 HTML/主题信号/外链弱等因素。根页原本大量 query 已经在 7-9 名的边缘位置，一次重新评估后，排名略降就足以让 impressions 断崖。

## 二、我复核确认的关键事实

### 1. 时间线与代码变更高度吻合

本地 git 显示：

| 日期 | commit | 事件 |
|---|---|---|
| 2026-04-27 18:03 PDT | `c5bc905` | `Add SSG prerendering and SEO comparison pages`，改动首页 title、结构、SSR/SSG 输出、compare pages、sitemap |
| 2026-04-28 | sitemap `lastmod` | 新页面/新 sitemap 被发布 |
| 2026-04-29 | GSC | 根页 impressions 开始断崖 |
| 2026-06-24 | `848927b` | 删除 prerender 生成的重复 `.html` 文件 |

`2026-04-27` 到 `2026-06-24` 之间没有其他提交可以解释根页级别的下跌。

### 2. 下跌集中在根页，不是全站/全工具一起掉

GSC page loser 复查：

| page | clicks old | impressions old | position old | clicks new | impressions new | position new |
|---|---:|---:|---:|---:|---:|---:|
| `/tool/true-size-map` | 985 | 342,754 | 8.2 | 293 | 50,140 | 11.9 |

日趋势更关键：

| date | root impressions | root position | sea-level impressions | sea-level position |
|---|---:|---:|---:|---:|
| 2026-04-28 | 11,818 | 8.4 | 427 | 6.3 |
| 2026-04-29 | 5,440 | 8.9 | 403 | 6.4 |
| 2026-04-30 | 2,097 | 11.1 | 378 | 6.3 |

根页在 `2026-04-29` 到 `2026-04-30` 急跌，而 sea-level 同期基本稳定。这是“根页被重新评估”的强证据。

### 3. 根页没有去索引

URL Inspection 当前结果：

| URL | 状态 |
|---|---|
| `/tool/true-size-map` | `PASS`，`Submitted and indexed`，`INDEXING_ALLOWED`，`Page Fetch: SUCCESSFUL`，最近抓取 `2026-06-24T18:10:22Z` |
| `/tool/true-size-map/sea-level-rise-simulator` | `PASS`，`Submitted and indexed`，有 `ruanyifeng.com` 外链 |
| `/tool/true-size-map/sea-level-rise-simulator.html` | `URL is unknown to Google` |
| 随机不存在 URL | `URL is unknown to Google` |

所以问题是 ranking/quality/query relevance 层面的，不是收录层面的。

## 三、query 级复查：下跌来自哪些词

根页的可见 query 对比（`2026-04-01` 到 `2026-04-28` vs `2026-04-30` 到 `2026-05-27`）显示，损失主要集中在泛词和头部词。

| query | clicks | impressions | position |
|---|---:|---:|---:|
| `true size of countries` | 138 -> 34 | 27,079 -> 5,535 | 7.1 -> 8.8 |
| `true size map` | 95 -> 12 | 33,659 -> 2,583 | 7.5 -> 9.3 |
| `the true size` | 63 -> 4 | 20,124 -> 602 | 8.3 -> 12.4 |
| `the true size of` | 65 -> 13 | 38,342 -> 1,203 | 8.4 -> 11.9 |
| `true size of` | 53 -> 7 | 36,520 -> 1,329 | 7.6 -> 13.8 |
| `true size` | 37 -> 5 | 12,119 -> 377 | 8.5 -> 16.5 |
| `real size of countries` | 26 -> 5 | 18,400 -> 2,571 | 7.5 -> 9.0 |
| `real size map` | 25 -> 4 | 16,539 -> 2,765 | 8.1 -> 9.7 |

这说明不是某个单一关键词掉了，而是整个 `true size / real size` 主题簇的曝光被压缩。

同时我用 `query-pages` 查了 `true size map` 和 `true size of countries`，前后都只有根页拿到曝光，没有发现站内 compare pages 抢词。因此，新增 compare pages 不是主要 cannibalization 原因。

## 四、我认为最可能的原因排序

### 1. 4-27 改版触发根页重新评估

`c5bc905` 一次性改变了很多高权重信号：

- `<title>` 从 `True Size of Countries — Mercator Map Playground` 改为 `True Size of Countries Map: Compare Real Country Sizes`
- H1 从 `The True Size of Countries (Mercator Map)` 改为 `True Size of Countries Map`
- header 文案、页面结构、SEO 内容块、结构化数据都被改写
- 预渲染输出从只补 head/meta 变成把 React HTML 也注入到页面

这种变更对一个原本在 7-9 名边缘的页面风险很高。Google 重新评估后，只要 position 从 8 降到 10-13，impressions 就会非常明显地下滑。

### 2. 初始 HTML 的核心体验信号弱

当前线上根页 HTML 中，核心互动地图区域是：

```html
<div class="map-frame"><div class="map-loading">Loading map...</div></div>
```

地图数据在客户端 `useEffect(fetch)` 后才加载，所以服务端预渲染阶段天然只能输出 loading 状态。Google 可以执行 JS，但初始 HTML 里最重要的主体区域是 loading，这对一个工具页不是好信号。

我不认为这单独解释全部下跌，因为 4-27 之前也不是完整 SSR；旧 prerender 主要只是补 head/meta，`#root` 仍为空。但改版后 Google 初始可见内容变成了“大量 UI + loading map + SEO 文案”，这可能改变了页面主题和质量判断。

### 3. 根页外链弱，抗波动能力差

URL Inspection 显示根页 referring URL 只有：

- `https://www.runcell.dev/tool`

sea-level 页面则有：

- `https://www.ruanyifeng.com/blog/2026/02/weekly-issue-386.html`
- sitemap

这解释了为什么 sea-level 能稳定在 position 6 左右，而根页在一次改版后更容易跌。

### 4. 标题/H1 改动值得优先回滚测试

标题不是唯一原因，但它是最小、最可控、最容易验证的变量。旧标题对应改版前的 position 约 8，新标题对应改版后的 position 约 12。不能说“标题一定错了”，但它是最应该先做受控恢复的点。

## 五、我对原报告的修正意见

### 1. “第一页到第二页导致曝光机械下降”方向对，但表述过简

query 级数据里，有些词确实从第一页掉到第二页，例如：

- `true size of`: 7.6 -> 13.8
- `true size`: 8.5 -> 16.5
- `the true size`: 8.3 -> 12.4

但也有一些核心词只是从第 7-8 名滑到第 9-10 名：

- `true size map`: 7.5 -> 9.3
- `true size of countries`: 7.1 -> 8.8

所以更准确的说法是：根页在泛词簇的整体排名/可见度被下调，部分 query 掉出第一页，部分 query 虽仍在第一页尾部但曝光也大幅减少。

### 2. “Googlebot 看到 Loading map”需要谨慎表达

当前初始 HTML 确实是 loading map，但 Googlebot 不等于只看初始 HTML。它会执行 JS，只是执行和渲染质量不完全等于用户浏览器。

因此我建议改成：

> 根页初始 HTML 中核心互动区是 `Loading map...`，这是一个明显质量弱点；它可能参与了 Google 的重新评估，但不能单独证明是唯一原因。

### 3. 6-24 的 `.html` 修复没有真正解决线上 `.html`

原报告说 6-24 修的是 Google 没发现的非问题，这在“恢复首页排名”层面基本对。但工程上还要补一句：线上 `.html` 和未知路径现在仍然返回 200。

实测：

| URL | HTTP | 实际内容 |
|---|---:|---|
| `/tool/true-size-map/sea-level-rise-simulator.html` | 200 | 根页克隆，canonical 指向根页 |
| `/tool/true-size-map/this-page-does-not-exist-xyz123` | 200 | 根页克隆，canonical 指向根页 |
| `/tool/true-size-map/` | 308 | redirect 到无斜杠 URL，正常 |

这说明删除生成的 `.html` 文件后，请求又被 Vercel catch-all 兜回了 `index.html`。所以 `.html` 虽不是本次主因，但 soft-404/catch-all 仍需要修。

## 六、我建议的行动顺序

### P0：先做恢复根页的最小改动

1. 把 root title 回到接近旧版本：
   - 建议：`True Size of Countries - Mercator Map Playground`
   - 或：`True Size of Countries: Mercator Map Playground`

2. 把 root H1 回到接近旧版本：
   - 建议：`The True Size of Countries (Mercator Map)`

3. root description 不要过度泛化，保留 `Mercator`、`latitude`、`true scale` 这类旧信号：
   - 旧描述：`Drag countries on a Mercator world map to see how latitude changes their true scale in real time.`

这一步目标不是证明标题一定是根因，而是先恢复 Google 曾经认可过的核心页面信号。

### P1：增强根页初始 HTML 的主体内容

把核心地图区域的 SSR/SSG fallback 从纯 `Loading map...` 改成更有信息量的静态内容，例如：

- 静态地图截图或简化 SVG world map
- 默认国家示例：Greenland、Brazil、India、United States、Russia、Canada
- 初始 HTML 中直接出现关键实体、面积和 Mercator scale 解释

目标是让未执行 JS 的 HTML 也像一个完整工具页，而不是加载态。

### P1：加强根页内链

从以下页面明确指回根页：

- `/tool`
- sea-level 页面
- compare pages
- globe/equator 页面

anchor text 尽量使用：

- `true size of countries map`
- `true size map`
- `real size of countries`

### P2：修 soft-404 和 `.html`

未知路径不要返回根页 200。至少做到：

- 不存在路径返回 404
- `.html` 旧路径 301 到 clean URL，或者 404
- 404 页面加 `noindex`

这不是恢复根页排名的第一优先级，但应该尽快处理，避免未来被外链或爬虫发现后扩大问题。

### P2：争取外链或主站强链接

根页现在外链弱。可以从主站、博客、YouTube description、GitHub README、产品目录页加强指向根页。sea-level 的表现说明外链对这类工具页很关键。

## 七、我建议后续如何达成共识

我建议把共识拆成三层：

1. 确认事实：
   - 4/29 下跌真实存在
   - 根页 indexed，非去索引
   - 下跌集中在根页和 `true size / real size` query 簇
   - `.html` 和随机 URL 当前 unknown to Google，不是本次主因
   - 线上 unknown URL 仍返回 200，是独立隐患

2. 高概率判断：
   - `c5bc905` 是触发因素
   - 页面重写导致 Google 对根页重新评估
   - 旧排名余量薄、外链弱，导致重评估后容易掉出可见区

3. 待验证假设：
   - title/H1 回退能否恢复
   - SSR fallback 改善能否恢复
   - 内链/外链增强能否把 position 推回 7-9

我的建议是先不要继续争论单一根因，而是做一个低风险恢复 PR：回退 root title/H1/description 到旧信号，增强初始 HTML，修 404。然后在 GSC 用固定 query 集监控 2-4 周。

## 八、最终一句话

这次下降最可能不是“技术索引事故”，而是“根页改版后被 Google 重新评估，泛词簇排名整体被压低”。恢复方向应优先回到旧的核心语义信号，并让根页初始 HTML 更像一个完整的 true-size-map 工具页，而不是继续把 `.html` 重复 URL 当作主因。
