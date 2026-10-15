# hotelbeds-mcp-server

An [MCP](https://modelcontextprotocol.io) server that wraps the **Hotelbeds (HBX Group)
Hotel Booking and Content APIs**, exposing nine tools for searching, booking, managing and
enriching hotel reservations from any MCP client. Built as the hotel counterpart to
[`duffel-mcp-server`](https://github.com/karanrao/duffel-mcp-server).

> A thought-through proof of concept — validated end to end against the Hotelbeds sandbox,
> but not production-ready.

## Status

- Nine tools, validated end to end through the MCP protocol against the Hotelbeds **test**
  environment (`api.test.hotelbeds.com`).
- Flights-only sibling lives in `duffel-mcp-server`; this one is hotels-only.
- stdio transport, designed to run locally alongside an MCP client such as Claude Desktop.

## Tools

### Booking lifecycle

| Tool | Hotelbeds call | Purpose |
|------|----------------|---------|
| `search_hotels` | `POST /hotel-api/1.0/hotels` | Availability by destination or hotel codes. Returns `rateKey`s. |
| `check_rate` | `POST /hotel-api/1.0/checkrates` | Re-validate a `rateKey` for its authoritative price. Required when `rateType` is `RECHECK`. |
| `create_booking` | `POST /hotel-api/1.0/bookings` | Book a rate — **surface-and-reconfirm** (see below). |
| `get_booking` | `GET /hotel-api/1.0/bookings/{ref}` | Retrieve a booking and its status. |
| `get_cancellation_quote` | `DELETE …?cancellationFlag=SIMULATION` | Cancellation charge **without** cancelling. |
| `cancel_booking` | `DELETE …?cancellationFlag=CANCELLATION` | Permanently cancel. Requires `confirm=true`. |

### Content

| Tool | Hotelbeds call | Purpose |
|------|----------------|---------|
| `list_destinations` | `GET /hotel-content-api/1.0/locations/destinations` | Resolve destination codes for a country (feed as `destinationCode` to `search_hotels`). |
| `list_hotels_content` | `GET /hotel-content-api/1.0/hotels` | Browse a destination's static portfolio — names, categories, coordinates, addresses. |
| `get_hotel_details` | `GET /hotel-content-api/1.0/hotels/{codes}/details` | Full content for chosen hotels: description, images, facilities, address, phones, boards. |

The Content API shares the **same keypair and signature** as the Booking API — it just lives
at the `/hotel-content-api/1.0/` base path (`hbContentGet` in `src/client.js`). Image `path`
values are relative GIATA paths; the server prefixes them with
`https://photos.hotelbeds.com/giata/bigger/` to produce usable URLs.

## The two canonical flows

**Book:** `search_hotels` → `check_rate` (only when a rate's `rateType` is `RECHECK`) →
`create_booking` → `get_booking`.

`create_booking` is a deliberate two-step, because the Hotelbeds sandbox injects price drift
between checkrate and booking:

1. Call it **without** `acceptedNet`. It re-validates the rate and returns
   `status: "CONFIRMATION_REQUIRED"` with `currentNet` — **no booking is made**.
2. Call again **with** `acceptedNet` set to that `currentNet`. If the live price is still
   within `tolerance` (default 2%), it books and returns `CONFIRMED`; if the price rose beyond
   tolerance, it re-surfaces instead of booking. A price *drop* never blocks.

**Cancel:** `get_cancellation_quote` (SIMULATION — returns the charge, booking stays live) →
`cancel_booking` (CANCELLATION, `confirm: true`). The same quote-then-commit safety as the
booking step.

## Quick start

```bash
npm install
cp .env.example .env     # then fill in your Hotel API keypair
npm run smoke            # walks the full loop against the sandbox
```

## Connecting to Claude Desktop

Add to `claude_desktop_config.json` (standard build:
`%APPDATA%\Claude\` on Windows, `~/Library/Application Support/Claude/` on macOS; the Windows
Store/MSIX build lives under `%LOCALAPPDATA%\Packages\Claude_pzs8sxrjxfjjc\LocalCache\Roaming\Claude\`).
On Windows, note the doubled backslashes.

```json
{
  "mcpServers": {
    "hotelbeds": {
      "command": "node",
      "args": ["/absolute/path/to/hotelbeds-mcp-server/src/index.js"],
      "env": {
        "HOTELBEDS_API_KEY": "your_hotel_api_key",
        "HOTELBEDS_SECRET": "your_hotel_api_secret"
      }
    }
  }
}
```

Behind a TLS-inspecting corporate proxy (e.g. Zscaler), Node will reject the HTTPS calls with
`UNABLE_TO_GET_ISSUER_CERT_LOCALLY`. Add `"NODE_EXTRA_CA_CERTS": "/path/to/corp-root-ca.cer"`
to the `env` block to trust the corporate root CA. Then restart Claude Desktop fully.

## Testing a tool in isolation

`npm run smoke` spawns the server over stdio and exercises all nine tools. To hit one handler
directly without the protocol:

```bash
node --input-type=module -e "
import { searchHotels } from './src/tools/search-hotels.js';
const r = await searchHotels({ checkIn:'2026-09-15', checkOut:'2026-09-17', destinationCode:'PMI', adults:2, limit:3 });
console.log(r.content[0].text);
"
```

(Requires `HOTELBEDS_API_KEY` / `HOTELBEDS_SECRET` in the environment.)

## Credentials

Register at the [Hotelbeds APItude developer portal](https://developer.hotelbeds.com) and
request the **Hotel** API test keypair. The one keypair authenticates both the Booking and
Content APIs. Auth is `Api-key` + `X-Signature`, where the signature is
`SHA256(apiKey + secret + unixTimestampSeconds)` in hex, recomputed per request (handled in
`src/client.js`). Set `HOTELBEDS_BASE_URL` to `https://api.hotelbeds.com` for live; it defaults
to the test endpoint.

## Project structure

```
src/
  index.js            MCP server — registers the nine tools
  client.js           signed request helpers (hbRequest for booking, hbContentGet for content)
  util.js             tool-result formatting
  tools/
    search-hotels.js        check-rate.js           create-booking.js
    get-booking.js          get-cancellation-quote.js  cancel-booking.js
    list-destinations.js    list-hotels-content.js  get-hotel-details.js
test/
  smoke.mjs           end-to-end stdio smoke test
docs/
  content-api.md      Content API field/shape notes
```

## Known limitations

- **Single-room bookings.** `create_booking` handles one room per booking; multi-room would
  extend the `paxes`/`roomId` mapping across several `rateKey`s.
- **Flights-only scope elsewhere.** Transfers and Activities are not included (Hotelbeds has
  sunset its Activities API; Transfers would need its own keypair).
- **`facilities` is noisy.** Hotelbeds returns real amenities alongside structural metadata
  (e.g. "Number of floors") in the same array; the server passes them through unfiltered.
- **stdio only.** To host remotely, convert to Streamable HTTP and add Bearer-token auth — an
  open endpoint would let anyone create or cancel real bookings on your account.

## Licence

MIT © 2026 Karan Rao
