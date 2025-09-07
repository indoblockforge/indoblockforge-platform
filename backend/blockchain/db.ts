import { SQLDatabase } from "encore.dev/storage/sqldb";

export const blockchainDB = new SQLDatabase("blockchain", {
  migrations: "./migrations",
});
