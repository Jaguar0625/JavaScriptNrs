var converters = function () {
    var charToNibble= {};
    var nibbleToChar = [];
    var i;
    for (i = 0; i <= 9; ++i) {
        var char = i.toString();
        charToNibble[char] = i;
        nibbleToChar.push(char)
    }

    for (i = 10; i <= 15; ++i) {
        var lowerChar = String.fromCharCode('a'.charCodeAt(0) + i - 10);
        var upperChar = String.fromCharCode('A'.charCodeAt(0) + i - 10);

        charToNibble[lowerChar] = i;
        charToNibble[upperChar] = i;
        nibbleToChar.push(lowerChar);
    }

    return {
        byteArrayToHexString: function (bytes) {
            var str = '';
            for (var i = 0; i < bytes.length; ++i)
                str += nibbleToChar[bytes[i] >> 4] + nibbleToChar[bytes[i] & 0x0F];

            return str;
        },
        stringToByteArray: function (str) {
            var bytes = new Array(str.length);
            for (var i = 0; i < str.length; ++i)
                bytes[i] = str.charCodeAt(i);

            return bytes;
        },
        hexStringToByteArray: function (str) {
            var bytes = [];
            var i = 0;
            if (0 !== str.length % 2) {
                bytes.push(charToNibble[str.charAt(0)]);
                ++i;
            }

            for (; i < str.length - 1; i += 2)
                bytes.push((charToNibble[str.charAt(i)] << 4) + charToNibble[str.charAt(i + 1)]);

            return bytes;
        },
        stringToHexString: function (str) {
            return this.byteArrayToHexString(this.stringToByteArray(str));
        }
    }
}();