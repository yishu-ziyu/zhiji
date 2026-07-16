# MVP-V0 / D-50 Owner authorize entry vs fixture source

## Owner authorize entry (dialog only)

```text
/tmp/mvp-v0-g6-d50-fixture
```

Must be a **symlink**. Exact resolve:

```text
/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.ship/fixtures/mvp-v0-g6-owner-project
```

## Forbidden

- Typing the repo path directly into authorize dialog
- Other local project folders as "the" MVP fixture

## Preflight

```bash
test "$(readlink /tmp/mvp-v0-g6-d50-fixture)" = "/Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.ship/fixtures/mvp-v0-g6-owner-project"
test -d /Users/mahaoxuan/Desktop/黑客松/fc-opc-ibot/.ship/fixtures/mvp-v0-g6-owner-project
```

Packet: `EL1-D51-D52-engineering-packet.md` §0.
