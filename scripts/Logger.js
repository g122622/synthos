class Logger {
    getTimeString() {
        return `[${new Date().toLocaleTimeString()}::${new Date().getMilliseconds()}] `;
    }

    blue(message) {
        console.log(`\x1b[34m${this.getTimeString() + message}\x1b[0m`);
    }

    green(message) {
        console.log(`\x1b[32m${this.getTimeString() + message}\x1b[0m`);
    }

    yellow(message) {
        console.log(`\x1b[33m${this.getTimeString() + message}\x1b[0m`);
    }

    red(message) {
        console.log(`\x1b[31m${this.getTimeString() + message}\x1b[0m`);
    }

    bgRed(message) {
        console.log(`\x1b[41m${this.getTimeString() + message}\x1b[0m`);
    }

    bgGreen(message) {
        console.log(`\x1b[42m${this.getTimeString() + message}\x1b[0m`);
    }

    bgYellow(message) {
        console.log(`\x1b[43m${this.getTimeString() + message}\x1b[0m`);
    }

    bgBlue(message) {
        console.log(`\x1b[44m${this.getTimeString() + message}\x1b[0m`);
    }

    info(message) {
        this.blue(message);
    }

    success(message) {
        this.green(message);
    }

    warning(message) {
        this.yellow(message);
    }

    error(message) {
        this.red(message);
    }
}

// cjs
module.exports = new Logger();
