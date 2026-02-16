ALTER TABLE "items" ADD COLUMN IF NOT EXISTS "organizationId" text;

-- Ensure owners with legacy items have an organization container.
WITH missing_org_users AS (
    SELECT DISTINCT i."userId"
    FROM "items" i
    LEFT JOIN "organizations" o ON o."userId" = i."userId"
    WHERE i."organizationId" IS NULL
      AND o."id" IS NULL
)
INSERT INTO "organizations" (
    "id",
    "userId",
    "name",
    "code",
    "gstNumber",
    "address",
    "phoneNumber",
    "email",
    "currency",
    "isActive",
    "createdAt",
    "updatedAt"
)
SELECT
    'org_' || substring(md5(m."userId" || '_default_store'), 1, 20) AS "id",
    m."userId",
    COALESCE(NULLIF(trim(u."businessName"), ''), 'Default Store') AS "name",
    upper('AUTO' || substring(md5(m."userId"), 1, 4)) AS "code",
    NULL,
    NULL,
    u."phoneNumber",
    u."email",
    COALESCE(u."currency", 'INR') AS "currency",
    true,
    now(),
    now()
FROM missing_org_users m
LEFT JOIN "users" u ON u."uid" = m."userId"
ON CONFLICT ("id") DO NOTHING;

-- Ensure owner membership exists for each organization.
INSERT INTO "organization_members" (
    "id",
    "userId",
    "organizationId",
    "role",
    "permissions",
    "isActive",
    "invitedBy",
    "phoneNumberSnapshot",
    "joinedAt",
    "createdAt",
    "updatedAt"
)
SELECT
    'mem_' || substring(md5(o."id" || '_owner'), 1, 20) AS "id",
    o."userId",
    o."id",
    'owner',
    '{}'::jsonb,
    true,
    o."userId",
    u."phoneNumber",
    now(),
    now(),
    now()
FROM "organizations" o
LEFT JOIN "organization_members" om
    ON om."organizationId" = o."id"
   AND om."userId" = o."userId"
   AND om."role" = 'owner'
LEFT JOIN "users" u ON u."uid" = o."userId"
WHERE om."id" IS NULL;

-- Ensure a settings document exists for each organization.
INSERT INTO "organization_settings" (
    "organizationId",
    "userId",
    "settings",
    "createdAt",
    "updatedAt"
)
SELECT
    o."id",
    o."userId",
    '{}'::jsonb,
    now(),
    now()
FROM "organizations" o
LEFT JOIN "organization_settings" s ON s."organizationId" = o."id"
WHERE s."organizationId" IS NULL;

-- Backfill organization ownership on existing stock records.
WITH default_org AS (
    SELECT DISTINCT ON (o."userId")
        o."userId",
        o."id" AS "organizationId"
    FROM "organizations" o
    ORDER BY o."userId", o."createdAt" ASC, o."id" ASC
)
UPDATE "items" i
SET "organizationId" = d."organizationId"
FROM default_org d
WHERE i."organizationId" IS NULL
  AND i."userId" = d."userId";

ALTER TABLE "items" ALTER COLUMN "organizationId" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "items_org_idx" ON "items" ("organizationId");
CREATE INDEX IF NOT EXISTS "items_org_branch_idx" ON "items" ("organizationId", "branchId");
