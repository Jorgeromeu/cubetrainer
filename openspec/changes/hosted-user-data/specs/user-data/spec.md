## REMOVED Requirements

### Requirement: Backups are manual
**Reason**: Copying SQLite files doesn't work for a hosted server and ties backups to the storage technology.
**Migration**: Use each tool's export, or the app's "Export everything" (see "Export and import"). Copying `data/*.sqlite` with the server stopped still works, but is no longer the documented way.

## ADDED Requirements

### Requirement: Offline outbox
Every client SHALL put each write in a persisted, ordered outbox before sending it, and remove it only once the server has answered. Writes SHALL be replayed in order when the server is reachable again. A refusal (4xx) SHALL drop that write and show its error, and a network failure SHALL keep it.

#### Scenario: Lost response
- **WHEN** a solve's PUT reaches the server but the answer is lost
- **THEN** the client replays it, the server returns the solve as already stored, and only one solve exists

#### Scenario: Refused on replay
- **WHEN** a queued note save is refused with 400 on replay
- **THEN** it leaves the outbox, its error is shown, and the writes queued after it are still sent

#### Scenario: App closed while offline
- **WHEN** the app is closed with writes in the outbox and opened later with the server up
- **THEN** the writes are sent

### Requirement: Only queueable writes
Every write endpoint SHALL be safe to repeat: a create or replace by client-made id (PUT), an update to stated values (PATCH), a delete by id (DELETE), or an import that skips what it already has. No endpoint SHALL create a new record each time it is called.

#### Scenario: Repeated delete
- **WHEN** `DELETE /api/pll/solves/<id>` is sent twice
- **THEN** both answer 200 with `null` and the solve stays deleted

### Requirement: Tombstones for deletes
Deleting a user record SHALL mark it deleted (with the time) instead of removing the row. Normal reads SHALL leave out deleted records. Tombstones SHALL be kept indefinitely and appear in the change feed and in exports.

#### Scenario: Deleted solve
- **WHEN** a PLL solve is deleted
- **THEN** `GET /api/pll/solves` no longer lists it, and the change feed reports it as deleted

#### Scenario: Re-saving a deleted id
- **WHEN** a PUT arrives for an id that has a tombstone
- **THEN** the record is restored with the new content

### Requirement: Change feed
Each tool that stores data SHALL answer `GET /api/<id>/changes?since=<cursor>` with every record changed or deleted after the cursor, oldest first, each with its type, id, current content (or `null` if deleted) and update time, plus a new cursor. With no `since`, it returns everything.

#### Scenario: Second device catches up
- **WHEN** the phone, last synced at cursor C, asks for `changes?since=C` after the laptop added a note and deleted a solve
- **THEN** the answer holds the note and the solve's tombstone, and a cursor that returns nothing new if asked again

### Requirement: Last write wins
The server SHALL apply writes in the order it receives them, with no merging or conflict errors: the last write to a record replaces it. Each record's `updatedAt` is the time the server applied the write.

#### Scenario: Two devices edit one note offline
- **WHEN** the laptop and phone both edit the same note offline and the phone reconnects last
- **THEN** the note holds the phone's text

### Requirement: Export and import
Each tool that stores data SHALL answer `GET /api/<id>/export` with `{ tool, formatVersion, exportedAt, data }`, tombstones included. `POST /api/<id>/import` SHALL upsert by id, keeping the newer `updatedAt`, so importing the same file twice changes nothing. A newer `formatVersion` than the server's SHALL be refused with 400.

#### Scenario: Round trip
- **WHEN** a tool's export is imported into an empty server
- **THEN** that tool's reads return the same data as on the original

#### Scenario: Export everything
- **WHEN** the user clicks "Export everything" in the web app
- **THEN** one JSON file downloads holding every tool's export, and importing it restores each tool

### Requirement: Synced preferences
Each tool MAY keep preferences that belong to the user rather than the device in one `prefs` record (`GET`/`PUT /api/<id>/prefs`), a JSON object validated against its contract. Clients SHALL cache it for offline use and write it through the outbox. Device-specific preferences SHALL stay on the device (see tool-shell).

#### Scenario: Selection follows the user
- **WHEN** the user narrows the PLL case selection on the laptop
- **THEN** the phone uses the same selection after its next sync

#### Scenario: Moving from browser storage
- **WHEN** a tool with synced preferences loads, the server has none yet and the browser holds old local values
- **THEN** the local values are saved to the server once and used from then on

<!-- REVIEW: which preferences are synced is per tool. Proposed: pll.selection; F2L savedFilters, linkKinds, focusMissing. Everything else stays per device. -->
