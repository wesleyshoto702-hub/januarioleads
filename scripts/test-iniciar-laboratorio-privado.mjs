import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import net from 'node:net';
import { randomUUID } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { restrictPorts, dockerAdapter, verifyPublishedPorts, startupMode, startupFailure } from './iniciar-laboratorio-privado.mjs';

test('outbound-capable network requires explicit empty-preparation mode', () => {
  assert.deepEqual(startupMode(['C:\\Lab']), { lab: 'C:\\Lab', network: 'januario-restore-local', prepareEmpty: false });
  assert.deepEqual(startupMode(['C:\\Lab', '--preparar-vazio']), { lab: 'C:\\Lab', network: 'januario-restore-loopback', prepareEmpty: true });
  for (const args of [[], ['C:\\Lab', '--unsafe'], ['C:\\Lab', '--preparar-vazio', 'extra']]) {
    assert.throws(() => startupMode(args));
  }
});

test('failure diagnostics contain only fixed messages, never arbitrary upstream text', () => {
  for (const stage of ['start', 'ports', 'network', 'empty']) assert.ok(startupFailure(stage).length > 10);
  assert.ok(!startupFailure('FAKE_PRIVATE_TOKEN').includes('FAKE_PRIVATE_TOKEN'));
});

test('every published address becomes explicit loopback without changing other configuration', () => {
  const original = { Image: 'fake-postgres', Env: ['FAKE_PASSWORD=fixture'],
    HostConfig: { NetworkMode: 'lab', Binds: ['fake-volume:/data'], PortBindings: {
      '5432/tcp': [{ HostIp: '', HostPort: '54322' }, { HostIp: '::', HostPort: '54323' }],
      '80/tcp': [{ HostIp: '0.0.0.0', HostPort: '8080' }],
    } } };
  const result = JSON.parse(restrictPorts(JSON.stringify(original)));
  for (const bindings of Object.values(result.HostConfig.PortBindings)) {
    for (const binding of bindings) assert.equal(binding.HostIp, '127.0.0.1');
  }
  assert.deepEqual(result.Env, original.Env);
  assert.deepEqual(result.HostConfig.Binds, original.HostConfig.Binds);
  assert.equal(result.HostConfig.PortBindings['5432/tcp'][1].HostPort, '54323');
});

test('unsafe or malformed container configurations are rejected', () => {
  for (const body of ['null', '[]', '{', '{"HostConfig":false}',
    '{"HostConfig":{"NetworkMode":"host"}}', '{"HostConfig":{"PublishAllPorts":true}}',
    '{"HostConfig":{"PortBindings":{"80/tcp":null}}}',
    '{"HostConfig":{"PortBindings":{"80/tcp":[null]}}}']) {
    assert.throws(() => restrictPorts(body));
  }
});

test('postcheck requires database port and rejects nonlocal ports on other services', () => {
  const db = { Names: ['/supabase_db_Lab'], Ports: [{ PrivatePort: 5432, PublicPort: 54322, IP: '127.0.0.1' }] };
  verifyPublishedPorts([db], 'Lab');
  assert.throws(() => verifyPublishedPorts([], 'Lab'));
  assert.throws(() => verifyPublishedPorts([{ ...db, Ports: [] }], 'Lab'));
  for (const IP of ['0.0.0.0', '::', '', undefined]) {
    assert.throws(() => verifyPublishedPorts([db, { Names: ['/other'], Ports: [{ PublicPort: 8000, IP }] }], 'Lab'));
  }
});

const socketName = () => process.platform === 'win32'
  ? `\\\\.\\pipe\\januario-test-${randomUUID()}` : join(tmpdir(), `januario-${randomUUID()}.sock`);
const listen = (server, path) => new Promise((ok, fail) => {
  server.once('error', fail); server.listen(path, ok);
});
function request(socketPath, path, body, method = 'POST') {
  return new Promise((ok, fail) => {
    const req = http.request({ socketPath, path, method }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => ok({ status: res.statusCode, body: Buffer.concat(chunks).toString() }));
    });
    req.on('error', fail); req.end(body);
  });
}

test('local pipe proxy rewrites create bodies, streams other requests and hides parse failures', async () => {
  const backendPath = socketName(), proxyPath = socketName();
  const received = [];
  const backend = http.createServer(async (req, res) => {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    received.push({ path: req.url, body: Buffer.concat(chunks).toString(), headers: req.headers });
    res.writeHead(200); res.end('{"ok":true}');
  });
  const proxy = dockerAdapter(backendPath);
  try {
    await listen(backend, backendPath); await listen(proxy, proxyPath);
    const body = JSON.stringify({ HostConfig: { PortBindings: { '5432/tcp': [{ HostIp: '', HostPort: '54322' }] } } });
    assert.equal((await request(proxyPath, '/v1.47/containers/create?name=fixture', body)).status, 200);
    const rewritten = JSON.parse(received[0].body);
    assert.equal(rewritten.HostConfig.PortBindings['5432/tcp'][0].HostIp, '127.0.0.1');
    assert.equal(Number(received[0].headers['content-length']), Buffer.byteLength(received[0].body));
    await request(proxyPath, '/v1.47/exec/fixture/start', '{"AttachStdin":false}');
    assert.equal(received[1].body, '{"AttachStdin":false}');
    const failure = await request(proxyPath, '/v1.47/containers/create', 'invalid FAKE_SECRET');
    assert.equal(failure.status, 400); assert.ok(!failure.body.includes('FAKE_SECRET'));
    assert.equal(received.length, 2);
  } finally {
    proxy.shutdown(); backend.closeAllConnections(); backend.close();
  }
});

test('Docker hijacked exec connections remain bidirectional over local pipes', async () => {
  const backendPath = socketName(), proxyPath = socketName();
  const backend = http.createServer();
  backend.on('upgrade', (_req, socket) => {
    socket.write('HTTP/1.1 101 Switching Protocols\r\nConnection: Upgrade\r\nUpgrade: tcp\r\n\r\n');
    socket.on('data', chunk => socket.write(chunk));
  });
  const proxy = dockerAdapter(backendPath);
  let client;
  try {
    await listen(backend, backendPath); await listen(proxy, proxyPath);
    await new Promise((ok, fail) => {
      client = net.connect(proxyPath, () => {
        client.write('POST /v1.47/exec/fixture/start HTTP/1.1\r\nHost: docker\r\nConnection: Upgrade\r\nUpgrade: tcp\r\n\r\n');
      });
      client.setTimeout(5000, () => fail(new Error('Fixture timeout')));
      client.on('error', fail);
      let output = '', sent = false;
      client.on('data', chunk => {
        output += chunk.toString();
        if (output.includes('\r\n\r\n') && !sent) { sent = true; client.write('fixture-echo'); }
        if (output.includes('fixture-echo')) ok();
      });
    });
  } finally {
    client?.destroy(); proxy.shutdown(); backend.close();
  }
});
