import { parseCommand, createCommand } from '../src/listing';
// import {describe, it, expect} from "@jest/globals"

describe('parseCommand', () => {
  it('should correctly parse a valid command', () => {
    const command = 'BUY 0.1-0.23 btc @ 29,000 [VPIC] EXP:2d';
    const expectedResult = {
      action: 'BUY',
      minAmount: 0.1,
      maxAmount: 0.23,
      currency: 'btc',
      price: 29000,
      paymentTags: ['VPIC'],
      expirationDays: 2,
      additionalData: {},
    };

    expect(parseCommand(command)).toEqual(expectedResult);
  });

  it('should throw an error for an invalid command', () => {
    const command = 'invalid command string';

    expect(() => parseCommand(command)).toThrowError('Invalid command format');
  });
});


describe("createCommand", () => {
  test("should format a buy command correctly", () => {
    const params = {
      action: "buy" as "buy",
      minAmount: 0.1,
      maxAmount: 0.23,
      price: 29000.3,
      paymentTags: "VPIC",
      currency: "BTC",
      expirationDays: 2
    };
    const expected = "BUY 0.1-0.23 BTC @ 29000.3 [VPIC] EXP:2d";
    const result = createCommand(params);
    expect(result).toEqual(expected);
  });

  test("should format a sell command correctly", () => {
    const params = {
      action: "SELL" as "SELL",
      minAmount: 0.5,
      maxAmount: 1.0,
      currency: "BTC",
      price: 29000,
      paymentTags: "iw",
      additionalData: { someParam: "value" },
    };
    const expected = "SELL 0.5-1 BTC @ 29000 [IW] SOMEPARAM:value";
    const result = createCommand(params);
    expect(result).toEqual(expected);
  });
});