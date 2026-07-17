# 知几 · Public Metrics

Open experiment data for the **Project Intelligence** offline bench.

Repository: [yishu-ziyu/zhiji](https://github.com/yishu-ziyu/zhiji)

## Why metrics

Without metrics there is no stable feedback loop. A model or prompt change is only an improvement if Primary metrics hold or rise — not if answers merely look prettier.

```text
goal → define metrics → measure → compare versions → adjust → re-measure
```

## Latest published run

- **Slug:** `2026-07-17-offline-v0-7a7e8274`
- **When:** 2026-07-17T16:39:39.736Z
- **Git:** `7a7e82740c6f328ca6be1b373f7c945f22f44152`
- **Bench:** 54/54
- **Report:** [runs/2026-07-17-offline-v0-7a7e8274/REPORT.md](./runs/2026-07-17-offline-v0-7a7e8274/REPORT.md)
- **Raw JSON:** [runs/2026-07-17-offline-v0-7a7e8274/snapshot.json](./runs/2026-07-17-offline-v0-7a7e8274/snapshot.json)
- **Log:** [EXPERIMENT_LOG.md](./EXPERIMENT_LOG.md)

### Primary (latest)

| Metric | Value | Gate |
|---|---:|---:|
| overall_pass_rate | 100.0% | ≥100% |
| structure_pass_rate | 100.0% | ≥100% |
| search_intent_pass_rate | 100.0% | ≥100% |
| honesty_pass_rate | 100.0% | ≥100% |
| noise_pass_rate | 100.0% | ≥100% |

## Reproduce

```bash
git clone https://github.com/yishu-ziyu/zhiji.git
cd zhiji
npm ci
npm run test:bench
npm run metrics:measure
npm run metrics:compare
# publish a new public run (writes docs/metrics/runs/*)
npm run metrics:publish
```

## Related

- Metric spec: [PROJECT_INTELLIGENCE_METRICS.md](../product/PROJECT_INTELLIGENCE_METRICS.md)
- Engineering playbook: [优化方案-工程开发范式.md](../product/优化方案-工程开发范式.md)
- Bench source: `tests/bench/project-intelligence/`
- Gate baseline (CI): `tests/bench/project-intelligence/baselines/offline-v0.json`

## License of data

Experiment JSON/Markdown in this folder is part of the repository and follows the same license as the project source.
