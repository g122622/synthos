export const createIMDBTableSQL = `
                CREATE TABLE IF NOT EXISTS chat_messages (
                    msgId TEXT NOT NULL PRIMARY KEY,
                    messageContent TEXT,
                    groupId TEXT,
                    timestamp INTEGER,
                    senderId TEXT,
                    senderGroupNickname TEXT,
                    senderNickname TEXT,
                    quotedMsgId TEXT,
                    quotedMsgContent TEXT,
                    sessionId TEXT,
                    preProcessedContent TEXT
                );`;

export const createAGCTableSQL = `
                CREATE TABLE IF NOT EXISTS ai_digest_results (
                    topicId TEXT NOT NULL PRIMARY KEY,
                    sessionId TEXT,
                    topic TEXT,
                    contributors TEXT,
                    detail TEXT,
                    modelName TEXT,
                    updateTime INTEGER
                );`;

export const createInterestScoreTableSQL = `
                CREATE TABLE IF NOT EXISTS interset_score_results (
                    topicId TEXT NOT NULL PRIMARY KEY,
                    scoreV1 REAL,
                    scoreV2 REAL,
                    scoreV3 REAL,
                    scoreV4 REAL,
                    scoreV5 REAL
                );`;

export const createReportTableSQL = `
                CREATE TABLE IF NOT EXISTS reports (
                    reportId TEXT NOT NULL PRIMARY KEY,
                    type TEXT NOT NULL,
                    timeStart INTEGER NOT NULL,
                    timeEnd INTEGER NOT NULL,
                    isEmpty INTEGER NOT NULL DEFAULT 0,
                    summary TEXT,
                    summaryGeneratedAt INTEGER,
                    summaryStatus TEXT NOT NULL DEFAULT 'pending',
                    model TEXT,
                    statisticsJson TEXT,
                    topicIdsJson TEXT,
                    createdAt INTEGER NOT NULL,
                    updatedAt INTEGER NOT NULL
                );
                CREATE INDEX IF NOT EXISTS idx_reports_type ON reports(type);
                CREATE INDEX IF NOT EXISTS idx_reports_timeStart ON reports(timeStart);
                CREATE INDEX IF NOT EXISTS idx_reports_timeEnd ON reports(timeEnd);`;
