const Apify = require('apify');
const { backOff } = require('exponential-backoff');
const safeEval = require('safe-eval');

exports.handleRequestError = (e, action) => {
    console.log(`${action} failed with error: ${e.message}`);
    console.dir(e);
    throw new Error('Fail in the crucial request');
};

exports.retryingRequest = async (request) => {
    return backOff(
        {
            fn: () => request,
            retry: (e, numberOfAttempts) => {
                console.log(`retrying API call to google with atempt n. ${numberOfAttempts}`);
                return e.message.includes('The service is currently unavailable');
            },
        },
        {
            numberOfAttempts: 6,
            timeMultiple: 3,
        },
    );
};

exports.countCells = (rows) => {
    if (!rows) return 0;
    if (!rows[0]) return 0;
    return rows[0].length * rows.length;
};

exports.trimSheetRequest = (height, width, sheetId) => {
    const payload = {
        requests: [],
    };
    if (height) {
        payload.requests.push({
            deleteDimension: {
                range: {
                    sheetId,
                    dimension: 'ROWS',
                    startIndex: height,
                },
            },
        });
    }
    if (width) {
        payload.requests.push({
            deleteDimension: {
                range: {
                    sheetId,
                    dimension: 'COLUMNS',
                    startIndex: width,
                },
            },
        });
    }
    return payload;
};

module.exports.saveBackup = async (createBackup, values) => {
    if (createBackup) {
        if (values) {
            console.log('Saving backup...');
            await Apify.setValue('backup', values);
        } else {
            console.log('There are currently no rows in the spreadsheet so we will not save backup...');
        }
    }
};

module.exports.evalFunction = (transformFunction) => {
    let parsedTransformFunction;
    if (transformFunction) {
        try {
            parsedTransformFunction = safeEval(transformFunction); // eslint-disable-line
        } catch (e) {
            throw new Error('Evaluation of the tranform function failed with error. Please check if you inserted valid javascript code:', e);
        }
        // Undefined is allowed because I wanted to allow have commented code in the transform function
        if (typeof parsedTransformFunction !== 'function' && parsedTransformFunction !== undefined) {
            throw new Error('Transform function has to be a javascript function or it has to be undefined (in case the whole code is commented out)');
        }
        return parsedTransformFunction;
    }
};

// I know this is probably very inneficient way but for such a small thing it doesn't matter
module.exports.sortObj = (obj, keys) => {
    const newObj = {};
    // First we add user-requested sorting
    for (const key of keys) {
        newObj[key] = obj[key];
    }
    // The we sort the rest alphabetically
    const sortedKeys = Object.keys(obj).sort((a, b) => a.localeCompare(b));
    for (const key of sortedKeys) {
        if (!keys.includes(key)) {
            newObj[key] = obj[key];
        }
    }
    return newObj;
};
