# G5 · T-19 S2 redacted-hint privacy RED · DONE

- Assignment: `.ship/handoffs/ASSIGN-G5-T19-S2-redacted-hint-tests.md`
- Authority: D-27 + D-38 option A
- Mode: test-only · **no production edits**
- Base: `d715b64d`
- Branch: `g5/t19-s2-redacted-hint-red`
- Worktree: `/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot-g5-t19-s2-hint-red`
- Exclusive file: `tests/unit/project-scope-hint-api.test.ts` (**FROZEN** on RED)

## Result

Executable **RED** suite for all 7 privacy gates. **7 failed (7)** on base `d715b64d`.

## Verification

```text
cd /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot-g5-t19-s2-hint-red
npm run test:unit -- --run tests/unit/project-scope-hint-api.test.ts
# exit 1 · 7/7 FAIL
```

Log: `.ship/evidence/g5-t19-s2-redacted-hint-red-vitest.txt`

## Exact failures (RED)

| # | Gate | Failure |
|---|---|---|
| 1 | no grant → zero hints | missing `projects/[id]/redacted-hints` route |
| 2 | active grant → one generic redacted hint | missing `projects/[id]/source-grants` route |
| 3 | sensitive → zero | missing source-grants |
| 4 | expired/disabled/revoked → zero | missing source-grants |
| 5 | foreign host cannot inspect/control grant | missing source-grants |
| 6 | no global search; hint cannot open xref | missing source-grants / redacted-hints |
| 7 | object use needs separate T-19 pinned ref | missing source-grants (xref also absent on base) |

## Expected G3 surfaces (for GREEN)

- `POST/GET/PATCH .../projects/[id]/source-grants`
- `GET .../projects/[id]/redacted-hints`
- Keep T-19 `cross-project-references` for gate 7 object use

## Next

G2 integrates this frozen test commit; G3 implements; G5 **reruns unchanged** → report GREEN/remaining to `:82`+`:80`.

No production edits by G5.
