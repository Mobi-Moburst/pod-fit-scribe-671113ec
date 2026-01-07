-- Fix Santosh Kaveti's target_audiences by removing the incorrectly added talking points
UPDATE speakers 
SET target_audiences = ARRAY[
  'Critical Infrastructure Leaders',
  'Enterprise AI & Security Experts',
  'Microsoft Ecosystem Partners',
  'C-Suite & Senior Executives'
]
WHERE id = '0a656bf3-1af1-48d9-a656-4ca0e26695f8';