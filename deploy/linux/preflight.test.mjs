import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateEnvironment } from './preflight.mjs';

// Public template plus synthetic test values only; never load private env files.
const template = Object.fromEntries((await readFile(new URL('./environment.example', import.meta.url), 'utf8'))
  .split('\n').filter((line) => line && !line.startsWith('#')).map((line) => {
    const separator = line.indexOf('='); return [line.slice(0, separator), line.slice(separator + 1)];
  }));
const valid = () => ({ ...template, PHYSICS_API_TOKEN_SECRET: 'ab'.repeat(32) });

test('accepts the isolated loopback baseline with synthetic configured credentials', () => {
  assert.deepEqual(validateEnvironment(valid(), '24.14.0'), []);
});
test('accepts the exact reviewed HTTPS subdomain alone or with the matching loopback port', () => {
  for (const origins of ['https://physics.xianghuiacademy.cn', 'http://127.0.0.1:18080,https://physics.xianghuiacademy.cn']) {
    assert.deepEqual(validateEnvironment({ ...valid(), PHYSICS_API_ALLOWED_ORIGINS: origins }, '24.14.0'), []);
  }
  const alternatePorts = { ...valid(), PORT: '18081', PHYSICS_API_ALLOWED_ORIGINS: 'http://127.0.0.1:18081,https://physics.xianghuiacademy.cn' };
  assert.deepEqual(validateEnvironment(alternatePorts, '24.14.0'), []);
});
test('the unchanged example and blank or single-character repeated secrets cannot pass', () => {
  for (const value of [template.PHYSICS_API_TOKEN_SECRET, '', 'a'.repeat(64)]) {
    assert.ok(validateEnvironment({ ...valid(), PHYSICS_API_TOKEN_SECRET: value }, '24.14.0').some((error) => error.includes('token-secret')));
  }
});
test('rejects the parent site, sibling subdomains, spoofed origins and unreviewed schemes or ports', () => {
  for (const origin of [
    'https://xianghuiacademy.cn', 'https://www.xianghuiacademy.cn',
    'https://other.xianghuiacademy.cn', 'https://physics.xianghuiacademy.cn.evil.example',
    'http://physics.xianghuiacademy.cn', 'https://physics.xianghuiacademy.cn:8443',
    'https://physics.xianghuiacademy.cn/', 'https://PHYSICS.xianghuiacademy.cn',
    'https://physics.xianghuiacademy.cn,https://xianghuiacademy.cn',
    'http://127.0.0.1:18081', 'http://localhost:18080',
    'https://unreviewed.example.com',
  ]) {
    assert.ok(validateEnvironment({ ...valid(), PHYSICS_API_ALLOWED_ORIGINS: origin }, '24.14.0').some((error) => error.includes('PHYSICS_API_ALLOWED_ORIGINS')), origin);
  }
});
test('rejects placeholder origins and non-origin paths', () => {
  for (const origin of ['', 'https://example.invalid', 'https://REPLACE_WITH_NEW_PHYSICS_DOMAIN', 'https://placeholder.example.com', 'http://127.0.0.1:18080/path']) {
    assert.ok(validateEnvironment({ ...valid(), PHYSICS_API_ALLOWED_ORIGINS: origin }, '24.14.0').some((error) => error.includes('PHYSICS_API_ALLOWED_ORIGINS')), origin);
  }
});
test('rejects public binding, conflicting/privileged ports and different API port settings', () => {
  for (const patch of [
    { PHYSICS_WEB_HOST: '0.0.0.0' }, { PHYSICS_API_HOST: '::' },
    { PORT: '18787' }, { PORT: '80' }, { PORT: 'invalid' }, { PHYSICS_API_PORT: '8787' },
  ]) assert.ok(validateEnvironment({ ...valid(), ...patch }, '24.14.0').length);
});
test('rejects accidental seed, paid services, external DB and non-independent state paths', () => {
  for (const patch of [
    { PHYSICS_API_SEED_DEMO: 'true' }, { PHYSICS_LILI_AI_ENABLED: 'true' },
    { DEEPSEEK_API_KEY: 'synthetic-test-value' }, { DATABASE_URL: 'postgres://synthetic.invalid/db' },
    { PHYSICS_API_DATABASE: '/srv/other-product/data.sqlite' },
    { PHYSICS_API_DATABASE: '/var/lib/physics-lab/../other/data.sqlite' },
  ]) assert.ok(validateEnvironment({ ...valid(), ...patch }, '24.14.0').length);
});
test('requires Node 24 and leaves Nginx entirely disabled without enabling an existing default site', async () => {
  assert.ok(validateEnvironment(valid(), '22.0.0').some((error) => error.includes('Node.js 24')));
  const nginx = await readFile(new URL('./nginx-new-domain.conf.example.disabled', import.meta.url), 'utf8');
  assert.ok(nginx.split('\n').every((line) => !line.trim() || line.trimStart().startsWith('#')));
  assert.match(nginx, /server_name physics\.xianghuiacademy\.cn/);
  assert.doesNotMatch(nginx, /^\s*#\s*listen\s+[^;]*\bdefault_server\b/m);
  assert.match(nginx, /auth_basic_user_file \/etc\/nginx\/physics-lab\.preview\.htpasswd/);
});
