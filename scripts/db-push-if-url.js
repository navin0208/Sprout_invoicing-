const { execSync } = require('child_process');

const url = process.env.DATABASE_URL;

if (url && (url.startsWith('postgres://') || url.startsWith('postgresql://'))) {
  console.log('[db-push] Detected valid PostgreSQL DATABASE_URL. Syncing database schema...');
  try {
    execSync('npx prisma db push --skip-generate', { stdio: 'inherit' });
    console.log('[db-push] Database schema is up to date.');
  } catch (err) {
    console.warn('[db-push] Warning: prisma db push encountered an issue:', err.message);
  }
} else {
  console.log(
    '[db-push] Notice: DATABASE_URL is empty or not yet configured. Skipping database push during build.'
  );
}
