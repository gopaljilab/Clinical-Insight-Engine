const fs = require('fs');
const files = [
  'server/repositories/auth.repository.ts',
  'server/utils/seed.ts',
  'server/routes.ts'
];
for (const file of files) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/\.values\(\{/g, '.values({');
  // I will just use regex to replace specific lines or I'll just use multi_replace
}

