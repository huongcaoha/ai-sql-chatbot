export interface DatabaseAdapter {
  /**
   * Connect to the database and verify read-only access
   * Throws an error if the connection has write/delete privileges
   */
  connect(): Promise<void>;

  /**
   * Disconnect from the database
   */
  disconnect(): Promise<void>;

  /**
   * Get all table names from the database
   */
  getAllTableNames(): Promise<string[]>;

  /**
   * Extract the schema of the database as a string representation
   * Suitable for LLM context
   */
  getSchemaContext(allowedTables?: string[]): Promise<string>;

  /**
   * Execute a read-only query on the database
   * @param query The SQL/NoSQL query
   * @returns Array of results
   */
  executeQuery(query: string): Promise<any[]>;
}

export type DbConfig = {
  type: 'mysql' | 'postgres' | 'mongodb';
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  databaseName?: string;
  uri?: string; // For mongodb
  autoFilterTables?: boolean; // Nếu true, AI sẽ tự động phân tích và loại bỏ bảng nhạy cảm
  allowedTables?: string[]; // Danh sách các bảng cho phép truy cập (Chỉ dùng khi autoFilterTables = false)
};
