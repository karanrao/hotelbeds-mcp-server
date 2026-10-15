import { z } from "zod";
import { hbContentGet } from "../client.js";
import { ok, fail } from "../util.js";

// Hotelbeds serves image paths relative to its GIATA photo host; prefix to get usable URLs.
const PHOTO_BASE = "https://photos.hotelbeds.com/giata/bigger/";
const text = (v) => (v && typeof v === "object" ? v.content : v);

export const getHotelDetailsSchema = {
  hotelCodes: z
    .union([z.number().int(), z.array(z.number().int())])
    .describe("One hotel code, or several, to fetch full content for."),
  maxImages: z
    .number()
    .int()
    .min(0)
    .max(30)
    .default(6)
    .describe("Max image URLs to return per hotel."),
  language: z.string().default("ENG").describe("Content language code, e.g. 'ENG'."),
};

function shapeHotel(h, maxImages) {
  const images = (h.images || [])
    .slice()
    .sort((a, b) => (a.visualOrder ?? 999) - (b.visualOrder ?? 999))
    .slice(0, maxImages)
    .map((im) => PHOTO_BASE + im.path);
  const facilities = (h.facilities || []).map((f) => text(f.description)).filter(Boolean);
  return {
    code: h.code,
    name: text(h.name),
    categoryCode: h.categoryCode ?? h.category?.code,
    category: text(h.category?.description) || text(h.category),
    destinationCode: h.destinationCode,
    destination: text(h.destination?.name) || text(h.destination),
    zone: text(h.zone?.name) || text(h.zone),
    country: h.countryCode,
    address: [text(h.address), text(h.city), h.postalCode, h.countryCode].filter(Boolean).join(", "),
    coordinates: h.coordinates,
    phones: (h.phones || []).map((p) => ({ number: p.phoneNumber, type: p.phoneType })),
    web: h.web,
    email: h.email,
    description: text(h.description),
    boards: (h.boards || []).map((b) => text(b.description) || text(b)).filter(Boolean),
    rooms: (h.rooms || []).length,
    facilitiesCount: facilities.length,
    facilities: facilities.slice(0, 40),
    imagesTotal: (h.images || []).length,
    images,
  };
}

export async function getHotelDetails(args) {
  const codes = Array.isArray(args.hotelCodes) ? args.hotelCodes : [args.hotelCodes];
  const { maxImages, language } = args;
  try {
    const data = await hbContentGet(`/hotels/${codes.join(",")}/details`, { language });
    // The API returns { hotel } for a single code and { hotels: [...] } for several.
    const list = data.hotels || (data.hotel ? [data.hotel] : []);
    const hotels = list.map((h) => shapeHotel(h, maxImages));
    if (!hotels.length) return fail(`No content found for hotel code(s): ${codes.join(",")}.`);
    return ok({ returned: hotels.length, hotels });
  } catch (e) {
    return fail(e.message, { httpStatus: e.httpStatus, apiCode: e.apiCode });
  }
}
