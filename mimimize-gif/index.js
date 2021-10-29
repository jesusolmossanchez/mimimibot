const Jimp = require('jimp');
const { GifUtil, GifFrame, GifCodec } = require('gifwrap');
const gifFrames = require('gif-frames');
const log4js = require('log4js');

const logger = log4js.getLogger();
logger.level = 'debug';

const mimimizeText = (text) => {
    let mimimizedText = text || '';
    mimimizedText = mimimizedText.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    mimimizedText = mimimizedText.replace(/[aeiou]/ig, 'i');
    mimimizedText = mimimizedText.toUpperCase();
    return mimimizedText;
};

const loadFont = async () => {
    const urlFont = `${__dirname}/assets/impact.ttf.fnt`;
    const loadedFont = await Jimp.loadFont(urlFont);
    return loadedFont;
};

const mimimizeGif = async ({
    textMessage, writeAsFile, gif, debugId,
}) => {
    const printedDebugId = debugId || 'no-id';
    const startTime = performance.now();
    logger.debug(`${printedDebugId}: START - General (mimimizeGif)`);

    let mimimizedMessage = mimimizeText(textMessage);
    const font = await loadFont();

    const gitNumber = gif || Math.ceil(Math.random() * 10);
    const filePath = `${__dirname}/assets/small_mimimi${gitNumber}.gif`;

    // pillo la info de los frames
    logger.debug(`${printedDebugId}: START - gifFrames`);
    const originalFrameData = await gifFrames({ url: filePath, frames: 'all', cumulative: true });
    logger.debug(`${printedDebugId}: END - gifFrames`);

    let framesNumber = originalFrameData.length - 1;
    let frameData = originalFrameData;
    while (framesNumber < mimimizedMessage.length) {
        frameData = [...frameData, ...originalFrameData];
        framesNumber = frameData.length - 1;
    }

    const letterPerFrame = 1;
    let NoOflettersWritten = 0;
    const originalMessage = mimimizedMessage;

    logger.debug(`${printedDebugId}: START - generateImages`);
    const frames = [];
    for (let index = 0; index < frameData.length; index++) {
        const frame = frameData[index];
        // eslint-disable-next-line no-underscore-dangle
        const frameImage = frame.getImage()._obj;
        // eslint-disable-next-line no-await-in-loop
        const jimpObject = await Jimp.read(frameImage);

        NoOflettersWritten += letterPerFrame;
        mimimizedMessage = originalMessage.slice(0, NoOflettersWritten);

        // Imprimir texto
        jimpObject.print(
            font,
            0,
            0,
            {
                text: mimimizedMessage,
                alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
                alignmentY: Jimp.VERTICAL_ALIGN_BOTTOM,
            },
            jimpObject.bitmap.width - 5,
            jimpObject.bitmap.height - 5,
        );
        const optionsGifFrame = {
            disposalMethod: frame.disposal,
            delayCentisecs: frame.delay,
            isInterlaced: frame.interlaced,
        };
        const GifCopied = new GifFrame(jimpObject.bitmap, optionsGifFrame);
        GifUtil.quantizeSorokin(GifCopied);
        frames.push(GifCopied);
    }
    logger.debug(`${printedDebugId}: END - generateImages`);

    logger.debug(`${printedDebugId}: START - generateGif`);

    let result;
    if (writeAsFile) {
        const writePath = `${__dirname}/out/mimimi${+Date.now()}.gif`;
        // const gif = await GifUtil.write(writePath, frames, { loops: 0 });
        await GifUtil.write(writePath, frames, { loops: 0 });
        result = writePath;
    } else {
        const codec = new GifCodec();
        const encodedGIF = await codec.encodeGif(frames, { loops: 0 });
        result = encodedGIF.buffer;
    }
    logger.debug(`${printedDebugId}: END - generateGif`);
    const endTime = performance.now();
    logger.debug(`${printedDebugId}: END - general - Tiempo total: ${(endTime - startTime).toFixed(2)} ms`);
    return Promise.resolve(result);
};

module.exports = mimimizeGif;
