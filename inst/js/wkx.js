(function e(t,n,r){function s(o,u){if(!n[o]){if(!t[o]){var a=typeof require=="function"&&require;if(!u&&a)return a(o,!0);if(i)return i(o,!0);var f=new Error("Cannot find module '"+o+"'");throw f.code="MODULE_NOT_FOUND",f}var l=n[o]={exports:{}};t[o][0].call(l.exports,function(e){var n=t[o][1][e];return s(n?n:e)},l,l.exports,e,t,n,r)}return n[o].exports}var i=typeof require=="function"&&require;for(var o=0;o<r.length;o++)s(r[o]);return s})({1:[function(require,module,exports){
(function (global){
global.wkx = require('wkx');

}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"wkx":14}],2:[function(require,module,exports){
(function (Buffer){
module.exports = BinaryReader;

function BinaryReader(buffer, isBigEndian) {
    this.buffer = buffer;
    this.position = 0;
    this.isBigEndian = isBigEndian || false;
}

function _read(readLE, readBE, size) {
    return function () {
        var value;

        if (this.isBigEndian)
            value = readBE.call(this.buffer, this.position);
        else
            value = readLE.call(this.buffer, this.position);

        this.position += size;

        return value;
    };
}

BinaryReader.prototype.readUInt8 = _read(Buffer.prototype.readUInt8, Buffer.prototype.readUInt8, 1);
BinaryReader.prototype.readUInt16 = _read(Buffer.prototype.readUInt16LE, Buffer.prototype.readUInt16BE, 2);
BinaryReader.prototype.readUInt32 = _read(Buffer.prototype.readUInt32LE, Buffer.prototype.readUInt32BE, 4);
BinaryReader.prototype.readInt8 = _read(Buffer.prototype.readInt8, Buffer.prototype.readInt8, 1);
BinaryReader.prototype.readInt16 = _read(Buffer.prototype.readInt16LE, Buffer.prototype.readInt16BE, 2);
BinaryReader.prototype.readInt32 = _read(Buffer.prototype.readInt32LE, Buffer.prototype.readInt32BE, 4);
BinaryReader.prototype.readFloat = _read(Buffer.prototype.readFloatLE, Buffer.prototype.readFloatBE, 4);
BinaryReader.prototype.readDouble = _read(Buffer.prototype.readDoubleLE, Buffer.prototype.readDoubleBE, 8);

BinaryReader.prototype.readVarInt = function () {
    var nextByte,
        result = 0,
        bytesRead = 0;

    do {
        nextByte = this.buffer[this.position + bytesRead];
        result += (nextByte & 0x7F) << (7 * bytesRead);
        bytesRead++;
    } while (nextByte >= 0x80);

    this.position += bytesRead;

    return result;
};

}).call(this,require("buffer").Buffer)
},{"buffer":16}],3:[function(require,module,exports){
(function (Buffer){
module.exports = BinaryWriter;

function BinaryWriter(size, allowResize) {
    this.buffer = new Buffer(size);
    this.position = 0;
    this.allowResize = allowResize;
}

function _write(write, size) {
    return function (value, noAssert) {
        this.ensureSize(size);

        write.call(this.buffer, value, this.position, noAssert);
        this.position += size;
    };
}

BinaryWriter.prototype.writeUInt8 = _write(Buffer.prototype.writeUInt8, 1);
BinaryWriter.prototype.writeUInt16LE = _write(Buffer.prototype.writeUInt16LE, 2);
BinaryWriter.prototype.writeUInt16BE = _write(Buffer.prototype.writeUInt16BE, 2);
BinaryWriter.prototype.writeUInt32LE = _write(Buffer.prototype.writeUInt32LE, 4);
BinaryWriter.prototype.writeUInt32BE = _write(Buffer.prototype.writeUInt32BE, 4);
BinaryWriter.prototype.writeInt8 = _write(Buffer.prototype.writeInt8, 1);
BinaryWriter.prototype.writeInt16LE = _write(Buffer.prototype.writeInt16LE, 2);
BinaryWriter.prototype.writeInt16BE = _write(Buffer.prototype.writeInt16BE, 2);
BinaryWriter.prototype.writeInt32LE = _write(Buffer.prototype.writeInt32LE, 4);
BinaryWriter.prototype.writeInt32BE = _write(Buffer.prototype.writeInt32BE, 4);
BinaryWriter.prototype.writeFloatLE = _write(Buffer.prototype.writeFloatLE, 4);
BinaryWriter.prototype.writeFloatBE = _write(Buffer.prototype.writeFloatBE, 4);
BinaryWriter.prototype.writeDoubleLE = _write(Buffer.prototype.writeDoubleLE, 8);
BinaryWriter.prototype.writeDoubleBE = _write(Buffer.prototype.writeDoubleBE, 8);

BinaryWriter.prototype.writeBuffer = function (buffer) {
    this.ensureSize(buffer.length);

    buffer.copy(this.buffer, this.position, 0, buffer.length);
    this.position += buffer.length;
};

BinaryWriter.prototype.writeVarInt = function (value) {
    var length = 1;

    while ((value & 0xFFFFFF80) !== 0) {
        this.writeUInt8((value & 0x7F) | 0x80);
        value >>>= 7;
        length++;
    }

    this.writeUInt8(value & 0x7F);

    return length;
};

BinaryWriter.prototype.ensureSize = function (size) {
    if (this.buffer.length < this.position + size) {
        if (this.allowResize) {
            var tempBuffer = new Buffer(this.position + size);
            this.buffer.copy(tempBuffer, 0, 0, this.buffer.length);
            this.buffer = tempBuffer;
        }
        else {
            throw new RangeError('index out of range');
        }
    }
};

}).call(this,require("buffer").Buffer)
},{"buffer":16}],4:[function(require,module,exports){
(function (Buffer){
module.exports = Geometry;

var Types = require('./types');
var Point = require('./point');
var LineString = require('./linestring');
var Polygon = require('./polygon');
var MultiPoint = require('./multipoint');
var MultiLineString = require('./multilinestring');
var MultiPolygon = require('./multipolygon');
var GeometryCollection = require('./geometrycollection');
var BinaryReader = require('./binaryreader');
var BinaryWriter = require('./binarywriter');
var WktParser = require('./wktparser');
var ZigZag = require('./zigzag.js');

function Geometry() {
    this.srid = undefined;
    this.hasZ = false;
    this.hasM = false;
}

Geometry.parse = function (value, options) {
    var valueType = typeof value;

    if (valueType === 'string' || value instanceof WktParser)
        return Geometry._parseWkt(value);
    else if (Buffer.isBuffer(value) || value instanceof BinaryReader)
        return Geometry._parseWkb(value, options);
    else
        throw new Error('first argument must be a string or Buffer');
};

Geometry._parseWkt = function (value) {
    var wktParser,
        srid;

    if (value instanceof WktParser)
        wktParser = value;
    else
        wktParser = new WktParser(value);

    var match = wktParser.matchRegex([/^SRID=(\d+);/]);
    if (match)
        srid = match[1];

    var geometryType = wktParser.matchType();
    var dimension = wktParser.matchDimension();

    var options = {
        srid: srid,
        hasZ: dimension.hasZ,
        hasM: dimension.hasM
    };

    switch (geometryType) {
    case Types.wkt.Point:
        return Point._parseWkt(wktParser, options);
    case Types.wkt.LineString:
        return LineString._parseWkt(wktParser, options);
    case Types.wkt.Polygon:
        return Polygon._parseWkt(wktParser, options);
    case Types.wkt.MultiPoint:
        return MultiPoint._parseWkt(wktParser, options);
    case Types.wkt.MultiLineString:
        return MultiLineString._parseWkt(wktParser, options);
    case Types.wkt.MultiPolygon:
        return MultiPolygon._parseWkt(wktParser, options);
    case Types.wkt.GeometryCollection:
        return GeometryCollection._parseWkt(wktParser, options);
    }
};

Geometry._parseWkb = function (value, parentOptions) {
    var binaryReader,
        hasSrid,
        srid,
        wkbType,
        geometryType,
        options = {};

    if (value instanceof BinaryReader)
        binaryReader = value;
    else
        binaryReader = new BinaryReader(value);

    binaryReader.isBigEndian = !binaryReader.readInt8();

    wkbType = binaryReader.readUInt32();

    options.hasSrid = (wkbType & 0x20000000) === 0x20000000;

    if (options.hasSrid)
        options.srid = binaryReader.readUInt32();

    options.hasZ = false;
    options.hasM = false;

    if (!options.hasSrid && (!parentOptions || !parentOptions.hasSrid)) {
        if (wkbType >= 1000 && wkbType < 2000) {
            options.hasZ = true;
            geometryType = wkbType - 1000;
        }
        else if (wkbType >= 2000 && wkbType < 3000) {
            options.hasM = true;
            geometryType = wkbType - 2000;
        }
        else if (wkbType >= 3000 && wkbType < 4000) {
            options.hasZ = true;
            options.hasM = true;
            geometryType = wkbType - 3000;
        }
        else {
            geometryType = wkbType;
        }
    }
    else {
        if (wkbType & 0x80000000)
            options.hasZ = true;
        if (wkbType & 0x40000000)
            options.hasM = true;

        geometryType = wkbType & 0xF;
    }

    switch (geometryType) {
    case Types.wkb.Point:
        return Point._parseWkb(binaryReader, options);
    case Types.wkb.LineString:
        return LineString._parseWkb(binaryReader, options);
    case Types.wkb.Polygon:
        return Polygon._parseWkb(binaryReader, options);
    case Types.wkb.MultiPoint:
        return MultiPoint._parseWkb(binaryReader, options);
    case Types.wkb.MultiLineString:
        return MultiLineString._parseWkb(binaryReader, options);
    case Types.wkb.MultiPolygon:
        return MultiPolygon._parseWkb(binaryReader, options);
    case Types.wkb.GeometryCollection:
        return GeometryCollection._parseWkb(binaryReader, options);
    default:
        throw new Error('GeometryType ' + geometryType + ' not supported');
    }
};

Geometry.parseTwkb = function (value) {
    var binaryReader,
        options = {};

    if (value instanceof BinaryReader)
        binaryReader = value;
    else
        binaryReader = new BinaryReader(value);

    var type = binaryReader.readUInt8();
    var metadataHeader = binaryReader.readUInt8();

    var geometryType = type & 0x0F;
    options.precision = ZigZag.decode(type >> 4);
    options.precisionFactor = Math.pow(10, options.precision);

    options.hasBoundingBox = metadataHeader >> 0 & 1;
    options.hasSizeAttribute = metadataHeader >> 1 & 1;
    options.hasIdList = metadataHeader >> 2 & 1;
    options.hasExtendedPrecision = metadataHeader >> 3 & 1;
    options.isEmpty = metadataHeader >> 4 & 1;

    if (options.hasExtendedPrecision) {
        var extendedPrecision = binaryReader.readUInt8();
        options.hasZ = (extendedPrecision & 0x01) === 0x01;
        options.hasM = (extendedPrecision & 0x02) === 0x02;

        options.zPrecision = ZigZag.decode((extendedPrecision & 0x1C) >> 2);
        options.zPrecisionFactor = Math.pow(10, options.zPrecision);

        options.mPrecision = ZigZag.decode((extendedPrecision & 0xE0) >> 5);
        options.mPrecisionFactor = Math.pow(10, options.mPrecision);
    }
    else {
        options.hasZ = false;
        options.hasM = false;
    }

    if (options.hasSizeAttribute)
        binaryReader.readVarInt();
    if (options.hasBoundingBox) {
        var dimensions = 2;

        if (options.hasZ)
            dimensions++;
        if (options.hasM)
            dimensions++;

        for (var i = 0; i < dimensions; i++) {
            binaryReader.readVarInt();
            binaryReader.readVarInt();
        }
    }

    switch (geometryType) {
    case Types.wkb.Point:
        return Point._parseTwkb(binaryReader, options);
    case Types.wkb.LineString:
        return LineString._parseTwkb(binaryReader, options);
    case Types.wkb.Polygon:
        return Polygon._parseTwkb(binaryReader, options);
    case Types.wkb.MultiPoint:
        return MultiPoint._parseTwkb(binaryReader, options);
    case Types.wkb.MultiLineString:
        return MultiLineString._parseTwkb(binaryReader, options);
    case Types.wkb.MultiPolygon:
        return MultiPolygon._parseTwkb(binaryReader, options);
    case Types.wkb.GeometryCollection:
        return GeometryCollection._parseTwkb(binaryReader, options);
    default:
        throw new Error('GeometryType ' + geometryType + ' not supported');
    }
};

Geometry.parseGeoJSON = function (value) {
    var geometry;

    switch (value.type) {
    case Types.geoJSON.Point:
        geometry = Point._parseGeoJSON(value); break;
    case Types.geoJSON.LineString:
        geometry = LineString._parseGeoJSON(value); break;
    case Types.geoJSON.Polygon:
        geometry = Polygon._parseGeoJSON(value); break;
    case Types.geoJSON.MultiPoint:
        geometry = MultiPoint._parseGeoJSON(value); break;
    case Types.geoJSON.MultiLineString:
        geometry = MultiLineString._parseGeoJSON(value); break;
    case Types.geoJSON.MultiPolygon:
        geometry = MultiPolygon._parseGeoJSON(value); break;
    case Types.geoJSON.GeometryCollection:
        geometry = GeometryCollection._parseGeoJSON(value); break;
    default:
        throw new Error('GeometryType ' + value.type + ' not supported');
    }

    if (value.crs && value.crs.type && value.crs.type === 'name' && value.crs.properties && value.crs.properties.name) {
        var crs = value.crs.properties.name;

        if (crs.indexOf('EPSG:') === 0)
            geometry.srid = parseInt(crs.substring(5));
        else if (crs.indexOf('urn:ogc:def:crs:EPSG::') === 0)
            geometry.srid = parseInt(crs.substring(22));
        else
            throw new Error('Unsupported crs: ' + crs);
    }

    return geometry;
};

Geometry.prototype.toEwkt = function () {
    return 'SRID=' + this.srid + ';' + this.toWkt();
};

Geometry.prototype.toEwkb = function () {
    var ewkb = new BinaryWriter(this._getWkbSize() + 4);
    var wkb = this.toWkb();

    ewkb.writeInt8(1);
    ewkb.writeUInt32LE(wkb.slice(1, 5).readUInt32LE(0) | 0x20000000, true);
    ewkb.writeUInt32LE(this.srid);

    ewkb.writeBuffer(wkb.slice(5));

    return ewkb.buffer;
};

Geometry.prototype._getWktType = function (wktType, isEmpty) {
    var wkt = wktType;

    if (this.hasZ && this.hasM)
        wkt += ' ZM ';
    else if (this.hasZ)
        wkt += ' Z ';
    else if (this.hasM)
        wkt += ' M ';

    if (isEmpty && !this.hasZ && !this.hasM)
        wkt += ' ';

    if (isEmpty)
        wkt += 'EMPTY';

    return wkt;
};

Geometry.prototype._getWktCoordinate = function (point) {
    var coordinates = point.x + ' ' + point.y;

    if (this.hasZ)
        coordinates += ' ' + point.z;
    if (this.hasM)
        coordinates += ' ' + point.m;

    return coordinates;
};

Geometry.prototype._writeWkbType = function (wkb, geometryType, parentOptions) {
    var dimensionType = 0;

    if (typeof this.srid === 'undefined' && (!parentOptions || typeof parentOptions.srid === 'undefined')) {
        if (this.hasZ && this.hasM)
            dimensionType += 3000;
        else if(this.hasZ)
            dimensionType += 1000;
        else if(this.hasM)
            dimensionType += 2000;
    }
    else {
        if (this.hasZ)
            dimensionType |= 0x80000000;
        if (this.hasM)
            dimensionType |= 0x40000000;
    }

    wkb.writeUInt32LE(dimensionType + geometryType, true);
};

Geometry.getTwkbPrecision = function (xyPrecision, zPrecision, mPrecision) {
    return {
        xy: xyPrecision,
        z: zPrecision,
        m: mPrecision,
        xyFactor: Math.pow(10, xyPrecision),
        zFactor: Math.pow(10, zPrecision),
        mFactor: Math.pow(10, mPrecision)
    };
};

Geometry.prototype._writeTwkbHeader = function (twkb, geometryType, precision, isEmpty) {
    var type = (ZigZag.encode(precision.xy) << 4) + geometryType;
    var metadataHeader = (this.hasZ || this.hasM) << 3;
    metadataHeader += isEmpty << 4;

    twkb.writeUInt8(type);
    twkb.writeUInt8(metadataHeader);

    if (this.hasZ || this.hasM) {
        var extendedPrecision = 0;
        if (this.hasZ)
            extendedPrecision |= 0x1;
        if (this.hasM)
            extendedPrecision |= 0x2;

        twkb.writeUInt8(extendedPrecision);
    }
};

Geometry.prototype.toGeoJSON = function (options) {
    var geoJSON = {};

    if (this.srid) {
        if (options) {
            if (options.shortCrs) {
                geoJSON.crs = {
                    type: 'name',
                    properties: {
                        name: 'EPSG:' + this.srid
                    }
                };
            }
            else if (options.longCrs) {
                geoJSON.crs = {
                    type: 'name',
                    properties: {
                        name: 'urn:ogc:def:crs:EPSG::' + this.srid
                    }
                };
            }
        }
    }

    return geoJSON;
};

}).call(this,require("buffer").Buffer)
},{"./binaryreader":2,"./binarywriter":3,"./geometrycollection":5,"./linestring":6,"./multilinestring":7,"./multipoint":8,"./multipolygon":9,"./point":10,"./polygon":11,"./types":12,"./wktparser":13,"./zigzag.js":15,"buffer":16}],5:[function(require,module,exports){
module.exports = GeometryCollection;

var util = require('util');

var Types = require('./types');
var Geometry = require('./geometry');
var BinaryWriter = require('./binarywriter');

function GeometryCollection(geometries) {
    Geometry.call(this);

    this.geometries = geometries || [];
}

util.inherits(GeometryCollection, Geometry);

GeometryCollection.Z = function (geometries) {
    var geometryCollection = new GeometryCollection(geometries);
    geometryCollection.hasZ = true;
    return geometryCollection;
};

GeometryCollection.M = function (geometries) {
    var geometryCollection = new GeometryCollection(geometries);
    geometryCollection.hasM = true;
    return geometryCollection;
};

GeometryCollection.ZM = function (geometries) {
    var geometryCollection = new GeometryCollection(geometries);
    geometryCollection.hasZ = true;
    geometryCollection.hasM = true;
    return geometryCollection;
};

GeometryCollection._parseWkt = function (value, options) {
    var geometryCollection = new GeometryCollection();
    geometryCollection.srid = options.srid;
    geometryCollection.hasZ = options.hasZ;
    geometryCollection.hasM = options.hasM;

    if (value.isMatch(['EMPTY']))
        return geometryCollection;

    value.expectGroupStart();

    do {
        geometryCollection.geometries.push(Geometry.parse(value));
    } while (value.isMatch([',']));

    value.expectGroupEnd();

    return geometryCollection;
};

GeometryCollection._parseWkb = function (value, options) {
    var geometryCollection = new GeometryCollection();
    geometryCollection.srid = options.srid;
    geometryCollection.hasZ = options.hasZ;
    geometryCollection.hasM = options.hasM;

    var geometryCount = value.readUInt32();

    for (var i = 0; i < geometryCount; i++)
        geometryCollection.geometries.push(Geometry.parse(value, options));

    return geometryCollection;
};

GeometryCollection._parseTwkb = function (value, options) {
    var geometryCollection = new GeometryCollection();
    geometryCollection.hasZ = options.hasZ;
    geometryCollection.hasM = options.hasM;

    if (options.isEmpty)
        return geometryCollection;

    var geometryCount = value.readVarInt();

    for (var i = 0; i < geometryCount; i++)
        geometryCollection.geometries.push(Geometry.parseTwkb(value));

    return geometryCollection;
};

GeometryCollection._parseGeoJSON = function (value) {
    var geometryCollection = new GeometryCollection();

    for (var i = 0; i < value.geometries.length; i++)
        geometryCollection.geometries.push(Geometry.parseGeoJSON(value.geometries[i]));

    if (geometryCollection.geometries.length > 0)
        geometryCollection.hasZ = geometryCollection.geometries[0].hasZ;

    return geometryCollection;
};

GeometryCollection.prototype.toWkt = function () {
    if (this.geometries.length === 0)
        return this._getWktType(Types.wkt.GeometryCollection, true);

    var wkt = this._getWktType(Types.wkt.GeometryCollection, false) + '(';

    for (var i = 0; i < this.geometries.length; i++)
        wkt += this.geometries[i].toWkt() + ',';

    wkt = wkt.slice(0, -1);
    wkt += ')';

    return wkt;
};

GeometryCollection.prototype.toWkb = function () {
    var wkb = new BinaryWriter(this._getWkbSize());

    wkb.writeInt8(1);

    this._writeWkbType(wkb, Types.wkb.GeometryCollection);
    wkb.writeUInt32LE(this.geometries.length);

    for (var i = 0; i < this.geometries.length; i++)
        wkb.writeBuffer(this.geometries[i].toWkb({ srid: this.srid }));

    return wkb.buffer;
};

GeometryCollection.prototype.toTwkb = function () {
    var twkb = new BinaryWriter(0, true);

    var precision = Geometry.getTwkbPrecision(5, 0, 0);
    var isEmpty = this.geometries.length === 0;

    this._writeTwkbHeader(twkb, Types.wkb.GeometryCollection, precision, isEmpty);

    if (this.geometries.length > 0) {
        twkb.writeVarInt(this.geometries.length);

        for (var i = 0; i < this.geometries.length; i++)
            twkb.writeBuffer(this.geometries[i].toTwkb());
    }

    return twkb.buffer;
};

GeometryCollection.prototype._getWkbSize = function () {
    var size = 1 + 4 + 4;

    for (var i = 0; i < this.geometries.length; i++)
        size += this.geometries[i]._getWkbSize();

    return size;
};

GeometryCollection.prototype.toGeoJSON = function (options) {
    var geoJSON = Geometry.prototype.toGeoJSON.call(this, options);
    geoJSON.type = Types.geoJSON.GeometryCollection;
    geoJSON.geometries = [];

    for (var i = 0; i < this.geometries.length; i++)
        geoJSON.geometries.push(this.geometries[i].toGeoJSON());

    return geoJSON;
};

},{"./binarywriter":3,"./geometry":4,"./types":12,"util":23}],6:[function(require,module,exports){
module.exports = LineString;

var util = require('util');

var Geometry = require('./geometry');
var Types = require('./types');
var Point = require('./point');
var BinaryWriter = require('./binarywriter');
var ZigZag = require('./zigzag.js');

function LineString(points) {
    Geometry.call(this);

    this.points = points || [];

    if (this.points.length > 0) {
        this.hasZ = this.points[0].hasZ;
        this.hasM = this.points[0].hasM;
    }
}

util.inherits(LineString, Geometry);

LineString.Z = function (points) {
    var lineString = new LineString(points);
    lineString.hasZ = true;
    return lineString;
};

LineString.M = function (points) {
    var lineString = new LineString(points);
    lineString.hasM = true;
    return lineString;
};

LineString.ZM = function (points) {
    var lineString = new LineString(points);
    lineString.hasZ = true;
    lineString.hasM = true;
    return lineString;
};

LineString._parseWkt = function (value, options) {
    var lineString = new LineString();
    lineString.srid = options.srid;
    lineString.hasZ = options.hasZ;
    lineString.hasM = options.hasM;

    if (value.isMatch(['EMPTY']))
        return lineString;

    value.expectGroupStart();
    lineString.points.push.apply(lineString.points, value.matchCoordinates(options));
    value.expectGroupEnd();

    return lineString;
};

LineString._parseWkb = function (value, options) {
    var lineString = new LineString();
    lineString.srid = options.srid;
    lineString.hasZ = options.hasZ;
    lineString.hasM = options.hasM;

    var pointCount = value.readUInt32();

    for (var i = 0; i < pointCount; i++)
        lineString.points.push(Point._readWkbPoint(value, options));

    return lineString;
};

LineString._parseTwkb = function (value, options) {
    var lineString = new LineString();
    lineString.hasZ = options.hasZ;
    lineString.hasM = options.hasM;

    if (options.isEmpty)
        return lineString;

    var previousPoint = new Point(0, 0, options.hasZ ? 0 : undefined, options.hasM ? 0 : undefined);
    var pointCount = value.readVarInt();

    for (var i = 0; i < pointCount; i++)
        lineString.points.push(Point._readTwkbPoint(value, options, previousPoint));

    return lineString;
};

LineString._parseGeoJSON = function (value) {
    var lineString = new LineString();

    if (value.coordinates.length > 0)
        lineString.hasZ = value.coordinates[0].length > 2;

    for (var i = 0; i < value.coordinates.length; i++)
        lineString.points.push(Point._readGeoJSONPoint(value.coordinates[i]));

    return lineString;
};

LineString.prototype.toWkt = function () {
    if (this.points.length === 0)
        return this._getWktType(Types.wkt.LineString, true);

    return this._getWktType(Types.wkt.LineString, false) + this._toInnerWkt();
};

LineString.prototype._toInnerWkt = function () {
    var innerWkt = '(';

    for (var i = 0; i < this.points.length; i++)
        innerWkt += this._getWktCoordinate(this.points[i]) + ',';

    innerWkt = innerWkt.slice(0, -1);
    innerWkt += ')';

    return innerWkt;
};

LineString.prototype.toWkb = function (parentOptions) {
    var wkb = new BinaryWriter(this._getWkbSize());

    wkb.writeInt8(1);

    this._writeWkbType(wkb, Types.wkb.LineString, parentOptions);
    wkb.writeUInt32LE(this.points.length);

    for (var i = 0; i < this.points.length; i++)
        this.points[i]._writeWkbPoint(wkb);

    return wkb.buffer;
};

LineString.prototype.toTwkb = function () {
    var twkb = new BinaryWriter(0, true);

    var precision = Geometry.getTwkbPrecision(5, 0, 0);
    var isEmpty = this.points.length === 0;

    this._writeTwkbHeader(twkb, Types.wkb.LineString, precision, isEmpty);

    if (this.points.length > 0) {
        twkb.writeVarInt(this.points.length);

        var previousPoint = new Point(0, 0, 0, 0);
        for (var i = 0; i < this.points.length; i++)
            this.points[i]._writeTwkbPoint(twkb, precision, previousPoint);
    }

    return twkb.buffer;
};

LineString.prototype._getWkbSize = function () {
    var coordinateSize = 16;

    if (this.hasZ)
        coordinateSize += 8;
    if (this.hasM)
        coordinateSize += 8;

    return 1 + 4 + 4 + (this.points.length * coordinateSize);
};

LineString.prototype.toGeoJSON = function (options) {
    var geoJSON = Geometry.prototype.toGeoJSON.call(this, options);
    geoJSON.type = Types.geoJSON.LineString;
    geoJSON.coordinates = [];

    for (var i = 0; i < this.points.length; i++) {
        if (this.hasZ)
            geoJSON.coordinates.push([this.points[i].x, this.points[i].y, this.points[i].z]);
        else
            geoJSON.coordinates.push([this.points[i].x, this.points[i].y]);
    }

    return geoJSON;
};

},{"./binarywriter":3,"./geometry":4,"./point":10,"./types":12,"./zigzag.js":15,"util":23}],7:[function(require,module,exports){
module.exports = MultiLineString;

var util = require('util');

var Types = require('./types');
var Geometry = require('./geometry');
var Point = require('./point');
var LineString = require('./linestring');
var BinaryWriter = require('./binarywriter');
var ZigZag = require('./zigzag.js');

function MultiLineString(lineStrings) {
    Geometry.call(this);

    this.lineStrings = lineStrings || [];
}

util.inherits(MultiLineString, Geometry);

MultiLineString.Z = function (lineStrings) {
    var multiLineString = new MultiLineString(lineStrings);
    multiLineString.hasZ = true;
    return multiLineString;
};

MultiLineString.M = function (lineStrings) {
    var multiLineString = new MultiLineString(lineStrings);
    multiLineString.hasM = true;
    return multiLineString;
};

MultiLineString.ZM = function (lineStrings) {
    var multiLineString = new MultiLineString(lineStrings);
    multiLineString.hasZ = true;
    multiLineString.hasM = true;
    return multiLineString;
};

MultiLineString._parseWkt = function (value, options) {
    var multiLineString = new MultiLineString();
    multiLineString.srid = options.srid;
    multiLineString.hasZ = options.hasZ;
    multiLineString.hasM = options.hasM;

    if (value.isMatch(['EMPTY']))
        return multiLineString;

    value.expectGroupStart();

    do {
        value.expectGroupStart();
        multiLineString.lineStrings.push(new LineString(value.matchCoordinates(options)));
        value.expectGroupEnd();
    } while (value.isMatch([',']));

    value.expectGroupEnd();

    return multiLineString;
};

MultiLineString._parseWkb = function (value, options) {
    var multiLineString = new MultiLineString();
    multiLineString.srid = options.srid;
    multiLineString.hasZ = options.hasZ;
    multiLineString.hasM = options.hasM;

    var lineStringCount = value.readUInt32();

    for (var i = 0; i < lineStringCount; i++)
        multiLineString.lineStrings.push(Geometry.parse(value, options));

    return multiLineString;
};

MultiLineString._parseTwkb = function (value, options) {
    var multiLineString = new MultiLineString();
    multiLineString.hasZ = options.hasZ;
    multiLineString.hasM = options.hasM;

    if (options.isEmpty)
        return multiLineString;

    var previousPoint = new Point(0, 0, options.hasZ ? 0 : undefined, options.hasM ? 0 : undefined);
    var lineStringCount = value.readVarInt();

    for (var i = 0; i < lineStringCount; i++) {
        var lineString = new LineString();
        lineString.hasZ = options.hasZ;
        lineString.hasM = options.hasM;

        var pointCount = value.readVarInt();

        for (var j = 0; j < pointCount; j++)
            lineString.points.push(Point._readTwkbPoint(value, options, previousPoint));

        multiLineString.lineStrings.push(lineString);
    }

    return multiLineString;
};

MultiLineString._parseGeoJSON = function (value) {
    var multiLineString = new MultiLineString();

    if (value.coordinates.length > 0 && value.coordinates[0].length > 0)
        multiLineString.hasZ = value.coordinates[0][0].length > 2;

    for (var i = 0; i < value.coordinates.length; i++)
        multiLineString.lineStrings.push(LineString._parseGeoJSON({ coordinates: value.coordinates[i] }));

    return multiLineString;
};

MultiLineString.prototype.toWkt = function () {
    if (this.lineStrings.length === 0)
        return this._getWktType(Types.wkt.MultiLineString, true);

    var wkt = this._getWktType(Types.wkt.MultiLineString, false) + '(';

    for (var i = 0; i < this.lineStrings.length; i++)
        wkt += this.lineStrings[i]._toInnerWkt() + ',';

    wkt = wkt.slice(0, -1);
    wkt += ')';

    return wkt;
};

MultiLineString.prototype.toWkb = function () {
    var wkb = new BinaryWriter(this._getWkbSize());

    wkb.writeInt8(1);

    this._writeWkbType(wkb, Types.wkb.MultiLineString);
    wkb.writeUInt32LE(this.lineStrings.length);

    for (var i = 0; i < this.lineStrings.length; i++)
        wkb.writeBuffer(this.lineStrings[i].toWkb({ srid: this.srid }));

    return wkb.buffer;
};

MultiLineString.prototype.toTwkb = function () {
    var twkb = new BinaryWriter(0, true);

    var precision = Geometry.getTwkbPrecision(5, 0, 0);
    var isEmpty = this.lineStrings.length === 0;

    this._writeTwkbHeader(twkb, Types.wkb.MultiLineString, precision, isEmpty);

    if (this.lineStrings.length > 0) {
        twkb.writeVarInt(this.lineStrings.length);

        var previousPoint = new Point(0, 0, 0, 0);
        for (var i = 0; i < this.lineStrings.length; i++) {
            twkb.writeVarInt(this.lineStrings[i].points.length);

            for (var j = 0; j < this.lineStrings[i].points.length; j++)
                this.lineStrings[i].points[j]._writeTwkbPoint(twkb, precision, previousPoint);
        }
    }

    return twkb.buffer;
};

MultiLineString.prototype._getWkbSize = function () {
    var size = 1 + 4 + 4;

    for (var i = 0; i < this.lineStrings.length; i++)
        size += this.lineStrings[i]._getWkbSize();

    return size;
};

MultiLineString.prototype.toGeoJSON = function (options) {
    var geoJSON = Geometry.prototype.toGeoJSON.call(this, options);
    geoJSON.type = Types.geoJSON.MultiLineString;
    geoJSON.coordinates = [];

    for (var i = 0; i < this.lineStrings.length; i++)
        geoJSON.coordinates.push(this.lineStrings[i].toGeoJSON().coordinates);

    return geoJSON;
};

},{"./binarywriter":3,"./geometry":4,"./linestring":6,"./point":10,"./types":12,"./zigzag.js":15,"util":23}],8:[function(require,module,exports){
module.exports = MultiPoint;

var util = require('util');

var Types = require('./types');
var Geometry = require('./geometry');
var Point = require('./point');
var BinaryWriter = require('./binarywriter');
var ZigZag = require('./zigzag');

function MultiPoint(points) {
    Geometry.call(this);

    this.points = points || [];
}

util.inherits(MultiPoint, Geometry);

MultiPoint.Z = function (points) {
    var multiPoint = new MultiPoint(points);
    multiPoint.hasZ = true;
    return multiPoint;
};

MultiPoint.M = function (points) {
    var multiPoint = new MultiPoint(points);
    multiPoint.hasM = true;
    return multiPoint;
};

MultiPoint.ZM = function (points) {
    var multiPoint = new MultiPoint(points);
    multiPoint.hasZ = true;
    multiPoint.hasM = true;
    return multiPoint;
};

MultiPoint._parseWkt = function (value, options) {
    var multiPoint = new MultiPoint();
    multiPoint.srid = options.srid;
    multiPoint.hasZ = options.hasZ;
    multiPoint.hasM = options.hasM;

    if (value.isMatch(['EMPTY']))
        return multiPoint;

    value.expectGroupStart();
    multiPoint.points.push.apply(multiPoint.points, value.matchCoordinates(options));
    value.expectGroupEnd();

    return multiPoint;
};

MultiPoint._parseWkb = function (value, options) {
    var multiPoint = new MultiPoint();
    multiPoint.srid = options.srid;
    multiPoint.hasZ = options.hasZ;
    multiPoint.hasM = options.hasM;

    var pointCount = value.readUInt32();

    for (var i = 0; i < pointCount; i++)
        multiPoint.points.push(Geometry.parse(value, options));

    return multiPoint;
};

MultiPoint._parseTwkb = function (value, options) {
    var multiPoint = new MultiPoint();
    multiPoint.hasZ = options.hasZ;
    multiPoint.hasM = options.hasM;

    if (options.isEmpty)
        return multiPoint;

    var previousPoint = new Point(0, 0, options.hasZ ? 0 : undefined, options.hasM ? 0 : undefined);
    var pointCount = value.readVarInt();

    for (var i = 0; i < pointCount; i++)
        multiPoint.points.push(Point._readTwkbPoint(value, options, previousPoint));

    return multiPoint;
};

MultiPoint._parseGeoJSON = function (value) {
    var multiPoint = new MultiPoint();

    if (value.coordinates.length > 0)
        multiPoint.hasZ = value.coordinates[0].length > 2;

    for (var i = 0; i < value.coordinates.length; i++)
        multiPoint.points.push(Point._parseGeoJSON({ coordinates: value.coordinates[i] }));

    return multiPoint;
};

MultiPoint.prototype.toWkt = function () {
    if (this.points.length === 0)
        return this._getWktType(Types.wkt.MultiPoint, true);

    var wkt = this._getWktType(Types.wkt.MultiPoint, false) + '(';

    for (var i = 0; i < this.points.length; i++)
        wkt += this._getWktCoordinate(this.points[i]) + ',';

    wkt = wkt.slice(0, -1);
    wkt += ')';

    return wkt;
};

MultiPoint.prototype.toWkb = function () {
    var wkb = new BinaryWriter(this._getWkbSize());

    wkb.writeInt8(1);

    this._writeWkbType(wkb, Types.wkb.MultiPoint);
    wkb.writeUInt32LE(this.points.length);

    for (var i = 0; i < this.points.length; i++)
        wkb.writeBuffer(this.points[i].toWkb({ srid: this.srid }));

    return wkb.buffer;
};

MultiPoint.prototype.toTwkb = function () {
    var twkb = new BinaryWriter(0, true);

    var precision = Geometry.getTwkbPrecision(5, 0, 0);
    var isEmpty = this.points.length === 0;

    this._writeTwkbHeader(twkb, Types.wkb.MultiPoint, precision, isEmpty);

    if (this.points.length > 0) {
        twkb.writeVarInt(this.points.length);

        var previousPoint = new Point(0, 0, 0, 0);
        for (var i = 0; i < this.points.length; i++)
            this.points[i]._writeTwkbPoint(twkb, precision, previousPoint);
    }

    return twkb.buffer;
};

MultiPoint.prototype._getWkbSize = function () {
    var coordinateSize = 16;

    if (this.hasZ)
        coordinateSize += 8;
    if (this.hasM)
        coordinateSize += 8;

    coordinateSize += 5;

    return 1 + 4 + 4 + (this.points.length * coordinateSize);
};

MultiPoint.prototype.toGeoJSON = function (options) {
    var geoJSON = Geometry.prototype.toGeoJSON.call(this, options);
    geoJSON.type = Types.geoJSON.MultiPoint;
    geoJSON.coordinates = [];

    for (var i = 0; i < this.points.length; i++)
        geoJSON.coordinates.push(this.points[i].toGeoJSON().coordinates);

    return geoJSON;
};

},{"./binarywriter":3,"./geometry":4,"./point":10,"./types":12,"./zigzag":15,"util":23}],9:[function(require,module,exports){
module.exports = MultiPolygon;

var util = require('util');

var Types = require('./types');
var Geometry = require('./geometry');
var Point = require('./point');
var Polygon = require('./polygon');
var BinaryWriter = require('./binarywriter');
var ZigZag = require('./zigzag.js');

function MultiPolygon(polygons) {
    Geometry.call(this);

    this.polygons = polygons || [];
}

util.inherits(MultiPolygon, Geometry);

MultiPolygon.Z = function (polygons) {
    var multiPolygon = new MultiPolygon(polygons);
    multiPolygon.hasZ = true;
    return multiPolygon;
};

MultiPolygon.M = function (polygons) {
    var multiPolygon = new MultiPolygon(polygons);
    multiPolygon.hasM = true;
    return multiPolygon;
};

MultiPolygon.ZM = function (polygons) {
    var multiPolygon = new MultiPolygon(polygons);
    multiPolygon.hasZ = true;
    multiPolygon.hasM = true;
    return multiPolygon;
};

MultiPolygon._parseWkt = function (value, options) {
    var multiPolygon = new MultiPolygon();
    multiPolygon.srid = options.srid;
    multiPolygon.hasZ = options.hasZ;
    multiPolygon.hasM = options.hasM;

    if (value.isMatch(['EMPTY']))
        return multiPolygon;

    value.expectGroupStart();

    do {
        value.expectGroupStart();

        var exteriorRing = [];
        var interiorRings = [];

        value.expectGroupStart();
        exteriorRing.push.apply(exteriorRing, value.matchCoordinates(options));
        value.expectGroupEnd();

        while (value.isMatch([','])) {
            value.expectGroupStart();
            interiorRings.push(value.matchCoordinates(options));
            value.expectGroupEnd();
        }

        multiPolygon.polygons.push(new Polygon(exteriorRing, interiorRings));

        value.expectGroupEnd();

    } while (value.isMatch([',']));

    value.expectGroupEnd();

    return multiPolygon;
};

MultiPolygon._parseWkb = function (value, options) {
    var multiPolygon = new MultiPolygon();
    multiPolygon.srid = options.srid;
    multiPolygon.hasZ = options.hasZ;
    multiPolygon.hasM = options.hasM;

    var polygonCount = value.readUInt32();

    for (var i = 0; i < polygonCount; i++)
        multiPolygon.polygons.push(Geometry.parse(value, options));

    return multiPolygon;
};

MultiPolygon._parseTwkb = function (value, options) {
    var multiPolygon = new MultiPolygon();
    multiPolygon.hasZ = options.hasZ;
    multiPolygon.hasM = options.hasM;

    if (options.isEmpty)
        return multiPolygon;

    var previousPoint = new Point(0, 0, options.hasZ ? 0 : undefined, options.hasM ? 0 : undefined);
    var polygonCount = value.readVarInt();

    for (var i = 0; i < polygonCount; i++) {
        var polygon = new Polygon();
        polygon.hasZ = options.hasZ;
        polygon.hasM = options.hasM;

        var ringCount = value.readVarInt();
        var exteriorRingCount = value.readVarInt();

        for (var j = 0; j < exteriorRingCount; j++)
            polygon.exteriorRing.push(Point._readTwkbPoint(value, options, previousPoint));

        for (j = 1; j < ringCount; j++) {
            var interiorRing = [];

            var interiorRingCount = value.readVarInt();

            for (var k = 0; k < interiorRingCount; k++)
                interiorRing.push(Point._readTwkbPoint(value, options, previousPoint));

            polygon.interiorRings.push(interiorRing);
        }

        multiPolygon.polygons.push(polygon);
    }

    return multiPolygon;
};

MultiPolygon._parseGeoJSON = function (value) {
    var multiPolygon = new MultiPolygon();

    if (value.coordinates.length > 0 && value.coordinates[0].length > 0 && value.coordinates[0][0].length > 0)
        multiPolygon.hasZ = value.coordinates[0][0][0].length > 2;

    for (var i = 0; i < value.coordinates.length; i++)
        multiPolygon.polygons.push(Polygon._parseGeoJSON({ coordinates: value.coordinates[i] }));

    return multiPolygon;
};

MultiPolygon.prototype.toWkt = function () {
    if (this.polygons.length === 0)
        return this._getWktType(Types.wkt.MultiPolygon, true);

    var wkt = this._getWktType(Types.wkt.MultiPolygon, false) + '(';

    for (var i = 0; i < this.polygons.length; i++)
        wkt += this.polygons[i]._toInnerWkt() + ',';

    wkt = wkt.slice(0, -1);
    wkt += ')';

    return wkt;
};

MultiPolygon.prototype.toWkb = function () {
    var wkb = new BinaryWriter(this._getWkbSize());

    wkb.writeInt8(1);

    this._writeWkbType(wkb, Types.wkb.MultiPolygon);
    wkb.writeUInt32LE(this.polygons.length);

    for (var i = 0; i < this.polygons.length; i++)
        wkb.writeBuffer(this.polygons[i].toWkb({ srid: this.srid }));

    return wkb.buffer;
};

MultiPolygon.prototype.toTwkb = function () {
    var twkb = new BinaryWriter(0, true);

    var precision = Geometry.getTwkbPrecision(5, 0, 0);
    var isEmpty = this.polygons.length === 0;

    this._writeTwkbHeader(twkb, Types.wkb.MultiPolygon, precision, isEmpty);

    if (this.polygons.length > 0) {
        twkb.writeVarInt(this.polygons.length);

        var previousPoint = new Point(0, 0, 0, 0);
        for (var i = 0; i < this.polygons.length; i++) {
            twkb.writeVarInt(1 + this.polygons[i].interiorRings.length);

            twkb.writeVarInt(this.polygons[i].exteriorRing.length);

            for (var j = 0; j < this.polygons[i].exteriorRing.length; j++)
                this.polygons[i].exteriorRing[j]._writeTwkbPoint(twkb, precision, previousPoint);

            for (j = 0; j < this.polygons[i].interiorRings.length; j++) {
                twkb.writeVarInt(this.polygons[i].interiorRings[j].length);

                for (var k = 0; k < this.polygons[i].interiorRings[j].length; k++)
                    this.polygons[i].interiorRings[j][k]._writeTwkbPoint(twkb, precision, previousPoint);
            }
        }
    }

    return twkb.buffer;
};

MultiPolygon.prototype._getWkbSize = function () {
    var size = 1 + 4 + 4;

    for (var i = 0; i < this.polygons.length; i++)
        size += this.polygons[i]._getWkbSize();

    return size;
};

MultiPolygon.prototype.toGeoJSON = function (options) {
    var geoJSON = Geometry.prototype.toGeoJSON.call(this, options);
    geoJSON.type = Types.geoJSON.MultiPolygon;
    geoJSON.coordinates = [];

    for (var i = 0; i < this.polygons.length; i++)
        geoJSON.coordinates.push(this.polygons[i].toGeoJSON().coordinates);

    return geoJSON;
};

},{"./binarywriter":3,"./geometry":4,"./point":10,"./polygon":11,"./types":12,"./zigzag.js":15,"util":23}],10:[function(require,module,exports){
module.exports = Point;

var util = require('util');

var Geometry = require('./geometry');
var Types = require('./types');
var BinaryWriter = require('./binarywriter');
var ZigZag = require('./zigzag.js');

function Point(x, y, z, m) {
    Geometry.call(this);

    this.x = x;
    this.y = y;
    this.z = z;
    this.m = m;

    this.hasZ = typeof this.z !== 'undefined';
    this.hasM = typeof this.m !== 'undefined';
}

util.inherits(Point, Geometry);

Point.Z = function (x, y, z) {
    var point = new Point(x, y, z);
    point.hasZ = true;
    return point;
};

Point.M = function (x, y, m) {
    var point = new Point(x, y, undefined, m);
    point.hasM = true;
    return point;
};

Point.ZM = function (x, y, z, m) {
    var point = new Point(x, y, z, m);
    point.hasZ = true;
    point.hasM = true;
    return point;
};

Point._parseWkt = function (value, options) {
    var point = new Point();
    point.srid = options.srid;
    point.hasZ = options.hasZ;
    point.hasM = options.hasM;

    if (value.isMatch(['EMPTY']))
        return point;

    value.expectGroupStart();

    var coordinate = value.matchCoordinate(options);

    point.x = coordinate.x;
    point.y = coordinate.y;
    point.z = coordinate.z;
    point.m = coordinate.m;

    value.expectGroupEnd();

    return point;
};

Point._parseWkb = function (value, options) {
    var point = Point._readWkbPoint(value, options);
    point.srid = options.srid;
    return point;
};

Point._readWkbPoint = function (value, options) {
    return new Point(value.readDouble(), value.readDouble(),
        options.hasZ ? value.readDouble() : undefined,
        options.hasM ? value.readDouble() : undefined);
};

Point._parseTwkb = function (value, options) {
    var point = new Point();
    point.hasZ = options.hasZ;
    point.hasM = options.hasM;

    if (options.isEmpty)
        return point;

    point.x = ZigZag.decode(value.readVarInt()) / options.precisionFactor;
    point.y = ZigZag.decode(value.readVarInt()) / options.precisionFactor;
    point.z = options.hasZ ? ZigZag.decode(value.readVarInt()) / options.zPrecisionFactor : undefined;
    point.m = options.hasM ? ZigZag.decode(value.readVarInt()) / options.mPrecisionFactor : undefined;

    return point;
};

Point._readTwkbPoint = function (value, options, previousPoint) {
    previousPoint.x += ZigZag.decode(value.readVarInt()) / options.precisionFactor;
    previousPoint.y += ZigZag.decode(value.readVarInt()) / options.precisionFactor;

    if (options.hasZ)
        previousPoint.z += ZigZag.decode(value.readVarInt()) / options.zPrecisionFactor;
    if (options.hasM)
        previousPoint.m += ZigZag.decode(value.readVarInt()) / options.mPrecisionFactor;

    return new Point(previousPoint.x, previousPoint.y, previousPoint.z, previousPoint.m);
};

Point._parseGeoJSON = function (value) {
    return Point._readGeoJSONPoint(value.coordinates);
};

Point._readGeoJSONPoint = function (coordinates) {
    if (coordinates.length === 0)
        return new Point();

    if (coordinates.length > 2)
        return new Point(coordinates[0], coordinates[1], coordinates[2]);

    return new Point(coordinates[0], coordinates[1]);
};

Point.prototype.toWkt = function () {
    if (typeof this.x === 'undefined' && typeof this.y === 'undefined' &&
        typeof this.z === 'undefined' && typeof this.m === 'undefined')
        return this._getWktType(Types.wkt.Point, true);

    return this._getWktType(Types.wkt.Point, false) + '(' + this._getWktCoordinate(this) + ')';
};

Point.prototype.toWkb = function (parentOptions) {
    var wkb = new BinaryWriter(this._getWkbSize());

    wkb.writeInt8(1);

    if (typeof this.x === 'undefined' && typeof this.y === 'undefined') {
        this._writeWkbType(wkb, Types.wkb.MultiPoint, parentOptions);
        wkb.writeUInt32LE(0);
    }
    else {
        this._writeWkbType(wkb, Types.wkb.Point, parentOptions);
        this._writeWkbPoint(wkb);
    }

    return wkb.buffer;
};

Point.prototype._writeWkbPoint = function (wkb) {
    wkb.writeDoubleLE(this.x);
    wkb.writeDoubleLE(this.y);

    if (this.hasZ)
        wkb.writeDoubleLE(this.z);
    if (this.hasM)
        wkb.writeDoubleLE(this.m);
};

Point.prototype.toTwkb = function () {
    var twkb = new BinaryWriter(0, true);

    var precision = Geometry.getTwkbPrecision(5, 0, 0);
    var isEmpty = typeof this.x === 'undefined' && typeof this.y === 'undefined';

    this._writeTwkbHeader(twkb, Types.wkb.Point, precision, isEmpty);

    if (!isEmpty)
        this._writeTwkbPoint(twkb, precision, new Point(0, 0, 0, 0));

    return twkb.buffer;
};

Point.prototype._writeTwkbPoint = function (twkb, precision, previousPoint) {
    var x = this.x * precision.xyFactor;
    var y = this.y * precision.xyFactor;
    var z = this.z * precision.zFactor;
    var m = this.m * precision.mFactor;

    twkb.writeVarInt(ZigZag.encode(x - previousPoint.x));
    twkb.writeVarInt(ZigZag.encode(y - previousPoint.y));
    if (this.hasZ)
        twkb.writeVarInt(ZigZag.encode(z - previousPoint.z));
    if (this.hasM)
        twkb.writeVarInt(ZigZag.encode(m - previousPoint.m));

    previousPoint.x = x;
    previousPoint.y = y;
    previousPoint.z = z;
    previousPoint.m = m;
};

Point.prototype._getWkbSize = function () {
    if (typeof this.x === 'undefined' && typeof this.y === 'undefined')
        return 1 + 4 + 4;

    var size = 1 + 4 + 8 + 8;

    if (this.hasZ)
        size += 8;
    if (this.hasM)
        size += 8;

    return size;
};

Point.prototype.toGeoJSON = function (options) {
    var geoJSON = Geometry.prototype.toGeoJSON.call(this, options);
    geoJSON.type = Types.geoJSON.Point;

    if (typeof this.x === 'undefined' && typeof this.y === 'undefined')
        geoJSON.coordinates = [];
    else if (typeof this.z !== 'undefined')
        geoJSON.coordinates = [this.x, this.y, this.z];
    else
        geoJSON.coordinates = [this.x, this.y];

    return geoJSON;
};

},{"./binarywriter":3,"./geometry":4,"./types":12,"./zigzag.js":15,"util":23}],11:[function(require,module,exports){
module.exports = Polygon;

var util = require('util');

var Geometry = require('./geometry');
var Types = require('./types');
var Point = require('./point');
var BinaryWriter = require('./binarywriter');
var ZigZag = require('./zigzag');

function Polygon(exteriorRing, interiorRings) {
    Geometry.call(this);

    this.exteriorRing = exteriorRing || [];
    this.interiorRings = interiorRings || [];

    if (this.exteriorRing.length > 0) {
        this.hasZ = this.exteriorRing[0].hasZ;
        this.hasM = this.exteriorRing[0].hasM;
    }
}

util.inherits(Polygon, Geometry);

Polygon.Z = function (exteriorRing, interiorRings) {
    var polygon = new Polygon(exteriorRing, interiorRings);
    polygon.hasZ = true;
    return polygon;
};

Polygon.M = function (exteriorRing, interiorRings) {
    var polygon = new Polygon(exteriorRing, interiorRings);
    polygon.hasM = true;
    return polygon;
};

Polygon.ZM = function (exteriorRing, interiorRings) {
    var polygon = new Polygon(exteriorRing, interiorRings);
    polygon.hasZ = true;
    polygon.hasM = true;
    return polygon;
};

Polygon._parseWkt = function (value, options) {
    var polygon = new Polygon();
    polygon.srid = options.srid;
    polygon.hasZ = options.hasZ;
    polygon.hasM = options.hasM;

    if (value.isMatch(['EMPTY']))
        return polygon;

    value.expectGroupStart();

    value.expectGroupStart();
    polygon.exteriorRing.push.apply(polygon.exteriorRing, value.matchCoordinates(options));
    value.expectGroupEnd();

    while (value.isMatch([','])) {
        value.expectGroupStart();
        polygon.interiorRings.push(value.matchCoordinates(options));
        value.expectGroupEnd();
    }

    value.expectGroupEnd();

    return polygon;
};

Polygon._parseWkb = function (value, options) {
    var polygon = new Polygon();
    polygon.srid = options.srid;
    polygon.hasZ = options.hasZ;
    polygon.hasM = options.hasM;

    var ringCount = value.readUInt32();

    if (ringCount > 0) {
        var exteriorRingCount = value.readUInt32();

        for (var i = 0; i < exteriorRingCount; i++)
            polygon.exteriorRing.push(Point._readWkbPoint(value, options));

        for (i = 1; i < ringCount; i++) {
            var interiorRing = [];

            var interiorRingCount = value.readUInt32();

            for (var j = 0; j < interiorRingCount; j++)
                interiorRing.push(Point._readWkbPoint(value, options));

            polygon.interiorRings.push(interiorRing);
        }
    }

    return polygon;
};

Polygon._parseTwkb = function (value, options) {
    var polygon = new Polygon();
    polygon.hasZ = options.hasZ;
    polygon.hasM = options.hasM;

    if (options.isEmpty)
        return polygon;

    var previousPoint = new Point(0, 0, options.hasZ ? 0 : undefined, options.hasM ? 0 : undefined);
    var ringCount = value.readVarInt();
    var exteriorRingCount = value.readVarInt();

    for (var i = 0; i < exteriorRingCount; i++)
        polygon.exteriorRing.push(Point._readTwkbPoint(value, options, previousPoint));

    for (i = 1; i < ringCount; i++) {
        var interiorRing = [];

        var interiorRingCount = value.readVarInt();

        for (var j = 0; j < interiorRingCount; j++)
            interiorRing.push(Point._readTwkbPoint(value, options, previousPoint));

        polygon.interiorRings.push(interiorRing);
    }

    return polygon;
};

Polygon._parseGeoJSON = function (value) {
    var polygon = new Polygon();

    if (value.coordinates.length > 0 && value.coordinates[0].length > 0)
        polygon.hasZ = value.coordinates[0][0].length > 2;

    for (var i = 0; i < value.coordinates.length; i++) {
        if (i > 0)
            polygon.interiorRings.push([]);

        for (var j = 0; j  < value.coordinates[i].length; j++) {
            if (i === 0)
                polygon.exteriorRing.push(Point._readGeoJSONPoint(value.coordinates[i][j]));
            else
                polygon.interiorRings[i - 1].push(Point._readGeoJSONPoint(value.coordinates[i][j]));
        }
    }

    return polygon;
};

Polygon.prototype.toWkt = function () {
    if (this.exteriorRing.length === 0)
        return this._getWktType(Types.wkt.Polygon, true);

    return this._getWktType(Types.wkt.Polygon, false) + this._toInnerWkt();
};

Polygon.prototype._toInnerWkt = function () {
    var innerWkt = '((';

    for (var i = 0; i < this.exteriorRing.length; i++)
        innerWkt += this._getWktCoordinate(this.exteriorRing[i]) + ',';

    innerWkt = innerWkt.slice(0, -1);
    innerWkt += ')';

    for (i = 0; i < this.interiorRings.length; i++) {
        innerWkt += ',(';

        for (var j = 0; j < this.interiorRings[i].length; j++) {
            innerWkt += this._getWktCoordinate(this.interiorRings[i][j]) + ',';
        }

        innerWkt = innerWkt.slice(0, -1);
        innerWkt += ')';
    }

    innerWkt += ')';

    return innerWkt;
};

Polygon.prototype.toWkb = function (parentOptions) {
    var wkb = new BinaryWriter(this._getWkbSize());

    wkb.writeInt8(1);

    this._writeWkbType(wkb, Types.wkb.Polygon, parentOptions);

    if (this.exteriorRing.length > 0) {
        wkb.writeUInt32LE(1 + this.interiorRings.length);
        wkb.writeUInt32LE(this.exteriorRing.length);
    }
    else {
        wkb.writeUInt32LE(0);
    }

    for (var i = 0; i < this.exteriorRing.length; i++)
        this.exteriorRing[i]._writeWkbPoint(wkb);

    for (i = 0; i < this.interiorRings.length; i++) {
        wkb.writeUInt32LE(this.interiorRings[i].length);

        for (var j = 0; j < this.interiorRings[i].length; j++)
            this.interiorRings[i][j]._writeWkbPoint(wkb);
    }

    return wkb.buffer;
};

Polygon.prototype.toTwkb = function () {
    var twkb = new BinaryWriter(0, true);

    var precision = Geometry.getTwkbPrecision(5, 0, 0);
    var isEmpty = this.exteriorRing.length === 0;

    this._writeTwkbHeader(twkb, Types.wkb.Polygon, precision, isEmpty);

    if (this.exteriorRing.length > 0) {
        twkb.writeVarInt(1 + this.interiorRings.length);

        twkb.writeVarInt(this.exteriorRing.length);

        var previousPoint = new Point(0, 0, 0, 0);
        for (var i = 0; i < this.exteriorRing.length; i++)
            this.exteriorRing[i]._writeTwkbPoint(twkb, precision, previousPoint);

        for (i = 0; i < this.interiorRings.length; i++) {
            twkb.writeVarInt(this.interiorRings[i].length);

            for (var j = 0; j < this.interiorRings[i].length; j++)
                this.interiorRings[i][j]._writeTwkbPoint(twkb, precision, previousPoint);
        }
    }

    return twkb.buffer;
};

Polygon.prototype._getWkbSize = function () {
    var coordinateSize = 16;

    if (this.hasZ)
        coordinateSize += 8;
    if (this.hasM)
        coordinateSize += 8;

    var size = 1 + 4 + 4;

    if (this.exteriorRing.length > 0)
        size += 4 + (this.exteriorRing.length * coordinateSize);

    for (var i = 0; i < this.interiorRings.length; i++)
        size += 4 + (this.interiorRings[i].length * coordinateSize);

    return size;
};

Polygon.prototype.toGeoJSON = function (options) {
    var geoJSON = Geometry.prototype.toGeoJSON.call(this, options);
    geoJSON.type = Types.geoJSON.Polygon;
    geoJSON.coordinates = [];

    if (this.exteriorRing.length > 0) {
        var exteriorRing = [];

        for (var i = 0; i < this.exteriorRing.length; i++) {
            if (this.hasZ)
                exteriorRing.push([this.exteriorRing[i].x, this.exteriorRing[i].y, this.exteriorRing[i].z]);
            else
                exteriorRing.push([this.exteriorRing[i].x, this.exteriorRing[i].y]);
        }

        geoJSON.coordinates.push(exteriorRing);
    }

    for (var j = 0; j < this.interiorRings.length; j++) {
        var interiorRing = [];

        for (var k = 0; k < this.interiorRings[j].length; k++) {
            if (this.hasZ)
                interiorRing.push([this.interiorRings[j][k].x, this.interiorRings[j][k].y, this.interiorRings[j][k].z]);
            else
                interiorRing.push([this.interiorRings[j][k].x, this.interiorRings[j][k].y]);
        }

        geoJSON.coordinates.push(interiorRing);
    }

    return geoJSON;
};

},{"./binarywriter":3,"./geometry":4,"./point":10,"./types":12,"./zigzag":15,"util":23}],12:[function(require,module,exports){
module.exports = {
    wkt: {
        Point: 'POINT',
        LineString: 'LINESTRING',
        Polygon: 'POLYGON',
        MultiPoint: 'MULTIPOINT',
        MultiLineString: 'MULTILINESTRING',
        MultiPolygon: 'MULTIPOLYGON',
        GeometryCollection: 'GEOMETRYCOLLECTION'
    },
    wkb: {
        Point: 1,
        LineString: 2,
        Polygon: 3,
        MultiPoint: 4,
        MultiLineString: 5,
        MultiPolygon: 6,
        GeometryCollection: 7
    },
    geoJSON: {
        Point: 'Point',
        LineString: 'LineString',
        Polygon: 'Polygon',
        MultiPoint: 'MultiPoint',
        MultiLineString: 'MultiLineString',
        MultiPolygon: 'MultiPolygon',
        GeometryCollection: 'GeometryCollection'
    }
};

},{}],13:[function(require,module,exports){
module.exports = WktParser;

var Types = require('./types');
var Point = require('./point');

function WktParser(value) {
    this.value = value;
    this.position = 0;
}

WktParser.prototype.match = function (tokens) {
    this.skipWhitespaces();

    for (var i = 0; i < tokens.length; i++) {
        if (this.value.substring(this.position).indexOf(tokens[i]) === 0) {
            this.position += tokens[i].length;
            return tokens[i];
        }
    }

    return null;
};

WktParser.prototype.matchRegex = function (tokens) {
    this.skipWhitespaces();

    for (var i = 0; i < tokens.length; i++) {
        var match = this.value.substring(this.position).match(tokens[i]);

        if (match) {
            this.position += match[0].length;
            return match;
        }
    }

    return null;
};

WktParser.prototype.isMatch = function (tokens) {
    this.skipWhitespaces();

    for (var i = 0; i < tokens.length; i++) {
        if (this.value.substring(this.position).indexOf(tokens[i]) === 0) {
            this.position += tokens[i].length;
            return true;
        }
    }

    return false;
};

WktParser.prototype.matchType = function () {
    var geometryType = this.match([Types.wkt.Point, Types.wkt.LineString, Types.wkt.Polygon, Types.wkt.MultiPoint,
                                   Types.wkt.MultiLineString, Types.wkt.MultiPolygon, Types.wkt.GeometryCollection]);

    if (!geometryType)
        throw new Error('Expected geometry type');

    return geometryType;
};

WktParser.prototype.matchDimension = function () {
    var dimension = this.match(['ZM', 'Z', 'M']);

    switch (dimension) {
        case 'ZM': return { hasZ: true, hasM: true };
        case 'Z': return { hasZ: true, hasM: false };
        case 'M': return { hasZ: false, hasM: true };
        default: return { hasZ: false, hasM: false };
    }
};

WktParser.prototype.expectGroupStart = function () {
    if (!this.isMatch(['(']))
        throw new Error('Expected group start');
};

WktParser.prototype.expectGroupEnd = function () {
    if (!this.isMatch([')']))
        throw new Error('Expected group end');
};

WktParser.prototype.matchCoordinate = function (options) {
    var match;

    if (options.hasZ && options.hasM)
        match = this.matchRegex([/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/]);
    else if (options.hasZ || options.hasM)
        match = this.matchRegex([/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/]);
    else
        match = this.matchRegex([/^(-?\d+\.?\d*)\s+(-?\d+\.?\d*)/]);

    if (!match)
        throw new Error('Expected coordinates');

    if (options.hasZ && options.hasM)
        return new Point(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]), parseFloat(match[4]));
    else if (options.hasZ)
        return new Point(parseFloat(match[1]), parseFloat(match[2]), parseFloat(match[3]));
    else if (options.hasM)
        return new Point(parseFloat(match[1]), parseFloat(match[2]), undefined, parseFloat(match[3]));
    else
        return new Point(parseFloat(match[1]), parseFloat(match[2]));
};

WktParser.prototype.matchCoordinates = function (options) {
    var coordinates = [];

    do {
        var startsWithBracket = this.isMatch(['(']);

        coordinates.push(this.matchCoordinate(options));

        if (startsWithBracket)
            this.expectGroupEnd();
    } while (this.isMatch([',']));

    return coordinates;
};

WktParser.prototype.skipWhitespaces = function () {
    while (this.position < this.value.length && this.value[this.position] === ' ')
        this.position++;
};

},{"./point":10,"./types":12}],14:[function(require,module,exports){
exports.Types = require('./types');
exports.Geometry = require('./geometry');
exports.Point = require('./point');
exports.LineString = require('./linestring');
exports.Polygon = require('./polygon');
exports.MultiPoint = require('./multipoint');
exports.MultiLineString = require('./multilinestring');
exports.MultiPolygon = require('./multipolygon');
exports.GeometryCollection = require('./geometrycollection');
},{"./geometry":4,"./geometrycollection":5,"./linestring":6,"./multilinestring":7,"./multipoint":8,"./multipolygon":9,"./point":10,"./polygon":11,"./types":12}],15:[function(require,module,exports){
module.exports = {
    encode: function (value) {
        return (value << 1) ^ (value >> 31);
    },
    decode: function (value) {
        return (value >> 1) ^ (-(value & 1));
    }
};

},{}],16:[function(require,module,exports){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <feross@feross.org> <http://feross.org>
 * @license  MIT
 */

var base64 = require('base64-js')
var ieee754 = require('ieee754')
var isArray = require('is-array')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50
Buffer.poolSize = 8192 // not used by this implementation

var kMaxLength = 0x3fffffff
var rootParent = {}

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Use Object implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * Note:
 *
 * - Implementation must support adding new properties to `Uint8Array` instances.
 *   Firefox 4-29 lacked support, fixed in Firefox 30+.
 *   See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438.
 *
 *  - Chrome 9-10 is missing the `TypedArray.prototype.subarray` function.
 *
 *  - IE10 has a broken `TypedArray.prototype.subarray` function which returns arrays of
 *    incorrect length in some situations.
 *
 * We detect these buggy browsers and set `Buffer.TYPED_ARRAY_SUPPORT` to `false` so they will
 * get the Object implementation, which is slower but will work correctly.
 */
Buffer.TYPED_ARRAY_SUPPORT = (function () {
  try {
    var buf = new ArrayBuffer(0)
    var arr = new Uint8Array(buf)
    arr.foo = function () { return 42 }
    return 42 === arr.foo() && // typed array instances can be augmented
        typeof arr.subarray === 'function' && // chrome 9-10 lack `subarray`
        new Uint8Array(1).subarray(1, 1).byteLength === 0 // ie10 has broken `subarray`
  } catch (e) {
    return false
  }
})()

/**
 * Class: Buffer
 * =============
 *
 * The Buffer constructor returns instances of `Uint8Array` that are augmented
 * with function properties for all the node `Buffer` API functions. We use
 * `Uint8Array` so that square bracket notation works as expected -- it returns
 * a single octet.
 *
 * By augmenting the instances, we can avoid modifying the `Uint8Array`
 * prototype.
 */
function Buffer (subject, encoding, noZero) {
  if (!(this instanceof Buffer))
    return new Buffer(subject, encoding, noZero)

  var type = typeof subject

  // Find the length
  var length
  if (type === 'number')
    length = subject > 0 ? subject >>> 0 : 0
  else if (type === 'string') {
    length = Buffer.byteLength(subject, encoding)
  } else if (type === 'object' && subject !== null) { // assume object is array-like
    if (subject.type === 'Buffer' && isArray(subject.data))
      subject = subject.data
    length = +subject.length > 0 ? Math.floor(+subject.length) : 0
  } else
    throw new TypeError('must start with number, buffer, array or string')

  if (length > kMaxLength)
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
      'size: 0x' + kMaxLength.toString(16) + ' bytes')

  var buf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    // Preferred: Return an augmented `Uint8Array` instance for best performance
    buf = Buffer._augment(new Uint8Array(length))
  } else {
    // Fallback: Return THIS instance of Buffer (created by `new`)
    buf = this
    buf.length = length
    buf._isBuffer = true
  }

  var i
  if (Buffer.TYPED_ARRAY_SUPPORT && typeof subject.byteLength === 'number') {
    // Speed optimization -- use set if we're copying from a typed array
    buf._set(subject)
  } else if (isArrayish(subject)) {
    // Treat array-ish objects as a byte array
    if (Buffer.isBuffer(subject)) {
      for (i = 0; i < length; i++)
        buf[i] = subject.readUInt8(i)
    } else {
      for (i = 0; i < length; i++)
        buf[i] = ((subject[i] % 256) + 256) % 256
    }
  } else if (type === 'string') {
    buf.write(subject, 0, encoding)
  } else if (type === 'number' && !Buffer.TYPED_ARRAY_SUPPORT && !noZero) {
    for (i = 0; i < length; i++) {
      buf[i] = 0
    }
  }

  if (length > 0 && length <= Buffer.poolSize)
    buf.parent = rootParent

  return buf
}

function SlowBuffer(subject, encoding, noZero) {
  if (!(this instanceof SlowBuffer))
    return new SlowBuffer(subject, encoding, noZero)

  var buf = new Buffer(subject, encoding, noZero)
  delete buf.parent
  return buf
}

Buffer.isBuffer = function (b) {
  return !!(b != null && b._isBuffer)
}

Buffer.compare = function (a, b) {
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b))
    throw new TypeError('Arguments must be Buffers')

  var x = a.length
  var y = b.length
  for (var i = 0, len = Math.min(x, y); i < len && a[i] === b[i]; i++) {}
  if (i !== len) {
    x = a[i]
    y = b[i]
  }
  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'binary':
    case 'base64':
    case 'raw':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function (list, totalLength) {
  if (!isArray(list)) throw new TypeError('Usage: Buffer.concat(list[, length])')

  if (list.length === 0) {
    return new Buffer(0)
  } else if (list.length === 1) {
    return list[0]
  }

  var i
  if (totalLength === undefined) {
    totalLength = 0
    for (i = 0; i < list.length; i++) {
      totalLength += list[i].length
    }
  }

  var buf = new Buffer(totalLength)
  var pos = 0
  for (i = 0; i < list.length; i++) {
    var item = list[i]
    item.copy(buf, pos)
    pos += item.length
  }
  return buf
}

Buffer.byteLength = function (str, encoding) {
  var ret
  str = str + ''
  switch (encoding || 'utf8') {
    case 'ascii':
    case 'binary':
    case 'raw':
      ret = str.length
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = str.length * 2
      break
    case 'hex':
      ret = str.length >>> 1
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8ToBytes(str).length
      break
    case 'base64':
      ret = base64ToBytes(str).length
      break
    default:
      ret = str.length
  }
  return ret
}

// pre-set for values that may exist in the future
Buffer.prototype.length = undefined
Buffer.prototype.parent = undefined

// toString(encoding, start=0, end=buffer.length)
Buffer.prototype.toString = function (encoding, start, end) {
  var loweredCase = false

  start = start >>> 0
  end = end === undefined || end === Infinity ? this.length : end >>> 0

  if (!encoding) encoding = 'utf8'
  if (start < 0) start = 0
  if (end > this.length) end = this.length
  if (end <= start) return ''

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'binary':
        return binarySlice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase)
          throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.equals = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  if (this.length > 0) {
    str = this.toString('hex', 0, max).match(/.{2}/g).join(' ')
    if (this.length > max)
      str += ' ... '
  }
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  return Buffer.compare(this, b)
}

// `get` will be removed in Node 0.13+
Buffer.prototype.get = function (offset) {
  console.log('.get() is deprecated. Access using array indexes instead.')
  return this.readUInt8(offset)
}

// `set` will be removed in Node 0.13+
Buffer.prototype.set = function (v, offset) {
  console.log('.set() is deprecated. Access using array indexes instead.')
  return this.writeUInt8(v, offset)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  // must be an even number of digits
  var strLen = string.length
  if (strLen % 2 !== 0) throw new Error('Invalid hex string')

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; i++) {
    var byte = parseInt(string.substr(i * 2, 2), 16)
    if (isNaN(byte)) throw new Error('Invalid hex string')
    buf[offset + i] = byte
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
  return charsWritten
}

function asciiWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(asciiToBytes(string), buf, offset, length)
  return charsWritten
}

function binaryWrite (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  var charsWritten = blitBuffer(base64ToBytes(string), buf, offset, length)
  return charsWritten
}

function utf16leWrite (buf, string, offset, length) {
  var charsWritten = blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length, 2)
  return charsWritten
}

Buffer.prototype.write = function (string, offset, length, encoding) {
  // Support both (string, offset, length, encoding)
  // and the legacy (string, encoding, offset, length)
  if (isFinite(offset)) {
    if (!isFinite(length)) {
      encoding = length
      length = undefined
    }
  } else {  // legacy
    var swap = encoding
    encoding = offset
    offset = length
    length = swap
  }

  offset = Number(offset) || 0

  if (length < 0 || offset < 0 || offset > this.length)
    throw new RangeError('attempt to write outside buffer bounds');

  var remaining = this.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }
  encoding = String(encoding || 'utf8').toLowerCase()

  var ret
  switch (encoding) {
    case 'hex':
      ret = hexWrite(this, string, offset, length)
      break
    case 'utf8':
    case 'utf-8':
      ret = utf8Write(this, string, offset, length)
      break
    case 'ascii':
      ret = asciiWrite(this, string, offset, length)
      break
    case 'binary':
      ret = binaryWrite(this, string, offset, length)
      break
    case 'base64':
      ret = base64Write(this, string, offset, length)
      break
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      ret = utf16leWrite(this, string, offset, length)
      break
    default:
      throw new TypeError('Unknown encoding: ' + encoding)
  }
  return ret
}

Buffer.prototype.toJSON = function () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  var res = ''
  var tmp = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    if (buf[i] <= 0x7F) {
      res += decodeUtf8Char(tmp) + String.fromCharCode(buf[i])
      tmp = ''
    } else {
      tmp += '%' + buf[i].toString(16)
    }
  }

  return res + decodeUtf8Char(tmp)
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function binarySlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; i++) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; i++) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + bytes[i + 1] * 256)
  }
  return res
}

Buffer.prototype.slice = function (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len;
    if (start < 0)
      start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0)
      end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start)
    end = start

  var newBuf
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    newBuf = Buffer._augment(this.subarray(start, end))
  } else {
    var sliceLen = end - start
    newBuf = new Buffer(sliceLen, undefined, true)
    for (var i = 0; i < sliceLen; i++) {
      newBuf[i] = this[i + start]
    }
  }

  if (newBuf.length)
    newBuf.parent = this.parent || this

  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0)
    throw new RangeError('offset is not uint')
  if (offset + ext > length)
    throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100))
    val += this[offset + i] * mul

  return val
}

Buffer.prototype.readUIntBE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100))
    val += this[offset + --byteLength] * mul;

  return val
}

Buffer.prototype.readUInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
      ((this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      this[offset + 3])
}

Buffer.prototype.readIntLE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100))
    val += this[offset + i] * mul
  mul *= 0x80

  if (val >= mul)
    val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100))
    val += this[offset + --i] * mul
  mul *= 0x80

  if (val >= mul)
    val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80))
    return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16) |
      (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
      (this[offset + 1] << 16) |
      (this[offset + 2] << 8) |
      (this[offset + 3])
}

Buffer.prototype.readFloatLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function (offset, noAssert) {
  if (!noAssert)
    checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('buffer must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
}

Buffer.prototype.writeUIntLE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100))
    this[offset + i] = (value / mul) >>> 0 & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert)
    checkInt(this, value, offset, byteLength, Math.pow(2, 8 * byteLength), 0)

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100))
    this[offset + i] = (value / mul) >>> 0 & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0xff, 0)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  this[offset] = value
  return offset + 1
}

function objectWriteUInt16 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 2); i < j; i++) {
    buf[offset + i] = (value & (0xff << (8 * (littleEndian ? i : 1 - i)))) >>>
      (littleEndian ? i : 1 - i) * 8
  }
}

Buffer.prototype.writeUInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0xffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

function objectWriteUInt32 (buf, value, offset, littleEndian) {
  if (value < 0) value = 0xffffffff + value + 1
  for (var i = 0, j = Math.min(buf.length - offset, 4); i < j; i++) {
    buf[offset + i] = (value >>> (littleEndian ? i : 3 - i) * 8) & 0xff
  }
}

Buffer.prototype.writeUInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset + 3] = (value >>> 24)
    this[offset + 2] = (value >>> 16)
    this[offset + 1] = (value >>> 8)
    this[offset] = value
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0xffffffff, 0)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

Buffer.prototype.writeIntLE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkInt(this,
             value,
             offset,
             byteLength,
             Math.pow(2, 8 * byteLength - 1) - 1,
             -Math.pow(2, 8 * byteLength - 1))
  }

  var i = 0
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100))
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkInt(this,
             value,
             offset,
             byteLength,
             Math.pow(2, 8 * byteLength - 1) - 1,
             -Math.pow(2, 8 * byteLength - 1))
  }

  var i = byteLength - 1
  var mul = 1
  var sub = value < 0 ? 1 : 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100))
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (!Buffer.TYPED_ARRAY_SUPPORT) value = Math.floor(value)
  if (value < 0) value = 0xff + value + 1
  this[offset] = value
  return offset + 1
}

Buffer.prototype.writeInt16LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
  } else objectWriteUInt16(this, value, offset, true)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 8)
    this[offset + 1] = value
  } else objectWriteUInt16(this, value, offset, false)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = value
    this[offset + 1] = (value >>> 8)
    this[offset + 2] = (value >>> 16)
    this[offset + 3] = (value >>> 24)
  } else objectWriteUInt32(this, value, offset, true)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert)
    checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  if (Buffer.TYPED_ARRAY_SUPPORT) {
    this[offset] = (value >>> 24)
    this[offset + 1] = (value >>> 16)
    this[offset + 2] = (value >>> 8)
    this[offset + 3] = value
  } else objectWriteUInt32(this, value, offset, false)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (value > max || value < min) throw new RangeError('value is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('index out of range')
  if (offset < 0) throw new RangeError('index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  if (!noAssert)
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function (target, target_start, start, end) {
  var source = this

  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (target_start >= target.length) target_start = target.length
  if (!target_start) target_start = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || source.length === 0) return 0

  // Fatal error conditions
  if (target_start < 0)
    throw new RangeError('targetStart out of bounds')
  if (start < 0 || start >= source.length) throw new RangeError('sourceStart out of bounds')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length)
    end = this.length
  if (target.length - target_start < end - start)
    end = target.length - target_start + start

  var len = end - start

  if (len < 1000 || !Buffer.TYPED_ARRAY_SUPPORT) {
    for (var i = 0; i < len; i++) {
      target[i + target_start] = this[i + start]
    }
  } else {
    target._set(this.subarray(start, start + len), target_start)
  }

  return len
}

// fill(value, start=0, end=buffer.length)
Buffer.prototype.fill = function (value, start, end) {
  if (!value) value = 0
  if (!start) start = 0
  if (!end) end = this.length

  if (end < start) throw new RangeError('end < start')

  // Fill 0 bytes; we're done
  if (end === start) return
  if (this.length === 0) return

  if (start < 0 || start >= this.length) throw new RangeError('start out of bounds')
  if (end < 0 || end > this.length) throw new RangeError('end out of bounds')

  var i
  if (typeof value === 'number') {
    for (i = start; i < end; i++) {
      this[i] = value
    }
  } else {
    var bytes = utf8ToBytes(value.toString())
    var len = bytes.length
    for (i = start; i < end; i++) {
      this[i] = bytes[i % len]
    }
  }

  return this
}

/**
 * Creates a new `ArrayBuffer` with the *copied* memory of the buffer instance.
 * Added in Node 0.12. Only available in browsers that support ArrayBuffer.
 */
Buffer.prototype.toArrayBuffer = function () {
  if (typeof Uint8Array !== 'undefined') {
    if (Buffer.TYPED_ARRAY_SUPPORT) {
      return (new Buffer(this)).buffer
    } else {
      var buf = new Uint8Array(this.length)
      for (var i = 0, len = buf.length; i < len; i += 1) {
        buf[i] = this[i]
      }
      return buf.buffer
    }
  } else {
    throw new TypeError('Buffer.toArrayBuffer not supported in this browser')
  }
}

// HELPER FUNCTIONS
// ================

var BP = Buffer.prototype

/**
 * Augment a Uint8Array *instance* (not the Uint8Array class!) with Buffer methods
 */
Buffer._augment = function (arr) {
  arr.constructor = Buffer
  arr._isBuffer = true

  // save reference to original Uint8Array get/set methods before overwriting
  arr._get = arr.get
  arr._set = arr.set

  // deprecated, will be removed in node 0.13+
  arr.get = BP.get
  arr.set = BP.set

  arr.write = BP.write
  arr.toString = BP.toString
  arr.toLocaleString = BP.toString
  arr.toJSON = BP.toJSON
  arr.equals = BP.equals
  arr.compare = BP.compare
  arr.copy = BP.copy
  arr.slice = BP.slice
  arr.readUIntLE = BP.readUIntLE
  arr.readUIntBE = BP.readUIntBE
  arr.readUInt8 = BP.readUInt8
  arr.readUInt16LE = BP.readUInt16LE
  arr.readUInt16BE = BP.readUInt16BE
  arr.readUInt32LE = BP.readUInt32LE
  arr.readUInt32BE = BP.readUInt32BE
  arr.readIntLE = BP.readIntLE
  arr.readIntBE = BP.readIntBE
  arr.readInt8 = BP.readInt8
  arr.readInt16LE = BP.readInt16LE
  arr.readInt16BE = BP.readInt16BE
  arr.readInt32LE = BP.readInt32LE
  arr.readInt32BE = BP.readInt32BE
  arr.readFloatLE = BP.readFloatLE
  arr.readFloatBE = BP.readFloatBE
  arr.readDoubleLE = BP.readDoubleLE
  arr.readDoubleBE = BP.readDoubleBE
  arr.writeUInt8 = BP.writeUInt8
  arr.writeUIntLE = BP.writeUIntLE
  arr.writeUIntBE = BP.writeUIntBE
  arr.writeUInt16LE = BP.writeUInt16LE
  arr.writeUInt16BE = BP.writeUInt16BE
  arr.writeUInt32LE = BP.writeUInt32LE
  arr.writeUInt32BE = BP.writeUInt32BE
  arr.writeIntLE = BP.writeIntLE
  arr.writeIntBE = BP.writeIntBE
  arr.writeInt8 = BP.writeInt8
  arr.writeInt16LE = BP.writeInt16LE
  arr.writeInt16BE = BP.writeInt16BE
  arr.writeInt32LE = BP.writeInt32LE
  arr.writeInt32BE = BP.writeInt32BE
  arr.writeFloatLE = BP.writeFloatLE
  arr.writeFloatBE = BP.writeFloatBE
  arr.writeDoubleLE = BP.writeDoubleLE
  arr.writeDoubleBE = BP.writeDoubleBE
  arr.fill = BP.fill
  arr.inspect = BP.inspect
  arr.toArrayBuffer = BP.toArrayBuffer

  return arr
}

var INVALID_BASE64_RE = /[^+\/0-9A-z\-]/g

function base64clean (str) {
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = stringtrim(str).replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function stringtrim (str) {
  if (str.trim) return str.trim()
  return str.replace(/^\s+|\s+$/g, '')
}

function isArrayish (subject) {
  return isArray(subject) || Buffer.isBuffer(subject) ||
      subject && typeof subject === 'object' &&
      typeof subject.length === 'number'
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes(string, units) {
  var codePoint, length = string.length
  var leadSurrogate = null
  units = units || Infinity
  var bytes = []
  var i = 0

  for (; i<length; i++) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {

      // last char was a lead
      if (leadSurrogate) {

        // 2 leads in a row
        if (codePoint < 0xDC00) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          leadSurrogate = codePoint
          continue
        }

        // valid surrogate pair
        else {
          codePoint = leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00 | 0x10000
          leadSurrogate = null
        }
      }

      // no lead yet
      else {

        // unexpected trail
        if (codePoint > 0xDBFF) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // unpaired lead
        else if (i + 1 === length) {
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        else {
          leadSurrogate = codePoint
          continue
        }
      }
    }

    // valid bmp char, but last char was a lead
    else if (leadSurrogate) {
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
      leadSurrogate = null
    }

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    }
    else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      );
    }
    else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    }
    else if (codePoint < 0x200000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      );
    }
    else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; i++) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; i++) {

    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length, unitSize) {
  if (unitSize) length -= length % unitSize;
  for (var i = 0; i < length; i++) {
    if ((i + offset >= dst.length) || (i >= src.length))
      break
    dst[i + offset] = src[i]
  }
  return i
}

function decodeUtf8Char (str) {
  try {
    return decodeURIComponent(str)
  } catch (err) {
    return String.fromCharCode(0xFFFD) // UTF 8 invalid char
  }
}

},{"base64-js":17,"ieee754":18,"is-array":19}],17:[function(require,module,exports){
var lookup = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

;(function (exports) {
	'use strict';

  var Arr = (typeof Uint8Array !== 'undefined')
    ? Uint8Array
    : Array

	var PLUS   = '+'.charCodeAt(0)
	var SLASH  = '/'.charCodeAt(0)
	var NUMBER = '0'.charCodeAt(0)
	var LOWER  = 'a'.charCodeAt(0)
	var UPPER  = 'A'.charCodeAt(0)
	var PLUS_URL_SAFE = '-'.charCodeAt(0)
	var SLASH_URL_SAFE = '_'.charCodeAt(0)

	function decode (elt) {
		var code = elt.charCodeAt(0)
		if (code === PLUS ||
		    code === PLUS_URL_SAFE)
			return 62 // '+'
		if (code === SLASH ||
		    code === SLASH_URL_SAFE)
			return 63 // '/'
		if (code < NUMBER)
			return -1 //no match
		if (code < NUMBER + 10)
			return code - NUMBER + 26 + 26
		if (code < UPPER + 26)
			return code - UPPER
		if (code < LOWER + 26)
			return code - LOWER + 26
	}

	function b64ToByteArray (b64) {
		var i, j, l, tmp, placeHolders, arr

		if (b64.length % 4 > 0) {
			throw new Error('Invalid string. Length must be a multiple of 4')
		}

		// the number of equal signs (place holders)
		// if there are two placeholders, than the two characters before it
		// represent one byte
		// if there is only one, then the three characters before it represent 2 bytes
		// this is just a cheap hack to not do indexOf twice
		var len = b64.length
		placeHolders = '=' === b64.charAt(len - 2) ? 2 : '=' === b64.charAt(len - 1) ? 1 : 0

		// base64 is 4/3 + up to two characters of the original data
		arr = new Arr(b64.length * 3 / 4 - placeHolders)

		// if there are placeholders, only get up to the last complete 4 chars
		l = placeHolders > 0 ? b64.length - 4 : b64.length

		var L = 0

		function push (v) {
			arr[L++] = v
		}

		for (i = 0, j = 0; i < l; i += 4, j += 3) {
			tmp = (decode(b64.charAt(i)) << 18) | (decode(b64.charAt(i + 1)) << 12) | (decode(b64.charAt(i + 2)) << 6) | decode(b64.charAt(i + 3))
			push((tmp & 0xFF0000) >> 16)
			push((tmp & 0xFF00) >> 8)
			push(tmp & 0xFF)
		}

		if (placeHolders === 2) {
			tmp = (decode(b64.charAt(i)) << 2) | (decode(b64.charAt(i + 1)) >> 4)
			push(tmp & 0xFF)
		} else if (placeHolders === 1) {
			tmp = (decode(b64.charAt(i)) << 10) | (decode(b64.charAt(i + 1)) << 4) | (decode(b64.charAt(i + 2)) >> 2)
			push((tmp >> 8) & 0xFF)
			push(tmp & 0xFF)
		}

		return arr
	}

	function uint8ToBase64 (uint8) {
		var i,
			extraBytes = uint8.length % 3, // if we have 1 byte left, pad 2 bytes
			output = "",
			temp, length

		function encode (num) {
			return lookup.charAt(num)
		}

		function tripletToBase64 (num) {
			return encode(num >> 18 & 0x3F) + encode(num >> 12 & 0x3F) + encode(num >> 6 & 0x3F) + encode(num & 0x3F)
		}

		// go through the array every three bytes, we'll deal with trailing stuff later
		for (i = 0, length = uint8.length - extraBytes; i < length; i += 3) {
			temp = (uint8[i] << 16) + (uint8[i + 1] << 8) + (uint8[i + 2])
			output += tripletToBase64(temp)
		}

		// pad the end with zeros, but make sure to not forget the extra bytes
		switch (extraBytes) {
			case 1:
				temp = uint8[uint8.length - 1]
				output += encode(temp >> 2)
				output += encode((temp << 4) & 0x3F)
				output += '=='
				break
			case 2:
				temp = (uint8[uint8.length - 2] << 8) + (uint8[uint8.length - 1])
				output += encode(temp >> 10)
				output += encode((temp >> 4) & 0x3F)
				output += encode((temp << 2) & 0x3F)
				output += '='
				break
		}

		return output
	}

	exports.toByteArray = b64ToByteArray
	exports.fromByteArray = uint8ToBase64
}(typeof exports === 'undefined' ? (this.base64js = {}) : exports))

},{}],18:[function(require,module,exports){
exports.read = function(buffer, offset, isLE, mLen, nBytes) {
  var e, m,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      nBits = -7,
      i = isLE ? (nBytes - 1) : 0,
      d = isLE ? -1 : 1,
      s = buffer[offset + i];

  i += d;

  e = s & ((1 << (-nBits)) - 1);
  s >>= (-nBits);
  nBits += eLen;
  for (; nBits > 0; e = e * 256 + buffer[offset + i], i += d, nBits -= 8);

  m = e & ((1 << (-nBits)) - 1);
  e >>= (-nBits);
  nBits += mLen;
  for (; nBits > 0; m = m * 256 + buffer[offset + i], i += d, nBits -= 8);

  if (e === 0) {
    e = 1 - eBias;
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity);
  } else {
    m = m + Math.pow(2, mLen);
    e = e - eBias;
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen);
};

exports.write = function(buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c,
      eLen = nBytes * 8 - mLen - 1,
      eMax = (1 << eLen) - 1,
      eBias = eMax >> 1,
      rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0),
      i = isLE ? 0 : (nBytes - 1),
      d = isLE ? 1 : -1,
      s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0;

  value = Math.abs(value);

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0;
    e = eMax;
  } else {
    e = Math.floor(Math.log(value) / Math.LN2);
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--;
      c *= 2;
    }
    if (e + eBias >= 1) {
      value += rt / c;
    } else {
      value += rt * Math.pow(2, 1 - eBias);
    }
    if (value * c >= 2) {
      e++;
      c /= 2;
    }

    if (e + eBias >= eMax) {
      m = 0;
      e = eMax;
    } else if (e + eBias >= 1) {
      m = (value * c - 1) * Math.pow(2, mLen);
      e = e + eBias;
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen);
      e = 0;
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8);

  e = (e << mLen) | m;
  eLen += mLen;
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8);

  buffer[offset + i - d] |= s * 128;
};

},{}],19:[function(require,module,exports){

/**
 * isArray
 */

var isArray = Array.isArray;

/**
 * toString
 */

var str = Object.prototype.toString;

/**
 * Whether or not the given `val`
 * is an array.
 *
 * example:
 *
 *        isArray([]);
 *        // > true
 *        isArray(arguments);
 *        // > false
 *        isArray('');
 *        // > false
 *
 * @param {mixed} val
 * @return {bool}
 */

module.exports = isArray || function (val) {
  return !! val && '[object Array]' == str.call(val);
};

},{}],20:[function(require,module,exports){
if (typeof Object.create === 'function') {
  // implementation from standard node.js 'util' module
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    ctor.prototype = Object.create(superCtor.prototype, {
      constructor: {
        value: ctor,
        enumerable: false,
        writable: true,
        configurable: true
      }
    });
  };
} else {
  // old school shim for old browsers
  module.exports = function inherits(ctor, superCtor) {
    ctor.super_ = superCtor
    var TempCtor = function () {}
    TempCtor.prototype = superCtor.prototype
    ctor.prototype = new TempCtor()
    ctor.prototype.constructor = ctor
  }
}

},{}],21:[function(require,module,exports){
// shim for using process in browser

var process = module.exports = {};
var queue = [];
var draining = false;

function drainQueue() {
    if (draining) {
        return;
    }
    draining = true;
    var currentQueue;
    var len = queue.length;
    while(len) {
        currentQueue = queue;
        queue = [];
        var i = -1;
        while (++i < len) {
            currentQueue[i]();
        }
        len = queue.length;
    }
    draining = false;
}
process.nextTick = function (fun) {
    queue.push(fun);
    if (!draining) {
        setTimeout(drainQueue, 0);
    }
};

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];
process.version = ''; // empty string to avoid regexp issues

function noop() {}

process.on = noop;
process.addListener = noop;
process.once = noop;
process.off = noop;
process.removeListener = noop;
process.removeAllListeners = noop;
process.emit = noop;

process.binding = function (name) {
    throw new Error('process.binding is not supported');
};

// TODO(shtylman)
process.cwd = function () { return '/' };
process.chdir = function (dir) {
    throw new Error('process.chdir is not supported');
};
process.umask = function() { return 0; };

},{}],22:[function(require,module,exports){
module.exports = function isBuffer(arg) {
  return arg && typeof arg === 'object'
    && typeof arg.copy === 'function'
    && typeof arg.fill === 'function'
    && typeof arg.readUInt8 === 'function';
}
},{}],23:[function(require,module,exports){
(function (process,global){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var formatRegExp = /%[sdj%]/g;
exports.format = function(f) {
  if (!isString(f)) {
    var objects = [];
    for (var i = 0; i < arguments.length; i++) {
      objects.push(inspect(arguments[i]));
    }
    return objects.join(' ');
  }

  var i = 1;
  var args = arguments;
  var len = args.length;
  var str = String(f).replace(formatRegExp, function(x) {
    if (x === '%%') return '%';
    if (i >= len) return x;
    switch (x) {
      case '%s': return String(args[i++]);
      case '%d': return Number(args[i++]);
      case '%j':
        try {
          return JSON.stringify(args[i++]);
        } catch (_) {
          return '[Circular]';
        }
      default:
        return x;
    }
  });
  for (var x = args[i]; i < len; x = args[++i]) {
    if (isNull(x) || !isObject(x)) {
      str += ' ' + x;
    } else {
      str += ' ' + inspect(x);
    }
  }
  return str;
};


// Mark that a method should not be used.
// Returns a modified function which warns once by default.
// If --no-deprecation is set, then it is a no-op.
exports.deprecate = function(fn, msg) {
  // Allow for deprecating things in the process of starting up.
  if (isUndefined(global.process)) {
    return function() {
      return exports.deprecate(fn, msg).apply(this, arguments);
    };
  }

  if (process.noDeprecation === true) {
    return fn;
  }

  var warned = false;
  function deprecated() {
    if (!warned) {
      if (process.throwDeprecation) {
        throw new Error(msg);
      } else if (process.traceDeprecation) {
        console.trace(msg);
      } else {
        console.error(msg);
      }
      warned = true;
    }
    return fn.apply(this, arguments);
  }

  return deprecated;
};


var debugs = {};
var debugEnviron;
exports.debuglog = function(set) {
  if (isUndefined(debugEnviron))
    debugEnviron = process.env.NODE_DEBUG || '';
  set = set.toUpperCase();
  if (!debugs[set]) {
    if (new RegExp('\\b' + set + '\\b', 'i').test(debugEnviron)) {
      var pid = process.pid;
      debugs[set] = function() {
        var msg = exports.format.apply(exports, arguments);
        console.error('%s %d: %s', set, pid, msg);
      };
    } else {
      debugs[set] = function() {};
    }
  }
  return debugs[set];
};


/**
 * Echos the value of a value. Trys to print the value out
 * in the best way possible given the different types.
 *
 * @param {Object} obj The object to print out.
 * @param {Object} opts Optional options object that alters the output.
 */
/* legacy: obj, showHidden, depth, colors*/
function inspect(obj, opts) {
  // default options
  var ctx = {
    seen: [],
    stylize: stylizeNoColor
  };
  // legacy...
  if (arguments.length >= 3) ctx.depth = arguments[2];
  if (arguments.length >= 4) ctx.colors = arguments[3];
  if (isBoolean(opts)) {
    // legacy...
    ctx.showHidden = opts;
  } else if (opts) {
    // got an "options" object
    exports._extend(ctx, opts);
  }
  // set default options
  if (isUndefined(ctx.showHidden)) ctx.showHidden = false;
  if (isUndefined(ctx.depth)) ctx.depth = 2;
  if (isUndefined(ctx.colors)) ctx.colors = false;
  if (isUndefined(ctx.customInspect)) ctx.customInspect = true;
  if (ctx.colors) ctx.stylize = stylizeWithColor;
  return formatValue(ctx, obj, ctx.depth);
}
exports.inspect = inspect;


// http://en.wikipedia.org/wiki/ANSI_escape_code#graphics
inspect.colors = {
  'bold' : [1, 22],
  'italic' : [3, 23],
  'underline' : [4, 24],
  'inverse' : [7, 27],
  'white' : [37, 39],
  'grey' : [90, 39],
  'black' : [30, 39],
  'blue' : [34, 39],
  'cyan' : [36, 39],
  'green' : [32, 39],
  'magenta' : [35, 39],
  'red' : [31, 39],
  'yellow' : [33, 39]
};

// Don't use 'blue' not visible on cmd.exe
inspect.styles = {
  'special': 'cyan',
  'number': 'yellow',
  'boolean': 'yellow',
  'undefined': 'grey',
  'null': 'bold',
  'string': 'green',
  'date': 'magenta',
  // "name": intentionally not styling
  'regexp': 'red'
};


function stylizeWithColor(str, styleType) {
  var style = inspect.styles[styleType];

  if (style) {
    return '\u001b[' + inspect.colors[style][0] + 'm' + str +
           '\u001b[' + inspect.colors[style][1] + 'm';
  } else {
    return str;
  }
}


function stylizeNoColor(str, styleType) {
  return str;
}


function arrayToHash(array) {
  var hash = {};

  array.forEach(function(val, idx) {
    hash[val] = true;
  });

  return hash;
}


function formatValue(ctx, value, recurseTimes) {
  // Provide a hook for user-specified inspect functions.
  // Check that value is an object with an inspect function on it
  if (ctx.customInspect &&
      value &&
      isFunction(value.inspect) &&
      // Filter out the util module, it's inspect function is special
      value.inspect !== exports.inspect &&
      // Also filter out any prototype objects using the circular check.
      !(value.constructor && value.constructor.prototype === value)) {
    var ret = value.inspect(recurseTimes, ctx);
    if (!isString(ret)) {
      ret = formatValue(ctx, ret, recurseTimes);
    }
    return ret;
  }

  // Primitive types cannot have properties
  var primitive = formatPrimitive(ctx, value);
  if (primitive) {
    return primitive;
  }

  // Look up the keys of the object.
  var keys = Object.keys(value);
  var visibleKeys = arrayToHash(keys);

  if (ctx.showHidden) {
    keys = Object.getOwnPropertyNames(value);
  }

  // IE doesn't make error fields non-enumerable
  // http://msdn.microsoft.com/en-us/library/ie/dww52sbt(v=vs.94).aspx
  if (isError(value)
      && (keys.indexOf('message') >= 0 || keys.indexOf('description') >= 0)) {
    return formatError(value);
  }

  // Some type of object without properties can be shortcutted.
  if (keys.length === 0) {
    if (isFunction(value)) {
      var name = value.name ? ': ' + value.name : '';
      return ctx.stylize('[Function' + name + ']', 'special');
    }
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    }
    if (isDate(value)) {
      return ctx.stylize(Date.prototype.toString.call(value), 'date');
    }
    if (isError(value)) {
      return formatError(value);
    }
  }

  var base = '', array = false, braces = ['{', '}'];

  // Make Array say that they are Array
  if (isArray(value)) {
    array = true;
    braces = ['[', ']'];
  }

  // Make functions say that they are functions
  if (isFunction(value)) {
    var n = value.name ? ': ' + value.name : '';
    base = ' [Function' + n + ']';
  }

  // Make RegExps say that they are RegExps
  if (isRegExp(value)) {
    base = ' ' + RegExp.prototype.toString.call(value);
  }

  // Make dates with properties first say the date
  if (isDate(value)) {
    base = ' ' + Date.prototype.toUTCString.call(value);
  }

  // Make error with message first say the error
  if (isError(value)) {
    base = ' ' + formatError(value);
  }

  if (keys.length === 0 && (!array || value.length == 0)) {
    return braces[0] + base + braces[1];
  }

  if (recurseTimes < 0) {
    if (isRegExp(value)) {
      return ctx.stylize(RegExp.prototype.toString.call(value), 'regexp');
    } else {
      return ctx.stylize('[Object]', 'special');
    }
  }

  ctx.seen.push(value);

  var output;
  if (array) {
    output = formatArray(ctx, value, recurseTimes, visibleKeys, keys);
  } else {
    output = keys.map(function(key) {
      return formatProperty(ctx, value, recurseTimes, visibleKeys, key, array);
    });
  }

  ctx.seen.pop();

  return reduceToSingleString(output, base, braces);
}


function formatPrimitive(ctx, value) {
  if (isUndefined(value))
    return ctx.stylize('undefined', 'undefined');
  if (isString(value)) {
    var simple = '\'' + JSON.stringify(value).replace(/^"|"$/g, '')
                                             .replace(/'/g, "\\'")
                                             .replace(/\\"/g, '"') + '\'';
    return ctx.stylize(simple, 'string');
  }
  if (isNumber(value))
    return ctx.stylize('' + value, 'number');
  if (isBoolean(value))
    return ctx.stylize('' + value, 'boolean');
  // For some reason typeof null is "object", so special case here.
  if (isNull(value))
    return ctx.stylize('null', 'null');
}


function formatError(value) {
  return '[' + Error.prototype.toString.call(value) + ']';
}


function formatArray(ctx, value, recurseTimes, visibleKeys, keys) {
  var output = [];
  for (var i = 0, l = value.length; i < l; ++i) {
    if (hasOwnProperty(value, String(i))) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          String(i), true));
    } else {
      output.push('');
    }
  }
  keys.forEach(function(key) {
    if (!key.match(/^\d+$/)) {
      output.push(formatProperty(ctx, value, recurseTimes, visibleKeys,
          key, true));
    }
  });
  return output;
}


function formatProperty(ctx, value, recurseTimes, visibleKeys, key, array) {
  var name, str, desc;
  desc = Object.getOwnPropertyDescriptor(value, key) || { value: value[key] };
  if (desc.get) {
    if (desc.set) {
      str = ctx.stylize('[Getter/Setter]', 'special');
    } else {
      str = ctx.stylize('[Getter]', 'special');
    }
  } else {
    if (desc.set) {
      str = ctx.stylize('[Setter]', 'special');
    }
  }
  if (!hasOwnProperty(visibleKeys, key)) {
    name = '[' + key + ']';
  }
  if (!str) {
    if (ctx.seen.indexOf(desc.value) < 0) {
      if (isNull(recurseTimes)) {
        str = formatValue(ctx, desc.value, null);
      } else {
        str = formatValue(ctx, desc.value, recurseTimes - 1);
      }
      if (str.indexOf('\n') > -1) {
        if (array) {
          str = str.split('\n').map(function(line) {
            return '  ' + line;
          }).join('\n').substr(2);
        } else {
          str = '\n' + str.split('\n').map(function(line) {
            return '   ' + line;
          }).join('\n');
        }
      }
    } else {
      str = ctx.stylize('[Circular]', 'special');
    }
  }
  if (isUndefined(name)) {
    if (array && key.match(/^\d+$/)) {
      return str;
    }
    name = JSON.stringify('' + key);
    if (name.match(/^"([a-zA-Z_][a-zA-Z_0-9]*)"$/)) {
      name = name.substr(1, name.length - 2);
      name = ctx.stylize(name, 'name');
    } else {
      name = name.replace(/'/g, "\\'")
                 .replace(/\\"/g, '"')
                 .replace(/(^"|"$)/g, "'");
      name = ctx.stylize(name, 'string');
    }
  }

  return name + ': ' + str;
}


function reduceToSingleString(output, base, braces) {
  var numLinesEst = 0;
  var length = output.reduce(function(prev, cur) {
    numLinesEst++;
    if (cur.indexOf('\n') >= 0) numLinesEst++;
    return prev + cur.replace(/\u001b\[\d\d?m/g, '').length + 1;
  }, 0);

  if (length > 60) {
    return braces[0] +
           (base === '' ? '' : base + '\n ') +
           ' ' +
           output.join(',\n  ') +
           ' ' +
           braces[1];
  }

  return braces[0] + base + ' ' + output.join(', ') + ' ' + braces[1];
}


// NOTE: These type checking functions intentionally don't use `instanceof`
// because it is fragile and can be easily faked with `Object.create()`.
function isArray(ar) {
  return Array.isArray(ar);
}
exports.isArray = isArray;

function isBoolean(arg) {
  return typeof arg === 'boolean';
}
exports.isBoolean = isBoolean;

function isNull(arg) {
  return arg === null;
}
exports.isNull = isNull;

function isNullOrUndefined(arg) {
  return arg == null;
}
exports.isNullOrUndefined = isNullOrUndefined;

function isNumber(arg) {
  return typeof arg === 'number';
}
exports.isNumber = isNumber;

function isString(arg) {
  return typeof arg === 'string';
}
exports.isString = isString;

function isSymbol(arg) {
  return typeof arg === 'symbol';
}
exports.isSymbol = isSymbol;

function isUndefined(arg) {
  return arg === void 0;
}
exports.isUndefined = isUndefined;

function isRegExp(re) {
  return isObject(re) && objectToString(re) === '[object RegExp]';
}
exports.isRegExp = isRegExp;

function isObject(arg) {
  return typeof arg === 'object' && arg !== null;
}
exports.isObject = isObject;

function isDate(d) {
  return isObject(d) && objectToString(d) === '[object Date]';
}
exports.isDate = isDate;

function isError(e) {
  return isObject(e) &&
      (objectToString(e) === '[object Error]' || e instanceof Error);
}
exports.isError = isError;

function isFunction(arg) {
  return typeof arg === 'function';
}
exports.isFunction = isFunction;

function isPrimitive(arg) {
  return arg === null ||
         typeof arg === 'boolean' ||
         typeof arg === 'number' ||
         typeof arg === 'string' ||
         typeof arg === 'symbol' ||  // ES6 symbol
         typeof arg === 'undefined';
}
exports.isPrimitive = isPrimitive;

exports.isBuffer = require('./support/isBuffer');

function objectToString(o) {
  return Object.prototype.toString.call(o);
}


function pad(n) {
  return n < 10 ? '0' + n.toString(10) : n.toString(10);
}


var months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep',
              'Oct', 'Nov', 'Dec'];

// 26 Feb 16:19:34
function timestamp() {
  var d = new Date();
  var time = [pad(d.getHours()),
              pad(d.getMinutes()),
              pad(d.getSeconds())].join(':');
  return [d.getDate(), months[d.getMonth()], time].join(' ');
}


// log is just a thin wrapper to console.log that prepends a timestamp
exports.log = function() {
  console.log('%s - %s', timestamp(), exports.format.apply(exports, arguments));
};


/**
 * Inherit the prototype methods from one constructor into another.
 *
 * The Function.prototype.inherits from lang.js rewritten as a standalone
 * function (not on Function.prototype). NOTE: If this file is to be loaded
 * during bootstrapping this function needs to be rewritten using some native
 * functions as prototype setup using normal JavaScript does not work as
 * expected during bootstrapping (see mirror.js in r114903).
 *
 * @param {function} ctor Constructor function which needs to inherit the
 *     prototype.
 * @param {function} superCtor Constructor function to inherit prototype from.
 */
exports.inherits = require('inherits');

exports._extend = function(origin, add) {
  // Don't do anything if add isn't an object
  if (!add || !isObject(add)) return origin;

  var keys = Object.keys(add);
  var i = keys.length;
  while (i--) {
    origin[keys[i]] = add[keys[i]];
  }
  return origin;
};

function hasOwnProperty(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

}).call(this,require('_process'),typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{"./support/isBuffer":22,"_process":21,"inherits":20}]},{},[1]);
