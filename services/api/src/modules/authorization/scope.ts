export const userScopeCte = `WITH RECURSIVE user_scope AS (
  SELECT id FROM users WHERE id=$1
  UNION ALL
  SELECT child.id FROM users child JOIN user_scope parent ON child.owner_id=parent.id
)`;

