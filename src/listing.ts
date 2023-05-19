import Nip28Channel from "./channel";
import { NostrEvent } from "./ident";

interface ArcadeListingInput {
  type: "v1";
  action: "buy" | "sell";
  item: string;
  content?: string
  price: number;
  currency?: string;
  amt: number;
  min_amt?: number;
  payments: string[];
  expiration: string;
  geohash?: string;
}

interface ArcadeListing {
  type: "v1";
  action: "buy" | "sell";
  item: string;
  content: string
  price: number;
  currency: string;
  amt: number;
  min_amt?: number;
  payments: string[];
  expiration: number;
  id?: string;
  tags?: string[];
}

export class ArcadeListings {
  channel_id: string;
  conn: Nip28Channel;
  constructor(conn: Nip28Channel, id: string) {
    this.conn = conn
    this.channel_id = id
  }

  async list(): Promise<ArcadeListing[]> {
    const ents = (await this.conn.list(this.channel_id)).map((el: NostrEvent)=>{
        const tag = el.tags.find((el)=>{
          return el[0] == "a"
        })
        if (!tag) {
          return null
        }
        const info: ArcadeListing = JSON.parse(tag[1])
        info.id = el.id
        info.content = el.content
        return info
    })
    return ents.filter((el)=>{return el != null}) as ArcadeListing[]
  }

  async post(listing: ArcadeListingInput): Promise<NostrEvent> {
    const secs = convertToSeconds(listing.expiration)
    if (!secs) {
      throw new Error(`invalid expiration ${listing.expiration}`)
    }
    // For privacy, we limit the precision of the geohash to 5 digits. A 5-digit geohash represents an area roughly the size of a large airport.
    // An empty geohash string is valid; it means "somewhere on the planet".
    listing.geohash = (listing.geohash ?? "").substring(0,5)
    const final: ArcadeListing = {
      type: listing.type,
      action: listing.action,
      amt: listing.amt,
      price: listing.price,
      item: listing.item,
      content: listing.content ? listing.content : "",
      currency: listing.currency ? listing.currency : "",
      expiration: secs,
      payments: listing.payments
    }
    const tags = [
      ["a", JSON.stringify(final)],
      ["g", listing.geohash],
    ]
    const content = listing.content ?? ""
    delete listing.content
    return await this.conn.send(this.channel_id, content, undefined, tags)
  }

  async delete(listing_id: string): Promise<void> {
    // Implement the logic to delete a listing.
    // Use the provided listing_id to identify and remove the corresponding listing.
  }
}

function convertToSeconds(input: string): number | undefined {
  const durationRegex = /(\d+)\s*(s(?:econds?)?|m(?:in(?:utes?)?)?|h(?:ours?)?|d(?:ays?)?|w(?:eeks?)?|mon(?:ths?)?)/i;
  const matches = input.match(durationRegex);

  if (!matches) {
    return undefined; // Invalid input format
  }

  const quantity = parseInt(matches[1]);
  const unit = matches[2].toLowerCase();

  switch (unit) {
    case 's':
    case 'seconds':
      return quantity;
    case 'm':
    case 'min':
    case 'minutes':
      return quantity * 60;
    case 'h':
    case 'hours':
      return quantity * 60 * 60;
    case 'd':
    case 'day':
    case 'days':
      return quantity * 24 * 60 * 60;
    case 'w':
    case 'week':
    case 'weeks':
      return quantity * 7 * 24 * 60 * 60;
    case 'mon':
    case 'month':
    case 'months':
      return quantity * 30 * 24 * 60 * 60; // Assuming 30 days per month
    default:
      return undefined; // Invalid unit
  }
}