// End-to-end smoke test: spawns the server over stdio and walks the full loop.
// Requires HOTELBEDS_API_KEY and HOTELBEDS_SECRET in the environment.
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const transport = new StdioClientTransport({
  command: "node",
  args: ["src/index.js"],
  env: process.env,
});
const client = new Client({ name: "smoke", version: "1.0.0" });
await client.connect(transport);

const parse = (res) => {
  const text = res.content?.[0]?.text ?? "";
  try { return JSON.parse(text); } catch { return text; }
};
async function call(name, args) {
  const res = await client.callTool({ name, arguments: args });
  const data = parse(res);
  console.log(`\n### ${name} ${res.isError ? "(ERROR)" : ""}`);
  console.log(JSON.stringify(data, null, 2).slice(0, 1000));
  return data;
}

const { tools } = await client.listTools();
console.log("registered tools:", tools.map((t) => t.name).join(", "));

// --- Content API tools ---
await call("list_destinations", { countryCode: "ES", nameContains: "palma", limit: 5 });
await call("list_hotels_content", { destinationCode: "PMI", limit: 3 });
await call("get_hotel_details", { hotelCodes: 698, maxImages: 3 });

const guests = [
  { type: "AD", name: "Karan", surname: "Tester" },
  { type: "AD", name: "Guest", surname: "Two" },
];

const search = await call("search_hotels", {
  checkIn: "2026-09-15", checkOut: "2026-09-17",
  destinationCode: "PMI", adults: 2, limit: 3, maxRatesPerHotel: 1,
});
const rateKey = search.hotels[0].rates[0].rateKey;

await call("check_rate", { rateKeys: [rateKey] });

// 1st create_booking call: no acceptedNet -> should SURFACE the price, not book.
const quote = await call("create_booking", {
  rateKey, holderName: "Karan", holderSurname: "Tester", paxes: guests,
});

// 2nd call: acceptedNet set -> commits (tolerance 10 to absorb sandbox jitter).
const booked = await call("create_booking", {
  rateKey, holderName: "Karan", holderSurname: "Tester", paxes: guests,
  acceptedNet: quote.currentNet, tolerance: 10,
});
const reference = booked.reference;

await call("get_booking", { reference });
await call("get_cancellation_quote", { reference });
await call("get_booking", { reference }); // prove still CONFIRMED after the quote
await call("cancel_booking", { reference, confirm: true });
await call("get_booking", { reference }); // prove CANCELLED

await client.close();
process.exit(0);
