const { countCells, trimSheetRequest, retryingRequest, handleRequestError } = require('./utils');

module.exports = async ({ maxCells, rowsToInsert, spreadsheetId, spreadsheetRange, values, client, targetSheetId }) => {
    // ensuring max cells limit
    const cellsToInsert = countCells(rowsToInsert);
    console.log(`Total rows: ${rowsToInsert.length}, total cells: ${cellsToInsert}`);
    if (cellsToInsert > maxCells) {
        throw new Error(`You reached the max limit of ${maxCells} cells. Try inserting less rows.`);
    }

    // inserting cells
    console.log('Inserting new cells');
    await retryingRequest(client.spreadsheets.values.update({
        spreadsheetId,
        range: spreadsheetRange,
        valueInputOption: 'USER_ENTERED',
        resource: { values: rowsToInsert },
    })).catch((e) => handleRequestError(e, 'Inserting new rows'));
    console.log('Items inserted...');

    // trimming cells
    console.log('Maybe deleting unused cells');
    const height = values && values.length > rowsToInsert.length
        ? rowsToInsert.length
        : null;
    const maxInSheetWidth = values ? values.reduce((max, row) => Math.max(max, row.length), 0) : 0;
    const maxInsertWidth = rowsToInsert.reduce((max, row) => Math.max(max, row.length), 0);
    const width = maxInSheetWidth > maxInsertWidth
        ? maxInsertWidth
        : null;
    if (height || width) {
        if (height) console.log('Will delete unused rows');
        if (width) console.log('Will delete unused columns');
        await retryingRequest(client.spreadsheets.batchUpdate({
            spreadsheetId,
            resource: trimSheetRequest(height, width, targetSheetId),
        })).catch((e) => handleRequestError(e, 'Trimming excessive cells'));
    } else {
        console.log('No need to delete any rows or columns');
    }
};
