# Sahand ERP — TypeScript error correction patch

This is a targeted overlay patch for the 13 TypeScript errors reported after the
previous security phase.

## Replace files
Copy the contents of this ZIP into the project root and overwrite matching files.

Files:
- modules/permissions/access-control.ts
- modules/permissions/page-access.ts
- modules/auth/api-error-response.ts
- app/api/items/route.ts
- app/api/items/[id]/route.ts

## What this corrects
- Restores assignment-aware permission types (`assignmentId`, `activeAssignmentId`)
  to match the current `auth.middleware.ts`.
- Restores `authExceptionResponse` expected by recruitment APIs.
- Adds `requireModulePageAccess` while preserving `requirePagePermission`.
- Restores item API calls with the required `AuditContext` and actor ID.
- Keeps same-origin validation and global permission checks for item writes.

## Run
No migration and no seed rerun are required for this patch. Run only:

```powershell
npx tsc --noEmit
```

If TypeScript still reports an error, send the complete new output. Do not rerun
Prisma seed for TypeScript-only changes.
