import { z } from "zod";
import { hbRequest } from "../client.js";
import { ok, fail } from "../util.js";

export const getBookingSchema = {
  reference: z.string().describe("Hotelbeds booking reference, e.g. '1-8278844'."),
};

export async function getBooking(args) {
  try {
    const data = await hbRequest(
      "GET",
      `/bookings/${encodeURIComponent(args.reference)}`
    );
    const b = data.booking || {};
    return ok({
      reference: b.reference,
      status: b.status, // status is returned directly — no payment_status derivation needed
      hotelName: b.hotel?.name,
      checkIn: b.hotel?.checkIn,
      checkOut: b.hotel?.checkOut,
      holder: `${b.holder?.name} ${b.holder?.surname}`,
      totalNet: b.totalNet,
      currency: b.currency,
      clientReference: b.clientReference,
      cancellationReference: b.cancellationReference,
    });
  } catch (e) {
    return fail(e.message, { httpStatus: e.httpStatus, apiCode: e.apiCode });
  }
}
