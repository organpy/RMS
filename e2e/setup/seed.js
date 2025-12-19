const fetch = require('node-fetch');

const API_BASE = process.env.API_BASE || 'http://127.0.0.1:8000';

const sampleMembers = [
  { first_name: 'Alice', last_name: 'Seed', email: 'alice.seed@example.com', status: 'active' },
  { first_name: 'Bob', last_name: 'Seed', email: 'bob.seed@example.com', status: 'active' }
];

const BUSINESS_ID = process.env.BUSINESS_ID || null;

async function getBusinessIdFromSettings() {
  const res = await fetch(`${API_BASE}/api/settings`);
  if (!res.ok) {
    return null;
  }
  const json = await res.json();
  return json.id ?? json.business_id ?? null;
}

async function createMember(member) {
  const res = await fetch(`${API_BASE}/api/members`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(member)
  });
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`Failed to create member: ${res.status} ${txt}`);
  }
  return res.json();
}

(async () => {
  try {
    console.log(`Seeding ${sampleMembers.length} members to ${API_BASE}`);
    let businessId = BUSINESS_ID;
    if (!businessId) {
      const idFromSettings = await getBusinessIdFromSettings();
      if (idFromSettings) {
        businessId = idFromSettings;
        console.log('Using business id from settings:', businessId);
      } else {
        // Last resort: assume primary business has id 1
        businessId = 1;
        console.warn('Could not obtain business id from /api/settings; falling back to business_id=1');
      }
    }

    for (const m of sampleMembers) {
      const payload = { ...m, business_id: businessId };
      const created = await createMember(payload);
      console.log('Created member id:', created.id || created);
    }
    console.log('Seeding complete');
  } catch (err) {
    console.error('Seeding failed:', err.message);
    process.exit(1);
  }
})();
