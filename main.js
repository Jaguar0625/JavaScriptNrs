var nrs = require('./JavaScriptNrs.js');

var h = [];
var x = [];
var s = [];
for (var i = 0; i < 32; ++i) {
    h[i] = i * 1;
    x[i] = i * 2;
    s[i] = i * 3;
}

var v = nrs.sign(h, x, s);
for (var i = 0; i < v.length; ++i)
    console.log('v[' + i + ']: ' + v[i]);