import { config } from "dotenv";

/** The test database sits next to the dev one: …/advent → …/advent_test. */
export function testDatabaseUrl() {
  config({ quiet: true });
  const devUrl = process.env.DATABASE_URL ?? "postgres://crm:crm@localhost:5433/advent";
  return devUrl.endsWith("_test") ? devUrl : devUrl.replace(/\/([^/?]+)(\?|$)/, "/$1_test$2");
}
