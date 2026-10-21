import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const serverDir = path.resolve(fileURLToPath(import.meta.url), '../..');

test('fails startup in demo mode if JWT_SECRET is missing', () => {
  assert.throws(
    () => {
      execFileSync(
        process.execPath,
        ['src/config.js'],
        {
          cwd: serverDir,
          env: {
            PATH: process.env.PATH,
            DATA_MODE: 'demo',
            JWT_SECRET: '',
            DEMO_ADMIN_EMAIL: 'admin@careroute.local',
            DEMO_ADMIN_PASSWORD: 'password123',
            DOTENV_CONFIG_PATH: path.join(serverDir, 'nonexistent.env'),
          },
          stdio: 'pipe',
        },
      );
    },
    (err) => {
      const stderr = err.stderr ? err.stderr.toString() : '';
      assert.ok(stderr.includes('Demo mode requires explicit environment variables: JWT_SECRET'));
      return true;
    },
  );
});

test('fails startup in demo mode if JWT_SECRET is shorter than 32 characters', () => {
  assert.throws(
    () => {
      execFileSync(
        process.execPath,
        ['src/config.js'],
        {
          cwd: serverDir,
          env: {
            PATH: process.env.PATH,
            DATA_MODE: 'demo',
            JWT_SECRET: 'too-short',
            DEMO_ADMIN_EMAIL: 'admin@careroute.local',
            DEMO_ADMIN_PASSWORD: 'password123',
            DOTENV_CONFIG_PATH: path.join(serverDir, 'nonexistent.env'),
          },
          stdio: 'pipe',
        },
      );
    },
    (err) => {
      const stderr = err.stderr ? err.stderr.toString() : '';
      assert.ok(stderr.includes('JWT_SECRET must be at least 32 characters long'));
      return true;
    },
  );
});

test('fails startup in firebase mode if credentials are missing without emulator', () => {
  assert.throws(
    () => {
      execFileSync(
        process.execPath,
        ['src/config.js'],
        {
          cwd: serverDir,
          env: {
            PATH: process.env.PATH,
            DATA_MODE: 'firebase',
            FIREBASE_PROJECT_ID: '',
            FIREBASE_CLIENT_EMAIL: '',
            FIREBASE_PRIVATE_KEY: '',
            ADMIN_EMAILS: '',
            FIRESTORE_EMULATOR_HOST: '',
            DOTENV_CONFIG_PATH: path.join(serverDir, 'nonexistent.env'),
          },
          stdio: 'pipe',
        },
      );
    },
    (err) => {
      const stderr = err.stderr ? err.stderr.toString() : '';
      assert.ok(stderr.includes('Firebase mode is missing required environment variables'));
      return true;
    },
  );
});

test('allows startup in firebase mode when FIRESTORE_EMULATOR_HOST is set', () => {
  assert.doesNotThrow(() => {
    execFileSync(
      process.execPath,
      ['src/config.js'],
      {
        cwd: serverDir,
        env: {
          PATH: process.env.PATH,
          DATA_MODE: 'firebase',
          FIRESTORE_EMULATOR_HOST: '127.0.0.1:8080',
          DOTENV_CONFIG_PATH: path.join(serverDir, 'nonexistent.env'),
        },
        stdio: 'pipe',
      },
    );
  });
});
