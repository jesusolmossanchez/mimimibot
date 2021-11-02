const log4js = require('log4js');

const logger = log4js.getLogger();
logger.level = 'debug';
logger.levelPrints = 0;
logger.levelPrintsTimes = {};

logger.startDebug = (debugId, text) => {
    logger.levelPrints++;
    logger.levelPrintsTimes[logger.levelPrints] = performance.now();
    let guiones = '';
    for (let index = 0; index < logger.levelPrints - 1; index++) {
        guiones += '----';
    }
    logger.debug(`${debugId}: START ${guiones} ${text}`);
};

logger.endDebug = (debugId, text) => {
    let guiones = '';
    for (let index = 0; index < logger.levelPrints - 1; index++) {
        guiones += '----';
    }
    const timeTaken = performance.now() - logger.levelPrintsTimes[logger.levelPrints];
    logger.debug(`${debugId}: END   ${guiones} ${text} - Tiempo: ${timeTaken.toFixed(2)} ms`);
    logger.levelPrints--;
};

module.exports = logger;
