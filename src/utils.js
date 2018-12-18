const sortObj = require('sort-object');
const md5 = require('md5');
const { backOff } = require('exponential-backoff');

exports.handleRequestError = (e, action) => {
    console.log(`${action} failed with error: ${e.message}`);
    console.dir(e);
    throw new Error('Fail in the crucial reques');
};

exports.retryingRequest = async (request) => {
    return backOff(
        {
            fn: () => request,
            retry: (e, numberOfAttempts) => {
                console.log(`retrying API call to google with atempt n. ${numberOfAttempts}`)
                return e.message.includes('The service is currently unavailable')
            },
        },
        {
            numberOfAttempts: 6,
            timeMultiple: 3,
        },
    );
};

exports.countCells = (rows) => rows[0].length * rows.length;

exports.toObjects = (rows) => {
    if (rows.length === 0) return [];
    const keys = rows[0];
    return rows.slice(1).map((row) => {
        const obj = {};
        keys.forEach((key, i) => {
            obj[key] = row[i];
        });
        return obj;
    });
};

exports.toRows = (objects) => {
    if (objects.length === 0) return [];
    const header = Object.keys(objects[0]);
    const values = objects.map((object) => Object.values(object));
    return [header, ...values];
};

const union = (setA, setB) => {
    const unioned = new Set(setA);
    for (const elem of setB) {
        unioned.add(elem);
    }
    return Array.from(unioned);
};

const makeUniqueRows = (oldObjects, newObjects, field, equality) => {
    const countHash = (row) => md5(Object.values(row).join(''));
    const rowIntoKey = (row) => {
        if (field) return row[field];
        if (equality) return countHash(row);
        throw new Error('Nor field or equality was provided to filterUniqueRows function');
    };
    if (!field && !equality) return oldObjects.concat(newObjects);

    const tempObj = {};
    oldObjects.concat(newObjects).forEach((row) => {
        const key = rowIntoKey(row);
        if (!tempObj[key]) {
            tempObj[key] = row;
        }
    });
    const filteredRows = Object.values(tempObj).filter((row) => !!row);
    return filteredRows;
};

// export to test
exports.makeUniqueRows = makeUniqueRows;

// works only if all objects in one array have the same keys
exports.updateRowsObjects = ({ oldObjects, newObjects, filterByField, filterByEquality, transformFunction }) => {
    const oldKeys = oldObjects.length > 0 ? Object.keys(oldObjects[0]) : [];
    const newKeys = newObjects.length > 0 ? Object.keys(newObjects[0]) : [];
    const keys = union(oldKeys, newKeys);
    // if no field or equality - this is simple concat
    const allObjects = transformFunction
        ? transformFunction({ newObjects, oldObjects })
        : makeUniqueRows(oldObjects, newObjects, filterByField, filterByEquality);
    // const concated = oldObjects.concat(toConcat);
    const updatedObjects = allObjects.map((object) => {
        const updatedObj = object;
        keys.forEach((key) => {
            if (!updatedObj[key]) updatedObj[key] = '';
        });
        return sortObj(updatedObj);
    });
    return updatedObjects;
};

exports.trimSheetRequest = (height, width, firstSheetId) => {
    const payload = {
        requests: [],
    };
    if (height) {
        payload.requests.push({
            deleteDimension: {
                range: {
                    sheetId: firstSheetId,
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
                    sheetId: firstSheetId,
                    dimension: 'COLUMNS',
                    startIndex: width,
                },
            },
        });
    }
    return payload;
};
