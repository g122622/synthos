export class QQProvider implements IProvider {
    public async getProfile(profileID: string): Promise<Profile> {
        throw new Error("Method not implemented.");
    }
}
