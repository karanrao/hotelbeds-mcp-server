import { z } from "zod";
import { hbRequest } from "../client.js";
import { ok, fail } from "../util.js";

export const getCancellationQuoteSchema = {
  reference: z.string().describe("Booking reference to quote a cancellation for."),
};

// IMPORTANT: Hotelbeds' SIMULATION mode returns status:"CANCELLED" and a cancellationReference,
// but the booking is NOT cancelled. We deliberately never surface that status as the outcome —
// this tool only reports the charge you WOULD incur. Use cancel_booking to actually cancel.
export async function getCancellationQuote(args) {
  try {
    const data = await hbRequest(
      "DELETE",
      `/bookings/${encodeURIComponent(args.reference)}?cancellationFlag=SIMULATION`
    );
    const b = data.booking || {};
    return ok({
      quote: true,
      bookingStillActive: true,
      reference: b.reference,
      cancellationCharge: b.totalNet, // what you'd be charged if you cancelled now
      currency: b.currency,
      cancellationPolicies: b.hotel?.rooms?.[0]?.rates?.[0]?.cancellationPolicies || [],
      message: "QUOTE ONLY — the booking is NOT cancelled. Call cancel_booking to actually cancel.",
    });
  } catch (e) {
    return fail(e.message, { httpStatus: e.httpStatus, apiCode: e.apiCode });
  }
}
