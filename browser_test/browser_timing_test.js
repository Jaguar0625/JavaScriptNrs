$(function ($) {
    var c = {
        getPublicKey: nxtCrypto.getPublicKey,
        sign: nxtCrypto.sign,
        verify: nxtCrypto.verify
    };

    var expectedResult = {
        publicKey: '698168d8669c9310d68101dfcc974ed4ef454692da6f028f68114db5fdcc4f6a',
        signature: '94956bf3de7cfdedb2562a0eff698fed7f3e54bbf4476fbb23a192ddea04040f68efa5d03c3f9ebec4109401b50433f1df267299d8b1ad2c485046c45e6b38da',
        verify: true
    };

    function timeAction (actionName, averageElement, action) {
        console.log('timing: ' + actionName);
        var startTime = new Date().getTime();

        var numIterations = 1000;
        for (var i = 0; i < numIterations; ++i)
            action();

        var endTime = new Date().getTime();
        var average = (endTime - startTime) / numIterations;
        averageElement.text(average + 'ms');
    }

    function runSingleTest (message, secret) {
        var publicKey = c.getPublicKey(secret);
        var signature = c.sign(message, secret);
        var verify = c.verify(signature, message, publicKey);

        return {
            publicKey: publicKey,
            signature: signature,
            verify: verify
        }
    }

    function checkCorrectness (result) {
        var propertyElementPairs = [
            { id: '#pk-result', propertyName: 'publicKey' },
            { id: '#sign-result', propertyName: 'signature' },
            { id: '#verify-result', propertyName: 'verify' }
        ];

        for (var i = 0; i < propertyElementPairs.length; ++i) {
            var pair = propertyElementPairs[i];
            var element = $(pair.id);
            element.text(result[pair.propertyName]);
            if (result[pair.propertyName] !== expectedResult[pair.propertyName])
                element.addClass('error');
        }
    }

    function checkTiming () {
        timeAction('getPublicKey', $('#pk-timing'), function () {
            c.getPublicKey(secret)
        });

        timeAction('sign', $('#sign-timing'), function () {
            c.sign(message, secret);
        });

        timeAction('verify', $('#verify-timing'), function () {
            c.verify(result.signature, message, result.publicKey);
        });
    }

    var message = converters.stringToHexString($('#message').text());
    $('#message-hex').text(message);

    var secret = converters.stringToHexString($('#secret').text());
    $('#secret-hex').text(secret);

    var result = runSingleTest(message, secret);
    checkCorrectness(result);
    checkTiming();
});