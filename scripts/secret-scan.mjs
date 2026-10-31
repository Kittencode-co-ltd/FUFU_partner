import { readdir, readFile } from 'node:fs/promises';
import { extname, join, relative } from 'node:path';

const root = new URL('../', import.meta.url);
const ignored = new Set(['.git', 'node_modules', '.claude']);
const allowedExtensions = new Set(['.js', '.mjs', '.ts', '.json', '.md', '.yml', '.yaml', '.sql', '.html', '.toml']);
const findings = [];
const rules = [
  ['Supabase service-role JWT', /eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/g],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g],
  ['Hard-coded service role', /service_role_key\s*=\s*(?!your_|process\.|env\()[^\s]{20,}/gi],
];

async function walk(url) {
  for (const entry of await readdir(url, { withFileTypes: true })) {
    if (ignored.has(entry.name) || entry.name === '.env' || entry.name.endsWith('.log')) continue;
    const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, url);
    if (entry.isDirectory()) await walk(child);
    else if (allowedExtensions.has(extname(entry.name))) {
      const content = await readFile(child, 'utf8');
      for (const [label, pattern] of rules) {
        pattern.lastIndex = 0;
        if (pattern.test(content)) findings.push(`${label}: ${relative(root.pathname, child.pathname)}`);
      }
    }
  }
}

await walk(root);
if (findings.length) {
  console.error(findings.join('\n'));
  process.exitCode = 1;
} else {
  console.log('Secret scan passed');
}
