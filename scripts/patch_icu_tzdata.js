// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

// Swaps the time zone resources inside Electron's ICU data file (icudtl.dat) for the ones in resources/icu,
// so that time zone rules and Windows zone detection don't have to wait for Chromium to update its ICU.
// See resources/icu/README.md for where those files come from and when this can be removed.

const fs = require('fs');
const path = require('path');

const RESOURCE_DIR = path.resolve(__dirname, '../resources/icu');
const TZ_RESOURCES = ['metaZones.res', 'timezoneTypes.res', 'windowsZones.res', 'zoneinfo64.res'];
const REQUIRED_WINDOWS_ZONES = ['Alberta Standard Time', 'British Columbia Standard Time'];

// Layout of an ICU common data package (see icu4c/source/tools/toolutil/package.cpp):
// a data header, then a TOC of (nameOffset, dataOffset) pairs relative to the end of the header,
// then the item names, then the item data. Items are stored in name order, each padded to 16 bytes.
const ITEM_ALIGNMENT = 16;
const PADDING_BYTE = 0xaa;

function readPackage(buffer) {
    if (buffer[2] !== 0xda || buffer[3] !== 0x27 || buffer.toString('latin1', 12, 16) !== 'CmnD') {
        throw new Error('not an ICU common data package');
    }
    if (buffer[8] !== 0 || buffer[9] !== 0) {
        throw new Error('ICU data package is not little-endian ASCII');
    }

    const headerSize = buffer.readUInt16LE(0);
    const count = buffer.readUInt32LE(headerSize);
    const items = [];
    for (let i = 0; i < count; i++) {
        const entry = headerSize + 4 + (i * 8);
        const nameStart = headerSize + buffer.readUInt32LE(entry);
        items.push({
            name: buffer.toString('latin1', nameStart, buffer.indexOf(0, nameStart)),
            start: headerSize + buffer.readUInt32LE(entry + 4),
        });
    }
    items.forEach((item, i) => {
        item.end = i + 1 < count ? items[i + 1].start : buffer.length;
        if (item.end < item.start) {
            throw new Error(`ICU data package items are not stored in order at ${item.name}`);
        }
    });

    return {headerSize, items};
}

function writePackage(buffer, {headerSize, items}, replacements) {
    const prefix = Buffer.from(buffer.subarray(0, items[0].start));
    const chunks = [prefix];
    let offset = prefix.length;
    items.forEach((item, i) => {
        let data = replacements.get(item.name) ?? buffer.subarray(item.start, item.end);
        const padding = (ITEM_ALIGNMENT - (data.length % ITEM_ALIGNMENT)) % ITEM_ALIGNMENT;
        if (padding) {
            data = Buffer.concat([data, Buffer.alloc(padding, PADDING_BYTE)]);
        }
        prefix.writeUInt32LE(offset - headerSize, headerSize + 8 + (i * 8));
        chunks.push(data);
        offset += data.length;
    });
    return Buffer.concat(chunks);
}

// zoneinfo64.res holds a single tzdata version string (e.g. "2026d"), stored as UTF-16.
function getTzVersion(zoneinfo) {
    const versions = zoneinfo.toString('utf16le').match(/(?<![0-9A-Za-z])\d{4}[a-z](?![0-9A-Za-z])/g) ?? [];
    if (versions.length !== 1) {
        throw new Error(`expected one tzdata version in zoneinfo64.res, found ${versions.length}`);
    }
    return versions[0];
}

function patchIcuTzData(icuDataPath) {
    const buffer = fs.readFileSync(icuDataPath);
    const pkg = readPackage(buffer);

    const tz = Object.fromEntries(TZ_RESOURCES.map((resource) => {
        const matches = pkg.items.filter((item) => item.name.endsWith(`/${resource}`));
        if (matches.length !== 1) {
            throw new Error(`expected one ${resource} in ${icuDataPath}, found ${matches.length}`);
        }
        return [resource, {
            name: matches[0].name,
            bundled: buffer.subarray(matches[0].start, matches[0].end),
            updated: fs.readFileSync(path.join(RESOURCE_DIR, resource)),
        }];
    }));

    if (Object.values(tz).every(({bundled, updated}) => bundled.subarray(0, updated.length).equals(updated))) {
        console.log(`ICU time zone data in ${icuDataPath} is already up to date`);
        return;
    }

    const bundledVersion = getTzVersion(tz['zoneinfo64.res'].bundled);
    const updatedVersion = getTzVersion(tz['zoneinfo64.res'].updated);
    if (bundledVersion >= updatedVersion) {
        if (REQUIRED_WINDOWS_ZONES.every((zone) => tz['windowsZones.res'].bundled.includes(`${zone}\0`))) {
            console.log(`Electron's ICU already has tzdata ${bundledVersion} and the new Windows time zones, so scripts/patch_icu_tzdata.js and resources/icu can be removed`);
            return;
        }
        throw new Error(`Electron's ICU has tzdata ${bundledVersion}, which is not older than the ${updatedVersion} in resources/icu, but it is still missing the new Windows time zones. Update resources/icu to tzdata ${bundledVersion} or newer (see resources/icu/README.md).`);
    }

    const replacements = new Map(Object.values(tz).map(({name, updated}) => [name, updated]));
    fs.writeFileSync(icuDataPath, writePackage(buffer, pkg, replacements));
    console.log(`Updated ICU time zone data in ${icuDataPath} from tzdata ${bundledVersion} to ${updatedVersion}`);
}

module.exports = {patchIcuTzData};
