# Delivery API Contract

Demo-only contract for the bilateral commitment-slip flow. State is held in server memory; restart clears it. Multi-tenant auth and durable cloud persistence are not shipped.

## Provider surface

### `GET /api/efficiency/slips`

Returns `{ slips, metrics }`. `slips` never includes `clientToken`; the token is returned only once to the provider in a successful `send` response.

### `POST /api/efficiency/slips`

JSON actions:

| `action` | Required fields | Optional fields | Result |
|---|---|---|---|
| `create` | `slips[]`, each with `title` | `description`, `acceptanceCriteria`, `dueAt`, `priority`, `sourceExcerpt` | `201 { slips }` in `draft` |
| `update` | `id` | editable slip fields | `200 { slip }`; omitted fields are preserved |
| `send` | `id` | editable slip fields | `200 { slip, clientUrl }`; issues token and moves to `pending_client_confirm` |
| `deliver` | `id` | none | `200 { slip }` in `provider_delivered` |

Unknown actions, invalid transitions, and malformed input return `400 { error }`. Provider actions cannot set client-owned states.

## Client token surface

### `GET /api/efficiency/client/[token]`

Returns `200 { slip }` without `clientToken`, or `404 { error }` for an invalid token.

### `POST /api/efficiency/client/[token]/action`

Body: `{ action, note? }`.

| `action` | Allowed from | Note |
|---|---|---|
| `confirm` | `pending_client_confirm` | optional |
| `request_changes` | `pending_client_confirm` | required |
| `accept` | `provider_delivered` | optional |
| `reject` | `provider_delivered` | required |

Returns `200 { slip }`; invalid tokens return `404`, invalid actions/transitions return `400`.
