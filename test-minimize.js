const mimimizeGif = require('./mimimize-gif');

const dale = async () => {
    const buffer = await mimimizeGif({
        textMessage: 'No puedo acceder a ese mensaje',
        write_as_file: true,
        // gif: 10
    });
    console.log(buffer);
};

dale();
