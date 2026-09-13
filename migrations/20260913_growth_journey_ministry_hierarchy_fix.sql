BEGIN IMMEDIATE;

UPDATE growth_ministry_units
SET
    name = 'Instrumentalists',
    unit_type = 'committee',
    parent_unit_id = (
        SELECT id
        FROM growth_ministry_units
        WHERE name = 'Seraphs'
          AND parent_unit_id IS NULL
        ORDER BY id
        LIMIT 1
    ),
    updated_at = CURRENT_TIMESTAMP
WHERE legacy_ministry_id = (
    SELECT id
    FROM ministries
    WHERE name = 'Seraphs - Instrumentalists'
    ORDER BY id
    LIMIT 1
)
AND EXISTS (
    SELECT 1
    FROM growth_ministry_units
    WHERE name = 'Seraphs'
      AND parent_unit_id IS NULL
);

COMMIT;
