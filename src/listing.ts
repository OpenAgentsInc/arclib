import Nip28Channel from "./channel";
import { NostrEvent } from "./ident";

type TradeCommand = {
  action: 'BUY' | 'SELL' | 'buy' | 'sell';
  minAmount?: number;
  maxAmount: number;
  currency: string;
  price: number;
  paymentTags: string;
  expirationDays?: number;
  additionalData?: Record<string, number | string>;
};

const knownAliases = {
  expiration: /expi?r?a?t?i?o?n?/,
};

function parseNameValuePairs(input: string): Record<string, string> {
  const pairs = input.split(' ');
  const result: Record<string, string> = {};

  console.log('pairs', pairs);
  pairs.forEach((pair) => {
    const [originalName, value] = pair.split(':');
    let name = originalName;
    Object.entries(knownAliases).forEach((ent) => {
      if (name.match(ent[1])) {
        name = ent[0];
      }
    });
    result[name.trim().toLowerCase()] = value.trim();
  });

  return result;
}

export function parseDecimalNumber(number: string) {
  return parseFloat(number.replace(',', ''));
}

export function parseCommand(command: string): TradeCommand {
  const regex =
    /^(B?U?Y?|S?E?L?L?)\s+([.\d,]+)-?([.\d,]+)\s*(\w+)\s*@\s*([\d,.]+)\s*\[(\w+)\]\s*(.*)?$/i;
  const matches = command.match(regex);

  console.log(matches);

  if (!matches) {
    throw new Error('Invalid command format');
  }

  // first res in array is whole match
  const [
    ,
    action,
    minAmount,
    maxAmount,
    currency,
    price,
    paymentTag,
    additional,
  ] = matches;

  const result: TradeCommand = {
    action: action.toUpperCase() as 'BUY' | 'SELL',
    minAmount: minAmount ? parseDecimalNumber(minAmount) : undefined,
    maxAmount: parseDecimalNumber(maxAmount),
    currency,
    price: parseDecimalNumber(price),
    paymentTags: paymentTag,
  };

  const addData = parseNameValuePairs(additional);

  if (addData.exp) {
    // todo: hours, minutes, whatever
    result.expirationDays = parseInt(addData.exp.replace('d', ''), 10);
    delete addData.exp;
  }

  result.additionalData = addData;

  return result;
}

export function createCommand({
  action,
  minAmount,
  maxAmount,
  paymentTags,
  currency,
  price,
  expirationDays,
  additionalData,
}: TradeCommand): string {
  if (action.toLowerCase() !== 'buy' && action.toLowerCase() !== 'sell') {
    throw new Error("Invalid action. Action must be either 'buy' or 'sell'");
  }
  if (!paymentTags) {
    throw new Error('Invalid payment tags');
  }
  const strPrice = price.toString();
  const amtRange =
    minAmount === maxAmount ? `${minAmount}` : `${minAmount}-${maxAmount}`;
  const tags = paymentTags ? `[${paymentTags.toUpperCase()}] ` : '';
  const addData = { ...additionalData };
  if (expirationDays) addData['exp'] = expirationDays.toString() + 'd';
  const additionalFields = Object.entries(addData)
    .filter(([key]) => key !== 'expirationDays')
    .map(([key, value]) => `${key.toUpperCase()}:${value}`)
    .join(' ')
    .trim();
  return `${action.toUpperCase()} ${amtRange} ${currency} @ ${strPrice} ${tags}${additionalFields}`.trim();
}

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
    const tags = [["a", JSON.stringify(final)]]
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