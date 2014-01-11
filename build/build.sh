if [ -e ./core/curve25519.debug.js ];
then
    echo 'Removing debug statements from ./core/curve25519 ...';
    sed -e '/debug/d' \
        -e '/./,/^$/!d' \
        ./core/curve25519.debug.js > ./core/curve25519.js;
fi

if [ -e ./core/crypto.debug.js ];
then
    echo 'Removing debug statements from ./core/crypto ...';
    sed -e '/debug/d' \
        -e '/./,/^$/!d' \
        ./core/crypto.debug.js > ./core/crypto.js;
fi

if [ -e ./data/MainDebug.java ];
then
    echo 'Removing debug statements from ./data/MainDebug.java ...';
    sed -e '/[^n]Debug\./d' \
        -e 's/MainDebug/Main/' \
        -e '/./,/^$/!d' \
        ./data/MainDebug.java > ./data/Main.java
fi

pushd . > /dev/null

cd datagen

echo 'Compiling java ...'
mkdir -p bin
javac Main.java -d bin

echo 'Generating data files ...'
cd bin
function generateDataFiles {
    local dataDir=../../data
    java Main 'sign' > $dataDir/signtest.dat
    java Main 'keygen' > $dataDir/keygentest.dat
    java Main 'verify' > $dataDir/verifytest.dat
    java Main 'crypto-sign' > $dataDir/cryptosigntest.dat
    java Main 'crypto-publickey' > $dataDir/cryptopublickeytest.dat
}

generateDataFiles

popd > /dev/null

# sed -e '/debug/d' \
#    -e '/.*NODEJS>/,/.*<NODEJS/d' \
#    -e '/./,/^$/!d' \
#    ./core/curve25519.node.js > ./core/curve25519.js