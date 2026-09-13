/** Parse a canonical unsigned decimal token in the inclusive interval 0..999. */
export function parseInteger(token) {
  if (typeof token !== 'string') throw new TypeError('Expected a string token');
  if (token.length < 1 || token.length > 3) throw new RangeError('Expected one to three characters');
  const canonical = token === '0' || (token[0] >= '1' && token[0] <= '9' && [...token].every(char => char >= '0' && char <= '9'));
  if (!canonical) {
    throw new RangeError('Expected canonical decimal text in 0..999');
  }
  const value = Number(token);
  if (value > 999) throw new RangeError('Value exceeds 999');
  return value;
}
