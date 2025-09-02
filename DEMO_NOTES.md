# Demo Notes for Sprint 2 Testing

## Sample Notes to Test Wikilink Functionality

Create these sample notes in your vault to test the Sprint 2 features:

### 1. Main Note.md
```markdown
# Main Note

This is the main note that references other notes.

## Related Topics

See [[Project Planning]] for more details on our workflow.
Check out [[Technical Architecture|our tech stack]] for implementation details.
The [[Sprint 2]] implementation is now complete!

## Links to Test

- [[Non-existent Note]] - This will create a broken link
- [[Project Planning|Planning]] - Alias example
- Multiple references to [[Technical Architecture]] should be counted
```

### 2. Project Planning.md
```markdown
# Project Planning

This note contains our project planning information.

## Sprint Overview

We're currently working on [[Sprint 2]] which includes:
- Wikilink parsing
- SQLite indexing
- Backlinks panel

References back to [[Main Note]] for context.
```

### 3. Technical Architecture.md
```markdown
# Technical Architecture

## Stack

- **Frontend**: React + TypeScript + Vite
- **Backend**: Python + FastAPI
- **Database**: SQLite
- **Editor**: CodeMirror 6

## Implementation Notes

The [[Main Note]] provides an overview of the system.
See [[Sprint 2]] for current implementation status.
```

### 4. Sprint 2.md
```markdown
# Sprint 2 - Wikilinks and Indexing

## Goals

- [x] Implement remark wikilink plugin
- [x] Create SQLite schema
- [x] Build backlinks panel
- [x] Integrate with editor

## Related

- [[Main Note]] - Overview
- [[Technical Architecture]] - Implementation details
- [[Project Planning]] - Project context

## Testing

Create wikilinks like [[Test Note]] to verify functionality.
```

## Testing Instructions

1. **Create Vault**: Create a new vault or open existing one
2. **Add Notes**: Create the above notes in your vault
3. **Save Files**: Make sure to save each file to trigger indexing
4. **Start Python Backend**: Run `python3 -m uvicorn server:app --reload` in the python directory
5. **Test Features**:
   - Open any note and check the backlinks panel
   - Verify wikilinks are detected and stored
   - Click backlinks to navigate between notes
   - Check database content with `python3 db_init.py info`

## Expected Results

- **Backlinks Panel**: Should show all notes linking to the current note
- **Database**: Should contain entries in notes, headings, links, and chunks tables
- **Navigation**: Clicking backlinks should open the corresponding notes
- **Metadata**: Word counts, timestamps, and headings should be displayed correctly

## Database Verification

After creating and saving the notes, check the database:

```bash
cd python
python3 db_init.py info
```

You should see:
- 4 notes in the notes table
- Multiple headings indexed
- 8+ links between notes
- Text chunks created for each note
