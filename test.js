// get the curve and crypto functions
var crypto = require('./util/nodejs.bootstrap.js');
curve25519 = crypto.curve25519;
crypto = crypto.crypto;

var output = require('./util/output');

function extractPhraseFromLine(line) {
    return line.split(' ')[1];
}

function extractBytesFromLine(line) {
    var bytes = [];
    var parts = line.split(' ');

    for (var i = 1; i < parts.length - 1; ++i) {
        var byte = (parts[i], 16) & 0xFF;
        if (0 != (byte & 0x80))
            byte |= 0xFFFFFF00;

        bytes.push(parseInt(parts[i], 16) & 0xFF);
    }

    return bytes;
}

function areEqual(bytes1, bytes2) {
    if (bytes1.length !== bytes2.length)
        return false;

    for (var i = 0; i < bytes1.length; ++i) {
        if (bytes1[i] !== bytes2[i])
            return false;
    }

    return true;
}

function measureActionTime(action, denom) {
    var start = process.hrtime();

    action();

    var diff = process.hrtime(start);
    var elapsed = diff[0] * 1e3 + diff[1] / 1e6;
    console.log('TOT: ' + elapsed.toFixed(3) + 'ms ');
    console.log('AVG: ' + (elapsed / denom).toFixed(3) + 'ms ');
    console.log('');
}

function loadTestCases(inputFile, testCaseParameters, runTestCase) {
    var fs = require('fs');
    fs.readFile(inputFile, 'utf8', function (err, data) {
        if (err)
            return console.log(err);

        console.log('Running test cases from ' + inputFile);

        var linesPerTest = testCaseParameters.length;
        var lines = data.split('\n');
        var numTestCases = (lines.length / linesPerTest) | 0;
        console.log('test cases: ' + numTestCases + ' (lines: ' + lines.length + ')');

        var testCases = [];
        for (var i = 0; i < numTestCases; ++i) {
            var startLine = i * linesPerTest;
            var testCase = {};
            for (var j = 0; j < linesPerTest; ++j) {
                var parameter = testCaseParameters[j];
                var converter = (parameter.type === 'string')
                    ? extractPhraseFromLine
                    : extractBytesFromLine;

                testCase[parameter.name || parameter] = converter(lines[startLine + j]);
            }

            testCases.push(testCase);
        }

        measureActionTime(function () {
            var numFailed = 0;
            var numPassed = 0;
            for (var i = 0; i < testCases.length; ++i) {
                var testCase = testCases[i];

                if (runTestCase(testCase)) {
                    ++numPassed;
                } else {
                    ++numFailed;
                    console.log('^' + i + ': failed :(');
                }
            }

            console.log(numFailed + ' failures / ' + numPassed + ' passed');
        }, testCases.length);
    });
}

function runSignTest() {
    loadTestCases('./data/signtest.dat', ['v', 'h', 'x', 's'], function (testCase) {

        var v = curve25519.sign(testCase.h, testCase.x, testCase.s);

        if (!areEqual(v, testCase.v)) {
            output.logBytes('E', testCase.v);
            output.logBytes('A', v);
            return false;
        }

        return true;
    });
}

function runKeygenTest() {
    loadTestCases('./data/keygentest.dat', ['k1', 'p', 's', 'k2'], function (testCase) {

        var result = curve25519.keygen(testCase.k1);

        var pairs = [
            { a: result.p, e: testCase.p, name: 'p' },
            { a: result.s, e: testCase.s, name: 's' },
            { a: result.k, e: testCase.k2, name: 'k' }
        ];

        var hasFailure = false;
        for (var j = 0; j < pairs.length; ++j) {
            var pair = pairs[j];
            if (areEqual(pair.e, pair.a))
                continue;

            hasFailure = true;
            output.logBytes('E(' + pair.name + ')', pair.e);
            output.logBytes('A(' + pair.name + ')', pair.a);
        }

        return !hasFailure;
    });
}

function runVerifyTest () {
    loadTestCases('./data/verifytest.dat', ['y', 'v', 'h', 'p'], function (testCase) {

        var y = curve25519.verify(testCase.v, testCase.h, testCase.p);

        if (!areEqual(y, testCase.y)) {
            output.logBytes('E', testCase.y);
            output.logBytes('A', y);
            return false;
        }

        return true;
    });
}

function runCryptoPublicKeyTest () {
    loadTestCases('./data/cryptopublickeytest.dat', [{ name: 'p', type: 'string' }, 'k'], function (testCase) {
        var k = crypto.publicKey(testCase.p);

        if (!areEqual(k, testCase.k)) {
            output.logBytes('E', testCase.k);
            output.logBytes('A', k);
            return false;
        }

        return true;
    });
}

function runCryptoSignTest () {
    loadTestCases('./data/cryptosigntest.dat', [{ name: 'p', type: 'string' }, 'm', 's'], function (testCase) {
        var s = crypto.sign(testCase.m, testCase.p);

        if (!areEqual(s, testCase.s)) {
            output.logBytes('E', testCase.s);
            output.logBytes('A', s);
            return false;
        }

        return true;
    });
}

function stringToBytes(s) {
    var bytes = [];
    for (var i = 0; i < s.length; ++i)
        bytes.push(s.charCodeAt(i));

    return bytes;
}

function runCryptoVerifyTest () {
    console.log('Running verification test cases ...');

    var secrets = ['alpha', 'gamma', 'zeta'];
    var messages = ['seahawks', 'saints', 'patriots', 'colts'];

    console.log('generating public keys (' + secrets.length + ') ...');
    var keys = [];
    for (var i = 0; i < secrets.length; ++i)
        keys.push(crypto.publicKey(secrets[i]));

    function foreachSecretAndMessage (callback) {
        for (var i = 0; i < secrets.length; ++i) {
            for (var j = 0; j < messages.length; ++j)
                callback(secrets[i], keys[i], messages[j]);
        }
    }

    console.log('generating signatures (' + messages.length + ') ...');
    var sigs = {};
    foreachSecretAndMessage(function (secret, key, message) {
        var messageBytes = stringToBytes(message);
        var sig = crypto.sign(messageBytes, secret);
        sigs[secret + '.' + message] = sig;
    });

    console.log('verifying ...');
    measureActionTime(function () {
        var numPassed = 0;
        var numFailed = 0;
        foreachSecretAndMessage(function (secret, key, message) {
            var id = secret + '.' + message;
            for (var i in sigs) {
                var messageBytes = stringToBytes(message);
                var result = crypto.verify(sigs[i], messageBytes, key);

                if (result == (id == i)) {
                    ++numPassed;
                    continue;
                }

                ++numFailed;
                console.log('E: ' + (id == i));
                console.log('A: ' + result);
                console.log('^[' + secret + ', ' + message + ', ' + id + '] :(');
            }
        });

        console.log(numFailed + ' failures / ' + numPassed + ' passed');
    }, secrets.length * messages.length * secrets.length * messages.length);
}

runSignTest();
runKeygenTest();
runVerifyTest();

runCryptoPublicKeyTest();
runCryptoSignTest()
runCryptoVerifyTest();;