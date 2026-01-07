import Logger from "../Logger";
import { Disposable } from "../lifecycle/Disposable";

class PromisifiedSQLite extends Disposable {
    private sqlite3: any;
    private db: any;
    private LOGGER = Logger.withTag("PromisifiedSQLite");

    constructor(sqlite3: any) {
        super();

        this._registerDisposableFunction(() => this.close());

        this.sqlite3 = sqlite3;
        this.db = null;
    }

    public open(DBFilePath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db = new this.sqlite3.Database(DBFilePath, err => {
                if (err) {
                    this.LOGGER.error("Failed to open database: " + err.message);
                    this.LOGGER.warning("Database path: " + DBFilePath);
                    reject(err);
                } else {
                    this.LOGGER.success("Opened database successfully, path: " + DBFilePath);
                    resolve();
                }
            });
        });
    }

    public loadExtension(extensionPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.loadExtension(extensionPath, err => {
                if (err) {
                    this.LOGGER.error("Failed to load extension: " + err.message);
                    this.LOGGER.debug("Extension path: " + extensionPath);
                    reject(err);
                } else {
                    this.LOGGER.success("Loaded extension successfully, path: " + extensionPath);
                    resolve();
                }
            });
        });
    }

    public exec(sql: string): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.exec(sql, err => {
                if (err) {
                    this.LOGGER.error("Failed to execute SQL: " + err.message);
                    this.LOGGER.debug("SQL: " + sql);
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
                    this.LOGGER.error("Failed to prepare statement: " + err.message);
                    this.LOGGER.debug("SQL: " + sql);
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
            this.db.run(
                sql,
                params,
                (err => {
                    if (err) {
                        this.LOGGER.error("Failed to run SQL: " + err.message);
                        this.LOGGER.error("SQL: " + sql);
                        this.LOGGER.error("Params: " + JSON.stringify(params));
                        reject(err);
                    } else {
                        resolve();
                    }
                }).bind(this)
            );
        });
    }

    public all(sql: string, params: any[] = []): Promise<any[]> {
        return new Promise((resolve, reject) => {
            this.db.all(sql, params, (err, rows) => {
                if (err) {
                    this.LOGGER.error("Failed to get all rows: " + err.message);
                    this.LOGGER.debug("SQL: " + sql);
                    this.LOGGER.debug("Params: " + JSON.stringify(params));
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
                    this.LOGGER.error("Failed to each rows: " + err.message);
                    this.LOGGER.debug("SQL: " + sql);
                    this.LOGGER.debug("Params: " + JSON.stringify(params));
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
                    this.LOGGER.error("Failed to get row: " + err.message);
                    this.LOGGER.debug("SQL: " + sql);
                    this.LOGGER.debug("Params: " + JSON.stringify(params));
                    reject(err);
                } else {
                    resolve(row);
                }
            });
        });
    }

    private close(): Promise<void> {
        return new Promise((resolve, reject) => {
            this.db.close(err => {
                if (err) {
                    this.LOGGER.error("Failed to close database: " + err.message);
                    reject(err);
                } else {
                    this.LOGGER.success("Closed database successfully, path: " + this.db.filename);
                    resolve();
                }
            });
        });
    }
}

class PromisifiedStatement {
    private statement: any;
    private LOGGER = Logger.withTag("PromisifiedStatement");

    constructor(statement: any) {
        this.statement = statement;
    }

    public async get(): Promise<any> {
        return new Promise((resolve, reject) => {
            this.statement.get((err, row) => {
                if (err) {
                    this.LOGGER.error("Failed to get row: " + err.message);
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
                    this.LOGGER.error("Failed to finalize statement: " + err.message);
                    reject(err);
                } else {
                    resolve();
                }
            });
        });
    }
}

export { PromisifiedSQLite, PromisifiedStatement };
