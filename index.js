const config = require('./config');
const { Promoter } = require('./promoter');
const { getProvider, setupFiles, getExistingData } = require('./helpers');

const initialize = () => {
    if (process.argv.length < 3) {
        throw new Error('Argument missing. Run "--all" to start promoting all bundles. "--f" to start previously failed bundles.');
    }

    const arg = process.argv[2];

    if (arg === '--all') {
        return processList(true);
    } else if (arg === '--f') {
        return processList(false);
    }

    throw new Error('Invalid argument provided.');
};


const getPromotionArgs = () => {
    return new Promise((resolve, reject) => {
        const result = {
            bundles: [],
            failed: [],
            confirmed: []
        };

        getExistingData(config.UNCONFIMED_BUNDLES_PATH)
            .then(bundles => {
                result.bundles = bundles.filter(bundle => bundle);

                return getExistingData(config.FAILED_REATTACHS_PATH);
            }).then(failed => {
            result.failed = failed.filter(item => item);

            return getExistingData(config.CONFIRMED_PATH);
        }).then(confirmed => {
            result.confirmed = confirmed.filter(item => item);
            resolve(result);
        }).catch(err => reject(err));
    });
};

const processList = promoteAll => {
    setupFiles([
        config.FAILED_REATTACHS_PATH,
        config.CONFIRMED_PATH
    ], () => getPromotionArgs()
        .then(({ bundles, failed, confirmed }) => {
            const node = getProvider(config.NODES);

            const promoter = new Promoter(
                node,
                bundles,
                failed.length ? failed : null,
                confirmed.length ? confirmed : null,
                promoteAll
            );

            return promoter.initialize();
        }).catch(err => {
            throw new Error(err);
        }));
};

initialize();
