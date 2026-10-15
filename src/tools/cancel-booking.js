import { z } from "zod";
import { hbRequest } from "../client.js";
import { ok, fail } from "../util.js";

export const cancelBookingSchema = {
  reference: z.string().describe("Booking reference to cancel."),
  confirm: z
    .boolean()
    .describe("Must be true to actually cancel — a guard against accidental cancellation."),
};

export async function cancelBooking(args) {
  if (args.confirm !== true) {
    return fail(
      "Refusing to cancel without confirm=true. Call get_cancellation_quote first to see the charge, then call again with confirm=true."
    );
  }
  try {
    const data = await hbRequest(
      "DELETE",
      `/bookings/${encodeURIComponent(args.reference)}?cancellationFlag=CANCELLATION`
    );
    const b = data.booking || {};
    return ok({
      status: b.status, // CANCELLED
      reference: b.reference,
      cancellationReference: b.cancellationReference,
      cancellationCharge: b.totalNet,
      currency: b.currency,
    });
  } catch (e) {
    return fail(e.message, { httpStatus: e.httpStatus, apiCode: e.apiCode });
  }
}
