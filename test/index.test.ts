import { parseCommand } from '../src/listing';

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
