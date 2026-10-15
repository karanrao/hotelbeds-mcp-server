import { z } from "zod";
import { hbContentGet } from "../client.js";
import { ok, fail } from "../util.js";

const text = (v) => (v && typeof v === "object" ? v.content : v);

export const listHotelsContentSchema = {
  destinationCode: z
    .string()
    .optional()
    .describe("Destination code, e.g. 'PMI'. Provide this OR hotelCodes."),
  hotelCodes: z
    .array(z.number().int())
    .optional()
    .describe("Specific hotel codes. Provide this OR destinationCode."),
  limit: z.number().int().min(1).max(100).default(25).describe("Max hotels to return (max 100)."),
};

export async function listHotelsContent(args) {
  const { destinationCode, hotelCodes, limit } = args;
  if (!destinationCode && (!hotelCodes || !hotelCodes.length)) {
    return fail("Provide destinationCode or hotelCodes.");
  }
  const params = {
    language: "ENG",
    fields: "name,categoryCode,destinationCode,zoneCode,coordinates,address,city,postalCode,countryCode",
    from: 1,
    to: limit,
  };
  if (destinationCode) params.destinationCode = destinationCode;
  if (hotelCodes && hotelCodes.length) params.codes = hotelCodes.join(",");

  try {
    const data = await hbContentGet("/hotels", params);
    const hotels = (data.hotels || []).map((h) => ({
      code: h.code,
      name: text(h.name),
      categoryCode: h.categoryCode,
      destinationCode: h.destinationCode,
      zoneCode: h.zoneCode,
      coordinates: h.coordinates,
      address: text(h.address),
      city: text(h.city),
      country: h.countryCode,
    }));
    return ok({
      total: data.total,
      returned: hotels.length,
      note: "Use get_hotel_details for full content, or pass a code to search_hotels via hotelCodes to price it.",
      hotels,
    });
  } catch (e) {
    return fail(e.message, { httpStatus: e.httpStatus, apiCode: e.apiCode });
  }
}
