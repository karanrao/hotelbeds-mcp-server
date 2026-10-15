import { z } from "zod";
import { hbRequest } from "../client.js";
import { ok, fail } from "../util.js";

export const createBookingSchema = {
  rateKey: z.string().describe("rateKey to book (from search_hotels or check_rate)."),
  holderName: z.string().describe("Lead guest first name."),
  holderSurname: z.string().describe("Lead guest surname."),
  paxes: z
    .array(
      z.object({
        type: z.enum(["AD", "CH"]).default("AD").describe("AD = adult, CH = child."),
        name: z.string(),
        surname: z.string(),
        age: z.number().int().optional().describe("Required for CH."),
        roomId: z.number().int().default(1).describe("Which room (1-based) this guest occupies."),
      })
    )
    .min(1)
    .describe("All guests; must match the rate's occupancy."),
  acceptedNet: z
    .number()
    .optional()
    .describe(
      "The net price you have agreed to pay. OMIT on the first call to receive a price quote. " +
        "On the second call, set it to the currentNet the first call returned, to commit."
    ),
  tolerance: z
    .number()
    .min(0)
    .max(100)
    .default(2)
    .describe("Allowed % price increase before re-confirmation is required."),
  clientReference: z
    .string()
    .optional()
    .describe("Your own booking reference for reconciliation. Auto-generated if omitted (Hotelbeds requires one)."),
  remark: z.string().optional(),
};

// Surface-and-reconfirm: never books without an acceptedNet that matches the live price
// within tolerance. A price drop never blocks; only an increase beyond tolerance re-surfaces.
export async function createBooking(args) {
  const {
    rateKey, holderName, holderSurname, paxes,
    acceptedNet, tolerance, clientReference, remark,
  } = args;

  // Step A — re-validate the rate to get the authoritative price and a fresh bookable key.
  let checked;
  try {
    checked = await hbRequest("POST", "/checkrates", { rooms: [{ rateKey }] });
  } catch (e) {
    return fail(`Could not validate the rate before booking: ${e.message}`, {
      httpStatus: e.httpStatus,
      apiCode: e.apiCode,
    });
  }
  const hotel = checked.hotel || {};
  const rate = ((hotel.rooms || [])[0]?.rates || [])[0];
  if (!rate) return fail("Rate is no longer available.", { rateKey });

  const currentNet = parseFloat(rate.net);
  const currency = hotel.currency;
  const freshRateKey = rate.rateKey;
  const cancellationPolicies = rate.cancellationPolicies || [];

  const surface = (reason, message) =>
    ok({
      status: "CONFIRMATION_REQUIRED",
      reason,
      message,
      hotelName: hotel.name,
      currentNet,
      currency,
      cancellationPolicies,
      rateComments: rate.rateComments,
      rateKey: freshRateKey,
      next: "Call create_booking again with acceptedNet set to currentNet to commit.",
    });

  // Step B — the surface-and-reconfirm gate.
  if (acceptedNet == null) {
    return surface("price_surfaced", "Confirm this price before booking. The booking has NOT been made.");
  }
  const increase = currentNet - acceptedNet;
  const allowed = (tolerance / 100) * acceptedNet;
  if (increase > allowed) {
    return surface(
      "price_changed",
      `Price rose from ${acceptedNet} to ${currentNet} ${currency}, beyond the ${tolerance}% tolerance. The booking has NOT been made.`
    );
  }

  // Step C — commit immediately with the fresh key. tolerance is passed as an API-side backstop.
  const bookingBody = {
    holder: { name: holderName, surname: holderSurname },
    rooms: [
      {
        rateKey: freshRateKey,
        paxes: paxes.map((p) => ({
          roomId: p.roomId ?? 1,
          type: p.type,
          name: p.name,
          surname: p.surname,
          ...(p.age != null ? { age: p.age } : {}),
        })),
      },
    ],
    tolerance,
    // clientReference is mandatory for Hotelbeds bookings — auto-generate if not supplied.
    clientReference: clientReference || `mcp-${Date.now()}`,
    ...(remark ? { remark } : {}),
  };

  try {
    const data = await hbRequest("POST", "/bookings", bookingBody);
    const b = data.booking || {};
    return ok({
      status: b.status, // CONFIRMED
      reference: b.reference,
      hotelName: b.hotel?.name,
      checkIn: b.hotel?.checkIn,
      checkOut: b.hotel?.checkOut,
      totalNet: b.totalNet,
      currency: b.currency,
      holder: `${b.holder?.name} ${b.holder?.surname}`,
      clientReference: b.clientReference,
    });
  } catch (e) {
    // Even past the local gate, the API can reject on last-moment price drift.
    if (e.apiCode === "PRODUCT_ERROR" && /toleran|price/i.test(e.message)) {
      return fail(
        `Booking rejected at final price check: ${e.message}. Re-run create_booking without acceptedNet to re-quote.`,
        { httpStatus: e.httpStatus, apiCode: e.apiCode }
      );
    }
    return fail(e.message, { httpStatus: e.httpStatus, apiCode: e.apiCode });
  }
}
