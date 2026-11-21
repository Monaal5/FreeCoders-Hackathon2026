/** Round to paise (2 dp) without float drift: round2(1.005) === 1.01 */
const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

module.exports = { round2 };
