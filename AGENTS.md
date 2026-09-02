# Instructions for agents working on world-map-reality

## SEO release safety

- Before planning or publishing SEO changes, read the current release policy at the beginning of [SEO_WORKLOG.md](SEO_WORKLOG.md). It is mandatory and applies in addition to existing page and experiment restrictions.
- Check live Google official update status and relevant policy announcements when planning, immediately before production deployment, and during experiment monitoring. Do not treat remembered guidance or an earlier check as current evidence.
- Do not publish major or high-risk SEO changes during a Google update or relevant policy/enforcement window. Keep the release blocked if official status cannot be verified or the required post-update baseline is not yet stable. Local implementation and verification may continue.
- Judge risk by traffic and scope, not changed line count. A title/H1 experiment on the established `/tool/true-size-map` root page is high risk even when it changes only one configuration field. Inspect every output that consumes shared SEO metadata.
- Record the check time and timezone, official sources, rollout/enforcement dates and status, affected pages/signals, latest finalized GSC date, baseline, and release/hold decision in the worklog or PR.
- If Google announces an update after deployment, stop further SEO changes and rollout expansion, record the overlap, and do not claim the experiment isolates the site change. Assess recovery actions separately.
- Use the GSC skill at `/Users/observedobserver/Documents/GitHub/ob12er-agent-skills/skills/gsc/SKILL.md` for live traffic and indexing analysis of `sc-domain:runcell.dev`. Do not count unavailable or incomplete days as zero in daily averages.
- Historical causal claims and the title-fingerprint model in the worklog are hypotheses, not established Google mechanisms. Stable sibling pages do not exclude Google-side effects on the root page.
