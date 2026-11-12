export class OrderRepository {
  save(id: string): void {
    // A raw write that the no-raw-sql rule is meant to catch.
    const sql = `INSERT INTO orders (id) VALUES ('${id}')`;
    void sql;
  }
}
