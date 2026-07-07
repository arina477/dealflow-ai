10. A migration that UPDATEs or DELETEs rows on a trigger-protected table must be tested on a pre-seeded populated DB.
   Why: An empty-DB migration test cannot exercise triggers that fire only when rows already exist.
