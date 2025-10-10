import Logger from "../Logger";

class PromisifiedSQLite {
    private sqlite3: any;
    private db: any;

    constructor(sqlite3: any) {
        this.sqlite3 = sqlite3;
        this.db = null;
    }

    public open(DBFilePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db = new this.sqlite3.Database(DBFilePath, err => {
                if (err) {
                    Logger.bgRed("Failed to open database: " + err.message);
                    reject(err);
                } else {
                    Logger.bgGreen("Opened database successfully, path: " + DBFilePath);
                    resolve();
                }
            });
        });
    }

    public loadExtension(extensionPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.loadExtension(extensionPath, err => {
                if (err) {
                    Logger.bgRed("Failed to load extension: " + err.message);
                    reject(err);
                }
                else {
                    Logger.bgGreen("Loaded extension successfully, path: " + extensionPath);
                    resolve();
                }
            })
        })
    }

    public exec(sql: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, err => {
                if (err) {
                    Logger.bgRed("Failed to execute SQL: " + err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    /**
     * 准备一个语句，返回一个Promise，resolve时返回一个语句对象，可以使用get、all、finalize等方法
     * @param sql
     * @returns Promise<sqlite3.Statement>
     */
    public prepare(sql: string): Promise<PromisifiedStatement> {
        return new Promise((resolve, reject) => {
            const statement = this.db.prepare(sql, err => {
                if (err) {
                    Logger.bgRed("Failed to prepare statement: " + err.message);
                    reject(err);
                } else {
                    const stmt = new PromisifiedStatement(statement);
                    resolve(stmt);
                }
            });
        });
    }

    public run(sql: string, params: any[] = []): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.run(sql, params, function (err) {
                if (err) {
                    Logger.bgRed("Failed to run SQL: " + err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public all(sql: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    Logger.bgRed("Failed to get all rows: " + err.message);
                    reject(err);
                } else {
                    resolve(rows);
                }
            });
        });
    }

    public each(sql: string, params: any[] = [], callback: (err: Error | null, row: any) => void): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.each(sql, params, callback, err => {
                if (err) {
                    Logger.bgRed("Failed to each rows: " + err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }

    public get(sql: string, params: any[] = []): Promise<any> {
        return new Promise((resolve, reject) => {
            this.db.get(sql, params, (err, row) => {
                if (err) {
                    Logger.bgRed("Failed to get row: " + err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    public close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.close(err => {
                if (err) {
                    Logger.bgRed("Failed to close database: " + err.message);
                    reject(err);
                } else {
                    Logger.bgGreen("Closed database successfully");
                    resolve();
                }
            });
        });
    }
}

class PromisifiedStatement {
    private statement: any;

    constructor(statement: any) {
        this.statement = statement;
    }

    public async get(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.statement.get((err, row) => {
                if (err) {
                    Logger.bgRed("Failed to get row: " + err.message);
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    public async finalize(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.statement.finalize(err => {
                if (err) {
                    Logger.bgRed("Failed to finalize statement: " + err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

export { PromisifiedSQLite, PromisifiedStatement };
