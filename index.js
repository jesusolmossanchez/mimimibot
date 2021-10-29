const fs = require('fs');
const { auth } = require('./config');
const mimimizeGif = require('./mimimize-gif');

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
                console.log(error);
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
                console.log(error);
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
            console.log(error);
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

client.stream('statuses/filter', { track: '@mimimmiBot' }, (stream) => {
    console.log('Buscando tweets...');

    stream.on('error', (error) => {
        console.error('[ERROR]', error);
    });

    stream.on('data', async (tweet) => {
        console.log('Tweet recibido de:', tweet.user.screen_name);
        console.log('Tweet:', tweet.text);
        if (tweet.user.screen_name === 'mimimmiBot') {
            console.log('Es una respuesta, no entres en bucle!');
        } else if (tweet.retweeted_status) {
            console.log('Es un retweet, no hagas nada!');
        } else {
            console.time(`${tweet.id_str}: total`);
            try {
                if (tweet.in_reply_to_status_id_str) {
                    const response = await client.get(`statuses/show/${tweet.in_reply_to_status_id_str}`, {});

                    console.time(`${tweet.id_str}: mimimizeGif`);
                    const gifPath = await mimimizeGif({
                        textMessage: response.text,
                        writeAsFile: true,
                        debugId: tweet.id_str,
                    });
                    console.timeEnd(`${tweet.id_str}: mimimizeGif`);

                    console.time(`${tweet.id_str}: postReplyWithMedia`);
                    await postReplyWithMedia(gifPath, `@${tweet.user.screen_name} @${response.user.screen_name}`, response);
                    console.timeEnd(`${tweet.id_str}: postReplyWithMedia`);

                    fs.unlinkSync(gifPath);
                } else {
                    console.time(`${tweet.id_str}: postReplyWithMediaNocitado`);
                    const gifPathNoMessage = `./mimimize-gif/assets/no_texto${Math.ceil(Math.random() * 10)}.gif`;
                    postReplyWithMedia(gifPathNoMessage, `@${tweet.user.screen_name} No estás citando ningún mensaje`, tweet);
                    console.timeEnd(`${tweet.id_str}: postReplyWithMediaNocitado`);
                }
            } catch (error) {
                console.error('[ERROR]', error);
                if (Array.isArray(error) && error[0].code === 179) {
                    try {
                        console.time(`${tweet.id_str}: postReplyWithMediaNocitado`);
                        const gifPathNoMessage = `./mimimize-gif/assets/no_acceso${Math.ceil(Math.random() * 10)}.gif`;
                        postReplyWithMedia(gifPathNoMessage, `@${tweet.user.screen_name} No puedo acceder a ese mensaje`, tweet);
                        console.timeEnd(`${tweet.id_str}: postReplyWithMediaNocitado`);
                    } catch (error2) {
                        console.error('[ERROR]', error2);
                    }
                }
            }
            console.timeEnd(`${tweet.id_str}: total`);
            console.log('----');
        }
    });
});