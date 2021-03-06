const fs = require('fs');
const { auth } = require('./config');
const mimimizeGif = require('./mimimize-gif');
const logger = require('./utils/logger');

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

const isResponseToBot = (tweet) => {
    // Si es una respuesta directa, no hacer nada
    if (tweet.user.screen_name === 'mimimiGifBot'
            && tweet.entities.media
            && tweet.entities.media.length) {
        return true;
    }
    // Si no tiene menciones, no es respuesta
    if (!tweet.entities || !tweet.entities.user_mentions || !tweet.entities.user_mentions.length) {
        return false;
    }
    // Si dentro de las menciones, una eso a mimimiGifBot, si es una respuesta al bot
    if (tweet.entities.user_mentions.find((user) => user.screen_name === 'mimimiGifBot')) {
        return true;
    }
    return false;
};

const setFinalText = (text) => {
    let finalText = text.replace(/(@\S+)/gi, '').trim(); // quito menciones
    finalText = finalText.replace(/(http:\/\/\S+)/gi, '').trim(); // quito enlaces http
    finalText = finalText.replace(/(https:\/\/\S+)/gi, '').trim(); // quito enlace https
    if (finalText.length > 80) {
        finalText = finalText.substring(0, 80);
        finalText += '...';
    }
    return finalText;
};

client.stream('statuses/filter', { track: '@mimimiGifBot' }, (stream) => {
    logger.debug('Buscando tweets...');

    stream.on('error', (error) => {
        logger.error('[ERROR]', error);
    });

    stream.on('data', async (tweet) => {
        logger.debug('Tweet recibido de:', tweet.user.screen_name);
        logger.startDebug(tweet.id_str, 'General (Procesa tweet)');
        if (tweet.user.screen_name === 'mimimiGifBot') {
            logger.debug(`${tweet.id_str}: Es una respuesta, no entres en bucle!`);
        } else if (tweet.retweeted_status) {
            logger.debug(`${tweet.id_str}: Es un retweet, no hagas nada!`);
        } else {
            try {
                if (tweet.in_reply_to_status_id_str) {
                    const response = await client.get(`statuses/show/${tweet.in_reply_to_status_id_str}`, { tweet_mode: 'extended' });
                    if (isResponseToBot(response)) {
                        logger.debug(`${tweet.id_str}: Es una respuesta a mi mismo, no hagas nada!`);
                    } else {
                        logger.debug('Tweet:', response.full_text);
                        const finalText = setFinalText(response.full_text);

                        if (finalText.length) {
                            logger.debug('finalText:', finalText);
                            logger.startDebug(tweet.id_str, 'mimimizeGif');
                            const gifPath = await mimimizeGif({
                                textMessage: finalText,
                                writeAsFile: true,
                                debugId: tweet.id_str,
                            });
                            logger.endDebug(tweet.id_str, 'mimimizeGif');

                            logger.startDebug(tweet.id_str, 'postReplyWithMedia');
                            await postReplyWithMedia(gifPath, `@${tweet.user.screen_name} @${response.user.screen_name}`, response);
                            logger.endDebug(tweet.id_str, 'postReplyWithMedia');

                            fs.unlinkSync(gifPath);
                        } else {
                            logger.startDebug(tweet.id_str, 'postReplyWithMediaNocitado');
                            const gifPathNoMessage = `./mimimize-gif/assets/no_texto${Math.ceil(Math.random() * 10)}.gif`;
                            await postReplyWithMedia(gifPathNoMessage, `@${tweet.user.screen_name} No est??s citando ning??n mensaje con texto`, tweet);
                            logger.endDebug(tweet.id_str, 'postReplyWithMediaNocitado');
                        }
                    }
                } else {
                    logger.debug('Tweet:', tweet.text);
                    const finalText = setFinalText(tweet.text);
                    if (finalText.length) {
                        logger.debug('finalText:', finalText);
                        logger.startDebug(tweet.id_str, 'mimimizeGif');
                        const gifPath = await mimimizeGif({
                            textMessage: finalText,
                            writeAsFile: true,
                            debugId: tweet.id_str,
                        });
                        logger.endDebug(tweet.id_str, 'mimimizeGif');

                        logger.startDebug(tweet.id_str, 'postReplyWithMedia');
                        await postReplyWithMedia(gifPath, `@${tweet.user.screen_name} @${tweet.user.screen_name}`, tweet);
                        logger.endDebug(tweet.id_str, 'postReplyWithMedia');

                        fs.unlinkSync(gifPath);
                    } else {
                        logger.startDebug(tweet.id_str, 'postReplyWithMediaNocitado');
                        const gifPathNoMessage = `./mimimize-gif/assets/no_texto${Math.ceil(Math.random() * 10)}.gif`;
                        await postReplyWithMedia(gifPathNoMessage, `@${tweet.user.screen_name} No est??s citando ning??n mensaje con texto`, tweet);
                        logger.endDebug(tweet.id_str, 'postReplyWithMediaNocitado');
                    }
                }
            } catch (error) {
                logger.error('[ERROR]', error);
                if (Array.isArray(error) && error[0].code === 179) {
                    try {
                        logger.startDebug(tweet.id_str, 'postReplyWithMediaNocitado');
                        const gifPathNoMessage = `./mimimize-gif/assets/no_acceso${Math.ceil(Math.random() * 10)}.gif`;
                        await postReplyWithMedia(gifPathNoMessage, `@${tweet.user.screen_name} No puedo acceder a ese mensaje`, tweet);
                        logger.endDebug(tweet.id_str, 'postReplyWithMediaNocitado');
                    } catch (error2) {
                        logger.error('[ERROR]', error2);
                    }
                }
            }
        }
        logger.endDebug(tweet.id_str, 'General (Procesa tweet)');
        logger.debug('-----------------------------------------');
    });
});
