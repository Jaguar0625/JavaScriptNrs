// get the curve functions
var curve25519 = require('./core/curve25519.node.js');

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
}

var debug = require('./core/debug');
debug.enable = true;

function loadTestCases(inputFile, l1, l2, l3, l4, runTestCase) {
    var fs = require('fs');
    fs.readFile(inputFile, 'utf8', function (err, data) {
        if (err)
            return console.log(err);

        console.log('Running test cases from ' + inputFile);

        var linesPerTest = 4
        var lines = data.split('\n');
        var numTestCases = (lines.length / linesPerTest) | 0;
        console.log('test cases: ' + numTestCases + ' (lines: ' + lines.length + ')');

        var testCases = [];
        for (var i = 0; i < numTestCases; ++i) {
            var startLine = i * linesPerTest;
            var testCase = {};
            testCase[l1] = extractBytesFromLine(lines[startLine]);
            testCase[l2] = extractBytesFromLine(lines[startLine + 1]);
            testCase[l3] = extractBytesFromLine(lines[startLine + 2]);
            testCase[l4] = extractBytesFromLine(lines[startLine + 3]);

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

        console.log('');
    });
}

function runSignTest() {
    loadTestCases('./data/signtest.dat', 'v', 'h', 'x', 's', function (testCase) {

        var v = curve25519.sign(testCase.h, testCase.x, testCase.s);

        if (!areEqual(v, testCase.v)) {
            debug.logBytes('E', testCase.v);
            debug.logBytes('A', v);
            console.log('');
            return false;
        }

        return true;
    });
}

function runKeygenTest() {
    loadTestCases('./data/keygentest.dat', 'k1', 'p', 's', 'k2', function (testCase) {

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
            debug.logBytes('E(' + pair.name + ')', pair.e);
            debug.logBytes('A(' + pair.name + ')', pair.a);
        }

        return !hasFailure;
    });
}

function runVerifyTest () {
    loadTestCases('./data/verifytest.dat', 'y', 'v', 'h', 'p', function (testCase) {

        var y = curve25519.verify(testCase.v, testCase.h, testCase.p);

        if (!areEqual(y, testCase.y)) {
            ++numFailures;
            console.log(i + ': failed :(');
            debug.logBytes('E', testCase.y);
            debug.logBytes('A', y);
            console.log('');
            return false;
        }

        return true;
    });
}

runSignTest();
runKeygenTest();
runVerifyTest();