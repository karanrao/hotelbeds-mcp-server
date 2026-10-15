# Content API notes

The Content API (`/hotel-content-api/1.0/`) uses the same keypair and SHA256 signature as the
Booking API. A few shape details worth knowing when working with the content tools.

## Authentication & paging

- Same `Api-key` + `X-Signature` headers as the Booking API (`hbContentGet` in `src/client.js`).
- List endpoints (`/hotels`, `/locations/destinations`) require `from`/`to` paging (1-based,
  max 1000 per call). There is **no server-side name filter** — `list_destinations` pages the
  country's destinations and filters by name client-side.

## Localised text

Many fields are wrapped as `{ "content": "..." }` objects (e.g. `name`, `description`,
`address`, `city`, facility `description`). The tools unwrap these via a small `text()` helper.

## Category code nesting differs by endpoint

- The portfolio listing (`/hotels`) returns a flat `categoryCode`.
- The details endpoint (`/hotels/{codes}/details`) nests it as `category.code` with
  `category.description.content`.

`get_hotel_details` reads `h.categoryCode ?? h.category?.code` to handle both.

## Images

Image entries carry a relative GIATA `path` (e.g. `00/000698/000698a_hb_ro_118.jpg`). Prefix
with a size segment to get a usable URL:

```
https://photos.hotelbeds.com/giata/bigger/<path>
```

Other sizes include `original`, `xl`, `xxl`, `standard`, `small`. The server uses `bigger`.

## Facilities

The `facilities` array mixes guest-facing amenities with structural metadata (e.g. "Number of
floors", "Year of most recent renovation"). The server passes descriptions through unfiltered;
consumers that want only amenities should filter by `facilityGroupCode`.
