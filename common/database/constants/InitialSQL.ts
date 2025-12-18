export const createIMDBTableSQL = `
                CREATE TABLE chat_messages (
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
                );`

export const createAGCTableSQL = `
                CREATE TABLE IF NOT EXISTS ai_digest_results (
                    topicId TEXT NOT NULL PRIMARY KEY,
                    sessionId TEXT,
                    topic TEXT,
                    contributors TEXT,
                    detail TEXT,
                    modelName TEXT,
                    updateTime INTEGER
                );`

export const createInterestScoreTableSQL = `
                CREATE TABLE IF NOT EXISTS interset_score_results (
                    topicId TEXT NOT NULL PRIMARY KEY,
                    scoreV1 REAL,
                    scoreV2 REAL,
                    scoreV3 REAL,
                    scoreV4 REAL,
                    scoreV5 REAL
                );`
