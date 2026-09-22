BEGIN IMMEDIATE;

UPDATE growth_tasks
SET classification = 'essential'
WHERE task_key = 'encounter-community-event'
  AND classification = 'growth';

COMMIT;
