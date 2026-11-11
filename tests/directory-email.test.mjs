import { test } from 'node:test';
import assert from 'node:assert/strict';
import { directoryRecipients, bccMailto } from '../lib/directory-email.ts';

test('selects the whole group, ignores invalid addresses and deduplicates case-insensitively', () => {
  const records = [
    { email: ' A@example.com ', membershipType: 'Full member' },
    { email: 'a@EXAMPLE.com', membershipType: 'Full member' },
    { email: 'bad', membershipType: 'Full member' },
    { email: '', membershipType: 'Full member' },
    { email: 'social@example.com', membershipType: 'Social member' },
  ];
  assert.deepEqual(directoryRecipients(records, 'Full member'), { addresses: ['A@example.com'], omitted: 2 });
  assert.equal(directoryRecipients(records, 'all').addresses.length, 2);
  assert.deepEqual(directoryRecipients(records, 'Social member').addresses, ['social@example.com']);
});

test('addresses appear exclusively in BCC and oversized lists offer copy instead', () => {
  assert.equal(bccMailto(['a@example.com', 'b@example.com']), 'mailto:?bcc=a%40example.com%2Cb%40example.com');
  assert.equal(bccMailto(['x'.repeat(2000) + '@example.com']), null);
  assert.equal(bccMailto([]), null);
});
