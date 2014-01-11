var output = {
    logBytes: function (tag, bytes) {
        process.stdout.write(tag + ': ');
        if (!bytes)
            process.stdout.write('(null)');
        else
            for (var i = 0; i < bytes.length; ++i) {
                var s = (bytes[i] <= 0x0F) ? '0' : '';
                s += bytes[i].toString(16).toUpperCase();
                process.stdout.write(s + ' ');
            }

        console.log('');
    }
};

exports.logBytes = output.logBytes;