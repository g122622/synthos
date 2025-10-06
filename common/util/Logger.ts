import { rainbow, pastel, atlas } from "gradient-string";

class Logger {
    private getTimeString() {
        return `[${new Date().toLocaleTimeString()}::${new Date().getMilliseconds()}] `;
    }

    public blue(message: string) {
        console.log(`\x1b[34m${this.getTimeString() + message}\x1b[0m`);
    }

    public green(message: string) {
        console.log(`\x1b[32m${this.getTimeString() + message}\x1b[0m`);
    }

    public yellow(message: string) {
        console.log(`\x1b[33m${this.getTimeString() + message}\x1b[0m`);
    }

    public red(message: string) {
        console.log(`\x1b[31m${this.getTimeString() + message}\x1b[0m`);
    }

    public bgRed(message: string) {
        console.log(`\x1b[41m${this.getTimeString() + message}\x1b[0m`);
    }

    public bgGreen(message: string) {
        console.log(`\x1b[42m${this.getTimeString() + message}\x1b[0m`);
    }

    public bgYellow(message: string) {
        console.log(`\x1b[43m${this.getTimeString() + message}\x1b[0m`);
    }

    public bgBlue(message: string) {
        console.log(`\x1b[44m${this.getTimeString() + message}\x1b[0m`);
    }

    public info(message: string) {
        this.blue(message);
    }

    public success(message: string) {
        this.green(message);
    }

    public warning(message: string) {
        this.yellow(message);
    }

    public error(message: string) {
        this.red(message);
    }

    public gradientWithPastel(message: string) {
        console.log(pastel(message));
    }

    public gradientWithAtlas(message: string) {
        console.log(atlas(message));
    }

    public gradientWithRainbow(message: string) {
        console.log(rainbow(message));
    }
}

export default new Logger();
