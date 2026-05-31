# Unique Date Validation Implementation

## Summary
This implementation adds database-level uniqueness validation for the `date` field in the WasteEntry collection, preventing duplicate entries and providing proper error handling.

## Changes Made

### 1. **models/WasteEntry.js** - Added Unique Constraint
- Updated the `date` field with unique constraint configuration:
  - `unique: true` - Enforces uniqueness at the database level
  - `sparse: true` - Allows unique index on nullable fields
  - `required: true` - Date field is now mandatory
- MongoDB will automatically create a unique index on the `date` field

### 2. **index.js** - Enhanced Error Handling & CRUD Operations

#### POST /api/waste (Create)
- Enhanced error handling to catch duplicate date violations (error code 11000)
- Returns HTTP 409 (Conflict) with descriptive error message when duplicate date is detected
- Suggests using PUT to update existing records
- Error response includes: error message, affected field, and problematic value

#### POST /api/waste-upload (Bulk Upload)
- Added error handling for duplicate dates in Excel uploads
- Returns HTTP 409 (Conflict) when any record has a duplicate date
- Provides guidance to use PUT for updates

#### GET /api/waste (List by Year)
- No changes needed - unique constraint prevents duplicates automatically
- Continues to group entries by month

#### GET /api/waste/:id (New - Retrieve Single Record)
- New endpoint to retrieve individual waste entries by their MongoDB ID
- Returns HTTP 404 if record not found

#### PUT /api/waste/:id (Update - Full Replacement)
- New endpoint for updating existing entries
- Validates all fields on update
- Prevents updating to a date that already exists (returns HTTP 409)
- Returns HTTP 404 if record not found
- Returns the updated document

#### PATCH /api/waste/:id (Update - Partial)
- New endpoint for partial updates of existing entries
- Only updates provided fields
- Prevents updating to a duplicate date (returns HTTP 409)
- Returns HTTP 404 if record not found
- Returns the updated document

#### DELETE /api/waste/:id (Delete)
- New endpoint to delete entries by ID
- Returns the deleted entry data
- Returns HTTP 404 if record not found

## Error Responses

### Duplicate Date (HTTP 409)
**POST /api/waste:**
```json
{
  "error": "Duplicate entry for date",
  "message": "A record with date \"2024-05-31\" already exists. Use PUT to update the existing record.",
  "field": "date",
  "value": "2024-05-31"
}
```

**POST /api/waste-upload:**
```json
{
  "error": "Duplicate dates found in upload",
  "message": "Some records have dates that already exist. Use PUT to update existing records.",
  "details": "<MongoDB error details>"
}
```

**PUT/PATCH on duplicate date:**
```json
{
  "error": "Duplicate date",
  "message": "A record with date \"2024-05-31\" already exists.",
  "field": "date",
  "value": "2024-05-31"
}
```

### Record Not Found (HTTP 404)
```json
{
  "error": "Record not found",
  "id": "<provided_id>"
}
```

## CRUD Operation Flow

```
CREATE      → POST   /api/waste              [201 or 409]
READ (List) → GET    /api/waste?year=YYYY   [200]
READ (One)  → GET    /api/waste/:id         [200 or 404]
UPDATE      → PUT    /api/waste/:id         [200, 404, or 409]
PATCH       → PATCH  /api/waste/:id         [200, 404, or 409]
DELETE      → DELETE /api/waste/:id         [200 or 404]
```

## Testing

A comprehensive test suite is provided in `test.js` that validates:
- Creating new entries
- Duplicate rejection on POST
- Duplicate rejection on bulk insert
- Successful updates with PUT
- Successful partial updates with PATCH
- Duplicate date rejection on updates
- Retrieval by ID
- Deletion of entries
- 404 handling for non-existent records

Run tests with:
```bash
node index.js &  # Start server in background
node test.js     # Run test suite
```

## Benefits

1. **Database-Level Enforcement** - Uniqueness is enforced at MongoDB level, preventing any application bypass
2. **Clear Error Messages** - Users get explicit feedback about conflicts with guidance on resolution
3. **Flexible Updates** - Use PUT for full replacement or PATCH for partial updates
4. **Complete CRUD** - Full Create, Read, Update, Delete functionality with proper HTTP status codes
5. **Backward Compatible** - Existing GET and existing POST behavior preserved for new entries
6. **Atomic Operations** - MongoDB ensures data consistency and integrity

## Migration Notes

If there are existing duplicate dates in the collection:
1. MongoDB will require the collection to be cleaned before the unique index is applied
2. Manual data consolidation may be needed
3. Use the PUT endpoint to merge duplicate entries into one record
