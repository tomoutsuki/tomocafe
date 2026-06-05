const mongoose = require('mongoose');

mongoose.set('bufferCommands', false);

function isSrvLookupError(error) {
    const message = error?.message || '';
    const hostname = error?.hostname || '';

    return (
        error?.syscall === 'querySrv'
        || /querySrv/i.test(message)
        || /_mongodb\._tcp\./i.test(hostname)
        || /_mongodb\._tcp\./i.test(message)
    );
}

function buildSrvHelpMessage() {
    return [
        'MongoDB SRV lookup failed before Atlas could be reached.',
        'This is usually a local DNS issue, not a database-name issue.',
        'If local development cannot resolve mongodb+srv://, add MONGO_DIRECT_URI using the Atlas "standard connection string" and restart.'
    ].join(' ');
}

async function connectToMongo() {
    const primaryUri = process.env.MONGO_URI;
    const fallbackUri = process.env.MONGO_DIRECT_URI;
    const connectionOptions = {
        serverSelectionTimeoutMS: 10000
    };

    try {
        await mongoose.connect(primaryUri, connectionOptions);
        return {
            connectionSource: 'MONGO_URI',
            usedFallback: false
        };
    } catch (error) {
        if (fallbackUri && typeof primaryUri === 'string' && primaryUri.startsWith('mongodb+srv://') && isSrvLookupError(error)) {
            console.warn('MongoDB SRV lookup failed for MONGO_URI. Retrying with MONGO_DIRECT_URI.');
            await mongoose.connect(fallbackUri, connectionOptions);
            return {
                connectionSource: 'MONGO_DIRECT_URI',
                usedFallback: true
            };
        }

        if (isSrvLookupError(error)) {
            error.message = `${error.message} ${buildSrvHelpMessage()}`;
        }

        throw error;
    }
}

module.exports = {
    connectToMongo,
    mongoose
};
