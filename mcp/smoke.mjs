// Smoke test: spawn the built server over stdio, list tools, call read/link tools (no tx).
//
//   npm run build && OPENRAILS_MCP_SIGNER_KEY=0x... node smoke.mjs [paycardId]
//
// Signer key is optional: without it, read-only tools still work (balance shows null and
// create_request_link needs an explicit recipient).
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({ command: 'node', args: ['dist/index.js'], env: { ...process.env } });
const client = new Client({ name: 'smoke', version: '0.0.0' });
await client.connect(transport);

const { tools } = await client.listTools();
console.log('tools:', tools.map((t) => t.name).join(', '));

async function call(name, args = {}) {
  const r = await client.callTool({ name, arguments: args });
  console.log(`\n== ${name} ${JSON.stringify(args)} ==\n${r.content.map((c) => c.text).join('\n')}${r.isError ? '  [isError]' : ''}`);
}

const hasSigner = Boolean(process.env.OPENRAILS_MCP_SIGNER_KEY);
await call('openrails_config');
await call('create_request_link', hasSigner ? { amount: '3000', oneTime: true } : { amount: '3000', oneTime: true, recipient: '0x0000000000000000000000000000000000000001' });
if (process.argv[2]) await call('paycard_status', { paycardId: process.argv[2] });

await client.close();
console.log('\nsmoke ok');
process.exit(0);
