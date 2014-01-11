var output = require('../core/output');

var debug = {
    enable: false,
    logBytes: function (tag, bytes) {
        if (!this.enable)
            return;

        output.logBytes(tag, bytes);
    },
    log: function (message) {
        if (!this.enable)
            return;

        console.log(message);
    },
    logLong10: function (tag, value) {
        if (!this.enable)
            return;

        console.log(
            tag + ": " +
                value._0 + " " +
                value._1 + " " +
                value._2 + " " +
                value._3 + " " +
                value._4 + " " +
                value._5 + " " +
                value._6 + " " +
                value._7 + " " +
                value._8 + " " +
                value._9 + " ");
    }
};

exports.logBytes = debug.logBytes;
exports.log = debug.log;
exports.logLong10 = debug.logLong10;