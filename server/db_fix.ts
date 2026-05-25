// Ensures process exits cleanly on db error
import process from 'process';
export function handleDbError(err: Error) {
  console.error('DB Error:', err);
  process.exit(1);
}
