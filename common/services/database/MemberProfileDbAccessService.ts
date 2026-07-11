import "reflect-metadata";
import { injectable, container } from "tsyringe";

import Logger from "../../util/Logger";
import { MemberProfile } from "../../contracts/member-profile/index";
import { Disposable } from "../../util/lifecycle/Disposable";
import { mustInitBeforeUse } from "../../util/lifecycle/mustInitBeforeUse";
import { COMMON_TOKENS } from "../../di/tokens";

import { CommonDBService } from "./infra/CommonDBService";
import { createMemberProfileTableSQL } from "./constants/InitialSQL";

/**
 * 群友个人画像数据库访问服务
 * 负责画像的存储（落库复用）与查询（缓存命中）
 */
@injectable()
@mustInitBeforeUse
export class MemberProfileDbAccessService extends Disposable {
    private LOGGER = Logger.withTag("MemberProfileDbAccessService");
    private db: CommonDBService | null = null;

    /**
     * 初始化数据库服务
     */
    public async init() {
        // 从 DI 容器获取 CommonDBService 实例
        this.db = container.resolve<CommonDBService>(COMMON_TOKENS.CommonDBService);
        await this.db.init(createMemberProfileTableSQL);
    }

    /**
     * 根据 QQ号 查询缓存画像
     * @param senderId 群友 QQ号
     * @returns 命中的画像记录，未命中返回 null
     */
    public async getMemberProfileBySenderId(senderId: string): Promise<MemberProfile | null> {
        const record = await this.db.get<MemberProfile>(`SELECT * FROM member_profiles WHERE senderId = ?`, [
            senderId
        ]);

        return record ?? null;
    }

    /**
     * 落库画像（upsert，重新生成时覆盖旧画像）
     * @param profile 画像记录
     */
    public async storeMemberProfile(profile: MemberProfile): Promise<void> {
        await this.db.run(
            `INSERT INTO member_profiles (senderId, nickname, profileJson, modelName, topicCount, createdAt, updatedAt)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(senderId) DO UPDATE SET
                nickname = excluded.nickname,
                profileJson = excluded.profileJson,
                modelName = excluded.modelName,
                topicCount = excluded.topicCount,
                updatedAt = excluded.updatedAt
            `,
            [
                profile.senderId,
                profile.nickname,
                profile.profileJson,
                profile.modelName,
                profile.topicCount,
                profile.createdAt,
                profile.updatedAt
            ]
        );
    }
}
