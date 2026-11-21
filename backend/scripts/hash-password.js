// Prints a bcrypt hash for seed data:  npm run hash -- mySecret
const bcrypt = require('bcryptjs');
const pwd = process.argv[2];
if (!pwd) { console.error('Usage: npm run hash -- <password>'); process.exit(1); }
console.log(bcrypt.hashSync(pwd, 10));
