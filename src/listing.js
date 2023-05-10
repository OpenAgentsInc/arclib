const knownAliases = {
  expiration: /expi?r?a?t?i?o?n?/,
};
function parseNameValuePairs(input) {
  const pairs = input.split(' ');
  const result = {};
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
export function parseDecimalNumber(number) {
  return parseFloat(number.replace(',', ''));
}
export function parseCommand(command) {
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
  const result = {
    action: action.toUpperCase(),
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
}) {
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
  const expDays = expirationDays ? `EXP:${expirationDays}d` : '';
  let addData = Object.assign({}, additionalData);
  if (expirationDays) addData['exp'] = expirationDays.toString() + 'd';
  const additionalFields = Object.entries(addData)
    .filter(([key]) => key !== 'expirationDays')
    .map(([key, value]) => `${key.toUpperCase()}:${value}`)
    .join(' ')
    .trim();
  return `${action.toUpperCase()} ${amtRange} ${currency} @ ${strPrice} ${tags}${additionalFields}`.trim();
}
