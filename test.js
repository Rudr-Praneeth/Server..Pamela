const API_BASE = 'http://localhost:5000/api';

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (err) {
    console.error(`✗ ${name}: ${err.message}`);
  }
}

async function request(method, endpoint, body = null) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const res = await fetch(`${API_BASE}${endpoint}`, options);
  const data = await res.json();

  return { status: res.status, data };
}

async function runTests() {
  console.log('\n========== Testing Waste Entry Uniqueness Constraint ==========\n');

  let testEntryId;
  const testDate = new Date().toISOString().split('T')[0];

  // Test 1: Create a new entry
  await test('POST /api/waste - Create new entry', async () => {
    const { status, data } = await request('POST', '/waste', {
      date: testDate,
      year: 2024,
      month: 'May',
      red: 10,
      yellow: 5,
      blue: 3,
      white: 2
    });

    if (status !== 201) throw new Error(`Expected 201, got ${status}`);
  });

  // Test 2: Get the created entry by ID
  await test('GET /api/waste - List entries by year', async () => {
    const { status, data } = await request('GET', `/waste?year=2024`);

    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!data) throw new Error('No data returned');
  });

  // Test 3: Try to create duplicate entry (should fail)
  await test('POST /api/waste - Duplicate date rejection', async () => {
    const { status, data } = await request('POST', '/waste', {
      date: testDate,
      year: 2024,
      month: 'May',
      red: 20,
      yellow: 15,
      blue: 8,
      white: 5
    });

    if (status !== 409) throw new Error(`Expected 409 Conflict, got ${status}`);
    if (!data.error) throw new Error('Expected error message in response');
    if (data.error !== 'Duplicate entry for date') throw new Error('Wrong error message');
  });

  // Test 4: Test bulk insert with duplicates
  await test('POST /api/waste - Bulk insert rejects duplicates', async () => {
    const { status, data } = await request('POST', '/waste', [
      {
        date: '2024-05-25',
        year: 2024,
        month: 'May',
        red: 10,
        yellow: 5,
        blue: 3,
        white: 2
      },
      {
        date: testDate, // This date already exists
        year: 2024,
        month: 'May',
        red: 30,
        yellow: 20,
        blue: 10,
        white: 8
      }
    ]);

    if (status !== 409) throw new Error(`Expected 409 Conflict, got ${status}`);
  });

  // Test 5: Create another entry for testing UPDATE
  const newDate = '2024-06-01';
  await test('POST /api/waste - Create entry for update test', async () => {
    const { status, data } = await request('POST', '/waste', {
      date: newDate,
      year: 2024,
      month: 'June',
      red: 5,
      yellow: 3,
      blue: 2,
      white: 1
    });

    if (status !== 201) throw new Error(`Expected 201, got ${status}`);
    testEntryId = data.insertedIds ? data.insertedIds[0] : null;
  });

  // Get the ID of the created entry for updates
  await test('GET /api/waste - Get entries and extract ID', async () => {
    const { status, data } = await request('GET', `/waste?year=2024`);
    if (status !== 200) throw new Error(`Expected 200, got ${status}`);

    // Find the entry with our newDate
    for (const month in data) {
      const entry = data[month].find(e => e.date === newDate);
      if (entry) {
        testEntryId = entry._id;
        return;
      }
    }
    throw new Error('Could not find created entry');
  });

  // Test 6: Update entry with PUT
  await test('PUT /api/waste/:id - Update entry successfully', async () => {
    if (!testEntryId) throw new Error('No test entry ID available');

    const { status, data } = await request('PUT', `/waste/${testEntryId}`, {
      red: 15,
      yellow: 10,
      blue: 7,
      white: 5
    });

    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!data.updated) throw new Error('Expected updated entry in response');
    if (data.updated.red !== 15) throw new Error('Update did not persist');
  });

  // Test 7: Partial update with PATCH
  await test('PATCH /api/waste/:id - Partial update entry successfully', async () => {
    if (!testEntryId) throw new Error('No test entry ID available');

    const { status, data } = await request('PATCH', `/waste/${testEntryId}`, {
      red: 20
    });

    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!data.updated) throw new Error('Expected updated entry in response');
    if (data.updated.red !== 20) throw new Error('Partial update did not persist');
  });

  // Test 8: Try to update to duplicate date
  await test('PUT /api/waste/:id - Reject update to duplicate date', async () => {
    if (!testEntryId) throw new Error('No test entry ID available');

    const { status, data } = await request('PUT', `/waste/${testEntryId}`, {
      date: testDate // This date is already taken
    });

    if (status !== 409) throw new Error(`Expected 409 Conflict, got ${status}`);
    if (!data.error) throw new Error('Expected error message in response');
  });

  // Test 9: Get single entry by ID
  await test('GET /api/waste/:id - Retrieve single entry by ID', async () => {
    if (!testEntryId) throw new Error('No test entry ID available');

    const { status, data } = await request('GET', `/waste/${testEntryId}`);

    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!data._id) throw new Error('Expected entry data in response');
  });

  // Test 10: Delete entry
  await test('DELETE /api/waste/:id - Delete entry successfully', async () => {
    if (!testEntryId) throw new Error('No test entry ID available');

    const { status, data } = await request('DELETE', `/waste/${testEntryId}`);

    if (status !== 200) throw new Error(`Expected 200, got ${status}`);
    if (!data.deleted) throw new Error('Expected deleted entry in response');
  });

  // Test 11: Verify entry is deleted
  await test('GET /api/waste/:id - Confirm entry is deleted', async () => {
    if (!testEntryId) throw new Error('No test entry ID available');

    const { status } = await request('GET', `/waste/${testEntryId}`);

    if (status !== 404) throw new Error(`Expected 404 after deletion, got ${status}`);
  });

  console.log('\n========== Test Suite Complete ==========\n');
}

// Run tests with a small delay to allow server startup
setTimeout(runTests, 1000);
