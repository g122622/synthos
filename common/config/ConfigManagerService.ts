import { readFile } from "fs/promises";
import { GlobalConfig } from "./@types/GlobalConfig";

class ConfigManagerService {
    private configPath: string = "config.json";

    constructor(configPath: string) {
        this.configPath = configPath;
    }

    public async getCurrentConfig(): Promise<GlobalConfig> {
        const configContent = await readFile(this.configPath, "utf8");
        return JSON.parse(configContent) as GlobalConfig;
    }
}

export default new ConfigManagerService("../../synthos_config.json");
