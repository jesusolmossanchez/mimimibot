const mimimizeGif = require('./mimimize-gif');

const dale = async () => {
    const buffer = await mimimizeGif({
        textMessage: 'No puedo acceder a ese mensaje',
        writeAsFile: true,
        // gif: 10
    });
    console.log(buffer);
};

dale();
