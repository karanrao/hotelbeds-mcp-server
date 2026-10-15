import { z } from "zod";
import { hbRequest } from "../client.js";
import { ok, fail } from "../util.js";

export const searchHotelsSchema = {
  checkIn: z.string().describe("Check-in date, YYYY-MM-DD."),
  checkOut: z.string().describe("Check-out date, YYYY-MM-DD."),
  adults: z.number().int().min(1).default(2).describe("Adults per room."),
  children: z.number().int().min(0).default(0).describe("Children per room."),
  childrenAges: z
    .array(z.number().int())
    .optional()
    .describe("Age of each child; required when children > 0."),
  rooms: z.number().int().min(1).default(1).describe("Number of rooms."),
  destinationCode: z
    .string()
    .optional()
    .describe("Hotelbeds destination code, e.g. 'PMI'. Provide this OR hotelCodes."),
  hotelCodes: z
    .array(z.number().int())
    .optional()
    .describe("Specific Hotelbeds hotel codes. Provide this OR destinationCode."),
  limit: z.number().int().min(1).max(50).default(15).describe("Max hotels to return."),
  maxRatesPerHotel: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(3)
    .describe("Max (cheapest) rates to return per hotel."),
};

export async function searchHotels(args) {
  const {
    checkIn, checkOut, adults, children, childrenAges,
    rooms, destinationCode, hotelCodes, limit, maxRatesPerHotel,
  } = args;

  if (!destinationCode && (!hotelCodes || hotelCodes.length === 0)) {
    return fail("Provide either destinationCode or hotelCodes.");
  }

  const occupancy = { rooms, adults, children };
  if (children > 0) {
    if (!childrenAges || childrenAges.length !== children) {
      return fail("childrenAges must give an age for each child when children > 0.");
    }
    occupancy.paxes = childrenAges.map((age) => ({ type: "CH", age }));
  }

  const reqBody = {
    stay: { checkIn, checkOut },
    occupancies: [occupancy],
    filter: { maxRatesPerRoom: maxRatesPerHotel },
  };
  if (destinationCode) reqBody.destination = { code: destinationCode };
  if (hotelCodes && hotelCodes.length) reqBody.hotels = { hotel: hotelCodes };

  try {
    const data = await hbRequest("POST", "/hotels", reqBody);
    const h = data.hotels || {};
    const hotels = (h.hotels || []).slice(0, limit).map((hotel) => ({
      code: hotel.code,
      name: hotel.name,
      category: hotel.categoryName,
      zone: hotel.zoneName,
      destination: hotel.destinationName,
      currency: hotel.currency,
      minRate: hotel.minRate,
      maxRate: hotel.maxRate,
      rates: []
        .concat(
          ...(hotel.rooms || []).map((room) =>
            (room.rates || []).map((rate) => ({
              roomName: room.name,
              roomCode: room.code,
              board: rate.boardName,
              rateType: rate.rateType, // BOOKABLE (bookable now) or RECHECK (must check_rate first)
              net: rate.net,
              occupancy: `${rate.adults || 0}AD/${rate.children || 0}CH x${rate.rooms || 1}`,
              cancellationPolicies: rate.cancellationPolicies || [],
              rateKey: rate.rateKey,
            }))
          )
        )
        .sort((a, b) => parseFloat(a.net) - parseFloat(b.net))
        .slice(0, maxRatesPerHotel),
    }));

    return ok({
      checkIn: h.checkIn,
      checkOut: h.checkOut,
      totalHotels: h.total,
      returned: hotels.length,
      note:
        "Pick a rateKey. If its rateType is RECHECK, call check_rate before booking. " +
        "Pass the rateKey to create_booking to book.",
      hotels,
    });
  } catch (e) {
    return fail(e.message, { httpStatus: e.httpStatus, apiCode: e.apiCode });
  }
}
