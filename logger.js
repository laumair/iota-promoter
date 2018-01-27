const chalk = require('chalk');

const log = console.log;

module.exports = {
    info: message => log(chalk.cyan(message)),
    error: message => log(chalk.red(message)),
    warn: message => log(chalk.yellow(message)),
    success: message => log(chalk.green(message))
};
