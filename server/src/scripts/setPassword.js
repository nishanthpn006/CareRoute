import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import 'dotenv/config';
import { domainStore } from '../lib/domainStore.js';
import { hashPassword } from '../lib/authCrypto.js';

/**
 * Prompts for a password without echoing characters to the terminal.
 * Supports non-interactive piped input for testing and CI pipelines.
 * @param {string} promptText
 * @returns {Promise<string>}
 */
export async function promptHidden(promptText) {
  if (!process.stdin.isTTY) {
    const rl = readline.createInterface({ input: process.stdin, terminal: false });
    for await (const line of rl) {
      return line.trim();
    }
    return '';
  }

  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: true,
    });

    process.stdout.write(promptText);

    // Mute output so keystrokes are not visible or logged
    const origWrite = rl._writeToOutput;
    rl._writeToOutput = (stringToWrite) => {
      if (stringToWrite.includes('\r') || stringToWrite.includes('\n')) {
        origWrite.call(rl, stringToWrite);
      }
    };

    rl.question('', (answer) => {
      rl._writeToOutput = origWrite;
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

/**
 * Provisions or updates an individual staff member's password securely.
 * @param {string} targetEmail
 * @param {string} [providedPassword] Optional explicit password for programmatic/test usage
 */
export async function provisionStaffPassword(targetEmail, providedPassword = null) {
  const normalizedEmail = String(targetEmail || '').trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('Target email must be specified.');
  }

  const user = await domainStore.getUserByEmail(normalizedEmail);
  if (!user) {
    throw new Error(`User account "${normalizedEmail}" not found in database. Only existing staff accounts can be provisioned.`);
  }

  if (user.status !== 'active') {
    throw new Error(`User account "${normalizedEmail}" is currently ${user.status}. Only active accounts can be provisioned.`);
  }

  let password = providedPassword;

  if (!password) {
    password = await promptHidden(`Enter new password for ${user.email} (${user.role}): `);
    if (!password) {
      throw new Error('Password cannot be empty.');
    }

    if (process.stdin.isTTY) {
      const confirm = await promptHidden('Confirm password: ');
      if (password !== confirm) {
        throw new Error('Passwords do not match. Aborting.');
      }
    }
  }

  if (password.length < 10) {
    throw new Error('Password must be at least 10 characters long.');
  }

  // Hash using Argon2id
  const passwordHash = await hashPassword(password);

  // Store in PostgreSQL
  await domainStore.setUserPassword(user.id, passwordHash);

  // Record audit log
  try {
    await domainStore.recordAuditEvent({
      actor: {
        id: 'cli:admin',
        email: 'admin@careroute.internal',
        role: 'platform_admin',
      },
      action: 'user.password_provisioned',
      outcome: 'success',
      changes: {
        targetUserId: user.id,
        targetEmail: user.email,
        targetRole: user.role,
      },
      reason: 'Individual staff password provisioned via local administrative CLI.',
    });
  } catch {
    // Non-fatal if audit logging is not configured for current adapter
  }

  return {
    id: user.id,
    email: user.email,
    role: user.role,
    organizationId: user.organizationId,
    assignedFacilityIds: user.assignedFacilityIds,
  };
}

// CLI Execution entrypoint
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const emailArg = process.argv[2];
  if (!emailArg || emailArg === '--help' || emailArg === '-h') {
    console.log(`
CareRoute Staff Password Provisioning Tool
Usage:
  npm run set-password -- <email>

Example:
  npm run set-password -- reporter@mgmgh.local

Requirements:
  - Account must already exist in database
  - Password is prompted interactively without shell echo
  - Minimum 10 characters required
`);
    process.exit(1);
  }

  provisionStaffPassword(emailArg)
    .then(async (user) => {
      console.log(`[CareRoute Admin] Success: Password set for "${user.email}" (${user.role}).`);
      console.log(`[CareRoute Admin] Existing role, organization, and facility assignments preserved.`);
      console.log(`[CareRoute Admin] Account is now ready for individual login.`);
      await domainStore.close();
      process.exit(0);
    })
    .catch(async (err) => {
      console.error(`[CareRoute Admin] Error: ${err.message}`);
      await domainStore.close();
      process.exit(1);
    });
}
