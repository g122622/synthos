import { NgrokClient } from "./NgrokClient";

(async () => {
    const ngrokClient = new NgrokClient();
    await ngrokClient.init();
})();
