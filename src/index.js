#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { searchHotels, searchHotelsSchema } from "./tools/search-hotels.js";
import { checkRate, checkRateSchema } from "./tools/check-rate.js";
import { createBooking, createBookingSchema } from "./tools/create-booking.js";
import { getBooking, getBookingSchema } from "./tools/get-booking.js";
import {
  getCancellationQuote,
  getCancellationQuoteSchema,
} from "./tools/get-cancellation-quote.js";
import { cancelBooking, cancelBookingSchema } from "./tools/cancel-booking.js";

// Content API tools
import { listDestinations, listDestinationsSchema } from "./tools/list-destinations.js";
import { listHotelsContent, listHotelsContentSchema } from "./tools/list-hotels-content.js";
import { getHotelDetails, getHotelDetailsSchema } from "./tools/get-hotel-details.js";

const server = new McpServer({ name: "hotelbeds", version: "1.0.0" });

server.registerTool(
  "search_hotels",
  {
    title: "Search hotels",
    description:
      "Search hotel availability by destination code or hotel codes for given dates and occupancy. Returns hotels with bookable rateKeys.",
    inputSchema: searchHotelsSchema,
  },
  searchHotels
);

server.registerTool(
  "check_rate",
  {
    title: "Check rate",
    description:
      "Re-validate one or more rateKeys and return the authoritative current price. Required before booking when a rate's rateType is RECHECK.",
    inputSchema: checkRateSchema,
  },
  checkRate
);

server.registerTool(
  "create_booking",
  {
    title: "Create booking",
    description:
      "Book a rate. Two-step surface-and-reconfirm: call once WITHOUT acceptedNet to surface the live price, then again WITH acceptedNet set to that price to commit. Re-surfaces if the price moves beyond tolerance.",
    inputSchema: createBookingSchema,
  },
  createBooking
);

server.registerTool(
  "get_booking",
  {
    title: "Get booking",
    description: "Retrieve a booking by reference, including its current status.",
    inputSchema: getBookingSchema,
  },
  getBooking
);

server.registerTool(
  "get_cancellation_quote",
  {
    title: "Get cancellation quote",
    description:
      "Return the cancellation charge for a booking WITHOUT cancelling it (simulation). The booking remains active.",
    inputSchema: getCancellationQuoteSchema,
  },
  getCancellationQuote
);

server.registerTool(
  "cancel_booking",
  {
    title: "Cancel booking",
    description:
      "Permanently cancel a booking. Requires confirm=true. Use get_cancellation_quote first to see the charge.",
    inputSchema: cancelBookingSchema,
  },
  cancelBooking
);

// ---- Content API ----

server.registerTool(
  "list_destinations",
  {
    title: "List destinations",
    description:
      "List Hotelbeds destination codes for a country (optionally filtered by name). Use the code as destinationCode in search_hotels.",
    inputSchema: listDestinationsSchema,
  },
  listDestinations
);

server.registerTool(
  "list_hotels_content",
  {
    title: "List hotels (content)",
    description:
      "Browse the static hotel portfolio for a destination or set of hotel codes — names, categories, coordinates, addresses.",
    inputSchema: listHotelsContentSchema,
  },
  listHotelsContent
);

server.registerTool(
  "get_hotel_details",
  {
    title: "Get hotel details",
    description:
      "Full static content for one or more hotels: description, images, facilities, address, coordinates, phones, boards.",
    inputSchema: getHotelDetailsSchema,
  },
  getHotelDetails
);

const transport = new StdioServerTransport();
await server.connect(transport);
// stdout is the MCP channel — log only to stderr.
console.error("hotelbeds MCP server running on stdio");
