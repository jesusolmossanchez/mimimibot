const fs = require('fs');
const log4js = require('log4js');
const { auth } = require('./config');
const mimimizeGif = require('./mimimize-gif');

const logger = log4js.getLogger();
logger.level = 'debug';

const client = auth();

const initMediaUpload = async (pathToFile) => {
    const mediaType = 'image/gif';
    const mediaSize = fs.statSync(pathToFile).size;
    return new Promise((resolve, reject) => {
        client.post('media/upload', {
            command: 'INIT',
            total_bytes: mediaSize,
            media_type: mediaType,
        }, (error, data) => {
            if (error) {
                logger.error(error);
                reject(error);
            } else {
                resolve(data.media_id_string);
            }
        });
    });
};

const appendMedia = async (mediaId, pathToFile) => {
    const mediaData = fs.readFileSync(pathToFile);
    return new Promise((resolve, reject) => {
        client.post('media/upload', {
            command: 'APPEND',
            media_id: mediaId,
            media: mediaData,
            segment_index: 0,
        }, (error) => {
            if (error) {
                logger.error(error);
                reject(error);
            } else {
                resolve(mediaId);
            }
        });
    });
};

const finalizeMediaUpload = async (mediaId) => new Promise((resolve, reject) => {
    client.post('media/upload', {
        command: 'FINALIZE',
        media_id: mediaId,
    }, (error) => {
        if (error) {
            logger.error(error);
            reject(error);
        } else {
            resolve(mediaId);
        }
    });
});

const postReplyWithMedia = async (mediaFilePath, textMessage, replyTweet) => {
    try {
        let mediaId = await initMediaUpload(mediaFilePath);
        mediaId = await appendMedia(mediaId, mediaFilePath);
        mediaId = await finalizeMediaUpload(mediaId);
        const statusObj = {
            status: textMessage,
            in_reply_to_status_id: replyTweet.id_str,
            media_ids: mediaId,
        };
        await client.post('statuses/update', statusObj);
        return Promise.resolve();
    } catch (error) {
        return Promise.reject(error);
    }
};

client.stream('statuses/filter', { track: '@mimimiGifBot' }, (stream) => {
    logger.debug('Buscando tweets...');

    stream.on('error', (error) => {
        logger.error('[ERROR]', error);
    });

    stream.on('data', async (tweet) => {
        logger.debug('Tweet recibido de:', tweet.user.screen_name);
        logger.debug('Tweet:', tweet.text);
        const startTime = performance.now();
        logger.debug(`${tweet.id_str}: START General (Procesa tweet)`);

        if (tweet.user.screen_name === 'mimimiGifBot') {
            logger.debug('Es una respuesta, no entres en bucle!');
        } else if (tweet.retweeted_status) {
            logger.debug('Es un retweet, no hagas nada!');
        } else {
            try {
                if (tweet.in_reply_to_status_id_str) {
                    const response = await client.get(`statuses/show/${tweet.in_reply_to_status_id_str}`, {});

                    logger.debug(`${tweet.id_str}: START mimimizeGif`);
                    const gifPath = await mimimizeGif({
                        textMessage: response.text,
                        writeAsFile: true,
                        debugId: tweet.id_str,
                    });
                    logger.debug(`${tweet.id_str}: END mimimizeGif`);

                    logger.debug(`${tweet.id_str}: START postReplyWithMedia`);
                    await postReplyWithMedia(gifPath, `@${tweet.user.screen_name} @${response.user.screen_name}`, response);
                    logger.debug(`${tweet.id_str}: END postReplyWithMedia`);

                    fs.unlinkSync(gifPath);
                } else {
                    logger.debug(`${tweet.id_str}: START postReplyWithMediaNocitado`);
                    const gifPathNoMessage = `./mimimize-gif/assets/no_texto${Math.ceil(Math.random() * 10)}.gif`;
                    postReplyWithMedia(gifPathNoMessage, `@${tweet.user.screen_name} No estás citando ningún mensaje`, tweet);
                    logger.debug(`${tweet.id_str}: END postReplyWithMediaNocitado`);
                }
            } catch (error) {
                logger.error('[ERROR]', error);
                if (Array.isArray(error) && error[0].code === 179) {
                    try {
                        logger.debug(`${tweet.id_str}: START postReplyWithMediaNocitado`);
                        const gifPathNoMessage = `./mimimize-gif/assets/no_acceso${Math.ceil(Math.random() * 10)}.gif`;
                        postReplyWithMedia(gifPathNoMessage, `@${tweet.user.screen_name} No puedo acceder a ese mensaje`, tweet);
                        logger.debug(`${tweet.id_str}: END postReplyWithMediaNocitado`);
                    } catch (error2) {
                        logger.error('[ERROR]', error2);
                    }
                }
            }
        }
        const endTime = performance.now();
        logger.debug(`${tweet.id_str}: END - General (Procesa tweet) - Tiempo total: ${(endTime - startTime).toFixed(2)} ms`);
        logger.debug('-----------------');
    });
});
