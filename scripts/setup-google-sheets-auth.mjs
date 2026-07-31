// 기존 YouTube OAuth 자격 증명의 Google OAuth 클라이언트 ID/Secret만 재사용해
// Google Sheets 전용 자격 증명을 만든다. 토큰과 YouTube scope는 복사하지 않는다.
// 실행 전 로컬 n8n을 중지해야 한다.

import crypto from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import path from 'node:path';
import sqlite3 from 'sqlite3';

const root = path.resolve(import.meta.dirname, '..');
const dbPath = path.join(root, '.n8n', 'database.sqlite');
const configPath = path.join(root, '.n8n', 'config');
const sourceId = 'l7YqloikIKiIOtOq';
const targetId = 'haruSheetsOAuth1';
const targetName = 'Google Sheets account';
const targetType = 'googleSheetsOAuth2Api';
const redirectUri = 'http://localhost:5678/rest/oauth2-credential/callback';
const pendingAuthorizationPath = path.join(root, 'etc', 'google-sheets-oauth-pending.json');
const authorize = process.argv.includes('--authorize');
const sheetsScopes = [
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.metadata',
].join(' ');

function isPortOpen(port, host = 'localhost') {
  return new Promise((resolve) => {
    const socket = net.createConnection({ port, host });
    socket.setTimeout(800);
    socket.once('connect', () => { socket.destroy(); resolve(true); });
    socket.once('timeout', () => { socket.destroy(); resolve(false); });
    socket.once('error', () => resolve(false));
  });
}

function keyAndIv(salt, key) {
  const password = Buffer.concat([Buffer.from(key, 'binary'), salt]);
  const hash1 = crypto.createHash('md5').update(password).digest();
  const hash2 = crypto.createHash('md5').update(Buffer.concat([hash1, password])).digest();
  const iv = crypto.createHash('md5').update(Buffer.concat([hash2, password])).digest();
  return [Buffer.concat([hash1, hash2]), iv];
}

function decrypt(value, key) {
  const input = Buffer.from(value, 'base64');
  if (input.length < 16 || input.subarray(0, 8).toString('ascii') !== 'Salted__') {
    throw new Error('지원하지 않는 n8n 자격 증명 암호문 형식입니다.');
  }
  const salt = input.subarray(8, 16);
  const [derivedKey, iv] = keyAndIv(salt, key);
  const decipher = crypto.createDecipheriv('aes-256-cbc', derivedKey, iv);
  return Buffer.concat([decipher.update(input.subarray(16)), decipher.final()]).toString('utf8');
}

function encrypt(value, key) {
  const salt = crypto.randomBytes(8);
  const [derivedKey, iv] = keyAndIv(salt, key);
  const cipher = crypto.createCipheriv('aes-256-cbc', derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([Buffer.from('Salted__'), salt, encrypted]).toString('base64');
}

function openDb() {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (error) => {
      if (error) reject(error);
      else resolve(db);
    });
  });
}

function get(db, sql, params = []) {
  return new Promise((resolve, reject) => db.get(sql, params, (error, row) => (
    error ? reject(error) : resolve(row)
  )));
}

function all(db, sql, params = []) {
  return new Promise((resolve, reject) => db.all(sql, params, (error, rows) => (
    error ? reject(error) : resolve(rows)
  )));
}

function run(db, sql, params = []) {
  return new Promise((resolve, reject) => db.run(sql, params, function callback(error) {
    if (error) reject(error);
    else resolve({ changes: this.changes, lastID: this.lastID });
  }));
}

function listenForOAuthCallback(expectedState, timeoutMs = 300000) {
  let server;
  let timer;
  const callback = new Promise((resolve, reject) => {
    server = http.createServer((request, response) => {
      const callbackUrl = new URL(request.url, redirectUri);
      if (callbackUrl.pathname !== '/rest/oauth2-credential/callback') {
        response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Not found');
        return;
      }
      if (callbackUrl.searchParams.get('state') !== expectedState) {
        response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('OAuth state mismatch.');
        reject(new Error('Google OAuth state 값이 일치하지 않습니다.'));
        return;
      }
      const providerError = callbackUrl.searchParams.get('error');
      if (providerError) {
        response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Google OAuth authorization was not completed.');
        reject(new Error('Google OAuth 승인이 완료되지 않았습니다: ' + providerError));
        return;
      }
      const code = callbackUrl.searchParams.get('code');
      if (!code) {
        response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
        response.end('Authorization code is missing.');
        reject(new Error('Google OAuth 콜백에 authorization code가 없습니다.'));
        return;
      }
      resolve({ code, callbackQueryString: callbackUrl.search.slice(1), response });
    });
    server.once('error', reject);
    timer = setTimeout(() => reject(new Error('Google OAuth 승인을 5분 안에 받지 못했습니다.')), timeoutMs);
  });
  const ready = new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
    server.listen(5678);
  });
  return {
    ready,
    callback,
    close: () => {
      clearTimeout(timer);
      if (server.listening) server.close();
    },
  };
}

if (await isPortOpen(5678)) {
  throw new Error('로컬 n8n이 실행 중입니다. 데이터베이스 변경 전에 n8n을 중지하세요.');
}
if (!fs.existsSync(dbPath)) throw new Error('n8n 데이터베이스를 찾지 못했습니다: ' + dbPath);
if (!fs.existsSync(configPath)) throw new Error('n8n 암호화 설정을 찾지 못했습니다: ' + configPath);

const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
if (!config.encryptionKey) throw new Error('n8n 암호화 키가 없습니다.');

const db = await openDb();
try {
  const existing = await get(db, 'SELECT id,name,type FROM credentials_entity WHERE id=? OR name=?', [targetId, targetName]);
  if (existing) {
    if (existing.id !== targetId || existing.name !== targetName || existing.type !== targetType) {
      throw new Error('같은 ID 또는 이름의 다른 자격 증명이 이미 있습니다.');
    }
    console.log(JSON.stringify({ ok: true, created: false, credential: existing }, null, 2));
  } else {
    const source = await get(
      db,
      'SELECT id,name,data,type,isManaged,isGlobal,isResolvable,resolvableAllowFallback,resolverId FROM credentials_entity WHERE id=?',
      [sourceId],
    );
    if (!source) throw new Error('복제할 YouTube OAuth 자격 증명을 찾지 못했습니다: ' + sourceId);

    const sourceData = JSON.parse(decrypt(source.data, config.encryptionKey));
    if (!sourceData.clientId || !sourceData.clientSecret) {
      throw new Error('기존 YouTube OAuth 자격 증명에 clientId 또는 clientSecret이 없습니다.');
    }
    const targetData = {
      grantType: 'authorizationCode',
      authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
      accessTokenUrl: 'https://oauth2.googleapis.com/token',
      authQueryParameters: 'access_type=offline&prompt=consent',
      authentication: 'body',
      clientId: sourceData.clientId,
      clientSecret: sourceData.clientSecret,
      scope: sheetsScopes,
    };
    const encryptedData = encrypt(JSON.stringify(targetData), config.encryptionKey);
    const shares = await all(db, 'SELECT projectId,role FROM shared_credentials WHERE credentialsId=?', [sourceId]);
    if (!shares.length) throw new Error('기존 YouTube OAuth 자격 증명의 프로젝트 소유 관계를 찾지 못했습니다.');

    await run(db, 'BEGIN IMMEDIATE');
    try {
      await run(
        db,
        `INSERT INTO credentials_entity
          (id,name,data,type,isManaged,isGlobal,isResolvable,resolvableAllowFallback,resolverId)
         VALUES (?,?,?,?,?,?,?,?,?)`,
        [targetId, targetName, encryptedData, targetType, 0, 0, 0, 0, null],
      );
      for (const share of shares) {
        await run(
          db,
          'INSERT INTO shared_credentials (credentialsId,projectId,role) VALUES (?,?,?)',
          [targetId, share.projectId, share.role],
        );
      }
      await run(db, 'COMMIT');
    } catch (error) {
      await run(db, 'ROLLBACK');
      throw error;
    }

    console.log(JSON.stringify({
      ok: true,
      created: true,
      credential: { id: targetId, name: targetName, type: targetType },
      client_id_copied: true,
      client_secret_copied: true,
      oauth_token_copied: false,
      sheets_scope_count: sheetsScopes.split(' ').length,
      shared_projects: shares.length,
    }, null, 2));
  }

  if (authorize) {
    const target = await get(db, 'SELECT data FROM credentials_entity WHERE id=?', [targetId]);
    if (!target) throw new Error('Google Sheets 자격 증명을 찾지 못했습니다: ' + targetId);
    const targetData = JSON.parse(decrypt(target.data, config.encryptionKey));
    if (!targetData.clientId || !targetData.clientSecret) {
      throw new Error('Google Sheets 자격 증명에 clientId 또는 clientSecret이 없습니다.');
    }

    const state = crypto.randomBytes(24).toString('base64url');
    const authorizationUrl = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    authorizationUrl.searchParams.set('client_id', targetData.clientId);
    authorizationUrl.searchParams.set('redirect_uri', redirectUri);
    authorizationUrl.searchParams.set('response_type', 'code');
    authorizationUrl.searchParams.set('scope', sheetsScopes);
    authorizationUrl.searchParams.set('access_type', 'offline');
    authorizationUrl.searchParams.set('prompt', 'consent');
    authorizationUrl.searchParams.set('state', state);

    const listener = listenForOAuthCallback(state);
    let callbackResponse;
    try {
      await listener.ready;
      const authorizationRequest = {
        authorization_required: true,
        authorization_url: authorizationUrl.toString(),
        redirect_uri: redirectUri,
        timeout_seconds: 300,
      };
      fs.mkdirSync(path.dirname(pendingAuthorizationPath), { recursive: true });
      fs.writeFileSync(pendingAuthorizationPath, JSON.stringify(authorizationRequest, null, 2) + '\n', 'utf8');
      console.log(JSON.stringify(authorizationRequest, null, 2));
      callbackResponse = await listener.callback;

      const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code: callbackResponse.code,
          client_id: targetData.clientId,
          client_secret: targetData.clientSecret,
          redirect_uri: redirectUri,
          grant_type: 'authorization_code',
        }),
      });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok) {
        throw new Error('Google OAuth 토큰 교환 실패: ' + (tokenData.error_description || tokenData.error || tokenResponse.status));
      }
      if (!tokenData.access_token || !tokenData.refresh_token) {
        throw new Error('Google OAuth 응답에 access_token 또는 refresh_token이 없습니다.');
      }
      const grantedScopes = new Set(String(tokenData.scope || '').split(/\s+/).filter(Boolean));
      const missingScopes = sheetsScopes.split(' ').filter((scope) => !grantedScopes.has(scope));
      if (missingScopes.length) {
        throw new Error('승인되지 않은 Google OAuth scope가 있습니다: ' + missingScopes.join(', '));
      }

      targetData.oauthTokenData = {
        ...tokenData,
        callbackQueryString: callbackResponse.callbackQueryString,
      };
      await run(
        db,
        'UPDATE credentials_entity SET data=?, updatedAt=CURRENT_TIMESTAMP WHERE id=?',
        [encrypt(JSON.stringify(targetData), config.encryptionKey), targetId],
      );
      callbackResponse.response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      callbackResponse.response.end('<!doctype html><meta charset="utf-8"><title>Google Sheets 연결 완료</title><p>Google Sheets 연결이 완료되었습니다. 이 탭을 닫아도 됩니다.</p>');
      console.log(JSON.stringify({
        ok: true,
        authorized: true,
        credential: { id: targetId, name: targetName, type: targetType },
        access_token_saved: true,
        refresh_token_saved: true,
        granted_scope_count: grantedScopes.size,
      }, null, 2));
    } catch (error) {
      if (callbackResponse?.response && !callbackResponse.response.writableEnded) {
        callbackResponse.response.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        callbackResponse.response.end('Google Sheets OAuth token could not be saved.');
      }
      throw error;
    } finally {
      listener.close();
      fs.rmSync(pendingAuthorizationPath, { force: true });
    }
  }
} finally {
  await new Promise((resolve, reject) => db.close((error) => (error ? reject(error) : resolve())));
}
