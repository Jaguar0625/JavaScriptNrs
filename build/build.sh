if [ -e ./core/curve25519.debug.js ];
then
    echo 'Removing debug statements from ./core/curve25519 ...';
    sed -e '/debug/d' \
        -e '/./,/^$/!d' \
        ./core/curve25519.debug.js > ./core/curve25519.js;
fi

if [ -e ./data/Main.debug.java ];
then
    echo 'Removing debug statements from ./data/Main.js ...';
    sed -e '/Debug\./d' \
        -e '/./,/^$/!d' \
        ./data/Main.debug.java > ./data/Main.java
fi

pushd . > /dev/null

cd data

echo 'Compiling java ...'
javac Main.java

echo 'Generating data files ...'
java Main 'sign' > signtest.dat
java Main 'keygen' > keygentest.dat
java Main 'verify' > verifytest.dat

popd > /dev/null

# sed -e '/debug/d' \
#    -e '/.*NODEJS>/,/.*<NODEJS/d' \
#    -e '/./,/^$/!d' \
#    ./core/curve25519.node.js > ./core/curve25519.js