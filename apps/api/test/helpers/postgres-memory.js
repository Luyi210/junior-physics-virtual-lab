import { DataType, newDb } from "pg-mem";

/** SQL compatibility fixture only. This function does not emulate PostgreSQL's
 * advisory-lock serialization, transaction rollback, or concurrent startup. */
export function createMemoryPostgres({ allowRepeatedSchema = false } = {}) {
  // pg-mem rejects the unused column-constraint AST of CREATE TABLE IF NOT
  // EXISTS when that table already exists. Reopen tests explicitly opt out of
  // that coverage check; statements still execute, and this is not a PG proof.
  const memory = newDb({ noAstCoverageCheck: allowRepeatedSchema });
  // PostgreSQL's built-in length(text) is absent in pg-mem. Model its character
  // count (not JS UTF-16 units) for the feedback body CHECK constraint only.
  memory.public.registerFunction({
    name: "length", args: [DataType.text], returns: DataType.integer,
    implementation: (value) => [...value].length
  });
  memory.public.registerFunction({
    name: "pg_advisory_xact_lock",
    args: [DataType.integer, DataType.integer],
    returns: DataType.integer,
    impure: true,
    implementation: () => 0
  });
  const { Pool } = memory.adapters.createPg();
  return { memory, pool: new Pool() };
}
