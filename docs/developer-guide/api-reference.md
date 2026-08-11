# API Reference

The indexer serves a small, read-only REST API over the read models it folds
from on-chain events. Every response on this page is a real capture from the
live testnet indexer at:

```
https://charter-indexer.onrender.com
```

Every endpoint is `GET`, needs no authentication, and returns JSON. Amounts are
decimal **strings** in the token's smallest unit, never numbers — the reference
token has 7 decimals, so `"314159265"` means `31.4159265` tokens. Format them
with a bigint-safe helper; never parse them to a float.

> The live indexer runs on a free tier that spins down when idle. The first
> request after a quiet period can return `503` with a `Retry-After` header
> while it cold-starts; retry after a few seconds and it comes up.

## CORS

The API sets `Access-Control-Allow-Origin: *`, allows methods `GET, OPTIONS`,
and allows the `Content-Type` header. A preflight `OPTIONS` request returns
`204`. A browser app on any origin can read it directly.

## `GET /health`

Liveness plus database reachability.

```json
{"status":"ok"}
```

## `GET /orgs`

Every indexed organization, newest first. The list is wrapped in an `orgs` key.

```json
{
  "orgs": [
    {
      "id": 1,
      "name": "TestToken Org",
      "treasuryAddress": "CBJQ6CZ3A6VRA3UJXRI3S6WXK3T5UH6EMHCA7TBGEPKFB6O2RMBJPI3P",
      "adminAddress": "GDDWFYWXCSBI6RNS5TV2ZZSBYY35MDKHR2424O7RVL6LDC4DUTBTVR2Z",
      "createdLedger": 4064653
    },
    {
      "id": 0,
      "name": "Charter Test Org 2",
      "treasuryAddress": "CA5Y353OYIQLTVSQV77CJ5NEBL2UUAP3GE3NPYZOG2WCJZH2BRJ6BK2D",
      "adminAddress": "GDN3D7XLV54KQ2QML6H3ZQ2OLUFQP7LAMDZWV7TXCHPK73GLHWZ7HDUK",
      "createdLedger": 4063779
    }
  ]
}
```

## `GET /orgs/{treasury}`

One organization by its treasury address. Unlike the list endpoints, this
returns the object **bare** — no wrapper key.

```
GET /orgs/CBJQ6CZ3A6VRA3UJXRI3S6WXK3T5UH6EMHCA7TBGEPKFB6O2RMBJPI3P
```

```json
{
  "id": 1,
  "name": "TestToken Org",
  "treasuryAddress": "CBJQ6CZ3A6VRA3UJXRI3S6WXK3T5UH6EMHCA7TBGEPKFB6O2RMBJPI3P",
  "adminAddress": "GDDWFYWXCSBI6RNS5TV2ZZSBYY35MDKHR2424O7RVL6LDC4DUTBTVR2Z",
  "createdLedger": 4064653
}
```

A treasury address that is not indexed returns `404`.

## `GET /orgs/{treasury}/categories`

That treasury's budget categories, in category-id order, wrapped in a
`categories` key.

```json
{
  "categories": [
    {
      "categoryId": 1,
      "name": "Payroll",
      "cap": "900000000",
      "spent": "314159265",
      "active": true
    }
  ]
}
```

`cap` and `spent` are decimal strings. Here the Payroll category has a cap of
`900000000` (90 tokens) and has spent `314159265` (31.4159265 tokens), leaving
`585840735` (58.5840735 tokens) of room.

## `GET /orgs/{treasury}/requests`

That treasury's disbursement requests, newest first, wrapped in a `requests`
key. An optional `?status=` filter narrows the list.

```json
{
  "requests": [
    {
      "requestId": 1,
      "categoryId": 1,
      "recipient": "GBBASI3ODOGYXGCMGBUNFYHY6E5LRVEW3PT5PPALIJEI63UOSBWK7QS5",
      "amount": "314159265",
      "memo": "",
      "requester": "",
      "status": "Executed",
      "createdLedger": 4064715,
      "approvals": ["GBBASI3ODOGYXGCMGBUNFYHY6E5LRVEW3PT5PPALIJEI63UOSBWK7QS5"]
    }
  ]
}
```

### The `status` filter is case-sensitive

It accepts exactly `Pending`, `Executed`, `Rejected`, or `Cancelled` —
capitalized. A lowercase value like `?status=executed` is rejected:

```
GET /orgs/{treasury}/requests?status=executed
→ 400
{"error":"invalid status filter"}
```

## `GET /orgs/{treasury}/requests/{id}`

One request by its id, returned **bare** (no wrapper key).

```
GET /orgs/CBJQ6CZ3A6VRA3UJXRI3S6WXK3T5UH6EMHCA7TBGEPKFB6O2RMBJPI3P/requests/1
```

```json
{
  "requestId": 1,
  "categoryId": 1,
  "recipient": "GBBASI3ODOGYXGCMGBUNFYHY6E5LRVEW3PT5PPALIJEI63UOSBWK7QS5",
  "amount": "314159265",
  "memo": "",
  "requester": "",
  "status": "Executed",
  "createdLedger": 4064715,
  "approvals": ["GBBASI3ODOGYXGCMGBUNFYHY6E5LRVEW3PT5PPALIJEI63UOSBWK7QS5"]
}
```

A request id that does not exist returns `404`.

## Two things this real response tells you

The captured request above is genuine testnet data, and it shows two properties
of the read model you need to account for when you build against this API. Both
come from the same cause: the indexer reconstructs requests from the events the
contract emits, and those events do not carry every field.

**1. An executed request shows one fewer approval than the number who signed.**
This request executed, yet `approvals` lists a single address. The approval that
meets the threshold executes the request in the same step, and the contract
emits a `RequestExecuted` event for it rather than a `RequestApproved` event.
The indexer builds `approvals` from `RequestApproved` events only, so the final,
decisive approval is not counted. Read an executed request as: the listed
approver(s), plus whoever's approval triggered execution.

**2. `requester` and `memo` can be empty even when they were set on-chain.** In
this capture both are `""`. The `RequestSubmitted` event carries only
`category_id`, `recipient`, and `amount` as data — not the requester address or
the memo. The indexer has no event field to populate those two from, so they
come back empty. If you need the requester or memo authoritatively, read the
request straight from the contract with `treasury.getRequest` (see the [SDK
Reference](sdk-reference.md)), whose `Request` type carries both.

Neither of these is a bug in the API — they are consequences of building a read
model from an event stream. They are documented here so you design around them
rather than trusting a field the event never carried.
