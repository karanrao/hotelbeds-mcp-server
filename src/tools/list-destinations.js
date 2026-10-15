import { z } from "zod";
import { hbContentGet } from "../client.js";
import { ok, fail } from "../util.js";

const text = (v) => (v && typeof v === "object" ? v.content : v);

export const listDestinationsSchema = {
  countryCode: z
    .string()
    .describe("ISO country code to list destinations for, e.g. 'ES', 'GB'."),
  nameContains: z
    .string()
    .optional()
    .describe("Optional case-insensitive filter on the destination name."),
  limit: z.number().int().min(1).max(200).default(50).describe("Max destinations to return."),
};

export async function listDestinations(args) {
  const { countryCode, nameContains, limit } = args;
  try {
    // from/to paging is mandatory; the API has no name filter, so we filter client-side.
    const data = await hbContentGet("/locations/destinations", {
      countryCodes: countryCode,
      language: "ENG",
      fields: "all",
      from: 1,
      to: 1000,
    });
    let dests = (data.destinations || []).map((d) => ({
      code: d.code,
      name: text(d.name),
      countryCode: d.countryCode,
      zones: (d.zones || []).length,
    }));
    if (nameContains) {
      const q = nameContains.toLowerCase();
      dests = dests.filter((d) => (d.name || "").toLowerCase().includes(q));
    }
    return ok({
      total: data.total,
      returned: Math.min(dests.length, limit),
      note: "Use a destination code as destinationCode in search_hotels.",
      destinations: dests.slice(0, limit),
    });
  } catch (e) {
    return fail(e.message, { httpStatus: e.httpStatus, apiCode: e.apiCode });
  }
}
