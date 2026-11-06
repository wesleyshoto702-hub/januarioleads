// Local Windows-only Docker adapter. Never reads SQL dumps or cloud credentials.
import http from 'node:http';
import net from 'node:net';
import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';
import { readFile, access, open } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function restrictPorts(body) {
  const config = JSON.parse(body);
  if (!config || typeof config !== 'object' || Array.isArray(config)) throw new Error('Invalid container configuration');
  const host = config.HostConfig ??= {};
  if (typeof host !== 'object' || Array.isArray(host)) throw new Error('Invalid host configuration');
  if (host.NetworkMode === 'host' || host.PublishAllPorts) throw new Error('Unsafe network configuration');
  for (const bindings of Object.values(host.PortBindings ?? {})) {
    if (!Array.isArray(bindings)) throw new Error('Invalid port bindings');
    for (const binding of bindings) {
      if (!binding || typeof binding !== 'object' || Array.isArray(binding)) throw new Error('Invalid port binding');
      binding.HostIp = '127.0.0.1';
    }
  }
  return JSON.stringify(config);
}

export function dockerAdapter(socketPath) {
  const sockets = new Set();
  const server = http.createServer(async (req, res) => {
    try {
      const create = req.method === 'POST' && /\/containers\/create(?:\?|$)/.test(req.url);
      let body;
      const headers = { ...req.headers };
      if (create) {
        const parts = []; let size = 0;
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 4 * 1024 * 1024) throw new Error('Request too large');
          parts.push(chunk);
        }
        body = restrictPorts(Buffer.concat(parts).toString());
        delete headers['transfer-encoding'];
        headers['content-length'] = Buffer.byteLength(body);
      }
      const upstream = http.request({ socketPath, path: req.url, method: req.method, headers }, reply => {
        res.writeHead(reply.statusCode, reply.headers);
        reply.pipe(res);
        reply.on('error', () => res.destroy());
      });
      upstream.on('error', () => { if (!res.headersSent) res.writeHead(502); res.end('Local Docker connection failed'); });
      if (create) upstream.end(body); else req.pipe(upstream);
    } catch {
      res.writeHead(400); res.end('Local Docker safety check failed');
    }
  });
  server.on('connection', socket => {
    sockets.add(socket);
    socket.on('close', () => sockets.delete(socket));
  });
  server.shutdown = () => {
    for (const socket of sockets) socket.destroy();
    server.close();
  };
  server.on('upgrade', (req, client, head) => {
    if (!/\/(?:exec\/[^/]+\/start|containers\/[^/]+\/attach)(?:\?|$)/.test(req.url)) {
      client.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
      return;
    }
    const upstream = net.connect(socketPath, () => {
      upstream.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
        Object.entries(req.headers).map(([key, value]) => `${key}: ${value}\r\n`).join('') + '\r\n');
      if (head.length) upstream.write(head);
      client.pipe(upstream); upstream.pipe(client);
    });
    client.on('error', () => upstream.destroy());
    upstream.on('error', () => client.destroy());
    client.on('close', () => upstream.destroy());
  });
  return server;
}

export function verifyPublishedPorts(containers, project) {
  const db = containers.find(item => item.Names.includes(`/supabase_db_${project}`));
  if (!db || !(db.Ports ?? []).some(port => port.PrivatePort === 5432 && port.PublicPort === 54322 && port.IP === '127.0.0.1')) {
    throw new Error('Local database port missing');
  }
  for (const item of containers) {
    for (const port of item.Ports ?? []) {
      if (port.PublicPort && port.IP !== '127.0.0.1') throw new Error('Public port detected');
    }
  }
}

export function startupMode(args) {
  if (args.length === 1) return { lab: args[0], network: 'januario-restore-local', prepareEmpty: false };
  if (args.length === 2 && args[1] === '--preparar-vazio') {
    return { lab: args[0], network: 'januario-restore-loopback', prepareEmpty: true };
  }
  throw new Error('Use: node script.mjs CAMINHO_DO_LABORATORIO [--preparar-vazio]');
}

export function startupFailure(stage) {
  const messages = {
    start: 'A CLI nao concluiu a inicializacao. Possivel falha de acesso local, Docker ou healthcheck.',
    ports: 'As portas publicadas nao passaram na verificacao de loopback.',
    network: 'Os containers usam uma rede diferente da esperada.',
    empty: 'Nao foi possivel confirmar laboratorio sem usuarios Auth e sem tabelas do aplicativo.',
  };
  return messages[stage] ?? 'Verificacao local nao concluida.';
}

function api(socketPath, path) {
  return new Promise((resolveResult, reject) => {
    const req = http.get({ socketPath, path }, res => {
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) throw new Error('Docker check failed');
          resolveResult(JSON.parse(Buffer.concat(chunks).toString()));
        } catch (error) { reject(error); }
      });
    });
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('Docker timeout')));
  });
}

async function main() {
  if (process.platform !== 'win32') throw new Error('Execute este iniciador no Windows.');
  const { lab: labArgument, network, prepareEmpty } = startupMode(process.argv.slice(2));
  const lab = resolve(labArgument);
  const config = await readFile(join(lab, 'supabase/config.toml'), 'utf8');
  const project = config.match(/^project_id\s*=\s*"([A-Za-z0-9_-]+)"/m)?.[1];
  if (!project || project === 'czkazbianiflhldenhcj') throw new Error('Invalid local project');
  try { await access(join(lab, 'supabase/.temp/project-ref')); throw new Error('Linked project forbidden'); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  const upstream = '\\\\.\\pipe\\dockerDesktopLinuxEngine';
  const networkInfo = await api(upstream, `/networks/${network}`);
  if (networkInfo.Driver !== 'bridge' || (prepareEmpty ? networkInfo.Internal !== false : !networkInfo.Internal)) {
    throw new Error('A rede nao corresponde ao modo solicitado.');
  }
  const filters = encodeURIComponent(JSON.stringify({ label: [`com.supabase.cli.project=${project}`] }));
  if ((await api(upstream, `/containers/json?all=1&filters=${filters}`)).length) throw new Error('Stop the local laboratory first');
  const pipeName = `januario-loopback-${randomBytes(16).toString('hex')}`;
  const log = await open(join(lab, 'inicializacao-privada.log'), 'w');
  const server = dockerAdapter(upstream);
  try {
    await new Promise((ok, fail) => { server.once('error', fail); server.listen(`\\\\.\\pipe\\${pipeName}`, ok); });
  } catch (error) { await log.close(); server.shutdown(); throw error; }
  const env = { ...process.env, DOCKER_HOST: `npipe:////./pipe/${pipeName}` };
  delete env.DOCKER_CONTEXT;
  delete env.DOCKER_TLS_VERIFY;
  delete env.DOCKER_CERT_PATH;
  async function cli(action) {
    const command = `npx.cmd --yes supabase@2.122.1 ${action}`;
    return await new Promise((ok, fail) => {
      const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', command],
        { cwd: lab, env, stdio: ['ignore', log.fd, log.fd] });
      child.once('error', fail); child.once('exit', code => ok(code));
    });
  }
  let stage = 'start';
  try {
    if (prepareEmpty) console.log('PREPARACAO APENAS: esta rede permite saida para internet. Nao carregar dados de clientes.');
    console.log('Iniciando laboratorio vazio com portas explicitamente locais. Aguarde.');
    if (await cli(`start --network-id ${network}`) !== 0) throw new Error('Local startup failed');
    stage = 'ports';
    const containers = await api(upstream, `/containers/json?filters=${filters}`);
    verifyPublishedPorts(containers, project);
    stage = 'network';
    for (const item of containers) {
      const details = await api(upstream, `/containers/${item.Id}/json`);
      if (details.HostConfig.NetworkMode !== network ||
          Object.keys(details.NetworkSettings.Networks).some(name => name !== network)) throw new Error('Unexpected network');
    }
    if (prepareEmpty) {
      stage = 'empty';
      const sql = `select case when not exists (select 1 from auth.users)
        and not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
        where n.nspname='public' and c.relkind in ('r','p') and c.relname<>'spatial_ref_sys')
        then 'LAB_VAZIO' else 'BLOQUEADO' end;`;
      const empty = await new Promise((ok, fail) => {
        const child = spawn('docker.exe', ['exec', `supabase_db_${project}`, 'psql',
          '--no-psqlrc', '--no-password', '-U', 'postgres', '-d', 'postgres', '-At',
          '--set=ON_ERROR_STOP=1', '--command', sql], { env, stdio: ['ignore', 'pipe', log.fd] });
        let output = '';
        child.stdout.on('data', chunk => { output += chunk.toString(); if (output.length > 4096) child.kill(); });
        const timeout = setTimeout(() => child.kill(), 20000);
        child.once('error', error => { clearTimeout(timeout); fail(error); });
        child.once('exit', code => { clearTimeout(timeout); ok(code === 0 && output.trim() === 'LAB_VAZIO'); });
      });
      if (!empty) throw new Error('Empty laboratory not confirmed');
      console.log('PREPARADO: laboratorio vazio e portas locais confirmados. Restauracao privada ainda NAO liberada.');
    } else {
      console.log('PASS: portas publicadas somente em 127.0.0.1. Nenhum backup foi aberto ou restaurado.');
    }
  } catch {
    console.error(startupFailure(stage));
    let stopped = false;
    try { stopped = await cli('stop') === 0; } catch { /* Report without credential-bearing diagnostics. */ }
    if (!stopped) console.error('Nao foi possivel confirmar a parada: execute supabase stop na pasta do laboratorio.');
    throw new Error('Laboratorio nao aprovado. Consulte inicializacao-privada.log LOCALMENTE; nao compartilhe o arquivo.');
  } finally {
    await log.close(); server.shutdown();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
