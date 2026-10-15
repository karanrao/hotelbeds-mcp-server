import { z } from "zod";
import { hbRequest } from "../client.js";
import { ok, fail } from "../util.js";

export const checkRateSchema = {
  rateKeys: z
    .array(z.string())
    .min(1)
    .describe("One or more rateKeys from search_hotels to re-validate."),
};

export async function checkRate(args) {
  try {
    const data = await hbRequest("POST", "/checkrates", {
      rooms: args.rateKeys.map((rateKey) => ({ rateKey })),
    });
    const hotel = data.hotel || {};
    const rates = [].concat(
      ...(hotel.rooms || []).map((room) =>
        (room.rates || []).map((rate) => ({
          roomName: room.name,
          board: rate.boardName,
          rateType: rate.rateType,
          net: rate.net,
          rateComments: rate.rateComments,
          cancellationPolicies: rate.cancellationPolicies || [],
          rateKey: rate.rateKey,
        }))
      )
    );
    return ok({
      hotelCode: hotel.code,
      hotelName: hotel.name,
      currency: hotel.currency,
      rates,
      note: "net is the authoritative current price. Pass this rateKey and net (as acceptedNet) to create_booking.",
    });
  } catch (e) {
    return fail(e.message, { httpStatus: e.httpStatus, apiCode: e.apiCode });
  }
}
