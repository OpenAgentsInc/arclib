type TradeCommand = {
  action: 'BUY' | 'SELL';
  minAmount?: number;
  maxAmount: number;
  currency: string;
  price: number;
  paymentTags: string[];
  expirationDays?: number;
  additionalData?: Record<string, string>;
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
    /^(B?U?Y?|S?E?L?L?)\s+([.\d,]+)-?([.\d,]+)\s*(\w+)\s*@\s*([\d,.]+)\s*\[(\w+)\]\s*(.*)?$/;
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
    action: action as 'BUY' | 'SELL',
    minAmount: minAmount ? parseDecimalNumber(minAmount) : undefined,
    maxAmount: parseDecimalNumber(maxAmount),
    currency,
    price: parseDecimalNumber(price),
    paymentTags: [paymentTag],
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
