import envelopeShape from './__fixtures__/contract/envelope_shape.json';

// This test guards doc/fixture drift only — see
// src/__tests__/__fixtures__/contract/README.md for the honest scope. It does NOT exercise the
// real Android (Kotlin) or iOS (Swift) marshalling code, which Jest cannot run.
describe('response envelope contract fixture', () => {
  it('has exactly the three keys SDK-GUIDE.md §7 documents as the verbatim envelope', () => {
    expect(Object.keys(envelopeShape).sort()).toEqual([
      'response',
      'responseType',
      'statusCode',
    ]);
  });

  it('keeps responseType and response as the pass-through-critical fields non-empty in the fixture', () => {
    expect(typeof envelopeShape.responseType).toBe('string');
    expect(envelopeShape.responseType.length).toBeGreaterThan(0);
    expect(typeof envelopeShape.response).toBe('object');
  });
});
