// Usage: npm run make-admin -- you@example.com "your password"
// Prints the two lines to paste into .env — no data is written anywhere,
// this is just a bcrypt hashing helper.
import bcrypt from 'bcryptjs';

const [email, password] = process.argv.slice(2);

if (!email || !password) {
  console.error('Usage: npm run make-admin -- you@example.com "your password"');
  process.exit(1);
}

const hash = bcrypt.hashSync(password, 10);
// Next's .env loader (dotenv-expand) treats a bare "$" as the start of a
// variable reference (e.g. $2a would resolve "2a" as a variable name and
// silently strip it), which mangles a raw bcrypt hash. Escape every "$" as
// "\$" so it's loaded as a literal character instead.
const escapedHash = hash.replace(/\$/g, '\\$');

console.log('\nAdd these lines to your .env file:\n');
console.log(`ADMIN_EMAIL="${email}"`);
console.log(`ADMIN_PASSWORD_HASH="${escapedHash}"`);
console.log('');
